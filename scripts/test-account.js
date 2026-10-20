const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() { this.value = ''; this.hidden = false; this.disabled = false; this.children = []; this.handlers = {}; this.dataset = {}; this.attributes = {}; this.textContent = ''; }
  addEventListener(name, callback) { this.handlers[name] = callback; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  append(...children) { this.children.push(...children); }
  querySelectorAll() { return []; }
  checkValidity() { return this.value.includes('@'); }
  reportValidity() {}
  async trigger(name) { return this.handlers[name]?.({ preventDefault() {} }); }
}
async function setup(search = '', user = null, recovery = false, script = 'js/account.js') {
  const nodes = new Map(), calls = [], session = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, new Element()); return nodes.get(key); };
  if (recovery) session.set('cinevra_recovery_for', user.id);
  let init;
  const auth = Object.fromEntries(['signUp', 'resetPasswordForEmail', 'updateUser', 'signInWithPassword', 'signInWithOAuth', 'resend', 'signOut', 'exchangeCodeForSession'].map(name => [name, async (args, options) => { calls.push({ name, args, options }); return { data: { session: { user: user || { id: 'test-user' } } }, error: null }; }]));
  const context = vm.createContext({
    URL, URLSearchParams, console,
    document: { addEventListener: (event, callback) => { init = callback; }, getElementById: node, querySelector: node, createElement: () => new Element() },
    location: { search, href: 'http://localhost:5500/account.html' + search, pathname: script.includes('callback') ? '/auth-callback.html' : '/account.html', replace: value => calls.push({ name: 'redirect', value }) },
    history: { replaceState: (...args) => calls.push({ name: 'clear-url', args }) },
    sessionStorage: { getItem: key => session.get(key), setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
    CinevraCloud: { ready: Promise.resolve(), client: { auth }, state: () => ({ user, phase: 'ready' }), guest: () => ({ cinevra_watchlist: [], cinevra_lists: [], cinevra_personal: {} }) },
  });
  vm.runInContext(fs.readFileSync(script, 'utf8'), context); await init();
  return { node, calls, session, context };
}
(async () => {
  let test = await setup();
  test.node('accountEmail').value = 'example@example.test'; test.node('accountPassword').value = 'a-dummy-password';
  await test.node('accountForm').trigger('submit');
  assert.equal(test.calls[0].name, 'signInWithPassword');
  assert.equal(test.node('accountPassword').value, '');
  test = await setup('?mode=signup');
  await test.node('accountForm').trigger('submit');
  assert.equal(test.calls[0].name, 'signUp');
  assert.equal(test.calls[0].args.options.emailRedirectTo, 'http://localhost:5500/auth-callback.html');
  await test.node('googleSignIn').trigger('click');
  assert.equal(test.calls.at(-1).args.provider, 'google');
  test = await setup('?mode=forgot'); await test.node('accountForm').trigger('submit');
  assert.equal(test.calls[0].name, 'resetPasswordForEmail');
  assert.equal(test.calls[0].options.redirectTo, 'http://localhost:5500/auth-callback.html?flow=recovery');
  test = await setup('?mode=reset'); await test.node('accountForm').trigger('submit');
  assert.equal(test.calls.length, 0, 'An unverified recovery page must not update a password');
  test = await setup('?mode=reset', { id: 'test-user' }, true);
  await test.node('accountForm').trigger('submit');
  assert.equal(test.calls[0].name, 'updateUser');
  assert.equal(test.session.has('cinevra_recovery_for'), false);
  test = await setup('?code=one-use-code&flow=recovery', null, false, 'js/auth-callback.js');
  assert.equal(test.calls[0].name, 'clear-url');
  assert.equal(test.calls[1].name, 'exchangeCodeForSession');
  assert.equal(test.calls.at(-1).value, 'account.html?mode=reset');
  test = await setup('?error=access_denied', null, false, 'js/auth-callback.js');
  assert.equal(test.calls.filter(call => call.name === 'exchangeCodeForSession').length, 0);
  assert.equal(test.node('callbackRetry').hidden, false);
  console.log('Email, Google, signup, recovery and PKCE callback contract tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
