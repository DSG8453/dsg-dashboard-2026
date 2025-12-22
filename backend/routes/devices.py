from fastapi import APIRouter, Depends, HTTPException, status, Request
from models.device import DeviceCreate, DeviceUpdate, DeviceStatus
from database import get_db
from routes.auth import get_current_user, require_admin, require_super_admin
from bson import ObjectId
from typing import List
from datetime import datetime, timezone

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_all_devices(current_user: dict = Depends(require_super_admin)):
    """Get all devices (Super Admin only)"""
    db = await get_db()
    
    devices = []
    async for device in db.devices.find().sort("created_at", -1):
        devices.append({
            "id": str(device["_id"]),
            "user_id": device["user_id"],
            "user_name": device["user_name"],
            "user_email": device["user_email"],
            "device_name": device["device_name"],
            "browser": device["browser"],
            "os": device["os"],
            "ip_address": device["ip_address"],
            "status": device["status"],
            "created_at": device["created_at"],
            "approved_at": device.get("approved_at"),
            "approved_by": device.get("approved_by"),
            "last_login": device.get("last_login"),
            "admin_note": device.get("admin_note", "")
        })
    
    return devices

@router.get("/pending", response_model=List[dict])
async def get_pending_devices(current_user: dict = Depends(require_super_admin)):
    """Get pending devices awaiting approval (Super Admin only)"""
    db = await get_db()
    
    devices = []
    async for device in db.devices.find({"status": "pending"}).sort("created_at", -1):
        devices.append({
            "id": str(device["_id"]),
            "user_id": device["user_id"],
            "user_name": device["user_name"],
            "user_email": device["user_email"],
            "device_name": device["device_name"],
            "browser": device["browser"],
            "os": device["os"],
            "ip_address": device["ip_address"],
            "status": device["status"],
            "created_at": device["created_at"],
            "admin_note": device.get("admin_note", "")
        })
    
    return devices

@router.get("/my-devices", response_model=List[dict])
async def get_my_devices(current_user: dict = Depends(get_current_user)):
    """Get current user's devices"""
    db = await get_db()
    
    devices = []
    async for device in db.devices.find({"user_id": current_user["id"]}).sort("created_at", -1):
        devices.append({
            "id": str(device["_id"]),
            "device_name": device["device_name"],
            "browser": device["browser"],
            "os": device["os"],
            "ip_address": device["ip_address"],
            "status": device["status"],
            "created_at": device["created_at"],
            "last_login": device.get("last_login")
        })
    
    return devices

@router.get("/check/{fingerprint}")
async def check_device_status(fingerprint: str, current_user: dict = Depends(get_current_user)):
    """Check if current device is approved"""
    db = await get_db()
    
    device = await db.devices.find_one({
        "user_id": current_user["id"],
        "fingerprint": fingerprint
    })
    
    if not device:
        return {"status": "not_registered", "approved": False}
    
    return {
        "status": device["status"],
        "approved": device["status"] == "approved",
        "device_id": str(device["_id"]),
        "device_name": device["device_name"]
    }

@router.post("/register", response_model=dict)
async def register_device(
    request: Request,
    device_data: DeviceCreate,
    current_user: dict = Depends(get_current_user)
):
    """Register a new device for approval"""
    db = await get_db()
    
    # Check if device already exists
    existing = await db.devices.find_one({
        "user_id": current_user["id"],
        "fingerprint": device_data.fingerprint
    })
    
    if existing:
        # Update last login time
        await db.devices.update_one(
            {"_id": existing["_id"]},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
        return {
            "id": str(existing["_id"]),
            "status": existing["status"],
            "approved": existing["status"] == "approved",
            "message": "Device already registered"
        }
    
    # Get client IP
    client_ip = request.client.host if request.client else device_data.ip_address
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    
    # Create new device
    now = datetime.now(timezone.utc).isoformat()
    new_device = {
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "device_name": device_data.device_name,
        "browser": device_data.browser,
        "os": device_data.os,
        "ip_address": client_ip,
        "user_agent": device_data.user_agent,
        "fingerprint": device_data.fingerprint,
        "status": "pending",
        "created_at": now,
        "last_login": now
    }
    
    # Auto-approve ONLY for Super Admin
    if current_user.get("role") == "Super Administrator":
        new_device["status"] = "approved"
        new_device["approved_at"] = now
        new_device["approved_by"] = "Auto-approved (Super Admin)"
    
    result = await db.devices.insert_one(new_device)
    
    return {
        "id": str(result.inserted_id),
        "status": new_device["status"],
        "approved": new_device["status"] == "approved",
        "message": "Device registered" if new_device["status"] == "approved" else "Device pending approval"
    }

# Helper to check if admin can manage a device
async def can_admin_manage_device(current_user: dict, device: dict, db) -> bool:
    """Check if admin can manage this device"""
    if current_user["role"] == "Super Administrator":
        return True
    
    if current_user["role"] == "Administrator":
        # Admin can only manage devices for users assigned to them
        admin_data = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        assigned_users = admin_data.get("assigned_users", []) if admin_data else []
        return device.get("user_id") in assigned_users
    
    return False

@router.put("/{device_id}/approve", response_model=dict)
async def approve_device(device_id: str, current_user: dict = Depends(require_super_admin)):
    """Approve a device (Super Admin only)"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(device_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid device ID")
    
    device = await db.devices.find_one({"_id": obj_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.devices.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": "approved",
            "approved_at": now,
            "approved_by": current_user["name"]
        }}
    )
    
    return {
        "message": f"Device approved for {device['user_name']}",
        "device_id": device_id,
        "status": "approved"
    }

@router.put("/{device_id}/reject", response_model=dict)
async def reject_device(device_id: str, current_user: dict = Depends(require_super_admin)):
    """Reject a device (Super Admin only)"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(device_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid device ID")
    
    device = await db.devices.find_one({"_id": obj_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    await db.devices.update_one(
        {"_id": obj_id},
        {"$set": {"status": "rejected"}}
    )
    
    return {
        "message": f"Device rejected for {device['user_name']}",
        "device_id": device_id,
        "status": "rejected"
    }

@router.put("/{device_id}/revoke", response_model=dict)
async def revoke_device(device_id: str, current_user: dict = Depends(require_super_admin)):
    """Revoke device access (Super Admin only)"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(device_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid device ID")
    
    device = await db.devices.find_one({"_id": obj_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    await db.devices.update_one(
        {"_id": obj_id},
        {"$set": {"status": "revoked"}}
    )
    
    return {
        "message": f"Device access revoked for {device['user_name']}",
        "device_id": device_id,
        "status": "revoked"
    }

@router.delete("/{device_id}")
async def delete_device(device_id: str, current_user: dict = Depends(require_admin)):
    """Delete a device (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can delete devices
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can delete devices"
        )
    
    try:
        obj_id = ObjectId(device_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid device ID")
    
    result = await db.devices.delete_one({"_id": obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    
    return {"message": "Device deleted", "device_id": device_id}
