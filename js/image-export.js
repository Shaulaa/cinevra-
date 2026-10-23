/* =========================================================
   CINEVRA gambar daftar untuk dibagikan
   Warna dan font mengikuti token tampilan situs.
   ========================================================= */

const LIST_IMAGE_TEMPLATES = [
  { id: 'minimal', name: 'Minimal', desc: 'Landscape', width: 1200, height: 630, limit: 3, icon: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h4M7 14h7"/>' },
  { id: 'detailed', name: 'Detailed', desc: 'Portrait', width: 1080, height: 1350, limit: 6, icon: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>' },
  { id: 'grid', name: 'Grid', desc: 'Square', width: 1080, height: 1080, limit: 16, icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
  { id: 'collage', name: 'Collage', desc: 'Poster showcase', width: 1200, height: 1200, limit: 5, icon: '<rect x="3" y="3" width="8" height="18" rx="1"/><rect x="14" y="3" width="7" height="8" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
];

async function generateListImage(list, template = 'minimal') {
  const layout = LIST_IMAGE_TEMPLATES.find(option => option.id === template);
  if (!layout) throw new Error(`Unknown template: ${template}`);
  const styles = getComputedStyle(document.documentElement);
  const token = name => styles.getPropertyValue(name).trim();
  const theme = {
    bg: token('--bg'), surface: token('--surface'), border: token('--border'),
    text: token('--text-primary'), muted: token('--text-secondary'), gold: token('--accent-gold'),
    display: token('--font-display'), body: token('--font-body'),
  };
  if (document.fonts) {
    await Promise.all([document.fonts.load(`600 56px ${theme.display}`), document.fonts.load(`500 24px ${theme.body}`)]);
  }
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = theme.gold;
  ctx.font = `600 32px ${theme.display}`;
  ctx.fillText('Cinevra', 60, 72);
  ctx.fillStyle = theme.muted;
  ctx.font = `500 19px ${theme.body}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${list.items.length} ${list.items.length === 1 ? 'title' : 'titles'}`, canvas.width - 60, 70);
  ctx.textAlign = 'left';

  const landscape = template === 'minimal';
  ctx.fillStyle = theme.text;
  ctx.font = `600 ${landscape ? 54 : 52}px ${theme.display}`;
  const headingY = landscape ? 202 : 148;
  const lines = drawImageText(ctx, list.name, 60, headingY, landscape ? 510 : canvas.width - 120, 62, 2);
  if (list.description && template !== 'grid') {
    ctx.fillStyle = theme.muted;
    ctx.font = `400 22px ${theme.body}`;
    drawImageText(ctx, list.description, 60, headingY + lines * 62 + 20, landscape ? 480 : canvas.width - 120, 32, landscape ? 3 : 2);
  }

  const items = list.items.slice(0, layout.limit);
  if (template === 'minimal') {
    const width = 148, gap = 18;
    const startX = 630 + (3 - items.length) * (width + gap) / 2;
    await Promise.all(items.map((item, index) => drawPoster(ctx, item, startX + index * (width + gap), 172, width, 222, theme)));
  } else if (template === 'detailed') {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const x = 60 + (index % 2) * 492;
      const y = 360 + Math.floor(index / 2) * 276;
      await drawPoster(ctx, item, x, y, 140, 210, theme);
      ctx.fillStyle = theme.text;
      ctx.font = `600 23px ${theme.body}`;
      const titleLines = drawImageText(ctx, item.title, x + 160, y + 32, 250, 31, 3);
      ctx.fillStyle = theme.muted;
      ctx.font = `400 19px ${theme.body}`;
      ctx.fillText([item.year, item.type === 'tv' ? 'TV show' : 'Movie'].filter(Boolean).join(' ? '), x + 160, y + 56 + titleLines * 31);
      if (Number(item.rating) > 0) {
        ctx.fillStyle = theme.gold;
        ctx.fillText(`${Number(item.rating).toFixed(1)} / 10`, x + 160, y + 90 + titleLines * 31);
      }
    }
  } else if (template === 'grid') {
    const columns = items.length <= 4 ? 2 : items.length <= 9 ? 3 : 4;
    const rows = Math.ceil(items.length / columns);
    const gap = 16;
    const size = Math.min((960 - gap * (columns - 1)) / columns, (740 - gap * (rows - 1)) / rows);
    const startX = (canvas.width - columns * size - (columns - 1) * gap) / 2;
    await Promise.all(items.map((item, index) => drawPoster(ctx, item, startX + (index % columns) * (size + gap), 240 + Math.floor(index / columns) * (size + gap), size, size, theme)));
  } else if (items.length) {
    if (items.length === 1) {
      await drawPoster(ctx, items[0], 360, 320, 480, 720, theme);
    } else {
      await drawPoster(ctx, items[0], 104, 320, 480, 720, theme);
      await Promise.all(items.slice(1).map((item, index) => drawPoster(ctx, item, 608 + (index % 2) * 256, 320 + Math.floor(index / 2) * 372, 232, 348, theme)));
    }
  }

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, canvas.height - 88);
  ctx.lineTo(canvas.width - 60, canvas.height - 88);
  ctx.stroke();
  ctx.fillStyle = theme.muted;
  ctx.font = `400 18px ${theme.body}`;
  ctx.textAlign = 'left';
  ctx.fillText('Movies & TV, collected on Cinevra', 60, canvas.height - 46);
  const remaining = list.items.length - items.length;
  if (remaining > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.gold;
    ctx.fillText(`+${remaining} more in this list`, canvas.width - 60, canvas.height - 46);
  }
  return canvasToBlob(canvas);
}

// Batasi jumlah baris sekaligus potong kata panjang supaya teks tidak menabrak poster.
function drawImageText(ctx, value, x, y, maxWidth, lineHeight, maxLines) {
  const characters = Array.from(String(value || '').replace(/\s+/g, ' ').trim());
  const lines = [];
  let line = '';
  for (const character of characters) {
    if (line && ctx.measureText(line + character).width > maxWidth) {
      lines.push(line.trim());
      line = '';
      if (lines.length === maxLines) break;
    }
    line += character;
  }
  if (lines.length < maxLines && line) lines.push(line.trim());
  if (lines.length === maxLines && lines.join('').length < characters.join('').replace(/ /g, '').length) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '?').width > maxWidth) last = Array.from(last).slice(0, -1).join('');
    lines[maxLines - 1] = last.trimEnd() + '?';
  }
  lines.forEach((text, index) => ctx.fillText(text, x, y + index * lineHeight));
  return lines.length;
}

async function drawPoster(ctx, item, x, y, width, height, theme) {
  const url = getImageUrl(item.posterPath, 'poster');
  let image = null;
  if (url) {
    try { image = await loadImage(url); } catch { /* Poster gagal tetap punya judul pengganti. */ }
  }
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.clip();
  ctx.fillStyle = theme.surface;
  ctx.fillRect(x, y, width, height);
  if (image) {
    const scale = Math.max(width / image.width, height / image.height);
    ctx.drawImage(image, x + (width - image.width * scale) / 2, y + (height - image.height * scale) / 2, image.width * scale, image.height * scale);
  } else {
    ctx.fillStyle = theme.gold;
    ctx.font = `600 ${Math.round(width / 3)}px ${theme.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Array.from(item.title || '?')[0].toUpperCase(), x + width / 2, y + height * 0.42);
    ctx.font = `400 ${Math.max(12, Math.round(width / 12))}px ${theme.body}`;
    ctx.fillStyle = theme.muted;
    ctx.textBaseline = 'alphabetic';
    drawImageText(ctx, item.title, x + width / 2, y + height * 0.7, width - 24, width / 9, 2);
  }
  ctx.restore();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => { image.src = ''; reject(new Error('Poster took too long to load')); }, 8000);
    image.crossOrigin = 'anonymous';
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('Poster unavailable')); };
    image.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create image')), 'image/png');
  });
}

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

// Preview selalu sesuai template yang terpilih, termasuk saat gambar masih dimuat.
async function openImageExportDialog(listId) {
  if (document.querySelector('.dialog--image-export')) return;
  const list = listId === 'watchlist'
    ? { id: 'watchlist', name: 'My Watchlist', items: getWatchlist() }
    : getCustomList(listId);
  if (!list || !list.items.length) {
    showToast('Add a title before creating an image.');
    return;
  }
  const dialog = createDialog('dialog--image-export');
  const body = document.createElement('div');
  body.className = 'dialog__body';
  const header = buildDialogHeader('Create a list image', 'Find the right frame for your collection.');
  header.querySelector('.dialog__title').id = 'imageExportTitle';
  dialog.setAttribute('aria-labelledby', 'imageExportTitle');
  body.append(header);

  const workspace = document.createElement('div');
  workspace.className = 'image-export-workspace';
  const controls = document.createElement('div');
  controls.className = 'image-export-controls';
  controls.appendChild(buildShareListSummary(list));
  const templateLabel = document.createElement('h3');
  templateLabel.className = 'share-section__title';
  templateLabel.id = 'templateLabel';
  templateLabel.textContent = 'Choose a layout';
  controls.appendChild(templateLabel);
  const templates = document.createElement('div');
  templates.className = 'image-export-templates';
  templates.setAttribute('role', 'group');
  templates.setAttribute('aria-labelledby', 'templateLabel');
  controls.appendChild(templates);

  const stage = document.createElement('figure');
  stage.className = 'image-export-preview';
  const preview = document.createElement('img');
  preview.alt = `Image preview for ${list.name}`;
  preview.hidden = true;
  const caption = document.createElement('figcaption');
  caption.className = 'image-export-preview__caption';
  stage.append(preview, caption);
  workspace.append(controls, stage);
  body.append(workspace);

  const status = document.createElement('p');
  status.className = 'dialog__hint image-export-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  body.appendChild(status);
  const footer = document.createElement('div');
  footer.className = 'dialog__footer';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn--ghost';
  back.textContent = 'Back to sharing';
  back.addEventListener('click', () => { dialog.close(); openShareModal(list.id); });
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn--outline';
  retry.textContent = 'Try again';
  retry.hidden = true;
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'btn btn--primary';
  download.textContent = 'Download PNG';
  download.disabled = true;
  footer.append(back, retry, download);
  body.appendChild(footer);

  let selected = 'minimal';
  let blob = null;
  let previewUrl = '';
  let revision = 0;
  const cache = new Map();
  async function updatePreview() {
    const current = ++revision;
    const template = LIST_IMAGE_TEMPLATES.find(option => option.id === selected);
    blob = null;
    download.disabled = true;
    retry.hidden = true;
    preview.hidden = true;
    stage.setAttribute('aria-busy', 'true');
    status.textContent = 'Creating your preview?';
    caption.textContent = `${template.width} ? ${template.height} ? PNG`;
    templates.querySelectorAll('button').forEach(button => {
      const active = button.dataset.template === selected;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    try {
      if (!cache.has(selected)) cache.set(selected, generateListImage(list, selected));
      const result = await cache.get(selected);
      if (current !== revision || !dialog.open) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(result);
      preview.src = previewUrl;
      preview.hidden = false;
      blob = result;
      download.disabled = false;
      const shown = Math.min(template.limit, list.items.length);
      status.textContent = `Preview ready. ${shown} of ${list.items.length} ${list.items.length === 1 ? 'title' : 'titles'} shown.`;
    } catch {
      cache.delete(template.id);
      if (current !== revision || !dialog.open) return;
      status.textContent = 'Could not create the image. Try again or choose another layout.';
      retry.hidden = false;
    } finally {
      if (current === revision) stage.setAttribute('aria-busy', 'false');
    }
  }
  LIST_IMAGE_TEMPLATES.forEach(template => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'template-btn';
    button.dataset.template = template.id;
    button.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${template.icon}</svg><span class="template-btn__name">${template.name}</span><span class="template-btn__desc">${template.desc}</span>`;
    button.addEventListener('click', () => { selected = template.id; updatePreview(); });
    templates.appendChild(button);
  });
  retry.addEventListener('click', updatePreview);
  download.addEventListener('click', () => {
    if (!blob) return;
    const name = list.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'list';
    downloadImage(blob, `cinevra-${name}-${selected}.png`);
    showToast('Image downloaded. Ready to share!');
  });
  dialog.addEventListener('close', () => {
    revision++;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    cache.clear();
  });
  dialog.appendChild(body);
  dialog.showModal();
  updatePreview();
}
