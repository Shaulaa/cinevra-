/* =========================================================
  CINEVRA - js/my-space.js
   My Lists page: create, edit, delete custom lists
   ========================================================= */

// DOM references
let listsGrid, listDetailGrid, emptyState;
let myListsHead, listDetailHead;
let createListBtn, emptyCreateBtn;
let shareListBtn, editListBtn, backToListsBtn;
let listDetailTitle, listDetailMeta;
let currentView = 'grid'; // 'grid' or 'detail'
let currentListId = null;

/**
 * Init: setup DOM refs dan event listeners
 */
function init() {
  listsGrid = document.getElementById('listsGrid');
  listDetailGrid = document.getElementById('listDetailGrid');
  emptyState = document.getElementById('emptyState');
  myListsHead = document.getElementById('myListsHead');
  listDetailHead = document.getElementById('listDetailHead');
  createListBtn = document.getElementById('createListBtn');
  emptyCreateBtn = document.getElementById('emptyCreateBtn');
  shareListBtn = document.getElementById('shareListBtn');
  editListBtn = document.getElementById('editListBtn');
  backToListsBtn = document.getElementById('backToListsBtn');
  listDetailTitle = document.getElementById('listDetailTitle');
  listDetailMeta = document.getElementById('listDetailMeta');

  // check URL parameter untuk list detail
  const params = new URLSearchParams(window.location.search);
  const listId = params.get('list');

  if (listId) {
    renderListDetail(listId);
  } else {
    renderListsGrid();
  }

  // event listeners
  if (createListBtn) createListBtn.addEventListener('click', handleCreateList);
  if (emptyCreateBtn) emptyCreateBtn.addEventListener('click', handleCreateList);
  if (shareListBtn) shareListBtn.addEventListener('click', () => handleShareList(currentListId));
  if (editListBtn) editListBtn.addEventListener('click', () => handleEditList(currentListId));
  if (backToListsBtn) backToListsBtn.addEventListener('click', () => {
    window.history.pushState(null, '', 'my-space.html');
    renderListsGrid();
  });

  // auto-refresh saat lists berubah
  window.addEventListener('lists:change', () => {
    if (currentView === 'grid') {
      renderListsGrid();
    } else if (currentView === 'detail' && currentListId) {
      renderListDetail(currentListId);
    }
  });
}

/**
 * Render grid view dengan semua lists
 */
function renderListsGrid() {
  currentView = 'grid';
  currentListId = null;

  // show/hide sections
  if (myListsHead) myListsHead.hidden = false;
  if (listDetailHead) listDetailHead.hidden = true;
  if (listsGrid) listsGrid.hidden = false;
  if (listDetailGrid) listDetailGrid.hidden = true;

  const lists = getCustomLists();

  if (lists.length === 0) {
    if (listsGrid) listsGrid.innerHTML = '';
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  if (!listsGrid) return;

  listsGrid.innerHTML = '';
  lists.forEach(list => {
    const card = createListCard(list);
    listsGrid.appendChild(card);
  });
}

/**
 * Membuat card untuk satu list
 */
function createListCard(list) {
  const card = document.createElement('article');
  card.className = 'list-card';
  card.setAttribute('data-list-id', list.id);

  // preview posters
  const preview = document.createElement('div');
  preview.className = 'list-card__preview';

  if (list.items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'list-card__empty';
    empty.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
        <rect x="9" y="3" width="6" height="4" rx="1"></rect>
      </svg>
      <span>Empty list</span>
    `;
    preview.appendChild(empty);
  } else {
    // ambil max 4 poster
    const posters = list.items.slice(0, 4);
    posters.forEach(item => {
      const img = document.createElement('img');
      img.src = getImageUrl(item.posterPath, 'posterSmall');
      img.alt = item.title;
      attachImageFallback(img);
      preview.appendChild(img);
    });
  }

  card.appendChild(preview);

  // info
  const info = document.createElement('div');
  info.className = 'list-card__info';

  const name = document.createElement('h3');
  name.className = 'list-card__name';
  name.textContent = list.name;

  const meta = document.createElement('p');
  meta.className = 'list-card__meta';
  const itemCount = list.items.length;
  const itemText = itemCount === 1 ? 'item' : 'items';
  meta.textContent = `${itemCount} ${itemText}`;

  info.appendChild(name);
  info.appendChild(meta);
  card.appendChild(info);

  // actions
  const actions = document.createElement('div');
  actions.className = 'list-card__actions';

  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn-icon';
  shareBtn.setAttribute('aria-label', `Share ${list.name}`);
  shareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>`;
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleShareList(list.id);
  });

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-icon';
  editBtn.setAttribute('aria-label', `Edit ${list.name}`);
  editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
  </svg>`;
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleEditList(list.id);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-icon';
  deleteBtn.setAttribute('aria-label', `Delete ${list.name}`);
  deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"></path>
  </svg>`;
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteList(list.id);
  });

  actions.appendChild(shareBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  // click card untuk buka detail
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.list-card__actions')) {
      window.history.pushState(null, '', `my-space.html?list=${list.id}`);
      renderListDetail(list.id);
    }
  });

  return card;
}

/**
 * Render detail view untuk satu list
 */
async function renderListDetail(listId) {
  const list = getCustomList(listId);
  if (!list) {
    // list tidak ditemukan, redirect ke grid
    window.location.href = 'my-space.html';
    return;
  }

  currentView = 'detail';
  currentListId = listId;

  // show/hide sections
  if (myListsHead) myListsHead.hidden = true;
  if (listDetailHead) listDetailHead.hidden = false;
  if (listsGrid) listsGrid.hidden = true;
  if (listDetailGrid) listDetailGrid.hidden = false;
  if (emptyState) emptyState.hidden = true;

  // update header
  if (listDetailTitle) listDetailTitle.textContent = list.name;
  if (listDetailMeta) {
    const itemCount = list.items.length;
    const itemText = itemCount === 1 ? 'item' : 'items';
    listDetailMeta.textContent = `${itemCount} ${itemText}`;
  }

  if (!listDetailGrid) return;

  // show loading
  listDetailGrid.innerHTML = Array.from({ length: 8 }, () => createCardSkeleton()).map(s => s.outerHTML).join('');

  // fetch movie data dari TMDB
  const itemsWithData = await Promise.all(
    list.items.map(async item => {
      try {
        const data = item.type === 'movie' 
          ? await fetchMovieDetails(item.id)
          : await fetchTVDetails(item.id);
        return { ...item, ...data };
      } catch (error) {
        console.error(`Failed to fetch ${item.type} ${item.id}:`, error);
        return item; // fallback ke data yang ada
      }
    })
  );

  // render cards
  listDetailGrid.innerHTML = '';
  itemsWithData.forEach(item => {
    const card = createMovieCard(item);
    
    // tambahkan remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'movie-card__watch-btn';
    removeBtn.setAttribute('aria-label', `Remove ${item.title || item.name} from list`);
    removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`;
    
    removeBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await removeFromCustomList(listId, item.id, item.type);
      showToast('Dihapus dari daftar', { actionLabel: 'Undo', onAction: async () => { await addToCustomList(listId, item); } });
    });

    const posterWrap = card.querySelector('.movie-card__poster');
    if (posterWrap) {
      posterWrap.appendChild(removeBtn);
    }

    listDetailGrid.appendChild(card);
  });

  // empty state jika tidak ada items
  if (itemsWithData.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'state-block';
    emptyMessage.style.gridColumn = '1 / -1';
    emptyMessage.innerHTML = `
      <svg class="state-block__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
        <rect x="9" y="3" width="6" height="4" rx="1"></rect>
      </svg>
      <h2 class="state-block__title">This list is empty</h2>
      <p class="state-block__desc">Add movies and shows from detail pages to fill this list.</p>
    `;
    listDetailGrid.appendChild(emptyMessage);
  }
}

/**
 * Handle create list
 */
function handleCreateList() {
  openNameDialog({
    title: 'Create New List',
    confirmLabel: 'Create',
    onSubmit: async (name) => {
      const result = await createCustomList(name);
      if (result.error) return result.error;
      showToast(`Daftar "${result.list.name}" berhasil dibuat`);
      return null; // success, close dialog
    }
  });
}

/**
 * Handle edit list name
 */
function handleEditList(listId) {
  const list = getCustomList(listId);
  if (!list) return;

  openNameDialog({
    title: 'Rename List',
    initial: list.name,
    confirmLabel: 'Save',
    onSubmit: async (name) => {
      const result = await renameCustomList(listId, name);
      if (result.error) return result.error;
      showToast('Nama daftar berhasil diubah');
      return null;
    }
  });
}

/**
 * Handle delete list
 */
async function handleDeleteList(listId) {
  const list = getCustomList(listId);
  if (!list) return;

  if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return;

  const snapshot = await deleteCustomList(listId);
  showToast(`Daftar "${list.name}" dihapus`, {
    actionLabel: 'Undo',
    onAction: async () => { await restoreCustomLists(snapshot); },
  });

  // jika sedang di detail view list yang dihapus, redirect ke grid
  if (currentListId === listId) {
    window.history.pushState(null, '', 'my-space.html');
    renderListsGrid();
  }
}

/**
 * Handle share list
 */
function handleShareList(listId) {
  openShareModal(listId);
}

// Initialize saat page load
CinevraCloud.boot(init);

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  const listId = params.get('list');
  if (listId) {
    renderListDetail(listId);
  } else {
    renderListsGrid();
  }
});
