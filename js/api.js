/* =========================================================
   CINEVRA — js/api.js
   Semua fungsi yang berhubungan dengan TMDB API ada di file ini.
   Halaman lain (home.js, movies.js, dst) tinggal memanggil
   fungsi-fungsi di bawah, tidak perlu tahu detail fetch-nya.

   Cara pakai API_KEY: lihat instruksi di akhir jawaban / README.
   ========================================================= */

// -------- Konfigurasi dasar --------
// TMDB_API_KEY dibaca dari window.CINEVRA_CONFIG, yang diisi lewat
// js/config.js (development lokal: copy dari js/config.example.js,
// production: dibuat otomatis oleh scripts/generate-config.js).
// api.js sendiri TIDAK pernah menyimpan key secara langsung.
const TMDB_API_KEY = (window.CINEVRA_CONFIG && window.CINEVRA_CONFIG.TMDB_API_KEY) || '';

if (!TMDB_API_KEY || TMDB_API_KEY === 'MASUKKAN_TMDB_API_KEY_DI_SINI') {
  console.warn(
    'TMDB_API_KEY belum di-set. Copy js/config.example.js jadi js/config.js lalu isi API key kamu (lihat README.md).'
  );
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// Ukuran gambar yang disediakan TMDB, dipakai lewat helper getImageUrl()
const IMAGE_SIZES = {
  poster: 'w500',
  posterSmall: 'w342',
  backdrop: 'w1280',
  backdropSmall: 'w780',
  profile: 'w185',
};

/**
 * Helper utama untuk memanggil TMDB API.
 * Hasilnya di-cache ke sessionStorage berdasarkan endpoint+parameter,
 * jadi kalau user pindah halaman lalu balik lagi (misal Detail -> Back
 * -> Movies) dalam tab yang sama, data yang sama gak perlu di-fetch
 * ulang dari TMDB, cukup dibaca dari cache dan langsung tampil.
 * Cache otomatis hilang begitu tab/browser ditutup (sifat sessionStorage).
 * @param {string} endpoint - contoh: '/movie/popular'
 * @param {Object} params - query string tambahan, contoh: { page: 2 }
 * @param {AbortSignal} [signal] - opsional, buat cancel request yang keburu usang
 *   (dipakai di search autocomplete supaya request lama gak numpuk/balapan
 *   sama request baru pas user masih ngetik)
 * @returns {Promise<Object>} data JSON dari TMDB
 */
async function tmdbFetch(endpoint, params = {}, signal) {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');

  // tambahkan semua parameter tambahan ke query string
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  // key cache gak perlu ikutan api_key, biar gak beda-beda kalau key-nya
  // sempat diganti; cukup endpoint + query lain aja
  const cacheKey = `cinevra_cache:${endpoint}?${url.searchParams.toString().replace(`api_key=${TMDB_API_KEY}&`, '')}`;

  const cached = readCache(cacheKey);
  if (cached) return cached;

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) {
    // dilempar sebagai error supaya bisa ditangkap dengan try/catch di pemanggil
    throw new Error(`TMDB request gagal (status ${response.status})`);
  }

  const data = await response.json();
  writeCache(cacheKey, data);
  return data;
}

/**
 * Baca cache dari sessionStorage. Return null kalau gak ada atau
 * sessionStorage gak bisa diakses (mode private/incognito ketat, dsb),
 * supaya tetap fallback ke fetch normal tanpa error.
 */
function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Simpan hasil fetch ke sessionStorage. Dibungkus try/catch karena
 * sessionStorage punya kuota terbatas (biasanya ~5MB) dan bisa penuh
 * kalau user buka banyak banget halaman dalam satu sesi, kalau itu
 * terjadi caching-nya di-skip aja, gak sampai bikin app error.
 */
function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    // storage penuh atau gak tersedia, gak masalah, lanjut tanpa cache
  }
}

/**
 * Membentuk URL gambar lengkap dari path yang dikembalikan TMDB.
 * TMDB hanya mengirim path seperti "/abcd.jpg", bukan URL lengkap.
 * @param {string} path
 * @param {'poster'|'posterSmall'|'backdrop'|'backdropSmall'|'profile'} sizeKey
 * @returns {string|null} URL gambar, atau null jika path kosong
 */
function getImageUrl(path, sizeKey = 'poster') {
  if (!path) return null;
  const size = IMAGE_SIZES[sizeKey] || IMAGE_SIZES.poster;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// ---------------------------------------------------------
// MOVIES
// ---------------------------------------------------------

function fetchTrendingMovies(timeWindow = 'week') {
  return tmdbFetch(`/trending/movie/${timeWindow}`);
}

function fetchPopularMovies(page = 1) {
  return tmdbFetch('/movie/popular', { page });
}

function fetchTopRatedMovies(page = 1) {
  return tmdbFetch('/movie/top_rated', { page });
}

function fetchNowPlayingMovies(page = 1) {
  return tmdbFetch('/movie/now_playing', { page });
}

function fetchUpcomingMovies(page = 1) {
  return tmdbFetch('/movie/upcoming', { page });
}

/**
 * Mengambil daftar film dengan filter genre, tahun & urutan (dipakai di movies.html).
 * @param {Object} options - { page, genreId, year, sortBy }
 */
function fetchMoviesByFilter({ page = 1, genreId = '', year = '', sortBy = 'popularity.desc' } = {}) {
  return tmdbFetch('/discover/movie', {
    page,
    with_genres: genreId,
    primary_release_year: year,
    sort_by: sortBy,
  });
}

function fetchMovieDetails(id) {
  return tmdbFetch(`/movie/${id}`);
}

function fetchMovieCredits(id) {
  return tmdbFetch(`/movie/${id}/credits`);
}

function fetchMovieVideos(id) {
  return tmdbFetch(`/movie/${id}/videos`);
}

function fetchSimilarMovies(id) {
  return tmdbFetch(`/movie/${id}/similar`);
}

function fetchMovieGenres() {
  return tmdbFetch('/genre/movie/list');
}

function searchMovies(query, page = 1) {
  return tmdbFetch('/search/movie', { query, page });
}

// ---------------------------------------------------------
// TV SHOWS
// ---------------------------------------------------------

function fetchPopularTV(page = 1) {
  return tmdbFetch('/tv/popular', { page });
}

function fetchTrendingTV(timeWindow = 'week') {
  return tmdbFetch(`/trending/tv/${timeWindow}`);
}

function fetchTVByFilter({ page = 1, genreId = '', year = '', sortBy = 'popularity.desc' } = {}) {
  return tmdbFetch('/discover/tv', {
    page,
    with_genres: genreId,
    first_air_date_year: year,
    sort_by: sortBy,
  });
}

function fetchTVDetails(id) {
  return tmdbFetch(`/tv/${id}`);
}

function fetchTVCredits(id) {
  return tmdbFetch(`/tv/${id}/credits`);
}

function fetchTVVideos(id) {
  return tmdbFetch(`/tv/${id}/videos`);
}

function fetchSimilarTV(id) {
  return tmdbFetch(`/tv/${id}/similar`);
}

function fetchTVGenres() {
  return tmdbFetch('/genre/tv/list');
}

function searchTV(query, page = 1) {
  return tmdbFetch('/search/tv', { query, page });
}

// ---------------------------------------------------------
// SEARCH GABUNGAN (dipakai kotak search di navbar)
// ---------------------------------------------------------

function searchMulti(query, page = 1, signal) {
  return tmdbFetch('/search/multi', { query, page }, signal);
}

// ---------------------------------------------------------
// PERSON (Cast/Crew detail)
// ---------------------------------------------------------

function fetchPersonDetails(id) {
  return tmdbFetch(`/person/${id}`);
}

/**
 * Gabungan semua film & TV show yang pernah dibintangi/dikerjakan
 * seseorang (dipakai buat halaman filmography di person.html).
 */
function fetchPersonCombinedCredits(id) {
  return tmdbFetch(`/person/${id}/combined_credits`);
}
