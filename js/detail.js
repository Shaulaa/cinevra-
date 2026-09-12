/* =========================================================
  CINEVRA - js/detail.js
   Logic untuk detail.html.
   Halaman ini dipakai untuk MOVIE dan TV SHOW sekaligus,
   dibedakan lewat parameter URL: detail.html?id=123&type=movie
   ========================================================= */

// data film/TV yang sedang ditampilkan, disimpan biar bisa dipakai
// ulang oleh tombol watchlist & trailer tanpa fetch lagi
let currentItem = null;

// state untuk panel Reviews (dipisah dari loadDetail supaya kalau
// fetch review-nya gagal atau lambat, sisa halaman detail tetap tampil normal)
const reviewState = {
  id: null,
  type: 'movie',
  page: 1,
  totalPages: 1,
};

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const type = params.get('type') === 'tv' ? 'tv' : 'movie';

  if (!id) {
    showDetailError();
    return;
  }

  loadDetail(id, type);
  bindTabs();
});

/* =========================================================
   LOAD DATA UTAMA
   ========================================================= */

async function loadDetail(id, type) {
  showPageProgress();
  try {
    const [details, credits, videos, similar, recommended, images] = await Promise.all([
      type === 'movie' ? fetchMovieDetails(id) : fetchTVDetails(id),
      type === 'movie' ? fetchMovieCredits(id) : fetchTVCredits(id),
      type === 'movie' ? fetchMovieVideos(id) : fetchTVVideos(id),
      type === 'movie' ? fetchSimilarMovies(id) : fetchSimilarTV(id),
      type === 'movie' ? fetchRecommendedMovies(id) : fetchRecommendedTV(id),
      type === 'movie' ? fetchMovieImages(id) : fetchTVImages(id),
    ]);

    currentItem = normalizeDetail(details, type);

    renderDetail(currentItem, details);
    renderSidebar(details, credits, type);
    renderCast(credits);
    renderGallery(images, currentItem);
    renderCardRow('similarRow', similar.results || [], type, 'Tidak ada judul serupa.');
    renderCardRow('recommendedRow', recommended.results || [], type, 'Belum ada rekomendasi untuk judul ini.');
    setupTrailerButton(videos);
    loadReviews(id, type);
    loadWhereToWatch(id, type);

    // catat sebagai "baru saja dilihat" (localStorage), dipakai buat
    // row "Recently Viewed" di home.html
    addRecentlyViewed({
      id: currentItem.id,
      type: currentItem.type,
      title: currentItem.title,
      posterPath: currentItem.posterPath,
      rating: currentItem.voteAverage,
      year: formatYear(currentItem.releaseDate),
    });
  } catch (error) {
    console.error('Gagal memuat detail:', error);
    showDetailError();
  } finally {
    hidePageProgress();
  }
}

/**
 * Menyatukan struktur data movie & TV show yang field-nya berbeda
 * (title vs name, release_date vs first_air_date, dst) jadi satu bentuk.
 */
function normalizeDetail(data, type) {
  return {
    id: data.id,
    type,
    title: type === 'movie' ? data.title : data.name,
    overview: data.overview,
    releaseDate: type === 'movie' ? data.release_date : data.first_air_date,
    runtime: type === 'movie' ? data.runtime : (data.episode_run_time && data.episode_run_time[0]),
    genres: data.genres || [],
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    voteAverage: data.vote_average,
  };
}

/* =========================================================
   RENDER BAGIAN UTAMA (hero backdrop, poster, judul, dsb)
   ========================================================= */

function renderDetail(item) {
  document.title = `${item.title} - Cinevra`;

  // backdrop
  const backdropUrl = getImageUrl(item.backdropPath, 'backdrop');
  const heroSection = document.getElementById('detailHero');
  if (backdropUrl) {
    const bgWrap = document.createElement('div');
    bgWrap.className = 'detail-hero__backdrop';
    const bgImg = document.createElement('img');
    bgImg.src = backdropUrl;
    bgImg.alt = `Backdrop ${item.title}`; // aman: properti .alt, bukan innerHTML
    attachImageFallback(bgImg);
    bgWrap.appendChild(bgImg);
    heroSection.prepend(bgWrap);
  }

  // poster
  const posterUrl = getImageUrl(item.posterPath, 'poster');
  const posterWrap = document.getElementById('detailPoster');
  posterWrap.innerHTML = '';
  if (posterUrl) {
    const posterImg = document.createElement('img');
    posterImg.src = posterUrl;
    posterImg.alt = `Poster ${item.title}`;
    attachImageFallback(posterImg);
    posterWrap.appendChild(posterImg);
  }

  // judul & meta
  document.getElementById('detailTitle').textContent = item.title;
  document.getElementById('detailOverview').textContent = item.overview || 'Belum ada sinopsis.';
  document.getElementById('aboutText').textContent = item.overview || 'Belum ada sinopsis untuk judul ini.';

  // rating/tahun/runtime murni angka hasil format kita sendiri, aman lewat innerHTML
  document.getElementById('detailMeta').innerHTML = `
    <span class="detail-info__rating">
      <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      ${formatRating(item.voteAverage)}/10
    </span>
    <span class="dot"></span>
    <span>${formatYear(item.releaseDate)}</span>
    ${item.runtime ? `<span class="dot"></span><span>${formatRuntime(item.runtime)}</span>` : ''}
  `;

  // nama genre dari TMDB -> pakai textContent, bukan interpolasi ke innerHTML
  const genresWrap = document.getElementById('detailGenres');
  genresWrap.innerHTML = '';
  item.genres.forEach((g) => {
    const tag = document.createElement('span');
    tag.className = 'genre-tag';
    tag.textContent = g.name;
    genresWrap.appendChild(tag);
  });

  // tombol watchlist
  const watchlistItem = {
    id: item.id,
    type: item.type,
    title: item.title,
    posterPath: item.posterPath,
    rating: item.voteAverage,
    year: formatYear(item.releaseDate),
  };
  const watchlistBtn = document.getElementById('detailWatchlistBtn');
  updateDetailWatchlistBtn(watchlistBtn, watchlistItem);
  watchlistBtn.addEventListener('click', () => {
    toggleWatchlist(watchlistItem);
    updateDetailWatchlistBtn(watchlistBtn, watchlistItem);
    playWatchBtnPop(watchlistBtn);
  });
}

function updateDetailWatchlistBtn(btn, item) {
  const inList = isInWatchlist(item.id, item.type);
  btn.innerHTML = inList
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v16l-7-4-7 4V5z"/></svg> In Watchlist`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v16l-7-4-7 4V5z"/></svg> Add to Watchlist`;
}

/* =========================================================
   SIDEBAR (Director/Creator, Writers, Stars)
   ========================================================= */

function renderSidebar(data, credits, type) {
  const sidebar = document.getElementById('detailSidebar');
  sidebar.innerHTML = '';
  const crew = (credits && credits.crew) || [];
  const cast = (credits && credits.cast) || [];

  let directorLabel = 'Director';
  let directorNames = '';

  if (type === 'movie') {
    directorNames = crew.filter((c) => c.job === 'Director').map((c) => c.name).join(', ');
  } else {
    directorLabel = 'Creator';
    directorNames = (data.created_by || []).map((c) => c.name).join(', ');
  }

  const writerNames = crew
    .filter((c) => ['Screenplay', 'Writer', 'Story'].includes(c.job))
    .map((c) => c.name)
    .filter((name, index, arr) => arr.indexOf(name) === index) // hilangkan duplikat
    .slice(0, 3)
    .join(', ');

  const starNames = cast.slice(0, 3).map((c) => c.name).join(', ');

  // nama director/writer/cast berasal dari TMDB (bisa berisi karakter apa saja),
  // jadi di-render lewat textContent, bukan diselipkan ke innerHTML
  [
    [directorLabel, directorNames],
    ['Writers', writerNames],
    ['Stars', starNames],
  ].forEach(([label, value]) => {
    if (!value) return;

    const item = document.createElement('div');
    item.className = 'sidebar-card__item';

    const labelEl = document.createElement('p');
    labelEl.className = 'sidebar-card__label';
    labelEl.textContent = label;

    const valueEl = document.createElement('p');
    valueEl.className = 'sidebar-card__value';
    valueEl.textContent = value;

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    sidebar.appendChild(item);
  });
}

/* =========================================================
   CAST GRID
   ========================================================= */

function renderCast(credits) {
  const grid = document.getElementById('castGrid');
  grid.innerHTML = '';
  const cast = ((credits && credits.cast) || []).slice(0, 12);

  if (cast.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'reviews-empty';
    empty.textContent = 'Data cast tidak tersedia.';
    grid.appendChild(empty);
    return;
  }

  cast.forEach((person) => {
    const card = document.createElement('a');
    card.className = 'cast-card';
    card.href = `person.html?id=${person.id}`;

    const photoWrap = document.createElement('div');
    photoWrap.className = 'cast-card__photo';

    const photo = getImageUrl(person.profile_path, 'profile');
    if (photo) {
      const img = document.createElement('img');
      img.src = photo;
      img.alt = person.name; // aman: properti .alt, bukan innerHTML
      img.loading = 'lazy';
      attachImageFallback(img);
      photoWrap.appendChild(img);
    }

    const nameEl = document.createElement('p');
    nameEl.className = 'cast-card__name';
    nameEl.textContent = person.name;

    const roleEl = document.createElement('p');
    roleEl.className = 'cast-card__role';
    roleEl.textContent = person.character || '-';

    card.appendChild(photoWrap);
    card.appendChild(nameEl);
    card.appendChild(roleEl);
    grid.appendChild(card);
  });
}

/* =========================================================
   GALLERY (backdrop & poster dari endpoint /images TMDB, bukan cuma
   backdrop_path/poster_path utama, jadi jauh lebih banyak)
   ========================================================= */

function renderGallery(images, item) {
  const row = document.getElementById('galleryRow');
  row.innerHTML = '';

  const backdrops = (images && images.backdrops) || [];
  const posters = (images && images.posters) || [];

  // gambar yang udah kepakai di hero & poster utama gak usah diulang lagi di gallery
  const alreadyShown = new Set([item && item.posterPath, item && item.backdropPath].filter(Boolean));

  // backdrop ditaruh duluan (lebih enak buat preview horizontal), baru poster.
  // di-dedupe pakai file_path karena TMDB kadang ngirim entri yang sama
  // lebih dari sekali (misal beda metadata vote tapi gambarnya identik),
  // dan diurutkan dari vote_average tertinggi biar yang paling beda-beda
  // kualitasnya (bukan cuma variasi crop tipis-tipis) muncul duluan
  const seenPaths = new Set();
  const combined = [...backdrops, ...posters]
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .filter((image) => {
      if (alreadyShown.has(image.file_path)) return false;
      if (seenPaths.has(image.file_path)) return false;
      seenPaths.add(image.file_path);
      return true;
    })
    .slice(0, 20);

  if (combined.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'reviews-empty';
    empty.textContent = 'Belum ada gambar tambahan.';
    row.appendChild(empty);
    return;
  }

  combined.forEach((image) => {
    const img = document.createElement('img');
    img.src = getImageUrl(image.file_path, 'backdropSmall');
    img.alt = 'Gallery image';
    img.loading = 'lazy';
    attachImageFallback(img);
    row.appendChild(img);
  });
}

/* =========================================================
   REVIEWS (data asli dari TMDB)
   ========================================================= */

/**
 * Ambil halaman pertama review, lalu pasang tombol "Load More Reviews".
 * Dipanggil terpisah dari Promise.all utama di loadDetail supaya kalau
 * TMDB gagal ngirim review untuk judul ini, sisa halaman detail
 * (poster, cast, similar, dst) tetap tampil normal.
 */
async function loadReviews(id, type) {
  reviewState.id = id;
  reviewState.type = type;
  reviewState.page = 1;
  reviewState.totalPages = 1;

  try {
    const first = type === 'movie' ? await fetchMovieReviews(id, 1) : await fetchTVReviews(id, 1);
    reviewState.totalPages = first.total_pages || 1;
    let results = first.results || [];

    // langsung ambil halaman kedua juga kalau memang ada, biar review
    // yang kelihatan di awal lebih banyak, gak perlu klik Load More dulu
    if (reviewState.totalPages > 1) {
      const second = type === 'movie' ? await fetchMovieReviews(id, 2) : await fetchTVReviews(id, 2);
      results = results.concat(second.results || []);
      reviewState.page = 2;
    }

    renderReviews(results, { reset: true });
  } catch (error) {
    console.error('Gagal memuat review:', error);
    renderReviews([], { reset: true });
  }

  document.getElementById('reviewsLoadMoreBtn').onclick = handleLoadMoreReviews;
}

async function handleLoadMoreReviews() {
  const btn = document.getElementById('reviewsLoadMoreBtn');
  btn.textContent = 'Loading...';
  btn.disabled = true;

  try {
    reviewState.page += 1;
    const data =
      reviewState.type === 'movie'
        ? await fetchMovieReviews(reviewState.id, reviewState.page)
        : await fetchTVReviews(reviewState.id, reviewState.page);
    reviewState.totalPages = data.total_pages || 1;
    renderReviews(data.results || [], { reset: false });
  } catch (error) {
    console.error('Gagal memuat review tambahan:', error);
    reviewState.page -= 1; // batal, biar tombolnya bisa dicoba lagi
  } finally {
    btn.textContent = 'Load More Reviews';
    btn.disabled = false;
  }
}

/**
 * Render daftar review ke panel Reviews. reset=true dipakai waktu
 * halaman detail baru dibuka (daftar lama dikosongkan dulu), reset=false
 * dipakai waktu "Load More Reviews" diklik (hasil baru ditambah ke bawah).
 */
function renderReviews(results, { reset }) {
  const list = document.getElementById('reviewsList');
  const emptyState = document.getElementById('reviewsEmpty');
  const loadMoreWrap = document.getElementById('reviewsLoadMoreWrap');

  if (reset) list.innerHTML = '';

  if (reset && results.length === 0) {
    emptyState.style.display = 'block';
    loadMoreWrap.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  results.forEach((review) => list.appendChild(buildReviewCard(review)));
  loadMoreWrap.style.display = reviewState.page >= reviewState.totalPages ? 'none' : 'flex';
}

/**
 * Bikin satu kartu review dari data mentah TMDB. Nama author, isi
 * review, dan avatar berasal dari user TMDB (bisa berisi karakter
 * apa saja), jadi selalu dirender lewat textContent, bukan innerHTML.
 */
function buildReviewCard(review) {
  const card = document.createElement('div');
  card.className = 'review-card';

  const header = document.createElement('div');
  header.className = 'review-card__header';

  const authorDetails = review.author_details || {};

  const avatar = document.createElement('div');
  avatar.className = 'review-card__avatar';
  const avatarUrl = getReviewAvatarUrl(authorDetails.avatar_path);
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = review.author || 'Reviewer';
    img.loading = 'lazy';
    attachImageFallback(img);
    avatar.appendChild(img);
  } else {
    avatar.textContent = (review.author || '?').charAt(0).toUpperCase();
  }

  const meta = document.createElement('div');
  meta.className = 'review-card__meta';

  const authorEl = document.createElement('p');
  authorEl.className = 'review-card__author';
  authorEl.textContent = review.author || 'Anonymous';
  meta.appendChild(authorEl);

  const dateText = formatReviewDate(review.created_at);
  if (dateText) {
    const dateEl = document.createElement('p');
    dateEl.className = 'review-card__date';
    dateEl.textContent = dateText;
    meta.appendChild(dateEl);
  }

  header.appendChild(avatar);
  header.appendChild(meta);

  if (authorDetails.rating) {
    const ratingEl = document.createElement('span');
    ratingEl.className = 'review-card__rating';
    const ratingIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ratingIcon.setAttribute('viewBox', '0 0 24 24');
    ratingIcon.innerHTML = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
    ratingEl.appendChild(ratingIcon);
    ratingEl.appendChild(document.createTextNode(`${authorDetails.rating}/10`));
    header.appendChild(ratingEl);
  }

  const content = document.createElement('p');
  content.className = 'review-card__content';
  content.textContent = review.content || '';

  card.appendChild(header);
  card.appendChild(content);

  // review yang panjang di-ringkas dulu (line-clamp), ada tombol buat buka penuh
  if ((review.content || '').length > 400) {
    content.classList.add('is-clamped');

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'review-card__toggle';
    toggleBtn.textContent = 'Baca selengkapnya';
    toggleBtn.addEventListener('click', () => {
      const stillClamped = content.classList.toggle('is-clamped');
      toggleBtn.textContent = stillClamped ? 'Baca selengkapnya' : 'Sembunyikan';
    });
    card.appendChild(toggleBtn);
  }

  return card;
}

/**
 * TMDB kadang mengirim avatar_path berupa link Gravatar lengkap
 * (diawali "/https://..."), kadang path relatif TMDB biasa seperti
 * gambar profil lain di aplikasi ini. Fungsi ini menyesuaikan keduanya.
 */
function getReviewAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('/http')) return avatarPath.slice(1);
  return getImageUrl(avatarPath, 'profile');
}

/* =========================================================
   SIMILAR & RECOMMENDED MOVIES/TV SHOWS
   Dipakai bareng buat panel Similar dan panel Recommended.
   Similar dari TMDB dicocokkan lewat genre/keyword, sedangkan
   Recommended dicocokkan lewat pola tontonan user lain, jadi
   dua endpoint terpisah tapi cara render-nya sama persis.
   ========================================================= */

function renderCardRow(containerId, items, type, emptyMessage) {
  const row = document.getElementById(containerId);
  row.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'reviews-empty';
    empty.textContent = emptyMessage;
    row.appendChild(empty);
    return;
  }

  items.slice(0, 12).forEach((item) => {
    const card = createMovieCard({
      id: item.id,
      type,
      title: type === 'movie' ? item.title : item.name,
      posterPath: item.poster_path,
      rating: item.vote_average,
      year: formatYear(type === 'movie' ? item.release_date : item.first_air_date),
    });
    row.appendChild(card);
  });
}

/* =========================================================
   WHERE TO WATCH
   Data provider streaming/sewa/beli per negara dari TMDB (sumber
   aslinya JustWatch). Negara yang dipakai diprioritaskan ID, lalu
   US, lalu negara pertama yang tersedia di data kalau dua itu
   tidak ada. Section-nya disembunyikan total kalau memang tidak
   ada data provider sama sekali untuk judul ini.
   ========================================================= */

const WATCH_PROVIDER_GROUPS = [
  { key: 'flatrate', label: 'Streaming' },
  { key: 'free', label: 'Gratis' },
  { key: 'ads', label: 'Gratis (Iklan)' },
  { key: 'rent', label: 'Sewa' },
  { key: 'buy', label: 'Beli' },
];

async function loadWhereToWatch(id, type) {
  const section = document.getElementById('whereToWatchSection');
  if (!section) return;

  try {
    const data = type === 'movie' ? await fetchMovieWatchProviders(id) : await fetchTVWatchProviders(id);
    renderWhereToWatch(data.results || {});
  } catch (error) {
    console.error('Gagal memuat data Where to Watch:', error);
    section.style.display = 'none';
  }
}

/**
 * TMDB cuma ngasih satu link per negara (halaman watch di TMDB sendiri,
 * yang isinya nge-list smua provider terus baru diarahkan lagi ke
 * JustWatch). Gak ada API resminya buat deep link langsung ke halaman
 * judul ini di tiap provider. Jadi biar klik logo gak muter dulu lewat
 * TMDB, tiap provider populer dipetakan ke URL pencarian di situs
 * aslinya masing-masing, provider yang belum ada di daftar fallback ke
 * pencarian Google (tetap lebih langsung dibanding lewat TMDB).
 */
const PROVIDER_SEARCH_URL_BUILDERS = {
  netflix: (q) => `https://www.netflix.com/search?q=${q}`,
  'disney plus': (q) => `https://www.disneyplus.com/search?q=${q}`,
  'amazon prime video': (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
  'amazon video': (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
  'apple tv': (q) => `https://tv.apple.com/search?term=${q}`,
  'apple tv plus': (q) => `https://tv.apple.com/search?term=${q}`,
  max: (q) => `https://play.max.com/search?q=${q}`,
  'hbo max': (q) => `https://play.max.com/search?q=${q}`,
  hulu: (q) => `https://www.hulu.com/search?q=${q}`,
  vidio: (q) => `https://www.vidio.com/search?q=${q}`,
  iqiyi: (q) => `https://www.iq.com/search?query=${q}`,
  wetv: (q) => `https://wetv.vip/en/search?q=${q}`,
  viu: (q) => `https://www.viu.com/ott/id/id/all/search?q=${q}`,
  'google play movies': (q) => `https://play.google.com/store/search?q=${q}&c=movies`,
  youtube: (q) => `https://www.youtube.com/results?search_query=${q}`,
  'youtube premium': (q) => `https://www.youtube.com/results?search_query=${q}`,
};

function buildProviderWatchUrl(provider, title, fallbackLink) {
  const name = (provider.provider_name || '').toLowerCase();
  const query = encodeURIComponent(title || provider.provider_name || '');

  const matchedKey = Object.keys(PROVIDER_SEARCH_URL_BUILDERS).find((key) => name.includes(key));
  if (matchedKey) return PROVIDER_SEARCH_URL_BUILDERS[matchedKey](query);

  if (title) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${provider.provider_name} ${title}`)}`;
  }

  return fallbackLink || null;
}

function renderWhereToWatch(resultsByCountry) {
  const section = document.getElementById('whereToWatchSection');
  const countryLabel = document.getElementById('watchProvidersCountry');
  const groupsWrap = document.getElementById('watchProvidersGroups');

  const countryCode = resultsByCountry['ID']
    ? 'ID'
    : resultsByCountry['US']
      ? 'US'
      : Object.keys(resultsByCountry)[0];

  const countryData = countryCode ? resultsByCountry[countryCode] : null;

  const hasAnyProvider = countryData && WATCH_PROVIDER_GROUPS.some((g) => (countryData[g.key] || []).length > 0);

  if (!hasAnyProvider) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  countryLabel.textContent = countryCode;
  groupsWrap.innerHTML = '';

  WATCH_PROVIDER_GROUPS.forEach((group) => {
    const providers = countryData[group.key] || [];
    if (providers.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'watch-providers__group';

    const labelEl = document.createElement('p');
    labelEl.className = 'watch-providers__group-label';
    labelEl.textContent = group.label;
    groupEl.appendChild(labelEl);

    const logosWrap = document.createElement('div');
    logosWrap.className = 'watch-providers__logos';

    providers
      .slice()
      .sort((a, b) => (a.display_priority || 0) - (b.display_priority || 0))
      .forEach((provider) => {
        const watchUrl = buildProviderWatchUrl(provider, currentItem && currentItem.title, countryData.link);
        logosWrap.appendChild(buildProviderLogo(provider, watchUrl));
      });

    groupEl.appendChild(logosWrap);
    groupsWrap.appendChild(groupEl);
  });
}

/**
 * Satu logo provider (Netflix, Disney+, dst). Dibuat jadi link keluar
 * langsung ke halaman pencarian judul ini di situs providernya sendiri
 * (lihat buildProviderWatchUrl), bukan muter dulu lewat TMDB. Kalau
 * gak ada URL yang bisa dibuat, tilenya dibikin non-interaktif aja.
 */
function buildProviderLogo(provider, watchUrl) {
  const tile = document.createElement(watchUrl ? 'a' : 'div');
  if (watchUrl) {
    tile.href = watchUrl;
    tile.target = '_blank';
    tile.rel = 'noopener noreferrer';
  }
  tile.className = 'watch-providers__logo';
  tile.title = provider.provider_name;
  tile.setAttribute('aria-label', provider.provider_name);

  const logoUrl = getImageUrl(provider.logo_path, 'providerLogo');
  if (logoUrl) {
    const img = document.createElement('img');
    img.src = logoUrl;
    img.alt = provider.provider_name;
    img.loading = 'lazy';
    attachImageFallback(img);
    tile.appendChild(img);
  } else {
    tile.textContent = provider.provider_name;
  }

  return tile;
}

/* =========================================================
   TABS
   ========================================================= */

function bindTabs() {
  document.querySelectorAll('.detail-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab').forEach((t) => t.classList.remove('is-active'));
      document.querySelectorAll('.detail-tab-panel').forEach((p) => p.classList.remove('is-active'));

      tab.classList.add('is-active');
      document.querySelector(`.detail-tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add('is-active');
    });
  });
}

/* =========================================================
   TRAILER (embed langsung di halaman)
   Tombol "Watch Trailer" nge-toggle player yang nempel di halaman,
   bukan buka modal/popup dan bukan pindah ke YouTube.
   ========================================================= */

function setupTrailerButton(videos) {
  const trailer = ((videos && videos.results) || []).find(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );

  const btn = document.getElementById('detailTrailerBtn');
  const btnText = document.getElementById('detailTrailerBtnText');

  // trailer lama (kalau ada) ditutup dulu setiap kali halaman detail baru dimuat
  closeInlineTrailer();

  if (!trailer) {
    btn.disabled = true;
    if (btnText) btnText.textContent = 'Trailer Unavailable';
    return;
  }

  btn.disabled = false;
  if (btnText) btnText.textContent = 'Watch Trailer';
  btn.onclick = () => toggleInlineTrailer(trailer.key, btnText);
}

function toggleInlineTrailer(youtubeKey, btnText) {
  const section = document.getElementById('trailerInline');
  const isOpen = section.style.display !== 'none';

  if (isOpen) {
    closeInlineTrailer();
    return;
  }

  const wrap = document.getElementById('trailerInlineWrap');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${youtubeKey}?autoplay=1`;
  iframe.title = 'Trailer';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  wrap.innerHTML = '';
  wrap.appendChild(iframe);

  section.style.display = 'block';
  if (btnText) btnText.textContent = 'Hide Trailer';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeInlineTrailer() {
  const section = document.getElementById('trailerInline');
  const wrap = document.getElementById('trailerInlineWrap');
  const btnText = document.getElementById('detailTrailerBtnText');
  if (!section) return;

  section.style.display = 'none';
  if (wrap) wrap.innerHTML = ''; // hentikan video begitu ditutup
  if (btnText && btnText.textContent === 'Hide Trailer') btnText.textContent = 'Watch Trailer';
}

/* =========================================================
   ERROR STATE
   ========================================================= */

function showDetailError() {
  document.getElementById('detailContent').style.display = 'none';
  document.getElementById('detailErrorState').style.display = 'flex';
}
