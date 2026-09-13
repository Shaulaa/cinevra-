/* =========================================================
  CINEVRA - js/tv-shows.js
   Logic khusus untuk tv-shows.html.
   Strukturnya mirip movies.js, bedanya:
   - pakai endpoint TMDB untuk TV (/discover/tv, /genre/tv/list)
   - field judul & tanggal TV Show namanya "name" & "first_air_date"
     (bukan "title" & "release_date" seperti di movie)
   ========================================================= */

const tvState = {
  page: 1,
  totalPages: 1,
  genreIds: [],
  year: '',
  sortBy: 'popularity.desc',
  searchQuery: '',
};

function syncTVQueryState() {
  const params = new URLSearchParams();
  if (tvState.searchQuery) params.set('search', tvState.searchQuery);
  if (tvState.genreIds.length) params.set('genre', tvState.genreIds.join(','));
  if (tvState.year) params.set('year', tvState.year);
  if (tvState.sortBy && tvState.sortBy !== 'popularity.desc') params.set('sort', tvState.sortBy);

  const queryString = params.toString();
  const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  tvState.searchQuery = params.get('search') || '';
  const urlGenre = params.get('genre');
  if (urlGenre) tvState.genreIds = urlGenre.split(',').filter(Boolean);
  tvState.year = params.get('year') || '';
  tvState.sortBy = params.get('sort') || 'popularity.desc';

  setupTVSearchMode();
  initGenreMultiSelect({
    fetchGenres: fetchTVGenres,
    initialIds: tvState.genreIds,
    onChange: (ids) => {
      tvState.genreIds = ids;
      tvState.page = 1;
      syncTVQueryState();
      loadTVShows({ reset: true });
    },
  });
  populateYearFilter(document.getElementById('yearFilter'));
  bindTVFilterEvents();
  loadTVShows({ reset: true });
  loadListHeroBackdrop();

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  loadMoreBtn.addEventListener('click', () => {
    tvState.page += 1;
    loadTVShows({ reset: false });
  });
  initInfiniteScroll(loadMoreBtn);
});

/**
 * Mengisi backdrop di banner atas halaman dengan gambar dari
 * salah satu TV show trending.
 */
async function loadListHeroBackdrop() {
  try {
    const data = await fetchTrendingTV('week');
    const show = (data.results || []).find((s) => s.backdrop_path);
    if (!show) return;

    const hero = document.getElementById('listHero');
    const backdrop = document.createElement('div');
    backdrop.className = 'list-hero__backdrop';
    const img = document.createElement('img');
    img.src = getImageUrl(show.backdrop_path, 'backdrop');
    img.alt = '';
    attachImageFallback(img);
    backdrop.appendChild(img);
    hero.prepend(backdrop);
  } catch (error) {
    console.error('Gagal memuat backdrop hero:', error);
  }
}

function setupTVSearchMode() {
  const pageSearchInput = document.getElementById('pageSearchInput');
  const pageSearchClearBtn = document.getElementById('pageSearchClearBtn');
  const isSearchActive = Boolean(tvState.searchQuery);

  if (pageSearchInput) {
    pageSearchInput.value = tvState.searchQuery;
  }

  if (pageSearchClearBtn) {
    pageSearchClearBtn.hidden = !isSearchActive;
  }

  if (!isSearchActive) {
    document.getElementById('pageTitle').textContent = 'Popular TV Shows';
    document.getElementById('pageSubtitle').textContent = 'Jelajahi serial TV dari seluruh dunia, dari drama sampai animasi';
    return;
  }

  document.getElementById('pageTitle').textContent = 'Search results';
  document.getElementById('pageSubtitle').textContent = `Menampilkan hasil untuk "${tvState.searchQuery}"`;

  document.getElementById('genreToggle').disabled = true;
  document.getElementById('yearFilter').disabled = true;
  document.getElementById('sortFilter').disabled = true;

  const searchInput = document.querySelector('.navbar__search input');
  if (searchInput) searchInput.value = tvState.searchQuery;
}

function bindTVFilterEvents() {
  const pageSearchInput = document.getElementById('pageSearchInput');
  const pageSearchClearBtn = document.getElementById('pageSearchClearBtn');

  if (pageSearchInput) {
    let searchTimer = null;
    pageSearchInput.addEventListener('input', () => {
      const nextQuery = pageSearchInput.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        tvState.searchQuery = nextQuery;
        tvState.page = 1;
        syncTVQueryState();
        setupTVSearchMode();
        loadTVShows({ reset: true });
      }, 300);
    });
  }

  if (pageSearchClearBtn) {
    pageSearchClearBtn.addEventListener('click', () => {
      tvState.searchQuery = '';
      if (pageSearchInput) pageSearchInput.value = '';
      tvState.page = 1;
      syncTVQueryState();
      setupTVSearchMode();
      loadTVShows({ reset: true });
    });
  }

  document.getElementById('yearFilter').addEventListener('change', (e) => {
    tvState.year = e.target.value;
    tvState.page = 1;
    syncTVQueryState();
    loadTVShows({ reset: true });
  });

  document.getElementById('sortFilter').addEventListener('change', (e) => {
    tvState.sortBy = e.target.value;
    tvState.page = 1;
    syncTVQueryState();
    loadTVShows({ reset: true });
  });
}

async function loadTVShows({ reset }) {
  const grid = document.getElementById('tvGrid');
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
    const data = tvState.searchQuery
      ? await searchTV(tvState.searchQuery, tvState.page)
      : await fetchTVByFilter({
          page: tvState.page,
          genreId: tvState.genreIds.join('|'),
          year: tvState.year,
          sortBy: tvState.sortBy,
        });

    tvState.totalPages = data.total_pages || 1;

    if (reset) grid.innerHTML = '';

    const results = data.results || [];

    if (reset && results.length === 0) {
      emptyState.style.display = 'flex';
      loadMoreBtn.style.display = 'none';
    } else {
      results.forEach((show, index) => {
        const card = createMovieCard({
          id: show.id,
          type: 'tv',
          title: show.name,
          posterPath: show.poster_path,
          rating: show.vote_average,
          year: formatYear(show.first_air_date),
        });
        grid.appendChild(card);
        observeReveal(card, index % 10);
      });
      loadMoreBtn.style.display = tvState.page >= tvState.totalPages ? 'none' : 'inline-flex';
    }

    document.getElementById('resultCount').textContent =
      data.total_results !== undefined ? `${data.total_results.toLocaleString('id-ID')} TV shows found` : '';

    const pageSearchInput = document.getElementById('pageSearchInput');
    if (pageSearchInput && tvState.searchQuery) {
      pageSearchInput.value = tvState.searchQuery;
    }
  } catch (error) {
    console.error('Gagal memuat TV shows:', error);
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
