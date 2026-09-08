/* =========================================================
   CINEVRA — js/api.example.js
   Template konfigurasi API. JANGAN commit api.js yang berisi
   API key asli ke repository publik.

   Cara setup:
   1. Daftar di https://www.themoviedb.org/ dan buat API key
      (Settings → API → Create → Developer).
   2. Salin file ini menjadi js/api.js
   3. Ganti nilai TMDB_API_KEY di bawah dengan API key kamu.
   4. Pastikan js/api.js ada di .gitignore jika repo ini publik.
   ========================================================= */

// -------- Konfigurasi dasar --------
const TMDB_API_KEY = 'MASUKKAN_API_KEY_TMDB_KAMU_DI_SINI'; // <- ganti dengan API key TMDB kamu
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
 * @param {string} endpoint - contoh: '/movie/popular'
 * @param {Object} params - query string tambahan, contoh: { page: 2 }
 * @returns {Promise<Object>} data JSON dari TMDB
 */
async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');

  // tambahkan semua parameter tambahan ke query string
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    // dilempar sebagai error supaya bisa ditangkap dengan try/catch di pemanggil
    throw new Error(`TMDB request gagal (status ${response.status})`);
  }

  return response.json();
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
 * Mengambil daftar film dengan filter genre & urutan (dipakai di movies.html).
 * @param {Object} options - { page, genreId, sortBy }
 */
function fetchMoviesByFilter({ page = 1, genreId = '', sortBy = 'popularity.desc' } = {}) {
  return tmdbFetch('/discover/movie', {
    page,
    with_genres: genreId,
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

function fetchTVByFilter({ page = 1, genreId = '', sortBy = 'popularity.desc' } = {}) {
  return tmdbFetch('/discover/tv', {
    page,
    with_genres: genreId,
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

function searchMulti(query, page = 1) {
  return tmdbFetch('/search/multi', { query, page });
}
