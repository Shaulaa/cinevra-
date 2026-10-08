const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const values = new Map();
const context = vm.createContext({
  localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
  document: { addEventListener() {} }, console,
});
vm.runInContext(fs.readFileSync('js/personal.js', 'utf8'), context);
vm.runInContext(`
  savePersonalRecord('movie', 10, { rating: 8, watchedOn: '2026-10-08', note: '<img onerror=alert(1)>' });
  savePersonalRecord('tv', 10, { episodes: ['1:1', '1:2'] });
`, context);
assert.equal(vm.runInContext("getPersonalRecord('movie', 10).rating", context), 8);
assert.equal(vm.runInContext("getPersonalRecord('movie', 10).note", context), '<img onerror=alert(1)>');
assert.equal(vm.runInContext("getPersonalRecord('tv', 10).episodes.length", context), 2);
vm.runInContext("savePersonalRecord('tv', 10, { note: 'Good' })", context);
assert.equal(vm.runInContext("getPersonalRecord('tv', 10).episodes.length", context), 2);
values.set('cinevra_personal', '{broken');
assert.equal(vm.runInContext("getPersonalRecord('tv', 10).episodes.length", context), 0);
context.localStorage.setItem = () => { throw new Error('Quota'); };
assert.throws(() => vm.runInContext("savePersonalRecord('tv', 10, { rating: 7 })", context));
console.log('Personal storage tests passed');
