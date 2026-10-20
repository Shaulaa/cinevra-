begin;
-- Nonaktifkan akses tanpa menghapus postingan atau mengubah koleksi pribadi.
revoke execute on function public.community_feed(text,boolean,timestamptz,uuid,integer),
  public.community_publish(text,text,text,text,text,integer,jsonb,boolean),
  public.community_set_like(uuid,boolean), public.community_unpublish(uuid),
  public.community_report(uuid,text) from anon, authenticated;
commit;
