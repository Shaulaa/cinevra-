document.addEventListener('DOMContentLoaded', async () => {
  await CinevraCloud.ready;
  const { client } = CinevraCloud;
  const user = CinevraCloud.state().user;
  const mode = new URLSearchParams(location.search).get('mode') || 'login';
  const notice = document.getElementById('accountNotice');
  const form = document.getElementById('accountForm');
  const email = document.getElementById('accountEmail');
  const password = document.getElementById('accountPassword');
  const submit = document.getElementById('accountSubmit');
  const google = document.getElementById('googleSignIn');
  const reset = mode === 'reset';
  let recovery = false;
  try { recovery = reset && user && sessionStorage.getItem('cinevra_recovery_for') === user.id; } catch {}
  const callback = flow => {
    const url = new URL('auth-callback.html', location.href);
    if (flow) url.searchParams.set('flow', flow);
    return url.href;
  };
  const heading = document.getElementById('authHeading');
  const subtitle = document.getElementById('authSubtitle');
  const message = text => { notice.textContent = text; };
  document.getElementById('authPanel').hidden = Boolean(user) && !recovery;
  document.getElementById('signedInPanel').hidden = !user || recovery;
  if (user) document.getElementById('accountIdentity').textContent = user.email || 'Signed in';
  if (mode === 'signup') {
    heading.textContent = 'Make room for your favourites'; submit.textContent = 'Create account'; password.autocomplete = 'new-password';
    subtitle.textContent = 'Start a collection that feels like you.';
    document.getElementById('passwordHint').hidden = false;
    document.getElementById('loginTab').removeAttribute('aria-current'); document.getElementById('signupTab').setAttribute('aria-current', 'page');
  } else if (mode === 'forgot') {
    heading.textContent = 'Reset your password'; submit.textContent = 'Send recovery email'; password.required = false;
    subtitle.textContent = 'We will email you a link to get back in.';
    document.getElementById('passwordField').hidden = true;
  } else if (recovery) {
    heading.textContent = 'Choose a new password'; submit.textContent = 'Save new password'; email.required = false;
    subtitle.textContent = 'Give your account a fresh start.';
    document.getElementById('passwordHint').hidden = false;
    document.getElementById('emailField').hidden = true; password.autocomplete = 'new-password';
  } else if (reset) message('Open a fresh recovery link in the same browser where you requested it.');
  if (mode === 'forgot' || reset) {
    document.querySelector('.account-tabs').hidden = true;
    document.getElementById('googleGroup').hidden = true;
    document.getElementById('forgotLink').hidden = true;
    document.getElementById('resendConfirmation').hidden = true;
    document.getElementById('confirmationHelp').hidden = true;
  }
  if (mode === 'login') password.minLength = 1;
  if (!client) {
    message('Account sign-in is not available yet. You can keep using Cinevra as a guest.');
    form.querySelectorAll('input,button').forEach(control => control.disabled = true); google.disabled = true;
    document.getElementById('resendConfirmation').disabled = true;
  }
  let working = false;
  async function authAction(action) {
    if (!client || working) return;
    working = true; submit.disabled = true; google.disabled = true; message('Please wait...');
    try { await action(); }
    catch { message('The request could not be completed. Check your connection and try again.'); }
    finally { working = false; submit.disabled = false; google.disabled = false; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    await authAction(async () => {
      let response;
      if (mode === 'signup') response = await client.auth.signUp({ email: email.value.trim(), password: password.value, options: { emailRedirectTo: callback() } });
      else if (mode === 'forgot') response = await client.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: callback('recovery') });
      else if (recovery) response = await client.auth.updateUser({ password: password.value });
      else if (reset) { message('Request a new recovery email to change your password.'); return; }
      else response = await client.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
      if (response.error) { message(mode === 'login' ? 'Could not sign in. Check your email and password, and confirm your email if needed.' : 'Could not complete this request. Check your details or try again later.'); return; }
      if (mode === 'signup') message('Check your email to confirm your account. Open the link in this browser.');
      else if (mode === 'forgot') message('If this email can receive a recovery link, it has been sent. Open it in this browser.');
      else if (recovery) { try { sessionStorage.removeItem('cinevra_recovery_for'); } catch {} location.replace('account.html'); }
      else location.replace('account.html');
      password.value = ''; form.dataset.dirty = 'false';
    });
  });
  google.addEventListener('click', () => authAction(async () => {
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } });
    if (error) message('Google sign-in is unavailable. Please try email sign-in or retry later.');
  }));
  document.getElementById('resendConfirmation').addEventListener('click', () => {
    if (!email.checkValidity() || !email.value.trim()) { email.reportValidity(); return; }
    authAction(async () => {
      const { error } = await client.auth.resend({ type: 'signup', email: email.value.trim(), options: { emailRedirectTo: callback() } });
      message(error ? 'Could not resend the email. Please wait and try again.' : 'If this account needs confirmation, a new email has been sent.');
    });
  });
  document.getElementById('accountSignOut').addEventListener('click', () => authAction(async () => {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) { message('Could not sign out. Please try again.'); return; }
    location.replace('account.html');
  }));
  if (user) {
    const section = document.getElementById('guestImport'); section.hidden = false;
    const status = document.getElementById('importStatus');
    const button = document.getElementById('importGuestBtn');
    try {
      const guest = CinevraCloud.guest();
      const records = Object.values(guest.cinevra_personal);
      const counts = [
        [guest.cinevra_watchlist.length, 'watchlist titles'],
        [guest.cinevra_lists.length, 'custom lists'],
        [records.filter(record => record.rating || record.note || record.watchedOn).length, 'personal reviews'],
        [records.reduce((total, record) => total + new Set(record.episodes || []).size, 0), 'watched episodes'],
      ];
      for (const [count, label] of counts) { const row = document.createElement('li'); row.textContent = `${count} ${label}`; document.getElementById('importSummary').append(row); }
      button.disabled = counts.every(([count]) => count === 0) || CinevraCloud.state().phase !== 'ready';
      if (button.disabled) status.textContent = CinevraCloud.state().phase !== 'ready' ? 'Load your account library before importing.' : 'There is no guest collection to import.';
      button.addEventListener('click', async () => {
        button.disabled = true; status.textContent = 'Importing your collection...';
        try { await CinevraCloud.importGuest(); status.textContent = 'Import completed. Existing account entries were kept. Your guest collection is still on this browser.'; }
        catch (error) { status.textContent = error.message; button.disabled = false; }
      });
    } catch (error) { button.disabled = true; status.textContent = error.message; }
  }
});
