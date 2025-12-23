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
import json

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
    Launch tool with secure auto-login.
    Credentials are completely hidden - just auto-submits form.
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
    
    # Encode credentials for secure injection
    cred_data = {
        "u": username,
        "p": password,
        "uf": username_field,
        "pf": password_field
    }
    enc_creds = base64.b64encode(json.dumps(cred_data).encode()).decode()
    
    # Generate minimal auto-login page - credentials NEVER visible
    html_content = f'''<!DOCTYPE html>
<html>
<head>
    <title>Connecting...</title>
    <meta charset="UTF-8">
    <meta name="robots" content="noindex,nofollow">
    <style>
        *{{margin:0;padding:0;box-sizing:border-box}}
        body{{
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            min-height:100vh;
            background:#0f172a;
            display:flex;
            align-items:center;
            justify-content:center;
            color:white;
        }}
        .c{{text-align:center;padding:40px}}
        .s{{
            width:40px;height:40px;
            border:3px solid rgba(255,255,255,0.2);
            border-top-color:#3b82f6;
            border-radius:50%;
            animation:spin 1s linear infinite;
            margin:0 auto 16px;
        }}
        @keyframes spin{{to{{transform:rotate(360deg)}}}}
        p{{font-size:14px;opacity:0.8}}
        .h{{position:absolute;left:-9999px;opacity:0}}
    </style>
</head>
<body>
    <div class="c">
        <div class="s"></div>
        <p>Connecting to {tool_name}...</p>
    </div>
    
    <div class="h">
        <form id="f" method="POST" action="{login_url}">
            <input name="{username_field}" id="u">
            <input type="password" name="{password_field}" id="p">
            <input name="username" id="u2">
            <input type="password" name="password" id="p2">
            <input name="email" id="u3">
            <input name="LOGIN_ID" id="u4">
            <input type="password" name="PASSWORD" id="p4">
        </form>
    </div>
    <script>
    (function(){{
        var D="{enc_creds}";
        try{{
            var C=JSON.parse(atob(D));
            // Fill all form fields
            document.getElementById('u').value=C.u;
            document.getElementById('p').value=C.p;
            document.getElementById('u2').value=C.u;
            document.getElementById('p2').value=C.p;
            document.getElementById('u3').value=C.u;
            document.getElementById('u4').value=C.u;
            document.getElementById('p4').value=C.p;
            // Clear from memory
            C=null;D=null;
            // Submit form immediately
            setTimeout(function(){{document.getElementById('f').submit()}},300);
        }}catch(e){{
            window.location.href="{login_url}";
        }}
    }})();
    // Block inspection
    document.addEventListener('contextmenu',function(e){{e.preventDefault()}});
    document.onkeydown=function(e){{if(e.keyCode==123||((e.ctrlKey||e.metaKey)&&e.shiftKey&&(e.keyCode==73||e.keyCode==74)))return false}};
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
