/* Watching Diary membaca review lokal, judul lama dilengkapi lewat TMDB. */
function filterDiaryEntries(entries, { query = '', type = 'all', year = '', order = 'newest' } = {}) {
  const term = query.trim().toLocaleLowerCase();
  return entries.filter(entry =>
    (type === 'all' || entry.type === type) &&
    (!year || entry.watchedOn.startsWith(`${year}-`)) &&
    (!term || `${entry.item?.title || ''} ${entry.note}`.toLocaleLowerCase().includes(term))
  ).sort((a, b) => {
    if (!a.watchedOn && b.watchedOn) return 1;
    if (a.watchedOn && !b.watchedOn) return -1;
    const dates = a.watchedOn.localeCompare(b.watchedOn);
    return (order === 'oldest' ? dates : -dates) || a.key.localeCompare(b.key);
  });
}

document.addEventListener('DOMContentLoaded', initDiary);

function initDiary() {
  const timeline = document.getElementById('diaryTimeline');
  const empty = document.getElementById('diaryEmpty');
  const status = document.getElementById('diaryStatus');
  const retry = document.getElementById('diaryRetry');
  const more = document.getElementById('diaryMore');
  const search = document.getElementById('diarySearch');
  const type = document.getElementById('diaryType');
  const year = document.getElementById('diaryYear');
  const order = document.getElementById('diaryOrder');
  let entries = [];
  let limit = 30;
  let version = 0;
  let storageFailed = false;
  const titles = new Map();

  function render() {
    const filtered = filterDiaryEntries(entries, { query: search.value, type: type.value, year: year.value, order: order.value });
    timeline.replaceChildren();
    document.getElementById('diaryCount').textContent = storageFailed ? '' : `${filtered.length} of ${entries.length} entries`;
    empty.hidden = storageFailed || filtered.length > 0;
    document.getElementById('diaryEmptyTitle').textContent = entries.length ? 'No matching entries' : 'Your diary starts with a film';
    document.getElementById('diaryEmptyText').textContent = entries.length
      ? 'Try another title, note, year, or type of title.'
      : 'Open a movie or TV show and save a rating, watch date, or note to see it here.';
    document.getElementById('diaryBrowse').hidden = entries.length > 0;
    document.getElementById('diaryReset').hidden = entries.length === 0;
    more.hidden = filtered.length <= limit;
    let month = null;
    let list;
    filtered.slice(0, limit).forEach(entry => {
      const group = entry.watchedOn.slice(0, 7);
      if (group !== month) {
        month = group;
        const section = document.createElement('section');
        section.className = 'diary-month';
        const heading = document.createElement('h2');
        heading.className = 'diary-month__title';
        heading.textContent = group
          ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${group}-01T00:00:00Z`))
          : 'No watch date';
        list = document.createElement('ul');
        list.className = 'diary-entries';
        section.append(heading, list);
        timeline.append(section);
      }
      list.append(createDiaryEntry(entry));
    });
  }

  async function load() {
    const current = ++version;
    retry.hidden = true;
    storageFailed = false;
    try {
      entries = getDiaryEntries();
    } catch {
      entries = [];
      storageFailed = true;
      status.textContent = 'Your diary could not be read. Browser storage may be unavailable or contain damaged data. Your records have not been changed.';
      retry.hidden = false;
      render();
      return;
    }
    const selectedYear = year.value;
    year.replaceChildren(new Option('All years', ''));
    [...new Set(entries.filter(entry => entry.watchedOn).map(entry => entry.watchedOn.slice(0, 4)))].sort().reverse()
      .forEach(value => year.add(new Option(value, value)));
    if ([...year.options].some(option => option.value === selectedYear)) year.value = selectedYear;

    const known = [];
    for (const key of ['cinevra_watchlist', 'cinevra_lists', 'cinevra_recently_viewed']) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(data)) known.push(...(key === 'cinevra_lists' ? data.flatMap(list => Array.isArray(list?.items) ? list.items : []) : data));
      } catch { /* Metadata tambahan boleh gagal tanpa menyembunyikan review. */ }
    }
    entries.forEach(entry => {
      if (!entry.item) entry.item = titles.get(entry.key) || normalizeDiaryItem(known.find(item => item?.type === entry.type && Number(item.id) === entry.id));
    });
    render();
    const missing = entries.filter(entry => !entry.item);
    status.textContent = missing.length ? 'Loading titles for your saved reviews...' : '';
    let failed = 0;
    // Empat permintaan sekaligus supaya library lama tidak membanjiri TMDB.
    for (let offset = 0; offset < missing.length; offset += 4) {
      await Promise.all(missing.slice(offset, offset + 4).map(async entry => {
        try {
          const data = await (entry.type === 'movie' ? fetchMovieDetails(entry.id) : fetchTVDetails(entry.id));
          entry.item = normalizeDiaryItem({
            title: entry.type === 'movie' ? data.title : data.name,
            posterPath: data.poster_path,
            year: ((entry.type === 'movie' ? data.release_date : data.first_air_date) || '').slice(0, 4),
          });
          if (entry.item) titles.set(entry.key, entry.item); else failed++;
        } catch { failed++; }
      }));
      if (current !== version) return;
      render();
    }
    status.textContent = failed ? 'Some titles could not be loaded. Your ratings and notes are still available.' : '';
    retry.hidden = failed === 0;
  }

  function resetFilters() {
    search.value = '';
    type.value = 'all';
    year.value = '';
    order.value = 'newest';
    limit = 30;
    render();
  }
  [search, type, year, order].forEach(control => control.addEventListener(control === search ? 'input' : 'change', () => { limit = 30; render(); }));
  document.getElementById('diaryReset').addEventListener('click', () => { resetFilters(); search.focus(); });
  retry.addEventListener('click', load);
  more.addEventListener('click', () => {
    const previous = timeline.querySelectorAll('.diary-entry').length;
    limit += 30;
    render();
    timeline.querySelectorAll('.diary-entry__title a')[previous]?.focus();
  });
  window.addEventListener('storage', event => { if (!event.key || ['cinevra_personal', 'cinevra_watchlist', 'cinevra_lists'].includes(event.key)) load(); });
  window.addEventListener('pageshow', event => { if (event.persisted) load(); });
  load();
}

function createDiaryEntry(entry) {
  const row = document.createElement('li');
  row.className = 'diary-entry';
  const title = entry.item?.title || `${entry.type === 'movie' ? 'Movie' : 'TV show'} #${entry.id}`;
  const url = `detail.html?id=${entry.id}&type=${entry.type}#personalSection`;
  const date = document.createElement(entry.watchedOn ? 'time' : 'span');
  date.className = 'diary-entry__date';
  if (entry.watchedOn) {
    date.dateTime = entry.watchedOn;
    date.textContent = new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${entry.watchedOn}T00:00:00Z`));
  } else date.textContent = 'Undated';
  const poster = document.createElement('a');
  poster.className = 'diary-entry__poster';
  poster.href = url;
  poster.tabIndex = -1;
  poster.setAttribute('aria-hidden', 'true');
  if (entry.item?.posterPath) {
    const img = document.createElement('img');
    img.src = getImageUrl(entry.item.posterPath, 'posterSmall');
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove());
    poster.append(img);
  }
  const body = document.createElement('div');
  body.className = 'diary-entry__body';
  const heading = document.createElement('h3');
  heading.className = 'diary-entry__title';
  const link = document.createElement('a');
  link.href = url;
  link.textContent = title;
  heading.append(link);
  const meta = document.createElement('p');
  meta.className = 'diary-entry__meta';
  meta.textContent = [entry.type === 'movie' ? 'Movie' : 'TV show', entry.item?.year].filter(Boolean).join(' · ');
  body.append(heading, meta);
  if (entry.note.trim()) {
    const note = document.createElement('p');
    note.className = 'diary-entry__note';
    note.textContent = entry.note;
    body.append(note);
  }
  const review = document.createElement('a');
  review.className = 'diary-entry__review';
  review.href = url;
  review.textContent = 'Edit review';
  review.setAttribute('aria-label', `Edit review for ${title}`);
  body.append(review);
  const rating = document.createElement('span');
  rating.className = 'diary-entry__rating';
  if (entry.rating) {
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    star.setAttribute('viewBox', '0 0 24 24');
    star.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
    star.append(path);
    const value = document.createElement('span');
    value.textContent = `${entry.rating} / 10`;
    rating.append(star, value);
  } else rating.textContent = 'Not rated';
  rating.setAttribute('aria-label', entry.rating ? `My rating ${entry.rating} out of 10` : 'Not rated');
  row.append(date, poster, body, rating);
  return row;
}
