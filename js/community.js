CinevraCloud.boot(async () => {
  const api = CinevraCommunity.create({ client: CinevraCloud.client, user: () => CinevraCloud.state().user });
  const user = () => CinevraCloud.state().user;
  const feed = document.getElementById('communityFeed');
  const status = document.getElementById('communityStatus');
  const empty = document.getElementById('communityEmpty');
  const more = document.getElementById('communityMore');
  const refresh = document.getElementById('communityRefresh');
  let filter = 'all', posts = [], cursor = null, version = 0, loading = false;
  const node = (tag, className = '', text = '') => { const el = document.createElement(tag); el.className = className; el.textContent = text; return el; };
  const icon = name => {
    const svg = node('span');
    svg.innerHTML = name === 'star'
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1L12 2Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
    return svg;
  };
  function button(text, action, className = 'community-action') {
    const el = node('button', className, text); el.type = 'button';
    el.addEventListener('click', async () => {
      el.disabled = true;
      try { await action(el); } catch (error) { showToast(error.message); }
      finally { el.disabled = false; }
    });
    return el;
  }
  function poster(item) {
    if (!item.posterPath) return node('span', 'community-poster', item.title.slice(0, 1));
    const image = node('img', 'community-poster'); image.src = getImageUrl(item.posterPath, 'posterSmall'); image.alt = ''; image.loading = 'lazy'; attachImageFallback(image); return image;
  }
  function titleLink(item) {
    const link = node('a', '', item.title); link.href = `detail.html?type=${item.type}&id=${item.id}`; return link;
  }
  function rated(rating) {
    const el = node('span', 'community-rating');
    if (rating) el.append(icon('star'), node('span', '', `${rating}/10`));
    return el;
  }
  function promptAction(title, description, action, reasons = false) {
    const dialog = createDialog('community-composer');
    dialog.setAttribute('aria-label', title);
    dialog.append(buildDialogHeader(title, description));
    const form = node('form');
    let reason;
    if (reasons) {
      const label = node('label', '', 'Reason'); reason = node('select', 'filter-select');
      for (const [value, text] of [['spoiler', 'Unmarked spoiler'], ['spam', 'Spam'], ['abuse', 'Abusive content']]) reason.add(new Option(text, value));
      label.append(reason); form.append(label);
    }
    const message = node('p', 'community-status'); message.setAttribute('role', 'status');
    const actions = node('div', 'community-dialog-actions');
    const cancel = button('Cancel', () => dialog.close(), 'btn btn--outline');
    const submit = node('button', 'btn btn--primary', reasons ? 'Send report' : 'Remove from public feed'); submit.type = 'submit';
    actions.append(cancel, submit); form.append(message, actions); dialog.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try { await action(reason?.value); dialog.close(); }
      catch (error) { message.textContent = error.message; }
      finally { submit.disabled = false; }
    });
    dialog.showModal();
  }
  function saveList(post, items) {
    const dialog = createDialog('community-composer');
    dialog.setAttribute('aria-label', 'Save a private copy of this list');
    dialog.append(buildDialogHeader('Make it part of your collection', 'This saves your own private copy. Future edits to the public list will not change it.'));
    const form = node('form'); const label = node('label', '', 'List name');
    const input = node('input'); input.type = 'text'; input.maxLength = 40; input.required = true; input.value = post.title.slice(0, 40); label.append(input);
    const message = node('p', 'community-status'); message.setAttribute('role', 'status');
    const actions = node('div', 'community-dialog-actions'); const submit = node('button', 'btn btn--primary', 'Save a copy'); submit.type = 'submit';
    actions.append(button('Cancel', () => dialog.close(), 'btn btn--outline'), submit); form.append(label, message, actions); dialog.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try { const result = await createCustomList(input.value, items); if (result.error) throw Error(result.error); dialog.close(); showToast('A private copy was saved to My Lists.'); }
      catch (error) { message.textContent = error.message; } finally { submit.disabled = false; }
    });
    dialog.showModal();
  }
  function renderPost(post) {
    const items = post.items.map(CinevraCommunity.item);
    const article = node('article', 'community-post');
    const author = node('header', 'community-author');
    const identity = node('div'); identity.append(node('strong', '', post.display_name));
    const date = new Date(post.created_at);
    identity.append(node('small', '', Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)));
    author.append(node('span', 'community-avatar', post.display_name.slice(0, 1).toUpperCase()), identity, node('span', 'community-post-kind', post.kind === 'review' ? 'Review' : 'Curated list')); article.append(author);
    if (!post.published) article.append(node('p', 'community-post-private', 'Unpublished. Only you can see this post.'));
    const title = node('h2');
    if (post.kind === 'review') {
      title.append(titleLink(items[0]));
      const info = node('div'); info.append(title, rated(post.rating));
      const row = node('div', 'community-title-row'); row.append(poster(items[0]), info); article.append(row);
    } else {
      title.textContent = post.title; article.append(title, node('span', 'community-rating', `${items.length} titles`));
      const mosaic = node('div', 'community-mosaic'); for (const item of items.slice(0, 4)) mosaic.append(poster(item)); article.append(mosaic);
    }
    const body = node('p', 'community-post-body', post.body);
    if (post.spoilers && post.body) {
      body.hidden = true;
      const reveal = button('Contains spoilers. Show text', () => { body.hidden = !body.hidden; reveal.textContent = body.hidden ? 'Contains spoilers. Show text' : 'Hide spoilers'; reveal.setAttribute('aria-expanded', String(!body.hidden)); }, 'community-spoiler');
      reveal.setAttribute('aria-expanded', 'false'); article.append(reveal);
    }
    if (post.body) article.append(body);
    const actions = node('div', 'community-post-actions');
    const like = button('', async () => {
      if (!user()) { showToast('Sign in to react to a post.'); return; }
      const liked = !post.is_liked; await api.like(post.id, liked); post.is_liked = liked; post.like_count = Math.max(0, Number(post.like_count) + (liked ? 1 : -1)); updateLike();
    });
    function updateLike() { like.replaceChildren(icon('heart'), node('span', '', `${post.is_liked ? 'Liked' : 'Like'} · ${post.like_count}`)); like.setAttribute('aria-pressed', String(post.is_liked)); }
    updateLike(); like.disabled = !post.published; actions.append(like);
    if (post.kind === 'list') {
      const list = node('ol', 'community-list-items'); list.hidden = true;
      for (const item of items) { const li = node('li'); li.append(titleLink(item)); list.append(li); }
      const toggle = button('View titles', () => { list.hidden = !list.hidden; toggle.textContent = list.hidden ? 'View titles' : 'Hide titles'; toggle.setAttribute('aria-expanded', String(!list.hidden)); }); toggle.setAttribute('aria-expanded', 'false');
      actions.append(toggle, button('Save a copy', () => saveList(post, items))); article.append(list);
    } else actions.append(button('Save to watchlist', async el => { await addToWatchlist(items[0]); el.textContent = 'Saved to watchlist'; }));
    if (post.is_owner) {
      actions.append(button(post.published ? 'Edit post' : 'Share again', () => openComposer(post)));
      if (post.published) actions.append(button('Unpublish', () => promptAction('Remove this post from the public feed?', 'Your private review or list stays in your collection. You can share the post again from My posts.', async () => { await api.unpublish(post.id); await load(); })));
    } else if (user()) actions.append(button('Report', () => promptAction('Report this post', 'Your report is private. This post will be hidden from your feed and sent for review.', async reason => { await api.report(post.id, reason); await load(); showToast('Report received. The post is hidden from your feed.'); }, true)));
    article.append(actions); return article;
  }
  function render() {
    feed.replaceChildren();
    for (const post of posts) { try { feed.append(renderPost(post)); } catch { /* Snapshot yang rusak tidak boleh merusak seluruh feed. */ } }
    empty.hidden = posts.length > 0;
    document.getElementById('communityEmptyTitle').textContent = filter === 'mine' ? 'Your voice, your collection.' : 'Every conversation starts somewhere.';
    document.getElementById('communityEmptyText').textContent = filter === 'mine' ? 'Posts you share appear here. Your diary stays private until you choose to share.' : 'Share a film that stayed with you, or a list worth discovering.';
  }
  async function load(append = false) {
    const current = ++version; loading = true; status.textContent = ''; refresh.disabled = true; more.disabled = true; empty.hidden = true;
    feed.setAttribute('aria-busy', 'true');
    if (!append) { posts = []; cursor = null; feed.replaceChildren(...Array.from({ length: 2 }, () => { const el = node('div', 'community-skeleton'); el.setAttribute('aria-hidden', 'true'); return el; })); }
    try {
      const data = await api.feed({ kind: ['review', 'list'].includes(filter) ? filter : 'all', mine: filter === 'mine', cursor: append ? cursor : null });
      if (current !== version) return;
      if (!Array.isArray(data)) throw Error('The community feed could not be read. Please try again.');
      const seen = new Set(posts.map(post => post.id)); posts.push(...data.filter(post => !seen.has(post.id)));
      cursor = data.at(-1) || cursor; more.hidden = data.length < 12; render();
    } catch (error) {
      if (current !== version) return;
      status.textContent = error.message; more.hidden = true; if (!append) feed.replaceChildren();
    } finally {
      if (current === version) { loading = false; refresh.disabled = false; more.disabled = false; feed.setAttribute('aria-busy', 'false'); }
    }
  }
  document.querySelectorAll('[data-feed]').forEach(el => el.addEventListener('click', () => {
    if (el.dataset.feed === 'mine' && !user()) { location.href = 'account.html'; return; }
    filter = el.dataset.feed; document.querySelectorAll('[data-feed]').forEach(btn => btn.setAttribute('aria-pressed', String(btn === el))); load();
  }));
  refresh.addEventListener('click', () => load()); more.addEventListener('click', () => { if (!loading) load(true); });
  document.getElementById('communitySignIn').hidden = Boolean(user());
  const composer = document.getElementById('communityComposer');
  const form = document.getElementById('communityForm');
  const kind = document.getElementById('communityKind');
  const source = document.getElementById('communitySource');
  const name = document.getElementById('communityName');
  const body = document.getElementById('communityBody');
  const rating = document.getElementById('communityRating');
  const spoilers = document.getElementById('communitySpoilers');
  const consent = document.getElementById('communityConsent');
  const preview = document.getElementById('communityPreview');
  const composeStatus = document.getElementById('communityComposeStatus');
  const submit = document.getElementById('communityPublish');
  let sources = [], selected = null, selectionVersion = 0, publishing = false;
  for (let n = 10; n >= 1; n--) rating.add(new Option(`★ ${n}/10`, String(n)));
  function draft() {
    return { kind: kind.value, sourceKey: selected?.key, title: selected?.title, items: selected?.items, body: body.value, rating: rating.value, displayName: name.value, spoilers: spoilers.checked };
  }
  function previewDraft() {
    preview.replaceChildren();
    preview.append(node('strong', '', name.value.trim() || 'Your public name'));
    preview.append(node('h3', 'community-preview-title', selected?.title || 'Choose something to share'));
    if (kind.value === 'review') preview.append(rated(rating.value));
    else if (selected) preview.append(node('span', 'community-rating', `${selected.items.length} titles`));
    if (body.value.trim()) preview.append(node('p', 'community-post-body', body.value.trim()));
    if (spoilers.checked) preview.append(node('p', 'community-help', 'Spoiler text will be hidden until a reader chooses to reveal it.'));
    if (kind.value === 'list' && selected) {
      const list = node('ol', 'community-list-items');
      for (const item of selected.items) list.append(node('li', '', item.title));
      preview.append(list);
    }
    document.getElementById('communityChars').textContent = `${body.value.length} / 600`;
  }
  function readSources() {
    const lists = getCustomLists();
    const known = [...getWatchlist(), ...lists.flatMap(list => list.items)];
    const reviews = getDiaryEntries().map(entry => {
      const meta = entry.item || known.find(item => item.type === entry.type && item.id === entry.id);
      return { key: entry.key, kind: 'review', title: meta?.title || `${entry.type === 'tv' ? 'TV show' : 'Movie'} #${entry.id}`, items: [{ id: entry.id, type: entry.type, title: meta?.title || '', posterPath: meta?.posterPath || null }], rating: entry.rating };
    });
    return [...reviews, ...lists.filter(list => list.items.length > 0 && list.items.length <= 40).map(list => ({ key: list.id, kind: 'list', title: list.name, items: list.items.map(CinevraCommunity.item) }))];
  }
  async function selectSource() {
    const current = ++selectionVersion;
    selected = sources.find(item => item.kind === kind.value && item.key === source.value) || null;
    submit.disabled = !selected; consent.checked = false; composeStatus.textContent = '';
    document.getElementById('communityRatingField').hidden = kind.value !== 'review';
    body.required = kind.value === 'review';
    document.getElementById('communitySourceHelp').textContent = kind.value === 'review'
      ? 'Your private diary note stays private. Write a separate short review below.'
      : 'This shares a snapshot of the selected list, up to 40 titles. Future private edits are not shared automatically.';
    if (!selected) { composeStatus.textContent = kind.value === 'review' ? 'Save a review in your Watching Diary first.' : 'Create a non-empty list of up to 40 titles in My Lists first.'; previewDraft(); return; }
    const choice = selected;
    if (choice.kind === 'review' && !choice.items[0].title) {
      submit.disabled = true; composeStatus.textContent = 'Loading the title for your preview...';
      try {
        const item = choice.items[0]; const data = await (item.type === 'tv' ? fetchTVDetails(item.id) : fetchMovieDetails(item.id));
        if (current !== selectionVersion) return;
        item.title = data.title || data.name; item.posterPath = data.poster_path; choice.items = [CinevraCommunity.item(item)]; choice.title = item.title; composeStatus.textContent = '';
      } catch { if (current !== selectionVersion) return; selected = null; composeStatus.textContent = 'Could not load the title. Select it again to retry.'; previewDraft(); return; }
    }
    if (current !== selectionVersion) return;
    rating.value = String(choice.rating || ''); submit.disabled = false; previewDraft();
  }
  function fillSources(preferred = '') {
    source.replaceChildren();
    for (const entry of sources.filter(item => item.kind === kind.value)) source.add(new Option(entry.title, entry.key));
    if (!source.options.length) source.add(new Option('Nothing saved yet', ''));
    if (preferred && [...source.options].some(option => option.value === preferred)) source.value = preferred;
    return selectSource();
  }
  async function openComposer(post = null) {
    if (!user()) { location.href = 'account.html'; return; }
    if (CinevraCloud.state().phase !== 'ready') { showToast('Load your account collection before sharing.'); return; }
    if (post || form.dataset.dirty !== 'true') {
      sources = readSources(); kind.value = post?.kind || 'review'; body.value = post?.body || ''; spoilers.checked = Boolean(post?.spoilers); consent.checked = false;
      if (post) name.value = post.display_name;
      if (post && !sources.some(item => item.kind === post.kind && item.key === post.source_key)) { showToast('The original collection entry is no longer available. You can still unpublish this post.'); return; }
      await fillSources(post?.source_key);
      if (post) rating.value = String(post.rating || '');
      previewDraft();
    }
    if (!composer.open) composer.showModal();
  }
  document.querySelectorAll('[data-compose]').forEach(el => el.addEventListener('click', () => openComposer().catch(error => showToast(error.message))));
  document.querySelectorAll('[data-close-compose]').forEach(el => el.addEventListener('click', () => { if (!publishing) composer.close(); }));
  composer.addEventListener('cancel', event => { if (publishing) event.preventDefault(); });
  kind.addEventListener('change', () => { form.dataset.dirty = 'true'; fillSources(); });
  source.addEventListener('change', () => { form.dataset.dirty = 'true'; selectSource(); });
  form.addEventListener('input', event => { form.dataset.dirty = 'true'; if (event.target !== consent) consent.checked = false; previewDraft(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (publishing || !consent.checked || !selected) return;
    publishing = true;
    const controls = [...form.querySelectorAll('input,textarea,select,button')]; controls.forEach(el => el.disabled = true);
    composeStatus.textContent = 'Publishing your selected preview...';
    try {
      await api.publish(draft()); form.dataset.dirty = 'false'; composer.close(); showToast('Your post is now public.');
      filter = 'mine'; document.querySelectorAll('[data-feed]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.feed === 'mine'))); await load();
    } catch (error) { composeStatus.textContent = error.message; }
    finally { publishing = false; controls.forEach(el => el.disabled = false); }
  });
  await load();
});
