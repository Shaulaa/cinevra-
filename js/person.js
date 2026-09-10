/* =========================================================
  CINEVRA - js/person.js
   Logic untuk person.html (profil aktor/crew).
   Diakses lewat: person.html?id=123
   ========================================================= */

let filmographyItems = []; // menyimpan semua data filmography, difilter ulang saat ganti tab

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    showPersonError();
    return;
  }

  loadPerson(id);
  bindFilmographyTabs();
});

async function loadPerson(id) {
  showPageProgress();
  try {
    const [person, credits] = await Promise.all([
      fetchPersonDetails(id),
      fetchPersonCombinedCredits(id),
    ]);

    renderPerson(person);
    prepareFilmography(credits);
    renderFilmography('all');
  } catch (error) {
    console.error('Gagal memuat data person:', error);
    showPersonError();
  } finally {
    hidePageProgress();
  }
}

function renderPerson(person) {
  document.title = `${person.name} - Cinevra`;

  const photoUrl = getImageUrl(person.profile_path, 'poster');
  const photoWrap = document.getElementById('personPhoto');
  photoWrap.innerHTML = '';
  if (photoUrl) {
    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = person.name; // aman: properti .alt, bukan innerHTML
    attachImageFallback(img);
    photoWrap.appendChild(img);
  }

  document.getElementById('personName').textContent = person.name;

  const metaWrap = document.getElementById('personMeta');
  metaWrap.innerHTML = '';
  const metaItems = [];

  if (person.known_for_department) {
    metaItems.push(['Known For', person.known_for_department]);
  }
  if (person.birthday) {
    metaItems.push(['Birthday', formatPersonDate(person.birthday)]);
  }
  if (person.place_of_birth) {
    metaItems.push(['Place of Birth', person.place_of_birth]);
  }
  if (person.deathday) {
    metaItems.push(['Died', formatPersonDate(person.deathday)]);
  }

  // known_for_department & place_of_birth berasal dari TMDB (bisa berisi
  // karakter apa saja), jadi dirender lewat textContent, bukan innerHTML
  metaItems.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'person-info__meta-item';

    const labelEl = document.createElement('span');
    labelEl.className = 'person-info__meta-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'person-info__meta-value';
    valueEl.textContent = value;

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    metaWrap.appendChild(item);
  });

  const bioEl = document.getElementById('personBio');
  const toggleBtn = document.getElementById('bioToggleBtn');
  bioEl.textContent = person.biography || 'Belum ada biografi untuk orang ini.';

  // tombol "Read more" cuma muncul kalau teksnya kepotong (lebih dari 6 baris)
  requestAnimationFrame(() => {
    if (bioEl.scrollHeight > bioEl.clientHeight + 4) {
      toggleBtn.style.display = 'inline-block';
    }
  });

  toggleBtn.addEventListener('click', () => {
    const isClamped = bioEl.classList.toggle('is-clamped');
    toggleBtn.textContent = isClamped ? 'Read more' : 'Show less';
  });
}

function formatPersonDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Menggabungkan cast movie & TV dari combined_credits jadi satu daftar,
 * menghapus duplikat (kadang satu judul muncul 2x kalau orangnya
 * berperan lebih dari satu karakter), lalu urutkan dari yang paling populer.
 */
function prepareFilmography(credits) {
  const rawList = (credits && credits.cast) || [];
  const seen = new Set();
  const deduped = [];

  rawList.forEach((item) => {
    const key = `${item.media_type}-${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });

  deduped.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  filmographyItems = deduped;
}

function bindFilmographyTabs() {
  document.querySelectorAll('.filmography-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filmography-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      renderFilmography(tab.dataset.filter);
    });
  });
}

function renderFilmography(filter) {
  const grid = document.getElementById('filmographyGrid');
  const emptyState = document.getElementById('filmographyEmpty');
  grid.innerHTML = '';

  const items =
    filter === 'all' ? filmographyItems : filmographyItems.filter((i) => i.media_type === filter);

  if (items.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  items.slice(0, 24).forEach((item, index) => {
    const card = createMovieCard({
      id: item.id,
      type: item.media_type,
      title: item.media_type === 'movie' ? item.title : item.name,
      posterPath: item.poster_path,
      rating: item.vote_average,
      year: formatYear(item.media_type === 'movie' ? item.release_date : item.first_air_date),
    });
    grid.appendChild(card);
    observeReveal(card, index % 10);
  });
}

function showPersonError() {
  document.getElementById('personContent').style.display = 'none';
  document.getElementById('personErrorState').style.display = 'flex';
}
