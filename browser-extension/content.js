// DSG Transport Secure Login - Content Script
// Auto-fills credentials AND auto-clicks login button for seamless access

(function() {
  'use strict';
  
  console.log('[DSG Extension] Content script loaded on:', window.location.href);
  
  // Show loading overlay immediately if we have pending login
  let loadingOverlay = null;
  
  // Wait for page to be ready, then check for pending login
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoFill);
  } else {
    initAutoFill();
  }
  
  function initAutoFill() {
    console.log('[DSG Extension] Initializing auto-fill on:', window.location.href);
    
    // Check for pending login and fill immediately if found
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
      console.log('[DSG Extension] Got pending login response:', pending ? 'YES' : 'NO');
      
      if (chrome.runtime.lastError) {
        console.log('[DSG Extension] Error:', chrome.runtime.lastError.message);
        return;
      }
      
      if (pending) {
        // Show loading overlay
        showLoadingOverlay(pending.toolName);
        
        // Fill credentials directly with the data we have
        console.log('[DSG Extension] Filling credentials immediately...');
        fillCredentialsWithData(pending);
      }
    });
  }
  
  // Fill credentials with provided data (doesn't fetch from storage again)
  function fillCredentialsWithData(creds) {
    console.log('[DSG Extension] fillCredentialsWithData called with:', {
      toolName: creds.toolName,
      url: creds.url,
      usernameField: creds.usernameField,
      passwordField: creds.passwordField,
      hasUsername: !!creds.username,
      hasPassword: !!creds.password
    });
    
    // Try multiple times with delays
    let attempts = 0;
    const maxAttempts = 10;
    
    const tryFill = () => {
      attempts++;
      console.log(`[DSG Extension] Fill attempt ${attempts}/${maxAttempts}`);
      
      const usernameInput = findUsernameField(creds.usernameField);
      const passwordInput = findPasswordField(creds.passwordField);
      
      console.log('[DSG Extension] Found fields:', {
        username: usernameInput ? (usernameInput.name || usernameInput.id || 'found') : 'NOT FOUND',
        password: passwordInput ? (passwordInput.name || passwordInput.id || 'found') : 'NOT FOUND'
      });
      
      if (usernameInput && passwordInput) {
        console.log('[DSG Extension] Both fields found, filling...');
        
        // Disable password save prompt
        disablePasswordSavePrompt(usernameInput, passwordInput);
        
        // Fill username
        fillField(usernameInput, creds.username);
        
        // Fill password after short delay
        setTimeout(() => {
          fillField(passwordInput, creds.password);
          console.log('[DSG Extension] Credentials filled!');
          
          // Auto-click login button
          setTimeout(() => {
            const loginButton = findLoginButton();
            if (loginButton) {
              console.log('[DSG Extension] Clicking login button...');
              loginButton.click();
              setTimeout(hideLoadingOverlay, 1500);
            } else {
              console.log('[DSG Extension] No login button found');
              showNotification('✅ Credentials filled - Click login to continue', 'success');
              hideLoadingOverlay();
            }
          }, 300);
        }, 200);
        
        return; // Success!
      }
      
      // Retry if not at max attempts
      if (attempts < maxAttempts) {
        setTimeout(tryFill, 500);
      } else {
        console.log('[DSG Extension] Max attempts reached, fields not found');
        showNotification('⚠️ Could not find login fields. Please login manually.', 'warning');
        hideLoadingOverlay();
      }
    };
    
    // Start trying after page settles
    setTimeout(tryFill, 500);
  }
  
  function showLoadingOverlay(toolName) {
    if (loadingOverlay) return; // Already showing
    
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dsg-loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="dsg-loading-content">
        <div class="dsg-loading-spinner"></div>
        <div class="dsg-loading-logo">🔐 DSG Transport</div>
        <div class="dsg-loading-text">Signing you into ${toolName || 'tool'}...</div>
        <div class="dsg-loading-subtext">Please wait, this only takes a moment</div>
      </div>
    `;
    
    loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.id = 'dsg-loading-styles';
    style.textContent = `
      .dsg-loading-content {
        text-align: center;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .dsg-loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255,255,255,0.2);
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: dsg-spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      .dsg-loading-logo {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 16px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .dsg-loading-text {
        font-size: 18px;
        font-weight: 500;
        margin-bottom: 8px;
      }
      .dsg-loading-subtext {
        font-size: 14px;
        color: #94a3b8;
      }
      @keyframes dsg-spin {
        to { transform: rotate(360deg); }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(loadingOverlay);
    
    // Fade in
    requestAnimationFrame(() => {
      loadingOverlay.style.opacity = '1';
    });
    
    console.log('[DSG Extension] Loading overlay shown');
  }
  
  function hideLoadingOverlay() {
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay?.remove();
        document.getElementById('dsg-loading-styles')?.remove();
        loadingOverlay = null;
      }, 300);
    }
  }
  
  function checkAndFillCredentials() {
    console.log('[DSG Extension] checkAndFillCredentials called on:', window.location.href);
    
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
      if (chrome.runtime.lastError) {
        console.log('[DSG Extension] Error getting pending login:', chrome.runtime.lastError.message);
        hideLoadingOverlay();
        return;
      }
      
      if (!pending) {
        console.log('[DSG Extension] No pending login data found in storage');
        hideLoadingOverlay();
        return;
      }
      
      console.log('[DSG Extension] Found pending login:', {
        toolName: pending.toolName,
        url: pending.url,
        usernameField: pending.usernameField,
        passwordField: pending.passwordField,
        hasUsername: !!pending.username,
        hasPassword: !!pending.password
      });
      
      // Check if credentials are still fresh (< 5 minutes)
      if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
        console.log('[DSG Extension] Pending login expired');
        chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
        hideLoadingOverlay();
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
      
      // IMPORTANT: Disable Chrome's password save prompt
      disablePasswordSavePrompt(usernameInput, passwordInput);
      
      // Fill username
      fillField(usernameInput, creds.username);
      
      // Small delay before filling password
      setTimeout(() => {
        fillField(passwordInput, creds.password);
        
        // Clear pending login immediately
        chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
        
        // Auto-click login button after a brief delay
        setTimeout(() => {
          const loginButton = findLoginButton();
          if (loginButton) {
            console.log('[DSG Extension] Found login button, clicking...');
            
            // Click the login button
            loginButton.click();
            
            // Also try form submit as backup
            const form = usernameInput.closest('form') || passwordInput.closest('form');
            if (form) {
              // Some sites need form.submit() instead of button click
              setTimeout(() => {
                if (document.contains(loginButton)) {
                  console.log('[DSG Extension] Trying form submit as backup...');
                  try {
                    form.submit();
                  } catch (e) {
                    console.log('[DSG Extension] Form submit failed, button click should work');
                  }
                }
              }, 500);
            }
            
            // Report success
            chrome.runtime.sendMessage({ 
              action: 'LOGIN_SUCCESS', 
              toolName: creds.toolName 
            });
            
            console.log('[DSG Extension] Auto-login initiated!');
            
            // Hide overlay after a short delay (let the page redirect)
            setTimeout(hideLoadingOverlay, 1500);
            
          } else {
            console.log('[DSG Extension] No login button found, credentials filled');
            showNotification('✅ Credentials filled - Click login to continue', 'success');
            hideLoadingOverlay();
            
            chrome.runtime.sendMessage({ 
              action: 'LOGIN_SUCCESS', 
              toolName: creds.toolName 
            });
          }
        }, 300);
        
      }, 200);
      
    } else {
      console.log('[DSG Extension] Could not find login fields, retrying...');
      // Retry a few times with increasing delays
      retryFillCredentials(creds, 1);
    }
  }
  
  // Find the login/submit button
  function findLoginButton() {
    const buttonSelectors = [
      // Standard buttons
      'button[type="submit"]',
      'input[type="submit"]',
      // Text-based matching
      'button:contains("Sign In")',
      'button:contains("Log In")',
      'button:contains("Login")',
      'button:contains("Submit")',
      'button:contains("Continue")',
      'button:contains("Next")',
      // ID/Name based
      'button[id*="login" i]',
      'button[id*="signin" i]',
      'button[id*="submit" i]',
      'input[id*="login" i]',
      'input[id*="submit" i]',
      'button[name*="login" i]',
      'button[name*="submit" i]',
      // Class based
      'button[class*="login" i]',
      'button[class*="signin" i]',
      'button[class*="submit" i]',
      '.login-button',
      '.signin-button',
      '.submit-button',
      '.btn-login',
      '.btn-signin',
      // ASP.NET specific
      'input[name*="btnLogin" i]',
      'input[name*="btnSubmit" i]',
      'input[id*="btnLogin" i]',
      // Generic form button
      'form button:not([type="button"])',
      'form input[type="image"]',
      // Links styled as buttons
      'a[class*="login" i]',
      'a[class*="signin" i]',
    ];
    
    // First try standard selectors
    for (const selector of buttonSelectors) {
      try {
        // Skip :contains pseudo-selector (not standard CSS)
        if (selector.includes(':contains')) continue;
        
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (isVisible(el) && isLikelyLoginButton(el)) {
            console.log('[DSG Extension] Found login button via selector:', selector);
            return el;
          }
        }
      } catch (e) {}
    }
    
    // Try text-based search for buttons
    const allButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button');
    const loginKeywords = ['sign in', 'signin', 'log in', 'login', 'submit', 'continue', 'enter', 'next', 'go'];
    
    for (const btn of allButtons) {
      if (!isVisible(btn)) continue;
      
      const text = (btn.textContent || btn.value || '').toLowerCase().trim();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      
      for (const keyword of loginKeywords) {
        if (text.includes(keyword) || ariaLabel.includes(keyword)) {
          console.log('[DSG Extension] Found login button via text match:', keyword);
          return btn;
        }
      }
    }
    
    // Last resort: find any submit button in a form with password field
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      if (form.querySelector('input[type="password"]')) {
        const submitBtn = form.querySelector('button, input[type="submit"]');
        if (submitBtn && isVisible(submitBtn)) {
          console.log('[DSG Extension] Found submit button in password form');
          return submitBtn;
        }
      }
    }
    
    return null;
  }
  
  // Check if element looks like a login button
  function isLikelyLoginButton(el) {
    const text = (el.textContent || el.value || '').toLowerCase();
    const skipKeywords = ['forgot', 'reset', 'register', 'signup', 'sign up', 'create', 'cancel', 'back'];
    
    for (const skip of skipKeywords) {
      if (text.includes(skip)) return false;
    }
    
    return true;
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
    const delay = attempt * 1000; // Increasing delay
    
    if (attempt > maxAttempts) {
      console.log('[DSG Extension] Max retries reached, showing manual login notice');
      showNotification('⚠️ Could not auto-fill. Please login manually.', 'warning');
      hideLoadingOverlay();
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
        // Apply password save prevention on retry as well
        disablePasswordSavePrompt(usernameInput, passwordInput);
        
        fillField(usernameInput, creds.username);
        setTimeout(() => {
          fillField(passwordInput, creds.password);
          
          chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_LOGIN' });
          
          // Auto-click login button
          setTimeout(() => {
            const loginButton = findLoginButton();
            if (loginButton) {
              console.log('[DSG Extension] Clicking login button on retry...');
              loginButton.click();
              setTimeout(hideLoadingOverlay, 1500);
            } else {
              showNotification('✅ Credentials filled - Click login to continue', 'success');
              hideLoadingOverlay();
            }
            chrome.runtime.sendMessage({ action: 'LOGIN_SUCCESS', toolName: creds.toolName });
          }, 300);
        }, 200);
      } else {
        console.log(`[DSG Extension] Retry ${attempt}/${maxAttempts}...`);
        retryFillCredentials(creds, attempt + 1);
      }
    }, delay);
  }
  
  function findUsernameField(preferredName) {
    console.log('[DSG Extension] Looking for username field with preferredName:', preferredName);
    
    // Try specific field name first (exact match)
    const selectors = [
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      // Handle ASP.NET encoded names ($ becomes _)
      `input[name="${preferredName.replace(/\$/g, '_')}"]`,
      `input[id="${preferredName.replace(/\$/g, '_')}"]`,
      // Partial match for ASP.NET
      `input[name*="txtUserName" i]`,
      `input[name*="txtUser" i]`,
      `input[name*="UserName" i]`,
      `input[id*="txtUserName" i]`,
      `input[id*="UserName" i]`,
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
      'input[name="Email"]',
      'input[name="LOGIN_ID"]',
      // Generic text input in login forms
      'form input[type="text"]:first-of-type'
    ];
    
    for (const selector of selectors) {
      try {
        const input = document.querySelector(selector);
        if (input && isVisible(input)) {
          console.log('[DSG Extension] Found username field with selector:', selector);
          return input;
        }
      } catch (e) {}
    }
    
    // Last resort: find any visible text input
    const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (const input of allInputs) {
      if (isVisible(input) && !input.type.includes('hidden')) {
        console.log('[DSG Extension] Found username field (fallback):', input.name || input.id);
        return input;
      }
    }
    
    console.log('[DSG Extension] No username field found');
    return null;
  }
  
  function findPasswordField(preferredName) {
    console.log('[DSG Extension] Looking for password field with preferredName:', preferredName);
    
    const selectors = [
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      // Handle ASP.NET encoded names
      `input[name="${preferredName.replace(/\$/g, '_')}"]`,
      `input[id="${preferredName.replace(/\$/g, '_')}"]`,
      // ASP.NET specific
      `input[name*="txtPassword" i]`,
      `input[name*="txtPass" i]`,
      `input[id*="txtPassword" i]`,
      `input[id*="Password" i]`,
      // Standard password field
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[name*="pwd" i]',
      'input[id*="pass" i]',
      'input[id*="pwd" i]',
      'input[autocomplete="current-password"]',
      'input[autocomplete="password"]',
      'input[name="PASSWORD"]'
    ];
    
    for (const selector of selectors) {
      try {
        const input = document.querySelector(selector);
        if (input && isVisible(input)) {
          console.log('[DSG Extension] Found password field with selector:', selector);
          return input;
        }
      } catch (e) {}
    }
    
    console.log('[DSG Extension] No password field found');
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
