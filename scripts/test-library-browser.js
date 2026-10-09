const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const item = (id, type = 'movie', watched = false) => ({ id, type, title: `Title ${id}`, posterPath: null, rating: 7, year: '2020', watched });
const fixture = { app: 'cinevra', version: 1, data: {
  watchlist: [item(1, 'movie', true), item(2, 'tv')],
  lists: [{ id: 'l1', name: '<b>Favorites</b>', items: [item(1, 'movie', true)] }],
  personal: { 'movie:1': { rating: 9, watchedOn: '2026-10-08', note: '<img src=x onerror=alert(1)>', episodes: [] }, 'tv:2': { rating: '', watchedOn: '', note: '', episodes: ['1:1'] } },
} };
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const file = path.resolve(new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html');
  if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403); return res.end(); }
  if (file.endsWith(path.join('js', 'config.js'))) { res.setHeader('Content-Type', 'text/javascript'); return res.end("window.CINEVRA_CONFIG={TMDB_API_KEY:'test-key'};"); }
  fs.readFile(file, (error, data) => { res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'Not found' : data); });
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('https://**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'api.themoviedb.org') {
        const type = url.pathname.includes('/tv/') ? 'tv' : 'movie';
        if (url.pathname.endsWith('/recommendations')) return route.fulfill({ json: { results: [{ id: type === 'tv' ? 2 : 1, title: 'Already saved' }, { id: 100, title: '<img onerror=alert(1)>', name: 'TV recommendation', vote_average: 8, release_date: '2026-01-01' }] } });
        return route.fulfill({ json: { id: 1, genres: [{ id: 18, name: 'Drama' }], title: 'Title 1', name: 'Title 2', type } });
      }
      await route.fulfill({ status: 200, body: '', contentType: 'text/css' });
    });
    await context.addInitScript(data => {
      if (!sessionStorage.getItem('test-seeded')) {
        localStorage.setItem('cinevra_watchlist', JSON.stringify(data.watchlist));
        localStorage.setItem('cinevra_lists', JSON.stringify(data.lists));
        localStorage.setItem('cinevra_personal', JSON.stringify(data.personal));
        localStorage.setItem('unrelated_setting', 'keep');
        sessionStorage.setItem('test-seeded', 'yes');
      }
    }, fixture.data);
    await page.goto(`${origin}/my-space.html`);
    await page.waitForFunction(() => document.getElementById('favoriteGenres').textContent.includes('Drama'));
    assert.equal(await page.locator('#moviesWatched').textContent(), '1');
    assert.equal(await page.locator('#averageRating').textContent(), '9.0 / 10');
    assert.equal(await page.locator('#episodesWatched').textContent(), '1');
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
    }
    await page.screenshot({ path: '.tmp-my-space-desktop.png', fullPage: true });
    await page.getByRole('link', { name: 'For You', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#recommendationGrid .movie-card').length === 2);
    assert.equal(await page.locator('#recommendationGrid img').count(), 0);
    assert.ok((await page.locator('#recommendationGrid').textContent()).includes('<img onerror=alert(1)>'));
    await context.route('**/3/tv/*/recommendations?*', route => route.fulfill({ status: 503, json: {} }));
    await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('cinevra_cache:')).forEach(key => sessionStorage.removeItem(key)));
    await page.getByRole('button', { name: 'Refresh recommendations' }).click();
    await page.waitForFunction(() => document.getElementById('recommendationStatus').textContent.includes('Some recommendations'));
    assert.equal(await page.locator('#recommendationGrid .movie-card').count(), 1);
    await context.route('**/3/movie/*/recommendations?*', route => route.fulfill({ status: 503, json: {} }));
    await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('cinevra_cache:')).forEach(key => sessionStorage.removeItem(key)));
    await page.getByRole('button', { name: 'Refresh recommendations' }).click();
    await page.waitForFunction(() => document.getElementById('recommendationStatus').textContent.includes('2 of 2'));
    assert.equal(await page.locator('#recommendationGrid .movie-card').count(), 0);
    await page.getByRole('link', { name: 'Backup & Restore', exact: true }).click();
    assert.equal(await page.locator('#restoreBackup').isDisabled(), true);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup' }).click();
    const download = await downloaded;
    const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(backup.data.personal['movie:1'].note, fixture.data.personal['movie:1'].note);
    assert.equal(JSON.stringify(backup).includes('test-key'), false);
    await page.locator('#importBackup').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
    await page.waitForFunction(() => document.getElementById('backupStatus').textContent.includes('Could not import'));
    assert.equal(await page.locator('#restoreConfirm').isDisabled(), true);
    const replacement = { app: 'cinevra', version: 1, data: { watchlist: [], lists: [], personal: {} } };
    await page.locator('#importBackup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
    await page.waitForFunction(() => !document.getElementById('restoreConfirm').disabled);
    assert.equal(await page.locator('#restoreBackup').isDisabled(), true);
    await page.locator('#restoreConfirm').check();
    await page.getByRole('button', { name: 'Replace library and restore' }).click();
    assert.match(await page.locator('#backupStatus').textContent(), /Restored successfully/);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated_setting')), 'keep');
    await page.reload();
    await page.getByRole('link', { name: 'My Stats', exact: true }).click();
    assert.equal(await page.locator('#moviesWatched').textContent(), '0');
    await page.getByRole('link', { name: 'For You', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('recommendationStatus').textContent.includes('Save a title'));
    assert.match(await page.locator('#recommendationStatus').textContent(), /Save a title/);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('navLinks')).opacity === '0');
    await page.locator('#navToggle').click();
    assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'), 'true');
    await page.locator('.navbar__links a[data-page="my-space.html"]').click();
    await page.waitForFunction(() => document.getElementById('moviesWatched').textContent === '0');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('navLinks')).opacity === '0');
    await page.screenshot({ path: '.tmp-my-space-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Chrome tests passed: stats, responsive layout, recommendations, safe text, download, invalid import, confirmed restore and empty states');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
