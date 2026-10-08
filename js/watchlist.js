/* =========================================================
  CINEVRA - js/watchlist.js
   Logic untuk watchlist.html.
   Semua datanya dari localStorage (lihat getWatchlist() dan
   getCustomLists() di main.js), TIDAK ada fetch ke TMDB di halaman ini.
   Halaman ini nampilin satu daftar dalam satu waktu, yaitu watchlist
   utama atau salah satu daftar buatan user (dipilih lewat ?list=id).
   ========================================================= */

let activeFilter = 'all'; // 'all' | 'movie' | 'tv'
let activeStatus = 'all'; // 'all' | 'watched' | 'unwatched'
let activeSort = 'added-desc';
let searchQuery = '';
const DEFAULT_LIST_ID = 'watchlist';
let activeListId = DEFAULT_LIST_ID;

document.addEventListener('DOMContentLoaded', () => {
  const requested = new URLSearchParams(window.location.search).get('list');
  if (requested && getCustomList(requested)) activeListId = requested;

  renderListSwitcher();
  renderWatchlistPage();
  bindTabs();
  bindControls();
  bindListActions();
});

function isDefaultList() {
  return activeListId === DEFAULT_LIST_ID;
}

/**
 * Item dari daftar yang lagi dibuka. Kalau daftarnya ternyata sudah
 * gak ada (misal baru dihapus), balik ke watchlist utama.
 */
function getActiveItems() {
  if (isDefaultList()) return getWatchlist();
  const list = getCustomList(activeListId);
  if (list) return list.items;
  switchList(DEFAULT_LIST_ID);
  return getWatchlist();
}

function switchList(listId) {
  activeListId = listId;
  activeStatus = 'all';
  document.getElementById('watchlistStatusFilter').value = 'all';

  // URL ikut diubah biar daftar yang dibuka bisa di-bookmark atau dibagi
  const url = new URL(window.location.href);
  if (listId === DEFAULT_LIST_ID) url.searchParams.delete('list');
  else url.searchParams.set('list', listId);
  history.replaceState(null, '', url);

  renderListSwitcher();
  renderWatchlistPage();
}

/**
 * Baris tombol buat pindah antar daftar, plus tombol "New list".
 */
function renderListSwitcher() {
  const switcher = document.getElementById('listSwitcher');
  switcher.innerHTML = '';

  const entries = [
    { id: DEFAULT_LIST_ID, name: 'Watchlist', count: getWatchlist().length },
    ...getCustomLists().map((list) => ({ id: list.id, name: list.name, count: list.items.length })),
  ];

  entries.forEach((entry) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `list-chip${entry.id === activeListId ? ' is-active' : ''}`;
    btn.setAttribute('aria-pressed', String(entry.id === activeListId));

    const name = document.createElement('span');
    name.className = 'list-chip__name';
    name.textContent = entry.name;

    const count = document.createElement('span');
    count.className = 'list-chip__count';
    count.textContent = entry.count;

    btn.appendChild(name);
    btn.appendChild(count);
    btn.addEventListener('click', () => switchList(entry.id));
    switcher.appendChild(btn);
  });

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'list-chip list-chip--new';
  newBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  newBtn.appendChild(document.createTextNode('New list'));
  newBtn.addEventListener('click', handleCreateList);
  switcher.appendChild(newBtn);
}

function handleCreateList() {
  openNameDialog({
    title: 'New list',
    confirmLabel: 'Create',
    onSubmit: (name) => {
      const result = createCustomList(name);
      if (result.error) return result.error;
      switchList(result.list.id);
      return null;
    },
  });
}

/**
 * Tombol Rename dan Delete di header, cuma tampil untuk daftar buatan user.
 */
function bindListActions() {
  document.getElementById('renameListBtn').addEventListener('click', () => {
    const list = getCustomList(activeListId);
    if (!list) return;

    openNameDialog({
      title: 'Rename list',
      initial: list.name,
      confirmLabel: 'Save',
      onSubmit: (name) => {
        const result = renameCustomList(list.id, name);
        if (result.error) return result.error;
        renderListSwitcher();
        renderWatchlistPage();
        return null;
      },
    });
  });

  document.getElementById('deleteListBtn').addEventListener('click', () => {
    const list = getCustomList(activeListId);
    if (!list) return;

    const snapshot = deleteCustomList(list.id);
    switchList(DEFAULT_LIST_ID);

    // sama kayak Clear All, ada Undo supaya gak hilang permanen kalau kepencet
    showToast(`"${list.name}" deleted`, {
      actionLabel: 'Undo',
      duration: 5000,
      onAction: () => {
        restoreCustomLists(snapshot);
        switchList(list.id);
        showToast('List restored');
      },
    });
  });
}

function bindTabs() {
  const tabs = Array.from(document.querySelectorAll('.watchlist-tab'));

  function activateTab(tab) {
    tabs.forEach((t) => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected', 'false');
      t.tabIndex = -1;
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    tab.tabIndex = 0;

    activeFilter = tab.dataset.filter;
    renderWatchlistPage();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));

    // navigasi panah kiri/kanan antar tab, pola standar ARIA tablist
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
      activateTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
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
  const list = getActiveItems();
  const customList = isDefaultList() ? null : getCustomList(activeListId);
  renderListSwitcher();

  document.getElementById('watchlistTitle').textContent = customList ? customList.name : 'My Watchlist';
  document.getElementById('listActions').hidden = !customList;
  // status "sudah ditonton" cuma ada di watchlist utama
  document.getElementById('watchlistStatusFilter').hidden = Boolean(customList);

  // update angka di tiap tab (angkanya tetap berdasarkan tipe saja,
  // gak ikut kepengaruh status/search, biar tab tetap jadi acuan total)
  document.getElementById('countAll').textContent = list.length;
  document.getElementById('countMovies').textContent = list.filter((i) => i.type === 'movie').length;
  document.getElementById('countTV').textContent = list.filter((i) => i.type === 'tv').length;

  document.getElementById('watchlistSubtitle').textContent =
    list.length > 0
      ? `${list.length} ${list.length === 1 ? 'title' : 'titles'} saved`
      : customList
        ? 'Movies and TV shows you put in this list'
        : 'Movies and TV shows you saved';

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
    updateEmptyStateText(list.length === 0, customList);
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
function updateEmptyStateText(isTrulyEmpty, customList) {
  const title = document.getElementById('emptyTitle');
  const desc = document.getElementById('emptyDesc');

  if (isTrulyEmpty && customList) {
    title.textContent = 'This list is empty';
    desc.textContent = 'Open any movie or TV show and tap Add to List to put it here.';
    return;
  }

  if (isTrulyEmpty) {
    title.textContent = 'Your watchlist is empty';
    desc.textContent = 'Start exploring movies and TV shows, then tap the bookmark icon to save them here.';
    return;
  }

  if (searchQuery) {
    title.textContent = `No results for "${searchQuery}"`;
    desc.textContent = 'Try another keyword, or clear the search to see all titles.';
    return;
  }

  title.textContent = `No ${activeFilter === 'movie' ? 'movies' : activeFilter === 'tv' ? 'TV shows' : 'titles'} here yet`;
  desc.textContent = 'Try another tab or filter, or add more titles from the Movies or TV Shows pages.';
}

/**
 * Menghapus semua item yang SEDANG TERLIHAT (sudah kena filter tab,
 * status, dan pencarian aktif), lalu nawarin "Undo" lewat toast supaya
 * gak beneran ilang permanen kalau ternyata gak sengaja.
 */
function handleClearAll() {
  const list = getActiveItems();
  let visible = activeFilter === 'all' ? list : list.filter((i) => i.type === activeFilter);
  if (activeStatus === 'watched') visible = visible.filter((i) => i.watched);
  else if (activeStatus === 'unwatched') visible = visible.filter((i) => !i.watched);
  if (searchQuery) visible = visible.filter((i) => i.title.toLowerCase().includes(searchQuery));

  if (visible.length === 0) return;

  const listId = activeListId;
  const listName = isDefaultList() ? 'Watchlist' : getCustomList(listId).name;
  const snapshot = isDefaultList() ? clearWatchlistItems(visible) : clearCustomListItems(listId, visible);
  renderWatchlistPage();

  showToast(`${visible.length} titles removed from ${listName}`, {
    actionLabel: 'Undo',
    duration: 5000,
    onAction: () => {
      if (listId === DEFAULT_LIST_ID) restoreWatchlist(snapshot);
      else restoreCustomLists(snapshot);
      renderWatchlistPage();
      showToast(`${listName} restored`);
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
  const showWatched = isDefaultList();
  card.className = `movie-card${showWatched && item.watched ? ' is-watched' : ''}`;

  const posterWrap = document.createElement('div');
  posterWrap.className = 'movie-card__poster-wrap';

  const detailUrl = `detail.html?id=${item.id}&type=${item.type}`;

  // poster dibungkus <a> asli (bukan div + click listener) supaya card bisa
  // difokus keyboard, kebaca screen reader sebagai link, dan bisa dibuka di
  // tab baru lewat ctrl/cmd-klik atau klik tengah
  const posterLink = document.createElement('a');
  posterLink.className = 'movie-card__poster-link';
  posterLink.href = detailUrl;
  posterLink.setAttribute('aria-label', item.title);

  const poster = item.posterPath ? getImageUrl(item.posterPath, 'posterSmall') : null;

  if (poster) {
    const img = document.createElement('img');
    img.src = poster;
    img.alt = ''; // dekoratif, nama link-nya udah kebaca dari aria-label di posterLink
    img.loading = 'lazy';
    attachImageFallback(img);
    posterLink.appendChild(img);
  } else {
    const noPoster = document.createElement('div');
    noPoster.className = 'movie-card__no-poster';
    noPoster.textContent = item.title;
    posterLink.appendChild(noPoster);
  }

  posterWrap.appendChild(posterLink);

  const ratingBadge = document.createElement('span');
  ratingBadge.className = 'movie-card__rating';
  ratingBadge.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  ratingBadge.appendChild(document.createTextNode(formatRating(item.rating)));
  posterWrap.appendChild(ratingBadge);

  // badge "Watched" kecil di pojok kiri atas, cuma muncul kalau statusnya aktif
  if (showWatched && item.watched) {
    const watchedBadge = document.createElement('span');
    watchedBadge.className = 'movie-card__watched-badge';
    watchedBadge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    watchedBadge.appendChild(document.createTextNode('Watched'));
    posterWrap.appendChild(watchedBadge);
  }

  const watchedBtn = document.createElement('button');
  watchedBtn.type = 'button';
  watchedBtn.className = `movie-card__watched-btn${item.watched ? ' is-active' : ''}`;
  watchedBtn.setAttribute('aria-label', item.watched ? 'Mark as unwatched' : 'Mark as watched');
  watchedBtn.setAttribute('aria-pressed', String(Boolean(item.watched)));
  watchedBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  // daftar buatan user gak punya status ditonton, tombolnya cuma ada di watchlist utama
  if (showWatched) posterWrap.appendChild(watchedBtn);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'movie-card__remove-btn';
  removeBtn.setAttribute('aria-label', showWatched ? 'Remove from Watchlist' : 'Remove from this list');
  removeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  `;
  posterWrap.appendChild(removeBtn);

  // judul juga dibungkus <a> sendiri, pola sama seperti createMovieCard() di main.js
  const titleLink = document.createElement('a');
  titleLink.className = 'movie-card__title-link';
  titleLink.href = detailUrl;

  const title = document.createElement('h3');
  title.className = 'movie-card__title';
  title.textContent = item.title;
  titleLink.appendChild(title);

  const meta = document.createElement('p');
  meta.className = 'movie-card__meta';
  meta.textContent = item.year || '-';

  card.appendChild(posterWrap);
  card.appendChild(titleLink);
  card.appendChild(meta);

  // toggle status "sudah ditonton", render ulang biar badge & posisi (kalau lagi difilter status) ikut update
  watchedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowWatched = toggleWatchedStatus(item.id, item.type);
    showToast(nowWatched ? 'Marked as watched' : 'Marked as unwatched');
    renderWatchlistPage();
  });

  // tombol remove: animasi fade-out dulu, baru dihapus dari localStorage + DOM
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    card.classList.add('is-removing');
    setTimeout(() => {
      if (showWatched) removeFromWatchlist(item.id, item.type);
      else removeFromCustomList(activeListId, item.id, item.type);
      showToast(showWatched ? 'Removed from Watchlist' : 'Removed from list');
      renderWatchlistPage(); // render ulang supaya counter & empty state ikut update
    }, 200);
  });

  return card;
}
