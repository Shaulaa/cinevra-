/* =========================================================
   CINEVRA — js/home.js
   Logic khusus untuk index.html:
   1. Hero carousel dari film trending (5 film teratas)
   2. Section "Trending Movies"
   3. Section "Popular Movies"
   ========================================================= */

// state kecil untuk carousel hero
let heroMovies = [];
let heroIndex = 0;
let heroAutoTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  showPageProgress();

  Promise.allSettled([
    loadHero(),
    loadTrendingRow(),
    loadTrendingTVRow(),
    loadPopularRow(),
    loadTopRatedRow(),
    loadNowPlayingRow(),
    loadGenreChips(),
  ]).finally(hidePageProgress);

  loadContinueWatchlistRow(); // dari localStorage, gak perlu ditunggu progress bar
  loadRecentlyViewedRow();

  document.getElementById('heroPrev').addEventListener('click', () => moveHero(-1));
  document.getElementById('heroNext').addEventListener('click', () => moveHero(1));
});

/* =========================================================
   HERO CAROUSEL
   ========================================================= */

async function loadHero() {
  try {
    const data = await fetchTrendingMovies('week');
    heroMovies = (data.results || []).slice(0, 5);

    if (heroMovies.length === 0) {
      showHeroError();
      return;
    }

    renderHeroDots();
    renderHero(0);
    startHeroAutoplay();
  } catch (error) {
    console.error('Gagal memuat hero:', error);
    showHeroError();
  }
}

function renderHero(index) {
  const movie = heroMovies[index];
  if (!movie) return;
  heroIndex = index;

  const heroSection = document.getElementById('hero');
  heroSection.classList.remove('hero--loading');

  // backdrop
  let backdropWrap = heroSection.querySelector('.hero__backdrop');
  if (!backdropWrap) {
    backdropWrap = document.createElement('div');
    backdropWrap.className = 'hero__backdrop';
    heroSection.prepend(backdropWrap);
  }
  const backdropUrl = getImageUrl(movie.backdrop_path, 'backdrop');
  backdropWrap.innerHTML = ''; // kosongkan dulu
  if (backdropUrl) {
    const img = document.createElement('img');
    img.src = backdropUrl;
    img.alt = `Backdrop ${movie.title}`; // aman: properti .alt, bukan innerHTML
    backdropWrap.appendChild(img);
  }

  // teks
  document.getElementById('heroTitle').textContent = movie.title;
  document.getElementById('heroOverview').textContent = movie.overview || 'Belum ada sinopsis untuk film ini.';

  document.getElementById('heroMeta').innerHTML = `
    <span class="hero__rating">
      <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      ${formatRating(movie.vote_average)}/10
    </span>
    <span class="dot"></span>
    <span>${formatYear(movie.release_date)}</span>
  `;

  // tombol trailer
  const trailerBtn = document.getElementById('heroTrailerBtn');
  trailerBtn.onclick = () => playTrailer(movie.id);

  // tombol watchlist
  const watchlistItem = {
    id: movie.id,
    type: 'movie',
    title: movie.title,
    posterPath: movie.poster_path,
    rating: movie.vote_average,
    year: formatYear(movie.release_date),
  };
  const watchlistBtn = document.getElementById('heroWatchlistBtn');
  updateHeroWatchlistBtn(watchlistBtn, watchlistItem);
  watchlistBtn.onclick = () => {
    toggleWatchlist(watchlistItem);
    updateHeroWatchlistBtn(watchlistBtn, watchlistItem);
  };

  updateHeroDots();
}

function updateHeroWatchlistBtn(btn, item) {
  const inList = isInWatchlist(item.id, item.type);
  btn.innerHTML = inList
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v16l-7-4-7 4V5z"/></svg> In Watchlist`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v16l-7-4-7 4V5z"/></svg> Add to Watchlist`;
}

function renderHeroDots() {
  const dotsWrap = document.getElementById('heroDots');
  dotsWrap.innerHTML = heroMovies
    .map((_, i) => `<button class="hero__dot" data-index="${i}" aria-label="Slide ${i + 1}"></button>`)
    .join('');

  dotsWrap.querySelectorAll('.hero__dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      renderHero(Number(dot.dataset.index));
      restartHeroAutoplay();
    });
  });
}

function updateHeroDots() {
  document.querySelectorAll('.hero__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === heroIndex);
  });
}

function moveHero(direction) {
  const nextIndex = (heroIndex + direction + heroMovies.length) % heroMovies.length;
  renderHero(nextIndex);
  restartHeroAutoplay();
}

function startHeroAutoplay() {
  heroAutoTimer = setInterval(() => moveHero(1), 7000);
}

function restartHeroAutoplay() {
  clearInterval(heroAutoTimer);
  startHeroAutoplay();
}

function showHeroError() {
  const heroSection = document.getElementById('hero');
  heroSection.classList.remove('hero--loading');
  document.getElementById('heroTitle').textContent = 'Gagal memuat data film';
  document.getElementById('heroOverview').textContent =
    'Terjadi masalah saat mengambil data dari TMDB. Periksa koneksi internet atau API key kamu, lalu muat ulang halaman.';
  document.getElementById('heroMeta').innerHTML = '';
}

/**
 * Membuka trailer YouTube resmi (kalau tersedia) di tab baru.
 */
async function playTrailer(movieId) {
  try {
    const data = await fetchMovieVideos(movieId);
    const trailer = (data.results || []).find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer'
    );
    if (trailer) {
      window.open(`https://www.youtube.com/watch?v=${trailer.key}`, '_blank');
    } else {
      showToast('Trailer tidak tersedia untuk film ini');
    }
  } catch (error) {
    console.error('Gagal memuat trailer:', error);
    showToast('Gagal memuat trailer');
  }
}

/* =========================================================
   TRENDING MOVIES ROW
   ========================================================= */

async function loadTrendingRow() {
  const row = document.getElementById('trendingRow');
  renderCardSkeletons(row, 7);

  try {
    const data = await fetchTrendingMovies('week');
    renderMovieRow(row, data.results || []);
  } catch (error) {
    console.error('Gagal memuat trending movies:', error);
    row.innerHTML = `<p class="state-block__desc">Gagal memuat data. Coba muat ulang halaman.</p>`;
  }
}

/* =========================================================
   POPULAR MOVIES ROW
   ========================================================= */

async function loadPopularRow() {
  const row = document.getElementById('popularRow');
  renderCardSkeletons(row, 7);

  try {
    const data = await fetchPopularMovies(1);
    renderMovieRow(row, data.results || []);
  } catch (error) {
    console.error('Gagal memuat popular movies:', error);
    row.innerHTML = `<p class="state-block__desc">Gagal memuat data. Coba muat ulang halaman.</p>`;
  }
}

/**
 * Mengubah hasil TMDB (array film mentah) menjadi kartu-kartu di dalam container.
 */
function renderMovieRow(container, movies) {
  container.innerHTML = '';

  if (movies.length === 0) {
    container.innerHTML = `<p class="state-block__desc">Tidak ada film untuk ditampilkan.</p>`;
    return;
  }

  movies.forEach((movie) => {
    const card = createMovieCard({
      id: movie.id,
      type: 'movie',
      title: movie.title,
      posterPath: movie.poster_path,
      rating: movie.vote_average,
      year: formatYear(movie.release_date),
    });
    container.appendChild(card);
  });
}

/* =========================================================
   TRENDING TV SHOWS ROW
   ========================================================= */

async function loadTrendingTVRow() {
  const row = document.getElementById('trendingTVRow');
  renderCardSkeletons(row, 7);

  try {
    const data = await fetchTrendingTV('week');
    renderTVRow(row, data.results || []);
  } catch (error) {
    console.error('Gagal memuat trending TV shows:', error);
    row.innerHTML = `<p class="state-block__desc">Gagal memuat data. Coba muat ulang halaman.</p>`;
  }
}

function renderTVRow(container, shows) {
  container.innerHTML = '';

  if (shows.length === 0) {
    container.innerHTML = `<p class="state-block__desc">Tidak ada TV show untuk ditampilkan.</p>`;
    return;
  }

  shows.forEach((show) => {
    const card = createMovieCard({
      id: show.id,
      type: 'tv',
      title: show.name,
      posterPath: show.poster_path,
      rating: show.vote_average,
      year: formatYear(show.first_air_date),
    });
    container.appendChild(card);
  });
}

/* =========================================================
   TOP RATED MOVIES ROW
   ========================================================= */

async function loadTopRatedRow() {
  const row = document.getElementById('topRatedRow');
  renderCardSkeletons(row, 7);

  try {
    const data = await fetchTopRatedMovies(1);
    renderMovieRow(row, data.results || []);
  } catch (error) {
    console.error('Gagal memuat top rated movies:', error);
    row.innerHTML = `<p class="state-block__desc">Gagal memuat data. Coba muat ulang halaman.</p>`;
  }
}

/* =========================================================
   NOW PLAYING ROW
   ========================================================= */

async function loadNowPlayingRow() {
  const row = document.getElementById('nowPlayingRow');
  renderCardSkeletons(row, 7);

  try {
    const data = await fetchNowPlayingMovies(1);
    renderMovieRow(row, data.results || []);
  } catch (error) {
    console.error('Gagal memuat now playing movies:', error);
    row.innerHTML = `<p class="state-block__desc">Gagal memuat data. Coba muat ulang halaman.</p>`;
  }
}

/* =========================================================
   CONTINUE YOUR WATCHLIST (dari localStorage, tanpa fetch)
   ========================================================= */

function loadContinueWatchlistRow() {
  const list = getWatchlist();
  if (list.length === 0) return; // biarkan section tetap disembunyikan

  const section = document.getElementById('continueSection');
  const row = document.getElementById('continueRow');
  section.style.display = 'block';

  // cukup tampilkan 10 item terbaru yang ditambahkan
  list.slice(0, 10).forEach((item) => {
    row.appendChild(
      createMovieCard({
        id: item.id,
        type: item.type,
        title: item.title,
        posterPath: item.posterPath,
        rating: item.rating,
        year: item.year,
      })
    );
  });
}

/* =========================================================
   RECENTLY VIEWED (dari localStorage, tanpa fetch)
   ========================================================= */

function loadRecentlyViewedRow() {
  const list = getRecentlyViewed();
  if (list.length === 0) return; // biarkan section tetap disembunyikan

  const section = document.getElementById('recentSection');
  const row = document.getElementById('recentRow');
  section.style.display = 'block';

  list.forEach((item) => {
    row.appendChild(
      createMovieCard({
        id: item.id,
        type: item.type,
        title: item.title,
        posterPath: item.posterPath,
        rating: item.rating,
        year: item.year,
      })
    );
  });
}

/* =========================================================
   BROWSE BY GENRE (chip yang ngarah ke movies.html?genre=ID)
   ========================================================= */

async function loadGenreChips() {
  const wrap = document.getElementById('genreChipRow');

  try {
    const data = await fetchMovieGenres();
    const genres = data.genres || [];

    if (genres.length === 0) {
      wrap.innerHTML = `<p class="state-block__desc">Daftar genre tidak tersedia.</p>`;
      return;
    }

    // nama genre dari TMDB -> bikin elemen lalu isi lewat textContent
    wrap.innerHTML = '';
    genres.forEach((g) => {
      const chip = document.createElement('a');
      chip.className = 'genre-chip';
      chip.href = `movies.html?genre=${g.id}`;
      chip.textContent = g.name;
      wrap.appendChild(chip);
    });
  } catch (error) {
    console.error('Gagal memuat daftar genre:', error);
    wrap.innerHTML = `<p class="state-block__desc">Gagal memuat daftar genre.</p>`;
  }
}
