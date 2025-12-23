// DSG Transport Secure Login - Content Script
// Runs on every page to auto-fill credentials

(function() {
  // Check for pending login
  chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
    if (!pending) return;
    
    const currentUrl = window.location.href;
    const pendingHost = new URL(pending.url).hostname;
    const currentHost = window.location.hostname;
    
    // Check if we're on the right domain
    if (!currentHost.includes(pendingHost.split('.').slice(-2).join('.'))) {
      return;
    }
    
    // Check if credentials are still fresh (< 5 minutes)
    if (Date.now() - pending.timestamp > 300000) {
      chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
      return;
    }
    
    console.log('DSG Transport: Attempting auto-fill for', pending.toolName);
    
    // Wait for page to fully load
    setTimeout(() => fillCredentials(pending), 1500);
  });
  
  function fillCredentials(creds) {
    // Extensive list of username field selectors
    const usernameSelectors = [
      `input[name="${creds.usernameField}"]`,
      `input[id="${creds.usernameField}"]`,
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[id*="login" i]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]',
      'input[placeholder*="login" i]',
      'input[name="LOGIN_ID"]',
      'input[name="username"]',
      'input[name="email"]',
      'input[name="Email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[name*="txtUser" i]',
      'input[id*="txtUser" i]'
    ];
    
    // Extensive list of password field selectors
    const passwordSelectors = [
      `input[name="${creds.passwordField}"]`,
      `input[id="${creds.passwordField}"]`,
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[id*="pass" i]',
      'input[name="PASSWORD"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]',
      'input[name*="txtPass" i]',
      'input[id*="txtPass" i]'
    ];
    
    let usernameInput = null;
    let passwordInput = null;
    
    // Find username field
    for (const selector of usernameSelectors) {
      usernameInput = document.querySelector(selector);
      if (usernameInput && usernameInput.offsetParent !== null) break;
    }
    
    // Find password field
    for (const selector of passwordSelectors) {
      passwordInput = document.querySelector(selector);
      if (passwordInput && passwordInput.offsetParent !== null) break;
    }
    
    if (usernameInput && passwordInput) {
      // Fill the fields using native value setter for React compatibility
      setNativeValue(usernameInput, creds.username);
      setNativeValue(passwordInput, creds.password);
      
      // Visual feedback - brief green highlight
      usernameInput.style.transition = 'background-color 0.3s';
      passwordInput.style.transition = 'background-color 0.3s';
      usernameInput.style.backgroundColor = '#dcfce7';
      passwordInput.style.backgroundColor = '#dcfce7';
      
      setTimeout(() => {
        usernameInput.style.backgroundColor = '';
        passwordInput.style.backgroundColor = '';
      }, 1000);
      
      // Clear pending login
      chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
      
      console.log('DSG Transport: Credentials auto-filled successfully!');
      
      // Show notification
      showNotification('✅ Credentials filled by DSG Transport');
      
    } else {
      console.log('DSG Transport: Could not find login fields');
      // Retry after a delay (page might still be loading)
      setTimeout(() => {
        retryFillCredentials(creds, 0);
      }, 2000);
    }
  }
  
  function retryFillCredentials(creds, attempt) {
    if (attempt >= 3) {
      console.log('DSG Transport: Max retries reached');
      return;
    }
    
    const usernameInput = document.querySelector('input[type="email"], input[name*="user" i], input[name*="email" i]');
    const passwordInput = document.querySelector('input[type="password"]');
    
    if (usernameInput && passwordInput) {
      setNativeValue(usernameInput, creds.username);
      setNativeValue(passwordInput, creds.password);
      chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
      showNotification('✅ Credentials filled by DSG Transport');
    } else {
      setTimeout(() => retryFillCredentials(creds, attempt + 1), 2000);
    }
  }
  
  // Set value using native setter for React/Angular/Vue compatibility
  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    
    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter?.call(element, value);
    } else {
      valueSetter?.call(element, value);
    }
    
    element.value = value;
    
    // Dispatch all possible events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));
  }
  
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #1e3a5f, #0f172a);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
})();