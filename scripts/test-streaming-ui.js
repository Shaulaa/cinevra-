const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Select {
  constructor() { this.options = []; this.value = ''; this.handlers = {}; }
  add(option) { this.options.push(option); }
  replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  trigger(name) { this.handlers[name](); }
}
const country = new Select();
const platform = new Select();
const hint = {};
const state = { watchRegion: 'ID', providerId: '8', searchQuery: '', list: '' };
const pending = [];
let changes = 0;
const context = vm.createContext({
  document: { addEventListener() {}, getElementById: id => ({ streamingCountry: country, streamingPlatform: platform, streamingHint: hint })[id] },
  Option: function(text, value) { return { text, value: String(value) }; },
  fetchStreamingRegions: async () => ({ results: [{ iso_3166_1: 'ID', english_name: 'Indonesia' }, { iso_3166_1: 'US', english_name: 'United States' }] }),
  fetchStreamingProviders: (type, region) => new Promise(resolve => pending.push({ type, region, resolve })),
  state, changed: () => { changes++; },
});
vm.runInContext(fs.readFileSync('js/main.js', 'utf8'), context);
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const sync = vm.runInContext("initStreamingFilters({type: 'movie', state, onChange: changed})", context);
  await flush();
  assert.equal(country.value, 'ID');
  assert.equal(platform.disabled, true);
  pending.shift().resolve({ results: [{ provider_id: 8, provider_name: 'Netflix' }] });
  await flush();
  assert.equal(platform.value, '8');
  assert.equal(platform.disabled, false);
  state.list = 'trending';
  country.value = 'US';
  country.trigger('change');
  assert.equal(state.providerId, '');
  assert.equal(state.list, '');
  country.value = 'ID';
  country.trigger('change');
  const old = pending.shift();
  const current = pending.shift();
  current.resolve({ results: [{ provider_id: 9, provider_name: 'Current provider' }] });
  await flush();
  old.resolve({ results: [{ provider_id: 99, provider_name: 'Stale provider' }] });
  await flush();
  assert.deepEqual(platform.options.map(option => option.value), ['', '9']);
  platform.value = '9';
  platform.trigger('change');
  assert.equal(state.providerId, '9');
  assert.equal(changes, 3);
  state.searchQuery = 'Dune';
  sync();
  assert.equal(country.disabled, true);
  assert.equal(platform.disabled, true);
  assert.match(hint.textContent, /Clear the title search/);
  state.searchQuery = '';
  country.value = '';
  country.trigger('change');
  assert.equal(state.watchRegion, '');
  assert.equal(platform.disabled, true);
  console.log('Streaming UI interaction tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
