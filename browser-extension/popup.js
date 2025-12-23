// Check for pending login and update status
chrome.storage.local.get('pendingLogin', (data) => {
  const statusEl = document.getElementById('status');
  if (data.pendingLogin) {
    const age = Math.round((Date.now() - data.pendingLogin.timestamp) / 1000);
    statusEl.className = 'status pending';
    statusEl.innerHTML = `
      <span class="status-icon">🔄</span>
      <span>Ready to fill: <strong>${data.pendingLogin.toolName}</strong></span>
    `;
  }
});