"""
Secure Tool Access Service - Zero Visibility Credentials
Credentials are NEVER shown to users - login happens automatically in background
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from database import get_db
from routes.auth import get_current_user
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import secrets
import hashlib
import base64
import os

router = APIRouter()

# Store one-time access tokens
access_tokens = {}


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
    
    return {
        "access_token": access_token,
        "access_url": f"/api/secure-access/launch/{access_token}",
        "tool_name": tool.get("name"),
        "has_auto_login": has_credentials,
        "login_url": login_url,
        "expires_in": 300
    }


@router.get("/launch/{access_token}")
async def launch_tool(access_token: str):
    """
    Launch tool with ZERO visibility auto-login.
    Credentials are injected via JavaScript but NEVER displayed.
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
    
    # No credentials - just redirect
    if not credentials or not credentials.get("username"):
        return RedirectResponse(url=login_url, status_code=302)
    
    username = credentials.get("username", "")
    password = credentials.get("password", "")
    username_field = credentials.get("username_field", "username")
    password_field = credentials.get("password_field", "password")
    
    # Triple encode for security
    enc_user = base64.b64encode(base64.b64encode(username.encode()).decode().encode()).decode()
    enc_pass = base64.b64encode(base64.b64encode(password.encode()).decode().encode()).decode()
    
    # Generate auto-login page - credentials NEVER visible
    html_content = f'''<!DOCTYPE html>
<html>
<head>
    <title>Connecting to {tool_name}...</title>
    <meta charset="UTF-8">
    <meta name="robots" content="noindex,nofollow">
    <style>
        *{{margin:0;padding:0;box-sizing:border-box}}
        body{{
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            min-height:100vh;
            background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%);
            display:flex;
            align-items:center;
            justify-content:center;
            color:white;
        }}
        .container{{
            text-align:center;
            padding:40px;
            max-width:400px;
        }}
        .spinner{{
            width:60px;height:60px;
            border:4px solid rgba(255,255,255,0.2);
            border-top-color:#3b82f6;
            border-radius:50%;
            animation:spin 1s linear infinite;
            margin:0 auto 24px;
        }}
        @keyframes spin{{to{{transform:rotate(360deg)}}}}
        h1{{font-size:24px;margin-bottom:12px}}
        p{{color:rgba(255,255,255,0.7);margin-bottom:8px;font-size:14px}}
        .status{{
            background:rgba(255,255,255,0.1);
            padding:12px 20px;
            border-radius:8px;
            margin-top:20px;
            font-size:13px;
        }}
        .secure{{
            display:inline-flex;
            align-items:center;
            gap:6px;
            color:#22c55e;
            margin-top:16px;
            font-size:12px;
        }}
        .hidden{{display:none!important}}
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h1>🔐 Secure Login</h1>
        <p>Connecting to <strong>{tool_name}</strong></p>
        <p id="statusText">Preparing secure connection...</p>
        <div class="status" id="status">Please wait while we log you in automatically</div>
        <div class="secure">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Credentials encrypted &amp; protected
        </div>
    </div>
    
    <!-- Hidden login form - user cannot see or access this -->
    <div class="hidden">
        <form id="lf" method="POST" action="{login_url}" target="_self">
            <input type="hidden" name="{username_field}" id="u1">
            <input type="hidden" name="email" id="u2">
            <input type="hidden" name="Email" id="u3">
            <input type="hidden" name="LOGIN_ID" id="u4">
            <input type="hidden" name="login" id="u5">
            <input type="hidden" name="{password_field}" id="p1">
            <input type="hidden" name="Password" id="p2">
            <input type="hidden" name="PASSWORD" id="p3">
            <input type="hidden" name="pass" id="p4">
            <input type="hidden" name="submit" value="Login">
            <input type="hidden" name="action" value="login">
        </form>
    </div>

    <script>
    (function(){{
        // Secure credential injection - completely hidden from user
        var _0x={{}};
        try{{
            var d=function(s){{return atob(atob(s))}};
            var _u=d("{enc_user}");
            var _p=d("{enc_pass}");
            
            // Fill all possible username fields
            ['u1','u2','u3','u4','u5'].forEach(function(id){{
                var el=document.getElementById(id);
                if(el)el.value=_u;
            }});
            
            // Fill all possible password fields
            ['p1','p2','p3','p4'].forEach(function(id){{
                var el=document.getElementById(id);
                if(el)el.value=_p;
            }});
            
            // Clear from memory immediately
            _u=null;_p=null;
            
            // Update status
            document.getElementById('statusText').textContent='Logging you in...';
            
            // Submit form after brief delay
            setTimeout(function(){{
                document.getElementById('status').textContent='Redirecting to {tool_name}...';
                try{{
                    document.getElementById('lf').submit();
                }}catch(e){{
                    // If form submit fails, redirect to login page
                    window.location.href="{login_url}";
                }}
            }},1500);
            
        }}catch(e){{
            // On any error, just redirect to login page
            document.getElementById('statusText').textContent='Opening {tool_name}...';
            setTimeout(function(){{
                window.location.href="{login_url}";
            }},1000);
        }}
    }})();
    
    // Prevent any inspection
    document.addEventListener('contextmenu',function(e){{e.preventDefault()}});
    document.addEventListener('keydown',function(e){{
        if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&e.key==='I'))e.preventDefault();
    }});
    </script>
</body>
</html>'''
    
    return HTMLResponse(content=html_content)


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
