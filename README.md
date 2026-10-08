# Cinevra

Cinevra adalah website untuk menemukan film dan serial TV dengan tampilan gelap bernuansa sinematik. Proyek ini dibuat dengan HTML, CSS, dan JavaScript murni. Data judul, poster, pemeran, dan trailer diambil dari TMDB. Watchlist disimpan di browser sehingga tetap tersedia saat halaman dibuka kembali.

![Tampilan halaman utama Cinevra](./assets/images/image.png)

## Yang bisa dilakukan

- Melihat film dan serial TV yang sedang populer
- Membuka halaman detail untuk melihat sinopsis, pemeran, genre, judul serupa, dan trailer
- Menambahkan atau menghapus judul dari watchlist
- Menyaring judul berdasarkan genre, tahun, dan urutan
- Membuka tampilan yang nyaman di layar desktop maupun ponsel

## Teknologi

- HTML5
- CSS3 dengan Flexbox, Grid, dan custom properties
- JavaScript ES6
- TMDB API untuk data film dan serial TV
- localStorage untuk menyimpan watchlist

## Menjalankan proyek

1. Buat API key dari akun TMDB
2. Salin `js/api.example.js` menjadi `js/api.js`
3. Ganti nilai `TMDB_API_KEY` di dalam `js/api.js` dengan API key milikmu
4. Jalankan proyek melalui local server

Kamu bisa memakai ekstensi Live Server di VS Code atau menjalankan perintah berikut bila Python sudah tersedia

```powershell
python -m http.server 5500
```

Setelah itu buka `index.html` melalui alamat local server yang dibuat.

## Struktur proyek

```text
Cinevra
├── assets
│   └── images
├── css
│   ├── style.css
│   ├── home.css
│   ├── movies.css
│   ├── search.css
│   ├── detail.css
│   └── watchlist.css
├── js
│   ├── api.example.js
│   ├── main.js
│   ├── home.js
│   ├── movies.js
│   ├── tv-shows.js
│   ├── search.js
│   ├── detail.js
│   └── watchlist.js
├── index.html
├── movies.html
├── tv-shows.html
├── search.html
├── detail.html
└── watchlist.html
```

## Catatan penting

File `js/api.js` sengaja tidak masuk ke Git karena berisi API key pribadi. Gunakan `js/api.example.js` sebagai template saat menyiapkan proyek di perangkat baru.

Data film dan serial TV disediakan oleh The Movie Database. Cinevra adalah proyek pribadi dan tidak berafiliasi dengan TMDB.

## Pembuat

Dibuat oleh Rafif Shula Syandana untuk proyek pembelajaran Pemrograman Web.
## Rating pribadi, episode, dan platform streaming

Halaman detail bisa menyimpan rating pribadi dari 1 sampai 10, tanggal menonton, dan catatan singkat. Detail TV juga punya centang per episode, tombol untuk menandai satu season, dan progres keseluruhan season reguler. Episode spesial tidak dihitung. Data disimpan di localStorage browser tanpa akun dan akan hilang jika data browser dihapus.

Katalog Movies dan TV Shows punya filter negara dan platform streaming. Negara awal pada katalog biasa adalah Indonesia. Pilih All countries untuk melihat katalog tanpa batasan streaming. Pilihan tersimpan di URL dan bisa digabung dengan genre, tahun, urutan, serta Load More. Hasil mencakup streaming berlangganan, gratis, dan dengan iklan. Memilih filter streaming dari kategori akan membuka katalog umum. Kosongkan pencarian judul untuk memakai filter streaming. Ketersediaan berasal dari TMDB dan JustWatch dan bisa berubah.

Jalankan pemeriksaan dengan `node scripts/test-personal.js`, `node scripts/test-personal-ui.js`, `node scripts/test-streaming.js`, dan `node scripts/test-streaming-ui.js`.

Parameter streaming mengikuti [dokumentasi Discover TMDB](https://developer.themoviedb.org/reference/discover-movie). Episode dimuat lewat [endpoint detail season](https://developer.themoviedb.org/reference/tv-season-details).
