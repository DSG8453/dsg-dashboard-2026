// DSG Transport Secure Login - Content Script
// Covers the page, fills credentials, and submits automatically.

(function () {
  'use strict';

  let loadingOverlay = null;
  let loginAttempted = false;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
      if (chrome.runtime.lastError || !pending || loginAttempted) return;
      loginAttempted = true;
      runSecureLogin(pending);
    });
  }

  async function runSecureLogin(pending) {
    showLoadingOverlay(pending.toolName);

    try {
      const success = await fillAndSubmit(pending);
      chrome.runtime.sendMessage({ action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED' });

      if (!success) {
        hideLoadingOverlay();
      }
    } catch (error) {
      console.error('[DSG] Secure login failed:', error);
      chrome.runtime.sendMessage({ action: 'LOGIN_FAILED' });
      hideLoadingOverlay();
    }
  }

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
      pointer-events: all !important;
    `;

    loadingOverlay.innerHTML = `
      <div class="dsg-loading-content">
        <div class="dsg-loading-spinner"></div>
        <div class="dsg-loading-logo">DSG Transport</div>
        <div class="dsg-loading-text">Connecting to ${escapeHtml(toolName || 'Tool')}...</div>
        <div class="dsg-loading-subtext">Secure login in progress</div>
      </div>
    `;

    if (!document.getElementById('dsg-loading-styles')) {
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
      document.head?.appendChild(style);
    }

    (document.body || document.documentElement).appendChild(loadingOverlay);
  }

  function hideLoadingOverlay() {
    if (!loadingOverlay) return;
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      loadingOverlay?.remove();
      document.getElementById('dsg-loading-styles')?.remove();
      loadingOverlay = null;
    }, 300);
  }

  async function fillAndSubmit(creds) {
    const initialFields = await waitForAnyLoginFields(creds, 25, 400);
    if (!initialFields) return false;

    let userField = initialFields.userField;
    let passField = initialFields.passField;

    // Password-only step (second page of multi-step flows).
    if (passField && !userField) {
      return submitPasswordOnly(passField, creds);
    }

    if (!userField) return false;

    fillInput(userField, creds.username);
    await sleep(250);

    // Zoho and similar flows are often two-step (username page, then password page).
    if (!passField) {
      const continueButton = findContinueButton();
      if (continueButton) {
        clickElement(continueButton);
        await sleep(700);
      }

      // Allow extra time on slower connections/account variants.
      passField = await waitForField(() => findPasswordField(creds.passwordField), 40, 500);
    }
    if (!passField) return false;

    // Refresh username field reference after step transitions.
    userField = findUsernameField(creds.usernameField) || userField;
    return submitWithKnownFields(userField, passField, creds);
  }

  async function submitPasswordOnly(passField, creds) {
    return submitWithKnownFields(null, passField, creds);
  }

  async function submitWithKnownFields(userField, passField, creds) {
    if (!passField) return false;

    preventPasswordSave(userField, passField);

    if (userField && !userField.value) {
      fillInput(userField, creds.username);
      await sleep(150);
    }

    fillInput(passField, creds.password);
    await sleep(250);

    const loginButton = findLoginButton();
    if (loginButton) {
      submitWithPasswordPrevention(userField, passField, loginButton);
      return true;
    }

    const form = passField.closest('form') || userField?.closest('form');
    if (!form) return false;

    scrambleFieldsBeforeSubmit(userField, passField);
    try {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    } catch (error) {
      console.warn('[DSG] Form submit fallback failed:', error);
      return false;
    }

    setTimeout(hideLoadingOverlay, 1500);
    return true;
  }

  function waitForAnyLoginFields(creds, maxAttempts, delayMs) {
    return new Promise((resolve) => {
      let attempts = 0;
      const tryFind = () => {
        attempts += 1;

        const userField = findUsernameField(creds.usernameField);
        const passField = findPasswordField(creds.passwordField);
        if (userField || passField) {
          resolve({ userField, passField });
          return;
        }

        if (attempts >= maxAttempts) {
          resolve(null);
          return;
        }

        setTimeout(tryFind, delayMs);
      };
      tryFind();
    });
  }

  function waitForField(getField, maxAttempts, delayMs) {
    return new Promise((resolve) => {
      let attempts = 0;
      const tryFind = () => {
        attempts += 1;
        try {
          const field = getField();
          if (field) {
            resolve(field);
            return;
          }
        } catch (_) {
          // Ignore selector/runtime issues and continue trying.
        }

        if (attempts >= maxAttempts) {
          resolve(null);
          return;
        }
        setTimeout(tryFind, delayMs);
      };
      tryFind();
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function preventPasswordSave(userField, passField) {
    if (!passField) return;

    if (userField) userField.setAttribute('autocomplete', 'off');
    passField.setAttribute('autocomplete', 'new-password');

    [userField, passField].filter(Boolean).forEach((field) => {
      field.setAttribute('data-lpignore', 'true');
      field.setAttribute('data-1p-ignore', 'true');
      field.setAttribute('data-bwignore', 'true');
      field.setAttribute('data-form-type', 'other');
    });

    const form = passField.closest('form') || userField?.closest('form');
    if (form) {
      form.setAttribute('autocomplete', 'off');
      form.setAttribute('data-lpignore', 'true');
    }

    const dummy = document.createElement('div');
    dummy.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden;';
    dummy.innerHTML = `
      <input type="text" name="fake_email_${Date.now()}" autocomplete="username" tabindex="-1">
      <input type="password" name="fake_pass_${Date.now()}" autocomplete="current-password" tabindex="-1">
    `;
    if (form) form.insertBefore(dummy, form.firstChild);
    else document.body?.insertBefore(dummy, document.body.firstChild);

    const originalType = passField.type;
    passField.type = 'text';
    setTimeout(() => {
      passField.type = originalType;
    }, 50);

    if (userField) userField.readOnly = true;
    passField.readOnly = true;
    setTimeout(() => {
      if (userField) userField.readOnly = false;
      passField.readOnly = false;
    }, 100);

    userField?.blur();
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

  function submitWithPasswordPrevention(userField, passField, button) {
    const form = passField?.closest('form') || userField?.closest('form');

    const originalUserName = userField?.name;
    const originalPassName = passField?.name;
    const originalUserId = userField?.id;
    const originalPassId = passField?.id;

    scrambleFieldsBeforeSubmit(userField, passField);
    if (form) form.setAttribute('autocomplete', 'off');

    requestAnimationFrame(() => {
      button.click();

      if (form) {
        setTimeout(() => {
          if (!document.contains(button)) return;
          try {
            if (typeof form.requestSubmit === 'function') form.requestSubmit(button);
            else form.submit();
          } catch (_) {
            // Ignore fallback submit errors
          }
        }, 400);
      }

      setTimeout(hideLoadingOverlay, 1500);

      setTimeout(() => {
        if (userField && document.contains(userField)) {
          userField.name = originalUserName || '';
          userField.id = originalUserId || '';
        }
        if (passField && document.contains(passField)) {
          passField.name = originalPassName || '';
          passField.id = originalPassId || '';
        }
      }, 600);
    });
  }

  function findUsernameField(preferredName) {
    const selectors = [
      preferredName ? `input[name="${preferredName}"]` : null,
      preferredName ? `input[id="${preferredName}"]` : null,
      preferredName ? `input[name="${preferredName.replace(/\$/g, '_')}"]` : null,
      'input[name="LOGIN_ID"]',
      'input[name="login_id"]',
      'input[id="LOGIN_ID"]',
      'input[id="login_id"]',
      'input[id*="login_id" i]',
      'input[name*="txtUserName" i]',
      'input[name*="UserName" i]',
      'input[id*="txtUserName" i]',
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
      'form input[type="text"]:first-of-type'
    ].filter(Boolean);

    for (const selector of selectors) {
      try {
        const field = document.querySelector(selector);
        if (field && isVisible(field)) return field;
      } catch (_) {
        // Ignore invalid selector and continue
      }
    }

    const textInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (const input of textInputs) {
      if (isVisible(input)) return input;
    }
    return null;
  }

  function findPasswordField(preferredName) {
    const selectors = [
      preferredName ? `input[name="${preferredName}"]` : null,
      preferredName ? `input[id="${preferredName}"]` : null,
      preferredName ? `input[name="${preferredName.replace(/\$/g, '_')}"]` : null,
      'input[name="PASSWORD"]',
      'input[name="password"]',
      'input[id="PASSWORD"]',
      'input[id="password"]',
      'input[id*="password" i]',
      'input[name*="txtPassword" i]',
      'input[id*="txtPassword" i]',
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[name*="pwd" i]',
      'input[id*="pass" i]',
      'input[autocomplete="current-password"]'
    ].filter(Boolean);

    for (const selector of selectors) {
      try {
        const field = document.querySelector(selector);
        if (field && isVisible(field)) return field;
      } catch (_) {
        // Ignore invalid selector and continue
      }
    }
    return null;
  }

  function findContinueButton() {
    const selectors = [
      'button[id*="next" i]',
      'input[type="button"][value*="Next" i]',
      'input[type="submit"][value*="Next" i]',
      'button[data-action*="next" i]',
      'button[aria-label*="next" i]',
      '#nextbtn',
      'button#nextbtn',
      'input#nextbtn',
      '.nextbtn',
      '.next-btn',
      'button[class*="next" i]',
      'button[name="next"]',
      'input[name="next"]'
    ];

    for (const selector of selectors) {
      try {
        const button = document.querySelector(selector);
        if (button && isVisible(button)) return button;
      } catch (_) {
        // Ignore and continue
      }
    }

    const candidates = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const candidate of candidates) {
      const text = (candidate.textContent || candidate.value || '').toLowerCase();
      if ((text.includes('next') || text.includes('continue')) && isVisible(candidate)) {
        return candidate;
      }
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
      '.btn-login',
      '.btn-signin',
      'form button:not([type="button"])'
    ];

    for (const selector of selectors) {
      try {
        const button = document.querySelector(selector);
        if (button && isVisible(button) && !isSkipButton(button)) return button;
      } catch (_) {
        // Ignore and continue
      }
    }

    const candidates = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const candidate of candidates) {
      const text = (candidate.textContent || candidate.value || '').toLowerCase();
      const isLoginAction = text.includes('sign in') || text.includes('log in') || text.includes('login') || text.includes('submit');
      if (isLoginAction && isVisible(candidate) && !isSkipButton(candidate)) {
        return candidate;
      }
    }

    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      if (!form.querySelector('input[type="password"]')) continue;
      const button = form.querySelector('button, input[type="submit"]');
      if (button && isVisible(button) && !isSkipButton(button)) return button;
    }

    return null;
  }

  function isSkipButton(element) {
    const text = (element.textContent || element.value || '').toLowerCase();
    return text.includes('forgot') ||
      text.includes('register') ||
      text.includes('sign up') ||
      text.includes('create') ||
      text.includes('next') ||
      text.includes('continue');
  }

  function isVisible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return (rect.width > 0 && rect.height > 0) || element.offsetParent !== null || style.position === 'fixed';
  }

  function fillInput(element, value) {
    if (!element || value == null) return;
    element.focus();
    element.value = '';

    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(element, value);
    element.value = value;

    ['input', 'change', 'keydown', 'keyup', 'keypress'].forEach((eventName) => {
      element.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true }));
    });
  }

  function clickElement(element) {
    if (!element) return;
    try {
      element.click();
    } catch (_) {
      // Ignore
    }

    try {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (_) {
      // Ignore
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
