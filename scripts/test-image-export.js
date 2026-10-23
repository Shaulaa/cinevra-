const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const canvases = [];
const palette = { '--bg': '#0a0a0d', '--surface': '#18181d', '--border': '#2a2a31', '--text-primary': '#f2f1ee', '--text-secondary': '#a8a6a3', '--accent-gold': '#e3b341', '--font-display': 'serif', '--font-body': 'sans-serif' };
const context = vm.createContext({
  console, setTimeout, clearTimeout, formatRating: value => String(value),
  getComputedStyle: () => ({ getPropertyValue: key => palette[key] || '' }),
  document: {
    documentElement: {}, fonts: { load: async () => {}, ready: Promise.resolve() },
    createElement: () => {
      const ctx = new Proxy({ measureText: text => ({ width: Array.from(text).length * 12 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (target, key) => target[key] || (() => {}) });
      const canvas = { getContext: () => ctx, toBlob: callback => callback({ type: 'image/png' }) };
      canvases.push(canvas);
      return canvas;
    },
  },
});
vm.runInContext(fs.readFileSync('js/image-export.js', 'utf8'), context);
vm.runInContext('drawPoster = async (ctx, item, x, y, width, height) => posterBounds.push({ x, y, width, height })', context);

(async () => {
  for (const count of [1, 4, 16, 20]) {
    context.list = { name: 'A very long list name '.repeat(8), items: Array.from({ length: count }, (_, id) => ({ id, title: 'A very long movie title '.repeat(4), year: '2026', rating: 8 })) };
    for (const template of ['minimal', 'detailed', 'grid', 'collage']) {
      context.posterBounds = [];
      await vm.runInContext(`generateListImage(list, '${template}')`, context);
      const canvas = canvases.at(-1);
      const bounds = context.posterBounds;
      assert.ok(bounds.length > 0);
      for (const rect of bounds) {
        assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= canvas.width && rect.y + rect.height <= canvas.height, `${template} poster exceeds canvas with ${count} titles`);
      }
      if (template === 'grid') {
        for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
          const a = bounds[i], b = bounds[j];
          assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, 'Grid posters overlap');
        }
      }
    }
  }
  await assert.rejects(vm.runInContext("generateListImage(list, 'unknown')", context), /Unknown template/);
  const drawn = [];
  context.textCtx = { measureText: text => ({ width: Array.from(text).length * 10 }), fillText: text => drawn.push(text) };
  vm.runInContext("drawImageText(textCtx, 'Worth watching again', 0, 0, 170, 20, 2)", context);
  assert.deepEqual(drawn, ['Worth watching', 'again']);
  drawn.length = 0;
  vm.runInContext("drawImageText(textCtx, 'A'.repeat(100), 0, 0, 100, 20, 2)", context);
  assert.equal(drawn.length, 2);
  assert.ok(drawn.every(line => Array.from(line).length <= 10));
  assert.ok(drawn[1].endsWith('\u2026'));
  context.emptyCanvas = { toBlob: callback => callback(null) };
  await assert.rejects(vm.runInContext('canvasToBlob(emptyCanvas)', context), /Could not create image/);
  console.log('Image export passed for all four templates with short and long lists, bounded posters and non-overlapping grid');
})().catch(error => { console.error(error); process.exitCode = 1; });
