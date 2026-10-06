/* =========================================================
  CINEVRA - js/search.js
   Logic khusus untuk search.html:
   - baca query "?q=" dan tab "?tab=" dari URL (dikirim dari navbar search)
   - tab Semua / Film / TV / Orang, masing-masing punya endpoint sendiri
   - jumlah hasil per tab ditampilkan di label tab
   - tombol "Load More" buat nambah halaman di tab yang aktif
   ========================================================= */

const SEARCH_TABS = ['all', 'movie', 'tv', 'person'];

const searchState = {
  query: '',
  tab: 'all',
  page: 1,
  totalPages: 1,
};

// nomor request terakhir, dipakai buat nolak respons lama yang telat datang
let searchRequestId = 0;
let countsRequestId = 0;

function syncSearchQueryState() {
  const params = new URLSearchParams();
  if (searchState.query) params.set('q', searchState.query);
  if (searchState.tab !== 'all') params.set('tab', searchState.tab);

  const queryString = params.toString();
  const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  searchState.query = (params.get('q') || '').trim();
  const urlTab = params.get('tab');
  if (SEARCH_TABS.includes(urlTab)) searchState.tab = urlTab;

  bindSearchEvents();
  applyQueryToPage();
  runSearch();
});

/**
 * Menyamakan judul halaman, kotak search di halaman, dan kotak search
 * di navbar dengan query yang lagi aktif.
 */
function applyQueryToPage() {
  const { query } = searchState;
  const pageInput = document.getElementById('pageSearchInput');
  const clearBtn = document.getElementById('pageSearchClearBtn');
  const navInput = document.querySelector('.navbar__search input');

  if (pageInput) pageInput.value = query;
  if (clearBtn) clearBtn.hidden = !query;
  if (navInput) navInput.value = query;

  document.getElementById('searchTitle').textContent = query ? `Hasil untuk "${query}"` : 'Hasil pencarian';
  document.getElementById('searchSubtitle').textContent = query
    ? 'Film, serial TV, dan orang yang cocok dengan kata kunci kamu'
    : 'Cari film, serial TV, dan aktor sekaligus';
  document.title = query ? `"${query}" - Search - Cinevra` : 'Search - Cinevra';
}

function setActiveTab(tab, { focus = false } = {}) {
  document.querySelectorAll('.search-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
    btn.tabIndex = isActive ? 0 : -1;
    if (isActive && focus) btn.focus();
  });
}

function bindSearchEvents() {
  const tabs = document.getElementById('searchTabs');
  const pageInput = document.getElementById('pageSearchInput');
  const clearBtn = document.getElementById('pageSearchClearBtn');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  setActiveTab(searchState.tab);

  tabs.addEventListener('click', (event) => {
    const btn = event.target.closest('.search-tab');
    if (!btn || btn.dataset.tab === searchState.tab) return;
    switchTab(btn.dataset.tab);
  });

  // navigasi keyboard antar tab pakai panah kiri/kanan, Home, dan End
  tabs.addEventListener('keydown', (event) => {
    const index = SEARCH_TABS.indexOf(searchState.tab);
    let next = null;
    if (event.key === 'ArrowRight') next = SEARCH_TABS[(index + 1) % SEARCH_TABS.length];
    if (event.key === 'ArrowLeft') next = SEARCH_TABS[(index - 1 + SEARCH_TABS.length) % SEARCH_TABS.length];
    if (event.key === 'Home') next = SEARCH_TABS[0];
    if (event.key === 'End') next = SEARCH_TABS[SEARCH_TABS.length - 1];
    if (!next) return;
    event.preventDefault();
    switchTab(next, { focus: true });
  });

  let searchTimer = null;
  pageInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => changeQuery(pageInput.value.trim()), 300);
  });

  clearBtn.addEventListener('click', () => {
    pageInput.value = '';
    changeQuery('');
    pageInput.focus();
  });

  loadMoreBtn.addEventListener('click', () => {
    searchState.page += 1;
    loadResults({ reset: false });
  });
}

function switchTab(tab, options) {
  searchState.tab = tab;
  searchState.page = 1;
  setActiveTab(tab, options);
  syncSearchQueryState();
  loadResults({ reset: true });
}

function changeQuery(query) {
  if (query === searchState.query) return;
  searchState.query = query;
  searchState.page = 1;
  syncSearchQueryState();
  applyQueryToPage();
  runSearch();
}

/**
 * Titik masuk tiap kali query berubah. Ambil jumlah hasil buat semua tab
 * dan muat hasil di tab yang lagi aktif.
 */
function runSearch() {
  loadCounts();
  loadResults({ reset: true });
}

function fetchSearchPage(tab, query, page) {
  if (tab === 'movie') return searchMovies(query, page);
  if (tab === 'tv') return searchTV(query, page);
  if (tab === 'person') return searchPeople(query, page);
  return searchMulti(query, page);
}

/**
 * Mengisi angka di label tab. Request-nya sama dengan halaman pertama
 * tiap tab, jadi hasilnya ikut ke-cache dan pindah tab terasa instan.
 */
async function loadCounts() {
  countsRequestId += 1;
  const requestId = countsRequestId;
  const { query } = searchState;

  document.querySelectorAll('.search-tab__count').forEach((el) => {
    el.textContent = '';
  });
  if (!query) return;

  const results = await Promise.allSettled(SEARCH_TABS.map((tab) => fetchSearchPage(tab, query, 1)));

  // query berubah selagi nunggu, jangan timpa angka milik pencarian baru
  if (requestId !== countsRequestId) return;

  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    const el = document.querySelector(`.search-tab__count[data-count="${SEARCH_TABS[index]}"]`);
    if (el) el.textContent = (result.value.total_results || 0).toLocaleString('id-ID');
  });
}

function buildResultCard(item, tab) {
  const mediaType = tab === 'all' ? item.media_type : tab;

  if (mediaType === 'person') {
    return createPersonCard({
      id: item.id,
      name: item.name,
      profilePath: item.profile_path,
      department: item.known_for_department,
    });
  }

  if (mediaType === 'movie') {
    return createMovieCard({
      id: item.id,
      type: 'movie',
      title: item.title,
      posterPath: item.poster_path,
      rating: item.vote_average,
      year: formatYear(item.release_date),
    });
  }

  if (mediaType === 'tv') {
    return createMovieCard({
      id: item.id,
      type: 'tv',
      title: item.name,
      posterPath: item.poster_path,
      rating: item.vote_average,
      year: formatYear(item.first_air_date),
    });
  }

  return null;
}

function showEmptyState(title, desc) {
  document.getElementById('emptyTitle').textContent = title;
  document.getElementById('emptyDesc').textContent = desc;
  document.getElementById('emptyState').style.display = 'flex';
}

/**
 * Mengambil hasil buat tab yang aktif lalu merender ke grid.
 * @param {Object} options - { reset: boolean } reset=true artinya grid dikosongkan dulu
 */
async function loadResults({ reset }) {
  const grid = document.getElementById('searchGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const emptyState = document.getElementById('emptyState');

  const { query, tab } = searchState;
  searchRequestId += 1;
  const requestId = searchRequestId;
  const currentPage = searchState.page;

  emptyState.style.display = 'none';

  if (!query) {
    grid.innerHTML = '';
    loadMoreBtn.style.display = 'none';
    showEmptyState('Mulai mencari', 'Ketik judul film, serial TV, atau nama aktor di kotak pencarian.');
    return;
  }

  showPageProgress();
  loadMoreBtn.textContent = 'Loading...';
  loadMoreBtn.disabled = true;
  if (reset) {
    loadMoreBtn.style.display = 'none';
    renderCardSkeletons(grid, 10);
  }

  try {
    const data = await fetchSearchPage(tab, query, searchState.page);

    // ada pencarian atau pindah tab yang lebih baru, hasil ini sudah usang
    if (requestId !== searchRequestId) return;

    searchState.totalPages = data.total_pages || 1;
    if (reset) grid.innerHTML = '';

    const items = data.results || [];
    let rendered = 0;

    items.forEach((item, index) => {
      const card = buildResultCard(item, tab);
      if (!card) return;
      grid.appendChild(card);
      observeReveal(card, index % 10);
      rendered += 1;
    });

    if (reset && rendered === 0) {
      showEmptyState('Tidak ada hasil', `Tidak ada yang cocok dengan "${query}" di tab ini. Coba kata kunci lain atau pindah tab.`);
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.style.display = searchState.page >= searchState.totalPages ? 'none' : 'inline-flex';
    }
  } catch (error) {
    console.error('Gagal mencari:', error);
    if (requestId !== searchRequestId) return;

    if (reset) {
      grid.innerHTML = '';
      showEmptyState('Gagal memuat data', 'Terjadi masalah saat mengambil data dari TMDB. Periksa API key atau koneksi internet kamu.');
    } else {
      // loadMore gagal, kembalikan page ke yang sebelumnya biar gak kelewat
      searchState.page = currentPage - 1;
      loadMoreBtn.style.display = 'inline-flex';
    }
  } finally {
    if (requestId === searchRequestId) {
      loadMoreBtn.textContent = 'Load More';
      loadMoreBtn.disabled = false;
      hidePageProgress();
    }
  }
}
