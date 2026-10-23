const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const out = path.resolve('.tmp-share');
fs.mkdirSync(out, { recursive: true });
const baseline = process.argv.includes('--before');
const originals = baseline ? Object.fromEntries(['js/library.js', 'js/image-export.js', 'css/style.css'].map(file => [file, execFileSync('git', ['show', `HEAD:${file}`])])) : {};
const movies = [
  ['Interstellar', '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', '2014'],
  ['Dune', '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg', '2021'],
  ['Parasite', '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', '2019'],
  ['Arrival', '/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', '2016'],
];
const list = { id: 'share-test', name: 'Worth watching again', description: 'Stories that stay with you long after the credits.', items: Array.from({length: 16}, (_, index) => ({ id: index + 1, type: 'movie', title: movies[index % 4][0], posterPath: movies[index % 4][1], year: movies[index % 4][2], rating: 8.4 })) };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const key = new URL(req.url, 'http://localhost').pathname.slice(1) || 'watchlist.html';
  if (key === 'js/config.js') { res.setHeader('Content-Type','text/javascript'); return res.end("window.CINEVRA_CONFIG={TMDB_API_KEY:'test-key'};"); }
  const file = path.resolve(key);
  if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403); return res.end(); }
  const data = originals[key] || (fs.existsSync(file) && fs.readFileSync(file));
  res.writeHead(data ? 200 : 404, { 'Content-Type': mime[path.extname(file)] || 'text/plain' });
  res.end(data || 'Not found');
});

const {chromium} = require('C:/Users/asdawd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 let browser;
 try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext({acceptDownloads:true, viewport:{width:1440,height:1000}});
  await context.addInitScript(list=>{
    localStorage.setItem('cinevra_lists',JSON.stringify([list]));
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedLink=text}}});
  },list);
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('https://api.themoviedb.org/**',route=>route.fulfill({json:{results:[]}}));
  await page.goto(origin+'/watchlist.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>openShareModal('share-test'));
  await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(out,baseline?'before-desktop.png':'share-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,baseline?'before-mobile.png':'share-mobile.png')});
  if(baseline)return;
  for(const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),`Share overflow at ${width}`);
  }
  await page.locator('.share-url .btn').click();
  assert.ok(await page.evaluate(()=>window.copiedLink.includes('shared.html#')));
  await page.locator('.share-image-action').click();
  await page.waitForFunction(()=>document.querySelector('.image-export-status')?.textContent.startsWith('Preview ready'));
  await page.screenshot({path:path.join(out,'export-desktop.png')});
  for(const template of ['minimal','detailed','grid','collage']) {
    await page.locator(`[data-template="${template}"]`).click();
    await page.waitForFunction(()=>document.querySelector('.image-export-status')?.textContent.startsWith('Preview ready'));
    assert.equal(await page.locator(`[data-template="${template}"]`).getAttribute('aria-pressed'),'true');
    const png=await page.evaluate(async()=>{
      const image=document.querySelector('.image-export-preview img');await image.decode();
      return Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer()));
    });
    fs.writeFileSync(path.join(out,template+'.png'),Buffer.from(png));
  }
  await page.locator('[data-template="minimal"]').click();
  await page.locator('[data-template="grid"]').click();
  await page.waitForFunction(()=>document.querySelector('.image-export-preview img').naturalWidth===1080 && !document.querySelector('.image-export-preview img').hidden);
  for(const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),`Export overflow at ${width}`);
    if(width===390)await page.screenshot({path:path.join(out,'export-mobile.png')});
  }
  const downloaded=page.waitForEvent('download');
  await page.locator('.dialog--image-export .btn--primary').click();
  const download=await downloaded;
  assert.match(download.suggestedFilename(),/-grid.png$/);
  assert.deepEqual(fs.readFileSync(await download.path()),fs.readFileSync(path.join(out,'grid.png')));
  await page.locator('.dialog--image-export .btn--ghost').click();
  await page.locator('.dialog--share[open]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').count(),0);
  // Nama panjang tetap teks biasa, dan gambar yang gagal punya jalan untuk diulang.
  await page.evaluate(()=>{
    const lists=JSON.parse(localStorage.getItem('cinevra_lists'));
    lists[0].name='<img src=x onerror=alert(1)> '+ 'A'.repeat(180);
    localStorage.setItem('cinevra_lists',JSON.stringify(lists));
    openShareModal('share-test');
  });
  assert.equal(await page.locator('.share-list-summary__info img').count(),0);
  await page.locator('.share-image-action').click();
  await page.waitForFunction(()=>document.querySelector('.image-export-status')?.textContent.startsWith('Preview ready'));
  await page.evaluate(()=>{
    window.originalGenerator=generateListImage;
    generateListImage=async()=>{throw Error('Test failure')};
  });
  await page.locator('[data-template="detailed"]').click();
  await page.getByRole('button',{name:'Try again',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Download PNG',exact:true}).isDisabled(),true);
  await page.evaluate(()=>{generateListImage=window.originalGenerator});
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.image-export-status')?.textContent.startsWith('Preview ready'));
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  console.log('Chrome passed share/copy, four previews, rapid switching, exact PNG download, back, Escape, long safe text, error/retry and overflow at 320/390/768/1024/1440px.');
 } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
