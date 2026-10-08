const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// DOM kecil untuk menguji alur interaksi tanpa dependency tambahan.
class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.handlers = {}; this.value = ''; this.textContent = ''; this.disabled = false; }
  add(option) { this.children.push(option); if (!this.value) this.value = option.value; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  querySelectorAll(tag) { return this.children.flatMap(node => [ ...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag) ]); }
  async trigger(name) { return this.handlers[name]?.({ preventDefault() {} }); }
}
const nodes = new Map();
const storage = new Map();
let failStorage = false;
const element = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
const context = vm.createContext({
  document: { getElementById: element, createElement: tag => new Element(tag) },
  Option: function(text, value) { const node = new Element('option'); node.textContent = text; node.value = String(value); return node; },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (failStorage) throw Error('quota'); storage.set(key, value); } },
  fetchTVSeason: async (id, season) => ({ episodes: [1, 2].map(number => ({ episode_number: number, name: `<b>Season ${season} episode ${number}</b>` })) }),
});
vm.runInContext(fs.readFileSync('js/personal.js', 'utf8'), context);
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  vm.runInContext("initPersonalDetails({id: 10, type: 'tv'}, {seasons: [{season_number: 0, episode_count: 3}, {season_number: 1, episode_count: 2}, {season_number: 2, episode_count: 2}]})", context);
  await flush();
  assert.equal(element('episodeSeason').children.length, 2);
  const first = element('episodeList').querySelectorAll('input')[0];
  first.checked = true;
  await first.trigger('change');
  assert.equal(element('episodeProgress').value, 1);
  assert.equal(element('episodeProgress').max, 4);
  element('personalRating').value = '9';
  element('personalNote').value = '<script>alert(1)</script>';
  element('personalDate').value = '2026-10-08';
  await element('personalForm').trigger('submit');
  assert.equal(JSON.parse(storage.get('cinevra_personal'))['tv:10'].episodes.length, 1);
  await element('episodeSeasonToggle').trigger('click');
  assert.equal(element('episodeProgress').value, 2);
  element('episodeSeason').value = '2';
  await element('episodeSeason').trigger('change');
  await element('episodeSeasonToggle').trigger('click');
  assert.equal(element('episodeProgress').value, 4);
  await element('episodeSeasonToggle').trigger('click');
  assert.equal(element('episodeProgress').value, 2);
  await element('personalClear').trigger('click');
  assert.equal(element('personalNote').value, '');
  assert.equal(element('episodeProgress').value, 2);
  failStorage = true;
  await element('episodeSeasonToggle').trigger('click');
  assert.equal(element('episodeProgress').value, 2);
  assert.match(element('episodeStatus').textContent, /Could not save/);
  failStorage = false;
  nodes.clear();
  vm.runInContext("initPersonalDetails({id: 10, type: 'tv'}, {seasons: [{season_number: 1, episode_count: 2}, {season_number: 2, episode_count: 2}]})", context);
  await flush();
  assert.equal(element('episodeProgress').value, 2);
  assert.ok(element('episodeList').querySelectorAll('input').every(input => input.checked));
  context.fetchTVSeason = async () => { throw Error('network'); };
  await element('episodeRetry').trigger('click');
  assert.match(element('episodeStatus').textContent, /Could not load/);
  assert.equal(element('episodeSeasonToggle').disabled, true);
  console.log('Personal UI interaction tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
