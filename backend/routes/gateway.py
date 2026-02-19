"""
Tool Gateway - strict backend login mode.
Credentials and login page are never exposed in the user browser.
"""
from datetime import datetime, timedelta, timezone
import hashlib
import re
import secrets
from urllib.parse import urljoin, urlparse

import aiohttp
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse

from database import get_db
from routes.auth import get_current_user
from services.secret_manager_service import secret_manager
from services.tool_login_service import server_login_to_tool
from utils.tool_mapping import normalize_tool_name

router = APIRouter()

# In-memory active gateway sessions.
gateway_sessions = {}
SESSION_TIMEOUT = timedelta(minutes=30)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _build_base_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Tool URL must include scheme and host")
    return f"{parsed.scheme}://{parsed.netloc}"


def _is_expired(session: dict) -> bool:
    return datetime.now(timezone.utc) > session["expires_at"]


def _touch_session(session: dict):
    session["last_access"] = datetime.now(timezone.utc)


def _append_query(url: str, query_string: str) -> str:
    if not query_string:
        return url
    joiner = "&" if "?" in url else "?"
    return f"{url}{joiner}{query_string}"


def _is_login_page_url(url: str, login_url: str) -> bool:
    """Heuristic to detect if a response appears to be a login page again."""
    try:
        current = urlparse(url)
        initial = urlparse(login_url)
        if current.netloc != initial.netloc:
            return False
        path = (current.path or "").lower()
        return any(keyword in path for keyword in ("login", "signin", "auth"))
    except Exception:
        return False


def _resolve_credentials(tool: dict) -> dict:
    """
    Resolve backend login credentials.
    Priority:
      1) tool.credentials from database
      2) Google Secret Manager fallback
    """
    db_creds = tool.get("credentials") or {}
    login_url = db_creds.get("login_url") or tool.get("url")
    username = db_creds.get("username")
    password = db_creds.get("password")
    username_field = db_creds.get("username_field") or "username"
    password_field = db_creds.get("password_field") or "password"

    if username and password and login_url:
        return {
            "login_url": login_url,
            "username": username,
            "password": password,
            "username_field": username_field,
            "password_field": password_field,
        }

    # Fallback to Secret Manager to support legacy credential storage.
    normalized_name = normalize_tool_name(tool.get("name", ""))
    try:
        secret_creds = secret_manager.get_tool_credentials(normalized_name)
        secret_user = secret_creds.get("username")
        secret_pass = secret_creds.get("password")
        if secret_user and secret_pass and login_url:
            return {
                "login_url": login_url,
                "username": secret_user,
                "password": secret_pass,
                "username_field": username_field,
                "password_field": password_field,
            }
    except Exception:
        pass

    raise HTTPException(
        status_code=400,
        detail="Tool credentials are not configured for strict backend login"
    )


def _get_session_or_raise(session_token: str) -> dict:
    session_hash = _hash_token(session_token)
    session = gateway_sessions.get(session_hash)
    if not session:
        raise HTTPException(status_code=403, detail="Gateway session is invalid or expired")
    if _is_expired(session):
        del gateway_sessions[session_hash]
        raise HTTPException(status_code=403, detail="Gateway session has expired")
    return session


@router.post("/start/{tool_id}")
async def start_gateway_session(tool_id: str, current_user: dict = Depends(get_current_user)):
    """
    Strict backend mode:
    1) Backend logs in to tool using stored credentials (Playwright)
    2) Backend stores authenticated cookies in gateway session
    3) Browser only opens proxied authenticated session URL
    """
    db = await get_db()

    try:
        obj_id = ObjectId(tool_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tool ID")

    tool = await db.tools.find_one({"_id": obj_id})
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    if current_user.get("role") != "Super Administrator":
        user_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        allowed_tools = user_data.get("allowed_tools", []) if user_data else []
        if tool_id not in allowed_tools:
            raise HTTPException(status_code=403, detail="Access denied")

    creds = _resolve_credentials(tool)
    login_url = creds["login_url"]

    # Backend performs login; user never sees this process.
    login_result = await server_login_to_tool(
        login_url=login_url,
        username=creds["username"],
        password=creds["password"],
        username_field=creds["username_field"],
        password_field=creds["password_field"],
        tool_name=tool.get("name", "Tool"),
        timeout=45000,
    )

    if not login_result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"Backend login failed: {login_result.get('error', 'Unknown error')}"
        )

    final_url = login_result.get("final_url") or login_url
    if _is_login_page_url(final_url, login_url):
        raise HTTPException(
            status_code=502,
            detail="Backend login did not complete successfully (still on login page)"
        )

    cookie_store = {}
    for cookie in login_result.get("cookies", []):
        name = cookie.get("name")
        if name:
            cookie_store[name] = cookie.get("value", "")

    session_token = secrets.token_urlsafe(32)
    session_hash = _hash_token(session_token)

    gateway_sessions[session_hash] = {
        "tool_id": tool_id,
        "tool_name": tool.get("name"),
        "base_url": _build_base_url(login_url),
        "login_url": login_url,
        "final_url": final_url,
        "user_id": current_user["id"],
        "user_email": current_user["email"],
        "cookies": cookie_store,
        "logged_in": True,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + SESSION_TIMEOUT,
        "last_access": datetime.now(timezone.utc),
    }

    await db.activity_logs.insert_one({
        "user_email": current_user["email"],
        "user_name": current_user.get("name", current_user["email"]),
        "action": "Started Strict Backend Session",
        "target": tool.get("name"),
        "details": f"Backend-authenticated gateway access to {tool.get('name')}",
        "activity_type": "access",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {
        "success": True,
        "session_token": session_token,
        "gateway_url": f"/api/gateway/view/{session_token}",
        "tool_name": tool.get("name"),
        "strict_backend_mode": True,
        "expires_in": SESSION_TIMEOUT.seconds,
    }


@router.get("/view/{session_token}")
async def view_tool_gateway(session_token: str):
    """
    Entry endpoint for authenticated gateway sessions.
    Redirects directly to proxy with backend-authenticated cookies.
    """
    try:
        session = _get_session_or_raise(session_token)
    except HTTPException as exc:
        return HTMLResponse(get_error_html("Session Error", exc.detail), status_code=exc.status_code)

    _touch_session(session)
    return RedirectResponse(url=f"/api/gateway/proxy/{session_token}/", status_code=status.HTTP_302_FOUND)


def _rewrite_html_for_proxy(html: str, session_token: str, base_url: str) -> str:
    """
    Rewrite links/resources/forms so navigation stays inside our gateway proxy.
    """
    parsed = urlparse(base_url)
    base_domain = f"{parsed.scheme}://{parsed.netloc}"
    proxy_prefix = f"/api/gateway/proxy/{session_token}"

    # Absolute links to tool domain.
    html = html.replace(f'href="{base_domain}', f'href="{proxy_prefix}')
    html = html.replace(f"href='{base_domain}", f"href='{proxy_prefix}")
    html = html.replace(f'src="{base_domain}', f'src="{proxy_prefix}')
    html = html.replace(f"src='{base_domain}", f"src='{proxy_prefix}")
    html = html.replace(f'action="{base_domain}', f'action="{proxy_prefix}')
    html = html.replace(f"action='{base_domain}", f"action='{proxy_prefix}")

    # Root-relative links (e.g., href="/dashboard").
    root_relative = re.compile(r"""(href|src|action)=(['"])/(?!api/gateway/proxy/)""", re.IGNORECASE)
    return root_relative.sub(rf"\1=\2{proxy_prefix}/", html)


@router.get("/proxy/{session_token}/{path:path}")
@router.post("/proxy/{session_token}/{path:path}")
async def proxy_tool_request(session_token: str, path: str = "", request: Request = None):
    """Proxy authenticated requests to tool using backend-managed cookies."""
    try:
        session = _get_session_or_raise(session_token)
    except HTTPException as exc:
        return HTMLResponse(get_error_html("Session Error", exc.detail), status_code=exc.status_code)

    _touch_session(session)

    if path:
        target_url = urljoin(session["base_url"].rstrip("/") + "/", path)
    else:
        target_url = session.get("final_url") or session["base_url"]

    query_string = str(request.query_params) if request and request.query_params else ""
    target_url = _append_query(target_url, query_string)

    method = (request.method if request else "GET").upper()
    request_headers = request.headers if request else {}
    upstream_headers = {
        "User-Agent": request_headers.get(
            "user-agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        ),
        "Accept": request_headers.get("accept", "*/*"),
        "Accept-Language": request_headers.get("accept-language", "en-US,en;q=0.9"),
    }
    content_type = request_headers.get("content-type")
    if content_type:
        upstream_headers["Content-Type"] = content_type

    timeout = aiohttp.ClientTimeout(total=45)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as http_session:
            if method == "POST":
                body = await request.body()
                async with http_session.post(
                    target_url,
                    data=body,
                    headers=upstream_headers,
                    cookies=session.get("cookies", {}),
                    allow_redirects=True,
                ) as upstream_resp:
                    payload = await upstream_resp.read()
                    final_url = str(upstream_resp.url)
                    resp_content_type = upstream_resp.headers.get("Content-Type", "text/html")
                    resp_status = upstream_resp.status
                    for cookie in upstream_resp.cookies.values():
                        session["cookies"][cookie.key] = cookie.value
            else:
                async with http_session.get(
                    target_url,
                    headers=upstream_headers,
                    cookies=session.get("cookies", {}),
                    allow_redirects=True,
                ) as upstream_resp:
                    payload = await upstream_resp.read()
                    final_url = str(upstream_resp.url)
                    resp_content_type = upstream_resp.headers.get("Content-Type", "text/html")
                    resp_status = upstream_resp.status
                    for cookie in upstream_resp.cookies.values():
                        session["cookies"][cookie.key] = cookie.value

        # If auth is lost, do not expose raw tool login page in browser.
        if _is_login_page_url(final_url, session["login_url"]):
            return HTMLResponse(
                get_error_html(
                    "Session Reauthentication Required",
                    "Secure backend session ended. Please return to dashboard and open the tool again."
                ),
                status_code=440
            )

        session["final_url"] = final_url

        if "text/html" in resp_content_type:
            html = payload.decode("utf-8", errors="ignore")
            html = _rewrite_html_for_proxy(html, session_token, session["base_url"])
            return Response(content=html.encode("utf-8"), media_type="text/html", status_code=resp_status)

        return Response(content=payload, media_type=resp_content_type, status_code=resp_status)
    except Exception as exc:
        return HTMLResponse(
            get_error_html("Gateway Error", f"Failed to load tool through secure gateway: {str(exc)}"),
            status_code=500
        )


@router.delete("/session/{session_token}")
async def end_gateway_session(session_token: str, current_user: dict = Depends(get_current_user)):
    """Explicitly end a strict backend gateway session."""
    session_hash = _hash_token(session_token)
    if session_hash in gateway_sessions:
        del gateway_sessions[session_hash]
    return {"message": "Session ended"}


def get_error_html(title: str, message: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>
    body {{
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0f172a;
      color: white;
      margin: 0;
      text-align: center;
      padding: 24px;
    }}
    .box {{
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      max-width: 560px;
      padding: 36px;
    }}
    h1 {{ margin: 0 0 12px 0; font-size: 24px; }}
    p {{ margin: 0; color: #cbd5e1; line-height: 1.5; }}
    a {{
      margin-top: 20px;
      display: inline-block;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
    }}
    a:hover {{ background: #2563eb; }}
  </style>
</head>
<body>
  <div class="box">
    <h1>{title}</h1>
    <p>{message}</p>
    <a href="/">Return to Dashboard</a>
  </div>
</body>
</html>"""
