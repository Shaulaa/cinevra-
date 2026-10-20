const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const db = new PGlite();
const item = id => ({ id, type: 'movie', title: `Title ${id}`, posterPath: null, year: '2020', rating: 8 });
const upsert = (table, row) => ({ table, op: 'upsert', row });
async function as(user, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user || '']);
  await db.exec(`set role ${role}`);
}
const apply = ops => db.query('select public.library_apply($1::jsonb)', [JSON.stringify(ops)]);
const importGuest = data => db.query('select public.library_import($1::jsonb)', [JSON.stringify(data)]);
const count = async table => Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);
(async () => {
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values('${a}'),('${b}');
      alter default privileges in schema public grant all on tables to authenticated, anon;`);
    await db.exec(fs.readFileSync('supabase/migrations/202610190001_library.sql', 'utf8'));
    await as(a);
    await apply([
      upsert('watchlist_items', { media_type: 'movie', tmdb_id: 1, payload: item(1) }),
      upsert('custom_lists', { id: 'local-list', name: 'Favourites' }),
      upsert('custom_list_items', { list_id: 'local-list', media_type: 'movie', tmdb_id: 1, payload: item(1) }),
      upsert('personal_reviews', { media_type: 'movie', tmdb_id: 1, rating: 9, watched_on: '2026-10-19', note: 'Cloud review', item: { title: 'Cloud title' } }),
      upsert('watched_episodes', { media_type: 'tv', tmdb_id: 2, season_number: 1, episode_number: 1 }),
    ]);
    assert.equal(await count('watchlist_items'), 1);
    await as(b);
    await assert.rejects(db.query('truncate public.watchlist_items'), 'Authenticated users must not inherit TRUNCATE from project defaults');
    for (const table of ['watchlist_items', 'custom_lists', 'custom_list_items', 'personal_reviews', 'watched_episodes']) assert.equal(await count(table), 0, `${table} leaked another account`);
    await assert.rejects(db.query('insert into public.watchlist_items(user_id,media_type,tmdb_id,payload) values($1,\'movie\',10,$2::jsonb)', [a, JSON.stringify(item(10))]));
    await assert.rejects(apply([upsert('custom_list_items', { list_id: 'local-list', media_type: 'movie', tmdb_id: 1, payload: item(1) })]));
    assert.equal((await db.query('update public.personal_reviews set note=\'stolen\' where user_id=$1', [a])).affectedRows, 0);
    await apply([upsert('watchlist_items', { media_type: 'movie', tmdb_id: 1, payload: { ...item(1), title: 'Account B' } })]);
    assert.equal(await count('watchlist_items'), 1);
    await as(a);
    await assert.rejects(db.query('update public.watchlist_items set user_id=$1', [b]));
    await assert.rejects(apply([
      upsert('watchlist_items', { media_type: 'movie', tmdb_id: 99, payload: item(99) }),
      upsert('personal_reviews', { media_type: 'movie', tmdb_id: 99, rating: 11, note: '' }),
    ]));
    assert.equal(await count('watchlist_items'), 1, 'Invalid operation must roll back the whole transaction');
    const guest = {
      cinevra_watchlist: [item(1), item(3)],
      cinevra_lists: [{ id: 'different-local-id', name: 'favourites', items: [item(1), item(3)] }],
      cinevra_personal: {
        'movie:1': { rating: 1, note: 'Guest must not overwrite cloud' },
        'movie:3': { rating: 7, watchedOn: '2026-09-08', note: '<b>Plain text</b>' },
        'tv:2': { episodes: ['1:1', '1:2'] },
      },
    };
    await importGuest(guest); await importGuest(guest);
    assert.equal(await count('watchlist_items'), 2);
    assert.equal(await count('custom_lists'), 1);
    assert.equal(await count('custom_list_items'), 2);
    assert.equal(await count('watched_episodes'), 2);
    assert.equal((await db.query('select rating,note from public.personal_reviews where tmdb_id=1')).rows[0].rating, 9);
    assert.equal((await db.query('select name from public.custom_lists')).rows[0].name, 'Favourites');
    const invalid = { ...guest, cinevra_watchlist: [item(100)], cinevra_personal: { 'tv:2': { episodes: ['1:3', 'broken'] } } };
    await assert.rejects(importGuest(invalid));
    assert.equal(await count('watchlist_items'), 2, 'Import must be atomic');
    assert.equal(await count('watched_episodes'), 2);
    await as(null, 'anon');
    await assert.rejects(db.query('select * from public.personal_reviews'));
    await assert.rejects(apply([]));
    await assert.rejects(importGuest(guest));
    console.log('PostgreSQL migration, two-account RLS, ownership, RPC atomicity and repeated import tests passed');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
