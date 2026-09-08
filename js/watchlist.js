/* =========================================================
   CINEVRA — js/watchlist.js
   Logic untuk watchlist.html.
   Semua datanya dari localStorage (lihat getWatchlist() di main.js),
   TIDAK ada fetch ke TMDB di halaman ini.
   ========================================================= */

let activeFilter = 'all'; // 'all' | 'movie' | 'tv'

document.addEventListener('DOMContentLoaded', () => {
  renderWatchlistPage();
  bindTabs();
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
 * Mengambil data watchlist dari localStorage, lalu merender
 * grid + counter tab + empty state sesuai filter yang aktif.
 */
function renderWatchlistPage() {
  const list = getWatchlist();

  // update angka di tiap tab
  document.getElementById('countAll').textContent = list.length;
  document.getElementById('countMovies').textContent = list.filter((i) => i.type === 'movie').length;
  document.getElementById('countTV').textContent = list.filter((i) => i.type === 'tv').length;

  document.getElementById('watchlistSubtitle').textContent =
    list.length > 0 ? `${list.length} judul tersimpan` : 'Film dan TV Show yang kamu simpan';

  const filtered = activeFilter === 'all' ? list : list.filter((i) => i.type === activeFilter);

  const grid = document.getElementById('watchlistGrid');
  const emptyState = document.getElementById('emptyState');
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
 * Menyesuaikan pesan empty state: beda teks kalau watchlist
 * benar-benar kosong vs cuma tab filter-nya yang kosong.
 */
function updateEmptyStateText(isTrulyEmpty) {
  const title = document.getElementById('emptyTitle');
  const desc = document.getElementById('emptyDesc');

  if (isTrulyEmpty) {
    title.textContent = 'Watchlist kamu masih kosong';
    desc.textContent = 'Mulai jelajahi film dan TV show, lalu tekan ikon bookmark buat menyimpannya di sini.';
  } else {
    title.textContent = `Belum ada ${activeFilter === 'movie' ? 'movie' : 'TV show'} di watchlist`;
    desc.textContent = 'Coba pindah ke tab lain, atau tambah lebih banyak judul dari halaman Movies/TV Shows.';
  }
}

/**
 * Membuat satu kartu watchlist. Mirip createMovieCard() di main.js,
 * tapi tombolnya khusus "Remove" (bukan toggle add/remove) karena
 * di halaman ini semua item yang ditampilkan sudah pasti tersimpan.
 */
function renderWatchlistCard(item) {
  const card = document.createElement('article');
  card.className = 'movie-card';

  const posterWrap = document.createElement('div');
  posterWrap.className = 'movie-card__poster-wrap';

  const poster = item.posterPath ? getImageUrl(item.posterPath, 'posterSmall') : null;

  if (poster) {
    const img = document.createElement('img');
    img.src = poster;
    img.alt = `Poster ${item.title}`; // aman: properti .alt, bukan innerHTML
    img.loading = 'lazy';
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
  meta.textContent = item.year || '—';

  card.appendChild(posterWrap);
  card.appendChild(title);
  card.appendChild(meta);

  // klik poster/judul -> buka halaman detail
  posterWrap.addEventListener('click', (e) => {
    if (e.target.closest('.movie-card__remove-btn')) return; // jangan buka detail kalau yang diklik tombol remove
    window.location.href = `detail.html?id=${item.id}&type=${item.type}`;
  });
  title.addEventListener('click', () => {
    window.location.href = `detail.html?id=${item.id}&type=${item.type}`;
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
