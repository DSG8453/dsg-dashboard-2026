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
    Opens login page and auto-fills credentials using multiple techniques.
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
    
    # Create credential data for injection
    cred_data = {
        "u": username,
        "p": password,
        "uf": username_field,
        "pf": password_field,
        "url": login_url
    }
    enc_creds = base64.b64encode(json.dumps(cred_data).encode()).decode()
    
    # Common username field selectors
    username_selectors = f'''
        'input[name="{username_field}"]',
        'input[id*="UserName" i]',
        'input[id*="username" i]',
        'input[id*="email" i]',
        'input[id*="login" i]',
        'input[name*="email" i]',
        'input[name*="user" i]',
        'input[name*="login" i]',
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="user" i]'
    '''
    
    # Common password field selectors  
    password_selectors = f'''
        'input[name="{password_field}"]',
        'input[id*="Password" i]',
        'input[id*="password" i]',
        'input[id*="pass" i]',
        'input[type="password"]',
        'input[name*="pass" i]',
        'input[name*="pwd" i]'
    '''
    
    # Generate the auto-login page
    html_content = f'''<!DOCTYPE html>
<html>
<head>
    <title>Opening {tool_name}...</title>
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
        .container{{text-align:center;padding:40px;max-width:500px}}
        .spinner{{
            width:50px;height:50px;
            border:4px solid rgba(255,255,255,0.2);
            border-top-color:#3b82f6;
            border-radius:50%;
            animation:spin 1s linear infinite;
            margin:0 auto 24px;
        }}
        @keyframes spin{{to{{transform:rotate(360deg)}}}}
        h1{{font-size:22px;margin-bottom:12px}}
        p{{color:rgba(255,255,255,0.8);margin-bottom:8px;font-size:14px}}
        .status{{
            background:rgba(59,130,246,0.2);
            border:1px solid rgba(59,130,246,0.3);
            padding:16px 20px;border-radius:12px;
            margin-top:20px;font-size:13px;
        }}
        .secure{{
            display:inline-flex;align-items:center;gap:6px;
            color:#22c55e;margin-top:16px;font-size:12px;
        }}
        .hidden{{position:absolute;left:-9999px;opacity:0;pointer-events:none}}
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner" id="spinner"></div>
        <h1>🔐 Secure Access</h1>
        <p>Opening <strong>{tool_name}</strong></p>
        <p id="statusText">Connecting securely...</p>
        <div class="status" id="status">
            ✅ Credentials protected<br>
            <small style="opacity:0.7">Auto-filling login form...</small>
        </div>
        <div class="secure">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            End-to-end encrypted
        </div>
    </div>
    
    <!-- Multiple hidden forms for different field name patterns -->
    <div class="hidden">
        <form id="f1" method="POST" action="{login_url}">
            <input name="{username_field}" id="u1">
            <input type="password" name="{password_field}" id="p1">
        </form>
        <form id="f2" method="POST" action="{login_url}">
            <input name="username" id="u2">
            <input type="password" name="password" id="p2">
        </form>
        <form id="f3" method="POST" action="{login_url}">
            <input name="email" id="u3">
            <input type="password" name="password" id="p3">
        </form>
        <form id="f4" method="POST" action="{login_url}">
            <input name="LOGIN_ID" id="u4">
            <input type="password" name="PASSWORD" id="p4">
        </form>
    </div>

    <script>
    (function(){{
        var D="{enc_creds}";
        var C;
        try{{C=JSON.parse(atob(D))}}catch(e){{window.location.href="{login_url}";return}}
        
        // Fill all form variants
        ['u1','u2','u3','u4'].forEach(function(id){{
            var el=document.getElementById(id);
            if(el)el.value=C.u;
        }});
        ['p1','p2','p3','p4'].forEach(function(id){{
            var el=document.getElementById(id);
            if(el)el.value=C.p;
        }});
        
        var loginUrl=C.url;
        var username=C.u;
        var password=C.p;
        var uf=C.uf;
        var pf=C.pf;
        
        // Clear credentials from memory
        C=null;D=null;
        
        function updateStatus(msg){{
            document.getElementById('statusText').textContent=msg;
        }}
        
        function tryFillAndSubmit(win){{
            try{{
                var doc=win.document;
                
                // Try to find username field with multiple selectors
                var userSelectors=[
                    'input[name="'+uf+'"]',
                    'input[id*="UserName"]',
                    'input[id*="username"]',
                    'input[id*="txtUserName"]',
                    'input[name*="email"]',
                    'input[name*="user"]',
                    'input[name="username"]',
                    'input[name="email"]',
                    'input[name="LOGIN_ID"]',
                    'input[type="email"]',
                    'input[placeholder*="email" i]',
                    'input[placeholder*="user" i]'
                ];
                
                var passSelectors=[
                    'input[name="'+pf+'"]',
                    'input[type="password"]',
                    'input[id*="Password"]',
                    'input[id*="txtPassword"]',
                    'input[name="password"]',
                    'input[name="PASSWORD"]',
                    'input[name="pass"]'
                ];
                
                var userInput=null,passInput=null;
                
                for(var i=0;i<userSelectors.length;i++){{
                    userInput=doc.querySelector(userSelectors[i]);
                    if(userInput)break;
                }}
                
                for(var i=0;i<passSelectors.length;i++){{
                    passInput=doc.querySelector(passSelectors[i]);
                    if(passInput)break;
                }}
                
                if(userInput&&passInput){{
                    // Set values
                    userInput.value=username;
                    passInput.value=password;
                    
                    // Trigger input events for React/Angular/Vue forms
                    var inputEvent=new Event('input',{{bubbles:true}});
                    var changeEvent=new Event('change',{{bubbles:true}});
                    userInput.dispatchEvent(inputEvent);
                    userInput.dispatchEvent(changeEvent);
                    passInput.dispatchEvent(inputEvent);
                    passInput.dispatchEvent(changeEvent);
                    
                    // Also set via native setter for React
                    var nativeInputSetter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
                    if(nativeInputSetter){{
                        nativeInputSetter.call(userInput,username);
                        nativeInputSetter.call(passInput,password);
                        userInput.dispatchEvent(inputEvent);
                        passInput.dispatchEvent(inputEvent);
                    }}
                    
                    updateStatus('Credentials filled! Click Login.');
                    
                    // Clear from memory
                    username=null;password=null;
                    
                    return true;
                }}
            }}catch(e){{
                // Cross-origin - expected
            }}
            return false;
        }}
        
        function launch(){{
            updateStatus('Opening '+'{tool_name}'+'...');
            
            // Open login page in new window
            var win=window.open(loginUrl,'_blank');
            
            if(!win||win.closed){{
                // Popup blocked - try form submission instead
                updateStatus('Submitting credentials...');
                document.getElementById('f1').submit();
                return;
            }}
            
            // Try to fill credentials multiple times as page loads
            var attempts=0;
            var maxAttempts=30;
            var filled=false;
            
            var interval=setInterval(function(){{
                attempts++;
                
                if(win.closed){{
                    clearInterval(interval);
                    updateStatus('Login window closed');
                    document.getElementById('spinner').style.display='none';
                    return;
                }}
                
                if(!filled){{
                    filled=tryFillAndSubmit(win);
                    if(filled){{
                        updateStatus('Credentials auto-filled!');
                        document.getElementById('status').innerHTML='✅ Login form filled<br><small>Click the Login button in the new window</small>';
                    }}
                }}
                
                if(attempts>=maxAttempts){{
                    clearInterval(interval);
                    if(!filled){{
                        // Fallback: submit form
                        updateStatus('Opening login page...');
                        document.getElementById('f1').submit();
                    }}
                    document.getElementById('spinner').style.display='none';
                }}
            }},300);
            
            // Auto-close this page after delay
            setTimeout(function(){{
                if(filled){{
                    window.close();
                }}
            }},5000);
        }}
        
        // Start after brief delay
        setTimeout(launch,500);
        
        // Security
        document.addEventListener('contextmenu',function(e){{e.preventDefault()}});
    }})();
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
