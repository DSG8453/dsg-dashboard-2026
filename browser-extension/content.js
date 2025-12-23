// DSG Transport Auto-Login Extension - Content Script
// This runs on every page and checks if we need to auto-fill credentials

(function() {
  // Check for pending login credentials
  chrome.storage.local.get('pendingLogin', (data) => {
    if (!data.pendingLogin) return;
    
    const pending = data.pendingLogin;
    const currentUrl = window.location.href;
    
    // Check if we're on the right login page
    if (!currentUrl.includes(new URL(pending.url).hostname)) return;
    
    // Check if credentials are still fresh (< 5 minutes)
    if (Date.now() - pending.timestamp > 300000) {
      chrome.storage.local.remove('pendingLogin');
      return;
    }
    
    // Wait for page to fully load
    setTimeout(() => {
      fillCredentials(pending);
    }, 1000);
  });
  
  function fillCredentials(creds) {
    // Common username field selectors
    const usernameSelectors = [
      `input[name="${creds.usernameField}"]`,
      `input[id*="${creds.usernameField}" i]`,
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]',
      'input[name="LOGIN_ID"]',
      'input[name="username"]',
      'input[name="email"]'
    ];
    
    // Common password field selectors
    const passwordSelectors = [
      `input[name="${creds.passwordField}"]`,
      `input[id*="${creds.passwordField}" i]`,
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[id*="pass" i]',
      'input[name="PASSWORD"]',
      'input[name="password"]'
    ];
    
    let usernameInput = null;
    let passwordInput = null;
    
    // Find username field
    for (const selector of usernameSelectors) {
      usernameInput = document.querySelector(selector);
      if (usernameInput) break;
    }
    
    // Find password field
    for (const selector of passwordSelectors) {
      passwordInput = document.querySelector(selector);
      if (passwordInput) break;
    }
    
    if (usernameInput && passwordInput) {
      // Fill the fields
      setNativeValue(usernameInput, creds.username);
      setNativeValue(passwordInput, creds.password);
      
      // Clear credentials from storage after filling
      chrome.storage.local.remove('pendingLogin');
      
      // Visual feedback
      usernameInput.style.backgroundColor = '#e8f5e9';
      passwordInput.style.backgroundColor = '#e8f5e9';
      
      setTimeout(() => {
        usernameInput.style.backgroundColor = '';
        passwordInput.style.backgroundColor = '';
      }, 1000);
      
      console.log('DSG Transport: Credentials auto-filled successfully');
    }
  }
  
  // Set value using native setter to work with React/Angular forms
  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    
    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else {
      valueSetter?.call(element, value);
    }
    
    element.value = value;
    
    // Dispatch events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }
})();