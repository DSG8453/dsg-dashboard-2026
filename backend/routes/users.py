from fastapi import APIRouter, Depends, HTTPException, status, Query
from models.schemas import UserCreate, UserUpdate, UserResponse, UserStatus
from utils.security import hash_password
from utils.email_service import send_sso_invitation_email, is_email_configured
from database import get_db
from routes.auth import get_current_user, require_admin
from routes.activity_logs import log_activity
from models.activity_log import ActivityType
from bson import ObjectId
from typing import List
from datetime import datetime, timezone
from pydantic import BaseModel
from utils.websocket_manager import notify_tool_access_change, notify_role_changed, notify_user_status_changed
import os
import random
import string

router = APIRouter()

# Get frontend URL for email links - must be set in environment
FRONTEND_URL = os.environ.get("FRONTEND_URL")

@router.get("", response_model=List[dict])
async def get_users(current_user: dict = Depends(require_admin)):
    """Get users based on role:
    - Super Admin: sees ALL users
    - Admin: sees ONLY users assigned to them (and themselves)
    """
    db = await get_db()
    
    is_super_admin = current_user.get("role") == "Super Administrator"
    
    # For Admin, get their assigned users list
    assigned_user_ids = []
    if not is_super_admin:
        admin_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        if admin_data:
            assigned_user_ids = admin_data.get("assigned_users", [])
    
    users = []
    async for user in db.users.find().limit(500):
        user_id = str(user["_id"])
        
        # For Admin: only include themselves and their assigned users
        if not is_super_admin:
            # Include current admin themselves
            if user_id == current_user["id"]:
                pass  # Include self
            # Include only assigned users
            elif user_id not in assigned_user_ids:
                continue  # Skip users not assigned to this admin
        
        users.append({
            "id": user_id,
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "status": user.get("status", "Active"),
            "access_level": user.get("access_level", "standard"),
            "allowed_tools": user.get("allowed_tools", []),  # List of tool IDs user can access
            "assigned_users": user.get("assigned_users", []),  # For Admins: list of user IDs they manage
            "managed_by": user.get("managed_by"),  # For Users: Admin ID who manages them
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
    """Create a new user (admin only) - Google SSO only, no passwords"""
    db = await get_db()
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user - NO PASSWORD (Google SSO only)
    initials = "".join([n[0].upper() for n in user_data.name.split()[:2]])
    now = datetime.now(timezone.utc).isoformat()
    new_user = {
        "email": user_data.email.lower(),
        "name": user_data.name,
        "role": user_data.role.value,
        "status": user_data.status.value,
        "access_level": user_data.access_level.value,
        "initials": initials,
        "created_at": now,
        "last_active": "Never",
        "auth_method": "google_sso"  # Track that this user uses Google SSO
    }
    
    result = await db.users.insert_one(new_user)
    user_id = str(result.inserted_id)
    
    # Send invitation email if requested
    email_sent = False
    if send_email:
        email_sent = send_sso_invitation_email(
            to_email=user_data.email.lower(),
            user_name=user_data.name,
            portal_url=FRONTEND_URL or "https://portal.dsgtransport.net"
        )
    
    return {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name,
        "role": user_data.role.value,
        "status": user_data.status.value,
        "access_level": user_data.access_level.value,
        "initials": initials,
        "created_at": now,
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
    """Delete user (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can delete users
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can delete users"
        )
    
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
    
    # Can't delete other Super Admins or Admins
    if user.get("role") in ["Super Administrator", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete administrators"
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
    
    # Get user info for logging
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if Admin can manage this user
    if current_user["role"] == "Administrator":
        admin_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        assigned_users = admin_data.get("assigned_users", []) if admin_data else []
        if user_id not in assigned_users:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage users assigned to you"
            )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "Suspended"}}
    )
    
    # Log activity - Admin suspended a user
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action="Suspended User",
        target=user.get("name", user["email"]),
        details=f"User {user['email']} was suspended by {current_user['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    return {"message": "User suspended"}

@router.post("/{user_id}/reactivate")
async def reactivate_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Reactivate suspended user (admin only)"""
    db = await get_db()
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if Admin can manage this user
    if current_user["role"] == "Administrator":
        admin_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        assigned_users = admin_data.get("assigned_users", []) if admin_data else []
        if user_id not in assigned_users:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage users assigned to you"
            )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "Active"}}
    )
    
    # Log activity
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action="Reactivated User",
        target=user.get("name", user["email"]),
        details=f"User {user['email']} was reactivated by {current_user['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    return {"message": "User reactivated"}

@router.put("/{user_id}/tool-access")
async def update_tool_access(
    user_id: str, 
    tool_ids: List[str],
    current_user: dict = Depends(require_admin)
):
    """Update user's tool access (admin only - limited to admin's own tools)"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if Admin can manage this user
    if current_user["role"] == "Administrator":
        admin_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        assigned_users = admin_data.get("assigned_users", []) if admin_data else []
        admin_tools = admin_data.get("allowed_tools", []) if admin_data else []
        
        if user_id not in assigned_users:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only assign tools to users assigned to you"
            )
        
        # Admin can only assign tools that are assigned to them
        invalid_tools = [t for t in tool_ids if t not in admin_tools]
        if invalid_tools:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only assign tools that are assigned to you"
            )
    
    # Get previous tools for comparison
    previous_tools = user.get("allowed_tools", [])
    
    # Update allowed tools
    await db.users.update_one(
        {"_id": obj_id},
        {"$set": {"allowed_tools": tool_ids}}
    )
    
    # Log activity - Admin assigned tools to user
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action="Assigned Tools",
        target=user.get("name", user["email"]),
        details=f"{len(tool_ids)} tool(s) assigned to {user['email']} by {current_user['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    # Notify user in real-time about tool access change
    user_email = user.get("email")
    if user_email:
        added_tools = [t for t in tool_ids if t not in previous_tools]
        removed_tools = [t for t in previous_tools if t not in tool_ids]
        
        if added_tools or removed_tools:
            action = "updated"
            if added_tools and not removed_tools:
                action = "granted"
            elif removed_tools and not added_tools:
                action = "revoked"
            
            await notify_tool_access_change(user_email, tool_ids, action)
    
    return {
        "message": f"Tool access updated for {user['name']}",
        "allowed_tools": tool_ids
    }

@router.get("/{user_id}/tool-access")
async def get_tool_access(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user's allowed tools"""
    db = await get_db()
    
    # Super Admin can access anyone's tool access
    # Admin can access anyone's tool access  
    # Regular users can only view their own access
    is_super_admin = current_user["role"] == "Super Administrator"
    is_admin = current_user["role"] == "Administrator"
    is_own_access = current_user["id"] == user_id
    
    if not (is_super_admin or is_admin or is_own_access):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "user_id": user_id,
        "allowed_tools": user.get("allowed_tools", [])
    }


# Helper to check if current user can manage target user
async def can_manage_user(current_user: dict, target_user_id: str, db) -> bool:
    """Check if current user has permission to manage target user"""
    if current_user["role"] == "Super Administrator":
        return True
    
    if current_user["role"] == "Administrator":
        # Admin can only manage users assigned to them
        admin_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        assigned_users = admin_data.get("assigned_users", []) if admin_data else []
        return target_user_id in assigned_users
    
    return False

@router.put("/{admin_id}/assign-users")
async def assign_users_to_admin(
    admin_id: str,
    user_ids: List[str],
    current_user: dict = Depends(require_admin)
):
    """Assign users to an Admin (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can assign users to Admins
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can assign users to Admins"
        )
    
    try:
        admin_obj_id = ObjectId(admin_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    # Verify the target is an Admin
    admin = await db.users.find_one({"_id": admin_obj_id})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    if admin.get("role") != "Administrator":
        raise HTTPException(status_code=400, detail="Target user is not an Administrator")
    
    # Validate all user IDs exist (allow Users and other Admins, but not Super Admins or self)
    valid_user_ids = []
    for uid in user_ids:
        try:
            user = await db.users.find_one({"_id": ObjectId(uid)})
            if user and user.get("role") != "Super Administrator" and uid != admin_id:
                valid_user_ids.append(uid)
        except:
            continue
    
    # Update Admin's assigned_users
    await db.users.update_one(
        {"_id": admin_obj_id},
        {"$set": {"assigned_users": valid_user_ids}}
    )
    
    # Update each user's managed_by field
    # First, clear managed_by for users no longer assigned
    await db.users.update_many(
        {"managed_by": admin_id},
        {"$unset": {"managed_by": ""}}
    )
    
    # Set managed_by for newly assigned users
    for uid in valid_user_ids:
        await db.users.update_one(
            {"_id": ObjectId(uid)},
            {"$set": {"managed_by": admin_id}}
        )
    
    # Log activity
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action="Assigned Users to Admin",
        target=admin.get("name", admin["email"]),
        details=f"{len(valid_user_ids)} user(s) assigned to Admin {admin['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    return {
        "message": f"Users assigned to {admin['name']}",
        "assigned_users": valid_user_ids
    }

@router.get("/{admin_id}/assigned-users")
async def get_assigned_users(admin_id: str, current_user: dict = Depends(require_admin)):
    """Get users assigned to an Admin"""
    db = await get_db()
    
    try:
        admin_obj_id = ObjectId(admin_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    admin = await db.users.find_one({"_id": admin_obj_id})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    return {
        "admin_id": admin_id,
        "assigned_users": admin.get("assigned_users", [])
    }



# ============ PASSWORD MANAGEMENT (Super Admin only) ============

class PasswordResetRequest(BaseModel):
    new_password: str

def generate_random_password(length=12):
    """Generate a random password"""
    chars = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(random.choices(chars, k=length))

@router.get("/credentials/all")
async def get_all_user_credentials(current_user: dict = Depends(require_admin)):
    """Get all user credentials (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can see credentials
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can view credentials"
        )
    
    users = []
    async for user in db.users.find().limit(500):
        users.append({
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "status": user.get("status", "Active"),
            "password": user.get("plain_password", "********"),  # Show stored password
            "created_at": user.get("created_at", ""),
            "last_active": user.get("last_active", "Never"),
            "two_sv_enabled": user.get("two_sv_enabled", False),
            "password_login_enabled": user.get("password_login_enabled", False) or user["email"] == "info@dsgtransport.net"
        })
    
    return users

@router.put("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str, 
    request: PasswordResetRequest,
    current_user: dict = Depends(require_admin)
):
    """Reset user password (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can reset passwords
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can reset passwords"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    await db.users.update_one(
        {"_id": obj_id},
        {"$set": {
            "password": hash_password(request.new_password),
            "plain_password": request.new_password
        }}
    )
    
    # Log activity
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action="Reset Password",
        target=user.get("name", user["email"]),
        details=f"Password reset for {user['email']} by {current_user['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    return {
        "message": f"Password reset for {user['name']}",
        "new_password": request.new_password
    }

@router.post("/{user_id}/send-password-reset")
async def send_password_reset(
    user_id: str,
    current_user: dict = Depends(require_admin)
):
    """Send password reset email with new password (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can send password reset
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can send password reset"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new random password
    new_password = generate_random_password()
    
    # Update password in database
    await db.users.update_one(
        {"_id": obj_id},
        {"$set": {
            "password": hash_password(new_password),
            "plain_password": new_password
        }}
    )
    
    # Send email with new password
    try:
        email_sent = await send_password_reset_email(
            to_email=user["email"],
            user_name=user["name"],
            new_password=new_password
        )
    except Exception as e:
        email_sent = False
        print(f"Failed to send password reset email: {e}")
    
    # Log activity
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action="Sent Password Reset",
        target=user.get("name", user["email"]),
        details=f"Password reset email sent to {user['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    return {
        "message": f"Password reset sent to {user['email']}",
        "email_sent": email_sent,
        "new_password": new_password  # Return to Super Admin
    }

@router.put("/{user_id}/toggle-2sv")
async def toggle_user_2sv(
    user_id: str,
    enabled: bool,
    current_user: dict = Depends(require_admin)
):
    """Enable/disable 2SV for a user (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can toggle 2SV
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can modify 2SV settings"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"_id": obj_id},
        {"$set": {"two_sv_enabled": enabled}}
    )
    
    return {
        "message": f"2SV {'enabled' if enabled else 'disabled'} for {user['name']}",
        "two_sv_enabled": enabled
    }


@router.put("/{user_id}/change-role")
async def change_user_role(
    user_id: str,
    new_role: str,
    current_user: dict = Depends(require_admin)
):
    """Change user role (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can change roles
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can change user roles"
        )
    
    # Validate role
    valid_roles = ["Administrator", "User"]
    if new_role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {valid_roles}"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot change the main Super Admin's role
    if user["email"] == "info@dsgtransport.net":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change the role of the primary Super Administrator"
        )
    
    old_role = user.get("role", "User")
    
    await db.users.update_one(
        {"_id": obj_id},
        {"$set": {"role": new_role}}
    )
    
    # Log activity
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action="Changed User Role",
        target=user.get("name", user["email"]),
        details=f"Role changed from {old_role} to {new_role} for {user['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    # Notify user in real-time about role change
    user_email = user.get("email")
    if user_email:
        await notify_role_changed(user_email, new_role)
    
    return {
        "message": f"Role updated for {user['name']}",
        "old_role": old_role,
        "new_role": new_role
    }



# ============ PASSWORD LOGIN ACCESS (Super Admin only) ============

class SetPasswordRequest(BaseModel):
    password: str

@router.put("/{user_id}/toggle-password-login")
async def toggle_password_login(
    user_id: str,
    enabled: bool,
    current_user: dict = Depends(require_admin)
):
    """Enable/disable password login for a user (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can toggle password login
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can modify password login settings"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot modify Super Admin's password login (always enabled)
    if user["email"] == "info@dsgtransport.net":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super Admin's password login cannot be modified"
        )
    
    await db.users.update_one(
        {"_id": obj_id},
        {"$set": {"password_login_enabled": enabled}}
    )
    
    # Log activity
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action=f"{'Enabled' if enabled else 'Disabled'} Password Login",
        target=user.get("name", user["email"]),
        details=f"Password login {'enabled' if enabled else 'disabled'} for {user['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    return {
        "message": f"Password login {'enabled' if enabled else 'disabled'} for {user['name']}",
        "password_login_enabled": enabled
    }

@router.put("/{user_id}/set-password")
async def set_user_password(
    user_id: str,
    request: SetPasswordRequest,
    current_user: dict = Depends(require_admin)
):
    """Set password for a user (Super Admin only) - used when enabling password login"""
    db = await get_db()
    
    # Only Super Admin can set passwords
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can set user passwords"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password and enable password login
    await db.users.update_one(
        {"_id": obj_id},
        {"$set": {
            "password": hash_password(request.password),
            "plain_password": request.password,
            "password_login_enabled": True
        }}
    )
    
    # Log activity
    await log_activity(
        user_email=current_user["email"],
        user_name=current_user.get("name", current_user["email"]),
        action="Set User Password",
        target=user.get("name", user["email"]),
        details=f"Password set and password login enabled for {user['email']}",
        activity_type=ActivityType.ADMIN
    )
    
    return {
        "message": f"Password set for {user['name']}",
        "password_login_enabled": True
    }

