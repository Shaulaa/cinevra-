const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function element() {
  const classes = new Set(), handlers = {}, attributes = {};
  return {
    handlers, attributes,
    classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name), toggle(name, force) { const next = force ?? !classes.has(name); if (next) classes.add(name); else classes.delete(name); return next; } },
    addEventListener: (name, callback) => { handlers[name] = callback; },
    setAttribute: (name, value) => { attributes[name] = value; },
    querySelectorAll: () => [link],
    focus() { this.focused = true; },
  };
}
const link = element(), toggle = element(), menu = element(), backdrop = element(), search = element();
const documentEvents = {};
const context = vm.createContext({ document: {
  getElementById: id => ({ navToggle: toggle, navBackdrop: backdrop })[id],
  querySelector: selector => ({ '.navbar__links': menu, '.navbar__search': search })[selector],
  addEventListener: (name, callback) => { documentEvents[name] = callback; },
} });
const source = fs.readFileSync('js/main.js', 'utf8');
vm.runInContext(source.slice(source.indexOf('function initNavbarToggle()'), source.indexOf('function initMobileSearchToggle()')), context);
context.initNavbarToggle();
search.classList.add('is-mobile-open');
toggle.handlers.click();
assert.equal(menu.classList.contains('is-open'), true);
assert.equal(search.classList.contains('is-mobile-open'), false);
assert.equal(toggle.attributes['aria-label'], 'Close menu');
assert.equal(toggle.attributes['aria-expanded'], 'true');
assert.equal(backdrop.classList.contains('is-open'), true);
documentEvents.keydown({ key: 'Escape' });
assert.equal(menu.classList.contains('is-open'), false);
assert.equal(toggle.attributes['aria-label'], 'Open menu');
assert.equal(toggle.focused, true);
toggle.handlers.click(); link.handlers.click();
assert.equal(menu.classList.contains('is-open'), false);
toggle.handlers.click(); backdrop.handlers.click();
assert.equal(backdrop.classList.contains('is-open'), false);
console.log('Mobile menu toggle, accessible labels, Escape, focus, link and backdrop tests passed');
