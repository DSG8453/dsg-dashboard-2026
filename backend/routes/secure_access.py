"""
Secure Tool Access Service - Backend-Only Authentication
Credentials are fetched from Google Secret Manager and NEVER exposed to the frontend.
All authentication happens server-side through the gateway.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from database import get_db
from routes.auth import get_current_user
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import secrets
import hashlib

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
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        "used": False
    }
    
    # Log access
    await db.activity_logs.insert_one({
        "user_email": current_user["email"],
        "user_name": current_user.get("name", current_user["email"]),
        "action": "Accessed Tool",
        "target": tool.get("name"),
        "details": f"Secure access to {tool.get('name')}",
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
    Launch tool - Redirects user to the secure gateway for tool access.
    For tools with credentials, users should use the gateway for secure copy-paste login.
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
    tool_name = token_data["tool_name"]
    has_credentials = token_data.get("has_credentials", False)
    
    # Show secure access page
    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{tool_name} - DSG Transport</title>
<style>
*{{box-sizing:border-box}}
body{{margin:0;padding:20px;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}}
.container{{max-width:450px;width:100%;background:rgba(255,255,255,0.05);border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.1);text-align:center}}
.logo{{font-size:24px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.tool-name{{font-size:20px;font-weight:600;color:#fff;margin:20px 0}}
.message{{color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:24px}}
.btn{{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;border:none;text-decoration:none}}
.btn-primary{{background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;width:100%;margin-bottom:12px}}
.btn-primary:hover{{transform:translateY(-1px);box-shadow:0 4px 12px rgba(59,130,246,0.4)}}
.btn-secondary{{background:rgba(255,255,255,0.1);color:#fff;width:100%}}
.btn-secondary:hover{{background:rgba(255,255,255,0.15)}}
.info-box{{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:20px;margin:20px 0}}
.info-box h3{{color:#22c55e;margin:0 0 8px 0;font-size:16px}}
.info-box p{{color:#94a3b8;margin:0;font-size:13px}}
.warning{{background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:8px;padding:12px;margin-top:16px;font-size:12px;color:#eab308}}
.icon{{width:48px;height:48px;margin:0 auto 16px}}
</style>
</head>
<body>
<div class="container">
<div class="logo">🔐 DSG Transport</div>

<svg class="icon" fill="none" stroke="#3b82f6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>

<div class="tool-name">📱 {tool_name}</div>

<div class="message">
{"This tool has <strong>secure credentials</strong> managed by DSG Transport. Use the secure gateway to access your credentials." if has_credentials else "Opening " + tool_name + "..."}
</div>

{"<div class='info-box'><h3>🛡️ Secure Access</h3><p>Click the button below to access this tool through the secure gateway. Your credentials will be available for copy-paste without being exposed.</p></div>" if has_credentials else ""}

<a href="{login_url}" target="_blank" class="btn btn-primary">
Open {tool_name} {"(Use Gateway for Credentials)" if has_credentials else ""}
</a>

<a href="/" class="btn btn-secondary">
← Return to Dashboard
</a>

{"<div class='warning'>💡 For tools with saved credentials, use the 'Open Tool' button from your dashboard to access the secure gateway.</div>" if has_credentials else ""}

</div>
</body>
</html>'''
    
    return HTMLResponse(content=html)


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
