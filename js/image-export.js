/* =========================================================
  CINEVRA - js/image-export.js
   Canvas-based image export untuk share list ke social media.
   4 template: Minimal, Detailed, Grid, Collage
   ========================================================= */

/**
 * Generate image dari list dengan template tertentu.
 * @param {Object} list - List object dengan id, name, items
 * @param {string} template - 'minimal' | 'detailed' | 'grid' | 'collage'
 * @returns {Promise<Blob>} - Image blob untuk download/share
 */
async function generateListImage(list, template = 'minimal') {
  switch (template) {
    case 'minimal':
      return generateMinimalImage(list);
    case 'detailed':
      return generateDetailedImage(list);
    case 'grid':
      return generateGridImage(list);
    case 'collage':
      return generateCollageImage(list);
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

/**
 * Template 1: Minimal (Twitter card 1200x630)
 * Background gradient + list name + item count + 4 poster thumbnails
 */
async function generateMinimalImage(list) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0f1419');
  gradient.addColorStop(1, '#1a1f29');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Logo/Brand (top left)
  ctx.fillStyle = '#e50914';
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.fillText('CINEVRA', 50, 60);

  // List name (center, large)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.textAlign = 'center';
  const listName = truncateText(list.name, 30);
  ctx.fillText(listName, canvas.width / 2, canvas.height / 2 - 80);

  // Item count (below name)
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '28px Arial, sans-serif';
  ctx.fillText(`${list.items.length} titles`, canvas.width / 2, canvas.height / 2 - 30);

  // 4 poster thumbnails (bottom, centered)
  const posterWidth = 120;
  const posterHeight = 180;
  const gap = 20;
  const totalWidth = (posterWidth * 4) + (gap * 3);
  const startX = (canvas.width - totalWidth) / 2;
  const startY = canvas.height - posterHeight - 60;

  const displayItems = list.items.slice(0, 4);
  await Promise.all(
    displayItems.map((item, index) =>
      drawPoster(ctx, item, startX + (posterWidth + gap) * index, startY, posterWidth, posterHeight)
    )
  );

  return canvasToBlob(canvas);
}

/**
 * Template 2: Detailed (Instagram portrait 1080x1350)
 * List name + description + 6 items dengan poster + title
 */
async function generateDetailedImage(list) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0f1419');
  gradient.addColorStop(1, '#1a1f29');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header section
  ctx.fillStyle = '#e50914';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CINEVRA', 60, 80);

  // List name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Arial, sans-serif';
  const listName = truncateText(list.name, 22);
  wrapText(ctx, listName, 60, 160, canvas.width - 120, 60);

  // Item count
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText(`${list.items.length} titles`, 60, 240);

  // Divider line
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 280);
  ctx.lineTo(canvas.width - 60, 280);
  ctx.stroke();

  // Grid of 6 items (2 columns x 3 rows)
  const posterWidth = 160;
  const posterHeight = 240;
  const colGap = 60;
  const rowGap = 40;
  const col1X = 60;
  const col2X = col1X + posterWidth + colGap + 180; // 180 for text space
  let currentY = 340;

  const displayItems = list.items.slice(0, 6);
  
  for (let i = 0; i < displayItems.length; i++) {
    const item = displayItems[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? col1X : col2X;
    const y = currentY + row * (posterHeight + rowGap);

    // Draw poster
    await drawPoster(ctx, item, x, y, posterWidth, posterHeight);

    // Draw title next to poster
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'left';
    const titleLines = wrapText(
      ctx,
      truncateText(item.title, 25),
      x + posterWidth + 20,
      y + 30,
      160,
      28
    );

    // Draw year/rating
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '16px Arial, sans-serif';
    const metaY = y + 30 + titleLines * 28 + 10;
    ctx.fillText(item.year || 'N/A', x + posterWidth + 20, metaY);
    
    // Rating with star
    if (item.rating) {
      ctx.fillStyle = '#ffd700';
      ctx.fillText('★', x + posterWidth + 20, metaY + 25);
      ctx.fillStyle = '#a0a0a0';
      ctx.fillText(formatRating(item.rating), x + posterWidth + 40, metaY + 25);
    }
  }

  return canvasToBlob(canvas);
}

/**
 * Template 3: Grid (Instagram square 1080x1080)
 * 4x4 grid of posters (16 items max)
 */
async function generateGridImage(list) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f1419';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header bar
  ctx.fillStyle = '#1a1f29';
  ctx.fillRect(0, 0, canvas.width, 120);

  // Logo
  ctx.fillStyle = '#e50914';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CINEVRA', 40, 50);

  // List name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial, sans-serif';
  const listName = truncateText(list.name, 30);
  ctx.fillText(listName, 40, 95);

  // Item count (right side)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText(`${list.items.length} titles`, canvas.width - 40, 75);

  // Grid of posters (4x4)
  const gridSize = 4;
  const posterSize = 220;
  const gap = 10;
  const gridWidth = (posterSize * gridSize) + (gap * (gridSize - 1));
  const startX = (canvas.width - gridWidth) / 2;
  const startY = 150;

  const displayItems = list.items.slice(0, 16);

  await Promise.all(
    displayItems.map((item, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      const x = startX + col * (posterSize + gap);
      const y = startY + row * (posterSize + gap);
      return drawPoster(ctx, item, x, y, posterSize, posterSize * 1.5);
    })
  );

  // If less than 16 items, show count on remaining slots
  if (displayItems.length < 16) {
    for (let i = displayItems.length; i < 16; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      const x = startX + col * (posterSize + gap);
      const y = startY + row * (posterSize + gap);

      // Empty slot
      ctx.fillStyle = '#1a1f29';
      ctx.fillRect(x, y, posterSize, posterSize * 1.5);
    }
  }

  return canvasToBlob(canvas);
}

/**
 * Template 4: Collage (1200x1200)
 * Large central poster + smaller surrounding posters + list info
 */
async function generateCollageImage(list) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');

  // Background
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2
  );
  gradient.addColorStop(0, '#1a1f29');
  gradient.addColorStop(1, '#0f1419');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (list.items.length === 0) {
    // Empty list fallback
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Empty List', canvas.width / 2, canvas.height / 2);
    return canvasToBlob(canvas);
  }

  // Large central poster
  const centerPosterWidth = 300;
  const centerPosterHeight = 450;
  const centerX = (canvas.width - centerPosterWidth) / 2;
  const centerY = (canvas.height - centerPosterHeight) / 2 + 40;

  await drawPoster(ctx, list.items[0], centerX, centerY, centerPosterWidth, centerPosterHeight);

  // Surrounding smaller posters (8 items in circle)
  const smallPosterWidth = 140;
  const smallPosterHeight = 210;
  const radius = 400;
  const angleStep = (Math.PI * 2) / Math.min(8, list.items.length - 1);

  for (let i = 1; i < Math.min(9, list.items.length); i++) {
    const angle = angleStep * (i - 1) - Math.PI / 2;
    const x = canvas.width / 2 + Math.cos(angle) * radius - smallPosterWidth / 2;
    const y = canvas.height / 2 + Math.sin(angle) * radius - smallPosterHeight / 2;

    // Semi-transparent background for depth
    ctx.globalAlpha = 0.7;
    await drawPoster(ctx, list.items[i], x, y, smallPosterWidth, smallPosterHeight);
    ctx.globalAlpha = 1.0;
  }

  // Top banner with list info
  ctx.fillStyle = 'rgba(15, 20, 25, 0.9)';
  ctx.fillRect(0, 0, canvas.width, 100);

  ctx.fillStyle = '#e50914';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CINEVRA', 50, 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.textAlign = 'center';
  const listName = truncateText(list.name, 35);
  ctx.fillText(listName, canvas.width / 2, 70);

  // Bottom bar with item count
  ctx.fillStyle = 'rgba(15, 20, 25, 0.9)';
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

  ctx.fillStyle = '#a0a0a0';
  ctx.font = '24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${list.items.length} amazing titles`, canvas.width / 2, canvas.height - 35);

  return canvasToBlob(canvas);
}

/**
 * Draw poster image on canvas dengan fallback untuk missing posters
 */
async function drawPoster(ctx, item, x, y, width, height) {
  const posterUrl = getImageUrl(item.posterPath, 'poster');

  if (!posterUrl) {
    // Fallback: colored rectangle dengan initial
    ctx.fillStyle = '#2a2f3a';
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(height / 4)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.title.charAt(0).toUpperCase(), x + width / 2, y + height / 2);
    return;
  }

  try {
    const img = await loadImage(posterUrl);

    // Draw dengan aspect ratio preserved
    const aspectRatio = img.width / img.height;
    const targetAspectRatio = width / height;

    let drawWidth, drawHeight, drawX, drawY;

    if (aspectRatio > targetAspectRatio) {
      // Image lebih lebar, crop sides
      drawHeight = height;
      drawWidth = height * aspectRatio;
      drawX = x - (drawWidth - width) / 2;
      drawY = y;
    } else {
      // Image lebih tinggi, crop top/bottom
      drawWidth = width;
      drawHeight = width / aspectRatio;
      drawX = x;
      drawY = y - (drawHeight - height) / 2;
    }

    // Clip to bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  } catch (error) {
    console.error('Failed to load poster:', error);
    // Fallback sama seperti no poster
    ctx.fillStyle = '#2a2f3a';
    ctx.fillRect(x, y, width, height);
  }
}

/**
 * Load image dengan Promise untuk async/await
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // CORS support
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Convert canvas ke Blob untuk download/share
 */
function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}

/**
 * Wrap text ke beberapa baris dengan max width
 * @returns {number} - jumlah baris yang dirender
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = words[i] + ' ';
      lineCount++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y + lineCount * lineHeight);
  lineCount++;

  return lineCount;
}

/**
 * Truncate text dengan ellipsis
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Download image blob sebagai file
 */
function downloadImage(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open image export dialog dengan preview dan template selection
 */
async function openImageExportDialog(listId) {
  let list;
  if (listId === 'watchlist') {
    list = {
      id: 'watchlist',
      name: 'My Watchlist',
      items: getWatchlist(),
    };
  } else {
    list = getCustomList(listId);
  }

  if (!list || list.items.length === 0) {
    showToast('Daftar kosong, tidak bisa diexport sebagai gambar');
    return;
  }

  const dialog = createDialog('dialog--image-export');
  const body = document.createElement('div');
  body.className = 'dialog__body';

  // Header
  body.appendChild(buildDialogHeader('Export as Image', `${list.name} (${list.items.length} items)`));

  // Template selection
  const templateSection = document.createElement('div');
  templateSection.className = 'image-export-templates';

  const templates = [
    { id: 'minimal', name: 'Minimal', desc: 'Twitter card (1200x630)', icon: '🎴' },
    { id: 'detailed', name: 'Detailed', desc: 'Instagram portrait (1080x1350)', icon: '📋' },
    { id: 'grid', name: 'Grid', desc: 'Instagram square (1080x1080)', icon: '▦' },
    { id: 'collage', name: 'Collage', desc: 'Large collage (1200x1200)', icon: '🎨' },
  ];

  let selectedTemplate = 'minimal';

  templates.forEach((template) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `template-btn${template.id === selectedTemplate ? ' is-active' : ''}`;
    btn.innerHTML = `
      <span class="template-btn__icon">${template.icon}</span>
      <span class="template-btn__name">${template.name}</span>
      <span class="template-btn__desc">${template.desc}</span>
    `;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.template-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedTemplate = template.id;
    });
    templateSection.appendChild(btn);
  });

  body.appendChild(templateSection);

  // Progress indicator
  const progressEl = document.createElement('p');
  progressEl.className = 'dialog__hint';
  progressEl.style.display = 'none';
  progressEl.textContent = 'Generating image...';
  body.appendChild(progressEl);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'dialog__footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => dialog.close());

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn--primary';
  exportBtn.textContent = 'Generate & Download';
  exportBtn.addEventListener('click', async () => {
    try {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Generating...';
      progressEl.style.display = 'block';

      const blob = await generateListImage(list, selectedTemplate);
      const filename = `cinevra-${list.name.toLowerCase().replace(/\s+/g, '-')}-${selectedTemplate}.png`;
      downloadImage(blob, filename);

      showToast('Gambar berhasil didownload!');
      dialog.close();
    } catch (error) {
      console.error('Failed to generate image:', error);
      showToast('Gagal membuat gambar. Silakan coba lagi.');
      exportBtn.disabled = false;
      exportBtn.textContent = 'Generate & Download';
      progressEl.style.display = 'none';
    }
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(exportBtn);
  body.appendChild(footer);

  dialog.appendChild(body);
  dialog.showModal();
}
