/* =========================================================
  CINEVRA - js/watchlist.js
   Logic untuk watchlist.html.
   Semua datanya dari localStorage (lihat getWatchlist() di main.js),
   TIDAK ada fetch ke TMDB di halaman ini.
   ========================================================= */

let activeFilter = 'all'; // 'all' | 'movie' | 'tv'
let activeStatus = 'all'; // 'all' | 'watched' | 'unwatched'
let activeSort = 'added-desc';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  renderWatchlistPage();
  bindTabs();
  bindControls();
});

function bindTabs() {
  document.querySelectorAll('.watchlist-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeFilter = tab.dataset.filter;

      document.querySelectorAll('.watchlist-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      renderWatchlistPage();
    });
  });
}

/**
 * Menghubungkan kotak search, dropdown status/sort, dan tombol Clear All.
 */
function bindControls() {
  const searchInput = document.getElementById('watchlistSearchInput');
  const clearSearchBtn = document.getElementById('watchlistSearchClearBtn');
  const statusFilter = document.getElementById('watchlistStatusFilter');
  const sortFilter = document.getElementById('watchlistSortFilter');
  const clearAllBtn = document.getElementById('watchlistClearAllBtn');

  const runSearch = debounce(() => {
    searchQuery = searchInput.value.trim().toLowerCase();
    clearSearchBtn.hidden = searchQuery.length === 0;
    renderWatchlistPage();
  }, 200);

  searchInput.addEventListener('input', runSearch);

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.hidden = true;
    renderWatchlistPage();
    searchInput.focus();
  });

  statusFilter.addEventListener('change', () => {
    activeStatus = statusFilter.value;
    renderWatchlistPage();
  });

  sortFilter.addEventListener('change', () => {
    activeSort = sortFilter.value;
    renderWatchlistPage();
  });

  clearAllBtn.addEventListener('click', handleClearAll);
}

/**
 * Mengurutkan array watchlist sesuai pilihan di dropdown Sort.
 * "Baru Ditambahkan" gak perlu diapa-apain karena getWatchlist() sudah
 * mengembalikan item terbaru di paling depan (lihat addToWatchlist di main.js).
 */
function sortWatchlist(list) {
  const sorted = list.slice();
  switch (activeSort) {
    case 'title-asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case 'rating-desc':
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'year-desc':
      return sorted.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
    default:
      return sorted;
  }
}

/**
 * Mengambil data watchlist dari localStorage, lalu merender
 * grid + counter tab + empty state sesuai filter, status, sort, dan
 * pencarian yang aktif.
 */
function renderWatchlistPage() {
  const list = getWatchlist();

  // update angka di tiap tab (angkanya tetap berdasarkan tipe saja,
  // gak ikut kepengaruh status/search, biar tab tetap jadi acuan total)
  document.getElementById('countAll').textContent = list.length;
  document.getElementById('countMovies').textContent = list.filter((i) => i.type === 'movie').length;
  document.getElementById('countTV').textContent = list.filter((i) => i.type === 'tv').length;

  document.getElementById('watchlistSubtitle').textContent =
    list.length > 0 ? `${list.length} judul tersimpan` : 'Film dan TV Show yang kamu simpan';

  let filtered = activeFilter === 'all' ? list : list.filter((i) => i.type === activeFilter);

  if (activeStatus === 'watched') {
    filtered = filtered.filter((i) => i.watched);
  } else if (activeStatus === 'unwatched') {
    filtered = filtered.filter((i) => !i.watched);
  }

  if (searchQuery) {
    filtered = filtered.filter((i) => i.title.toLowerCase().includes(searchQuery));
  }

  filtered = sortWatchlist(filtered);

  const grid = document.getElementById('watchlistGrid');
  const emptyState = document.getElementById('emptyState');
  const clearAllBtn = document.getElementById('watchlistClearAllBtn');
  clearAllBtn.disabled = filtered.length === 0;

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'flex';
    updateEmptyStateText(list.length === 0);
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  filtered.forEach((item, index) => {
    const card = renderWatchlistCard(item);
    grid.appendChild(card);
    observeReveal(card, index % 10);
  });
}

/**
 * Menyesuaikan pesan empty state, beda teks tergantung apakah watchlist
 * benar-benar kosong, atau cuma hasil filter/pencarian yang kosong.
 */
function updateEmptyStateText(isTrulyEmpty) {
  const title = document.getElementById('emptyTitle');
  const desc = document.getElementById('emptyDesc');

  if (isTrulyEmpty) {
    title.textContent = 'Watchlist kamu masih kosong';
    desc.textContent = 'Mulai jelajahi film dan TV show, lalu tekan ikon bookmark buat menyimpannya di sini.';
    return;
  }

  if (searchQuery) {
    title.textContent = `Tidak ada hasil untuk "${searchQuery}"`;
    desc.textContent = 'Coba kata kunci lain, atau hapus pencarian buat lihat semua judul.';
    return;
  }

  title.textContent = `Belum ada ${activeFilter === 'movie' ? 'movie' : activeFilter === 'tv' ? 'TV show' : 'judul'} di sini`;
  desc.textContent = 'Coba pindah ke tab atau filter lain, atau tambah lebih banyak judul dari halaman Movies/TV Shows.';
}

/**
 * Menghapus semua item yang SEDANG TERLIHAT (sudah kena filter tab,
 * status, dan pencarian aktif), lalu nawarin "Undo" lewat toast supaya
 * gak beneran ilang permanen kalau ternyata gak sengaja.
 */
function handleClearAll() {
  const list = getWatchlist();
  let visible = activeFilter === 'all' ? list : list.filter((i) => i.type === activeFilter);
  if (activeStatus === 'watched') visible = visible.filter((i) => i.watched);
  else if (activeStatus === 'unwatched') visible = visible.filter((i) => !i.watched);
  if (searchQuery) visible = visible.filter((i) => i.title.toLowerCase().includes(searchQuery));

  if (visible.length === 0) return;

  const snapshot = clearWatchlistItems(visible);
  renderWatchlistPage();

  showToast(`${visible.length} judul dihapus dari Watchlist`, {
    actionLabel: 'Undo',
    duration: 5000,
    onAction: () => {
      restoreWatchlist(snapshot);
      renderWatchlistPage();
      showToast('Watchlist dikembalikan');
    },
  });
}

/**
 * Membuat satu kartu watchlist. Mirip createMovieCard() di main.js,
 * tapi ada tombol "Remove" (bukan toggle add/remove, karena di halaman
 * ini semua item yang ditampilkan sudah pasti tersimpan) dan tombol
 * toggle status "sudah ditonton".
 */
function renderWatchlistCard(item) {
  const card = document.createElement('article');
  card.className = `movie-card${item.watched ? ' is-watched' : ''}`;

  const posterWrap = document.createElement('div');
  posterWrap.className = 'movie-card__poster-wrap';

  const poster = item.posterPath ? getImageUrl(item.posterPath, 'posterSmall') : null;

  if (poster) {
    const img = document.createElement('img');
    img.src = poster;
    img.alt = `Poster ${item.title}`; // aman: properti .alt, bukan innerHTML
    img.loading = 'lazy';
    attachImageFallback(img);
    posterWrap.appendChild(img);
  } else {
    const noPoster = document.createElement('div');
    noPoster.className = 'movie-card__no-poster';
    noPoster.textContent = item.title;
    posterWrap.appendChild(noPoster);
  }

  const ratingBadge = document.createElement('span');
  ratingBadge.className = 'movie-card__rating';
  ratingBadge.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  ratingBadge.appendChild(document.createTextNode(formatRating(item.rating)));
  posterWrap.appendChild(ratingBadge);

  // badge "Watched" kecil di pojok kiri atas, cuma muncul kalau statusnya aktif
  if (item.watched) {
    const watchedBadge = document.createElement('span');
    watchedBadge.className = 'movie-card__watched-badge';
    watchedBadge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    watchedBadge.appendChild(document.createTextNode('Watched'));
    posterWrap.appendChild(watchedBadge);
  }

  const watchedBtn = document.createElement('button');
  watchedBtn.type = 'button';
  watchedBtn.className = `movie-card__watched-btn${item.watched ? ' is-active' : ''}`;
  watchedBtn.setAttribute('aria-label', item.watched ? 'Tandai belum ditonton' : 'Tandai sudah ditonton');
  watchedBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  posterWrap.appendChild(watchedBtn);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'movie-card__remove-btn';
  removeBtn.setAttribute('aria-label', 'Hapus dari Watchlist');
  removeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  `;
  posterWrap.appendChild(removeBtn);

  const title = document.createElement('h3');
  title.className = 'movie-card__title';
  title.textContent = item.title;

  const meta = document.createElement('p');
  meta.className = 'movie-card__meta';
  meta.textContent = item.year || '-';

  card.appendChild(posterWrap);
  card.appendChild(title);
  card.appendChild(meta);

  // klik poster/judul -> buka halaman detail
  posterWrap.addEventListener('click', (e) => {
    if (e.target.closest('.movie-card__remove-btn') || e.target.closest('.movie-card__watched-btn')) return;
    window.location.href = `detail.html?id=${item.id}&type=${item.type}`;
  });
  title.addEventListener('click', () => {
    window.location.href = `detail.html?id=${item.id}&type=${item.type}`;
  });

  // toggle status "sudah ditonton", render ulang biar badge & posisi (kalau lagi difilter status) ikut update
  watchedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowWatched = toggleWatchedStatus(item.id, item.type);
    showToast(nowWatched ? 'Ditandai sudah ditonton' : 'Ditandai belum ditonton');
    renderWatchlistPage();
  });

  // tombol remove: animasi fade-out dulu, baru dihapus dari localStorage + DOM
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    card.classList.add('is-removing');
    setTimeout(() => {
      removeFromWatchlist(item.id, item.type);
      showToast('Dihapus dari Watchlist');
      renderWatchlistPage(); // render ulang supaya counter & empty state ikut update
    }, 200);
  });

  return card;
}
