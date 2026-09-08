# Cinevra

Cinevra adalah website Movie & TV Show discovery dengan tampilan dark cinematic, dibangun murni pakai **Vanilla HTML, CSS, dan JavaScript** (tanpa framework, tanpa backend, tanpa database). Data film dan TV show diambil secara dinamis dari [TMDB API](https://www.themoviedb.org/documentation/api), dan fitur Watchlist disimpan langsung di `localStorage` browser.

> 💡 Tempel screenshot/GIF demo Cinevra kamu di sini sebelum di-push ke GitHub, misal `assets/images/preview.png`, biar orang yang buka repo langsung kebayang tampilannya tanpa harus jalanin project dulu.

## ✨ Fitur

- **Home** — hero carousel dari film trending, plus 6 baris kurasi (Continue Your Watchlist, Trending Movies, Trending TV Shows, Popular Movies, Top Rated Movies, Now Playing) dan chip Browse by Genre
- **Movies & TV Shows** — grid film/TV show lengkap dengan filter genre, tahun, sort (popularity/rating/newest/oldest), pencarian, dan Load More
- **Detail** — backdrop, poster, sinopsis, genre, cast & crew, gallery, trailer (modal YouTube), dan judul serupa (similar), untuk movie maupun TV show lewat URL yang sama (`detail.html?id=&type=`)
- **Watchlist** — tambah/hapus film & TV show, tersimpan permanen di `localStorage`, dengan tab filter All/Movies/TV Shows dan empty state
- Loading skeleton, progress bar global, error handling, dan navbar responsif (hamburger menu di mobile)

## 🛠️ Tech Stack

- HTML5, CSS3 (custom properties, flexbox, grid), JavaScript (ES6+, `fetch`, `async/await`)
- [TMDB API](https://www.themoviedb.org/documentation/api) sebagai sumber data
- `localStorage` untuk Watchlist
- Font: [Fraunces](https://fonts.google.com/specimen/Fraunces) (display) & [Inter](https://fonts.google.com/specimen/Inter) (body), dari Google Fonts

Tidak ada framework (React/Vue/Angular), tidak ada CSS library (Tailwind/Bootstrap), tidak ada backend/database.

## 📁 Struktur Folder

```
cinevra/
├── index.html          # Home
├── movies.html          # All Movies
├── tv-shows.html        # TV Shows
├── detail.html           # Detail movie/TV show
├── watchlist.html        # Watchlist
│
├── css/
│   ├── style.css        # Base styles (navbar, tombol, movie card, dsb)
│   ├── home.css
│   ├── movies.css       # dipakai juga oleh tv-shows.html
│   ├── detail.css
│   └── watchlist.css
│
├── js/
│   ├── api.js            # Semua fungsi fetch ke TMDB API
│   ├── main.js           # Navbar, watchlist (localStorage), toast, helper reusable
│   ├── home.js
│   ├── movies.js
│   ├── tv-shows.js
│   ├── detail.js
│   └── watchlist.js
│
└── assets/
    └── images/           # Logo & favicon
```

## 🚀 Cara Menjalankan

### 1. Dapatkan TMDB API Key

1. Daftar akun gratis di [themoviedb.org](https://www.themoviedb.org/signup)
2. Login → **Settings** → **API** → **Create** (pilih tipe *Developer*)
3. Isi form aplikasi seadanya (Application Name: `Cinevra`, URL boleh diisi `http://localhost`)
4. Salin **API Key (v3 auth)** yang diberikan

### 2. Pasang API Key

Buka `js/api.js`, ganti baris berikut dengan API key kamu:

```js
const TMDB_API_KEY = 'MASUKKAN_TMDB_API_KEY_DI_SINI';
```

### 3. Jalankan Local Server

Karena project ini pakai `fetch()` ke API luar, buka lewat local server (bukan `file://`) supaya tidak kena CORS.

**Pakai Python:**
```bash
cd cinevra
python -m http.server 5500
```
lalu buka `http://localhost:5500`

**Pakai VS Code:** install extension **Live Server**, klik kanan `index.html` → *Open with Live Server*

**Pakai Node:**
```bash
npx serve cinevra
```

## 📌 Catatan

- Ini adalah proyek pribadi/portofolio, awalnya dikembangkan sebagai latihan Pemrograman Web dengan JavaScript murni (tanpa framework).
- Semua data film & TV show bersumber dari TMDB, namun website ini **tidak diendorse atau disertifikasi oleh TMDB**.

## 🙏 Credit

Data film & TV show disediakan oleh **[The Movie Database (TMDB)](https://www.themoviedb.org/)**.

<img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB Logo" width="120">

---

Dibuat oleh **King Ozymandias**.
