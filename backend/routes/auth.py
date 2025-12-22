from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.schemas import LoginRequest, TokenResponse
from utils.security import verify_password, create_access_token, decode_token
from utils.email_service import send_otp_email
from database import get_db
from bson import ObjectId
from pydantic import BaseModel
import random
import string
from datetime import datetime, timezone, timedelta

router = APIRouter()
security = HTTPBearer()

class OTPRequest(BaseModel):
    email: str
    otp: str
    temp_token: str

class InitiateLoginRequest(BaseModel):
    email: str
    password: str

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

@router.post("/login")
async def login(request: LoginRequest):
    """
    Login flow:
    1. If user has 2SV enabled -> return temp_token and send OTP
    2. If user doesn't have 2SV enabled -> return access_token directly
    """
    db = await get_db()
    
    # Find user by email
    user = await db.users.find_one({"email": request.email.lower()})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(request.password, user["password"]):
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
    
    # Super Admin always requires 2SV
    if user.get("role") == "Super Administrator":
        two_sv_enabled = True
    
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
