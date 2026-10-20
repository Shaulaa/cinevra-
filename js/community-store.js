(function (root) {
  const posterPattern = /^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/;
  function item(value) {
    if (!value || !['movie', 'tv'].includes(value.type) || !Number.isSafeInteger(value.id) || value.id < 1 || typeof value.title !== 'string' || !value.title.trim()) throw Error('Choose a saved title with a name.');
    return { id: value.id, type: value.type, title: value.title.trim().slice(0, 300), posterPath: typeof value.posterPath === 'string' && posterPattern.test(value.posterPath) ? value.posterPath : null };
  }
  function publication(draft) {
    const name = draft.displayName?.trim() || '';
    const body = draft.body?.trim() || '';
    if (name.length < 2 || name.length > 30 || /[@<>]/.test(name)) throw Error('Use a public name of 2 to 30 characters, without an email address.');
    if (!['review', 'list'].includes(draft.kind) || typeof draft.sourceKey !== 'string' || !draft.sourceKey || draft.sourceKey.length > 100) throw Error('Choose a saved review or list.');
    if (body.length > 600 || (draft.kind === 'review' && !body)) throw Error('Write a short review of up to 600 characters.');
    if (!Array.isArray(draft.items) || !draft.items.length || draft.items.length > 40 || (draft.kind === 'review' && draft.items.length !== 1)) throw Error('Share one reviewed title or a list of up to 40 titles.');
    const rating = draft.rating === '' || draft.rating == null ? null : Number(draft.rating);
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) throw Error('Choose a rating from 1 to 10.');
    const title = draft.title?.trim();
    if (!title || title.length > 300) throw Error('Choose a title of up to 300 characters.');
    return { p_kind: draft.kind, p_source_key: draft.sourceKey, p_display_name: name, p_title: title, p_body: body, p_rating: draft.kind === 'review' ? rating : null, p_items: draft.items.map(item), p_spoilers: Boolean(draft.spoilers) };
  }
  function create({ client, user }) {
    async function rpc(name, args, needsUser = false) {
      if (!client) throw Error('Community is not connected yet. You can keep browsing Cinevra.');
      const actor = user()?.id || null;
      if (needsUser && !actor) throw Error('Sign in to join the conversation.');
      const response = await client.rpc(name, args);
      if ((user()?.id || null) !== actor) throw Error('Your account changed. Reload this page before continuing.');
      if (response.error) {
        const error = response.error;
        if (['PGRST202', '42P01', '42883'].includes(error.code)) throw Error('Community is being prepared. Please try again later.');
        if (error.code === 'P0001') throw Error(error.message);
        throw Error('Could not complete the request. Your changes have not been discarded. Please try again.');
      }
      return response.data;
    }
    return {
      feed: ({ kind = 'all', mine = false, cursor = null } = {}) => rpc('community_feed', { p_kind: kind, p_mine: mine, p_before_time: cursor?.created_at || null, p_before_id: cursor?.id || null, p_limit: 12 }),
      publish: draft => rpc('community_publish', publication(draft), true),
      like: (id, liked) => rpc('community_set_like', { p_post_id: id, p_liked: liked }, true),
      unpublish: id => rpc('community_unpublish', { p_post_id: id }, true),
      report: (id, reason) => rpc('community_report', { p_post_id: id, p_reason: reason }, true),
    };
  }
  root.CinevraCommunity = { create, publication, item };
})(typeof window === 'undefined' ? globalThis : window);
