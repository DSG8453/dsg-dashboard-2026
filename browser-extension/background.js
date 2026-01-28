// DSG Transport Secure Login - Background Service Worker
// SECURITY: Credentials are encrypted and decrypted only within the extension
// Users NEVER see credentials - they are auto-filled directly into forms

// Store pending login data
let pendingLogins = {};
const pendingTabs = {};

function buildHostPattern(urlString) {
  try {
    const url = new URL(urlString);
    return `${url.protocol}//${url.hostname}/*`;
  } catch (error) {
    return null;
  }
}

async function ensureHostPermission(loginUrl) {
  const pattern = buildHostPattern(loginUrl);
  if (!pattern) {
    return false;
  }

  const hasPermission = await new Promise((resolve) => {
    chrome.permissions.contains({ origins: [pattern] }, (result) => {
      resolve(!!result);
    });
  });

  if (hasPermission) {
    return true;
  }

  return new Promise((resolve) => {
    chrome.permissions.request({ origins: [pattern] }, (granted) => {
      resolve(!!granted);
    });
  });
}

// Listen for messages from DSG Transport dashboard (external)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log('[DSG Extension] ===== EXTERNAL MESSAGE RECEIVED =====');
    console.log('[DSG Extension] Action:', request.action);
    console.log('[DSG Extension] Sender:', sender.origin || sender.url);
    console.log('[DSG Extension] Request keys:', Object.keys(request));
    
    // Dynamically capture the backend URL from the sender's origin
    if (sender.origin) {
      setBackendUrl(sender.origin);
    } else if (sender.url) {
      try {
        const url = new URL(sender.url);
        setBackendUrl(url.origin);
      } catch (e) {}
    }
    
    // NEW: Secure login with encrypted payload
    if (request.action === 'DSG_SECURE_LOGIN') {
      console.log('[DSG Extension] Processing DSG_SECURE_LOGIN...');
      handleSecureLogin(request, sendResponse);
      return true; // Keep channel open for async response
    }
    
    // Legacy support (will be removed)
    if (request.action === 'DSG_AUTO_LOGIN') {
      console.log('[DSG Extension] Processing DSG_AUTO_LOGIN (legacy)...');
      handleAutoLogin(request, sendResponse);
      return true;
    }
    
    if (request.action === 'DSG_CHECK_EXTENSION') {
      console.log('[DSG Extension] Responding to DSG_CHECK_EXTENSION');
      sendResponse({ 
        installed: true, 
        version: chrome.runtime.getManifest().version,
        ready: true,
        secure: true // Indicates this version supports encrypted payloads
      });
      return true;
    }
    
    console.log('[DSG Extension] Unknown action:', request.action);
    return false;
  }
);

// Listen for internal messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[DSG Extension] Internal message:', request.action);
  
  if (request.action === 'GET_PENDING_LOGIN') {
    // Check if there's a pending login for this tab.
    // Do not clear here so iframes can also attempt to fill.
    chrome.storage.local.get('pendingLogin', (data) => {
      const pending = data.pendingLogin;
      if (pending && isUrlMatch(pending.url, sender.tab?.url)) {
        sendResponse(pending);
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
    console.log('[DSG Extension] ===== STARTING SECURE LOGIN =====');
    console.log('[DSG Extension] Tool:', request.toolName);
    console.log('[DSG Extension] Login URL:', request.loginUrl);
    console.log('[DSG Extension] Has encrypted payload:', !!request.encryptedPayload);

    const permissionGranted = await ensureHostPermission(request.loginUrl);
    if (!permissionGranted) {
      throw new Error('Host access not granted for login URL');
    }
    
    // Get the backend URL dynamically (captured from sender origin)
    const backendUrl = getDynamicBackendUrl();
    console.log('[DSG Extension] Calling decrypt API at:', backendUrl);
    
    const decryptResponse = await fetch(backendUrl + '/api/secure-access/decrypt-payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': chrome.runtime.getURL('')
      },
      body: JSON.stringify({
        encrypted: request.encryptedPayload
      })
    });
    
    console.log('[DSG Extension] Decrypt response status:', decryptResponse.status);
    
    if (!decryptResponse.ok) {
      const errorText = await decryptResponse.text();
      console.error('[DSG Extension] Decrypt failed:', errorText);
      throw new Error('Failed to decrypt credentials: ' + errorText);
    }
    
    const decrypted = await decryptResponse.json();
    console.log('[DSG Extension] Decrypt result:', { success: decrypted.success, hasUsername: !!decrypted.u, hasPassword: !!decrypted.p });
    
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
      autoSubmit: true,
      timestamp: Date.now()
    };
    
    console.log('[DSG Extension] Storing pending login:', {
      url: loginData.url,
      usernameField: loginData.usernameField,
      passwordField: loginData.passwordField,
      toolName: loginData.toolName
    });
    
    // Store the pending login
    await chrome.storage.local.set({ pendingLogin: loginData });
    console.log('[DSG Extension] Pending login stored successfully');
    
    // Verify storage
    const stored = await chrome.storage.local.get('pendingLogin');
    console.log('[DSG Extension] Verified storage:', !!stored.pendingLogin);
    
    // Open the login URL in a new tab
    console.log('[DSG Extension] Opening tab:', request.loginUrl);
    const tab = await chrome.tabs.create({ 
      url: request.loginUrl,
      active: true
    });
    pendingTabs[tab.id] = {
      url: request.loginUrl,
      expiresAt: Date.now() + (2 * 60 * 1000)
    };
    
    console.log('[DSG Extension] Tab opened:', tab.id);
    
    // Clear credentials from memory after they're used
    setTimeout(() => {
      loginData.username = null;
      loginData.password = null;
    }, 15000);
    
    sendResponse({ 
      success: true, 
      tabId: tab.id,
      message: 'Auto-login initiated'
    });
    
  } catch (error) {
    console.error('[DSG Extension] ===== SECURE LOGIN ERROR =====');
    console.error('[DSG Extension] Error:', error.message);
    console.error('[DSG Extension] Stack:', error.stack);
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

    const permissionGranted = await ensureHostPermission(request.loginUrl);
    if (!permissionGranted) {
      throw new Error('Host access not granted for login URL');
    }
    
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
    pendingTabs[tab.id] = {
      url: request.loginUrl,
      expiresAt: Date.now() + (2 * 60 * 1000)
    };
    
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

// Get backend URL dynamically from the page that triggered the login
// This makes the extension work with ANY deployment domain
function getBackendUrl() {
  // Check if we have a stored backend URL from the last dashboard interaction
  // The dashboard sends its origin when communicating with the extension
  // Default fallback URLs in priority order
  const fallbackUrls = [
    'https://portal.dsgtransport.net',
    'https://api.portal.dsgtransport.net',
    'https://secure.dsgtransport.net',
    'https://app.dsgtransport.net', 
    'https://secure.dsgtransport.com',
    'https://app.dsgtransport.com',
    'https://keyvault-27.preview.emergentagent.com'
  ];
  
  // Return the production URL as default
  return fallbackUrls[0];
}

// Store the backend URL when we receive a message from the dashboard
let dynamicBackendUrl = null;

function setBackendUrl(url) {
  if (url && (url.includes('dsgtransport') || url.includes('emergentagent'))) {
    dynamicBackendUrl = url.replace(/\/$/, ''); // Remove trailing slash
    console.log('[DSG Extension] Backend URL set to:', dynamicBackendUrl);
  }
}

function getDynamicBackendUrl() {
  return dynamicBackendUrl || getBackendUrl();
}

// Check if two URLs match (same domain or URL contains pending URL domain)
function isUrlMatch(pendingUrl, currentUrl) {
  if (!pendingUrl || !currentUrl) {
    console.log('[DSG Extension] URL match failed - missing URL', { pendingUrl, currentUrl });
    return false;
  }
  
  try {
    const pending = new URL(pendingUrl);
    const current = new URL(currentUrl);
    
    // Exact hostname match
    if (pending.hostname === current.hostname) {
      console.log('[DSG Extension] URL match - exact hostname');
      return true;
    }
    
    // Check if same domain (ignoring subdomain)
    const pendingDomain = pending.hostname.split('.').slice(-2).join('.');
    const currentDomain = current.hostname.split('.').slice(-2).join('.');
    
    if (pendingDomain === currentDomain) {
      console.log('[DSG Extension] URL match - same domain');
      return true;
    }
    
    // Check if current URL hostname contains pending domain
    if (current.hostname.includes(pending.hostname) || pending.hostname.includes(current.hostname)) {
      console.log('[DSG Extension] URL match - partial hostname');
      return true;
    }
    
    console.log('[DSG Extension] URL match failed', { pendingDomain, currentDomain });
    return false;
  } catch (e) {
    console.log('[DSG Extension] URL match error:', e);
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
    const pending = pendingTabs[tabId];
    if (pending) {
      if (pending.expiresAt < Date.now()) {
        delete pendingTabs[tabId];
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId, allFrames: true },
          files: ['content.js']
        },
        () => {
          if (chrome.runtime.lastError) {
            console.log('[DSG Extension] Script injection failed:', chrome.runtime.lastError.message);
          }
        }
      );
    }

    chrome.storage.local.get('pendingLogin', (data) => {
      if (data.pendingLogin && isUrlMatch(data.pendingLogin.url, tab.url)) {
        console.log('[DSG Extension] Tab loaded, re-checking for credential fill');
      }
    });
  }
});

console.log('[DSG Extension] Secure background service worker started');
