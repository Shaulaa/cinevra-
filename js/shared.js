/* =========================================================
  CINEVRA - js/shared.js
   Shared list view: display list from shareable URL
   ========================================================= */

// DOM references
let sharedHeader, sharedTitle, sharedMeta, sharedDescription;
let sharedGrid, errorState;
let importListBtn;
let listData = null;

/**
 * Init: parse URL dan load list
 */
async function init() {
  sharedHeader = document.getElementById('sharedHeader');
  sharedTitle = document.getElementById('sharedTitle');
  sharedMeta = document.getElementById('sharedMeta');
  sharedDescription = document.getElementById('sharedDescription');
  sharedGrid = document.getElementById('sharedGrid');
  errorState = document.getElementById('errorState');
  importListBtn = document.getElementById('importListBtn');

  // Parse URL hash
  const hash = window.location.hash;
  if (!hash) {
    showError('No list data found in URL');
    return;
  }

  // Decode list data
  listData = decodeURLToListData(hash);
  if (!listData) {
    showError('Invalid list data in URL');
    return;
  }

  // Validate
  const validationError = validateEncodedList(listData);
  if (validationError) {
    showError(validationError);
    return;
  }

  // Show header
  if (sharedHeader) sharedHeader.hidden = false;
  if (sharedTitle) sharedTitle.textContent = listData.name;
  if (sharedMeta) {
    const itemCount = listData.items.length;
    const itemText = itemCount === 1 ? 'item' : 'items';
    sharedMeta.textContent = `${itemCount} ${itemText} · Shared from Cinevra`;
  }
  if (sharedDescription && listData.description) {
    sharedDescription.textContent = listData.description;
    sharedDescription.hidden = false;
  }

  // Show import button jika localStorage available
  if (importListBtn && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      importListBtn.hidden = false;
      importListBtn.addEventListener('click', handleImport);
    } catch (error) {
      // localStorage tidak available (private mode, dll)
      importListBtn.hidden = true;
    }
  }

  // Update meta tags
  updateMetaTags({
    title: `${listData.name} - Shared List`,
    description: listData.description || `A curated list of ${listData.items.length} movies and TV shows shared on Cinevra`
  });

  // Load dan render items
  await loadAndRenderItems();
}

/**
 * Load items dari TMDB dan render grid
 */
async function loadAndRenderItems() {
  if (!sharedGrid) return;

  // Show loading skeletons
  sharedGrid.innerHTML = Array.from({ length: Math.min(listData.items.length, 12) }, () => 
    createCardSkeleton()
  ).map(s => s.outerHTML).join('');

  // Fetch items dari TMDB dengan retry
  const itemsWithData = await fetchListItems(listData.items);

  // Render cards
  sharedGrid.innerHTML = '';
  itemsWithData.forEach(item => {
    const card = createMovieCard(item);
    sharedGrid.appendChild(card);
  });

  // Empty state jika semua fetch gagal
  if (itemsWithData.length === 0) {
    showError('Could not load list items. Please check your connection and try again.');
  }
}

/**
 * Fetch list items dari TMDB dengan retry logic
 */
async function fetchListItems(items) {
  const results = [];
  const maxRetries = 3;

  for (const item of items) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const data = item.type === 'movie'
          ? await fetchMovieDetails(item.id)
          : await fetchTVDetails(item.id);
        
        results.push({
          ...data,
          type: item.type
        });
        success = true;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          console.error(`Failed to fetch ${item.type} ${item.id} after ${maxRetries} attempts:`, error);
          // Use minimal data sebagai fallback
          results.push({
            id: item.id,
            type: item.type,
            title: item.type === 'movie' ? 'Movie' : 'TV Show',
            name: item.type === 'tv' ? 'TV Show' : undefined,
            poster_path: null,
            vote_average: 0,
            release_date: '',
            first_air_date: ''
          });
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }
  }

  return results;
}

/**
 * Show error state
 */
function showError(message) {
  if (sharedHeader) sharedHeader.hidden = true;
  if (sharedGrid) sharedGrid.hidden = true;
  if (errorState) {
    errorState.hidden = false;
    const errorDesc = document.getElementById('errorDesc');
    if (errorDesc) errorDesc.textContent = message;
  }
}

/**
 * Handle import list
 */
function handleImport() {
  if (!listData) return;

  const result = importSharedList(listData);
  if (result.error) {
    showToast(result.error); // error already in Bahasa Indonesia from main.js
    return;
  }

  showToast(`Daftar "${result.list.name}" berhasil disimpan!`);
  
  // Redirect ke my-space setelah 1.5 detik
  setTimeout(() => {
    window.location.href = `my-space.html?list=${result.list.id}`;
  }, 1500);
}

// Initialize saat page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Init navbar
initNavbarToggle();
initMobileSearchToggle();
initNavbarSearch();
initSurpriseMeButton();
highlightActiveNavLink();
