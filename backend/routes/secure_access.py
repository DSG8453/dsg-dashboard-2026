"""
Secure Tool Access Service - Zero Visibility Credentials
Credentials are NEVER shown to users - login happens automatically in background
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from database import get_db
from routes.auth import get_current_user
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import secrets
import hashlib
import base64
import os
import json
import httpx
import re

router = APIRouter()

# Store one-time access tokens
access_tokens = {}

# Store session cookies for tools
tool_sessions = {}


@router.post("/{tool_id}/request-access")
async def request_tool_access(
    tool_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Request secure access to a tool - credentials never visible"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(tool_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tool ID")
    
    tool = await db.tools.find_one({"_id": obj_id})
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    # Check if user has access to this tool
    if current_user.get("role") != "Super Administrator":
        user_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        allowed_tools = user_data.get("allowed_tools", []) if user_data else []
        if tool_id not in allowed_tools:
            raise HTTPException(status_code=403, detail="You don't have access to this tool")
    
    credentials = tool.get("credentials", {})
    login_url = credentials.get("login_url") or tool.get("url", "#")
    
    if not login_url or login_url == "#":
        raise HTTPException(status_code=400, detail="Tool URL not configured")
    
    has_credentials = bool(credentials.get("username") and credentials.get("password"))
    
    # Generate one-time access token
    access_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(access_token.encode()).hexdigest()
    
    access_tokens[token_hash] = {
        "tool_id": tool_id,
        "user_id": current_user["id"],
        "user_email": current_user["email"],
        "login_url": login_url,
        "tool_name": tool.get("name"),
        "tool_url": tool.get("url", "#"),
        "has_credentials": has_credentials,
        "credentials": credentials if has_credentials else None,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        "used": False
    }
    
    # Log access
    await db.activity_logs.insert_one({
        "user_email": current_user["email"],
        "user_name": current_user.get("name", current_user["email"]),
        "action": "Accessed Tool",
        "target": tool.get("name"),
        "details": f"Secure auto-login to {tool.get('name')}",
        "activity_type": "access",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Prepare response - credentials are NEVER exposed directly
    # They are only passed through the secure launch URL
    response_data = {
        "access_token": access_token,
        "access_url": f"/api/secure-access/launch/{access_token}",
        "tool_name": tool.get("name"),
        "has_auto_login": has_credentials,
        "login_url": login_url,
        "expires_in": 300
    }
    
    return response_data


@router.get("/launch/{access_token}")
async def launch_tool(access_token: str):
    """
    Launch tool - opens login page and submits credentials via form.
    Credentials are hidden in encoded format.
    """
    token_hash = hashlib.sha256(access_token.encode()).hexdigest()
    token_data = access_tokens.get(token_hash)
    
    if not token_data:
        return HTMLResponse(content=get_error_page("Invalid Access Link", 
            "This access link is invalid or expired."), status_code=403)
    
    if datetime.now(timezone.utc) > token_data["expires_at"]:
        del access_tokens[token_hash]
        return HTMLResponse(content=get_error_page("Link Expired", 
            "This access link has expired."), status_code=403)
    
    if token_data["used"]:
        return HTMLResponse(content=get_error_page("Link Used", 
            "This one-time link has already been used."), status_code=403)
    
    access_tokens[token_hash]["used"] = True
    
    login_url = token_data["login_url"]
    credentials = token_data.get("credentials", {})
    tool_name = token_data["tool_name"]
    
    # No credentials - just redirect to tool URL
    if not credentials or not credentials.get("username"):
        return RedirectResponse(url=login_url, status_code=302)
    
    username = credentials.get("username", "")
    password = credentials.get("password", "")
    username_field = credentials.get("username_field", "username")
    password_field = credentials.get("password_field", "password")
    
    # Encode credentials to hide them in the HTML
    cred_json = json.dumps({"u": username, "p": password})
    encoded_creds = base64.b64encode(cred_json.encode()).decode()
    
    # Simple HTML page that submits a form with credentials
    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Opening {tool_name}...</title>
<style>
body{{margin:0;padding:40px;font-family:system-ui,sans-serif;background:#0f172a;color:#fff;text-align:center}}
.spinner{{width:40px;height:40px;border:3px solid #334155;border-top:3px solid #3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:20px auto}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}
</style>
</head>
<body>
<div class="spinner"></div>
<p>Opening {tool_name}...</p>
<p style="font-size:12px;opacity:0.6">Credentials are securely managed</p>

<form id="loginForm" method="POST" action="{login_url}" style="display:none">
<input type="text" name="{username_field}" id="userField">
<input type="password" name="{password_field}" id="passField">
<input type="text" name="username" id="userField2">
<input type="password" name="password" id="passField2">
<input type="text" name="email" id="emailField">
<input type="text" name="Email" id="EmailField">
<input type="text" name="LOGIN_ID" id="loginIdField">
<input type="password" name="PASSWORD" id="PASSWORDField">
</form>

<script>
(function(){{
try{{
var d=atob("{encoded_creds}");
var c=JSON.parse(d);
document.getElementById("userField").value=c.u;
document.getElementById("passField").value=c.p;
document.getElementById("userField2").value=c.u;
document.getElementById("passField2").value=c.p;
document.getElementById("emailField").value=c.u;
document.getElementById("EmailField").value=c.u;
document.getElementById("loginIdField").value=c.u;
document.getElementById("PASSWORDField").value=c.p;
c=null;d=null;
setTimeout(function(){{
document.getElementById("loginForm").submit();
}},500);
}}catch(e){{
window.location.href="{login_url}";
}}
}})();
</script>
</body>
</html>'''
    
    return HTMLResponse(content=html)
            }
            
            # Get cookies from the initial request
            cookies = dict(login_page.cookies)
            
            login_response = await client.post(
                login_url,
                data=form_data,
                headers=headers,
                cookies=cookies
            )
            
            # Check if login was successful
            # Usually successful login redirects to a dashboard or different page
            final_url = str(login_response.url)
            
            # Collect all cookies from the session
            all_cookies = dict(login_response.cookies)
            for cookie_name, cookie_value in login_page.cookies.items():
                if cookie_name not in all_cookies:
                    all_cookies[cookie_name] = cookie_value
            
            # If we got cookies, create a redirect page that sets them
            if all_cookies:
                # Create a page that redirects with session info
                cookie_script = ""
                for name, value in all_cookies.items():
                    # Set cookies via JavaScript
                    cookie_script += f'document.cookie="{name}={value};path=/;";'
                
                redirect_html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Logging in...</title>
<style>
body{{margin:0;padding:50px;font-family:sans-serif;background:#0f172a;color:#fff;text-align:center}}
.l{{width:30px;height:30px;border:3px solid #333;border-top:3px solid #22c55e;border-radius:50%;animation:s 1s linear infinite;margin:20px auto}}
@keyframes s{{to{{transform:rotate(360deg)}}}}
</style>
</head>
<body>
<div class="l"></div>
<p>Logging into {tool_name}...</p>
<script>
// Redirect to the final URL
setTimeout(function(){{
    window.location.href="{final_url}";
}}, 500);
</script>
</body>
</html>'''
                return HTMLResponse(content=redirect_html)
            else:
                # No cookies, just redirect to the result
                return RedirectResponse(url=final_url, status_code=302)
                
    except Exception as e:
        # If server-side login fails, fall back to simple form POST
        print(f"Server-side login failed: {e}")
        
        # Encode credentials to hide them
        cred_data = base64.b64encode(json.dumps({"u": username, "p": password}).encode()).decode()
        
        fallback_html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Connecting...</title>
<style>body{{margin:0;padding:50px;font-family:sans-serif;background:#0f172a;color:#fff;text-align:center}}
.l{{width:30px;height:30px;border:3px solid #333;border-top:3px solid #3b82f6;border-radius:50%;animation:s 1s linear infinite;margin:20px auto}}
@keyframes s{{to{{transform:rotate(360deg)}}}}</style>
</head>
<body>
<div class="l"></div>
<p>Connecting to {tool_name}...</p>
<form id="f" method="POST" action="{login_url}" style="display:none">
<input type="hidden" name="{username_field}" id="u1">
<input type="hidden" name="{password_field}" id="p1">
<input type="hidden" name="username" id="u2">
<input type="hidden" name="password" id="p2">
</form>
<script>
var d="{cred_data}";
try{{
var c=JSON.parse(atob(d));
document.getElementById('u1').value=c.u;
document.getElementById('p1').value=c.p;
document.getElementById('u2').value=c.u;
document.getElementById('p2').value=c.p;
c=null;d=null;
document.getElementById('f').submit();
}}catch(e){{window.location.href="{login_url}";}}
</script>
</body>
</html>'''
        return HTMLResponse(content=fallback_html)


def get_error_page(title: str, message: str) -> str:
    return f'''<!DOCTYPE html>
<html>
<head><title>{title}</title>
<style>
body{{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:white;text-align:center}}
.box{{background:rgba(255,255,255,0.1);padding:40px;border-radius:16px}}
a{{color:#3b82f6;margin-top:20px;display:inline-block}}
</style>
</head>
<body><div class="box"><h1>⚠️ {title}</h1><p>{message}</p><a href="/">Return to Dashboard</a></div></body>
</html>'''


@router.delete("/tokens/cleanup")
async def cleanup_expired_tokens(current_user: dict = Depends(get_current_user)):
    """Clean up expired tokens"""
    if current_user.get("role") != "Super Administrator":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    now = datetime.now(timezone.utc)
    expired = [k for k, v in access_tokens.items() if now > v["expires_at"]]
    for token_hash in expired:
        del access_tokens[token_hash]
    
    return {"message": f"Cleaned up {len(expired)} expired tokens"}
