// =========================================================
// CINEVRA — scripts/generate-config.js
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

const fileContent = `// File ini di-generate OTOMATIS saat proses build oleh
// scripts/generate-config.js. JANGAN diedit manual di server produksi,
// dan file ini TIDAK disimpan di git (lihat .gitignore).
window.CINEVRA_CONFIG = {
  TMDB_API_KEY: '${apiKey}',
};
`;

fs.writeFileSync(outputPath, fileContent);
console.log(`[generate-config] js/config.js berhasil dibuat di ${outputPath}`);
