const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cinevra-config-'));
fs.mkdirSync(path.join(dir, 'scripts')); fs.mkdirSync(path.join(dir, 'js'));
fs.copyFileSync('scripts/generate-config.js', path.join(dir, 'scripts/generate-config.js'));
function run(env) { return spawnSync(process.execPath, ['scripts/generate-config.js'], { cwd: dir, env: { ...process.env, SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', ...env }, encoding: 'utf8' }); }
try {
  const key = "quote' newline\n\\safe";
  assert.equal(run({ TMDB_API_KEY: key }).status, 0);
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(dir, 'js/config.js'), 'utf8'), context);
  assert.equal(context.window.CINEVRA_CONFIG.TMDB_API_KEY, key);
  assert.notEqual(run({ SUPABASE_URL: 'https://example.supabase.co' }).status, 0);
  assert.notEqual(run({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }).status, 0);
  const legacy = 'a.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.c';
  assert.notEqual(run({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: legacy }).status, 0);
  assert.equal(run({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).status, 0);
  console.log('Public config escaping, optional setup and secret-key rejection tests passed');
} finally {
  assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(dir, { recursive: true });
}
