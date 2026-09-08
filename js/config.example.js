// =========================================================
// CINEVRA — js/config.example.js
// =========================================================
// File INI aman di-commit ke GitHub (cuma placeholder, bukan key asli).
//
// CARA PAKAI (development lokal):
// 1. Copy file ini jadi "config.js" di folder yang sama (js/config.js)
// 2. Ganti TMDB_API_KEY di bawah dengan API key TMDB kamu
// 3. js/config.js SUDAH di-.gitignore, jadi key asli kamu gak akan
//    pernah ke-push ke GitHub walaupun kamu commit/push berkali-kali
//
// Untuk deploy (Netlify/Vercel), key diisi otomatis lewat environment
// variable saat proses build, lihat README.md bagian Deployment.
// =========================================================

window.CINEVRA_CONFIG = {
  TMDB_API_KEY: 'MASUKKAN_TMDB_API_KEY_DI_SINI',
};
