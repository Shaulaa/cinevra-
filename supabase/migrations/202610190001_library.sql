begin;

create table public.watchlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id bigint not null check (tmdb_id > 0 and tmdb_id <= 9007199254740991),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and (jsonb_typeof(payload->'title') = 'string') is true),
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id)
);
create table public.custom_lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  name text not null check (length(trim(name)) between 1 and 40 and lower(trim(name)) <> 'watchlist'),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create unique index custom_lists_name on public.custom_lists(user_id, lower(trim(name)));
create table public.custom_list_items (
  user_id uuid not null,
  list_id text not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id bigint not null check (tmdb_id > 0 and tmdb_id <= 9007199254740991),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and (jsonb_typeof(payload->'title') = 'string') is true),
  created_at timestamptz not null default now(),
  primary key (user_id, list_id, media_type, tmdb_id),
  foreign key (user_id, list_id) references public.custom_lists(user_id, id) on delete cascade
);
create table public.personal_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id bigint not null check (tmdb_id > 0 and tmdb_id <= 9007199254740991),
  rating smallint check (rating between 1 and 10),
  watched_on date,
  note text not null default '' check (length(note) <= 1000),
  item jsonb check (item is null or jsonb_typeof(item) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id)
);
create table public.watched_episodes (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null default 'tv' check (media_type = 'tv'),
  tmdb_id bigint not null check (tmdb_id > 0 and tmdb_id <= 9007199254740991),
  season_number integer not null check (season_number > 0),
  episode_number integer not null check (episode_number > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id, season_number, episode_number)
);

alter table public.watchlist_items enable row level security;
alter table public.custom_lists enable row level security;
alter table public.custom_list_items enable row level security;
alter table public.personal_reviews enable row level security;
alter table public.watched_episodes enable row level security;

create policy owner_access on public.watchlist_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_access on public.custom_lists for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_access on public.custom_list_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_access on public.personal_reviews for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_access on public.watched_episodes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.watchlist_items, public.custom_lists, public.custom_list_items, public.personal_reviews, public.watched_episodes from public, anon, authenticated;
grant select, insert, update, delete on public.watchlist_items, public.custom_lists, public.custom_list_items, public.personal_reviews, public.watched_episodes to authenticated;

create function public.library_apply(p_changes jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); change jsonb; r jsonb; kind text; mid bigint;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) > 10000 or octet_length(p_changes::text) > 4000000 then raise exception 'Invalid change set'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  for change in select value from jsonb_array_elements(p_changes) loop
    r := change->'row'; kind := r->>'media_type'; mid := (r->>'tmdb_id')::bigint;
    if change->>'op' = 'delete' then
      case change->>'table'
        when 'watchlist_items' then delete from public.watchlist_items where user_id = uid and media_type = kind and tmdb_id = mid;
        when 'custom_lists' then delete from public.custom_lists where user_id = uid and id = r->>'id';
        when 'custom_list_items' then delete from public.custom_list_items where user_id = uid and list_id = r->>'list_id' and media_type = kind and tmdb_id = mid;
        when 'personal_reviews' then delete from public.personal_reviews where user_id = uid and media_type = kind and tmdb_id = mid;
        when 'watched_episodes' then delete from public.watched_episodes where user_id = uid and media_type = kind and tmdb_id = mid and season_number = (r->>'season_number')::integer and episode_number = (r->>'episode_number')::integer;
        else raise exception 'Unknown table';
      end case;
    elsif change->>'op' = 'upsert' then
      case change->>'table'
        when 'watchlist_items' then
          insert into public.watchlist_items(user_id, media_type, tmdb_id, payload) values(uid, kind, mid, (r->'payload') || jsonb_build_object('id', mid, 'type', kind))
          on conflict(user_id, media_type, tmdb_id) do update set payload = excluded.payload;
        when 'custom_lists' then
          insert into public.custom_lists(user_id, id, name) values(uid, r->>'id', trim(r->>'name')) on conflict(user_id, id) do update set name = excluded.name;
        when 'custom_list_items' then
          insert into public.custom_list_items(user_id, list_id, media_type, tmdb_id, payload) values(uid, r->>'list_id', kind, mid, (r->'payload') || jsonb_build_object('id', mid, 'type', kind))
          on conflict(user_id, list_id, media_type, tmdb_id) do update set payload = excluded.payload;
        when 'personal_reviews' then
          insert into public.personal_reviews(user_id, media_type, tmdb_id, rating, watched_on, note, item) values(uid, kind, mid, (r->>'rating')::smallint, (r->>'watched_on')::date, coalesce(r->>'note',''), nullif(r->'item','null'::jsonb))
          on conflict(user_id, media_type, tmdb_id) do update set rating = excluded.rating, watched_on = excluded.watched_on, note = excluded.note, item = excluded.item;
        when 'watched_episodes' then
          insert into public.watched_episodes(user_id, media_type, tmdb_id, season_number, episode_number) values(uid, kind, mid, (r->>'season_number')::integer, (r->>'episode_number')::integer) on conflict do nothing;
        else raise exception 'Unknown table';
      end case;
    else raise exception 'Unknown operation';
    end if;
  end loop;
  if (select count(*) from public.custom_lists where user_id = uid) > 20 then raise exception 'List limit reached'; end if;
end;
$$;

create function public.library_import(p_data jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); entry jsonb; local_list jsonb; record jsonb; key text; kind text; mid bigint; lid text; ep text; n integer := 0;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if octet_length(p_data::text) > 2000000 or jsonb_typeof(p_data->'cinevra_watchlist') is distinct from 'array' or jsonb_typeof(p_data->'cinevra_lists') is distinct from 'array' or jsonb_typeof(p_data->'cinevra_personal') is distinct from 'object' then raise exception 'Invalid guest collection'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  for entry in select value from jsonb_array_elements(p_data->'cinevra_watchlist') loop
    insert into public.watchlist_items(user_id,media_type,tmdb_id,payload,created_at) values(uid,entry->>'type',(entry->>'id')::bigint,entry,now() - n * interval '1 millisecond') on conflict do nothing;
    n := n + 1;
  end loop;
  for local_list in select value from jsonb_array_elements(p_data->'cinevra_lists') loop
    select id into lid from public.custom_lists where user_id = uid and (id = local_list->>'id' or lower(trim(name)) = lower(trim(local_list->>'name'))) order by (id = local_list->>'id') desc limit 1;
    if lid is null then
      lid := local_list->>'id';
      insert into public.custom_lists(user_id,id,name) values(uid,lid,trim(local_list->>'name'));
    end if;
    if jsonb_typeof(local_list->'items') is distinct from 'array' then raise exception 'Invalid list items'; end if;
    n := 0;
    for entry in select value from jsonb_array_elements(local_list->'items') loop
      insert into public.custom_list_items(user_id,list_id,media_type,tmdb_id,payload,created_at) values(uid,lid,entry->>'type',(entry->>'id')::bigint,entry,now() - n * interval '1 millisecond') on conflict do nothing;
      n := n + 1;
    end loop;
  end loop;
  for key, record in select * from jsonb_each(p_data->'cinevra_personal') loop
    if key !~ '^(movie|tv):[1-9][0-9]*$' then raise exception 'Invalid title identity'; end if;
    kind := split_part(key, ':', 1); mid := split_part(key, ':', 2)::bigint;
    if coalesce(record->>'rating','') <> '' or coalesce(record->>'watchedOn','') <> '' or coalesce(record->>'note','') <> '' then
      insert into public.personal_reviews(user_id,media_type,tmdb_id,rating,watched_on,note,item) values(uid,kind,mid,nullif(record->>'rating','')::smallint,nullif(record->>'watchedOn','')::date,coalesce(record->>'note',''),nullif(record->'item','null'::jsonb)) on conflict do nothing;
    end if;
    if record ? 'episodes' then
      if jsonb_typeof(record->'episodes') <> 'array' then raise exception 'Invalid episodes'; end if;
      for ep in select jsonb_array_elements_text(record->'episodes') loop
        if ep !~ '^[1-9][0-9]*:[1-9][0-9]*$' then raise exception 'Invalid episode'; end if;
        insert into public.watched_episodes(user_id,media_type,tmdb_id,season_number,episode_number) values(uid,kind,mid,split_part(ep,':',1)::integer,split_part(ep,':',2)::integer) on conflict do nothing;
      end loop;
    end if;
  end loop;
  if (select count(*) from public.custom_lists where user_id = uid) > 20 then raise exception 'List limit reached'; end if;
end;
$$;
revoke all on function public.library_apply(jsonb), public.library_import(jsonb) from public, anon;
grant execute on function public.library_apply(jsonb), public.library_import(jsonb) to authenticated;
commit;
