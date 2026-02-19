// DSG Transport Secure Login - Content Script
// Shows OVERLAY to hide login form, fills credentials, auto-submits
// User NEVER sees login form - only sees DSG loading screen

(function() {
  'use strict';
  
  let loadingOverlay = null;
  let loginAttempted = false;
  let overlayShown = false;
  let usernameStepDone = false;
  let passwordStepDone = false;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
      if (chrome.runtime.lastError || !pending || loginAttempted) return;
      loginAttempted = true;
      
      // IMMEDIATELY show overlay - user never sees login form
      if (window.top === window) showLoadingOverlay(pending.toolName);
      
      // Fill credentials behind the overlay
      setTimeout(() => fillAndSubmit(pending), 500);
    });
  }
  
  // LOADING OVERLAY - Covers entire screen so user never sees login form
  function showLoadingOverlay(toolName) {
    if (loadingOverlay || overlayShown) return;
    overlayShown = true;
    
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dsg-loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="dsg-loading-content" role="status" aria-live="polite">
        <div class="dsg-loading-spinner" aria-hidden="true"></div>
        <div class="dsg-loading-logo">DSG Transport</div>
        <div class="dsg-loading-text" id="dsg-loading-text">Signing in…</div>
        <div class="dsg-loading-subtext" id="dsg-loading-subtext">${escapeHtml(toolName || 'Secure Login')}</div>
      </div>
    `;
    
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
    
    (document.head || document.documentElement).appendChild(style);
    const attach = () => {
      if (!loadingOverlay || document.getElementById('dsg-loading-overlay')) return;
      (document.body || document.documentElement).appendChild(loadingOverlay);
    };
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
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
  
  function fillAndSubmit(creds) {
    let attempts = 0;
    const maxAttempts = 40;
    const startHref = location.href;
    armNavigationSuccessSignal();
    
    const tryFill = () => {
      attempts++;
      
      const userField = findUsernameField(creds.usernameField);
      const passField = findPasswordField(creds.passwordField);
      
      if (userField && passField) {
        // PREVENT PASSWORD SAVE (no DOM changes that can leak credentials)
        preventPasswordSave(userField, passField);
        
        // Fill username
        fillInput(userField, creds.username);
        
        setTimeout(() => {
          // Fill password
          fillInput(passField, creds.password);
          
          setTimeout(() => {
            // Find and click login button
            const btn = findLoginButton();
            if (btn) {
              submitWithPasswordPrevention(userField, passField, btn);
            } else {
              // Never call native form.submit() (bypasses submit handlers and can create GET query leaks)
              const form = userField.closest('form') || passField.closest('form');
              if (form) safeRequestSubmit(form);
              startPostSubmitMonitor(startHref);
            }
          }, 300);
        }, 200);
        
      } else if (userField && !passField && !usernameStepDone) {
        // Two-step logins: username first, then password on next screen.
        usernameStepDone = true;
        try {
          userField.setAttribute('autocomplete', 'off');
          userField.setAttribute('data-lpignore', 'true');
          userField.setAttribute('data-1p-ignore', 'true');
          userField.setAttribute('data-bwignore', 'true');
        } catch (e) {}
        fillInput(userField, creds.username);

        setTimeout(() => {
          const nextBtn = findNextButton();
          if (nextBtn) {
            nextBtn.click();
          } else {
            // Fallback: requestSubmit so submit handlers run
            const form = userField.closest('form');
            if (form) safeRequestSubmit(form);
          }
          startPostSubmitMonitor(startHref);
        }, 250);

      } else if (!userField && passField && !passwordStepDone) {
        // Password-only step (username carried over from previous step/session)
        passwordStepDone = true;
        // Try to prevent password save even without a username field
        try {
          passField.setAttribute('autocomplete', 'new-password');
          passField.setAttribute('data-lpignore', 'true');
          passField.setAttribute('data-1p-ignore', 'true');
          passField.setAttribute('data-bwignore', 'true');
        } catch (e) {}
        fillInput(passField, creds.password);

        setTimeout(() => {
          const btn = findLoginButton() || findNextButton();
          if (btn) btn.click();
          startPostSubmitMonitor(startHref);
        }, 300);

      } else if (attempts < maxAttempts) {
        setTimeout(tryFill, 500);
      } else {
        // Keep overlay: user should never see the login form.
        setOverlayText('Signing in…', 'Still working. If this takes too long, close the tab and try again.');
      }
    };
    
    tryFill();
  }
  
  // ============ PASSWORD SAVE PREVENTION ============
  
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
    
    // 4. Dummy fields (NOT inside the form so they can never submit as query params)
    injectPasswordManagerDecoys();
    
    // 5. Readonly during fill
    userField.readOnly = true;
    passField.readOnly = true;
    setTimeout(() => {
      userField.readOnly = false;
      passField.readOnly = false;
    }, 100);
    
    // 6. Blur fields
    userField.blur();
    passField.blur();
  }
  
  function submitWithPasswordPrevention(userField, passField, btn) {
    const form = userField.closest('form') || passField.closest('form');

    if (form) form.setAttribute('autocomplete', 'off');

    const startHref = location.href;
    armNavigationSuccessSignal();

    // Prefer requestSubmit so submit handlers run (avoids GET query leaks)
    requestAnimationFrame(() => {
      if (form) safeRequestSubmit(form, btn);
      else btn.click();
      startPostSubmitMonitor(startHref);
    });
  }

  function safeRequestSubmit(form, submitter) {
    try {
      if (form?.requestSubmit) {
        if (submitter) form.requestSubmit(submitter);
        else form.requestSubmit();
        return true;
      }
    } catch (e) {}
    try {
      // Fall back to clicking a submitter instead of form.submit()
      if (submitter?.click) {
        submitter.click();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function looksLikeLoginUrl(url) {
    try {
      const u = new URL(url, location.href);
      return /\/login\b/i.test(u.pathname);
    } catch (e) {
      return /\/login\b/i.test(String(url || ''));
    }
  }

  function startPostSubmitMonitor(initialHref) {
    const maxMs = 20000;
    const start = Date.now();
    const timer = setInterval(() => {
      const href = location.href;
      // If we left /login or the password field is gone, we can drop the overlay.
      const passFieldNow = findPasswordField();
      if ((href !== initialHref && !looksLikeLoginUrl(href)) || (!passFieldNow && !looksLikeLoginUrl(href))) {
        clearInterval(timer);
        hideLoadingOverlay();
      } else if (Date.now() - start > maxMs) {
        clearInterval(timer);
        // Keep overlay; just update message.
        setOverlayText('Signing in…', 'Taking longer than expected. Close this tab and try again.');
      }
    }, 350);
  }

  function armNavigationSuccessSignal() {
    const once = { once: true, capture: true };
    const signal = () => {
      try { chrome.runtime.sendMessage({ action: 'LOGIN_SUCCESS' }); } catch (e) {}
    };
    window.addEventListener('pagehide', signal, once);
    window.addEventListener('beforeunload', signal, once);
  }

  function setOverlayText(text, subtext) {
    try {
      const t = document.getElementById('dsg-loading-text');
      const s = document.getElementById('dsg-loading-subtext');
      if (t && typeof text === 'string') t.textContent = text;
      if (s && typeof subtext === 'string') s.textContent = subtext;
    } catch (e) {}
  }

  let decoysInjected = false;
  function injectPasswordManagerDecoys() {
    if (decoysInjected) return;
    decoysInjected = true;
    try {
      const dummy = document.createElement('div');
      dummy.setAttribute('aria-hidden', 'true');
      dummy.style.cssText = 'position:fixed;left:-9999px;top:-9999px;height:0;overflow:hidden;';
      // Disabled so they can never be submitted.
      dummy.innerHTML = `
        <input type="text" autocomplete="username" tabindex="-1" disabled>
        <input type="password" autocomplete="current-password" tabindex="-1" disabled>
      `;
      (document.body || document.documentElement).appendChild(dummy);
    } catch (e) {}
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

  function findNextButton() {
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[id*="next" i]',
      'button[class*="next" i]',
      'button[id*="continue" i]',
      'button[class*="continue" i]',
      'button[id*="verify" i]',
      'button[class*="verify" i]',
      'form button:not([type="button"])'
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el) && !isSkipButton(el)) return el;
      } catch (e) {}
    }

    const btns = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const btn of btns) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (
        (text.includes('next') || text.includes('continue') || text.includes('verify')) &&
        isVisible(btn) &&
        !isSkipButton(btn)
      ) {
        return btn;
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
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect) return true;
    return rect.width > 0 && rect.height > 0;
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

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => {
      switch (c) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return c;
      }
    });
  }
  
})();
