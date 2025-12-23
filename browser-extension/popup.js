// Check for pending credentials
chrome.storage.local.get('pendingLogin', (data) => {
  const statusEl = document.getElementById('status');
  if (data.pendingLogin) {
    const age = Math.round((Date.now() - data.pendingLogin.timestamp) / 1000);
    statusEl.className = 'status active';
    statusEl.innerHTML = `✅ Auto-login ready<br><small>Waiting to fill credentials (${age}s ago)</small>`;
  } else {
    statusEl.textContent = '✓ Extension active';
  }
});