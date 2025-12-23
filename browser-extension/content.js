// DSG Transport Secure Login - Content Script
// Auto-fills credentials on login pages

(function() {
  'use strict';
  
  console.log('[DSG Extension] Content script loaded on:', window.location.href);
  
  // Wait for page to be ready, then check for pending login
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoFill);
  } else {
    initAutoFill();
  }
  
  function initAutoFill() {
    // Small delay to ensure page is fully rendered
    setTimeout(checkAndFillCredentials, 1000);
  }
  
  function checkAndFillCredentials() {
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
      if (chrome.runtime.lastError) {
        console.log('[DSG Extension] Error getting pending login:', chrome.runtime.lastError);
        return;
      }
      
      if (!pending) {
        console.log('[DSG Extension] No pending login for this page');
        return;
      }
      
      console.log('[DSG Extension] Found pending login for:', pending.toolName);
      
      // Check if credentials are still fresh (< 5 minutes)
      if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
        console.log('[DSG Extension] Pending login expired');
        chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
        return;
      }
      
      // Try to fill credentials
      fillCredentials(pending);
    });
  }
  
  function fillCredentials(creds) {
    console.log('[DSG Extension] Attempting to fill credentials...');
    
    const usernameInput = findUsernameField(creds.usernameField);
    const passwordInput = findPasswordField(creds.passwordField);
    
    if (usernameInput && passwordInput) {
      console.log('[DSG Extension] Found login fields, filling...');
      
      // IMPORTANT: Disable Chrome's password save prompt by modifying autocomplete attributes
      disablePasswordSavePrompt(usernameInput, passwordInput);
      
      // Fill username
      fillField(usernameInput, creds.username);
      
      // Small delay before filling password
      setTimeout(() => {
        fillField(passwordInput, creds.password);
        
        // Show success notification
        showNotification('✅ Credentials filled by DSG Transport', 'success');
        
        // Clear pending login
        chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
        
        // Report success
        chrome.runtime.sendMessage({ 
          action: 'LOGIN_SUCCESS', 
          toolName: creds.toolName 
        });
        
        console.log('[DSG Extension] Credentials filled successfully!');
        
      }, 200);
      
    } else {
      console.log('[DSG Extension] Could not find login fields, retrying...');
      // Retry a few times with increasing delays
      retryFillCredentials(creds, 1);
    }
  }
  
  // Prevent Chrome from showing "Save Password?" prompt
  function disablePasswordSavePrompt(usernameInput, passwordInput) {
    console.log('[DSG Extension] Disabling password save prompt...');
    
    // Method 1: Set autocomplete attributes to prevent password manager detection
    usernameInput.setAttribute('autocomplete', 'off');
    usernameInput.setAttribute('data-lpignore', 'true'); // LastPass ignore
    usernameInput.setAttribute('data-form-type', 'other'); // Generic form type
    
    passwordInput.setAttribute('autocomplete', 'new-password');
    passwordInput.setAttribute('data-lpignore', 'true');
    passwordInput.setAttribute('data-form-type', 'other');
    
    // Method 2: Find and modify the parent form
    const form = usernameInput.closest('form') || passwordInput.closest('form');
    if (form) {
      form.setAttribute('autocomplete', 'off');
      form.setAttribute('data-lpignore', 'true');
      
      // Method 3: Intercept form submission to prevent password save dialog
      form.addEventListener('submit', function(e) {
        // Reset autocomplete temporarily before submit
        passwordInput.setAttribute('autocomplete', 'new-password');
      }, true);
    }
    
    // Method 4: Create a hidden dummy password field to confuse password managers
    // This is a well-known technique used by many banking sites
    const dummyContainer = document.createElement('div');
    dummyContainer.style.cssText = 'position:absolute;top:-9999px;left:-9999px;';
    dummyContainer.innerHTML = `
      <input type="text" name="dsg_dummy_user_${Date.now()}" autocomplete="username">
      <input type="password" name="dsg_dummy_pass_${Date.now()}" autocomplete="current-password">
    `;
    document.body.appendChild(dummyContainer);
    
    // Method 5: Temporarily change password field type during fill
    // This prevents some password managers from detecting the fill
    const originalType = passwordInput.type;
    passwordInput.type = 'text';
    setTimeout(() => {
      passwordInput.type = originalType;
    }, 50);
    
    console.log('[DSG Extension] Password save prompt prevention applied');
  }
  
  function retryFillCredentials(creds, attempt) {
    const maxAttempts = 5;
    const delay = attempt * 1500; // Increasing delay
    
    if (attempt > maxAttempts) {
      console.log('[DSG Extension] Max retries reached, showing manual login notice');
      showNotification('⚠️ Could not auto-fill. Please login manually.', 'warning');
      chrome.runtime.sendMessage({ 
        action: 'LOGIN_FAILED', 
        reason: 'Could not find login fields',
        toolName: creds.toolName 
      });
      return;
    }
    
    setTimeout(() => {
      const usernameInput = findUsernameField(creds.usernameField);
      const passwordInput = findPasswordField(creds.passwordField);
      
      if (usernameInput && passwordInput) {
        fillField(usernameInput, creds.username);
        setTimeout(() => {
          fillField(passwordInput, creds.password);
          showNotification('✅ Credentials filled by DSG Transport', 'success');
          chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
          chrome.runtime.sendMessage({ action: 'LOGIN_SUCCESS', toolName: creds.toolName });
        }, 200);
      } else {
        console.log(`[DSG Extension] Retry ${attempt}/${maxAttempts}...`);
        retryFillCredentials(creds, attempt + 1);
      }
    }, delay);
  }
  
  function findUsernameField(preferredName) {
    // Try specific field name first
    const selectors = [
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      // Common username/email field patterns
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[name*="account" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[id*="login" i]',
      'input[type="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]',
      'input[placeholder*="login" i]',
      // ASP.NET specific
      'input[name*="txtUser" i]',
      'input[id*="txtUser" i]',
      'input[name*="UserName" i]',
      'input[name*="LOGIN_ID" i]',
      'input[name="Email"]',
      // Generic text input in login forms
      'form input[type="text"]:first-of-type'
    ];
    
    for (const selector of selectors) {
      try {
        const input = document.querySelector(selector);
        if (input && isVisible(input)) {
          console.log('[DSG Extension] Found username field:', selector);
          return input;
        }
      } catch (e) {}
    }
    
    return null;
  }
  
  function findPasswordField(preferredName) {
    const selectors = [
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[name*="pwd" i]',
      'input[id*="pass" i]',
      'input[id*="pwd" i]',
      'input[autocomplete="current-password"]',
      'input[autocomplete="password"]',
      // ASP.NET specific
      'input[name*="txtPass" i]',
      'input[id*="txtPass" i]',
      'input[name*="Password" i]',
      'input[name="PASSWORD"]'
    ];
    
    for (const selector of selectors) {
      try {
        const input = document.querySelector(selector);
        if (input && isVisible(input)) {
          console.log('[DSG Extension] Found password field:', selector);
          return input;
        }
      } catch (e) {}
    }
    
    return null;
  }
  
  function isVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }
  
  function fillField(element, value) {
    if (!element || !value) return;
    
    // Focus the element
    element.focus();
    
    // Clear existing value
    element.value = '';
    
    // Use native value setter for React/Angular/Vue compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    
    nativeInputValueSetter.call(element, value);
    
    // Also set directly
    element.value = value;
    
    // Dispatch all necessary events
    const events = ['input', 'change', 'blur', 'keydown', 'keyup', 'keypress'];
    events.forEach(eventType => {
      let event;
      if (eventType.startsWith('key')) {
        event = new KeyboardEvent(eventType, { bubbles: true, cancelable: true });
      } else {
        event = new Event(eventType, { bubbles: true, cancelable: true });
      }
      element.dispatchEvent(event);
    });
    
    // Visual feedback - brief green highlight
    const originalBg = element.style.backgroundColor;
    const originalTransition = element.style.transition;
    
    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = '#dcfce7'; // Light green
    
    setTimeout(() => {
      element.style.backgroundColor = originalBg || '';
      element.style.transition = originalTransition || '';
    }, 1000);
  }
  
  function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existing = document.getElementById('dsg-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'dsg-notification';
    notification.textContent = message;
    
    const bgColor = type === 'success' 
      ? 'linear-gradient(135deg, #059669, #10b981)' 
      : type === 'warning'
        ? 'linear-gradient(135deg, #d97706, #f59e0b)'
        : 'linear-gradient(135deg, #1e3a5f, #0f172a)';
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483647;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      animation: dsgSlideIn 0.3s ease;
    `;
    
    // Add animation keyframes if not exists
    if (!document.getElementById('dsg-styles')) {
      const style = document.createElement('style');
      style.id = 'dsg-styles';
      style.textContent = `
        @keyframes dsgSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes dsgSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'dsgSlideOut 0.3s ease forwards';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  // Also listen for page navigation (SPA)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[DSG Extension] URL changed, rechecking...');
      setTimeout(checkAndFillCredentials, 1000);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
})();
