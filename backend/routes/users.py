from fastapi import APIRouter, Depends, HTTPException, status, Query
from models.schemas import UserCreate, UserUpdate, UserResponse, UserStatus
from utils.security import hash_password
from utils.email_service import send_invitation_email, is_email_configured
from database import get_db
from routes.auth import get_current_user, require_admin
from bson import ObjectId
from typing import List
import os

router = APIRouter()

# Get frontend URL for email links
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://dsg-portal.preview.emergentagent.com")

@router.get("", response_model=List[dict])
async def get_users(current_user: dict = Depends(require_admin)):
    """Get all users (admin only)"""
    db = await get_db()
    
    users = []
    async for user in db.users.find():
        users.append({
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "status": user.get("status", "Active"),
            "access_level": user.get("access_level", "standard"),
            "initials": user.get("initials", user["name"][:2].upper()),
            "last_active": user.get("last_active", "Never"),
            "created_at": user.get("created_at", "")
        })
    
    return users

@router.post("", response_model=dict)
async def create_user(
    user_data: UserCreate, 
    send_email: bool = Query(False, description="Send invitation email to user"),
    current_user: dict = Depends(require_admin)
):
    """Create a new user (admin only)"""
    db = await get_db()
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Store plain password for email before hashing
    plain_password = user_data.password
    
    # Create user
    initials = "".join([n[0].upper() for n in user_data.name.split()[:2]])
    new_user = {
        "email": user_data.email.lower(),
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role.value,
        "status": user_data.status.value,
        "access_level": user_data.access_level.value,
        "initials": initials,
        "created_at": "2025-12-21T00:00:00Z",
        "last_active": "Never"
    }
    
    result = await db.users.insert_one(new_user)
    user_id = str(result.inserted_id)
    
    # Send invitation email if requested
    email_sent = False
    if send_email:
        email_sent = send_invitation_email(
            to_email=user_data.email.lower(),
            user_name=user_data.name,
            password=plain_password,
            login_url=FRONTEND_URL
        )
    
    return {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name,
        "role": user_data.role.value,
        "status": user_data.status.value,
        "access_level": user_data.access_level.value,
        "initials": initials,
        "created_at": "2025-12-21T00:00:00Z",
        "last_active": "Never",
        "email_sent": email_sent
    }

@router.get("/{user_id}", response_model=dict)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user by ID"""
    db = await get_db()
    
    # Users can only view themselves unless admin
    if current_user["role"] != "Administrator" and current_user["id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": user.get("status", "Active"),
        "access_level": user.get("access_level", "standard"),
        "initials": user.get("initials", user["name"][:2].upper()),
        "last_active": user.get("last_active", "Never"),
        "created_at": user.get("created_at", "")
    }

@router.put("/{user_id}", response_model=dict)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_admin)):
    """Update user (admin only)"""
    db = await get_db()
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Build update dict
    update_data = {}
    if user_data.name is not None:
        update_data["name"] = user_data.name
        update_data["initials"] = "".join([n[0].upper() for n in user_data.name.split()[:2]])
    if user_data.role is not None:
        update_data["role"] = user_data.role.value
    if user_data.status is not None:
        update_data["status"] = user_data.status.value
    if user_data.access_level is not None:
        update_data["access_level"] = user_data.access_level.value
    
    if update_data:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
    
    # Get updated user
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": user.get("status", "Active"),
        "access_level": user.get("access_level", "standard"),
        "initials": user.get("initials", user["name"][:2].upper()),
        "last_active": user.get("last_active", "Never"),
        "created_at": user.get("created_at", "")
    }

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Delete user (admin only)"""
    db = await get_db()
    
    # Can't delete yourself
    if current_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete user's credentials too
    await db.credentials.delete_many({"user_id": user_id})
    await db.users.delete_one({"_id": ObjectId(user_id)})
    
    return {"message": "User deleted successfully"}

@router.post("/{user_id}/resend-invitation")
async def resend_invitation(user_id: str, current_user: dict = Depends(require_admin)):
    """Resend invitation email (admin only)"""
    db = await get_db()
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # In production, send actual email here
    return {"message": f"Invitation resent to {user['email']}"}

@router.post("/{user_id}/suspend")
async def suspend_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Suspend user (admin only)"""
    db = await get_db()
    
    if current_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend your own account"
        )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "Suspended"}}
    )
    
    return {"message": "User suspended"}

@router.post("/{user_id}/reactivate")
async def reactivate_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Reactivate suspended user (admin only)"""
    db = await get_db()
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "Active"}}
    )
    
    return {"message": "User reactivated"}
