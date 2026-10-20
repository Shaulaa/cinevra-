function normalizeDiaryItem(item) {
  if (!item || typeof item.title !== 'string' || !item.title.trim()) return null;
  return {
    title: item.title.trim().slice(0, 300),
    posterPath: typeof item.posterPath === 'string' && /^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/i.test(item.posterPath) ? item.posterPath : null,
    year: /^\d{4}$/.test(String(item.year || '')) ? String(item.year) : '',
  };
}

function normalizePersonalRecord(record) {
  return {
    rating: Number.isInteger(record?.rating) && record.rating >= 1 && record.rating <= 10 ? record.rating : '',
    watchedOn: typeof record?.watchedOn === 'string' ? record.watchedOn : '',
    note: typeof record?.note === 'string' ? record.note.slice(0, 1000) : '',
    episodes: Array.isArray(record?.episodes) ? [...new Set(record.episodes.filter(key => typeof key === 'string' && /^\d+:\d+$/.test(key)))] : [],
    item: normalizeDiaryItem(record?.item),
  };
}

function getPersonalRecord(type, id) {
  try {
    const records = JSON.parse((typeof CinevraCloud !== 'undefined' ? CinevraCloud.read('cinevra_personal') : localStorage.getItem('cinevra_personal')));
    const record = records && records[`${type}:${id}`];
    return normalizePersonalRecord(record);
  } catch {
    return normalizePersonalRecord(null);
  }
}

function isDiaryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Cuma baca catatan yang ada, progres episode saja bukan entri diary.
function getDiaryEntries() {
  const records = JSON.parse((typeof CinevraCloud !== 'undefined' ? CinevraCloud.read('cinevra_personal') : localStorage.getItem('cinevra_personal')) || '{}');
  if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('Invalid personal records');
  return Object.entries(records).flatMap(([key, value]) => {
    const match = /^(movie|tv):([1-9]\d*)$/.exec(key);
    if (!match || !Number.isSafeInteger(Number(match[2]))) return [];
    const record = normalizePersonalRecord(value);
    record.watchedOn = isDiaryDate(record.watchedOn) ? record.watchedOn : '';
    if (!record.rating && !record.watchedOn && !record.note.trim()) return [];
    return [{ key, type: match[1], id: Number(match[2]), ...record }];
  });
}

function savePersonalRecord(type, id, patch) {
  let records;
  try { records = JSON.parse((typeof CinevraCloud !== 'undefined' ? CinevraCloud.read('cinevra_personal') : localStorage.getItem('cinevra_personal'))); } catch { records = {}; }
  if (!records || typeof records !== 'object' || Array.isArray(records)) records = {};
  records[`${type}:${id}`] = { ...getPersonalRecord(type, id), ...patch };
  if (typeof CinevraCloud !== 'undefined') return CinevraCloud.write('cinevra_personal', JSON.stringify(records));
  localStorage.setItem('cinevra_personal', JSON.stringify(records));
}

function initPersonalDetails(item, details) {
  const section = document.getElementById('personalSection');
  section.hidden = false;
  const form = document.getElementById('personalForm');
  if (typeof CinevraCloud !== 'undefined' && CinevraCloud.state().user) section.querySelector('p').textContent = 'Your review is private and saved to your account.';
  if (typeof CinevraCloud !== 'undefined' && CinevraCloud.state().phase !== 'ready') form.querySelectorAll('input,select,textarea,button').forEach(control => control.disabled = true);
  const rating = document.getElementById('personalRating');
  const date = document.getElementById('personalDate');
  const note = document.getElementById('personalNote');
  for (let value = 1; value <= 10; value++) rating.add(new Option(`${value} / 10`, value));
  const populate = () => {
    const record = getPersonalRecord(item.type, item.id);
    rating.value = record.rating;
    date.value = record.watchedOn;
    note.value = record.note;
  };
  populate();
  if (typeof window !== 'undefined' && window.location?.hash === '#personalSection') {
    section.scrollIntoView({ block: 'start', behavior: 'instant' });
    rating.focus({ preventScroll: true });
  }
  const status = document.getElementById('personalStatus');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await savePersonalRecord(item.type, item.id, {
        rating: rating.value ? Number(rating.value) : '', watchedOn: date.value, note: note.value.trim(),
        item: normalizeDiaryItem({ title: item.title, posterPath: item.posterPath, year: (item.releaseDate || '').slice(0, 4) }),
      });
      status.textContent = typeof CinevraCloud !== 'undefined' && CinevraCloud.state().user ? 'Saved to your account' : 'Saved on this browser';
      form.dataset && (form.dataset.dirty = 'false');
    } catch (error) { status.textContent = error.cinevra ? error.message : 'Could not save. Browser storage is unavailable or full.'; }
  });
  document.getElementById('personalClear').addEventListener('click', async () => {
    try {
      await savePersonalRecord(item.type, item.id, { rating: '', watchedOn: '', note: '' });
      populate();
      status.textContent = 'Personal review cleared';
    } catch (error) { status.textContent = error.cinevra ? error.message : 'Could not clear your review. Please try again.'; }
  });
  if (item.type === 'tv') initEpisodeTracker(item.id, details);
}

function initEpisodeTracker(id, details) {
  const section = document.getElementById('episodeSection');
  section.hidden = false;
  const select = document.getElementById('episodeSeason');
  const list = document.getElementById('episodeList');
  const status = document.getElementById('episodeStatus');
  const toggle = document.getElementById('episodeSeasonToggle');
  const seasons = (details.seasons || []).filter(season => season.season_number > 0 && season.episode_count > 0);
  const total = seasons.reduce((sum, season) => sum + season.episode_count, 0);
  const validKeys = new Set(seasons.flatMap(season => Array.from({ length: season.episode_count }, (_, index) => `${season.season_number}:${index + 1}`)));
  const progress = () => {
    const watched = getPersonalRecord('tv', id).episodes.filter(key => validKeys.has(key)).length;
    document.getElementById('episodeProgress').value = watched;
    document.getElementById('episodeProgress').max = total || 1;
    document.getElementById('episodeProgressText').textContent = `${watched} of ${total} episodes watched (${total ? Math.round(watched / total * 100) : 0}%)`;
  };
  seasons.forEach(season => select.add(new Option(season.name || `Season ${season.season_number}`, season.season_number)));
  let request = 0;
  let episodes = [];
  const update = () => {
    const watched = new Set(getPersonalRecord('tv', id).episodes);
    list.querySelectorAll('input').forEach(input => { input.checked = watched.has(input.value); });
    toggle.textContent = episodes.length && episodes.every(episode => watched.has(`${select.value}:${episode.episode_number}`)) ? 'Clear season' : 'Mark season watched';
    progress();
  };
  const save = async keys => {
    try { await savePersonalRecord('tv', id, { episodes: [...keys] }); status.textContent = typeof CinevraCloud !== 'undefined' && CinevraCloud.state().user ? 'Progress saved to your account' : 'Progress saved on this browser'; }
    catch (error) { status.textContent = error.cinevra ? error.message : 'Could not save progress. Browser storage is unavailable or full.'; }
    update();
  };
  const load = async () => {
    const version = ++request;
    const season = select.value;
    list.replaceChildren();
    episodes = [];
    toggle.disabled = true;
    status.textContent = 'Loading episodes...';
    try {
      const data = await fetchTVSeason(id, season);
      if (version !== request) return;
      episodes = (data.episodes || []).filter(episode => validKeys.has(`${season}:${episode.episode_number}`));
      episodes.forEach(episode => {
        const label = document.createElement('label');
        label.className = 'episode-row';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = `${season}:${episode.episode_number}`;
        const text = document.createElement('span');
        text.textContent = `Episode ${episode.episode_number} · ${episode.name || 'Untitled'}`;
        label.append(input, text);
        list.append(label);
        input.addEventListener('change', async () => {
          const keys = new Set(getPersonalRecord('tv', id).episodes);
          if (input.checked) keys.add(input.value); else keys.delete(input.value);
          await save(keys);
        });
      });
      toggle.disabled = episodes.length === 0;
      status.textContent = episodes.length ? '' : 'No episodes available for this season.';
      update();
    } catch {
      if (version === request) status.textContent = 'Could not load episodes. Use Retry to try again.';
    }
  };
  toggle.addEventListener('click', async () => {
    const keys = new Set(getPersonalRecord('tv', id).episodes);
    const seasonKeys = episodes.map(episode => `${select.value}:${episode.episode_number}`);
    const clear = seasonKeys.every(key => keys.has(key));
    seasonKeys.forEach(key => { if (clear) keys.delete(key); else keys.add(key); });
    await save(keys);
  });
  select.addEventListener('change', load);
  document.getElementById('episodeRetry').addEventListener('click', load);
  progress();
  if (seasons.length) load(); else {
    select.disabled = true;
    toggle.disabled = true;
    document.getElementById('episodeRetry').disabled = true;
    status.textContent = 'No regular seasons available yet.';
  }
}
