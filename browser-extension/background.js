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
      const senderTabId = sender?.tab?.id;
      const senderUrl = sender?.tab?.url;
      // If we opened the tab, prefer tabId match even across redirects/SSO domains.
      if (pending?.tabId && senderTabId && pending.tabId === senderTabId) {
        sendResponse(pending);
        return;
      }
      if (
        pending &&
        isUrlMatch(pending.url, senderUrl) &&
        (!pending.tabId || (senderTabId && pending.tabId === senderTabId))
      ) {
        // Do NOT remove here. Login pages are often inside iframes; the "wrong"
        // frame may request first. We clear on LOGIN_SUCCESS/CLEAR_PENDING_LOGIN
        // or via expiry cleanup.
        sendResponse(pending);
      } else {
        sendResponse(null);
      }
    });
    return true;
  }
  
  if (request.action === 'CLEAR_PENDING_LOGIN') {
    chrome.storage.local.get('pendingLogin', (data) => {
      const pending = data.pendingLogin;
      const senderTabId = sender?.tab?.id;
      const senderUrl = sender?.tab?.url;
      if (
        pending &&
        (
          (pending.tabId && senderTabId && pending.tabId === senderTabId) ||
          (isUrlMatch(pending.url, senderUrl) && (!pending.tabId || (senderTabId && pending.tabId === senderTabId)))
        )
      ) {
        chrome.storage.local.remove('pendingLogin', () => sendResponse({ success: true }));
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }
  
  if (request.action === 'LOGIN_SUCCESS') {
    chrome.storage.local.get('pendingLogin', (data) => {
      const pending = data.pendingLogin;
      const senderTabId = sender?.tab?.id;
      const senderUrl = sender?.tab?.url;
      if (
        pending &&
        (
          (pending.tabId && senderTabId && pending.tabId === senderTabId) ||
          (isUrlMatch(pending.url, senderUrl) && (!pending.tabId || (senderTabId && pending.tabId === senderTabId)))
        )
      ) {
        chrome.storage.local.remove('pendingLogin', () => sendResponse({ acknowledged: true, cleared: true }));
      } else {
        sendResponse({ acknowledged: true, cleared: false });
      }
    });
    return true;
  }

  if (request.action === 'LOGIN_FAILED') {
    // Don't clear pendingLogin on failure; another frame may still be able to fill.
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
      timestamp: Date.now()
    };
    
    await chrome.storage.local.set({ pendingLogin: loginData });
    
    // Open tab VISIBLE - overlay will cover login form immediately
    const tab = await chrome.tabs.create({ 
      url: request.loginUrl,
      active: true  // VISIBLE - but overlay covers everything
    });

    // Associate pending login with the created tab id
    try {
      await chrome.storage.local.set({ pendingLogin: { ...loginData, tabId: tab.id } });
    } catch (e) {
      // ignore
    }
    
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

// Cleanup expired data
setInterval(() => {
  chrome.storage.local.get('pendingLogin', (data) => {
    if (data.pendingLogin && Date.now() - data.pendingLogin.timestamp > 120000) {
      chrome.storage.local.remove('pendingLogin');
    }
  });
}, 30000);
