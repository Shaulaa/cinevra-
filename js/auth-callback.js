document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('callbackStatus');
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const recovery = params.get('flow') === 'recovery';
  // Kode sekali pakai tidak dibiarkan di URL atau riwayat browser.
  history.replaceState(null, '', location.pathname);
  await CinevraCloud.ready;
  try {
    if (!CinevraCloud.client || !code || params.has('error')) throw Error('Invalid link');
    const { data, error } = await CinevraCloud.client.auth.exchangeCodeForSession(code);
    if (error || !data.session) throw Error('Expired link');
    if (recovery) sessionStorage.setItem('cinevra_recovery_for', data.session.user.id);
    location.replace(recovery ? 'account.html?mode=reset' : 'account.html');
  } catch {
    document.getElementById('callbackHeading').textContent = 'This link could not be verified';
    status.textContent = 'The link may have expired or been opened in a different browser. Return to sign in and request a new link.';
    document.getElementById('callbackRetry').hidden = false;
  }
});
