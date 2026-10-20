# Community

Community menyediakan review singkat, daftar publik, reaksi suka, serta salinan daftar ke koleksi pribadi. Tamu boleh membaca feed. Publikasi, reaksi, dan laporan memerlukan akun.

## Mengaktifkan

Jalankan `supabase/migrations/202610200001_community.sql` satu kali melalui SQL Editor proyek yang sudah memakai migrasi library. Migrasi ini menambahkan tabel dan fungsi baru. Jangan menjalankan ulang migrasi library atau menghapus tabel yang sudah berisi data.

Buka `community.html`. Database yang belum siap menampilkan pesan kegagalan tanpa mengarang postingan atau menyimpan publikasi secara lokal.

## Yang dibagikan

Pengguna memilih review Diary atau custom list miliknya, menulis nama publik dan teks terpisah, memeriksa pratinjau, lalu menyetujui publikasi. Catatan Diary tidak otomatis dimasukkan ke form. Snapshot publik hanya memuat nama publik, teks, rating pilihan, penanda spoiler, serta ID TMDB, jenis, judul, dan path poster yang dipilih.

Email, tanggal menonton, progres episode, dan koleksi lainnya tetap pribadi. Nama publik merupakan nama tampilan per postingan dan tidak unik. Perubahan pada koleksi pribadi tidak otomatis mengubah snapshot publik. Pemilik bisa mengedit atau menarik postingan, lalu membagikannya kembali. Salinan yang sebelumnya disimpan pembaca tetap menjadi milik pembaca.

Review dibatasi 600 karakter. Daftar publik memuat 1 sampai 40 judul. Satu akun dapat menyimpan sampai 50 postingan, dengan jeda 30 detik antarpostingan baru. Satu sumber menghasilkan satu postingan yang dapat diperbarui.

## Akses dan moderasi

Ketiga tabel Community mengaktifkan RLS dan mencabut akses tabel langsung dari `anon` serta `authenticated`. RPC menjadi satu-satunya jalur aplikasi. Fungsi memakai `search_path` kosong, ID pemilik dari `auth.uid()`, dan proyeksi kolom yang eksplisit. Feed hanya mengagregasi jumlah suka, tanpa membuka identitas pemberi reaksi. Metadata sumber pribadi hanya dikembalikan kepada pemilik.

Laporan disimpan pada `community_reports` dan menyembunyikan postingan dari feed pelapor. Peninjauan dilakukan manual melalui dashboard Supabase. Pengelola dapat menarik postingan dengan mengubah `community_posts.published` menjadi `false`. Versi ini belum memiliki dashboard moderator, komentar, notifikasi, polling, atau Realtime. Refresh dan pagination memuat aktivitas berikutnya.

Untuk menonaktifkan Community sambil mempertahankan data, jalankan `supabase/rollback/202610200001_community.sql`. Script itu mencabut akses RPC Community dan tidak menyentuh library pribadi.

## Verifikasi

```powershell
node scripts/test-community.js
$env:PGLITE_MODULE = Join-Path $env:TEMP 'cinevra-sql-tests/node_modules/@electric-sql/pglite'
node scripts/test-community-sql.cjs
```

Pengujian PostgreSQL lokal mencakup dua akun, akses tamu, penolakan akses tabel langsung, kerahasiaan sumber pribadi, validasi snapshot, reaksi idempoten, laporan, penarikan postingan, dan pagination. Pengujian browser memakai data contoh pada server lokal terisolasi, tanpa menerbitkan konten ke proyek pengguna. Migrasi juga sudah dijalankan pada proyek Supabase pengguna. Feed hosted merespons HTTP 200, halaman akun login berhasil membuka form berbagi, dan nama publik, teks, serta persetujuan tidak terisi otomatis. Publikasi dan reaksi tetap diuji memakai database lokal agar tidak menerbitkan konten uji ke proyek pengguna.

Rujukan implementasi memakai [Database functions](https://supabase.com/docs/guides/database/functions) dan [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
