const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const storage = new Map();
const context = vm.createContext({
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  document: { addEventListener() {} }, Date, console,
});
vm.runInContext(fs.readFileSync('js/library.js', 'utf8'), context);
const run = code => vm.runInContext(code, context);
run(`globalThis.sample = { app: 'cinevra', version: 1, data: {
  watchlist: [{id: 1, type: 'movie', title: '<img onerror=alert(1)>', posterPath: null, rating: 7, year: '2020', watched: true}],
  lists: [{id: 'l1', name: 'Favorites', items: [{id: 1, type: 'movie', title: 'One', watched: true}, {id: 2, type: 'tv', title: 'Two'}]}],
  personal: {'movie:1': {rating: 9, watchedOn: '2026-10-08', note: '<script>hello</script>', episodes: []}, 'movie:3': {rating: 7, watchedOn: '2026-09-01'}, 'tv:2': {episodes: ['1:1', '1:2', '1:2']}}
}}; restoreLibrary(validateLibraryBackup(sample));`);
assert.equal(run('createLibraryBackup().data.personal["movie:1"].note'), '<script>hello</script>');
assert.equal(run('createLibraryBackup().data.watchlist[0].title'), '<img onerror=alert(1)>');
assert.equal(run('createLibraryBackup().data.personal["tv:2"].episodes.length'), 2);
const stats = run("calculateLibraryStats(readLibrary(), new Date('2026-10-09'))");
assert.equal(stats.movies, 2);
assert.equal(stats.average, 8);
assert.equal(stats.episodes, 2);
assert.equal(stats.months.at(-1).count, 1);
assert.equal(stats.months.at(-2).count, 1);
assert.equal(run('getRecommendationSeeds(readLibrary())[0].id'), 1);
assert.equal(run('getRecommendationSeeds(readLibrary()).length'), 2);
assert.throws(() => run('validateLibraryBackup({...sample, version: 99})'));
assert.throws(() => run("validateLibraryBackup({...sample, data: {...sample.data, personal: {'__proto__': {}, 'movie:4': {rating: 11}}}})"));
assert.throws(() => run("validateLibraryBackup({...sample, data: {...sample.data, personal: {'movie:4': {watchedOn: '2026-02-30'}}}})"));
assert.throws(() => run("validateLibraryBackup({...sample, data: {...sample.data, watchlist: [{id: 1, type: 'movie', title: 'Bad', posterPath: '//evil.test/p.jpg'}]}})"));
const before = new Map(storage);
let writes = 0;
context.localStorage.setItem = (key, value) => { if (++writes === 2) throw Error('quota'); storage.set(key, value); };
assert.throws(() => run("restoreLibrary(validateLibraryBackup({...sample, data: {...sample.data, watchlist: []}}))"));
assert.deepEqual(storage, before);
context.localStorage.setItem = (key, value) => storage.set(key, value);
storage.set('cinevra_personal', '{broken');
assert.throws(() => run('createLibraryBackup()'));
for (const file of ['css/my-space.css', 'css/style.css']) {
  const css = fs.readFileSync(file, 'utf8');
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, file);
}
const navs = fs.readdirSync('.').filter(file => file.endsWith('.html')).map(file => {
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes('data-page="my-space.html"'), `Missing My Space link in ${file}`);
  return html.match(/<nav class="navbar__links"[\s\S]*?<\/nav>/)[0].replace(/\s+/g, ' ');
});
assert.equal(new Set(navs).size, 1, 'Navbar must match across pages');
console.log('Library backup, validation, rollback, stats and seed tests passed');
