// DSG Transport Auto-Login Extension - Background Service Worker

// Listen for messages from the DSG Transport portal
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'autoLogin') {
    // Store credentials temporarily and open login page
    chrome.storage.local.set({
      pendingLogin: {
        url: request.loginUrl,
        username: request.username,
        password: request.password,
        usernameField: request.usernameField || 'username',
        passwordField: request.passwordField || 'password',
        timestamp: Date.now()
      }
    }, () => {
      // Open the login URL in new tab
      chrome.tabs.create({ url: request.loginUrl });
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'clearCredentials') {
    chrome.storage.local.remove('pendingLogin');
    sendResponse({ success: true });
  }
});

// Clean up old credentials (older than 5 minutes)
setInterval(() => {
  chrome.storage.local.get('pendingLogin', (data) => {
    if (data.pendingLogin && Date.now() - data.pendingLogin.timestamp > 300000) {
      chrome.storage.local.remove('pendingLogin');
    }
  });
}, 60000);