const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calls = [];
const context = vm.createContext({
  window: { CINEVRA_CONFIG: { TMDB_API_KEY: 'test' } }, URL, console,
  sessionStorage: { getItem() { return null; }, setItem() {} },
  fetch: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return { ok: true, json: async () => ({ results: [] }) };
  },
});
vm.runInContext(fs.readFileSync('js/api.js', 'utf8'), context);
(async () => {
  await vm.runInContext("fetchMoviesByFilter({providerId: '8', watchRegion: 'ID', genreId: '18', page: 2})", context);
  let params = calls.at(-1).url.searchParams;
  assert.equal(params.get('watch_region'), 'ID');
  assert.equal(params.get('with_watch_providers'), '8');
  assert.equal(params.get('with_genres'), '18');
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('with_watch_monetization_types'), 'flatrate|free|ads');
  await vm.runInContext("fetchTVByFilter({watchRegion: 'US', year: '2020', sortBy: 'vote_average.desc'})", context);
  params = calls.at(-1).url.searchParams;
  assert.equal(params.get('watch_region'), 'US');
  assert.equal(params.get('first_air_date_year'), '2020');
  assert.equal(params.get('vote_count.gte'), '100');
  await vm.runInContext("fetchMoviesByFilter()", context);
  assert.equal(calls.at(-1).url.searchParams.has('with_watch_monetization_types'), false);
  await vm.runInContext("fetchStreamingProviders('tv', 'ID')", context);
  assert.equal(calls.at(-1).url.pathname, '/3/watch/providers/tv');
  await vm.runInContext("fetchTVSeason(10, 2)", context);
  assert.equal(calls.at(-1).url.pathname, '/3/tv/10/season/2');
  console.log('Streaming filter tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
