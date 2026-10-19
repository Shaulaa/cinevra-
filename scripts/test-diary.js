const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const values = new Map();
const context = vm.createContext({
  localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
  document: { addEventListener() {} }, console,
});
const run = code => JSON.parse(JSON.stringify(vm.runInContext(code, context)));
vm.runInContext(fs.readFileSync('js/personal.js', 'utf8'), context);

values.set('cinevra_personal', JSON.stringify({
  'movie:1': { rating: 9, watchedOn: '2024-02-29', note: '<img onerror=alert(1)>', item: { title: '<b>Arrival</b>', posterPath: '/arrival.jpg', year: '2016' } },
  'tv:1': { rating: 8, watchedOn: '2026-10-19', note: 'A thoughtful finale', episodes: ['1:1'] },
  'movie:2': { rating: '', watchedOn: '', note: 'Still worth remembering' },
  'movie:3': { rating: '', watchedOn: '', note: '', episodes: [] },
  'tv:4': { episodes: ['1:1'] },
  'movie:5': { rating: 6, watchedOn: '2025-02-29' },
  'movie:6': { rating: 99, watchedOn: 'bad date' },
  'movie:7': { note: 'x'.repeat(1200), item: { title: 'Unsafe poster', posterPath: 'https://bad.test/x.jpg' } },
  'movie:0': { rating: 5 },
  'person:8': { note: 'Ignore this key' },
  'movie:9': null,
}));
const before = values.get('cinevra_personal');
let entries = run('getDiaryEntries()');
assert.equal(entries.length, 5);
assert.equal(entries.find(e => e.key === 'movie:1').note, '<img onerror=alert(1)>');
assert.equal(entries.find(e => e.key === 'movie:1').item.title, '<b>Arrival</b>');
assert.equal(entries.find(e => e.key === 'movie:5').watchedOn, '');
assert.equal(entries.find(e => e.key === 'movie:7').note.length, 1000);
assert.equal(entries.find(e => e.key === 'movie:7').item.posterPath, null);
assert.equal(values.get('cinevra_personal'), before, 'Reading the diary must not rewrite stored records');
vm.runInContext("savePersonalRecord('movie', 1, { note: 'Edited' })", context);
assert.equal(run("getPersonalRecord('movie', 1)").item.title, '<b>Arrival</b>');
vm.runInContext("savePersonalRecord('tv', 1, { rating: 10, item: { title: 'A series', posterPath: null, year: '2020' } })", context);
assert.deepEqual(run("getPersonalRecord('tv', 1)").episodes, ['1:1']);

vm.runInContext(fs.readFileSync('js/diary.js', 'utf8'), context);
assert.deepEqual(run("filterDiaryEntries(getDiaryEntries(), {query: 'edited', type: 'movie', year: '', order: 'newest'}).map(e => e.key)"), ['movie:1']);
assert.deepEqual(run("filterDiaryEntries(getDiaryEntries(), {query: '', type: 'all', year: '2026', order: 'newest'}).map(e => e.key)"), ['tv:1']);
assert.deepEqual(run("filterDiaryEntries(getDiaryEntries(), {query: 'not found', type: 'all', year: '', order: 'newest'})"), []);
entries = run("filterDiaryEntries(getDiaryEntries(), {query: '', type: 'all', year: '', order: 'newest'})");
assert.deepEqual(entries.slice(0, 2).map(e => e.key), ['tv:1', 'movie:1']);
entries = run("filterDiaryEntries(getDiaryEntries(), {query: '', type: 'all', year: '', order: 'oldest'})");
assert.deepEqual(entries.slice(0, 2).map(e => e.key), ['movie:1', 'tv:1']);
assert.ok(entries.slice(2).every(e => e.watchedOn === ''));
values.set('cinevra_personal', '{broken');
assert.throws(() => run('getDiaryEntries()'));
values.set('cinevra_personal', '[]');
assert.throws(() => run('getDiaryEntries()'));
values.delete('cinevra_personal');
assert.deepEqual(run('getDiaryEntries()'), []);
context.localStorage.getItem = () => { throw Error('storage blocked'); };
assert.throws(() => run('getDiaryEntries()'));
console.log('Diary storage, compatibility, date, search and sorting tests passed');
