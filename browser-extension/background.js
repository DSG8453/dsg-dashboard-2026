// DSG Transport Secure Login - Background Service Worker

// Listen for messages from DSG Transport dashboard
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log('Received external message:', request.action);
    
    if (request.action === 'DSG_AUTO_LOGIN') {
      // Store credentials temporarily and open login page
      const loginData = {
        url: request.loginUrl,
        username: request.username,
        password: request.password,
        usernameField: request.usernameField || 'username',
        passwordField: request.passwordField || 'password',
        toolName: request.toolName,
        timestamp: Date.now()
      };
      
      chrome.storage.local.set({ pendingLogin: loginData }, () => {
        // Open the login URL in new tab
        chrome.tabs.create({ url: request.loginUrl }, (tab) => {
          sendResponse({ success: true, tabId: tab.id });
        });
      });
      
      return true; // Keep channel open for async response
    }
    
    if (request.action === 'DSG_CHECK_EXTENSION') {
      sendResponse({ installed: true, version: '1.0.0' });
    }
  }
);

// Also listen for internal messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PENDING_LOGIN') {
    chrome.storage.local.get('pendingLogin', (data) => {
      sendResponse(data.pendingLogin || null);
    });
    return true;
  }
  
  if (request.action === 'CLEAR_PENDING_LOGIN') {
    chrome.storage.local.remove('pendingLogin');
    sendResponse({ success: true });
  }
});

// Clean up old credentials (older than 5 minutes)
setInterval(() => {
  chrome.storage.local.get('pendingLogin', (data) => {
    if (data.pendingLogin && Date.now() - data.pendingLogin.timestamp > 300000) {
      chrome.storage.local.remove('pendingLogin');
      console.log('Cleared expired login data');
    }
  });
}, 60000);