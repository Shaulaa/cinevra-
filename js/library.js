/* =========================================================
  CINEVRA - js/library.js
   Share Manager: fungsi untuk sharing custom lists
   - URL encoding/decoding untuk shareable links
   - Social media integrations
   - Canvas image export
   ========================================================= */

/* =========================================================
   URL ENCODING/DECODING
   Format hash: #v=1&n=encoded_name&d=encoded_desc&i=id1:m,id2:t,...
   - v: version (untuk backward compatibility)
   - n: list name (URL encoded)
   - d: description (optional, URL encoded)
   - i: items (comma-separated id:type pairs, m=movie, t=tv)
   ========================================================= */

/**
 * Encode list data menjadi shareable URL dengan hash parameters.
 * @param {Object} list - { name, description?, items: [{ id, type, ... }] }
 * @param {string} baseURL - base URL untuk shared view (default: shared.html)
 * @returns {string} - complete URL dengan encoded hash
 */
function encodeListToURL(list, baseURL = 'shared.html') {
  if (!list || !list.name) return '';
  
  // batasi items maksimal 100 untuk URL yang tidak terlalu panjang
  const items = (list.items || []).slice(0, 100);
  
  // encode items: id:type dengan type disingkat (m/t)
  const itemsStr = items
    .map(item => `${item.id}:${item.type === 'movie' ? 'm' : 't'}`)
    .join(',');
  
  // build hash parameters
  const params = new URLSearchParams({
    v: '1',
    n: list.name,
    i: itemsStr
  });
  
  // tambahkan description jika ada
  if (list.description) {
    params.set('d', list.description);
  }
  
  // gabungkan base URL dengan hash
  const origin = window.location.origin + window.location.pathname.replace(/[^\/]+$/, '');
  return `${origin}${baseURL}#${params.toString()}`;
}

/**
 * Decode URL hash menjadi list data.
 * @param {string} urlString - full URL atau hash string
 * @returns {Object|null} - { name, description?, items: [{ id, type }] } atau null jika invalid
 */
function decodeURLToListData(urlString) {
  try {
    // extract hash dari URL
    let hash = urlString;
    if (urlString.includes('#')) {
      hash = urlString.split('#')[1];
    }
    if (!hash) return null;
    
    // parse parameters
    const params = new URLSearchParams(hash);
    const version = params.get('v');
    const name = params.get('n');
    const itemsStr = params.get('i');
    
    // validasi basic
    if (!version || !name || !itemsStr) return null;
    
    // parse items
    const itemPairs = itemsStr.split(',').filter(Boolean);
    const items = itemPairs
      .map(pair => {
        const [id, typeCode] = pair.split(':');
        const numId = parseInt(id, 10);
        if (!numId || !typeCode) return null;
        
        const type = typeCode === 'm' ? 'movie' : typeCode === 't' ? 'tv' : null;
        if (!type) return null;
        
        return { id: numId, type };
      })
      .filter(Boolean);
    
    if (items.length === 0) return null;
    
    const result = {
      name,
      items
    };
    
    // tambahkan description jika ada
    const description = params.get('d');
    if (description) {
      result.description = description;
    }
    
    return result;
  } catch (error) {
    console.error('Failed to decode URL:', error);
    return null;
  }
}

/**
 * Validasi encoded list data.
 * @param {Object} data - decoded list data
 * @returns {string|null} - error message atau null jika valid
 */
function validateEncodedList(data) {
  if (!data) return 'Invalid list data';
  if (!data.name || data.name.length > 100) return 'List name is invalid or too long';
  if (!Array.isArray(data.items)) return 'Items must be an array';
  if (data.items.length === 0) return 'List must have at least one item';
  if (data.items.length > 100) return 'List has too many items (max 100)';
  
  // validasi setiap item
  for (const item of data.items) {
    if (!item.id || typeof item.id !== 'number') return 'Invalid item ID';
    if (item.type !== 'movie' && item.type !== 'tv') return 'Invalid item type';
  }
  
  return null;
}


/* =========================================================
   SHARE MODAL
   ========================================================= */

/**
 * Membuka share modal untuk list atau watchlist.
 * @param {string} listId - ID list atau 'watchlist' untuk watchlist utama
 */
function openShareModal(listId) {
  if (document.querySelector('.dialog--share')) return; // prevent double modal

  let list;
  if (listId === 'watchlist') {
    const watchlist = getWatchlist();
    list = {
      id: 'watchlist',
      name: 'My Watchlist',
      items: watchlist
    };
  } else {
    list = getCustomList(listId);
  }

  if (!list) {
    showToast('Daftar tidak ditemukan');
    return;
  }

  const dialog = createDialog('dialog--share');
  const body = document.createElement('div');
  body.className = 'dialog__body';

  // Header
  body.appendChild(buildDialogHeader(`Share "${list.name}"`, `${list.items.length} items`));

  // Shareable URL section
  const urlSection = document.createElement('div');
  urlSection.className = 'share-section';

  const urlTitle = document.createElement('h3');
  urlTitle.className = 'share-section__title';
  urlTitle.textContent = 'Share link';
  urlSection.appendChild(urlTitle);

  const shareUrl = encodeListToURL(list);
  const urlContainer = document.createElement('div');
  urlContainer.className = 'share-url';

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.className = 'share-url__input';
  urlInput.value = shareUrl;
  urlInput.readOnly = true;
  urlInput.id = 'shareUrlInput';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn--outline';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copyBtn.textContent = 'Tersalin!';
      showToast('Link berhasil disalin ke clipboard');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    } catch (error) {
      // Fallback untuk browser yang tidak support clipboard API
      urlInput.select();
      document.execCommand('copy');
      copyBtn.textContent = 'Tersalin!';
      showToast('Link berhasil disalin ke clipboard');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    }
  });

  urlContainer.appendChild(urlInput);
  urlContainer.appendChild(copyBtn);
  urlSection.appendChild(urlContainer);
  body.appendChild(urlSection);

  // Social media section
  const socialSection = document.createElement('div');
  socialSection.className = 'share-section';

  const socialTitle = document.createElement('h3');
  socialTitle.className = 'share-section__title';
  socialTitle.textContent = 'Share to';
  socialSection.appendChild(socialTitle);

  const socialButtons = document.createElement('div');
  socialButtons.className = 'share-buttons';

  // Check Web Share API support first (for mobile)
  if (navigator.share) {
    const nativeShareBtn = document.createElement('button');
    nativeShareBtn.className = 'share-btn share-btn--native';
    nativeShareBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
      Share...
    `;
    nativeShareBtn.addEventListener('click', () => shareViaWebShareAPI(list, shareUrl));
    socialButtons.appendChild(nativeShareBtn);
  }

  // Twitter button
  const twitterBtn = document.createElement('button');
  twitterBtn.className = 'share-btn share-btn--twitter';
  twitterBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
    Twitter
  `;
  twitterBtn.addEventListener('click', () => shareToTwitter(list, shareUrl));
  socialButtons.appendChild(twitterBtn);

  // Facebook button
  const facebookBtn = document.createElement('button');
  facebookBtn.className = 'share-btn share-btn--facebook';
  facebookBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
    Facebook
  `;
  facebookBtn.addEventListener('click', () => shareToFacebook(shareUrl));
  socialButtons.appendChild(facebookBtn);

  // WhatsApp button
  const whatsappBtn = document.createElement('button');
  whatsappBtn.className = 'share-btn share-btn--whatsapp';
  whatsappBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
    WhatsApp
  `;
  whatsappBtn.addEventListener('click', () => shareToWhatsApp(list, shareUrl));
  socialButtons.appendChild(whatsappBtn);

  socialSection.appendChild(socialButtons);
  body.appendChild(socialSection);

  // Image export section
  const imageSection = document.createElement('div');
  imageSection.className = 'share-section';

  const imageTitle = document.createElement('h3');
  imageTitle.className = 'share-section__title';
  imageTitle.textContent = 'Export as image';
  imageSection.appendChild(imageTitle);

  const imageDesc = document.createElement('p');
  imageDesc.className = 'dialog__hint';
  imageDesc.textContent = 'Generate beautiful images to share on social media.';
  imageSection.appendChild(imageDesc);

  const imageBtn = document.createElement('button');
  imageBtn.className = 'btn btn--outline';
  imageBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    Create Image
  `;
  imageBtn.addEventListener('click', () => {
    dialog.close();
    openImageExportDialog(list.id);
  });
  imageSection.appendChild(imageBtn);

  body.appendChild(imageSection);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'dialog__footer';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn--ghost';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => dialog.close());

  footer.appendChild(closeBtn);
  body.appendChild(footer);

  dialog.appendChild(body);
  dialog.showModal();

  // Focus copy button
  copyBtn.focus();

  // Close on Escape
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dialog.close();
    }
  });
}


/* =========================================================
   SOCIAL MEDIA SHARING FUNCTIONS
   ========================================================= */

/**
 * Share list ke Twitter/X.
 * @param {Object} list - list object
 * @param {string} url - shareable URL
 */
function shareToTwitter(list, url) {
  const text = `Check out my "${list.name}" list on Cinevra`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  
  try {
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  } catch (error) {
    console.error('Failed to open Twitter share:', error);
    showToast('Tidak bisa membuka Twitter. Cek pengaturan popup blocker Anda.');
  }
}

/**
 * Share list ke Facebook.
 * @param {string} url - shareable URL
 */
function shareToFacebook(url) {
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  
  try {
    window.open(facebookUrl, '_blank', 'width=550,height=420');
  } catch (error) {
    console.error('Failed to open Facebook share:', error);
    showToast('Tidak bisa membuka Facebook. Cek pengaturan popup blocker Anda.');
  }
}

/**
 * Share list ke WhatsApp.
 * @param {Object} list - list object
 * @param {string} url - shareable URL
 */
function shareToWhatsApp(list, url) {
  const text = `Check out my "${list.name}" list on Cinevra: ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  
  try {
    window.open(whatsappUrl, '_blank');
  } catch (error) {
    console.error('Failed to open WhatsApp share:', error);
    showToast('Tidak bisa membuka WhatsApp. Cek pengaturan popup blocker Anda.');
  }
}

/**
 * Share list menggunakan Web Share API (native mobile sharing).
 * @param {Object} list - list object
 * @param {string} url - shareable URL
 */
async function shareViaWebShareAPI(list, url) {
  if (!navigator.share) {
    showToast('Fitur share tidak didukung di browser ini');
    return;
  }

  try {
    await navigator.share({
      title: list.name,
      text: `Check out my "${list.name}" list on Cinevra`,
      url: url
    });
  } catch (error) {
    // AbortError terjadi ketika user cancel share dialog, ini normal
    if (error.name !== 'AbortError') {
      console.error('Share failed:', error);
      showToast('Gagal membagikan. Silakan coba metode lain.');
    }
  }
}
