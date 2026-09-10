/* =========================================================
  CINEVRA - js/main.js
   Kode yang dipakai bersama di SEMUA halaman:
   - navbar (menu mobile + link aktif)
   - watchlist (simpan/hapus/cek via localStorage)
   - toast notifikasi kecil
   - fungsi format (tahun, runtime, rating)
   - navbar search -> redirect ke movies.html?search=...

   File ini di-load DUA sebelum home.js/movies.js/dst,
   supaya fungsi-fungsi di bawah bisa langsung dipakai.
   ========================================================= */

const WATCHLIST_STORAGE_KEY = 'cinevra_watchlist';
const RECENTLY_VIEWED_KEY = 'cinevra_recently_viewed';
const RECENTLY_VIEWED_MAX = 15;
const INFINITE_SCROLL_STORAGE_KEY = 'cinevra_infinite_scroll';

/* =========================================================
   NAVBAR
   ========================================================= */

/**
 * Membuka/menutup menu navbar versi mobile (hamburger).
 */
function initNavbarToggle() {
  const toggleBtn = document.getElementById('navToggle');
  const links = document.querySelector('.navbar__links');
  const backdrop = document.getElementById('navBackdrop');
  if (!toggleBtn || !links) return;

  toggleBtn.addEventListener('click', () => {
    const opening = !links.classList.contains('is-open');
    closeMobileSearch(); // biar cuma satu panel yang kebuka dalam satu waktu
    links.classList.toggle('is-open', opening);
    toggleBtn.classList.toggle('is-open', opening);
    toggleBtn.setAttribute('aria-expanded', String(opening));
    updateNavBackdrop();
  });

  // tutup menu saat salah satu link diklik (khusus tampilan mobile)
  links.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMobileMenu());
  });

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeMobileMenu();
      closeMobileSearch();
    });
  }
}

function closeMobileMenu() {
  const toggleBtn = document.getElementById('navToggle');
  const links = document.querySelector('.navbar__links');
  if (!toggleBtn || !links) return;
  links.classList.remove('is-open');
  toggleBtn.classList.remove('is-open');
  toggleBtn.setAttribute('aria-expanded', 'false');
  updateNavBackdrop();
}

function closeMobileSearch() {
  const form = document.querySelector('.navbar__search');
  if (!form) return;
  form.classList.remove('is-mobile-open');
  updateNavBackdrop();
}

/**
 * Backdrop gelap cuma nyala kalau salah satu dari menu hamburger
 * atau search mobile lagi kebuka.
 */
function updateNavBackdrop() {
  const backdrop = document.getElementById('navBackdrop');
  if (!backdrop) return;
  const links = document.querySelector('.navbar__links');
  const search = document.querySelector('.navbar__search');
  const anyOpen =
    (links && links.classList.contains('is-open')) ||
    (search && search.classList.contains('is-mobile-open'));
  backdrop.classList.toggle('is-open', Boolean(anyOpen));
}

/**
 * Tombol search khusus tampilan mobile: buka/tutup search bar
 * yang melayang di bawah navbar (di desktop, search box selalu tampil
 * jadi tombol ini disembunyikan lewat CSS).
 */
function initMobileSearchToggle() {
  const btn = document.getElementById('mobileSearchBtn');
  const form = document.querySelector('.navbar__search');
  const closeBtn = document.getElementById('searchCloseBtn');
  if (!btn || !form) return;

  const input = form.querySelector('input');
  const resultsBox = form.querySelector('.navbar__search-results');

  btn.addEventListener('click', () => {
    const opening = !form.classList.contains('is-mobile-open');
    closeMobileMenu(); // biar cuma satu panel yang kebuka dalam satu waktu
    form.classList.toggle('is-mobile-open', opening);
    updateNavBackdrop();

    if (opening && input) {
      setTimeout(() => input.focus(), 60); // nunggu transisi buka kelar dulu
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeMobileSearch();
      if (input) input.value = '';
      if (resultsBox) {
        resultsBox.classList.remove('is-open');
        resultsBox.innerHTML = '';
      }
    });
  }
}

/**
 * Menandai link navbar yang sesuai dengan halaman saat ini
 * dengan class "is-active" (dibaca dari nama file di URL).
 */
function highlightActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar__links a[data-page]').forEach((link) => {
    if (link.dataset.page === currentPage) {
      link.classList.add('is-active');
    }
  });
}

/**
 * Menghubungkan kotak search di navbar:
 * - ketik 2+ huruf -> muncul dropdown hasil pencarian live (debounced)
 * - tekan Enter / klik "Lihat semua hasil" -> pindah ke movies.html?search=...
 * - klik salah satu hasil -> langsung ke halaman detail/person yang sesuai
 */
function initNavbarSearch() {
  const form = document.querySelector('.navbar__search');
  if (!form) return;

  const input = form.querySelector('input');
  const resultsBox = form.querySelector('.navbar__search-results');
  if (!input || !resultsBox) return;

  // nyimpen AbortController request yang lagi jalan, supaya kalau user
  // ngetik lagi sebelum request sebelumnya selesai, request lama itu
  // dibatalin duluan (biar hasilnya gak balapan/numpuk dan kerasa lebih responsif)
  let activeController = null;

  const runSearch = debounce(async (query) => {
    if (activeController) activeController.abort();

    if (query.length < 2) {
      resultsBox.classList.remove('is-open');
      resultsBox.innerHTML = '';
      return;
    }

    // kasih feedback instan duluan, sebelum data-nya beneran datang,
    // biar gak kerasa "diem" nunggu tanpa kejelasan
    showSearchLoading(resultsBox);

    activeController = new AbortController();

    try {
      const data = await searchMulti(query, 1, activeController.signal);
      renderSearchDropdown(resultsBox, data.results || [], query);
    } catch (error) {
      if (error.name === 'AbortError') return; // request ini emang sengaja dibatalin, bukan error beneran
      console.error('Gagal mencari:', error);
      resultsBox.innerHTML = `<p class="navbar__search-empty">Gagal memuat hasil pencarian.</p>`;
      resultsBox.classList.add('is-open');
    }
  }, 250);

  input.addEventListener('input', () => runSearch(input.value.trim()));

  input.addEventListener('focus', () => {
    if (resultsBox.innerHTML.trim()) resultsBox.classList.add('is-open');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query) {
      window.location.href = `movies.html?search=${encodeURIComponent(query)}`;
    }
  });

  // tutup dropdown kalau klik di luar kotak search
  document.addEventListener('click', (event) => {
    if (!form.contains(event.target)) {
      resultsBox.classList.remove('is-open');
    }
  });

  // tutup dropdown dengan tombol Escape (dan search bar mobile kalau lagi kebuka)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      resultsBox.classList.remove('is-open');
      closeMobileSearch();
      input.blur();
    }
  });
}

/**
 * Nunjukkin indikator loading ringan di dropdown search, dipanggil
 * langsung begitu user berhenti ngetik (sebelum request API selesai),
 * biar keliatan sistemnya lagi kerja bukannya nge-hang.
 */
function showSearchLoading(resultsBox) {
  resultsBox.innerHTML = `<p class="navbar__search-empty">Mencari...</p>`;
  resultsBox.classList.add('is-open');
}

/**
 * Merender hasil TMDB /search/multi (bisa berupa movie, tv, atau person)
 * jadi daftar dropdown di bawah kotak search navbar.
 * Dibangun lewat DOM API (bukan innerHTML) supaya judul/nama dari luar
 * gak bisa nyuntik HTML.
 */
function renderSearchDropdown(resultsBox, results, query) {
  resultsBox.innerHTML = ''; // kosongkan dulu, isi ulang dari nol

  // hanya ambil movie/tv/person yang punya judul & gambar, maksimal 6 item
  const items = results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv' || r.media_type === 'person')
    .slice(0, 6);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'navbar__search-empty';
    empty.textContent = `Tidak ada hasil untuk "${query}"`;
    resultsBox.appendChild(empty);
    resultsBox.classList.add('is-open');
    return;
  }

  items.forEach((item) => {
    resultsBox.appendChild(buildSearchResultRow(item));
  });

  const seeAll = document.createElement('a');
  seeAll.className = 'navbar__search-seeall';
  seeAll.href = `movies.html?search=${encodeURIComponent(query)}`;
  seeAll.textContent = `Lihat semua hasil untuk "${query}"`;
  resultsBox.appendChild(seeAll);

  resultsBox.classList.add('is-open');
}

/**
 * Membuat satu baris hasil pencarian (movie/tv/person) buat dropdown search.
 */
function buildSearchResultRow(item) {
  const row = document.createElement('a');
  row.className = 'navbar__search-item';

  const thumb = document.createElement('span');
  thumb.className = 'navbar__search-item__thumb';

  const info = document.createElement('span');
  info.className = 'navbar__search-item__info';

  const titleEl = document.createElement('span');
  titleEl.className = 'navbar__search-item__title';

  const metaEl = document.createElement('span');
  metaEl.className = 'navbar__search-item__meta';

  if (item.media_type === 'person') {
    row.href = `person.html?id=${item.id}`;
    thumb.classList.add('navbar__search-item__thumb--round');

    const photo = getImageUrl(item.profile_path, 'profile');
    if (photo) {
      const img = document.createElement('img');
      img.src = photo;
      img.alt = item.name;
      attachImageFallback(img);
      thumb.appendChild(img);
    }

    titleEl.textContent = item.name;
    metaEl.textContent = 'Actor / Crew';
  } else {
    const title = item.media_type === 'movie' ? item.title : item.name;
    const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
    const poster = getImageUrl(item.poster_path, 'posterSmall');

    row.href = `detail.html?id=${item.id}&type=${item.media_type}`;

    if (poster) {
      const img = document.createElement('img');
      img.src = poster;
      img.alt = title;
      attachImageFallback(img);
      thumb.appendChild(img);
    }

    titleEl.textContent = title;
    metaEl.textContent = `${item.media_type === 'movie' ? 'Movie' : 'TV Show'} · ${formatYear(date)}`;
  }

  info.appendChild(titleEl);
  info.appendChild(metaEl);
  row.appendChild(thumb);
  row.appendChild(info);

  return row;
}

/* =========================================================
   WATCHLIST (localStorage)
   Struktur data yang disimpan (array of object):
   {
     id: number,
     type: 'movie' | 'tv',
     title: string,
     posterPath: string,
     rating: number,
     year: string
   }
   ========================================================= */

function getWatchlist() {
  const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    // kalau data di localStorage rusak/corrupt, mulai dari array kosong
    console.error('Gagal membaca watchlist dari localStorage:', error);
    return [];
  }
}

function saveWatchlist(list) {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
  // beritahu bagian lain di halaman yang sama (misalnya row "Continue Your
  // Watchlist" di home.js) supaya bisa render ulang langsung tanpa refresh
  window.dispatchEvent(new CustomEvent('watchlist:change', { detail: list }));
}

function isInWatchlist(id, type) {
  return getWatchlist().some((item) => item.id === id && item.type === type);
}

function addToWatchlist(item) {
  const list = getWatchlist();
  if (isInWatchlist(item.id, item.type)) return;
  list.unshift(item); // item baru ditaruh di paling depan
  saveWatchlist(list);
}

function removeFromWatchlist(id, type) {
  const list = getWatchlist().filter((item) => !(item.id === id && item.type === type));
  saveWatchlist(list);
}

/**
 * Menambah jika belum ada, menghapus jika sudah ada.
 * @returns {boolean} true jika sekarang ADA di watchlist, false jika dihapus
 */
function toggleWatchlist(item) {
  if (isInWatchlist(item.id, item.type)) {
    removeFromWatchlist(item.id, item.type);
    showToast('Dihapus dari Watchlist');
    return false;
  }
  addToWatchlist(item);
  showToast('Ditambahkan ke Watchlist');
  return true;
}

/**
 * Mainin animasi "pop" (.is-pop) di tombol wishlist tiap kali di-toggle.
 * Class-nya dilepas dulu + dipaksa reflow, supaya animasi tetap jalan
 * meskipun tombol yang sama diklik berkali-kali secara beruntun.
 */
function playWatchBtnPop(btn) {
  btn.classList.remove('is-pop');
  void btn.offsetWidth; // force reflow biar animasi bisa di-restart
  btn.classList.add('is-pop');
  btn.addEventListener('animationend', () => btn.classList.remove('is-pop'), { once: true });
}

/* =========================================================
   RECENTLY VIEWED (localStorage)
   Struktur data sama persis kayak watchlist: array of object
   { id, type, title, posterPath, rating, year }, tapi ini
   dicatat otomatis tiap kali user buka halaman detail
   (bukan hasil aksi manual seperti watchlist).
   ========================================================= */

function getRecentlyViewed() {
  const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Gagal membaca recently viewed dari localStorage:', error);
    return [];
  }
}

/**
 * Mencatat satu item sebagai "baru saja dilihat".
 * Kalau item yang sama sudah pernah dicatat, dipindah ke paling depan
 * (bukan digandakan), lalu daftar dibatasi maksimal RECENTLY_VIEWED_MAX item.
 */
function addRecentlyViewed(item) {
  let list = getRecentlyViewed();
  list = list.filter((i) => !(i.id === item.id && i.type === item.type));
  list.unshift(item);
  list = list.slice(0, RECENTLY_VIEWED_MAX);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list));
}

/* =========================================================
   TOAST
   ========================================================= */

let toastTimeout = null;

function showToast(message) {
  let toast = document.querySelector('.toast');

  // buat elemen toast sekali saja, lalu dipakai ulang
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('is-visible');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

/* =========================================================
   FORMAT HELPERS
   ========================================================= */

function formatYear(dateString) {
  if (!dateString) return '-';
  return dateString.slice(0, 4);
}

function formatRating(voteAverage) {
  if (!voteAverage) return 'N/A';
  return voteAverage.toFixed(1);
}

function formatRuntime(minutes) {
  if (!minutes) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatGenres(genres = []) {
  return genres.map((g) => g.name).join(', ');
}

/**
 * Format tanggal review TMDB ("2024-03-11T08:12:00.000Z") jadi
 * bentuk yang gampang dibaca ("11 Mar 2024"). Return string kosong
 * kalau tanggalnya tidak valid, biar pemanggilnya tinggal cek falsy.
 */
function formatReviewDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Menunda eksekusi fungsi sampai user berhenti mengetik sebentar.
 * Dipakai untuk search-as-you-type supaya tidak fetch di setiap huruf.
 */
function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* =========================================================
   MOVIE CARD (komponen reusable)
   Dipakai di home.js, movies.js, tv-shows.js, watchlist.js, detail.js
   supaya tidak menulis ulang HTML card di setiap file.
   ========================================================= */

/* =========================================================
   FALLBACK GAMBAR RUSAK
   Kalau URL poster/backdrop dari TMDB gagal dimuat (link mati,
   koneksi putus, dll), tampilan bakal ganti ke ikon placeholder
   ini daripada nunjukkin ikon broken-image bawaan browser.
   ========================================================= */

const IMAGE_FALLBACK_SRC = buildImageFallbackSrc();

function buildImageFallbackSrc() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450">
      <rect width="300" height="450" fill="#18181d"/>
      <g fill="none" stroke="#3a3a42" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="70" y="150" width="160" height="120" rx="10"/>
        <circle cx="150" cy="210" r="20"/>
        <path d="M70 240 L118 195 L158 225 L198 185 L230 212"/>
      </g>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Pasang fallback ke sebuah elemen <img>: kalau gambar aslinya gagal
 * dimuat, otomatis diganti ke placeholder lokal (bukan fetch ke server
 * lagi), jadi gak ada broken-image icon yang keliatan ke user.
 * @param {HTMLImageElement} img
 */
function attachImageFallback(img) {
  img.addEventListener(
    'error',
    () => {
      img.onerror = null; // cegah infinite loop kalau placeholder-nya sendiri somehow gagal
      img.src = IMAGE_FALLBACK_SRC;
      img.classList.add('img-fallback');
    },
    { once: true }
  );
}

/**
 * Membuat satu elemen kartu film/TV show.
 * Semua teks yang berasal dari luar (judul, dsb) di-set lewat
 * textContent / properti elemen (bukan innerHTML), supaya aman
 * dari XSS kalau ada karakter HTML nyelip di data TMDB/localStorage.
 * @param {Object} item - { id, type, title, posterPath, rating, year }
 * @returns {HTMLElement}
 */
function createMovieCard(item) {
  const card = document.createElement('article');
  card.className = 'movie-card';

  const posterWrap = document.createElement('div');
  posterWrap.className = 'movie-card__poster-wrap';

  const poster = item.posterPath ? getImageUrl(item.posterPath, 'posterSmall') : null;

  if (poster) {
    const img = document.createElement('img');
    img.src = poster;
    img.alt = `Poster ${item.title}`; // aman: .alt adalah properti, bukan HTML yang di-parse
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
  // SVG di sini konten statis (bukan dari luar), aman dipasang lewat innerHTML
  ratingBadge.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  ratingBadge.appendChild(document.createTextNode(formatRating(item.rating)));
  posterWrap.appendChild(ratingBadge);

  const watchBtn = document.createElement('button');
  watchBtn.type = 'button';
  watchBtn.className = `movie-card__watch-btn${isInWatchlist(item.id, item.type) ? ' is-active' : ''}`;
  watchBtn.setAttribute('aria-label', 'Tambah ke Watchlist');
  watchBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v16l-7-4-7 4V5z"/></svg>';
  posterWrap.appendChild(watchBtn);

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
  posterWrap.addEventListener('click', () => {
    window.location.href = `detail.html?id=${item.id}&type=${item.type}`;
  });
  title.addEventListener('click', () => {
    window.location.href = `detail.html?id=${item.id}&type=${item.type}`;
  });

  // tombol watchlist di dalam card (tidak ikut trigger buka detail)
  watchBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const nowActive = toggleWatchlist(item);
    watchBtn.classList.toggle('is-active', nowActive);
    playWatchBtnPop(watchBtn);
  });

  return card;
}

/**
 * Menampilkan beberapa kartu skeleton (placeholder) sementara data dimuat.
 * @param {HTMLElement} container
 * @param {number} count
 */
function renderCardSkeletons(container, count = 6) {
  container.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const skeleton = document.createElement('div');
    skeleton.className = 'movie-card skeleton-card';
    skeleton.innerHTML = `
      <div class="movie-card__poster-wrap skeleton"></div>
      <div class="skeleton-text skeleton"></div>
      <div class="skeleton-text skeleton-text--sm skeleton"></div>
    `;
    container.appendChild(skeleton);
  }
}

/**
 * Mengisi <select id="yearFilter"> dengan pilihan tahun,
 * dari tahun sekarang (+1 buat film yang akan rilis) mundur ke 1950.
 * Dipakai bareng di movies.js & tv-shows.js.
 */
function populateYearFilter(selectElement) {
  const currentYear = new Date().getFullYear();
  for (let y = currentYear + 1; y >= 1950; y -= 1) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    selectElement.appendChild(option);
  }
}

/**
 * Membuat komponen dropdown multi-select (dipakai buat filter Genre
 * di movies.js & tv-shows.js, karena user bisa pilih lebih dari satu genre).
 * @param {Object} options
 *   fetchGenres  - fungsi async yang return { genres: [{id, name}] }
 *   initialIds   - array genre id yang sudah aktif dari awal (misal dari URL)
 *   onChange     - dipanggil dengan array genre id terbaru tiap kali berubah
 */
function initGenreMultiSelect({ fetchGenres, initialIds = [], onChange }) {
  const toggle = document.getElementById('genreToggle');
  const toggleLabel = document.getElementById('genreToggleLabel');
  const panel = document.getElementById('genrePanel');
  if (!toggle || !panel) return;

  let selected = initialIds.map(String);
  let genreList = [];

  function updateLabel() {
    if (selected.length === 0) {
      toggleLabel.textContent = 'All Genres';
    } else if (selected.length === 1) {
      const genre = genreList.find((g) => String(g.id) === selected[0]);
      toggleLabel.textContent = genre ? genre.name : '1 Genre';
    } else {
      toggleLabel.textContent = `${selected.length} Genres`;
    }
  }

  fetchGenres()
    .then((data) => {
      genreList = data.genres || [];

      // nama genre dari TMDB -> bikin elemen lalu isi lewat textContent
      panel.innerHTML = '';
      genreList.forEach((g) => {
        const label = document.createElement('label');
        label.className = 'multi-select__option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = g.id;
        checkbox.checked = selected.includes(String(g.id));

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(g.name));
        panel.appendChild(label);
      });

      const clearBtn = document.createElement('div');
      clearBtn.className = 'multi-select__clear';
      clearBtn.id = 'genreClearBtn';
      clearBtn.textContent = 'Clear all';
      panel.appendChild(clearBtn);

      updateLabel();

      panel.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          selected = checkbox.checked
            ? [...selected, checkbox.value]
            : selected.filter((id) => id !== checkbox.value);
          updateLabel();
          onChange([...selected]);
        });
      });

      document.getElementById('genreClearBtn').addEventListener('click', () => {
        selected = [];
        panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          cb.checked = false;
        });
        updateLabel();
        onChange([...selected]);
      });
    })
    .catch((error) => {
      console.error('Gagal memuat daftar genre:', error);
      panel.innerHTML = `<p class="navbar__search-empty">Gagal memuat genre.</p>`;
    });

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    panel.classList.toggle('is-open');
    toggle.classList.toggle('is-open');
  });

  document.addEventListener('click', (event) => {
    if (!toggle.contains(event.target) && !panel.contains(event.target)) {
      panel.classList.remove('is-open');
      toggle.classList.remove('is-open');
    }
  });
}

/* =========================================================
   SCROLL REVEAL
   Dipakai untuk elemen yang mau fade-up pas discroll ke viewport.
   IntersectionObserver dibuat sekali (revealObserver), lalu dipakai
   ulang tiap kali ada elemen baru yang perlu di-observe.
   ========================================================= */

let revealObserver = null;

function getRevealObserver() {
  if (revealObserver) return revealObserver;

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target); // cukup sekali animasi per elemen
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  return revealObserver;
}

/**
 * Mendaftarkan satu elemen supaya di-fade-up otomatis pas masuk viewport.
 * @param {HTMLElement} el
 * @param {number} index - urutan elemen (buat delay cascade), opsional
 */
function observeReveal(el, index = 0) {
  if (!el) return;
  el.classList.add('reveal');
  el.style.setProperty('--reveal-index', index);
  getRevealObserver().observe(el);
}

/**
 * Mendaftarkan semua elemen yang sudah punya class "reveal" di HTML
 * (dipanggil sekali di awal, buat elemen statis kayak section di home).
 */
function initScrollReveal() {
  document.querySelectorAll('.reveal').forEach((el) => getRevealObserver().observe(el));
}

/* =========================================================
   SCROLL TO TOP BUTTON
   ========================================================= */

function initScrollTopButton() {
  const btn = document.createElement('button');
  btn.className = 'scroll-top-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Kembali ke atas');
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', () => {
    btn.classList.toggle('is-visible', window.scrollY > 500);
  });
}

/* =========================================================
   PAGE PROGRESS BAR
   ========================================================= */

let progressHideTimer = null;

/**
 * Menampilkan progress bar tipis di atas layar dan
   menganimasikannya maju sampai ~78% (belum penuh, nunggu
   dipanggil hidePageProgress() saat data selesai diambil).
 */
function showPageProgress() {
  let bar = document.getElementById('pageProgress');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pageProgress';
    bar.className = 'page-progress';
    document.body.prepend(bar);
  }

  clearTimeout(progressHideTimer);
  bar.classList.remove('is-done');
  // reset dulu ke 0% sebelum dianimasikan lagi, biar transition-nya kelihatan
  bar.style.transition = 'none';
  bar.style.width = '0%';
  // force reflow supaya reset di atas benar-benar diterapkan sebelum class baru ditambahkan
  void bar.offsetWidth;
  bar.style.transition = '';
  bar.classList.add('is-loading');
}

/**
 * Menyelesaikan progress bar (lompat ke 100%) lalu memudarkannya.
 */
function hidePageProgress() {
  const bar = document.getElementById('pageProgress');
  if (!bar) return;

  bar.classList.remove('is-loading');
  bar.classList.add('is-done');

  progressHideTimer = setTimeout(() => {
    bar.classList.remove('is-done');
    bar.style.opacity = '0';
    bar.style.width = '0%';
  }, 400);
}

/* =========================================================
   INFINITE SCROLL (opsional, dipakai di movies.html & tv-shows.html)
   Tombol "Load More" yang sudah ada TETAP berfungsi normal.
   Toggle ini cuma nambahin opsi: kalau dinyalakan, tombol yang sama
   otomatis "diklik" begitu kelihatan di layar waktu di-scroll,
   jadi browsing di HP gak perlu tap-tap manual tiap mau lanjut.
   Preferensi disimpan di localStorage biar diingat di kunjungan berikutnya.
   ========================================================= */

function isInfiniteScrollEnabled() {
  try {
    return localStorage.getItem(INFINITE_SCROLL_STORAGE_KEY) === 'true';
  } catch (error) {
    return false;
  }
}

function setInfiniteScrollEnabled(enabled) {
  try {
    localStorage.setItem(INFINITE_SCROLL_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    // localStorage gak tersedia (mode private ketat, dsb), preferensi
    // cukup berlaku untuk sesi ini saja, gak masalah
  }
}

/**
 * @param {HTMLButtonElement} loadMoreBtn - tombol Load More yang sudah ada di halaman
 */
function initInfiniteScroll(loadMoreBtn) {
  const toggleInput = document.getElementById('infiniteScrollToggle');
  if (!toggleInput || !loadMoreBtn) return;

  toggleInput.checked = isInfiniteScrollEnabled();
  let observer = null;

  const observerCallback = (entries) => {
    entries.forEach((entry) => {
      // .click() otomatis gak akan ngapa-ngapain kalau tombolnya
      // sedang disabled (lagi loading) atau disembunyikan (data habis),
      // jadi gak perlu pengecekan tambahan di sini
      if (entry.isIntersecting) loadMoreBtn.click();
    });
  };

  const startObserving = () => {
    if (observer) return;
    // rootMargin dibuat lebar biar mulai loading sebelum tombolnya
    // beneran keliatan penuh, jadi transisinya berasa mulus
    observer = new IntersectionObserver(observerCallback, { rootMargin: '400px' });
    observer.observe(loadMoreBtn);
  };

  const stopObserving = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  };

  if (toggleInput.checked) startObserving();

  toggleInput.addEventListener('change', () => {
    setInfiniteScrollEnabled(toggleInput.checked);
    toggleInput.checked ? startObserving() : stopObserving();
  });
}

/* =========================================================
   NAVBAR AUTO-HIDE (mobile)
   Header disembunyikan pas user scroll ke bawah, biar layar HP
   lebih lega buat lihat poster/konten. Muncul lagi begitu di-scroll
   ke atas dikit aja, jadi menu/search tetap gampang dijangkau.
   Class .navbar--hidden cuma berefek di breakpoint mobile (lihat style.css).
   ========================================================= */

function initNavbarAutoHide() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  let lastScrollY = window.scrollY;
  let ticking = false;
  const REVEAL_THRESHOLD = 80; // di atas titik ini (deket puncak halaman), header selalu tampil

  const updateNavbar = () => {
    const currentScrollY = window.scrollY;

    // jangan sembunyikan header selagi menu hamburger atau search mobile lagi kebuka,
    // biar panelnya gak keliatan "ngambang" tanpa header di atasnya
    const menuOpen =
      document.querySelector('.navbar__links.is-open') ||
      document.querySelector('.navbar__search.is-mobile-open');

    if (menuOpen || currentScrollY <= REVEAL_THRESHOLD) {
      navbar.classList.remove('navbar--hidden');
    } else if (currentScrollY > lastScrollY) {
      navbar.classList.add('navbar--hidden'); // lagi scroll ke bawah
    } else {
      navbar.classList.remove('navbar--hidden'); // lagi scroll ke atas
    }

    lastScrollY = currentScrollY;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateNavbar);
  });
}

/* =========================================================
  INIT - dijalankan di semua halaman
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initNavbarToggle();
  highlightActiveNavLink();
  initNavbarSearch();
  initMobileSearchToggle();
  initScrollReveal();
  initScrollTopButton();
  initNavbarAutoHide();
});
