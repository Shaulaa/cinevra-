const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.handlers = {}; this.value = ''; this.hidden = false; this.className = ''; this.attributes = {}; this.textContent = ''; }
  set innerHTML(value) { throw Error('Diary must render external data with textContent'); }
  append(...nodes) { this.children.push(...nodes); }
  add(node) { this.append(node); }
  replaceChildren(...nodes) { this.children = nodes; if (this.tag === 'select') this.value = nodes[0]?.value || ''; }
  get options() { return this.children; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  trigger(name) { return this.handlers[name]?.(); }
  querySelectorAll(selector) {
    const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    if (selector === '*') return descendants;
    if (selector === '.diary-entry__title a') return descendants.filter(child => child.className === 'diary-entry__title').flatMap(child => child.children);
    return descendants.filter(child => child.className.split(' ').includes(selector.slice(1)));
  }
}
const nodes = new Map();
const storage = new Map();
const events = {};
const node = id => {
  if (!nodes.has(id)) nodes.set(id, new Element(['diaryYear', 'diaryType', 'diaryOrder'].includes(id) ? 'select' : 'div'));
  return nodes.get(id);
};
node('diaryType').value = 'all';
node('diaryOrder').value = 'newest';
let failNetwork = true;
let active = 0;
let maxActive = 0;
const fetchTitle = async id => {
  active++;
  maxActive = Math.max(maxActive, active);
  await new Promise(resolve => setImmediate(resolve));
  active--;
  if (failNetwork) throw Error('offline');
  return { title: `Recovered title ${id}`, name: `Recovered series ${id}`, poster_path: '/poster.jpg', release_date: '2020-01-01', first_air_date: '2021-01-01' };
};
const context = vm.createContext({
  document: { addEventListener() {}, getElementById: node, createElement: tag => new Element(tag), createElementNS: (namespace, tag) => new Element(tag) },
  window: { addEventListener: (name, handler) => { events[name] = handler; } },
  Option: function(text, value) { const option = new Element('option'); option.textContent = text; option.value = value; return option; },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  fetchMovieDetails: fetchTitle, fetchTVDetails: fetchTitle,
  getImageUrl: path => `https://image.tmdb.org/t/p/w342${path}`,
  console,
});
for (const file of ['js/personal.js', 'js/diary.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const rows = () => node('diaryTimeline').querySelectorAll('.diary-entry');
const text = element => [element.textContent, ...element.children.map(text)].join(' ');
const records = {
  'movie:1': { rating: 9, watchedOn: '2026-10-19', note: '<img onerror=alert(1)>', item: { title: '<b>Arrival</b>', posterPath: '/arrival.jpg', year: '2016' } },
  'tv:2': { rating: 7, watchedOn: '2026-09-09', note: 'A finale worth discussing', item: { title: 'A series', posterPath: null, year: '2020' }, episodes: ['1:1'] },
  'movie:3': { rating: 8, watchedOn: '', note: 'An older record' },
  'tv:4': { episodes: ['1:1'] },
};
storage.set('cinevra_personal', JSON.stringify(records));
storage.set('cinevra_watchlist', '{}');
storage.set('cinevra_recently_viewed', '{broken');

(async () => {
  const snapshot = storage.get('cinevra_personal');
  vm.runInContext('initDiary()', context);
  await flush();
  assert.equal(rows().length, 3);
  assert.match(text(rows()[0]), /<b>Arrival<\/b>/);
  assert.match(text(rows()[0]), /<img onerror=alert\(1\)>/);
  assert.match(text(rows()[2]), /Movie #3/);
  assert.match(text(node('diaryTimeline')), /No watch date/);
  assert.match(node('diaryStatus').textContent, /Some titles could not/);
  assert.equal(node('diaryRetry').hidden, false);
  assert.equal(storage.get('cinevra_personal'), snapshot);

  failNetwork = false;
  await node('diaryRetry').trigger('click');
  assert.match(text(rows()[2]), /Recovered title 3/);
  assert.equal(node('diaryRetry').hidden, true);
  assert.equal(storage.get('cinevra_personal'), snapshot);
  node('diarySearch').value = 'finale';
  node('diarySearch').trigger('input');
  assert.equal(rows().length, 1);
  assert.match(text(rows()[0]), /A series/);
  node('diarySearch').value = 'not found';
  node('diarySearch').trigger('input');
  assert.equal(node('diaryEmpty').hidden, false);
  assert.equal(node('diaryBrowse').hidden, true);
  node('diaryReset').trigger('click');
  assert.equal(rows().length, 3);
  node('diaryType').value = 'tv';
  node('diaryType').trigger('change');
  assert.equal(rows().length, 1);
  node('diaryReset').trigger('click');

  storage.set('cinevra_personal', '{broken');
  events.storage({ key: 'cinevra_personal' });
  await flush();
  assert.equal(rows().length, 0);
  assert.match(node('diaryStatus').textContent, /could not be read/);
  assert.equal(node('diaryEmpty').hidden, true);
  storage.set('cinevra_personal', '{}');
  await node('diaryRetry').trigger('click');
  assert.equal(node('diaryEmpty').hidden, false);
  assert.equal(node('diaryBrowse').hidden, false);
  assert.equal(node('diaryRetry').hidden, true);

  const many = Object.fromEntries(Array.from({ length: 35 }, (_, index) => [`movie:${index + 10}`, { rating: 8, watchedOn: '2026-10-19', item: { title: `Film ${index}`, posterPath: null } }]));
  storage.set('cinevra_personal', JSON.stringify(many));
  events.storage({ key: 'cinevra_personal' });
  await flush();
  assert.equal(rows().length, 30);
  assert.equal(node('diaryMore').hidden, false);
  node('diaryMore').trigger('click');
  assert.equal(rows().length, 35);
  assert.equal(node('diaryMore').hidden, true);
  assert.equal(node('diaryTimeline').querySelectorAll('.diary-entry__title a')[30].focused, true);

  const legacy = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`tv:${index + 100}`, { rating: 8 }]));
  storage.set('cinevra_personal', JSON.stringify(legacy));
  events.storage({ key: 'cinevra_personal' });
  await flush();
  assert.equal(rows().length, 9);
  assert.ok(maxActive <= 4);
  assert.equal(node('diaryStatus').textContent, '');
  console.log('Diary rendering, XSS, retry, filters, empty/error states, pagination and concurrency tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
