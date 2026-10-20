# Akun dan sinkronisasi Cinevra

Kode memakai Supabase Auth untuk email/password dan Google. Data personal disimpan pada lima tabel dengan RLS. Katalog tetap memakai TMDB. Mode tamu tidak memerlukan konfigurasi Supabase.

## Buat proyek dan database

1. Masuk ke [dashboard Supabase](https://supabase.com/dashboard), buat proyek Cinevra, dan pilih region terdekat. Simpan database password pada pengelola password pribadi.
2. Buka SQL Editor dan jalankan [migrasi library](supabase/migrations/202610190001_library.sql). Migrasi dibuat untuk proyek baru dan dijalankan sekali. Jangan menjalankannya pada database berisi tabel bernama sama tanpa memeriksa strukturnya.
3. Pastikan kelima tabel mengaktifkan RLS dan mempunyai policy `owner_access`.
4. Ambil Project URL dan publishable key dari panel Connect atau pengaturan API proyek.

Jangan memasukkan secret key, `service_role`, database password, atau Google client secret ke konfigurasi frontend. Pembuatan tabel melalui SQL tidak otomatis menjamin RLS, sehingga migrasi secara eksplisit mengaktifkan RLS dan membatasi akses ke pengguna yang memiliki baris tersebut.

## Konfigurasi aplikasi

Untuk development, tambahkan nilai berikut ke `window.CINEVRA_CONFIG` di `js/config.js` yang sudah diabaikan Git. Pertahankan TMDB_API_KEY yang ada.

```js
SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_YOUR_PUBLIC_KEY',
```

Untuk hosting, isi `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` bersama `TMDB_API_KEY` pada environment variables, lalu jalankan build yang sudah ada.

```bash
npm run build
```

Konfigurasi ini memang dikirim ke browser. Build menolak secret key dan konfigurasi Supabase yang hanya terisi separuh. Jika kedua nilai Supabase kosong, Cinevra tetap bekerja sebagai tamu. SDK resmi disertakan di `js/vendor/supabase-2.118.0.js` dengan lisensi MIT, tanpa bundler baru.

## Email dan Google

Di Supabase Auth, aktifkan provider Email dan konfirmasi email. Gunakan minimum password 12 karakter untuk akun baru agar sesuai form aplikasi. Konfigurasikan SMTP yang layak untuk produksi, kemudian uji penerimaan email konfirmasi dan pemulihan pada alamat sungguhan.

Atur Site URL ke domain produksi. Tambahkan URL callback berikut ke Redirect URLs untuk development.

```text
http://127.0.0.1:5500/auth-callback.html
http://127.0.0.1:5500/auth-callback.html?flow=recovery
http://localhost:5500/auth-callback.html
http://localhost:5500/auth-callback.html?flow=recovery
```

Tambahkan dua varian callback yang sama menggunakan domain produksi HTTPS. PKCE mengharuskan link email dibuka pada browser dan origin yang memulai permintaan. Hindari mencampur localhost dan 127.0.0.1 selama satu alur login.

Di Google Cloud, buat OAuth client bertipe Web application. Daftarkan origin lokal yang digunakan dan origin produksi. Isi Authorized redirect URI dengan callback proyek Supabase berikut, lalu masukkan Client ID dan Client Secret pada provider Google di dashboard Supabase.

```text
https://YOUR_PROJECT.supabase.co/auth/v1/callback
```

Gunakan scope identitas standar `openid`, email, dan profile. Jika konfigurasi consent masih dalam testing, tambahkan akun penguji di Google. Google client secret tidak menjadi environment variable frontend Cinevra.

## Perilaku penyimpanan

- `account.html` menyediakan daftar, login email/Google, pemulihan password, logout, dan ringkasan impor.
- `auth-callback.html` menukar kode PKCE sekali pakai. Kode dihapus dari URL dan tujuan redirect selalu halaman internal yang tetap.
- Tamu tetap memakai `cinevra_watchlist`, `cinevra_lists`, dan `cinevra_personal` di browser. Login tidak otomatis mengunggah data tamu.
- Snapshot akun hanya disimpan dalam memori halaman dan dibaca setelah sesi diketahui. Pergantian akun mengosongkan snapshot serta menyembunyikan tampilan lama sebelum memuat ulang.
- `library_apply` menyimpan perbedaan per entri dalam satu transaksi. Perubahan episode tidak menimpa review. Pesan sukses ditampilkan setelah database mengakui penyimpanan.
- `library_import` mempertahankan entri cloud yang sudah ada, menggabungkan daftar yang mempunyai ID atau nama sama, dan menambahkan episode/judul yang belum ada. Impor aman diulang dan tidak menghapus data tamu.
- Gagal membaca atau menulis akun tidak mengalihkan penyimpanan ke mode tamu. Form tetap mempertahankan isian untuk dicoba lagi.
- Koleksi diperbarui saat halaman dibuka atau tab kembali aktif. Refresh ditunda ketika form sedang diedit atau dialog terbuka. Tidak ada Realtime atau antrean offline pada versi ini.
- Recently Viewed, preferensi Surprise Me, dan preferensi tampilan tetap lokal. Berbagi daftar tetap memakai tautan snapshot yang sudah ada, tanpa membuka tabel pribadi ke publik.

## Verifikasi lokal

Jalankan pengujian kontrak akun, penyimpanan, build, dan regresi yang tidak memerlukan kredensial layanan.

```bash
node scripts/test-account.js
node scripts/test-cloud-store.js
node scripts/test-public-config.cjs
node scripts/test-personal.js
node scripts/test-personal-ui.js
node scripts/test-diary.js
node scripts/test-diary-ui.js
node scripts/test-library.js
node scripts/test-streaming.js
node scripts/test-streaming-ui.js
```

Pengujian SQL menggunakan PostgreSQL melalui PGlite di folder sementara, tanpa menambah dependency aplikasi. Contoh PowerShell berikut menguji migrasi, RLS dua akun, foreign key kepemilikan, transaksi gagal, serta impor berulang.

```powershell
npm.cmd install --prefix "$env:TEMP\cinevra-sql-tests" --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
$env:PGLITE_MODULE = "$env:TEMP\cinevra-sql-tests\node_modules\@electric-sql\pglite"
node scripts/test-supabase-sql.cjs
```

Pengujian tersebut memakai `auth.uid()` simulasi dan tidak membuktikan konfigurasi proyek Supabase, provider Google, atau email produksi. Sebelum rilis, jalankan migrasi di proyek yang benar, uji dua akun melalui API hosted, uji login Google, terima email konfirmasi/pemulihan, dan buka koleksi yang sama pada perangkat kedua.

## Rujukan

- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
