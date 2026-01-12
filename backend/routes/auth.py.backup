from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from models.schemas import LoginRequest, TokenResponse
from utils.security import verify_password, create_access_token, decode_token, hash_password
from utils.email_service import send_otp_email
from database import get_db
from bson import ObjectId
from pydantic import BaseModel
import random
import string
import os
import httpx
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

router = APIRouter()
security = HTTPBearer()

# Google OAuth settings
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "https://portal.dsgtransport.net/api/auth/google/callback")

class OTPRequest(BaseModel):
    email: str
    otp: str
    temp_token: str

class InitiateLoginRequest(BaseModel):
    email: str
    password: str

class CheckPasswordAccessRequest(BaseModel):
    email: str

# Generate 6-digit OTP
def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

# Create temporary token for OTP flow
def create_temp_token(user_id: str, email: str):
    from utils.security import create_access_token
    from datetime import timedelta
    token_data = {
        "sub": user_id,
        "email": email,
        "type": "otp_pending"
    }
    # Short-lived token for OTP verification (5 minutes)
    return create_access_token(token_data, expires_delta=timedelta(minutes=5))

@router.post("/check-password-access")
async def check_password_access(request: CheckPasswordAccessRequest):
    """
    Check if an email has password login enabled.
    Returns whether the user can use email/password login.
    """
    db = await get_db()
    
    email = request.email.lower().strip()
    
    # Find user by email
    user = await db.users.find_one({"email": email})
    
    if not user:
        # Don't reveal if user exists or not for security
        return {
            "password_login_enabled": False,
            "message": "Please use Google SSO to login"
        }
    
    # Super Admin always has password login enabled
    SUPER_ADMIN_EMAIL = "info@dsgtransport.net"
    if email == SUPER_ADMIN_EMAIL:
        return {
            "password_login_enabled": True,
            "message": "Password login available"
        }
    
    # Check if password login is enabled for this user
    password_login_enabled = user.get("password_login_enabled", False)
    
    if password_login_enabled:
        return {
            "password_login_enabled": True,
            "message": "Password login available"
        }
    else:
        return {
            "password_login_enabled": False,
            "message": "Please use Google SSO to login"
        }

@router.post("/login")
async def login(request: LoginRequest):
    """
    Login flow for users with password login enabled:
    1. Super Admin (info@dsgtransport.net) always has password login
    2. Other users need password_login_enabled = true (set by Super Admin)
    3. If user has 2SV enabled -> return temp_token and send OTP
    4. If user doesn't have 2SV enabled -> return access_token directly
    """
    db = await get_db()
    
    email = request.email.lower().strip()
    SUPER_ADMIN_EMAIL = "info@dsgtransport.net"
    
    # Find user by email
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if password login is allowed for this user
    is_super_admin = email == SUPER_ADMIN_EMAIL
    password_login_enabled = user.get("password_login_enabled", False)
    
    if not is_super_admin and not password_login_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password login not enabled for this account. Please use Google SSO or contact your administrator."
        )
    
    # Verify password
    if not user.get("password") or not verify_password(request.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if user is suspended
    if user.get("status") == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact administrator."
        )
    
    # Check if 2SV is enabled for this user
    two_sv_enabled = user.get("two_sv_enabled", False)
    
    if two_sv_enabled:
        # Generate OTP and send email
        otp = generate_otp()
        otp_expires = datetime.now(timezone.utc) + timedelta(minutes=5)
        
        # Store OTP in database
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "pending_otp": otp,
                "otp_expires": otp_expires.isoformat()
            }}
        )
        
        # Send OTP via email
        try:
            await send_otp_email(user["email"], user["name"], otp)
        except Exception as e:
            print(f"Failed to send OTP email: {e}")
            # For now, continue (in production, you might want to fail here)
        
        # Return temp token (not full access)
        temp_token = create_temp_token(str(user["_id"]), user["email"])
        
        return {
            "requires_otp": True,
            "temp_token": temp_token,
            "message": f"OTP sent to {user['email']}"
        }
    
    # No 2SV - direct login
    token_data = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"]
    }
    access_token = create_access_token(token_data)
    
    # Update last active
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_active": "Just now"}}
    )
    
    # Return user info (without password)
    user_response = {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": user.get("status", "Active"),
        "access_level": user.get("access_level", "standard"),
        "initials": user.get("initials", user["name"][:2].upper()),
        "joined_date": user.get("created_at", "")
    }
    
    return {
        "requires_otp": False,
        "access_token": access_token,
        "user": user_response
    }

@router.post("/verify-otp")
async def verify_otp(request: OTPRequest):
    """Verify OTP and complete login"""
    db = await get_db()
    
    # Decode temp token
    payload = decode_token(request.temp_token)
    if not payload or payload.get("type") != "otp_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification session"
        )
    
    # Find user
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Check OTP
    stored_otp = user.get("pending_otp")
    otp_expires = user.get("otp_expires")
    
    if not stored_otp or stored_otp != request.otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP code"
        )
    
    # Check if OTP expired
    if otp_expires:
        expiry_time = datetime.fromisoformat(otp_expires.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expiry_time:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OTP has expired. Please request a new one."
            )
    
    # Clear OTP
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$unset": {"pending_otp": "", "otp_expires": ""}}
    )
    
    # Create full access token
    token_data = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"]
    }
    access_token = create_access_token(token_data)
    
    # Update last active
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_active": "Just now"}}
    )
    
    # Return user info
    user_response = {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": user.get("status", "Active"),
        "access_level": user.get("access_level", "standard"),
        "initials": user.get("initials", user["name"][:2].upper()),
        "joined_date": user.get("created_at", "")
    }
    
    return {
        "access_token": access_token,
        "user": user_response
    }

@router.post("/resend-otp")
async def resend_otp(temp_token: str):
    """Resend OTP to user's email"""
    db = await get_db()
    
    # Decode temp token
    payload = decode_token(temp_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid verification session"
        )
    
    # Find user
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Generate new OTP
    otp = generate_otp()
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Store OTP
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "pending_otp": otp,
            "otp_expires": otp_expires.isoformat()
        }}
    )
    
    # Send OTP
    try:
        await send_otp_email(user["email"], user["name"], otp)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send OTP: {str(e)}"
        )
    
    return {"message": f"OTP resent to {user['email']}"}

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    # Reject OTP pending tokens
    if payload.get("type") == "otp_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please complete 2-step verification"
        )
    
    db = await get_db()
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if user.get("status") == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended"
        )
    
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": user.get("status", "Active"),
        "access_level": user.get("access_level", "standard"),
        "initials": user.get("initials", user["name"][:2].upper()),
        "two_sv_enabled": user.get("two_sv_enabled", False)
    }

async def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency to require admin role (includes Super Admin)"""
    if current_user["role"] not in ["Administrator", "Super Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

async def require_super_admin(current_user: dict = Depends(get_current_user)):
    """Dependency to require super admin role"""
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required"
        )
    return current_user

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user (client should discard token)"""
    return {"message": "Logged out successfully"}


# ============ DIRECT GOOGLE OAUTH ============

@router.get("/google/login")
async def google_login(request: Request):
    """
    Initiate direct Google OAuth login.
    Redirects user to Google's login page.
    """
    # Get the redirect URI from request or use default
    redirect_uri = GOOGLE_REDIRECT_URI
    
    # For preview environment, use the preview URL
    host = request.headers.get("host", "")
    if "preview" in host or "localhost" in host:
        redirect_uri = f"https://{host}/api/auth/google/callback"
    
    # Build Google OAuth URL
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account"
    }
    
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(request: Request, code: str = None, error: str = None):
    """
    Handle Google OAuth callback.
    Exchanges code for tokens and creates user session.
    """
    db = await get_db()
    
    # Get the host for redirect URI
    host = request.headers.get("host", "")
    origin = request.headers.get("origin", "")
    
    # Determine environment
    if "preview" in host or "localhost" in host:
        redirect_uri = f"https://{host}/api/auth/google/callback"
        frontend_url = f"https://{host}"
    else:
        redirect_uri = GOOGLE_REDIRECT_URI
        frontend_url = "https://portal.dsgtransport.net"
    
    print(f"[Google OAuth] Callback received - host: {host}, redirect_uri: {redirect_uri}")
    
    if error:
        print(f"[Google OAuth] Error from Google: {error}")
        return RedirectResponse(url=f"{frontend_url}/login?error={error}")
    
    if not code:
        print("[Google OAuth] No code received")
        return RedirectResponse(url=f"{frontend_url}/login?error=no_code")
    
    try:
        print(f"[Google OAuth] Exchanging code for token...")
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            
            print(f"[Google OAuth] Token response status: {token_response.status_code}")
            
            if token_response.status_code != 200:
                error_data = token_response.json()
                print(f"[Google OAuth] Token error: {error_data}")
                error_msg = error_data.get("error_description", "token_exchange_failed")
                return RedirectResponse(url=f"{frontend_url}/login?error={error_msg}")
            
            tokens = token_response.json()
            access_token = tokens.get("access_token")
            
            # Get user info from Google
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if userinfo_response.status_code != 200:
                return RedirectResponse(url=f"{frontend_url}/login?error=userinfo_failed")
            
            google_user = userinfo_response.json()
    
    except Exception as e:
        print(f"Google OAuth error: {e}")
        return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")
    
    # Extract Google user info
    google_email = google_user.get("email", "").lower()
    google_name = google_user.get("name", "")
    google_picture = google_user.get("picture", "")
    
    if not google_email:
        return RedirectResponse(url=f"{frontend_url}/login?error=no_email")
    
    # Find existing user by email
    user = await db.users.find_one({"email": google_email})
    
    if not user:
        return RedirectResponse(url=f"{frontend_url}/login?error=no_account&email={google_email}")
    
    # Check if user is suspended
    if user.get("status") == "Suspended":
        return RedirectResponse(url=f"{frontend_url}/login?error=suspended")
    
    # Update user's picture if provided
    if google_picture and google_picture != user.get("picture"):
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"picture": google_picture}}
        )
    
    # Create JWT token
    token_data = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"]
    }
    jwt_token = create_access_token(token_data)
    
    # Update last active
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_active": "Just now"}}
    )
    
    # Redirect to frontend with token in URL hash (secure way)
    return RedirectResponse(url=f"{frontend_url}/#token={jwt_token}")


# ============ EMERGENT GOOGLE OAUTH (Legacy) ============

class GoogleSessionRequest(BaseModel):
    session_id: str

@router.post("/google/session")
async def google_oauth_session(request: GoogleSessionRequest):
    """
    Process Google OAuth session from Emergent Auth.
    (Legacy - kept for backward compatibility)
    Verifies the Google email matches an existing user account.
    """
    db = await get_db()
    
    # Verify session with Emergent Auth
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id},
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired session"
                )
            
            google_data = response.json()
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to verify Google session: {str(e)}"
            )
    
    # Extract Google user info
    google_email = google_data.get("email", "").lower()
    google_name = google_data.get("name", "")
    google_picture = google_data.get("picture", "")
    
    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email returned from Google"
        )
    
    # Find existing user by email
    user = await db.users.find_one({"email": google_email})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No account found for {google_email}. Please contact your administrator to create an account."
        )
    
    # Check if user is suspended
    if user.get("status") == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact administrator."
        )
    
    # Update user's picture if provided
    if google_picture and google_picture != user.get("picture"):
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"picture": google_picture}}
        )
    
    # Create JWT token (bypasses 2SV since Google already verified identity)
    token_data = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"]
    }
    access_token = create_access_token(token_data)
    
    # Update last active
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_active": "Just now"}}
    )
    
    # Return user info
    user_response = {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": user.get("status", "Active"),
        "access_level": user.get("access_level", "standard"),
        "initials": user.get("initials", user["name"][:2].upper()),
        "joined_date": user.get("created_at", ""),
        "picture": google_picture or user.get("picture", "")
    }
    
    return {
        "access_token": access_token,
        "user": user_response,
        "login_method": "google"
    }



# ============ FORGOT PASSWORD ============

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Send password reset email to user.
    Generates a reset token and sends it via email.
    """
    from utils.email_service import send_email, is_email_configured
    from utils.security import hash_password
    import secrets
    
    db = await get_db()
    
    # Find user by email
    user = await db.users.find_one({"email": request.email.lower()})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a reset link has been sent."}
    
    # Generate reset token (valid for 1 hour)
    reset_token = secrets.token_urlsafe(32)
    reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token in database
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires": reset_expires.isoformat()
        }}
    )
    
    # Get frontend URL from environment
    frontend_url = os.environ.get("FRONTEND_URL", "https://portal.dsgtransport.net")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    # Send email
    if is_email_configured():
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #1a73e8 0%, #0d5bca 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: #1a73e8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Password Reset</h1>
                </div>
                <div class="content">
                    <p>Hi {user['name']},</p>
                    <p>We received a request to reset your password for your DSG Transport portal account.</p>
                    <p>Click the button below to reset your password:</p>
                    <p style="text-align: center;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #1a73e8;">{reset_link}</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this, please ignore this email or contact your administrator.</p>
                </div>
                <div class="footer">
                    <p>DSG Transport LLC - Secure Credential Management</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        send_email(
            to_email=user["email"],
            subject="🔐 Reset Your DSG Transport Password",
            html_content=html_content
        )
    
    return {"message": "If an account exists with this email, a reset link has been sent."}

@router.post("/reset-password")
async def reset_password_with_token(request: ResetPasswordRequest):
    """
    Reset password using the token sent via email.
    """
    from utils.security import hash_password
    
    db = await get_db()
    
    # Find user with this reset token
    user = await db.users.find_one({"reset_token": request.token})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Check if token is expired
    token_expires = user.get("reset_token_expires")
    if token_expires:
        expiry_time = datetime.fromisoformat(token_expires.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expiry_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token has expired. Please request a new one."
            )
    
    # Update password and clear reset token
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password": hash_password(request.new_password),
                "plain_password": request.new_password  # For Super Admin viewing
            },
            "$unset": {
                "reset_token": "",
                "reset_token_expires": ""
            }
        }
    )
    
    return {"message": "Password has been reset successfully. You can now login with your new password."}

@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """
    Change password for logged-in user.
    Requires current password for verification.
    """
    from utils.security import hash_password
    
    db = await get_db()
    
    # Get full user record with password
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify current password
    if not verify_password(request.current_password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Update password
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password": hash_password(request.new_password),
            "plain_password": request.new_password  # For Super Admin viewing
        }}
    )
    
    return {"message": "Password changed successfully"}

