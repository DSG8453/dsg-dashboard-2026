// DSG Transport Secure Login - Background Service Worker
// HIDDEN TAB LOGIN: Opens tab in background, fills credentials, shows only after login complete
// User NEVER sees login page - only the logged-in dashboard

let hiddenTabs = {}; // Track tabs waiting for login completion

// Listen for messages from DSG Transport dashboard
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  // Capture backend URL
  if (sender.origin) {
    setBackendUrl(sender.origin);
  }
  
  if (request.action === 'DSG_SECURE_LOGIN') {
    handleHiddenLogin(request, sendResponse);
    return true;
  }
  
  if (request.action === 'DSG_AUTO_LOGIN') {
    handleHiddenLogin(request, sendResponse);
    return true;
  }
  
  if (request.action === 'DSG_CHECK_EXTENSION') {
    sendResponse({ 
      installed: true, 
      version: chrome.runtime.getManifest().version,
      ready: true,
      secure: true,
      hiddenLogin: true
    });
    return true;
  }
  
  return false;
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  
  if (request.action === 'GET_PENDING_LOGIN') {
    chrome.storage.local.get('pendingLogin', (data) => {
      const pending = data.pendingLogin;
      if (pending && isUrlMatch(pending.url, sender.tab?.url)) {
        sendResponse(pending);
        chrome.storage.local.remove('pendingLogin');
      } else {
        sendResponse(null);
      }
    });
    return true;
  }
  
  if (request.action === 'CLEAR_PENDING_LOGIN') {
    chrome.storage.local.remove('pendingLogin');
    sendResponse({ success: true });
    return true;
  }
  
  // LOGIN COMPLETE - NOW show the hidden tab!
  if (request.action === 'LOGIN_COMPLETE') {
    if (tabId && hiddenTabs[tabId]) {
      // Show the tab now
      chrome.tabs.update(tabId, { active: true });
      delete hiddenTabs[tabId];
    }
    sendResponse({ acknowledged: true });
    return true;
  }
  
  // LOGIN FAILED - still show tab so user can try manually
  if (request.action === 'LOGIN_FAILED') {
    if (tabId && hiddenTabs[tabId]) {
      chrome.tabs.update(tabId, { active: true });
      delete hiddenTabs[tabId];
    }
    sendResponse({ acknowledged: true });
    return true;
  }
  
  return false;
});

// Handle login with HIDDEN TAB
async function handleHiddenLogin(request, sendResponse) {
  try {
    let username, password, usernameField, passwordField;
    
    // Decrypt credentials if encrypted
    if (request.encryptedPayload) {
      const backendUrl = getDynamicBackendUrl();
      const decryptResponse = await fetch(backendUrl + '/api/secure-access/decrypt-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted: request.encryptedPayload })
      });
      
      if (!decryptResponse.ok) {
        throw new Error('Decrypt failed');
      }
      
      const decrypted = await decryptResponse.json();
      if (!decrypted.success || !decrypted.u || !decrypted.p) {
        throw new Error(decrypted.error || 'Invalid credentials');
      }
      
      username = decrypted.u;
      password = decrypted.p;
      usernameField = request.usernameField || decrypted.uf || 'username';
      passwordField = request.passwordField || decrypted.pf || 'password';
    } else {
      username = request.username;
      password = request.password;
      usernameField = request.usernameField || 'username';
      passwordField = request.passwordField || 'password';
    }
    
    if (!username || !password) {
      throw new Error('Missing credentials');
    }
    
    // Store pending login
    const loginData = {
      url: request.loginUrl,
      username: username,
      password: password,
      usernameField: usernameField,
      passwordField: passwordField,
      toolName: request.toolName,
      timestamp: Date.now()
    };
    
    await chrome.storage.local.set({ pendingLogin: loginData });
    
    // *** KEY: Open tab as HIDDEN (active: false) ***
    const tab = await chrome.tabs.create({ 
      url: request.loginUrl,
      active: false  // TAB IS HIDDEN - user doesn't see it
    });
    
    // Track this hidden tab
    hiddenTabs[tab.id] = {
      loginUrl: request.loginUrl,
      toolName: request.toolName,
      createdAt: Date.now()
    };
    
    // Safety timeout: Show tab after 20 seconds if login hasn't completed
    setTimeout(() => {
      if (hiddenTabs[tab.id]) {
        chrome.tabs.get(tab.id, (t) => {
          if (!chrome.runtime.lastError && t) {
            chrome.tabs.update(tab.id, { active: true });
          }
        });
        delete hiddenTabs[tab.id];
      }
    }, 20000);
    
    // Clear credentials from memory
    setTimeout(() => {
      loginData.username = null;
      loginData.password = null;
    }, 10000);
    
    sendResponse({ 
      success: true, 
      tabId: tab.id,
      hiddenLogin: true,
      message: 'Hidden login started'
    });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Detect when tab navigates (login succeeded)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && hiddenTabs[tabId]) {
    const tracked = hiddenTabs[tabId];
    
    // If URL changed from login page, login probably succeeded
    if (tab.url && tracked.loginUrl) {
      const isStillLoginPage = tab.url.toLowerCase().includes('login') || 
                               tab.url.toLowerCase().includes('signin') ||
                               tab.url === tracked.loginUrl;
      
      if (!isStillLoginPage) {
        // URL changed - login succeeded! Show the tab
        chrome.tabs.update(tabId, { active: true });
        delete hiddenTabs[tabId];
      }
    }
  }
});

// URL matching
function isUrlMatch(pendingUrl, currentUrl) {
  if (!pendingUrl || !currentUrl) return false;
  try {
    const pending = new URL(pendingUrl);
    const current = new URL(currentUrl);
    if (pending.hostname === current.hostname) return true;
    const pendingDomain = pending.hostname.split('.').slice(-2).join('.');
    const currentDomain = current.hostname.split('.').slice(-2).join('.');
    return pendingDomain === currentDomain;
  } catch (e) {
    return false;
  }
}

// Backend URL management
let dynamicBackendUrl = null;
function setBackendUrl(url) {
  if (url && url.includes('dsgtransport')) {
    dynamicBackendUrl = url.replace(/\/$/, '');
  }
}
function getDynamicBackendUrl() {
  return dynamicBackendUrl || 'https://portal.dsgtransport.net';
}

// Cleanup expired data
setInterval(() => {
  chrome.storage.local.get('pendingLogin', (data) => {
    if (data.pendingLogin && Date.now() - data.pendingLogin.timestamp > 120000) {
      chrome.storage.local.remove('pendingLogin');
    }
  });
  // Cleanup old hidden tabs
  const now = Date.now();
  for (const tabId in hiddenTabs) {
    if (now - hiddenTabs[tabId].createdAt > 60000) {
      delete hiddenTabs[tabId];
    }
  }
}, 30000);
