// DSG Transport Secure Login - Content Script
// HIDDEN TAB LOGIN: Fills credentials in background tab, user never sees login page

(function() {
  'use strict';
  
  // Track if we've already processed login
  let loginProcessed = false;
  let isHiddenMode = false;
  
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoFill);
  } else {
    initAutoFill();
  }
  
  function initAutoFill() {
    // Check for pending login
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
      if (chrome.runtime.lastError) return;
      
      if (pending && !loginProcessed) {
        loginProcessed = true;
        isHiddenMode = pending.hiddenLogin === true;
        
        // In hidden mode, skip the overlay (tab is not visible anyway)
        fillCredentialsWithData(pending);
      }
    });
  }
  
  // Fill credentials
  function fillCredentialsWithData(creds) {
    let attempts = 0;
    const maxAttempts = 15; // More attempts for hidden mode
    
    const tryFill = () => {
      attempts++;
      
      const usernameInput = findUsernameField(creds.usernameField);
      const passwordInput = findPasswordField(creds.passwordField);
      
      if (usernameInput && passwordInput) {
        // Disable password save prompt
        disablePasswordSavePrompt(usernameInput, passwordInput);
        
        // Fill username
        fillField(usernameInput, creds.username);
        
        // Fill password after short delay
        setTimeout(() => {
          fillField(passwordInput, creds.password);
          
          // Submit the form
          setTimeout(() => {
            const loginButton = findLoginButton();
            if (loginButton) {
              submitFormStealthily(usernameInput, passwordInput, loginButton, creds);
            } else {
              // No button found - try form submit
              const form = usernameInput.closest('form') || passwordInput.closest('form');
              if (form) {
                try {
                  form.submit();
                  notifyLoginSuccess(creds.toolName);
                } catch (e) {
                  notifyLoginFailed('Could not submit form');
                }
              } else {
                notifyLoginFailed('No login button found');
              }
            }
          }, 300);
        }, 200);
        
        return;
      }
      
      // Retry
      if (attempts < maxAttempts) {
        setTimeout(tryFill, 500);
      } else {
        notifyLoginFailed('Could not find login fields');
      }
    };
    
    // Start trying after page settles
    setTimeout(tryFill, 300);
  }
  
  // Notify background that login succeeded - this will show the hidden tab
  function notifyLoginSuccess(toolName) {
    chrome.runtime.sendMessage({ 
      action: 'LOGIN_SUCCESS', 
      toolName: toolName 
    });
  }
  
  // Notify background that login failed
  function notifyLoginFailed(reason) {
    chrome.runtime.sendMessage({ 
      action: 'LOGIN_FAILED', 
      reason: reason 
    });
  }
  
  // Submit form stealthily (bypass password save prompts)
  function submitFormStealthily(usernameInput, passwordInput, loginButton, creds) {
    const form = usernameInput.closest('form') || passwordInput.closest('form');
    
    // Store original names
    const originalUserName = usernameInput.name;
    const originalPassName = passwordInput.name;
    
    // Scramble field names to prevent Chrome password save
    const scrambledSuffix = `_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    usernameInput.name = 'field_a' + scrambledSuffix;
    passwordInput.name = 'field_b' + scrambledSuffix;
    usernameInput.setAttribute('autocomplete', 'off');
    passwordInput.setAttribute('autocomplete', 'new-password');
    
    if (form) {
      form.setAttribute('autocomplete', 'off');
    }
    
    // Click login button
    requestAnimationFrame(() => {
      loginButton.click();
      
      // Notify success (tab will be shown after navigation)
      notifyLoginSuccess(creds.toolName);
      
      // Backup: try form submit if click didn't work
      if (form) {
        setTimeout(() => {
          if (document.contains(loginButton)) {
            try {
              if (form.requestSubmit) {
                form.requestSubmit(loginButton);
              } else {
                form.submit();
              }
            } catch (e) {}
          }
        }, 300);
      }
      
      // Restore names
      setTimeout(() => {
        if (document.contains(usernameInput)) usernameInput.name = originalUserName;
        if (document.contains(passwordInput)) passwordInput.name = originalPassName;
      }, 500);
    });
  }
  
  // Find login button
  function findLoginButton() {
    const buttonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[id*="login" i]',
      'button[id*="signin" i]',
      'button[id*="submit" i]',
      'input[id*="login" i]',
      'input[id*="submit" i]',
      'button[name*="login" i]',
      'button[name*="submit" i]',
      'button[class*="login" i]',
      'button[class*="signin" i]',
      'button[class*="submit" i]',
      '.login-button',
      '.signin-button',
      '.submit-button',
      '.btn-login',
      '.btn-signin',
      'input[name*="btnLogin" i]',
      'input[name*="btnSubmit" i]',
      'input[id*="btnLogin" i]',
      'form button:not([type="button"])',
      'form input[type="image"]',
      'a[class*="login" i]',
      'a[class*="signin" i]',
    ];
    
    for (const selector of buttonSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (isVisible(el) && isLikelyLoginButton(el)) {
            return el;
          }
        }
      } catch (e) {}
    }
    
    // Text-based search
    const allButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button');
    const loginKeywords = ['sign in', 'signin', 'log in', 'login', 'submit', 'continue', 'enter', 'next', 'go'];
    
    for (const btn of allButtons) {
      if (!isVisible(btn)) continue;
      
      const text = (btn.textContent || btn.value || '').toLowerCase().trim();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      
      for (const keyword of loginKeywords) {
        if (text.includes(keyword) || ariaLabel.includes(keyword)) {
          return btn;
        }
      }
    }
    
    // Last resort: submit button in form with password
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      if (form.querySelector('input[type="password"]')) {
        const submitBtn = form.querySelector('button, input[type="submit"]');
        if (submitBtn && isVisible(submitBtn)) {
          return submitBtn;
        }
      }
    }
    
    return null;
  }
  
  function isLikelyLoginButton(el) {
    const text = (el.textContent || el.value || '').toLowerCase();
    const skipKeywords = ['forgot', 'reset', 'register', 'signup', 'sign up', 'create', 'cancel', 'back'];
    for (const skip of skipKeywords) {
      if (text.includes(skip)) return false;
    }
    return true;
  }
  
  // Prevent password save prompt
  function disablePasswordSavePrompt(usernameInput, passwordInput) {
    const randomSuffix = `_dsg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Set autocomplete attributes
    usernameInput.setAttribute('autocomplete', 'off');
    usernameInput.setAttribute('data-lpignore', 'true');
    usernameInput.setAttribute('data-1p-ignore', 'true');
    usernameInput.setAttribute('data-bwignore', 'true');
    
    passwordInput.setAttribute('autocomplete', 'new-password');
    passwordInput.setAttribute('data-lpignore', 'true');
    passwordInput.setAttribute('data-1p-ignore', 'true');
    passwordInput.setAttribute('data-bwignore', 'true');
    
    const form = usernameInput.closest('form') || passwordInput.closest('form');
    if (form) {
      form.setAttribute('autocomplete', 'off');
      form.setAttribute('data-lpignore', 'true');
    }
    
    // Dummy fields to confuse password managers
    const dummyContainer = document.createElement('div');
    dummyContainer.setAttribute('aria-hidden', 'true');
    dummyContainer.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;';
    dummyContainer.innerHTML = `
      <input type="text" name="username" autocomplete="username" tabindex="-1">
      <input type="password" name="password" autocomplete="current-password" tabindex="-1">
    `;
    
    if (form) {
      form.insertBefore(dummyContainer, form.firstChild);
    } else {
      document.body.insertBefore(dummyContainer, document.body.firstChild);
    }
    
    // Temporarily change password type
    const originalType = passwordInput.type;
    passwordInput.type = 'text';
    usernameInput.setAttribute('readonly', 'readonly');
    passwordInput.setAttribute('readonly', 'readonly');
    
    setTimeout(() => {
      usernameInput.removeAttribute('readonly');
      passwordInput.removeAttribute('readonly');
      passwordInput.type = originalType;
    }, 100);
  }
  
  function findUsernameField(preferredName) {
    const selectors = [
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      `input[name="${preferredName.replace(/\$/g, '_')}"]`,
      `input[id="${preferredName.replace(/\$/g, '_')}"]`,
      `input[name*="txtUserName" i]`,
      `input[name*="txtUser" i]`,
      `input[name*="UserName" i]`,
      `input[id*="txtUserName" i]`,
      `input[id*="UserName" i]`,
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
      'input[name="Email"]',
      'input[name="LOGIN_ID"]',
      'form input[type="text"]:first-of-type'
    ];
    
    for (const selector of selectors) {
      try {
        const input = document.querySelector(selector);
        if (input && isVisible(input)) return input;
      } catch (e) {}
    }
    
    // Fallback
    const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (const input of allInputs) {
      if (isVisible(input) && !input.type.includes('hidden')) return input;
    }
    
    return null;
  }
  
  function findPasswordField(preferredName) {
    const selectors = [
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      `input[name="${preferredName.replace(/\$/g, '_')}"]`,
      `input[id="${preferredName.replace(/\$/g, '_')}"]`,
      `input[name*="txtPassword" i]`,
      `input[name*="txtPass" i]`,
      `input[id*="txtPassword" i]`,
      `input[id*="Password" i]`,
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[name*="pwd" i]',
      'input[id*="pass" i]',
      'input[id*="pwd" i]',
      'input[autocomplete="current-password"]',
      'input[name="PASSWORD"]'
    ];
    
    for (const selector of selectors) {
      try {
        const input = document.querySelector(selector);
        if (input && isVisible(input)) return input;
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
    
    element.focus();
    element.value = '';
    
    // Native value setter for React/Angular/Vue
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(element, value);
    element.value = value;
    
    // Dispatch events
    ['input', 'change', 'blur', 'keydown', 'keyup', 'keypress'].forEach(eventType => {
      let event;
      if (eventType.startsWith('key')) {
        event = new KeyboardEvent(eventType, { bubbles: true, cancelable: true });
      } else {
        event = new Event(eventType, { bubbles: true, cancelable: true });
      }
      element.dispatchEvent(event);
    });
  }
  
  // Detect page navigation (post-login redirect)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // Notify background of navigation
      chrome.runtime.sendMessage({ action: 'PAGE_NAVIGATED', url: lastUrl });
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Also listen for actual navigation events
  window.addEventListener('beforeunload', () => {
    // Page is navigating - likely login succeeded
    if (loginProcessed) {
      chrome.runtime.sendMessage({ action: 'PAGE_NAVIGATED', url: 'navigating' });
    }
  });
  
})();
