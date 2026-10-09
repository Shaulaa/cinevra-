const LIBRARY_KEYS = ['cinevra_watchlist', 'cinevra_lists', 'cinevra_personal'];
const BACKUP_MAX_BYTES = 2 * 1024 * 1024;

function validWatchDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validateLibraryBackup(backup) {
  const fail = () => { throw Error('Invalid Cinevra backup. Check the file format and version.'); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max) => typeof value === 'string' && value.length <= max;
  if (!object(backup) || backup.app !== 'cinevra' || backup.version !== 1 || !object(backup.data)) fail();
  const cleanItems = items => {
    if (!Array.isArray(items) || items.length > 10000) fail();
    const seen = new Set();
    return items.map(item => {
      if (!object(item) || !Number.isSafeInteger(item.id) || item.id <= 0 || !['movie', 'tv'].includes(item.type) || !text(item.title, 500)) fail();
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) fail();
      seen.add(key);
      if (item.posterPath != null && item.posterPath !== '' && (!text(item.posterPath, 200) || !/^\/[\w.-]+$/.test(item.posterPath))) fail();
      if (item.rating != null && (!Number.isFinite(item.rating) || item.rating < 0 || item.rating > 10)) fail();
      if (item.year != null && !text(item.year, 20)) fail();
      if (item.watched != null && typeof item.watched !== 'boolean') fail();
      return { id: item.id, type: item.type, title: item.title, posterPath: item.posterPath || null, rating: item.rating ?? 0, year: item.year || '', watched: item.watched === true };
    });
  };
  const { watchlist, lists, personal } = backup.data;
  if (!Array.isArray(lists) || lists.length > 20 || !object(personal) || Object.keys(personal).length > 10000) fail();
  const ids = new Set();
  const names = new Set(['watchlist']);
  const cleanLists = lists.map(list => {
    if (!object(list) || !text(list.id, 128) || !/^[\w-]+$/.test(list.id) || list.id === 'watchlist' || !text(list.name, 40) || !list.name.trim()) fail();
    const name = list.name.trim();
    if (ids.has(list.id) || names.has(name.toLowerCase())) fail();
    ids.add(list.id); names.add(name.toLowerCase());
    return { id: list.id, name, items: cleanItems(list.items) };
  });
  const records = {};
  Object.entries(personal).forEach(([key, record]) => {
    if (!/^(movie|tv):[1-9]\d*$/.test(key) || !Number.isSafeInteger(Number(key.split(':')[1])) || !object(record)) fail();
    const rating = record.rating ?? '';
    const watchedOn = record.watchedOn ?? '';
    const note = record.note ?? '';
    const episodes = record.episodes ?? [];
    if (rating !== '' && (!Number.isInteger(rating) || rating < 1 || rating > 10)) fail();
    if (watchedOn !== '' && !validWatchDate(watchedOn)) fail();
    if (!text(note, 1000) || !Array.isArray(episodes) || episodes.length > 10000 || episodes.some(value => typeof value !== 'string' || !/^[1-9]\d{0,5}:[1-9]\d{0,5}$/.test(value))) fail();
    if (key.startsWith('movie:') && episodes.length) fail();
    records[key] = { rating, watchedOn, note, episodes: [...new Set(episodes)] };
  });
  return { app: 'cinevra', version: 1, data: { watchlist: cleanItems(watchlist), lists: cleanLists, personal: records } };
}

function readLibrary() {
  // Jangan diam-diam ekspor data kosong kalau penyimpanan rusak.
  return validateLibraryBackup({ app: 'cinevra', version: 1, data: {
    watchlist: JSON.parse(localStorage.getItem(LIBRARY_KEYS[0]) || '[]'),
    lists: JSON.parse(localStorage.getItem(LIBRARY_KEYS[1]) || '[]'),
    personal: JSON.parse(localStorage.getItem(LIBRARY_KEYS[2]) || '{}'),
  } }).data;
}

function createLibraryBackup() {
  return { app: 'cinevra', version: 1, exportedAt: new Date().toISOString(), data: readLibrary() };
}

function restoreLibrary(backup) {
  const { data } = validateLibraryBackup(backup);
  const previous = LIBRARY_KEYS.map(key => localStorage.getItem(key));
  const values = [data.watchlist, data.lists, data.personal].map(value => JSON.stringify(value));
  const written = [];
  try {
    LIBRARY_KEYS.forEach((key, index) => { localStorage.setItem(key, values[index]); written.push(index); });
  } catch (error) {
    try {
      written.forEach(index => {
        if (previous[index] === null) localStorage.removeItem(LIBRARY_KEYS[index]);
        else localStorage.setItem(LIBRARY_KEYS[index], previous[index]);
      });
    } catch { throw Error('Restore failed and previous data could not be fully recovered. Keep your backup file.'); }
    throw Error('Restore failed. Previous data was kept. Browser storage may be unavailable or full.');
  }
}

function libraryItems(data) {
  const items = new Map();
  [...data.watchlist, ...data.lists.flatMap(list => list.items)].forEach(item => {
    const key = `${item.type}:${item.id}`;
    items.set(key, { ...item, watched: item.watched || items.get(key)?.watched || false });
  });
  return items;
}

function calculateLibraryStats(data, now = new Date()) {
  const items = libraryItems(data);
  const watched = new Set([...items].filter(([, item]) => item.watched).map(([key]) => key));
  const ratings = [];
  let episodes = 0;
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, count: 0 };
  });
  Object.entries(data.personal).forEach(([key, record]) => {
    if (record.rating !== '') ratings.push(record.rating);
    if (key.startsWith('tv:')) episodes += record.episodes.length;
    if (record.watchedOn) {
      watched.add(key);
      const month = months.find(entry => entry.key === record.watchedOn.slice(0, 7));
      if (month) month.count++;
    }
  });
  return { movies: [...watched].filter(key => key.startsWith('movie:')).length, watched, episodes,
    average: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    rated: ratings.length, months, saved: items.size };
}

function getRecommendationSeeds(data) {
  const items = libraryItems(data);
  const high = Object.entries(data.personal).filter(([, record]) => record.rating >= 8)
    .sort((a, b) => b[1].rating - a[1].rating).map(([key]) => {
      const [type, id] = key.split(':');
      return { id: Number(id), type, title: items.get(key)?.title || '', reason: 'high rating' };
    });
  const seeds = new Map(high.map(item => [`${item.type}:${item.id}`, item]));
  [...items].forEach(([key, item]) => {
    // Rating rendah mengalahkan sinyal dari judul yang masih tersimpan.
    const rating = data.personal[key]?.rating;
    if (!seeds.has(key) && (!rating || rating >= 8)) seeds.set(key, { ...item, reason: 'saved title' });
  });
  return [...seeds.values()].slice(0, 6);
}
