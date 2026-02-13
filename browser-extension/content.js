// DSG Transport Secure Login - Content Script
// Fills credentials and submits form, then notifies background to show tab

(function() {
  'use strict';
  
  let loginAttempted = false;
  
  // Start when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLogin);
  } else {
    startLogin();
  }
  
  function startLogin() {
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LOGIN' }, (pending) => {
      if (chrome.runtime.lastError || !pending || loginAttempted) return;
      loginAttempted = true;
      
      // Wait for page to fully render
      setTimeout(() => fillAndSubmit(pending), 500);
    });
  }
  
  function fillAndSubmit(creds) {
    let attempts = 0;
    const maxAttempts = 20;
    
    const tryFill = () => {
      attempts++;
      
      const userField = findField(creds.usernameField, 'user');
      const passField = findField(creds.passwordField, 'pass');
      
      if (userField && passField) {
        // PREVENT PASSWORD SAVE - Multiple techniques
        preventPasswordSave(userField, passField);
        
        // Fill fields
        fillInput(userField, creds.username);
        
        setTimeout(() => {
          fillInput(passField, creds.password);
          
          // Submit the form
          setTimeout(() => {
            const btn = findSubmitButton();
            if (btn) {
              // Scramble field names before submit
              scrambleAndSubmit(userField, passField, btn);
            } else {
              // Try form.submit()
              const form = userField.closest('form') || passField.closest('form');
              if (form) {
                scrambleFields(userField, passField);
                form.submit();
              }
              notifyComplete();
            }
          }, 300);
        }, 200);
        
      } else if (attempts < maxAttempts) {
        setTimeout(tryFill, 500);
      } else {
        // Failed to find fields - show tab anyway
        chrome.runtime.sendMessage({ action: 'LOGIN_FAILED', reason: 'Fields not found' });
      }
    };
    
    tryFill();
  }
  
  // PREVENT CHROME PASSWORD SAVE - 7 TECHNIQUES
  function preventPasswordSave(userField, passField) {
    const rand = '_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    
    // 1. Autocomplete off
    userField.setAttribute('autocomplete', 'off');
    passField.setAttribute('autocomplete', 'new-password');
    
    // 2. Password manager ignore flags
    [userField, passField].forEach(f => {
      f.setAttribute('data-lpignore', 'true');
      f.setAttribute('data-1p-ignore', 'true');
      f.setAttribute('data-bwignore', 'true');
      f.setAttribute('data-form-type', 'other');
    });
    
    // 3. Form autocomplete off
    const form = userField.closest('form') || passField.closest('form');
    if (form) {
      form.setAttribute('autocomplete', 'off');
      form.setAttribute('data-lpignore', 'true');
    }
    
    // 4. Add dummy fields BEFORE real ones
    const dummy = document.createElement('div');
    dummy.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    dummy.innerHTML = '<input name="fake_user" type="text" autocomplete="username"><input name="fake_pass" type="password" autocomplete="current-password">';
    if (form) form.insertBefore(dummy, form.firstChild);
    
    // 5. Temporarily make password a text field
    passField.type = 'text';
    setTimeout(() => { passField.type = 'password'; }, 50);
    
    // 6. Set readonly temporarily
    userField.readOnly = true;
    passField.readOnly = true;
    setTimeout(() => {
      userField.readOnly = false;
      passField.readOnly = false;
    }, 100);
    
    // 7. Blur to prevent autofill detection
    userField.blur();
    passField.blur();
  }
  
  // Scramble field identifiers before submit
  function scrambleFields(userField, passField) {
    const rand = '_dsg_' + Date.now();
    userField.name = 'field_x' + rand;
    userField.id = 'id_x' + rand;
    passField.name = 'field_y' + rand;
    passField.id = 'id_y' + rand;
    passField.setAttribute('autocomplete', 'new-password');
  }
  
  function scrambleAndSubmit(userField, passField, btn) {
    scrambleFields(userField, passField);
    
    // Click button
    btn.click();
    
    // Notify background - login submitted, show tab after redirect
    setTimeout(notifyComplete, 500);
  }
  
  function notifyComplete() {
    chrome.runtime.sendMessage({ action: 'LOGIN_COMPLETE' });
  }
  
  function findField(preferredName, type) {
    // Try exact match first
    let field = document.querySelector(`input[name="${preferredName}"]`) ||
                document.querySelector(`input[id="${preferredName}"]`);
    if (field && isVisible(field)) return field;
    
    // Try variations
    const selectors = type === 'pass' ? [
      'input[type="password"]',
      'input[name*="pass" i]',
      'input[name*="pwd" i]',
      'input[id*="pass" i]',
      'input[id*="password" i]',
      'input[autocomplete="current-password"]'
    ] : [
      'input[type="email"]',
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[autocomplete="username"]',
      'form input[type="text"]:first-of-type'
    ];
    
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    return null;
  }
  
  function findSubmitButton() {
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[id*="login" i]',
      'button[id*="signin" i]',
      'button[class*="login" i]',
      'button[class*="signin" i]',
      'input[name*="btnLogin" i]',
      'input[id*="btnLogin" i]'
    ];
    
    for (const sel of selectors) {
      try {
        const btn = document.querySelector(sel);
        if (btn && isVisible(btn)) return btn;
      } catch (e) {}
    }
    
    // Text search
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('sign in') || text.includes('log in') || text.includes('login') || text.includes('submit')) {
        if (isVisible(btn)) return btn;
      }
    }
    
    // Last resort: any button in form with password
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      if (form.querySelector('input[type="password"]')) {
        const btn = form.querySelector('button, input[type="submit"]');
        if (btn && isVisible(btn)) return btn;
      }
    }
    
    return null;
  }
  
  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  }
  
  function fillInput(el, value) {
    el.focus();
    el.value = '';
    
    // Native setter for React/Angular
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.value = value;
    
    // Fire events
    ['input', 'change', 'keydown', 'keyup'].forEach(evt => {
      el.dispatchEvent(new Event(evt, { bubbles: true }));
    });
  }
  
  // Detect navigation (login success)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (loginAttempted) {
        chrome.runtime.sendMessage({ action: 'LOGIN_COMPLETE' });
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  
})();
