"""
Tool Gateway - Access tools ONLY through the dashboard
Users cannot access tools outside the dashboard
Credentials are never visible
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from database import get_db
from routes.auth import get_current_user
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import aiohttp
import secrets
import hashlib
import json
import re
from urllib.parse import urljoin, urlparse

router = APIRouter()

# Store active gateway sessions
gateway_sessions = {}

# Session timeout (30 minutes)
SESSION_TIMEOUT = timedelta(minutes=30)


@router.post("/start/{tool_id}")
async def start_gateway_session(
    tool_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start a gateway session to access a tool through the dashboard"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(tool_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tool ID")
    
    tool = await db.tools.find_one({"_id": obj_id})
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    # Check access
    if current_user.get("role") != "Super Administrator":
        user_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        allowed_tools = user_data.get("allowed_tools", []) if user_data else []
        if tool_id not in allowed_tools:
            raise HTTPException(status_code=403, detail="Access denied")
    
    credentials = tool.get("credentials", {})
    base_url = credentials.get("login_url") or tool.get("url", "")
    
    if not base_url:
        raise HTTPException(status_code=400, detail="Tool URL not configured")
    
    # Create gateway session
    session_token = secrets.token_urlsafe(32)
    session_hash = hashlib.sha256(session_token.encode()).hexdigest()
    
    gateway_sessions[session_hash] = {
        "tool_id": tool_id,
        "tool_name": tool.get("name"),
        "base_url": base_url,
        "credentials": credentials,
        "user_id": current_user["id"],
        "user_email": current_user["email"],
        "cookies": {},  # Will store tool's session cookies
        "logged_in": False,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + SESSION_TIMEOUT,
        "last_access": datetime.now(timezone.utc)
    }
    
    # Log activity
    await db.activity_logs.insert_one({
        "user_email": current_user["email"],
        "user_name": current_user.get("name", current_user["email"]),
        "action": "Started Gateway Session",
        "target": tool.get("name"),
        "details": f"Secure gateway access to {tool.get('name')}",
        "activity_type": "access",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "session_token": session_token,
        "gateway_url": f"/api/gateway/view/{session_token}",
        "tool_name": tool.get("name"),
        "expires_in": SESSION_TIMEOUT.seconds
    }


@router.get("/view/{session_token}")
async def view_tool_gateway(session_token: str, current_user: dict = Depends(get_current_user)):
    """View tool through the gateway - embedded in dashboard"""
    session_hash = hashlib.sha256(session_token.encode()).hexdigest()
    session = gateway_sessions.get(session_hash)
    
    if not session:
        return HTMLResponse(content=get_error_html("Session Not Found", 
            "This gateway session has expired or is invalid."), status_code=403)
    
    if datetime.now(timezone.utc) > session["expires_at"]:
        del gateway_sessions[session_hash]
        return HTMLResponse(content=get_error_html("Session Expired", 
            "Your gateway session has expired. Please start a new session."), status_code=403)
    
    # Update last access
    gateway_sessions[session_hash]["last_access"] = datetime.now(timezone.utc)
    
    tool_name = session["tool_name"]
    
    # Return an HTML page with the tool embedded
    html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{tool_name} - DSG Gateway</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: system-ui, sans-serif;
            background: #0f172a;
            color: white;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }}
        .header {{
            background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
            padding: 12px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #334155;
        }}
        .header-left {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .logo {{
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
        }}
        .tool-name {{
            background: #3b82f6;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 14px;
        }}
        .secure-badge {{
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(34, 197, 94, 0.2);
            border: 1px solid rgba(34, 197, 94, 0.3);
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 12px;
            color: #22c55e;
        }}
        .close-btn {{
            background: #ef4444;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        }}
        .close-btn:hover {{ background: #dc2626; }}
        .tool-frame {{
            flex: 1;
            border: none;
            background: white;
        }}
        .loading {{
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            flex-direction: column;
            gap: 20px;
        }}
        .spinner {{
            width: 50px;
            height: 50px;
            border: 4px solid #334155;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }}
        @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
        .info-box {{
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            padding: 20px 30px;
            border-radius: 12px;
            text-align: center;
            max-width: 500px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <div class="logo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                DSG Transport Gateway
            </div>
            <div class="tool-name">{tool_name}</div>
            <div class="secure-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Secure Gateway Access
            </div>
        </div>
        <button class="close-btn" onclick="closeGateway()">Close Gateway</button>
    </div>
    
    <div class="loading" id="loadingScreen">
        <div class="spinner"></div>
        <div class="info-box">
            <h3>🔐 Secure Gateway</h3>
            <p style="margin-top:10px;opacity:0.8">Connecting to {tool_name}...</p>
            <p style="margin-top:10px;font-size:12px;opacity:0.6">
                This tool is accessed through DSG Transport's secure gateway.<br>
                Credentials are managed by your administrator.
            </p>
        </div>
    </div>
    
    <iframe id="toolFrame" class="tool-frame" style="display:none"></iframe>
    
    <script>
        function closeGateway() {{
            if (window.opener) {{
                window.close();
            }} else {{
                window.location.href = '/';
            }}
        }}
        
        // Load tool content
        setTimeout(function() {{
            document.getElementById('loadingScreen').style.display = 'none';
            var frame = document.getElementById('toolFrame');
            frame.style.display = 'block';
            frame.src = '/api/gateway/proxy/{session_token}/';
        }}, 1500);
    </script>
</body>
</html>'''
    
    return HTMLResponse(content=html)


@router.get("/proxy/{session_token}/{path:path}")
@router.post("/proxy/{session_token}/{path:path}")
async def proxy_tool_request(
    session_token: str,
    path: str = "",
    request: Request = None
):
    """Proxy requests to the tool - maintains session"""
    session_hash = hashlib.sha256(session_token.encode()).hexdigest()
    session = gateway_sessions.get(session_hash)
    
    if not session:
        return HTMLResponse(content="<h1>Session expired</h1>", status_code=403)
    
    if datetime.now(timezone.utc) > session["expires_at"]:
        del gateway_sessions[session_hash]
        return HTMLResponse(content="<h1>Session expired</h1>", status_code=403)
    
    # Update last access
    gateway_sessions[session_hash]["last_access"] = datetime.now(timezone.utc)
    
    base_url = session["base_url"]
    credentials = session.get("credentials", {})
    
    # Build target URL
    target_url = urljoin(base_url, path)
    if request.query_params:
        target_url += "?" + str(request.query_params)
    
    try:
        async with aiohttp.ClientSession() as http_session:
            # Get cookies from session
            cookies = session.get("cookies", {})
            
            # Prepare headers
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }
            
            # Make request
            method = request.method
            if method == "POST":
                body = await request.body()
                async with http_session.post(target_url, data=body, headers=headers, cookies=cookies, allow_redirects=True) as resp:
                    content = await resp.read()
                    # Store cookies
                    for cookie in resp.cookies.values():
                        gateway_sessions[session_hash]["cookies"][cookie.key] = cookie.value
            else:
                async with http_session.get(target_url, headers=headers, cookies=cookies, allow_redirects=True) as resp:
                    content = await resp.read()
                    # Store cookies
                    for cookie in resp.cookies.values():
                        gateway_sessions[session_hash]["cookies"][cookie.key] = cookie.value
            
            content_type = resp.headers.get("Content-Type", "text/html")
            
            # Rewrite URLs in HTML content to go through proxy
            if "text/html" in content_type:
                try:
                    html = content.decode("utf-8", errors="ignore")
                    # Rewrite absolute URLs
                    parsed = urlparse(base_url)
                    base_domain = f"{parsed.scheme}://{parsed.netloc}"
                    html = html.replace(f'href="{base_domain}', f'href="/api/gateway/proxy/{session_token}')
                    html = html.replace(f"href='{base_domain}", f"href='/api/gateway/proxy/{session_token}")
                    html = html.replace(f'src="{base_domain}', f'src="/api/gateway/proxy/{session_token}')
                    html = html.replace(f"src='{base_domain}", f"src='/api/gateway/proxy/{session_token}")
                    html = html.replace(f'action="{base_domain}', f'action="/api/gateway/proxy/{session_token}')
                    html = html.replace(f"action='{base_domain}", f"action='/api/gateway/proxy/{session_token}")
                    content = html.encode("utf-8")
                except Exception:
                    pass
            
            return Response(content=content, media_type=content_type)
            
    except Exception as e:
        return HTMLResponse(content=f"<h1>Error loading tool</h1><p>{str(e)}</p>", status_code=500)


@router.delete("/session/{session_token}")
async def end_gateway_session(session_token: str, current_user: dict = Depends(get_current_user)):
    """End a gateway session"""
    session_hash = hashlib.sha256(session_token.encode()).hexdigest()
    if session_hash in gateway_sessions:
        del gateway_sessions[session_hash]
    return {"message": "Session ended"}


def get_error_html(title: str, message: str) -> str:
    return f'''<!DOCTYPE html>
<html>
<head><title>{title}</title>
<style>
body {{
    font-family: system-ui, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #0f172a;
    color: white;
    text-align: center;
    margin: 0;
}}
.box {{
    background: rgba(255,255,255,0.1);
    padding: 40px;
    border-radius: 16px;
    max-width: 400px;
}}
h1 {{ margin-bottom: 16px; }}
a {{
    display: inline-block;
    margin-top: 20px;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    padding: 10px 20px;
    border-radius: 8px;
}}
a:hover {{ background: #2563eb; }}
</style>
</head>
<body>
<div class="box">
    <h1>⚠️ {title}</h1>
    <p>{message}</p>
    <a href="/">Return to Dashboard</a>
</div>
</body>
</html>'''
