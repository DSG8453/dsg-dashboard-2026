from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.schemas import LoginRequest, TokenResponse
from utils.security import verify_password, create_access_token, decode_token
from database import get_db
from bson import ObjectId

router = APIRouter()
security = HTTPBearer()

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate user and return JWT token"""
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
    
    # Create access token
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
    
    return TokenResponse(
        access_token=access_token,
        user=user_response
    )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
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
        "initials": user.get("initials", user["name"][:2].upper())
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
