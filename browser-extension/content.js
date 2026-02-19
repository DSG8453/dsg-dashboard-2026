// DSG Transport Secure Login - Content Script
// Shows OVERLAY to hide login form, fills credentials, auto-submits
// User NEVER sees login form - only sees DSG loading screen

(function() {
  'use strict';
  
  let loadingOverlay = null;
  let loginAttempted = false;
  const PENDING_RETRY_DELAY_MS = 300;
  const MAX_PENDING_RETRIES = 25;
  let isTopFrame = true;
  
  try {
    isTopFrame = window.top === window.self;
  } catch (e) {
    isTopFrame = false;
  }
  
  chrome.runtime.onMessage.addListener((request) => {
    if (request?.action === 'HIDE_LOADING_OVERLAY' && isTopFrame) {
      hideLoadingOverlay();
    }
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    requestPendingLogin(0);
  }

  function requestPendingLogin(attempt) {
    if (loginAttempted) return;

    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (response) => {
      // Service worker may still be starting up; retry a few times
      if (chrome.runtime.lastError) {
        if (attempt < MAX_PENDING_RETRIES) {
          setTimeout(() => requestPendingLogin(attempt + 1), PENDING_RETRY_DELAY_MS);
        }
        return;
      }

      const hasCreds = Boolean(response?.username && response?.password);
      const isReady = response?.status === 'ready' || (hasCreds && !response?.status);
      const shouldRetry = response?.status === 'waiting';

      if (isReady && hasCreds) {
        loginAttempted = true;

        // Best-effort overlay: never block autofill if rendering fails
        if (isTopFrame) {
          try {
            showLoadingOverlay(response.toolName);
          } catch (err) {
            console.warn('[DSG Secure Login] Overlay failed to render:', err);
          }
        }
        
        // Fill credentials behind the overlay
        setTimeout(() => fillAndSubmit(response), 500);
        return;
      }

      // Retry only when background indicates tab-binding race
      if (shouldRetry && attempt < MAX_PENDING_RETRIES) {
        setTimeout(() => requestPendingLogin(attempt + 1), PENDING_RETRY_DELAY_MS);
      }
    });
  }
  
  // LOADING OVERLAY - Covers entire screen so user never sees login form
  function showLoadingOverlay(toolName) {
    if (loadingOverlay) return;

    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dsg-loading-overlay';
    loadingOverlay.setAttribute('role', 'status');
    loadingOverlay.setAttribute('aria-live', 'polite');
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
      pointer-events: all !important;
    `;

    const content = document.createElement('div');
    content.className = 'dsg-loading-content';

    const spinner = document.createElement('div');
    spinner.className = 'dsg-loading-spinner';

    const logo = document.createElement('div');
    logo.className = 'dsg-loading-logo';
    logo.textContent = 'DSG Transport';

    const text = document.createElement('div');
    text.className = 'dsg-loading-text';
    text.textContent = `Signing into ${toolName || 'your tool'}...`;

    const subtext = document.createElement('div');
    subtext.className = 'dsg-loading-subtext';
    subtext.textContent = 'Secure auto-login in progress';

    content.appendChild(spinner);
    content.appendChild(logo);
    content.appendChild(text);
    content.appendChild(subtext);
    loadingOverlay.appendChild(content);

    if (!document.getElementById('dsg-loading-styles')) {
      const style = document.createElement('style');
      style.id = 'dsg-loading-styles';
      style.textContent = `
        #dsg-loading-overlay * { box-sizing: border-box; }
        .dsg-loading-content { text-align: center; color: white; font-family: system-ui, -apple-system, sans-serif; padding: 24px; }
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
    }

    const overlayContainer = document.body || document.documentElement;
    if (!overlayContainer) {
      throw new Error('Could not find a container to mount overlay');
    }
    overlayContainer.appendChild(loadingOverlay);
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
    let usernameStepCompleted = false;
    const maxAttempts = 45;
    const retryDelayMs = 400;
    
    const tryFill = () => {
      attempts++;
      
      const userField = findUsernameField(creds.usernameField);
      const passField = findPasswordField(creds.passwordField);
      
      if (userField && passField) {
        completeLogin(userField, passField);
        return;
      }
      
      // Handle username-first flows (Google/Microsoft/SSO style)
      if (!usernameStepCompleted && userField && !passField && creds.username) {
        fillInput(userField, creds.username);
        usernameStepCompleted = true;
        
        const nextBtn = findNextButton(userField);
        if (nextBtn) nextBtn.click();
        else safeSubmitForm(userField.closest('form'));
        
        if (attempts < maxAttempts) setTimeout(tryFill, 900);
        else failLogin();
        return;
      }
      
      // Second step for username-first login pages
      if (usernameStepCompleted && passField && !userField) {
        completePasswordStep(passField);
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(tryFill, retryDelayMs);
      } else {
        failLogin();
      }
    };
    
    function completeLogin(userField, passField) {
      preventPasswordSave(userField, passField);
      fillInput(userField, creds.username);
      
      setTimeout(() => {
        fillInput(passField, creds.password);
        
        setTimeout(() => {
          const scopedForm = userField.closest('form') || passField.closest('form');
          const btn = findLoginButton(scopedForm);
          if (btn) {
            submitWithPasswordPrevention(userField, passField, btn);
          } else {
            scrambleFieldsBeforeSubmit(userField, passField);
            const submitted = safeSubmitForm(scopedForm);
            if (submitted) chrome.runtime.sendMessage({ action: 'LOGIN_SUCCESS' });
            if (isTopFrame) setTimeout(hideLoadingOverlay, 1000);
          }
        }, 300);
      }, 200);
    }
    
    function completePasswordStep(passField) {
      preventPasswordSave(null, passField);
      fillInput(passField, creds.password);
      
      setTimeout(() => {
        const scopedForm = passField.closest('form');
        const btn = findLoginButton(scopedForm);
        if (btn) {
          submitWithPasswordPrevention(null, passField, btn);
        } else {
          scrambleFieldsBeforeSubmit(null, passField);
          const submitted = safeSubmitForm(scopedForm);
          if (submitted) chrome.runtime.sendMessage({ action: 'LOGIN_SUCCESS' });
          if (isTopFrame) setTimeout(hideLoadingOverlay, 1000);
        }
      }, 300);
    }
    
    function failLogin() {
      if (isTopFrame) {
        hideLoadingOverlay();
        chrome.runtime.sendMessage({ action: 'LOGIN_FAILED' });
      }
    }
    
    tryFill();
  }
  
  // ============ PASSWORD SAVE PREVENTION - 7 TECHNIQUES ============
  
  function preventPasswordSave(userField, passField) {
    if (!passField) return;
    
    // 1. Autocomplete attributes
    if (userField) userField.setAttribute('autocomplete', 'off');
    passField.setAttribute('autocomplete', 'new-password');
    
    // 2. Password manager ignore flags
    [userField, passField].filter(Boolean).forEach(f => {
      f.setAttribute('data-lpignore', 'true');      // LastPass
      f.setAttribute('data-1p-ignore', 'true');     // 1Password
      f.setAttribute('data-bwignore', 'true');      // Bitwarden
      f.setAttribute('data-form-type', 'other');
    });
    
    // 3. Form autocomplete
    const form = (userField && userField.closest('form')) || passField.closest('form');
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
    const ownerDoc = passField.ownerDocument || document;
    if (form) form.insertBefore(dummy, form.firstChild);
    else if (ownerDoc.body) ownerDoc.body.insertBefore(dummy, ownerDoc.body.firstChild);
    
    // 5. Temporarily convert password to text
    const origType = passField.type;
    passField.type = 'text';
    setTimeout(() => { passField.type = origType; }, 50);
    
    // 6. Readonly during fill
    if (userField) userField.readOnly = true;
    passField.readOnly = true;
    setTimeout(() => {
      if (userField) userField.readOnly = false;
      passField.readOnly = false;
    }, 100);
    
    // 7. Blur fields
    if (userField) userField.blur();
    passField.blur();
  }
  
  function scrambleFieldsBeforeSubmit(userField, passField) {
    if (!passField) return;
    const rand = '_dsg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    if (userField) {
      userField.name = 'f_x' + rand;
      userField.id = 'i_x' + rand;
    }
    passField.name = 'f_y' + rand;
    passField.id = 'i_y' + rand;
    passField.setAttribute('autocomplete', 'new-password');
  }
  
  function submitWithPasswordPrevention(userField, passField, btn) {
    if (!passField || !btn) return;
    const form = (userField && userField.closest('form')) || passField.closest('form');
    
    // Store originals
    const origUserName = userField ? userField.name : null;
    const origPassName = passField.name;
    const origUserId = userField ? userField.id : null;
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
          if (btn.isConnected) {
            try {
              safeSubmitForm(form, btn);
            } catch (e) {}
          }
        }, 400);
      }
      
      // Hide overlay after redirect starts
      if (isTopFrame) setTimeout(hideLoadingOverlay, 1500);
      
      // Restore originals (in case of validation error)
      setTimeout(() => {
        if (userField && userField.isConnected) {
          userField.name = origUserName;
          userField.id = origUserId;
        }
        if (passField.isConnected) {
          passField.name = origPassName;
          passField.id = origPassId;
        }
      }, 600);
    });
    
    chrome.runtime.sendMessage({ action: 'LOGIN_SUCCESS' });
  }
  
  // ============ FIELD FINDING ============
  
  function safeSubmitForm(form, submitter = null) {
    if (!form) return false;
    try {
      if (form.requestSubmit) {
        if (submitter && form.contains(submitter)) form.requestSubmit(submitter);
        else form.requestSubmit();
      } else {
        form.submit();
      }
      return true;
    } catch (e) {
      return false;
    }
  }
  
  function getSearchRoots() {
    const roots = [document];
    const seenDocs = new Set([document]);
    collectFrameDocuments(document, roots, seenDocs);
    
    const expandedRoots = [...roots];
    roots.forEach(root => collectShadowRoots(root, expandedRoots));
    return expandedRoots;
  }
  
  function collectFrameDocuments(rootDoc, roots, seenDocs) {
    let frames = [];
    try {
      frames = rootDoc.querySelectorAll('iframe, frame');
    } catch (e) {
      return;
    }
    
    for (const frame of frames) {
      try {
        const frameDoc = frame.contentDocument;
        if (frameDoc && !seenDocs.has(frameDoc)) {
          seenDocs.add(frameDoc);
          roots.push(frameDoc);
          collectFrameDocuments(frameDoc, roots, seenDocs);
        }
      } catch (e) {
        // Cross-origin frame access throws; skip safely.
      }
    }
  }
  
  function collectShadowRoots(root, roots) {
    let elements = [];
    try {
      elements = root.querySelectorAll('*');
    } catch (e) {
      return;
    }
    
    for (const el of elements) {
      if (el.shadowRoot) {
        roots.push(el.shadowRoot);
        collectShadowRoots(el.shadowRoot, roots);
      }
    }
  }
  
  function querySelectorFromRoots(selectors, predicate) {
    const roots = getSearchRoots();
    for (const sel of selectors) {
      for (const root of roots) {
        try {
          const el = root.querySelector(sel);
          if (el && predicate(el)) return el;
        } catch (e) {}
      }
    }
    return null;
  }
  
  function queryAllFromRoots(selector, predicate = () => true) {
    const out = [];
    const seen = new Set();
    const roots = getSearchRoots();
    
    for (const root of roots) {
      let nodes = [];
      try {
        nodes = root.querySelectorAll(selector);
      } catch (e) {
        continue;
      }
      for (const node of nodes) {
        if (!seen.has(node) && predicate(node)) {
          seen.add(node);
          out.push(node);
        }
      }
    }
    
    return out;
  }
  
  function isUsernameLikeField(el) {
    if (!el || el.disabled) return false;
    const tag = (el.tagName || '').toLowerCase();
    
    if (tag === 'textarea') return true;
    if (tag !== 'input') return false;
    
    const type = ((el.getAttribute('type') || 'text') + '').toLowerCase();
    return !['password', 'hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'image', 'reset'].includes(type);
  }
  
  function isPasswordLikeField(el) {
    if (!el || el.disabled) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag !== 'input') return false;
    
    const type = ((el.getAttribute('type') || '') + '').toLowerCase();
    const attrs = `${el.name || ''} ${el.id || ''} ${el.autocomplete || ''}`.toLowerCase();
    return type === 'password' || attrs.includes('pass') || attrs.includes('pwd');
  }
  
  function findUsernameField(preferredName) {
    const selectors = [
      ...(preferredName ? [`input[name="${preferredName}"]`, `input[id="${preferredName}"]`] : []),
      ...(preferredName ? [`input[name="${preferredName.replace(/\$/g, '_')}"]`] : []),
      `input[name*="txtUserName" i]`,
      `input[name*="UserName" i]`,
      `input[id*="txtUserName" i]`,
      'input[type="email"]',
      'input[type="text"]',
      'input[type="tel"]',
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[id*="login" i]',
      'input[autocomplete="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]',
      'input[name="Email"]',
      'input[name="LOGIN_ID"]',
      'input[name="loginfmt"]',
      'input[name="identifier"]',
      'input[aria-label*="email" i]',
      'input[aria-label*="username" i]',
      'form input[type="text"]:first-of-type',
      'textarea'
    ];
    
    const matched = querySelectorFromRoots(selectors, el => isVisible(el) && isUsernameLikeField(el));
    if (matched) return matched;
    
    const fallbackInputs = queryAllFromRoots('input, textarea', el => isVisible(el) && isUsernameLikeField(el));
    if (fallbackInputs.length) return fallbackInputs[0];
    return null;
  }
  
  function findPasswordField(preferredName) {
    const selectors = [
      ...(preferredName ? [`input[name="${preferredName}"]`, `input[id="${preferredName}"]`] : []),
      ...(preferredName ? [`input[name="${preferredName.replace(/\$/g, '_')}"]`] : []),
      `input[name*="txtPassword" i]`,
      `input[id*="txtPassword" i]`,
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[name*="pwd" i]',
      'input[id*="pass" i]',
      'input[autocomplete="current-password"]',
      'input[autocomplete="new-password"]',
      'input[name="PASSWORD"]'
    ];
    
    const matched = querySelectorFromRoots(selectors, el => isVisible(el) && isPasswordLikeField(el));
    if (matched) return matched;
    
    const fallbackInputs = queryAllFromRoots('input', el => isVisible(el) && isPasswordLikeField(el));
    if (fallbackInputs.length) return fallbackInputs[0];
    return null;
  }
  
  function findLoginButton(scopeForm = null) {
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
    
    if (scopeForm) {
      for (const sel of selectors) {
        try {
          const el = scopeForm.querySelector(sel);
          if (el && isVisible(el) && !el.disabled && !isSkipButton(el)) return el;
        } catch (e) {}
      }
    }
    
    const selectorMatch = querySelectorFromRoots(
      selectors,
      el => isVisible(el) && !el.disabled && !isSkipButton(el)
    );
    if (selectorMatch) return selectorMatch;
    
    // Text search
    const btns = queryAllFromRoots('button, input[type="submit"], input[type="button"]', el => isVisible(el) && !el.disabled);
    for (const btn of btns) {
      const text = getControlText(btn);
      if ((text.includes('sign in') || text.includes('log in') || text.includes('login') || text.includes('submit')) && !isSkipButton(btn)) {
        return btn;
      }
    }
    
    // Any submit in form with password
    const forms = queryAllFromRoots('form');
    for (const form of forms) {
      if (form.querySelector('input[type="password"]')) {
        const btn = form.querySelector('button, input[type="submit"]');
        if (btn && isVisible(btn) && !btn.disabled) return btn;
      }
    }
    
    return null;
  }
  
  function findNextButton(contextField) {
    const preferredText = ['next', 'continue', 'proceed', 'verify', 'go'];
    const form = contextField ? contextField.closest('form') : null;
    
    const candidates = [];
    if (form) {
      candidates.push(...Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"]')));
    }
    candidates.push(...queryAllFromRoots('button, input[type="submit"], input[type="button"]'));
    
    const seen = new Set();
    for (const btn of candidates) {
      if (seen.has(btn)) continue;
      seen.add(btn);
      if (!isVisible(btn) || btn.disabled || isSkipButton(btn)) continue;
      const text = getControlText(btn);
      if (preferredText.some(word => text.includes(word))) return btn;
    }
    
    return null;
  }
  
  function getControlText(el) {
    return ((el?.textContent || el?.value || '') + '').trim().toLowerCase();
  }
  
  function isSkipButton(el) {
    const text = getControlText(el);
    return (
      text.includes('forgot') ||
      text.includes('register') ||
      text.includes('sign up') ||
      text.includes('create') ||
      text.includes('cancel') ||
      text.includes('back') ||
      text.includes('reset')
    );
  }
  
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  
  function fillInput(el, value) {
    if (!el || value == null || value === '') return;
    el.focus();
    el.value = '';
    
    // Native setter for React/Angular/Vue
    const tag = (el.tagName || '').toLowerCase();
    const proto = tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    el.value = value;
    
    // Fire events
    ['input', 'change', 'keydown', 'keyup', 'keypress'].forEach(evt => {
      el.dispatchEvent(new Event(evt, { bubbles: true, cancelable: true }));
    });
  }
  
})();
