begin;

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('review', 'list')),
  source_key text not null check (length(source_key) between 1 and 100),
  display_name text not null check (length(trim(display_name)) between 2 and 30 and display_name !~ '[@<>]'),
  title text not null check (length(trim(title)) between 1 and 300),
  body text not null check (length(body) <= 600 and (kind <> 'review' or length(trim(body)) > 0)),
  rating smallint check (rating between 1 and 10),
  items jsonb not null,
  spoilers boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, source_key)
);
create index community_posts_feed on public.community_posts(created_at desc, id desc) where published;
create table public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);
create table public.community_reports (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'spoiler')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_reports enable row level security;
create policy owner_access on public.community_posts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy public_read on public.community_posts for select to anon, authenticated using (published);
create policy owner_access on public.community_likes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_access on public.community_reports for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.community_posts, public.community_likes, public.community_reports from public, anon, authenticated;

-- Snapshot publik hanya memuat identitas judul, tanpa catatan atau progres pribadi.
create function public.community_valid_items(p_items jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare v jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then return false; end if;
  for v in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v) <> 'object'
      or (v->>'type' in ('movie', 'tv')) is not true
      or (jsonb_typeof(v->'id') = 'number') is not true
      or (v->>'id' ~ '^[1-9][0-9]{0,15}$') is not true
      or (v->>'id')::numeric > 9007199254740991
      or (jsonb_typeof(v->'title') = 'string' and length(trim(v->>'title')) between 1 and 300) is not true
      or (v ? 'posterPath' and v->'posterPath' <> 'null'::jsonb and (v->>'posterPath' ~ '^/[a-zA-Z0-9_-]+\.(jpg|png|webp)$') is not true)
      or exists (select 1 from jsonb_object_keys(v) k where k not in ('id', 'type', 'title', 'posterPath'))
    then return false; end if;
  end loop;
  return true;
end $$;
alter table public.community_posts add constraint community_items_valid check (public.community_valid_items(items) and (kind <> 'review' or jsonb_array_length(items) = 1));

-- Akses langsung tetap ditutup, tiap RPC memeriksa pemilik dan kolom publik.
create function public.community_publish(p_kind text, p_source_key text, p_display_name text, p_title text, p_body text, p_rating integer, p_items jsonb, p_spoilers boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to publish'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 27));
  if p_kind not in ('review', 'list') or p_source_key is null then raise exception 'Invalid publication'; end if;
  if p_kind = 'review' and not exists (select 1 from public.personal_reviews r where r.user_id = v_user and r.media_type || ':' || r.tmdb_id::text = p_source_key) then raise exception 'Save this review in your diary first'; end if;
  if p_kind = 'list' and not exists (select 1 from public.custom_lists l where l.user_id = v_user and l.id = p_source_key) then raise exception 'Save this list to your account first'; end if;
  select id into v_id from public.community_posts where user_id = v_user and kind = p_kind and source_key = p_source_key;
  if v_id is null then
    if (select count(*) from public.community_posts where user_id = v_user) >= 50 then raise exception 'You can share up to 50 posts'; end if;
    if exists (select 1 from public.community_posts where user_id = v_user and created_at > now() - interval '30 seconds') then raise exception 'Wait 30 seconds before sharing another post'; end if;
  end if;
  insert into public.community_posts(user_id, kind, source_key, display_name, title, body, rating, items, spoilers)
  values (v_user, p_kind, p_source_key, trim(p_display_name), trim(p_title), trim(p_body), case when p_kind = 'review' then p_rating else null end, p_items, p_spoilers)
  on conflict (user_id, kind, source_key) do update set display_name = excluded.display_name, title = excluded.title, body = excluded.body, rating = excluded.rating, items = excluded.items, spoilers = excluded.spoilers, published = true, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create function public.community_set_like(p_post_id uuid, p_liked boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or p_liked is null then raise exception 'Sign in to react'; end if;
  perform 1 from public.community_posts where id = p_post_id and published for share;
  if not found then raise exception 'This post is unavailable'; end if;
  if p_liked then insert into public.community_likes(post_id, user_id) values(p_post_id, v_user) on conflict do nothing;
  else delete from public.community_likes where post_id = p_post_id and user_id = v_user; end if;
  return p_liked;
end $$;

create function public.community_unpublish(p_post_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_posts set published = false, updated_at = now() where id = p_post_id and user_id = auth.uid();
  if not found then raise exception 'This post is unavailable'; end if;
end $$;

create function public.community_report(p_post_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in to report'; end if;
  if not exists (select 1 from public.community_posts where id = p_post_id and published and user_id <> v_user) then raise exception 'This post is unavailable'; end if;
  insert into public.community_reports(post_id, user_id, reason) values(p_post_id, v_user, p_reason) on conflict do nothing;
end $$;

-- Hanya jumlah suka yang dibagikan, identitas pemberi reaksi tetap pribadi.
create function public.community_feed(p_kind text default 'all', p_mine boolean default false, p_before_time timestamptz default null, p_before_id uuid default null, p_limit integer default 12)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc, q.id desc), '[]'::jsonb) from (
    select p.id, p.kind, case when p.user_id = auth.uid() then p.source_key else null end as source_key, p.display_name, p.title, p.body, p.rating, p.items, p.spoilers, p.published, p.created_at, p.updated_at,
      coalesce(p.user_id = auth.uid(), false) as is_owner,
      (select count(*) from public.community_likes l where l.post_id = p.id) as like_count,
      exists(select 1 from public.community_likes l where l.post_id = p.id and l.user_id = auth.uid()) as is_liked
    from public.community_posts p
    where (case when p_mine then p.user_id = auth.uid() else p.published end)
      and (p_kind = 'all' or p.kind = p_kind)
      and (p_before_time is null or (p.created_at, p.id) < (p_before_time, p_before_id))
      and (p_mine or not exists(select 1 from public.community_reports r where r.post_id = p.id and r.user_id = auth.uid()))
    order by p.created_at desc, p.id desc limit least(greatest(coalesce(p_limit, 12), 1), 24)
  ) q
$$;

revoke all on function public.community_valid_items(jsonb) from public, anon, authenticated;
revoke all on function public.community_publish(text,text,text,text,text,integer,jsonb,boolean), public.community_set_like(uuid,boolean), public.community_unpublish(uuid), public.community_report(uuid,text), public.community_feed(text,boolean,timestamptz,uuid,integer) from public, anon, authenticated;
grant execute on function public.community_publish(text,text,text,text,text,integer,jsonb,boolean), public.community_set_like(uuid,boolean), public.community_unpublish(uuid), public.community_report(uuid,text) to authenticated;
grant execute on function public.community_feed(text,boolean,timestamptz,uuid,integer) to anon, authenticated;

commit;
