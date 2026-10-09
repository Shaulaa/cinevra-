document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('backupStatus');
  const preview = document.getElementById('backupPreview');
  const confirm = document.getElementById('restoreConfirm');
  const restore = document.getElementById('restoreBackup');
  let pending = null;
  let fileVersion = 0;
  let viewVersion = 0;
  const resetImport = () => { pending = null; preview.textContent = ''; confirm.checked = false; confirm.disabled = true; restore.disabled = true; };
  document.getElementById('exportBackup').addEventListener('click', () => {
    try {
      const blob = new Blob([JSON.stringify(createLibraryBackup(), null, 2)], { type: 'application/json' });
      if (blob.size > BACKUP_MAX_BYTES) throw Error('Backup exceeds the 2 MB import limit. Reduce your Lists before exporting.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cinevra-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Backup downloaded. Keep it safe, it includes your private notes.';
    } catch (error) { status.textContent = `Could not export. ${error.message}`; }
  });
  document.getElementById('importBackup').addEventListener('change', async event => {
    const version = ++fileVersion;
    resetImport(); status.textContent = '';
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > BACKUP_MAX_BYTES) throw Error('Choose a backup smaller than 2 MB.');
      const backup = validateLibraryBackup(JSON.parse(await file.text()));
      if (version !== fileVersion) return;
      pending = backup;
      const data = backup.data;
      preview.textContent = `${data.watchlist.length} watchlist titles, ${data.lists.length} custom lists, ${Object.keys(data.personal).length} personal records. This replaces your current Lists, ratings, notes and episode progress.`;
      confirm.disabled = false;
      status.textContent = 'File validated. Export your current data before restoring if you want to keep a copy.';
    } catch (error) { if (version === fileVersion) status.textContent = `Could not import. ${error.message}`; }
  });
  confirm.addEventListener('change', () => { restore.disabled = !pending || !confirm.checked; });
  restore.addEventListener('click', () => {
    if (!pending || !confirm.checked) return;
    try {
      restoreLibrary(pending); resetImport();
      document.getElementById('importBackup').value = '';
      status.textContent = 'Restored successfully. Your Lists, ratings, notes and episode progress are ready.';
      window.dispatchEvent(new CustomEvent('watchlist:change'));
      window.dispatchEvent(new CustomEvent('lists:change'));
    } catch (error) { status.textContent = error.message; }
  });
  const showView = () => {
    const view = ['stats', 'for-you', 'backup'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'stats';
    const version = ++viewVersion;
    document.querySelectorAll('[data-space-panel]').forEach(panel => { panel.hidden = panel.id !== view; });
    document.querySelectorAll('[data-space-link]').forEach(link => {
      if (link.hash === `#${view}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    if (view === 'stats') renderMyStats(() => version === viewVersion);
    if (view === 'for-you') renderForYou(() => version === viewVersion);
  };
  document.getElementById('statsRetry').addEventListener('click', showView);
  document.getElementById('recommendationRetry').addEventListener('click', showView);
  window.addEventListener('hashchange', showView);
  window.addEventListener('storage', event => { if (LIBRARY_KEYS.includes(event.key) || event.key === null) { ++fileVersion; resetImport(); showView(); } });
  window.addEventListener('watchlist:change', () => { if (location.hash === '#for-you') showView(); });
  showView();
});

async function renderMyStats(current) {
  const status = document.getElementById('statsStatus');
  const genres = document.getElementById('favoriteGenres');
  const months = document.getElementById('monthlyActivity');
  genres.replaceChildren(); months.replaceChildren();
  let stats;
  try {
    stats = calculateLibraryStats(readLibrary());
    document.getElementById('moviesWatched').textContent = stats.movies;
    document.getElementById('averageRating').textContent = stats.average === null ? 'No ratings yet' : `${stats.average.toFixed(1)} / 10`;
    document.getElementById('ratingCount').textContent = `${stats.rated} personal ratings across movies and TV`;
    document.getElementById('episodesWatched').textContent = stats.episodes;
    document.getElementById('savedTitles').textContent = stats.saved;
    stats.months.forEach(month => {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = new Date(`${month.key}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const bar = document.createElement('meter');
      bar.min = 0; bar.max = Math.max(1, ...stats.months.map(item => item.count)); bar.value = month.count;
      bar.setAttribute('aria-label', `${label.textContent}, ${month.count} titles watched`);
      const count = document.createElement('span'); count.textContent = month.count;
      row.append(label, bar, count); months.append(row);
    });
  } catch {
    ['moviesWatched', 'averageRating', 'episodesWatched', 'savedTitles'].forEach(id => { document.getElementById(id).textContent = 'Unavailable'; });
    document.getElementById('ratingCount').textContent = '';
    status.textContent = 'Could not read your browser data. Restore a valid backup or retry when storage is available.';
    return;
  }
  const movies = [...stats.watched].filter(key => key.startsWith('movie:'));
  if (!movies.length) { status.textContent = 'Mark a movie watched in Lists or add a watch date on its detail page to start your stats.'; return; }
  status.textContent = 'Loading genres for your watched movies...';
  const counts = new Map();
  let failed = 0;
  // Batasi request bersamaan supaya library besar tetap ringan.
  for (let offset = 0; offset < movies.length; offset += 6) {
    if (!current()) return;
    const results = await Promise.allSettled(movies.slice(offset, offset + 6).map(key => fetchMovieDetails(key.split(':')[1])));
    if (!current()) return;
    results.forEach(result => {
      if (result.status === 'rejected') { failed++; return; }
      new Set((result.value.genres || []).map(genre => genre.name)).forEach(name => { counts.set(name, (counts.get(name) || 0) + 1); });
    });
  }
  [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).forEach(([name, count]) => {
    const row = document.createElement('li'); row.textContent = `${name} · ${count} movies`; genres.append(row);
  });
  status.textContent = failed ? `Genres loaded for ${movies.length - failed} of ${movies.length} movies. Some requests failed. Use Retry to try again.` : counts.size ? 'Favorite genres are based on your watched movies.' : 'No genre information available for these movies.';
}

async function renderForYou(current) {
  const status = document.getElementById('recommendationStatus');
  const grid = document.getElementById('recommendationGrid');
  grid.replaceChildren();
  grid.setAttribute('aria-busy', 'false');
  let data;
  try { data = readLibrary(); } catch { status.textContent = 'Could not read your browser data. Restore a valid backup or retry.'; return; }
  const seeds = getRecommendationSeeds(data);
  if (!seeds.length) { status.textContent = 'Save a title to Lists or give a personal rating of 8 or higher to get recommendations.'; return; }
  status.textContent = 'Finding recommendations from your favorites...';
  grid.setAttribute('aria-busy', 'true');
  const results = await Promise.allSettled(seeds.map(seed => seed.type === 'movie' ? fetchRecommendedMovies(seed.id) : fetchRecommendedTV(seed.id)));
  if (!current()) return;
  grid.setAttribute('aria-busy', 'false');
  const excluded = new Set([...libraryItems(data).keys(), ...Object.keys(data.personal).filter(key => {
    const record = data.personal[key]; return record.rating !== '' || record.watchedOn || record.episodes.length;
  })]);
  const candidates = new Map();
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === 'rejected') { failed++; return; }
    const seed = seeds[index];
    (result.value.results || []).forEach((item, rank) => {
      const key = `${seed.type}:${item.id}`;
      if (excluded.has(key) || !Number.isSafeInteger(item.id) || item.adult === true) return;
      const weight = (seed.reason === 'high rating' ? 2 : 1) / (rank + 1);
      const existing = candidates.get(key);
      if (existing) existing.score += weight;
      else candidates.set(key, { score: weight, item, seed });
    });
  });
  [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 18).forEach(({ item, seed }) => {
    const wrapper = document.createElement('div');
    const card = createMovieCard({ id: item.id, type: seed.type, title: item.title || item.name || 'Untitled', posterPath: item.poster_path, rating: item.vote_average, year: formatYear(item.release_date || item.first_air_date) });
    const reason = document.createElement('p'); reason.className = 'recommendation-reason';
    reason.textContent = `Because you ${seed.reason === 'high rating' ? 'rated highly' : 'saved'} ${seed.title || `a ${seed.type === 'movie' ? 'movie' : 'TV show'} (#${seed.id})`}`;
    wrapper.append(card, reason); grid.append(wrapper);
  });
  status.textContent = failed ? `Some recommendations could not be loaded (${failed} of ${seeds.length} sources). Use Refresh to retry.` : candidates.size ? 'Based on up to six favorites. Saved and previously rated or watched titles are excluded.' : 'No new recommendations available for these favorites. Try saving more titles.';
}
