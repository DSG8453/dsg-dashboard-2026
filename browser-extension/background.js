// DSG Transport Secure Login - Background Service Worker
// HIDDEN TAB LOGIN: User never sees login page - it happens in background
// Credentials are encrypted and never visible to users

// Store pending login data
let pendingLogins = {};

// Track tabs waiting for login completion
let hiddenLoginTabs = {};

// Listen for messages from DSG Transport dashboard (external)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    // Dynamically capture the backend URL from the sender's origin
    if (sender.origin) {
      setBackendUrl(sender.origin);
    } else if (sender.url) {
      try {
        const url = new URL(sender.url);
        setBackendUrl(url.origin);
      } catch (e) {}
    }
    
    // NEW: Secure login with HIDDEN TAB (user never sees login page)
    if (request.action === 'DSG_SECURE_LOGIN') {
      handleHiddenTabLogin(request, sendResponse);
      return true; // Keep channel open for async response
    }
    
    // Legacy support
    if (request.action === 'DSG_AUTO_LOGIN') {
      handleHiddenTabLogin(request, sendResponse);
      return true;
    }
    
    if (request.action === 'DSG_CHECK_EXTENSION') {
      sendResponse({ 
        installed: true, 
        version: chrome.runtime.getManifest().version,
        ready: true,
        secure: true,
        hiddenLogin: true // Indicates this version supports hidden tab login
      });
      return true;
    }
    
    return false;
  }
);

// Listen for internal messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PENDING_LOGIN') {
    // Check if there's a pending login for this tab
    chrome.storage.local.get('pendingLogin', (data) => {
      const pending = data.pendingLogin;
      if (pending && isUrlMatch(pending.url, sender.tab?.url)) {
        // Include the tab ID so content script knows this is its login
        sendResponse({ ...pending, tabId: sender.tab?.id });
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
  
  // LOGIN COMPLETE - Show the hidden tab!
  if (request.action === 'LOGIN_SUCCESS') {
    const tabId = sender.tab?.id;
    if (tabId && hiddenLoginTabs[tabId]) {
      // Login successful - now show the tab to user
      chrome.tabs.update(tabId, { active: true }, () => {
        // Clean up
        delete hiddenLoginTabs[tabId];
      });
    }
    sendResponse({ acknowledged: true });
    return true;
  }
  
  if (request.action === 'LOGIN_FAILED') {
    const tabId = sender.tab?.id;
    if (tabId && hiddenLoginTabs[tabId]) {
      // Login failed - still show tab so user can login manually
      chrome.tabs.update(tabId, { active: true });
      delete hiddenLoginTabs[tabId];
    }
    console.warn('[DSG] Login failed:', request.reason);
    sendResponse({ acknowledged: true });
    return true;
  }
  
  // Page navigated (likely after successful login)
  if (request.action === 'PAGE_NAVIGATED') {
    const tabId = sender.tab?.id;
    if (tabId && hiddenLoginTabs[tabId]) {
      // Check if we're now on a different page (post-login)
      const loginUrl = hiddenLoginTabs[tabId].loginUrl;
      const currentUrl = sender.tab?.url;
      
      // If URL changed significantly, login probably succeeded
      if (currentUrl && loginUrl && !currentUrl.includes('login') && currentUrl !== loginUrl) {
        chrome.tabs.update(tabId, { active: true });
        delete hiddenLoginTabs[tabId];
      }
    }
    sendResponse({ acknowledged: true });
    return true;
  }
  
  return false;
});

// NEW: Handle secure login with HIDDEN TAB
async function handleHiddenTabLogin(request, sendResponse) {
  try {
    const backendUrl = getDynamicBackendUrl();
    
    let username, password, usernameField, passwordField;
    
    // Check if we have encrypted payload (new secure method)
    if (request.encryptedPayload) {
      // Decrypt credentials from backend
      let decryptResponse;
      try {
        decryptResponse = await fetch(backendUrl + '/api/secure-access/decrypt-payload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': chrome.runtime.getURL('')
          },
          body: JSON.stringify({
            encrypted: request.encryptedPayload
          })
        });
      } catch (fetchError) {
        console.error('[DSG] Network error:', fetchError.message);
        throw new Error('Network error: ' + fetchError.message);
      }
      
      if (!decryptResponse.ok) {
        const errorText = await decryptResponse.text();
        throw new Error('Decrypt failed: ' + errorText);
      }
      
      const decrypted = await decryptResponse.json();
      
      if (!decrypted.success || !decrypted.u || !decrypted.p) {
        throw new Error(decrypted.error || 'Decryption failed');
      }
      
      username = decrypted.u;
      password = decrypted.p;
      usernameField = request.usernameField || decrypted.uf || 'username';
      passwordField = request.passwordField || decrypted.pf || 'password';
    } else {
      // Legacy: credentials passed directly
      username = request.username;
      password = request.password;
      usernameField = request.usernameField || 'username';
      passwordField = request.passwordField || 'password';
    }
    
    if (!username || !password) {
      throw new Error('Missing credentials');
    }
    
    // Store login data
    const loginData = {
      url: request.loginUrl,
      username: username,
      password: password,
      usernameField: usernameField,
      passwordField: passwordField,
      toolName: request.toolName,
      autoSubmit: true,
      hiddenLogin: true, // Flag for hidden tab mode
      timestamp: Date.now()
    };
    
    await chrome.storage.local.set({ pendingLogin: loginData });
    
    // HIDDEN TAB: Open tab in background (user doesn't see it)
    const tab = await chrome.tabs.create({ 
      url: request.loginUrl,
      active: false,  // KEY: Tab opens in background, not visible
      pinned: false
    });
    
    // Track this tab for showing after login
    hiddenLoginTabs[tab.id] = {
      loginUrl: request.loginUrl,
      toolName: request.toolName,
      createdAt: Date.now()
    };
    
    // Set a timeout - if login doesn't complete in 15 seconds, show tab anyway
    setTimeout(() => {
      if (hiddenLoginTabs[tab.id]) {
        chrome.tabs.get(tab.id, (t) => {
          if (!chrome.runtime.lastError && t) {
            chrome.tabs.update(tab.id, { active: true });
          }
        });
        delete hiddenLoginTabs[tab.id];
      }
    }, 15000);
    
    // Clear credentials from memory
    setTimeout(() => {
      loginData.username = null;
      loginData.password = null;
    }, 10000);
    
    sendResponse({ 
      success: true, 
      tabId: tab.id,
      message: 'Hidden login initiated - tab will appear when ready',
      hiddenLogin: true
    });
    
  } catch (error) {
    console.error('[DSG] Hidden login error:', error.message);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get backend URL dynamically
function getBackendUrl() {
  return 'https://portal.dsgtransport.net';
}

let dynamicBackendUrl = null;

function setBackendUrl(url) {
  if (url && url.includes('dsgtransport')) {
    dynamicBackendUrl = url.replace(/\/$/, '');
  }
}

function getDynamicBackendUrl() {
  return dynamicBackendUrl || getBackendUrl();
}

// Check if two URLs match
function isUrlMatch(pendingUrl, currentUrl) {
  if (!pendingUrl || !currentUrl) return false;
  
  try {
    const pending = new URL(pendingUrl);
    const current = new URL(currentUrl);
    
    if (pending.hostname === current.hostname) return true;
    
    const pendingDomain = pending.hostname.split('.').slice(-2).join('.');
    const currentDomain = current.hostname.split('.').slice(-2).join('.');
    
    if (pendingDomain === currentDomain) return true;
    if (current.hostname.includes(pending.hostname) || pending.hostname.includes(current.hostname)) return true;
    
    return false;
  } catch (e) {
    return false;
  }
}

// Clean up expired data periodically
setInterval(() => {
  // Clean expired pending logins
  chrome.storage.local.get('pendingLogin', (data) => {
    if (data.pendingLogin) {
      const age = Date.now() - data.pendingLogin.timestamp;
      if (age > 2 * 60 * 1000) {
        chrome.storage.local.remove('pendingLogin');
      }
    }
  });
  
  // Clean expired hidden tab trackers
  const now = Date.now();
  for (const tabId in hiddenLoginTabs) {
    if (now - hiddenLoginTabs[tabId].createdAt > 60000) {
      delete hiddenLoginTabs[tabId];
    }
  }
}, 30000);

// Listen for tab navigation to detect post-login redirects
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && hiddenLoginTabs[tabId]) {
    const loginUrl = hiddenLoginTabs[tabId].loginUrl;
    const currentUrl = tab.url;
    
    // If URL changed from login page, show the tab
    if (currentUrl && loginUrl) {
      try {
        const loginHost = new URL(loginUrl).hostname;
        const currentHost = new URL(currentUrl).hostname;
        
        // Same domain but different page = probably logged in
        if (loginHost === currentHost && currentUrl !== loginUrl && !currentUrl.toLowerCase().includes('login')) {
          chrome.tabs.update(tabId, { active: true });
          delete hiddenLoginTabs[tabId];
        }
      } catch (e) {}
    }
  }
});
