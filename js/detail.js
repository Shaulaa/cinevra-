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
  bindModal();
});

/* =========================================================
   LOAD DATA UTAMA
   ========================================================= */

async function loadDetail(id, type) {
  showPageProgress();
  try {
    const [details, credits, videos, similar] = await Promise.all([
      type === 'movie' ? fetchMovieDetails(id) : fetchTVDetails(id),
      type === 'movie' ? fetchMovieCredits(id) : fetchTVCredits(id),
      type === 'movie' ? fetchMovieVideos(id) : fetchTVVideos(id),
      type === 'movie' ? fetchSimilarMovies(id) : fetchSimilarTV(id),
    ]);

    currentItem = normalizeDetail(details, type);

    renderDetail(currentItem, details);
    renderSidebar(details, credits, type);
    renderCast(credits);
    renderGallery(details);
    renderSimilar(similar.results || [], type);
    setupTrailerButton(videos);
    loadReviews(id, type);

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
   GALLERY (pakai backdrop utama sebagai preview ringkas)
   ========================================================= */

function renderGallery(data) {
  const row = document.getElementById('galleryRow');
  row.innerHTML = '';
  const images = [data.backdrop_path, data.poster_path].filter(Boolean);

  if (images.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'reviews-empty';
    empty.textContent = 'Belum ada gambar tambahan.';
    row.appendChild(empty);
    return;
  }

  images.forEach((path) => {
    const img = document.createElement('img');
    img.src = getImageUrl(path, 'backdropSmall');
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
    const data = type === 'movie' ? await fetchMovieReviews(id) : await fetchTVReviews(id);
    reviewState.totalPages = data.total_pages || 1;
    renderReviews(data.results || [], { reset: true });
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
   SIMILAR MOVIES/TV SHOWS
   ========================================================= */

function renderSimilar(items, type) {
  const row = document.getElementById('similarRow');
  row.innerHTML = '';

  if (items.length === 0) {
    row.innerHTML = `<p class="reviews-empty">Tidak ada judul serupa.</p>`;
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
   TRAILER MODAL
   ========================================================= */

function setupTrailerButton(videos) {
  const trailer = ((videos && videos.results) || []).find(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );

  const btn = document.getElementById('detailTrailerBtn');

  if (!trailer) {
    btn.disabled = true;
    btn.textContent = 'Trailer Unavailable';
    return;
  }

  btn.addEventListener('click', () => openTrailerModal(trailer.key));
}

function bindModal() {
  const overlay = document.getElementById('trailerModal');
  document.getElementById('modalCloseBtn').addEventListener('click', closeTrailerModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTrailerModal();
  });

  // tutup modal dengan tombol Esc, tapi cuma kalau modalnya lagi kebuka
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
      closeTrailerModal();
    }
  });
}

function openTrailerModal(youtubeKey) {
  const overlay = document.getElementById('trailerModal');
  const wrap = document.getElementById('modalVideoWrap');
  wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${youtubeKey}?autoplay=1" title="Trailer" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  overlay.classList.add('is-open');
}

function closeTrailerModal() {
  document.getElementById('trailerModal').classList.remove('is-open');
  document.getElementById('modalVideoWrap').innerHTML = ''; // hentikan video saat modal ditutup
}

/* =========================================================
   ERROR STATE
   ========================================================= */

function showDetailError() {
  document.getElementById('detailContent').style.display = 'none';
  document.getElementById('detailErrorState').style.display = 'flex';
}
