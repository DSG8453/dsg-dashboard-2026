"""
Server-Side Tool Login Service
Logs into tools on behalf of users and returns authenticated sessions.
Users NEVER see credentials - they get pre-authenticated access.
"""
import asyncio
from playwright.async_api import async_playwright
from datetime import datetime, timezone, timedelta
import json
import hashlib
from typing import Optional, Dict, Any

# Cache for authenticated sessions (in production, use Redis)
session_cache: Dict[str, Dict] = {}


async def server_login_to_tool(
    login_url: str,
    username: str,
    password: str,
    username_field: str = "username",
    password_field: str = "password",
    tool_name: str = "Tool",
    timeout: int = 30000
) -> Dict[str, Any]:
    """
    Perform server-side login to a tool and capture authenticated session.
    
    Returns:
        {
            "success": bool,
            "cookies": list of cookies,
            "final_url": str,
            "error": str (if failed)
        }
    """
    browser = None
    
    try:
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            
            page = await context.new_page()
            
            # Navigate to login page
            await page.goto(login_url, wait_until='networkidle', timeout=timeout)
            
            # Wait for page to be fully loaded
            await page.wait_for_load_state('domcontentloaded')
            await asyncio.sleep(1)  # Extra wait for JS to initialize
            
            # Try to find and fill username field
            username_selectors = [
                f'input[name="{username_field}"]',
                f'input[id="{username_field}"]',
                'input[type="email"]',
                'input[type="text"][name*="user"]',
                'input[type="text"][name*="email"]',
                'input[type="text"][name*="login"]',
                'input[id*="user"]',
                'input[id*="email"]',
                'input[id*="login"]',
            ]
            
            username_input = None
            for selector in username_selectors:
                try:
                    username_input = await page.wait_for_selector(selector, timeout=3000)
                    if username_input:
                        break
                except:
                    continue
            
            if not username_input:
                return {"success": False, "error": "Could not find username field"}
            
            await username_input.fill(username)
            
            # Try to find and fill password field
            password_selectors = [
                f'input[name="{password_field}"]',
                f'input[id="{password_field}"]',
                'input[type="password"]',
                'input[name*="pass"]',
                'input[id*="pass"]',
            ]
            
            password_input = None
            for selector in password_selectors:
                try:
                    password_input = await page.wait_for_selector(selector, timeout=3000)
                    if password_input:
                        break
                except:
                    continue
            
            if not password_input:
                return {"success": False, "error": "Could not find password field"}
            
            await password_input.fill(password)
            
            # Find and click submit button
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Sign In")',
                'button:has-text("Login")',
                'button:has-text("Log In")',
                'button:has-text("Submit")',
                'input[value*="Login"]',
                'input[value*="Sign"]',
            ]
            
            submit_button = None
            for selector in submit_selectors:
                try:
                    submit_button = await page.wait_for_selector(selector, timeout=2000)
                    if submit_button:
                        break
                except:
                    continue
            
            if submit_button:
                await submit_button.click()
            else:
                # Try pressing Enter on password field
                await password_input.press('Enter')
            
            # Wait for navigation after login
            try:
                await page.wait_for_load_state('networkidle', timeout=10000)
            except:
                pass  # Some pages don't trigger networkidle
            
            await asyncio.sleep(2)  # Wait for any redirects
            
            # Check if login was successful by looking at URL change or error messages
            final_url = page.url
            
            # Get all cookies from the authenticated session
            cookies = await context.cookies()
            
            await browser.close()
            
            # Check if we're still on login page (login failed)
            if 'login' in final_url.lower() and login_url in final_url:
                return {
                    "success": False,
                    "error": "Login failed - please verify credentials",
                    "final_url": final_url
                }
            
            return {
                "success": True,
                "cookies": cookies,
                "final_url": final_url,
                "tool_name": tool_name
            }
            
    except Exception as e:
        if browser:
            await browser.close()
        return {
            "success": False,
            "error": f"Login error: {str(e)}"
        }


def get_cached_session(user_id: str, tool_id: str) -> Optional[Dict]:
    """Get cached session if still valid"""
    cache_key = f"{user_id}:{tool_id}"
    
    if cache_key in session_cache:
        cached = session_cache[cache_key]
        if cached["expires_at"] > datetime.now(timezone.utc):
            return cached
        else:
            del session_cache[cache_key]
    
    return None


def cache_session(user_id: str, tool_id: str, cookies: list, final_url: str):
    """Cache authenticated session for reuse"""
    cache_key = f"{user_id}:{tool_id}"
    session_cache[cache_key] = {
        "cookies": cookies,
        "final_url": final_url,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),  # Cache for 1 hour
        "created_at": datetime.now(timezone.utc).isoformat()
    }


def clear_session_cache(user_id: str = None, tool_id: str = None):
    """Clear session cache"""
    global session_cache
    
    if user_id and tool_id:
        cache_key = f"{user_id}:{tool_id}"
        if cache_key in session_cache:
            del session_cache[cache_key]
    elif user_id:
        keys_to_delete = [k for k in session_cache if k.startswith(f"{user_id}:")]
        for k in keys_to_delete:
            del session_cache[k]
    else:
        session_cache = {}
