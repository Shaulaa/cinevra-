/* =========================================================
  CINEVRA - js/movies.js
   Logic khusus untuk movies.html:
   - ambil daftar genre buat filter dropdown
   - baca query "?search=" dari URL (dikirim dari navbar search)
   - filter genre + sort (pakai TMDB /discover/movie)
   - tombol "Load More" buat nambah halaman
   ========================================================= */

// state halaman ini, disimpan di variabel global sederhana
const movieState = {
  page: 1,
  totalPages: 1,
  genreIds: [],
  year: '',
  sortBy: 'popularity.desc',
  searchQuery: '',
};

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  movieState.searchQuery = params.get('search') || '';
  const urlGenre = params.get('genre');
  if (urlGenre) movieState.genreIds = [urlGenre];

  setupSearchMode();
  initGenreMultiSelect({
    fetchGenres: fetchMovieGenres,
    initialIds: movieState.genreIds,
    onChange: (ids) => {
      movieState.genreIds = ids;
      movieState.page = 1;
      loadMovies({ reset: true });
    },
  });
  populateYearFilter(document.getElementById('yearFilter'));
  bindFilterEvents();
  loadMovies({ reset: true });
  loadListHeroBackdrop();

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  loadMoreBtn.addEventListener('click', () => {
    movieState.page += 1;
    loadMovies({ reset: false });
  });
  initInfiniteScroll(loadMoreBtn);
});

/**
 * Mengisi backdrop di banner atas halaman dengan gambar dari
 * salah satu film trending, biar halaman gak polos di bagian atas.
 */
async function loadListHeroBackdrop() {
  try {
    const data = await fetchTrendingMovies('week');
    const movie = (data.results || []).find((m) => m.backdrop_path);
    if (!movie) return;

    const hero = document.getElementById('listHero');
    const backdrop = document.createElement('div');
    backdrop.className = 'list-hero__backdrop';
    const img = document.createElement('img');
    img.src = getImageUrl(movie.backdrop_path, 'backdrop');
    img.alt = '';
    attachImageFallback(img);
    backdrop.appendChild(img);
    hero.prepend(backdrop);
  } catch (error) {
    console.error('Gagal memuat backdrop hero:', error);
    // gagal diam-diam aja, banner tetap tampil pakai warna solid dari CSS
  }
}

/**
 * Kalau halaman dibuka lewat pencarian (movies.html?search=...),
 * sesuaikan judul halaman & nonaktifkan filter genre/sort
 * (TMDB search endpoint tidak mendukung kombinasi filter genre).
 */
function setupSearchMode() {
  if (!movieState.searchQuery) return;

  document.getElementById('pageTitle').textContent = `Search results`;
  document.getElementById('pageSubtitle').textContent = `Menampilkan hasil untuk "${movieState.searchQuery}"`;

  document.getElementById('genreToggle').disabled = true;
  document.getElementById('yearFilter').disabled = true;
  document.getElementById('sortFilter').disabled = true;

  // isi kotak search navbar dengan query yang sedang aktif
  const searchInput = document.querySelector('.navbar__search input');
  if (searchInput) searchInput.value = movieState.searchQuery;
}

function bindFilterEvents() {
  document.getElementById('yearFilter').addEventListener('change', (e) => {
    movieState.year = e.target.value;
    movieState.page = 1;
    loadMovies({ reset: true });
  });

  document.getElementById('sortFilter').addEventListener('change', (e) => {
    movieState.sortBy = e.target.value;
    movieState.page = 1;
    loadMovies({ reset: true });
  });
}

/**
 * Mengambil data film (dari search atau discover, tergantung state)
 * lalu merender ke grid.
 * @param {Object} options - { reset: boolean } reset=true artinya grid dikosongkan dulu
 */
async function loadMovies({ reset }) {
  const grid = document.getElementById('moviesGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const emptyState = document.getElementById('emptyState');

  showPageProgress();
  emptyState.style.display = 'none';
  loadMoreBtn.textContent = 'Loading...';
  loadMoreBtn.disabled = true;

  if (reset) {
    renderCardSkeletons(grid, 10);
  }

  try {
    const data = movieState.searchQuery
      ? await searchMovies(movieState.searchQuery, movieState.page)
      : await fetchMoviesByFilter({
          page: movieState.page,
          genreId: movieState.genreIds.join('|'), // pipe = OR (film yang punya salah satu genre ini)
          year: movieState.year,
          sortBy: movieState.sortBy,
        });

    movieState.totalPages = data.total_pages || 1;

    if (reset) grid.innerHTML = '';

    const results = data.results || [];

    if (reset && results.length === 0) {
      emptyState.style.display = 'flex';
      loadMoreBtn.style.display = 'none';
    } else {
      results.forEach((movie, index) => {
        const card = createMovieCard({
          id: movie.id,
          type: 'movie',
          title: movie.title,
          posterPath: movie.poster_path,
          rating: movie.vote_average,
          year: formatYear(movie.release_date),
        });
        grid.appendChild(card);
        observeReveal(card, index % 10); // sisa bagi 10 biar delay-nya gak numpuk kelamaan pas load banyak
      });
      loadMoreBtn.style.display = movieState.page >= movieState.totalPages ? 'none' : 'inline-flex';
    }

    document.getElementById('resultCount').textContent =
      data.total_results !== undefined ? `${data.total_results.toLocaleString('id-ID')} movies found` : '';
  } catch (error) {
    console.error('Gagal memuat film:', error);
    if (reset) {
      grid.innerHTML = '';
      emptyState.style.display = 'flex';
      document.querySelector('.state-block__title').textContent = 'Gagal memuat data';
      document.querySelector('.state-block__desc').textContent =
        'Terjadi masalah saat mengambil data dari TMDB. Periksa API key atau koneksi internet kamu.';
    }
  } finally {
    loadMoreBtn.textContent = 'Load More';
    loadMoreBtn.disabled = false;
    hidePageProgress();
  }
}
