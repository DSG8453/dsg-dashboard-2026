// DSG Transport Secure Login - Background Service Worker
// Handles secure credential passing from dashboard to login pages

// Store pending login data
let pendingLogins = {};

// Listen for messages from DSG Transport dashboard (external)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log('[DSG Extension] External message received:', request.action);
    
    if (request.action === 'DSG_AUTO_LOGIN') {
      handleAutoLogin(request, sendResponse);
      return true; // Keep channel open for async response
    }
    
    if (request.action === 'DSG_CHECK_EXTENSION') {
      sendResponse({ 
        installed: true, 
        version: chrome.runtime.getManifest().version,
        ready: true
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

// Handle auto-login request from dashboard
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
      // Expire after 5 minutes
      if (age > 5 * 60 * 1000) {
        chrome.storage.local.remove('pendingLogin');
        console.log('[DSG Extension] Cleared expired login data');
      }
    }
  });
}, 60000);

// Listen for tab updates to inject content script when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get('pendingLogin', (data) => {
      if (data.pendingLogin && isUrlMatch(data.pendingLogin.url, tab.url)) {
        console.log('[DSG Extension] Tab loaded, re-checking for credential fill');
        // The content script should handle this, but we can also inject manually if needed
      }
    });
  }
});

console.log('[DSG Extension] Background service worker started');
