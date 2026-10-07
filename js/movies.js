/* =========================================================
  CINEVRA - js/movies.js
   Logic khusus untuk movies.html:
   - ambil daftar genre buat filter dropdown
   - baca query "?search=" dan "?list=" dari URL (list dikirim dari See all di home)
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
  list: '', // kategori dari tombol See all di home ('trending' atau 'now_playing')
};

// kategori yang pakai endpoint TMDB sendiri, jadi filter genre/tahun/sort gak berlaku
const MOVIE_LISTS = {
  trending: {
    title: 'Trending Movies',
    subtitle: 'Movies everyone is watching this week',
  },
  now_playing: {
    title: 'Now Playing in Theaters',
    subtitle: 'Movies currently showing in theaters',
  },
};

/**
 * Menentukan judul dan subjudul banner sesuai kondisi halaman
 * (hasil pencarian, kategori dari See all, urutan rating, atau semua film).
 */
function getMovieHeading() {
  if (movieState.searchQuery) {
    return { title: 'Search results', subtitle: `Showing results for "${movieState.searchQuery}"` };
  }
  if (MOVIE_LISTS[movieState.list]) return MOVIE_LISTS[movieState.list];
  if (movieState.sortBy === 'vote_average.desc') {
    return { title: 'Top Rated Movies', subtitle: 'The highest rated movies, limited to titles with enough votes' };
  }
  return {
    title: 'All Movies',
    subtitle: 'Explore thousands of movies from around the world, from current hits to timeless classics',
  };
}

function syncMovieQueryState() {
  const params = new URLSearchParams();
  if (movieState.searchQuery) params.set('search', movieState.searchQuery);
  if (!movieState.searchQuery && movieState.list) params.set('list', movieState.list);
  if (movieState.genreIds.length) params.set('genre', movieState.genreIds.join(','));
  if (movieState.year) params.set('year', movieState.year);
  if (movieState.sortBy && movieState.sortBy !== 'popularity.desc') params.set('sort', movieState.sortBy);

  const queryString = params.toString();
  const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  movieState.searchQuery = params.get('search') || '';
  const urlGenre = params.get('genre');
  if (urlGenre) movieState.genreIds = urlGenre.split(',').filter(Boolean);
  movieState.year = params.get('year') || '';
  movieState.sortBy = params.get('sort') || 'popularity.desc';
  const urlList = params.get('list');
  if (MOVIE_LISTS[urlList]) movieState.list = urlList;

  setupSearchMode();
  initGenreMultiSelect({
    fetchGenres: fetchMovieGenres,
    initialIds: movieState.genreIds,
    onChange: (ids) => {
      movieState.genreIds = ids;
      movieState.page = 1;
      syncMovieQueryState();
      loadMovies({ reset: true });
    },
  });
  populateYearFilter(document.getElementById('yearFilter'));
  // pilihan dari URL harus kelihatan di dropdown, bukan cuma masuk ke state
  document.getElementById('yearFilter').value = movieState.year;
  document.getElementById('sortFilter').value = movieState.sortBy;
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
 * Menyesuaikan banner dan filter dengan mode halaman. Kalau lagi mode
 * pencarian atau kategori (trending, now playing), filter genre/tahun/sort
 * dinonaktifkan karena endpoint TMDB-nya tidak mendukung kombinasi itu.
 */
function setupSearchMode() {
  const pageSearchInput = document.getElementById('pageSearchInput');
  const pageSearchClearBtn = document.getElementById('pageSearchClearBtn');
  const isSearchActive = Boolean(movieState.searchQuery);
  const isFilterLocked = isSearchActive || Boolean(MOVIE_LISTS[movieState.list]);

  if (pageSearchInput) {
    pageSearchInput.value = movieState.searchQuery;
    pageSearchInput.disabled = false;
  }

  if (pageSearchClearBtn) {
    pageSearchClearBtn.hidden = !isSearchActive;
  }

  const heading = getMovieHeading();
  document.getElementById('pageTitle').textContent = heading.title;
  document.getElementById('pageSubtitle').textContent = heading.subtitle;

  document.getElementById('genreToggle').disabled = isFilterLocked;
  document.getElementById('yearFilter').disabled = isFilterLocked;
  document.getElementById('sortFilter').disabled = isFilterLocked;

  const searchInput = document.querySelector('.navbar__search input');
  if (isSearchActive && searchInput) searchInput.value = movieState.searchQuery;
}

function bindFilterEvents() {
  const pageSearchInput = document.getElementById('pageSearchInput');
  const pageSearchClearBtn = document.getElementById('pageSearchClearBtn');

  if (pageSearchInput) {
    let searchTimer = null;
    pageSearchInput.addEventListener('input', () => {
      const nextQuery = pageSearchInput.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        movieState.searchQuery = nextQuery;
        movieState.list = '';
        movieState.page = 1;
        syncMovieQueryState();
        setupSearchMode();
        loadMovies({ reset: true });
      }, 300);
    });
  }

  if (pageSearchClearBtn) {
    pageSearchClearBtn.addEventListener('click', () => {
      movieState.searchQuery = '';
      movieState.list = '';
      if (pageSearchInput) pageSearchInput.value = '';
      movieState.page = 1;
      syncMovieQueryState();
      setupSearchMode();
      loadMovies({ reset: true });
    });
  }

  document.getElementById('yearFilter').addEventListener('change', (e) => {
    movieState.year = e.target.value;
    movieState.page = 1;
    syncMovieQueryState();
    loadMovies({ reset: true });
  });

  document.getElementById('sortFilter').addEventListener('change', (e) => {
    movieState.sortBy = e.target.value;
    movieState.page = 1;
    syncMovieQueryState();
    loadMovies({ reset: true });
  });
}

/**
 * Mengambil data film (dari search atau discover, tergantung state)
 * lalu merender ke grid.
 * @param {Object} options - { reset: boolean } reset=true artinya grid dikosongkan dulu
 */
// request controller untuk cancel request yang keburu usang (filter/search)
let currentMoviesController = null;

async function loadMovies({ reset }) {
  const grid = document.getElementById('moviesGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const emptyState = document.getElementById('emptyState');

  // cancel request lama kalau ada (biar respons lama gak nimpa yang baru)
  if (currentMoviesController) {
    currentMoviesController.abort();
  }
  currentMoviesController = new AbortController();

  // simpan page sebelum fetch, agar kalau loadMore gagal page tetap di halaman yang sama
  const currentPage = movieState.page;

  showPageProgress();
  emptyState.style.display = 'none';
  loadMoreBtn.textContent = 'Loading...';
  loadMoreBtn.disabled = true;

  if (reset) {
    renderCardSkeletons(grid, 10);
    // judul banner ikut kondisi terbaru (search, kategori, atau urutan rating)
    const heading = getMovieHeading();
    document.getElementById('pageTitle').textContent = heading.title;
    document.getElementById('pageSubtitle').textContent = heading.subtitle;
  }

  try {
    let data;
    if (movieState.searchQuery) {
      data = await searchMovies(movieState.searchQuery, movieState.page);
    } else if (movieState.list === 'trending') {
      data = await fetchTrendingMovies('week', movieState.page);
    } else if (movieState.list === 'now_playing') {
      data = await fetchNowPlayingMovies(movieState.page);
    } else {
      data = await fetchMoviesByFilter({
        page: movieState.page,
        genreId: movieState.genreIds.join('|'), // pipe = OR (film yang punya salah satu genre ini)
        year: movieState.year,
        sortBy: movieState.sortBy,
        signal: currentMoviesController.signal,
      });
    }

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
      data.total_results !== undefined ? `${data.total_results.toLocaleString('en-US')} movies found` : '';

    const pageSearchInput = document.getElementById('pageSearchInput');
    if (pageSearchInput && movieState.searchQuery) {
      pageSearchInput.value = movieState.searchQuery;
    }
  } catch (error) {
    console.error('Gagal memuat film:', error);
    // kalau ini bukan abort error (request sengaja dibatalkan), baru tampilkan error
    if (error.name !== 'AbortError') {
      if (reset) {
        grid.innerHTML = '';
        emptyState.style.display = 'flex';
        document.querySelector('.state-block__title').textContent = 'Failed to load data';
        document.querySelector('.state-block__desc').textContent =
          'Something went wrong while fetching data from TMDB. Check your API key or internet connection.';
      }
    }
    // kalau loadMore gagal, kembalikan page ke yang sebelumnya (jangan kelewat)
    if (!reset && error.name !== 'AbortError') {
      movieState.page = currentPage;
    }
  } finally {
    loadMoreBtn.textContent = 'Load More';
    loadMoreBtn.disabled = false;
    hidePageProgress();
    // reset controller agar bisa dipakai lagi di load berikutnya
    currentMoviesController = null;
  }
}
