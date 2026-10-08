function getPersonalRecord(type, id) {
  try {
    const records = JSON.parse(localStorage.getItem('cinevra_personal'));
    const record = records && records[`${type}:${id}`];
    return {
      rating: Number.isInteger(record?.rating) && record.rating >= 1 && record.rating <= 10 ? record.rating : '',
      watchedOn: typeof record?.watchedOn === 'string' ? record.watchedOn : '',
      note: typeof record?.note === 'string' ? record.note.slice(0, 1000) : '',
      episodes: Array.isArray(record?.episodes) ? [...new Set(record.episodes.filter(key => /^\d+:\d+$/.test(key)))] : [],
    };
  } catch {
    return { rating: '', watchedOn: '', note: '', episodes: [] };
  }
}

function savePersonalRecord(type, id, patch) {
  let records;
  try { records = JSON.parse(localStorage.getItem('cinevra_personal')); } catch { records = {}; }
  if (!records || typeof records !== 'object' || Array.isArray(records)) records = {};
  records[`${type}:${id}`] = { ...getPersonalRecord(type, id), ...patch };
  localStorage.setItem('cinevra_personal', JSON.stringify(records));
}

function initPersonalDetails(item, details) {
  const section = document.getElementById('personalSection');
  section.hidden = false;
  const form = document.getElementById('personalForm');
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
  const status = document.getElementById('personalStatus');
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      savePersonalRecord(item.type, item.id, { rating: rating.value ? Number(rating.value) : '', watchedOn: date.value, note: note.value.trim() });
      status.textContent = 'Saved on this browser';
    } catch { status.textContent = 'Could not save. Browser storage is unavailable or full.'; }
  });
  document.getElementById('personalClear').addEventListener('click', () => {
    try {
      savePersonalRecord(item.type, item.id, { rating: '', watchedOn: '', note: '' });
      populate();
      status.textContent = 'Personal review cleared';
    } catch { status.textContent = 'Could not clear your review. Please try again.'; }
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
  const save = keys => {
    try { savePersonalRecord('tv', id, { episodes: [...keys] }); status.textContent = 'Progress saved on this browser'; }
    catch { status.textContent = 'Could not save progress. Browser storage is unavailable or full.'; }
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
        input.addEventListener('change', () => {
          const keys = new Set(getPersonalRecord('tv', id).episodes);
          if (input.checked) keys.add(input.value); else keys.delete(input.value);
          save(keys);
        });
      });
      toggle.disabled = episodes.length === 0;
      status.textContent = episodes.length ? '' : 'No episodes available for this season.';
      update();
    } catch {
      if (version === request) status.textContent = 'Could not load episodes. Use Retry to try again.';
    }
  };
  toggle.addEventListener('click', () => {
    const keys = new Set(getPersonalRecord('tv', id).episodes);
    const seasonKeys = episodes.map(episode => `${select.value}:${episode.episode_number}`);
    const clear = seasonKeys.every(key => keys.has(key));
    seasonKeys.forEach(key => { if (clear) keys.delete(key); else keys.add(key); });
    save(keys);
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
