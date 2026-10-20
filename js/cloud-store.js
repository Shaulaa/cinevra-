/* Koleksi akun hanya ada di memori halaman, koleksi tamu tetap di browser. */
(function (root) {
  const keys = ['cinevra_watchlist', 'cinevra_lists', 'cinevra_personal'];
  const empty = () => ({ cinevra_watchlist: [], cinevra_lists: [], cinevra_personal: {} });
  const copy = value => JSON.parse(JSON.stringify(value));
  const itemKey = item => `${item.type}:${item.id}`;
  function failure(message) { const error = new Error(message); error.cinevra = true; return error; }
  function flatten(data) {
    const rows = new Map();
    const add = (table, key, row) => rows.set(`${table}:${key}`, { table, row });
    for (const item of data.cinevra_watchlist) add('watchlist_items', itemKey(item), { media_type: item.type, tmdb_id: item.id, payload: item });
    for (const list of data.cinevra_lists) {
      add('custom_lists', list.id, { id: list.id, name: list.name });
      for (const item of list.items) add('custom_list_items', `${list.id}:${itemKey(item)}`, { list_id: list.id, media_type: item.type, tmdb_id: item.id, payload: item });
    }
    for (const [key, record] of Object.entries(data.cinevra_personal)) {
      const match = /^(movie|tv):([1-9]\d*)$/.exec(key);
      if (!match) throw failure('Invalid personal record');
      const identity = { media_type: match[1], tmdb_id: Number(match[2]) };
      if (record.rating || record.watchedOn || record.note) add('personal_reviews', key, { ...identity, rating: record.rating || null, watched_on: record.watchedOn || null, note: record.note || '', item: record.item || null });
      for (const episode of record.episodes || []) {
        const parts = /^(\d+):(\d+)$/.exec(episode);
        if (!parts) throw failure('Invalid episode');
        add('watched_episodes', `${key}:${episode}`, { ...identity, season_number: Number(parts[1]), episode_number: Number(parts[2]) });
      }
    }
    return rows;
  }
  function changes(before, after) {
    const old = flatten(before), next = flatten(after), result = [];
    for (const [key, value] of next) if (JSON.stringify(old.get(key)?.row) !== JSON.stringify(value.row)) result.push({ ...value, op: 'upsert' });
    for (const [key, value] of old) if (!next.has(key)) result.push({ ...value, op: 'delete' });
    return result;
  }
  function validateGuest(data) {
    if (!data || !Array.isArray(data.cinevra_watchlist) || !Array.isArray(data.cinevra_lists) || !data.cinevra_personal || Array.isArray(data.cinevra_personal) || typeof data.cinevra_personal !== 'object') throw failure('Guest collection is damaged. No data has been changed.');
    if (JSON.stringify(data).length > 2000000) throw failure('Guest collection exceeds the 2 MB import limit.');
    const validItem = item => item && ['movie', 'tv'].includes(item.type) && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.title === 'string' && item.title.length <= 300;
    if (!data.cinevra_watchlist.every(validItem) || data.cinevra_lists.length > 20 || !data.cinevra_lists.every(list => list && typeof list.id === 'string' && typeof list.name === 'string' && list.name.trim().length > 0 && list.name.trim().length <= 40 && Array.isArray(list.items) && list.items.every(validItem))) throw failure('Guest collection contains invalid titles or lists.');
    for (const [key, record] of Object.entries(data.cinevra_personal)) {
      if (!/^(movie|tv):[1-9]\d*$/.test(key) || !Number.isSafeInteger(Number(key.split(':')[1])) || !record || typeof record !== 'object' || (record.rating !== '' && record.rating != null && (!Number.isInteger(record.rating) || record.rating < 1 || record.rating > 10)) || (record.note != null && (typeof record.note !== 'string' || record.note.length > 1000)) || (record.episodes != null && (!Array.isArray(record.episodes) || !record.episodes.every(value => typeof value === 'string' && /^\d+:\d+$/.test(value))))) throw failure('Guest reviews contain invalid data.');
      if (record.watchedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(record.watchedOn) || new Date(`${record.watchedOn}T00:00:00Z`).toISOString().slice(0, 10) !== record.watchedOn)) throw failure('Guest reviews contain an invalid watch date.');
    }
    return data;
  }
  function createStore({ storage, client, notify = () => {} }) {
    let cache = empty(), user = null, phase = client ? 'loading' : 'ready', epoch = 0, busy = false, refreshing = false;
    const state = () => ({ user, phase, busy, refreshing, configured: Boolean(client) });
    const emit = () => notify(state());
    async function hydrate(expected = epoch) {
      const tables = ['watchlist_items', 'custom_lists', 'custom_list_items', 'personal_reviews', 'watched_episodes'];
      const owner = user.id;
      const response = await Promise.all(tables.map(async table => {
        const records = [];
        const columns = table === 'custom_lists' ? ['id'] : ['media_type', 'tmdb_id'];
        if (table === 'custom_list_items') columns.push('list_id');
        if (table === 'watched_episodes') columns.push('season_number', 'episode_number');
        for (let offset = 0; ; offset += 500) {
          let query = client.from(table).select('*').eq('user_id', owner).order('created_at', { ascending: table === 'custom_lists' });
          for (const column of columns) query = query.order(column);
          const page = await query.range(offset, offset + 499);
          if (expected !== epoch) throw failure('The account changed. Please try again.');
          if (page.error) return page;
          records.push(...page.data);
          if (page.data.length < 500) return { data: records, error: null };
        }
      }));
      if (expected !== epoch) throw failure('The account changed. Please try again.');
      if (response.some(value => value.error)) throw failure('Your account library could not be loaded. Check your connection and retry.');
      const data = empty();
      data.cinevra_watchlist = response[0].data.map(row => row.payload);
      data.cinevra_lists = response[1].data.map(row => ({ id: row.id, name: row.name, items: response[2].data.filter(item => item.list_id === row.id).map(item => item.payload) }));
      for (const row of response[3].data) data.cinevra_personal[`${row.media_type}:${row.tmdb_id}`] = { rating: row.rating || '', watchedOn: row.watched_on ? String(row.watched_on).slice(0, 10) : '', note: row.note, item: row.item, episodes: [] };
      for (const row of response[4].data) {
        const key = `${row.media_type}:${row.tmdb_id}`;
        data.cinevra_personal[key] ||= { rating: '', watchedOn: '', note: '', item: null, episodes: [] };
        data.cinevra_personal[key].episodes.push(`${row.season_number}:${row.episode_number}`);
      }
      cache = data;
      phase = 'ready';
      emit();
    }
    async function setUser(next) {
      const current = ++epoch;
      cache = empty(); user = next; phase = next ? 'loading' : 'ready'; emit();
      if (next) {
        try { await hydrate(current); }
        catch (error) { if (current === epoch) { phase = 'error'; emit(); } throw error; }
      }
    }
    function guest() {
      try { return validateGuest(Object.fromEntries(keys.map(key => [key, JSON.parse(storage.getItem(key) || JSON.stringify(empty()[key]))]))); }
      catch (error) { throw failure(error.cinevra ? error.message : 'Guest collection could not be read. No data has been changed.'); }
    }
    return {
      state, setUser, guest,
      read(key) {
        if (phase === 'error') throw failure('Your account library is unavailable. Retry loading it first.');
        if (!keys.includes(key) || (!client || (!user && phase === 'ready'))) return storage.getItem(key);
        if (phase !== 'ready') throw failure('Your account library is not ready. Retry loading it first.');
        return JSON.stringify(cache[key]);
      },
      write(key, serialized) {
        if (phase === 'error') throw failure('Your account library is unavailable. Retry loading it first.');
        if (!keys.includes(key)) throw failure('Unknown collection');
        if (!client || (!user && phase === 'ready')) {
          try { storage.setItem(key, serialized); return; }
          catch { throw failure('Could not save. Browser storage is unavailable or full.'); }
        }
        return (async () => {
          if (phase !== 'ready' || !user) throw failure('Your account library is not ready.');
          if (busy) throw failure('Another change is being saved. Please wait.');
          const current = epoch;
          busy = true; emit();
          try {
            const next = copy(cache); next[key] = JSON.parse(serialized);
            const operations = changes(cache, next);
            if (operations.length) {
              const { error } = await client.rpc('library_apply', { p_changes: operations });
              if (error) throw failure('Could not save to your account. Check your connection and try again.');
            }
            if (current !== epoch) throw failure('The account changed before this operation completed.');
            cache = next;
          } finally { busy = false; emit(); }
        })();
      },
      async refresh() {
        if (!user || busy) return;
        const current = epoch;
        busy = true; refreshing = true; emit();
        try { await hydrate(current); }
        catch (error) { if (current === epoch) { phase = 'error'; emit(); } throw error; }
        finally { busy = false; refreshing = false; emit(); }
      },
      async importGuest() {
        if (!user || phase !== 'ready' || busy) throw failure('Sign in and load your account before importing.');
        const data = guest(), current = epoch;
        busy = true; emit();
        try {
          const { error } = await client.rpc('library_import', { p_data: data });
          if (error) throw failure('Import failed. Your guest collection has not been changed.');
          if (current !== epoch) throw failure('The account changed during import.');
          await hydrate(current);
        } finally { busy = false; emit(); }
      },
      fail() { ++epoch; cache = empty(); phase = 'error'; emit(); },
    };
  }
  root.CinevraStoreFactory = { createStore, changes, validateGuest };
  if (!root.document) return;
  const config = root.CINEVRA_CONFIG || {};
  let client = null, configError = false;
  if (config.SUPABASE_URL || config.SUPABASE_PUBLISHABLE_KEY) {
    try {
      const url = new URL(config.SUPABASE_URL);
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Invalid URL');
      if (!config.SUPABASE_PUBLISHABLE_KEY || config.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_')) throw Error('Invalid public key');
      if (config.SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
        const body = JSON.parse(atob(config.SUPABASE_PUBLISHABLE_KEY.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (body.role !== 'anon') throw Error('Use the publishable key');
      } else if (!config.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) throw Error('Use the publishable key');
      client = root.supabase.createClient(url.href, config.SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } });
    } catch { configError = true; }
  }
  const store = createStore({ storage: { getItem: key => root.localStorage.getItem(key), setItem: (key, value) => root.localStorage.setItem(key, value) }, client, notify: () => root.dispatchEvent(new CustomEvent('library:state')) });
  let ready;
  if (configError) { store.fail(); ready = Promise.resolve(); }
  else if (!client) ready = Promise.resolve();
  else ready = client.auth.getSession().then(async ({ data, error }) => {
    if (error) throw error;
    await store.setUser(data.session?.user || null);
  }).catch(() => { store.fail(); });
  root.CinevraCloud = { ...store, client, ready, failure };
  root.CinevraCloud.boot = callback => {
    const start = () => ready.then(() => {
      if (store.state().phase === 'error' && /\/(diary|watchlist|my-space)\.html$/.test(location.pathname)) return;
      return callback();
    }).catch(error => { if (typeof showToast === 'function') showToast(error.message || 'Could not load this page.'); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  };
  root.addEventListener('library:refresh', () => location.reload());
  root.addEventListener('pageshow', event => { if (event.persisted && store.state().user) location.reload(); });
  if (client && !location.pathname.endsWith('/auth-callback.html')) ready.then(() => {
    client.auth.onAuthStateChange((event, session) => {
      if ((session?.user?.id || null) !== (store.state().user?.id || null)) {
        store.fail();
        document.documentElement.classList.add('account-switching');
        setTimeout(() => location.reload(), 0);
      }
    });
  });
  root.addEventListener('unhandledrejection', event => {
    if (event.reason?.cinevra) { event.preventDefault(); if (typeof showToast === 'function') showToast(event.reason.message); }
  });
  for (const event of ['click', 'submit']) document.addEventListener(event, e => {
    if (e.target.closest('[data-account-signout]')) return;
    if ((store.state().busy || store.state().phase === 'loading') && e.target.closest('button, input, form')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  let refreshing = false;
  root.addEventListener('focus', async () => {
    if (!store.state().user || refreshing || store.state().busy || /account|auth-callback/.test(location.pathname)) return;
    // Jangan membuang isian form yang sedang diedit saat tab kembali aktif.
    if (document.querySelector('form[data-dirty="true"], dialog[open]')) return;
    refreshing = true;
    try {
      await store.refresh();
      if (!document.querySelector('form[data-dirty="true"], dialog[open]')) root.dispatchEvent(new CustomEvent('library:refresh'));
    }
    catch { mount(); } finally { refreshing = false; }
  });
  function mount() {
    const state = store.state();
    document.body.dataset.libraryState = state.phase;
    document.body.dataset.libraryBusy = String(state.busy);
    document.querySelector('main')?.setAttribute('aria-busy', String(state.phase === 'loading'));
    const slot = document.getElementById('accountSlot');
    if (slot) {
      slot.replaceChildren();
      if (!state.user) {
        const link = document.createElement('a'); link.href = 'account.html'; link.className = 'navbar__account-trigger'; link.setAttribute('aria-label', 'Sign in');
        link.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';
        slot.append(link);
      } else {
        const menu = document.createElement('div'); menu.className = 'navbar__account-menu';
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'navbar__account-trigger'; trigger.setAttribute('aria-label', 'Account menu'); trigger.textContent = (state.user.email || 'A').slice(0, 1).toUpperCase();
        trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'accountDropdown');
        const panel = document.createElement('div'); panel.className = 'navbar__account-panel'; panel.id = 'accountDropdown'; panel.hidden = true;
        trigger.addEventListener('click', () => {
          panel.hidden = !panel.hidden;
          trigger.setAttribute('aria-expanded', String(!panel.hidden));
          menu.classList.toggle('is-open', !panel.hidden);
        });
        const email = document.createElement('span'); email.textContent = state.user.email || 'Your account';
        const link = document.createElement('a'); link.href = 'account.html'; link.textContent = 'My account';
        const out = document.createElement('button'); out.type = 'button'; out.textContent = 'Sign out';
        out.setAttribute('data-account-signout', '');
        out.addEventListener('click', async () => { out.disabled = true; const { error } = await client.auth.signOut({ scope: 'local' }); if (error) { out.disabled = false; showToast('Could not sign out. Please retry.'); } });
        panel.append(email, link, out); menu.append(trigger, panel); slot.append(menu);
      }
    }
    let banner = document.getElementById('libraryBanner');
    if (!banner) { banner = document.createElement('div'); banner.id = 'libraryBanner'; banner.className = 'library-banner'; banner.setAttribute('role', 'status'); document.querySelector('.navbar')?.after(banner); }
    banner.replaceChildren();
    if (state.phase === 'loading') {
      banner.textContent = 'Loading your account collection...';
    } else if (state.busy) {
      banner.textContent = state.refreshing ? 'Refreshing your account collection...' : 'Saving your account collection...';
    } else if (state.phase === 'error') {
      const message = document.createElement('span'); message.textContent = configError ? 'Account configuration is unavailable. Your local collection has not been changed.' : 'Your account library could not be loaded. Your local collection has not been changed.';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry'; retry.addEventListener('click', () => location.reload()); banner.append(message, retry);
    } else if (state.user && !/account|auth-callback/.test(location.pathname)) {
      try {
        const data = store.guest();
        if (data.cinevra_watchlist.length || data.cinevra_lists.length || Object.values(data.cinevra_personal).some(record => record.rating || record.note || record.watchedOn || record.episodes?.length)) {
          const text = document.createElement('span'); text.textContent = 'Your guest collection is still on this browser.';
          const link = document.createElement('a'); link.href = 'account.html#guestImport'; link.textContent = 'Review import'; banner.append(text, link);
        }
      } catch { /* Halaman akun menampilkan alasan impor tidak tersedia. */ }
    }
    banner.hidden = !banner.childNodes.length;
  }
  document.addEventListener('DOMContentLoaded', () => { mount(); ready.then(mount); });
  root.addEventListener('library:state', () => { if (document.readyState !== 'loading') mount(); });
  function closeAccountMenu(restoreFocus = false) {
    const menu = document.querySelector('.navbar__account-menu.is-open');
    if (!menu) return;
    menu.classList.remove('is-open');
    menu.querySelector('.navbar__account-panel').hidden = true;
    const trigger = menu.querySelector('.navbar__account-trigger');
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAccountMenu(true); });
  document.addEventListener('click', event => { if (!event.target.closest('.navbar__account-menu')) closeAccountMenu(); });
  document.addEventListener('input', event => { if (event.target.closest('form') && !event.target.matches('[type="search"]')) event.target.closest('form').dataset.dirty = 'true'; });
})(typeof window === 'undefined' ? globalThis : window);
