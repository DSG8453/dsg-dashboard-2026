// DSG Transport Extension Popup Script

// Display extension ID
document.getElementById('extensionId').textContent = chrome.runtime.id;

// Check for pending login and update status
chrome.storage.local.get('pendingLogin', (data) => {
  const statusEl = document.getElementById('status');
  
  if (data.pendingLogin) {
    const age = Math.round((Date.now() - data.pendingLogin.timestamp) / 1000);
    const minutes = Math.floor(age / 60);
    const seconds = age % 60;
    
    statusEl.className = 'status pending';
    statusEl.innerHTML = `
      <span class="status-icon">🔄</span>
      <div class="status-text">
        <strong>Pending Login: ${data.pendingLogin.toolName}</strong>
        <small>Waiting to auto-fill (${minutes}:${seconds.toString().padStart(2, '0')} ago)</small>
      </div>
    `;
  }
});

// Copy extension ID to clipboard
function copyId() {
  const id = chrome.runtime.id;
  navigator.clipboard.writeText(id).then(() => {
    document.getElementById('copiedMsg').classList.add('show');
    setTimeout(() => {
      document.getElementById('copiedMsg').classList.remove('show');
    }, 2000);
  });
}

// Make copyId available globally
window.copyId = copyId;
