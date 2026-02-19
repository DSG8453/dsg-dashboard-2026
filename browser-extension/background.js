// DSG Transport Secure Login - Background Service Worker
// Opens tab VISIBLE with overlay covering login form
// User sees loading screen, never the login form

// Listen for messages from DSG Transport dashboard
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (sender.origin) setBackendUrl(sender.origin);
  
  if (request.action === 'DSG_SECURE_LOGIN') {
    handleSecureLogin(request, sendResponse);
    return true;
  }
  
  if (request.action === 'DSG_AUTO_LOGIN') {
    handleSecureLogin(request, sendResponse);
    return true;
  }
  
  if (request.action === 'DSG_CHECK_EXTENSION') {
    sendResponse({ 
      installed: true, 
      version: chrome.runtime.getManifest().version,
      ready: true,
      secure: true
    });
    return true;
  }
  
  return false;
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PENDING_LOGIN') {
    chrome.storage.local.get('pendingLogin', (data) => {
      const pending = data.pendingLogin;
      const senderTabId = sender.tab?.id;
      
      if (!pending) {
        sendResponse({ status: 'empty' });
        return;
      }
      
      // Expired pending login should never be used
      if (!pending.timestamp || Date.now() - pending.timestamp > 120000) {
        chrome.storage.local.remove('pendingLogin');
        sendResponse({ status: 'expired' });
        return;
      }
      
      // Brief race: tab is being created and targetTabId is not attached yet
      if (!pending.targetTabId) {
        sendResponse({ status: 'waiting' });
        return;
      }
      
      // Never release credentials to a different tab
      if (!senderTabId || senderTabId !== pending.targetTabId) {
        sendResponse({ status: 'empty' });
        return;
      }
      
      // Keep pending login until content script reports success/failure.
      // This supports multi-step redirects where content script re-runs.
      sendResponse({ status: 'ready', ...pending });
    });
    return true;
  }
  
  if (request.action === 'CLEAR_PENDING_LOGIN') {
    chrome.storage.local.remove('pendingLogin');
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'LOGIN_SUCCESS') {
    clearPendingLoginForTab(sender.tab?.id);
    notifyTopFrameHideOverlay(sender.tab?.id);
    sendResponse({ acknowledged: true });
    return true;
  }
  
  if (request.action === 'LOGIN_FAILED') {
    // Ignore failure reports from child frames so they don't cancel valid iframe logins.
    if ((sender.frameId ?? 0) === 0) {
      clearPendingLoginForTab(sender.tab?.id);
    }
    sendResponse({ acknowledged: true });
    return true;
  }
  
  return false;
});

// Handle secure login - Opens tab VISIBLE (overlay will cover it)
async function handleSecureLogin(request, sendResponse) {
  try {
    let username, password, usernameField, passwordField;
    
    if (request.encryptedPayload) {
      const backendUrl = getDynamicBackendUrl();
      const decryptResponse = await fetch(backendUrl + '/api/secure-access/decrypt-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted: request.encryptedPayload })
      });
      
      if (!decryptResponse.ok) throw new Error('Decrypt failed');
      
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
    
    if (!username || !password) throw new Error('Missing credentials');
    
    const loginData = {
      url: request.loginUrl,
      username: username,
      password: password,
      usernameField: usernameField,
      passwordField: passwordField,
      toolName: request.toolName,
      timestamp: Date.now(),
      targetTabId: null
    };
    
    await chrome.storage.local.set({ pendingLogin: loginData });
    
    // Open tab VISIBLE - overlay will cover login form immediately
    const tab = await chrome.tabs.create({ 
      url: request.loginUrl,
      active: true  // VISIBLE - but overlay covers everything
    });
    
    // Bind credentials to only this tab (prevents other tabs from consuming pending login)
    loginData.targetTabId = tab.id;
    await chrome.storage.local.set({ pendingLogin: loginData });
    
    // Clear credentials from memory
    setTimeout(() => {
      loginData.username = null;
      loginData.password = null;
    }, 15000);
    
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

let dynamicBackendUrl = null;
function setBackendUrl(url) {
  if (url && url.includes('dsgtransport')) {
    dynamicBackendUrl = url.replace(/\/$/, '');
  }
}
function getDynamicBackendUrl() {
  return dynamicBackendUrl || 'https://portal.dsgtransport.net';
}

function clearPendingLoginForTab(tabId) {
  if (!tabId) return;
  chrome.storage.local.get('pendingLogin', (data) => {
    const pending = data.pendingLogin;
    if (!pending) return;
    if (!pending.targetTabId || pending.targetTabId === tabId) {
      chrome.storage.local.remove('pendingLogin');
    }
  });
}

function notifyTopFrameHideOverlay(tabId) {
  if (!tabId) return;
  chrome.tabs.sendMessage(
    tabId,
    { action: 'HIDE_LOADING_OVERLAY' },
    { frameId: 0 },
    () => {
      // Ignore "Receiving end does not exist" during navigation races.
      void chrome.runtime.lastError;
    }
  );
}

// If the target tab is closed, clear pending credentials immediately
chrome.tabs.onRemoved.addListener((tabId) => {
  clearPendingLoginForTab(tabId);
});

// Cleanup expired data
setInterval(() => {
  chrome.storage.local.get('pendingLogin', (data) => {
    if (data.pendingLogin && Date.now() - data.pendingLogin.timestamp > 120000) {
      chrome.storage.local.remove('pendingLogin');
    }
  });
}, 30000);
