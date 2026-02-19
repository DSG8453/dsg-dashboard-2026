// DSG Transport Secure Login - Content Script v1.3.7
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
    const maxAttempts = 15;
    
    const tryFill = () => {
      attempts++;
      
      const userField = findUsernameField(creds.usernameField);
      const passField = findPasswordField(creds.passwordField);
      
      if (userField && passField) {
        // PREVENT PASSWORD SAVE - 7 techniques
        preventPasswordSave(userField, passField);
        
        // Fill username
        fillInput(userField, creds.username);
        
        setTimeout(() => {
          // Fill password
          fillInput(passField, creds.password);
          
          setTimeout(() => {
            // CHECK FOR CAPTCHA OR 2FA
            const hasCaptcha = detectCaptcha();
            const has2FA = detect2FAOnCurrentPage();
            
            if (hasCaptcha || has2FA) {
              // CAPTCHA/2FA DETECTED: Reveal page for user to complete
              // Credentials are filled but masked as ••••••••
              updateOverlayMessage(
                hasCaptcha ? 'CAPTCHA detected' : '2FA detected',
                'Please complete verification and click Login'
              );
              
              setTimeout(() => {
                hideLoadingOverlay();
                // Notify background that manual intervention needed
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
                // Try form.submit() as fallback
                const form = userField.closest('form') || passField.closest('form');
                if (form) {
                  scrambleFieldsBeforeSubmit(userField, passField);
                  form.submit();
                }
                setTimeout(hideLoadingOverlay, 1000);
              }
            }
          }, 300);
        }, 200);
        
      } else if (attempts < maxAttempts) {
        setTimeout(tryFill, 500);
      } else {
        hideLoadingOverlay();
        chrome.runtime.sendMessage({ action: 'LOGIN_FAILED' });
      }
    };
    
    tryFill();
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
    });
    
    // 3. Form autocomplete
    const form = userField.closest('form') || passField.closest('form');
    if (form) {
      form.setAttribute('autocomplete', 'off');
      form.setAttribute('data-lpignore', 'true');
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
  }
  
  function scrambleFieldsBeforeSubmit(userField, passField) {
    const rand = '_dsg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    userField.name = 'f_x' + rand;
    userField.id = 'i_x' + rand;
    passField.name = 'f_y' + rand;
    passField.id = 'i_y' + rand;
    passField.setAttribute('autocomplete', 'new-password');
  }
  
  function submitWithPasswordPrevention(userField, passField, btn) {
    const form = userField.closest('form') || passField.closest('form');
    
    // Store originals
    const origUserName = userField.name;
    const origPassName = passField.name;
    const origUserId = userField.id;
    const origPassId = passField.id;
    
    // Scramble before submit
    scrambleFieldsBeforeSubmit(userField, passField);
    
    if (form) form.setAttribute('autocomplete', 'off');
    
    // Click button
    requestAnimationFrame(() => {
      btn.click();
      
      // Backup: form.submit() if click didn't navigate
      if (form) {
        setTimeout(() => {
          if (document.contains(btn)) {
            try {
              if (form.requestSubmit) form.requestSubmit(btn);
              else form.submit();
            } catch (e) {}
          }
        }, 400);
      }
      
      // Hide overlay after redirect starts
      setTimeout(hideLoadingOverlay, 1500);
      
      // Restore originals (in case of validation error)
      setTimeout(() => {
        if (document.contains(userField)) {
          userField.name = origUserName;
          userField.id = origUserId;
        }
        if (document.contains(passField)) {
          passField.name = origPassName;
          passField.id = origPassId;
        }
      }, 600);
    });
    
    chrome.runtime.sendMessage({ action: 'LOGIN_SUCCESS' });
  }
  
  // ============ FIELD FINDING ============
  
  function findUsernameField(preferredName) {
    const selectors = [
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      `input[name="${preferredName?.replace(/\$/g, '_')}"]`,
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
      'input[name="Email"]',
      'input[name="LOGIN_ID"]',
      'form input[type="text"]:first-of-type'
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
      `input[name="${preferredName}"]`,
      `input[id="${preferredName}"]`,
      `input[name="${preferredName?.replace(/\$/g, '_')}"]`,
      `input[name*="txtPassword" i]`,
      `input[id*="txtPassword" i]`,
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[name*="pwd" i]',
      'input[id*="pass" i]',
      'input[autocomplete="current-password"]',
      'input[name="PASSWORD"]'
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
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[id*="login" i]',
      'button[id*="signin" i]',
      'button[class*="login" i]',
      'button[class*="signin" i]',
      'input[name*="btnLogin" i]',
      'input[id*="btnLogin" i]',
      'input[name*="btnSubmit" i]',
      '.btn-login', '.btn-signin',
      'form button:not([type="button"])'
    ];
    
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el) && !isSkipButton(el)) return el;
      } catch (e) {}
    }
    
    // Text search
    const btns = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const btn of btns) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if ((text.includes('sign in') || text.includes('log in') || text.includes('login') || text.includes('submit')) && isVisible(btn)) {
        return btn;
      }
    }
    
    // Any submit in form with password
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      if (form.querySelector('input[type="password"]')) {
        const btn = form.querySelector('button, input[type="submit"]');
        if (btn && isVisible(btn)) return btn;
      }
    }
    
    return null;
  }
  
  function isSkipButton(el) {
    const text = (el.textContent || el.value || '').toLowerCase();
    return text.includes('forgot') || text.includes('register') || text.includes('sign up') || text.includes('create');
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
