// DSG Transport Secure Login - Content Script v1.3.16
// Shows OVERLAY to hide login form, fills credentials, auto-submits
// DETECTS CAPTCHA/2FA: If found, reveals page for user to complete manually
// User NEVER sees credentials - only masked dots (••••••••)

(function() {
  'use strict';
  
  let loadingOverlay = null;
  let loginAttempted = false;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    // Check if this is a 2FA page (no username/password fields, has code input)
    if (detect2FAPage()) {
      // This is a 2FA page after login - just hide any overlay and let user proceed
      hideLoadingOverlay();
      return;
    }
    
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
      if (chrome.runtime.lastError || !pending || loginAttempted) return;
      loginAttempted = true;
      
      // IMMEDIATELY show overlay - user never sees login form
      showLoadingOverlay(pending.toolName);
      
      // Fill credentials behind the overlay
      setTimeout(() => fillAndSubmit(pending), 500);
    });
  }
  
  // ============ CAPTCHA DETECTION ============
  
  function detectCaptcha() {
    const captchaSelectors = [
      // Google reCAPTCHA
      'iframe[src*="recaptcha"]',
      'iframe[src*="google.com/recaptcha"]',
      '.g-recaptcha',
      '#g-recaptcha',
      '[data-sitekey]',
      // hCaptcha
      'iframe[src*="hcaptcha"]',
      '.h-captcha',
      // Generic CAPTCHA
      '[class*="captcha" i]',
      '[id*="captcha" i]',
      'img[src*="captcha" i]',
      'input[name*="captcha" i]',
      // Cloudflare
      'iframe[src*="challenges.cloudflare"]',
      '#cf-turnstile',
      // FunCaptcha
      'iframe[src*="funcaptcha"]',
      // Text-based detection
      '[aria-label*="captcha" i]',
      '[title*="captcha" i]'
    ];
    
    for (const selector of captchaSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          return true;
        }
      } catch (e) {}
    }
    
    // Check for CAPTCHA text on page
    const bodyText = document.body?.innerText?.toLowerCase() || '';
    if (bodyText.includes('complete the captcha') || 
        bodyText.includes('prove you are human') ||
        bodyText.includes('security check') ||
        bodyText.includes('verify you are not a robot')) {
      return true;
    }
    
    return false;
  }
  
  // ============ 2FA DETECTION ============
  
  function detect2FAPage() {
    // Check if this looks like a 2FA/verification page (NO password field, HAS code input)
    const hasPasswordField = document.querySelector('input[type="password"]');
    if (hasPasswordField) return false; // Not a 2FA page if password field exists
    
    const twoFASelectors = [
      // Code input fields
      'input[name*="code" i]',
      'input[name*="otp" i]',
      'input[name*="2fa" i]',
      'input[name*="totp" i]',
      'input[name*="token" i]',
      'input[name*="verification" i]',
      'input[name*="mfa" i]',
      'input[id*="code" i]',
      'input[id*="otp" i]',
      'input[id*="2fa" i]',
      'input[placeholder*="code" i]',
      'input[placeholder*="verification" i]',
      'input[autocomplete="one-time-code"]',
      // Multiple single-digit inputs (common 2FA pattern)
      'input[maxlength="1"]',
      'input[maxlength="6"]'
    ];
    
    for (const selector of twoFASelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          return true;
        }
      } catch (e) {}
    }
    
    // Check for 2FA text on page
    const bodyText = document.body?.innerText?.toLowerCase() || '';
    const twoFAPhrases = [
      'verification code',
      'enter the code',
      'two-factor',
      'two factor',
      '2-factor',
      '2fa',
      'authenticator',
      'sent to your phone',
      'sent to your email',
      'one-time password',
      'one time password',
      'security code',
      'enter code',
      'verify your identity'
    ];
    
    for (const phrase of twoFAPhrases) {
      if (bodyText.includes(phrase)) {
        return true;
      }
    }
    
    return false;
  }
  
  function detect2FAOnCurrentPage() {
    // Lighter check for 2FA elements on login page (before submit)
    const twoFASelectors = [
      'input[name*="otp" i]',
      'input[name*="2fa" i]',
      'input[name*="totp" i]',
      'input[autocomplete="one-time-code"]'
    ];
    
    for (const selector of twoFASelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) return true;
      } catch (e) {}
    }
    return false;
  }
  
  // ============ LOADING OVERLAY ============
  
  function showLoadingOverlay(toolName) {
    if (loadingOverlay) return;
    
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dsg-loading-overlay';
    
    loadingOverlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 2147483647 !important;
      opacity: 1 !important;
    `;
    
    loadingOverlay.innerHTML = `
      <div class="dsg-loading-content">
        <div class="dsg-loading-spinner"></div>
        <div class="dsg-loading-logo">DSG Transport</div>
        <div class="dsg-loading-text">Securely connecting to ${toolName || 'tool'}...</div>
        <div class="dsg-loading-subtext">Please wait while we log you in</div>
      </div>
    `;
    
    const style = document.createElement('style');
    style.id = 'dsg-loading-styles';
    style.textContent = `
      #dsg-loading-overlay * { box-sizing: border-box; }
      .dsg-loading-content { text-align: center; color: white; font-family: system-ui, -apple-system, sans-serif; }
      .dsg-loading-spinner {
        width: 50px; height: 50px;
        border: 4px solid rgba(255,255,255,0.2);
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: dsg-spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      .dsg-loading-logo {
        font-size: 28px; font-weight: 700; margin-bottom: 16px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .dsg-loading-text { font-size: 18px; font-weight: 500; margin-bottom: 8px; color: #fff; }
      .dsg-loading-subtext { font-size: 14px; color: #94a3b8; }
      @keyframes dsg-spin { to { transform: rotate(360deg); } }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(loadingOverlay);
  }
  
  function updateOverlayMessage(message, submessage) {
    if (loadingOverlay) {
      const textEl = loadingOverlay.querySelector('.dsg-loading-text');
      const subEl = loadingOverlay.querySelector('.dsg-loading-subtext');
      if (textEl) textEl.textContent = message;
      if (subEl) subEl.textContent = submessage;
    }
  }
  
  function hideLoadingOverlay() {
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      loadingOverlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        loadingOverlay?.remove();
        document.getElementById('dsg-loading-styles')?.remove();
        loadingOverlay = null;
      }, 300);
    }
  }
  
  // ============ MAIN FILL AND SUBMIT LOGIC ============
  
  function fillAndSubmit(creds) {
    let attempts = 0;
    const maxAttempts = 20;
    
    // DEBUG: Log what credentials we received
    console.log('[DSG] ====== FILL AND SUBMIT ======');
    console.log('[DSG] Username:', creds.username ? 'YES' : 'EMPTY');
    console.log('[DSG] Password:', creds.password ? 'YES (' + creds.password.length + ' chars)' : 'EMPTY/MISSING');
    console.log('[DSG] Username field selector:', creds.usernameField);
    console.log('[DSG] Password field selector:', creds.passwordField);
    console.log('[DSG] ==============================');
    
    const tryFill = () => {
      attempts++;
      
      const userField = findUsernameField(creds.usernameField);
      const passField = findPasswordField(creds.passwordField);
      
      if (userField && passField) {
        // BOTH FIELDS FOUND - Standard login flow
        completeLogin(userField, passField, creds);
        
      } else if (userField && !passField) {
        // USERNAME FOUND BUT NO PASSWORD - Multi-step login (Zoho, Microsoft, etc.)
        // Fill username first, then wait for password field to appear
        handleMultiStepLogin(userField, creds);
        
      } else if (attempts < maxAttempts) {
        // Keep trying to find fields
        setTimeout(tryFill, 500);
      } else {
        hideLoadingOverlay();
        chrome.runtime.sendMessage({ action: 'LOGIN_FAILED' });
      }
    };
    
    tryFill();
  }
  
  // Handle multi-step login (Zoho, Microsoft, Google) where password appears after email validation
  function handleMultiStepLogin(userField, creds) {
    console.log('[DSG] Multi-step login detected - username field found, waiting for password field');
    console.log('[DSG] Filling username:', creds.username ? '***' + creds.username.slice(-10) : 'EMPTY');
    
    // Fill username first
    fillInput(userField, creds.username);
    
    // Trigger validation events so site knows user finished typing
    userField.dispatchEvent(new Event('blur', { bubbles: true }));
    userField.dispatchEvent(new Event('focusout', { bubbles: true }));
    userField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, bubbles: true }));
    
    // Check if there's a "Next" button to click
    const nextBtn = findNextButton();
    if (nextBtn) {
      console.log('[DSG] Found "Next" button, clicking it');
      nextBtn.click();
      nextBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } else {
      console.log('[DSG] No "Next" button found, waiting for password field to appear');
    }
    
    // Now wait for password field to appear
    waitForPasswordField(userField, creds);
  }
  
  // Find "Next" button for multi-step login
  function findNextButton() {
    const selectors = [
      'button[id*="next" i]',
      'input[type="button"][value*="Next" i]',
      'input[type="submit"][value*="Next" i]',
      'button[data-action*="next" i]',
      '#nextbtn', '.nextbtn', '.next-btn',
      'button[class*="next" i]'
    ];
    
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    
    // Text search for "Next" button
    const btns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
    for (const btn of btns) {
      const text = (btn.textContent || btn.value || '').toLowerCase().trim();
      if (text === 'next' || text === 'continue' || text === 'proceed') {
        if (isVisible(btn)) return btn;
      }
    }
    
    return null;
  }
  
  // Wait for password field to appear after username validation
  function waitForPasswordField(userField, creds) {
    let passwordAttempts = 0;
    const maxPasswordAttempts = 20; // 10 seconds max
    
    console.log('[DSG] Waiting for password field to appear...');
    console.log('[DSG] Password to fill:', creds.password ? 'YES (' + creds.password.length + ' chars)' : 'EMPTY/MISSING');
    
    const checkForPassword = () => {
      passwordAttempts++;
      
      const passField = findPasswordField(creds.passwordField);
      
      console.log('[DSG] Password field check #' + passwordAttempts + ':', passField ? 'FOUND' : 'NOT FOUND');
      
      if (passField && isVisible(passField)) {
        // PASSWORD FIELD APPEARED! Complete the login
        console.log('[DSG] Password field found and visible! Completing login...');
        completeLogin(userField, passField, creds);
        
      } else if (passwordAttempts < maxPasswordAttempts) {
        // Keep waiting - password field not yet visible
        setTimeout(checkForPassword, 500);
        
      } else {
        // Timeout - password field never appeared
        console.log('[DSG] TIMEOUT: Password field never appeared after 10 seconds');
        console.log('[DSG] All password inputs on page:', document.querySelectorAll('input[type="password"]').length);
        updateOverlayMessage(
          'Password field not found',
          'Please enter password manually'
        );
        setTimeout(hideLoadingOverlay, 1500);
      }
    };
    
    // Start checking after a short delay (give site time to validate)
    setTimeout(checkForPassword, 800);
  }
  
  // Complete login with both fields found
  function completeLogin(userField, passField, creds) {
    // PREVENT PASSWORD SAVE
    preventPasswordSave(userField, passField);
    
    // Fill username (might already be filled in multi-step)
    if (!userField.value || userField.value !== creds.username) {
      fillInput(userField, creds.username);
    }
    
    setTimeout(() => {
      // Fill password
      fillInput(passField, creds.password);
      
      setTimeout(() => {
        // CHECK FOR CAPTCHA OR 2FA
        const hasCaptcha = detectCaptcha();
        const has2FA = detect2FAOnCurrentPage();
        
        if (hasCaptcha || has2FA) {
          updateOverlayMessage(
            hasCaptcha ? 'CAPTCHA detected' : '2FA detected',
            'Please complete verification and click Login'
          );
          
          setTimeout(() => {
            hideLoadingOverlay();
            chrome.runtime.sendMessage({ 
              action: 'LOGIN_NEEDS_MANUAL',
              reason: hasCaptcha ? 'captcha' : '2fa'
            });
          }, 1000);
          
        } else {
          // NO CAPTCHA/2FA: Proceed with auto-submit
          const btn = findLoginButton();
          if (btn) {
            submitWithPasswordPrevention(userField, passField, btn);
          } else {
            const form = userField.closest('form') || passField.closest('form');
            if (form) {
              form.method = 'POST';
              form.querySelectorAll('input[name^="fake_"]').forEach(f => f.remove());
              document.querySelectorAll('input[name^="fake_"]').forEach(f => f.parentElement?.remove());
              form.submit();
            }
            setTimeout(hideLoadingOverlay, 1000);
          }
        }
      }, 300);
    }, 200);
  }
  
  // ============ PASSWORD SAVE PREVENTION - 7 TECHNIQUES ============
  
  function preventPasswordSave(userField, passField) {
    // 1. Autocomplete attributes
    userField.setAttribute('autocomplete', 'off');
    passField.setAttribute('autocomplete', 'new-password');
    
    // 2. Password manager ignore flags
    [userField, passField].forEach(f => {
      f.setAttribute('data-lpignore', 'true');      // LastPass
      f.setAttribute('data-1p-ignore', 'true');     // 1Password
      f.setAttribute('data-bwignore', 'true');      // Bitwarden
      f.setAttribute('data-form-type', 'other');
      f.setAttribute('data-private', 'true');
    });
    
    // 3. Form autocomplete
    const form = userField.closest('form') || passField.closest('form');
    if (form) {
      form.setAttribute('autocomplete', 'off');
      form.setAttribute('data-lpignore', 'true');
      form.setAttribute('data-form-type', 'other');
    }
    
    // 4. Dummy fields BEFORE real fields (password managers grab first match)
    const dummy = document.createElement('div');
    dummy.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden;';
    dummy.innerHTML = `
      <input type="text" name="fake_email_${Date.now()}" autocomplete="username" tabindex="-1">
      <input type="password" name="fake_pass_${Date.now()}" autocomplete="current-password" tabindex="-1">
    `;
    if (form) form.insertBefore(dummy, form.firstChild);
    else document.body.insertBefore(dummy, document.body.firstChild);
    
    // 5. Temporarily convert password to text
    const origType = passField.type;
    passField.type = 'text';
    setTimeout(() => { passField.type = origType; }, 50);
    
    // 6. Readonly during fill
    userField.readOnly = true;
    passField.readOnly = true;
    setTimeout(() => {
      userField.readOnly = false;
      passField.readOnly = false;
    }, 100);
    
    // 7. Blur fields
    userField.blur();
    passField.blur();
    
    // 8. Uncheck "Remember me" / "Keep me signed in" checkboxes
    uncheckRememberMe(form);
    
    // 9. Prevent Chrome password save by marking as sensitive
    userField.setAttribute('data-password-save', 'false');
    passField.setAttribute('data-password-save', 'false');
  }
  
  // Uncheck "Remember me" checkboxes to prevent password save prompts
  function uncheckRememberMe(form) {
    const rememberSelectors = [
      'input[type="checkbox"][name*="remember" i]',
      'input[type="checkbox"][id*="remember" i]',
      'input[type="checkbox"][name*="keep" i]',
      'input[type="checkbox"][id*="keep" i]',
      'input[type="checkbox"][name*="stay" i]',
      'input[type="checkbox"][id*="stay" i]',
      'input[type="checkbox"][name*="persist" i]',
      'input[type="checkbox"][class*="remember" i]'
    ];
    
    const searchArea = form || document;
    
    for (const sel of rememberSelectors) {
      try {
        const checkboxes = searchArea.querySelectorAll(sel);
        checkboxes.forEach(cb => {
          if (cb.checked) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      } catch (e) {}
    }
  }
  
  function submitWithPasswordPrevention(userField, passField, btn) {
    const form = userField.closest('form') || passField.closest('form');
    
    if (form) {
      // CRITICAL: Force POST method to prevent credentials in URL
      form.method = 'POST';
      form.setAttribute('autocomplete', 'off');
      
      // Remove dummy fields before submit (they add empty params)
      const dummyFields = form.querySelectorAll('input[name^="fake_"]');
      dummyFields.forEach(f => f.remove());
    }
    
    // Remove any dummy fields we added to body
    document.querySelectorAll('input[name^="fake_"]').forEach(f => f.parentElement?.remove());
    
    // Focus on password field briefly (helps trigger form validation)
    passField.focus();
    
    // Click button with multiple methods for compatibility
    requestAnimationFrame(() => {
      // Method 1: Direct click
      btn.click();
      
      // Method 2: Dispatch click event (for React/Angular/Vue)
      btn.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
      
      // Method 3: If it's a link, trigger navigation
      if (btn.tagName === 'A' && btn.href) {
        setTimeout(() => {
          if (document.contains(btn)) {
            window.location.href = btn.href;
          }
        }, 300);
      }
      
      // Method 4: Form submit as backup
      if (form) {
        setTimeout(() => {
          if (document.contains(btn)) {
            try {
              // Try Enter key on password field
              passField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
              passField.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
              passField.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
            } catch (e) {}
          }
        }, 200);
        
        setTimeout(() => {
          if (document.contains(btn)) {
            try {
              if (form.requestSubmit) form.requestSubmit(btn);
              else form.submit();
            } catch (e) {}
          }
        }, 500);
      }
      
      // WAIT FOR LOGIN TO COMPLETE - Don't hide until navigated or logged in
      waitForLoginComplete();
    });
    
    chrome.runtime.sendMessage({ action: 'LOGIN_SUCCESS' });
  }
  
  // Wait for login to actually complete before hiding overlay
  function waitForLoginComplete() {
    const startUrl = window.location.href;
    const startTime = Date.now();
    const maxWait = 30000; // Maximum 30 seconds
    let checkCount = 0;
    
    const checkLogin = () => {
      checkCount++;
      const elapsed = Date.now() - startTime;
      
      // Check 1: URL changed (navigated to new page)
      if (window.location.href !== startUrl) {
        hideLoadingOverlay();
        return;
      }
      
      // Check 2: Login form is gone (password field removed)
      const passField = document.querySelector('input[type="password"]');
      if (!passField || !isVisible(passField)) {
        // Password field gone - likely logged in
        setTimeout(hideLoadingOverlay, 500);
        return;
      }
      
      // Check 3: Error message appeared (login failed)
      const errorSelectors = [
        '[class*="error" i]',
        '[class*="invalid" i]',
        '[class*="fail" i]',
        '[id*="error" i]',
        '.alert-danger',
        '.alert-error'
      ];
      for (const sel of errorSelectors) {
        try {
          const err = document.querySelector(sel);
          if (err && isVisible(err) && err.textContent.length > 0) {
            // Error detected - hide overlay so user can see
            hideLoadingOverlay();
            return;
          }
        } catch (e) {}
      }
      
      // Check 4: Maximum time reached
      if (elapsed >= maxWait) {
        hideLoadingOverlay();
        return;
      }
      
      // Continue checking every 500ms
      setTimeout(checkLogin, 500);
    };
    
    // Start checking after initial submit delay
    setTimeout(checkLogin, 1000);
  }
  
  // ============ FIELD FINDING ============
  
  function findUsernameField(preferredName) {
    const selectors = [
      // Preferred name from tool config
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      `input[name="${preferredName?.replace(/\$/g, '_')}"]`,
      // Ascend TMS specific
      'input[name="username"]',
      'input[id="username"]',
      'input[name="loginId"]',
      'input[id="loginId"]',
      'input[name="userId"]',
      'input[id="userId"]',
      // Common patterns
      `input[name*="txtUserName" i]`,
      `input[name*="UserName" i]`,
      `input[id*="txtUserName" i]`,
      'input[type="email"]',
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[autocomplete="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]',
      'input[placeholder*="login" i]',
      'input[name="Email"]',
      'input[name="LOGIN_ID"]',
      // RMIS specific
      'input[name="j_username"]',
      'input[id="j_username"]',
      // Generic fallbacks
      'form input[type="text"]:first-of-type',
      'input[type="text"]:not([hidden])'
    ];
    
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    
    // Fallback: any visible text input
    const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (const inp of inputs) {
      if (isVisible(inp)) return inp;
    }
    return null;
  }
  
  function findPasswordField(preferredName) {
    const selectors = [
      // Preferred name from tool config
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      `input[name="${preferredName?.replace(/\$/g, '_')}"]`,
      // Standard password field (most common)
      'input[type="password"]',
      // Ascend TMS specific
      'input[name="password"]',
      'input[id="password"]',
      // RMIS specific
      'input[name="j_password"]',
      'input[id="j_password"]',
      // Common patterns
      `input[name*="txtPassword" i]`,
      `input[id*="txtPassword" i]`,
      'input[name*="pass" i]',
      'input[name*="pwd" i]',
      'input[id*="pass" i]',
      'input[autocomplete="current-password"]',
      'input[name="PASSWORD"]',
      'input[placeholder*="password" i]'
    ];
    
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    return null;
  }
  
  function findLoginButton() {
    // PRIORITY 1: Submit button inside form with password field (most reliable)
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      if (form.querySelector('input[type="password"]')) {
        // Look for submit button first
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn && isVisible(submitBtn) && !isSkipButton(submitBtn)) {
          return submitBtn;
        }
        // Then any button that's not an SSO button
        const btns = form.querySelectorAll('button, input[type="button"]');
        for (const btn of btns) {
          if (isVisible(btn) && !isSkipButton(btn)) {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            // Make sure it looks like a login button
            if (text.includes('login') || text.includes('sign in') || text.includes('submit') || text.includes('continue') || text === 'log in') {
              return btn;
            }
          }
        }
      }
    }
    
    // PRIORITY 2: Specific login button selectors
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[id*="login" i]:not([id*="social"]):not([id*="apple"]):not([id*="google"])',
      'button[id*="signin" i]:not([id*="social"]):not([id*="apple"]):not([id*="google"])',
      'button[class*="login" i]:not([class*="social"]):not([class*="apple"]):not([class*="google"])',
      'button[class*="signin" i]:not([class*="social"]):not([class*="apple"]):not([class*="google"])',
      'input[name*="btnLogin" i]',
      'input[id*="btnLogin" i]',
      'input[name*="btnSubmit" i]',
      '.btn-login', '.btn-signin',
      'button[data-action*="login" i]',
      'button[ng-click*="login" i]',
      'button[onclick*="login" i]',
      'input[type="button"][value*="Login" i]',
      'input[type="button"][value*="Sign In" i]'
    ];
    
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el) && !isSkipButton(el)) return el;
      } catch (e) {}
    }
    
    // PRIORITY 3: Exact text match (strict - avoid SSO buttons)
    const clickables = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const btn of clickables) {
      const text = (btn.textContent || btn.value || '').toLowerCase().trim();
      // Only exact matches to avoid "Sign in with Apple" matching "Sign in"
      if ((text === 'login' || text === 'log in' || text === 'sign in' || text === 'signin' || text === 'submit') && isVisible(btn) && !isSkipButton(btn)) {
        return btn;
      }
    }
    
    // PRIORITY 4: Primary/main button in login context
    for (const btn of clickables) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      const btnClass = (btn.className || '').toLowerCase();
      // Look for primary/main button styling
      if ((btnClass.includes('primary') || btnClass.includes('main') || btnClass.includes('submit')) && 
          isVisible(btn) && !isSkipButton(btn)) {
        return btn;
      }
    }
    
    // PRIORITY 5: Form button fallback (last resort)
    for (const form of forms) {
      if (form.querySelector('input[type="password"]')) {
        const btn = form.querySelector('button:not([type="button"]), input[type="submit"]');
        if (btn && isVisible(btn) && !isSkipButton(btn)) return btn;
      }
    }
    
    return null;
  }
  
  function isSkipButton(el) {
    const text = (el.textContent || el.value || '').toLowerCase();
    
    // Skip these button types
    if (text.includes('forgot') || text.includes('register') || text.includes('sign up') || text.includes('create')) {
      return true;
    }
    
    // Skip SSO/OAuth buttons (Google, Apple, Microsoft, Facebook, etc.)
    const ssoKeywords = [
      'apple', 'google', 'microsoft', 'facebook', 'twitter', 'linkedin',
      'github', 'sso', 'oauth', 'saml', 'okta', 'azure', 'aws',
      'sign in with', 'continue with', 'log in with'
    ];
    
    for (const keyword of ssoKeywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }
    
    // Skip buttons with SSO-related classes or IDs
    const elClass = (el.className || '').toLowerCase();
    const elId = (el.id || '').toLowerCase();
    const ssoClassKeywords = ['apple', 'google', 'social', 'oauth', 'sso', 'microsoft', 'facebook'];
    
    for (const keyword of ssoClassKeywords) {
      if (elClass.includes(keyword) || elId.includes(keyword)) {
        return true;
      }
    }
    
    // Skip buttons with SSO images/icons
    const img = el.querySelector('img');
    if (img) {
      const src = (img.src || '').toLowerCase();
      if (src.includes('apple') || src.includes('google') || src.includes('microsoft') || src.includes('facebook')) {
        return true;
      }
    }
    
    return false;
  }
  
  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  }
  
  function fillInput(el, value) {
    if (!el || !value) return;
    el.focus();
    el.value = '';
    
    // Native setter for React/Angular/Vue
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    el.value = value;
    
    // Fire events
    ['input', 'change', 'keydown', 'keyup', 'keypress'].forEach(evt => {
      el.dispatchEvent(new Event(evt, { bubbles: true, cancelable: true }));
    });
  }
  
})();
