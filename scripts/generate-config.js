// =========================================================
// CINEVRA - scripts/generate-config.js
// =========================================================
// Script ini TIDAK dijalankan manual. Netlify/Vercel akan
// menjalankannya otomatis sebagai "build command" tiap kali deploy.
//
// Cara kerjanya: baca environment variable TMDB_API_KEY yang kamu
// set di dashboard Netlify/Vercel (bukan di kode), lalu tulis
// js/config.js berisi key itu. Karena js/config.js dibuat SAAT
// build (bukan disimpan di git), key asli kamu gak pernah muncul
// di repository GitHub kamu.
//
// Command buat Netlify/Vercel: node scripts/generate-config.js
// =========================================================

const fs = require('fs');
const path = require('path');

const apiKey = process.env.TMDB_API_KEY || '';

if (!apiKey) {
  console.warn(
    '[generate-config] PERINGATAN: environment variable TMDB_API_KEY belum di-set di dashboard hosting kamu. Situs akan ke-deploy tapi datanya gak akan muncul.'
  );
}

const outputPath = path.join(__dirname, '..', 'js', 'config.js');

const config = {
  TMDB_API_KEY: apiKey,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || '',
};
if (Boolean(config.SUPABASE_URL) !== Boolean(config.SUPABASE_PUBLISHABLE_KEY)) throw new Error('Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
if (config.SUPABASE_PUBLISHABLE_KEY) {
  const key = config.SUPABASE_PUBLISHABLE_KEY;
  let legacyAnon = false;
  try { legacyAnon = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
  if (!key.startsWith('sb_publishable_') && !legacyAnon) throw new Error('Use a Supabase publishable key, never a secret or service_role key.');
  const url = new URL(config.SUPABASE_URL);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Use HTTPS for Supabase.');
}
const fileContent = '// Generated public browser configuration.\nwindow.CINEVRA_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n';

fs.writeFileSync(outputPath, fileContent);
console.log(`[generate-config] js/config.js berhasil dibuat di ${outputPath}`);
