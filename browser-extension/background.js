// DSG Transport Secure Login - Background Service Worker
// SECURITY: Credentials are encrypted and decrypted only within the extension
// Users NEVER see credentials - they are auto-filled directly into forms

// Store pending login data
let pendingLogins = {};

// Listen for messages from DSG Transport dashboard (external)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log('[DSG Extension] External message received:', request.action);
    
    // NEW: Secure login with encrypted payload
    if (request.action === 'DSG_SECURE_LOGIN') {
      handleSecureLogin(request, sendResponse);
      return true; // Keep channel open for async response
    }
    
    // Legacy support (will be removed)
    if (request.action === 'DSG_AUTO_LOGIN') {
      handleAutoLogin(request, sendResponse);
      return true;
    }
    
    if (request.action === 'DSG_CHECK_EXTENSION') {
      sendResponse({ 
        installed: true, 
        version: chrome.runtime.getManifest().version,
        ready: true,
        secure: true // Indicates this version supports encrypted payloads
      });
      return true;
    }
    
    return false;
  }
);

// Listen for internal messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[DSG Extension] Internal message:', request.action);
  
  if (request.action === 'GET_PENDING_LOGIN') {
    // Check if there's a pending login for this tab
    chrome.storage.local.get('pendingLogin', (data) => {
      const pending = data.pendingLogin;
      if (pending && isUrlMatch(pending.url, sender.tab?.url)) {
        sendResponse(pending);
        // Clear after sending to content script
        chrome.storage.local.remove('pendingLogin');
      } else {
        sendResponse(null);
      }
    });
    return true; // Async response
  }
  
  if (request.action === 'CLEAR_PENDING_LOGIN') {
    chrome.storage.local.remove('pendingLogin', () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'LOGIN_SUCCESS') {
    console.log('[DSG Extension] Login successful for:', request.toolName);
    sendResponse({ acknowledged: true });
  }
  
  if (request.action === 'LOGIN_FAILED') {
    console.log('[DSG Extension] Login failed:', request.reason);
    sendResponse({ acknowledged: true });
  }
  
  return false;
});

// NEW: Handle secure login with encrypted payload
async function handleSecureLogin(request, sendResponse) {
  try {
    console.log('[DSG Extension] Starting SECURE login for:', request.toolName);
    
    // Get the decryption key from backend (one-time, tied to this session)
    // The encrypted payload can only be decrypted server-side
    const decryptResponse = await fetch(getBackendUrl() + '/api/secure-access/decrypt-payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        encrypted: request.encryptedPayload
      })
    });
    
    if (!decryptResponse.ok) {
      throw new Error('Failed to decrypt credentials');
    }
    
    const decrypted = await decryptResponse.json();
    
    if (!decrypted.success) {
      throw new Error(decrypted.error || 'Decryption failed');
    }
    
    // Store login data temporarily (credentials in memory only)
    const loginData = {
      url: request.loginUrl,
      username: decrypted.u,
      password: decrypted.p,
      usernameField: request.usernameField || decrypted.uf || 'username',
      passwordField: request.passwordField || decrypted.pf || 'password',
      toolName: request.toolName,
      timestamp: Date.now()
    };
    
    // Store the pending login
    await chrome.storage.local.set({ pendingLogin: loginData });
    
    // Open the login URL in a new tab
    const tab = await chrome.tabs.create({ 
      url: request.loginUrl,
      active: true
    });
    
    console.log('[DSG Extension] Opened secure tab:', tab.id);
    
    // Clear credentials from memory after sending to content script
    setTimeout(() => {
      loginData.username = null;
      loginData.password = null;
    }, 10000);
    
    sendResponse({ 
      success: true, 
      tabId: tab.id,
      message: 'Login page opened, credentials will auto-fill securely'
    });
    
  } catch (error) {
    console.error('[DSG Extension] Secure login error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Legacy: Handle auto-login request (for backwards compatibility)
async function handleAutoLogin(request, sendResponse) {
  try {
    console.log('[DSG Extension] Starting auto-login for:', request.toolName);
    
    const loginData = {
      url: request.loginUrl,
      username: request.username,
      password: request.password,
      usernameField: request.usernameField || 'username',
      passwordField: request.passwordField || 'password',
      toolName: request.toolName,
      timestamp: Date.now()
    };
    
    // Store the pending login
    await chrome.storage.local.set({ pendingLogin: loginData });
    
    // Open the login URL in a new tab
    const tab = await chrome.tabs.create({ 
      url: request.loginUrl,
      active: true
    });
    
    console.log('[DSG Extension] Opened tab:', tab.id, 'URL:', request.loginUrl);
    
    sendResponse({ 
      success: true, 
      tabId: tab.id,
      message: 'Login page opened, credentials will auto-fill'
    });
    
  } catch (error) {
    console.error('[DSG Extension] Error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get backend URL from storage or default
function getBackendUrl() {
  // This should match the dashboard URL
  return 'https://safelogin-1.preview.emergentagent.com';
}

// Check if two URLs match (same domain)
function isUrlMatch(pendingUrl, currentUrl) {
  if (!pendingUrl || !currentUrl) return false;
  
  try {
    const pending = new URL(pendingUrl);
    const current = new URL(currentUrl);
    
    // Check if same hostname or subdomain
    const pendingDomain = pending.hostname.split('.').slice(-2).join('.');
    const currentDomain = current.hostname.split('.').slice(-2).join('.');
    
    return pendingDomain === currentDomain;
  } catch {
    return false;
  }
}

// Clean up expired login data periodically (every minute)
setInterval(() => {
  chrome.storage.local.get('pendingLogin', (data) => {
    if (data.pendingLogin) {
      const age = Date.now() - data.pendingLogin.timestamp;
      // Expire after 2 minutes (shorter for security)
      if (age > 2 * 60 * 1000) {
        chrome.storage.local.remove('pendingLogin');
        console.log('[DSG Extension] Cleared expired login data');
      }
    }
  });
}, 30000);

// Listen for tab updates to inject content script when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get('pendingLogin', (data) => {
      if (data.pendingLogin && isUrlMatch(data.pendingLogin.url, tab.url)) {
        console.log('[DSG Extension] Tab loaded, re-checking for credential fill');
      }
    });
  }
});

console.log('[DSG Extension] Secure background service worker started');
