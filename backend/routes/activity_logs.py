from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from models.activity_log import ActivityLogCreate, ActivityLogResponse, ActivityType
from database import get_db
from routes.auth import get_current_user, require_super_admin
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timezone

router = APIRouter()

async def log_activity(
    user_email: str,
    user_name: str,
    action: str,
    target: str = "System",
    details: str = None,
    activity_type: ActivityType = ActivityType.ADMIN,
    ip_address: str = None
):
    """
    Utility function to log an activity from anywhere in the backend.
    Call this whenever an admin action occurs.
    """
    db = await get_db()
    
    log_entry = {
        "user_email": user_email,
        "user_name": user_name,
        "action": action,
        "target": target,
        "details": details,
        "activity_type": activity_type.value if isinstance(activity_type, ActivityType) else activity_type,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.activity_logs.insert_one(log_entry)
    return str(result.inserted_id)


@router.get("", response_model=List[dict])
async def get_activity_logs(
    limit: int = Query(50, le=200),
    activity_type: Optional[str] = Query(None),
    user_role: Optional[str] = Query(None),  # Filter by user role
    user_email: Optional[str] = Query(None),  # Filter by specific user
    current_user: dict = Depends(require_super_admin)
):
    """Get activity logs (Super Admin only) - Can filter by activity type, user role, or specific user"""
    db = await get_db()
    
    # Build filter
    query_filter = {}
    if activity_type and activity_type != "all":
        query_filter["activity_type"] = activity_type
    
    # Filter by user role - need to join with users collection
    if user_role and user_role != "all":
        # Get all users with this role
        users_with_role = await db.users.find({"role": user_role}, {"email": 1}).to_list(1000)
        role_emails = [u["email"] for u in users_with_role]
        query_filter["user_email"] = {"$in": role_emails}
    
    # Filter by specific user
    if user_email:
        query_filter["user_email"] = user_email
    
    logs = []
    cursor = db.activity_logs.find(query_filter).sort("created_at", -1).limit(limit)
    
    # Get user roles for display (limit to 1000 users)
    all_users = {}
    async for u in db.users.find({}, {"email": 1, "role": 1}).limit(1000):
        all_users[u["email"]] = u.get("role", "Unknown")
    
    async for log in cursor:
        # Format time ago
        created_at = log.get("created_at", "")
        time_ago = format_time_ago(created_at) if created_at else "Unknown"
        user_email_val = log.get("user_email", "Unknown")
        
        logs.append({
            "id": str(log["_id"]),
            "user": user_email_val,
            "user_name": log.get("user_name", "Unknown"),
            "user_role": all_users.get(user_email_val, "Unknown"),
            "action": log.get("action", ""),
            "tool": log.get("target", "System"),
            "details": log.get("details"),
            "type": log.get("activity_type", "admin"),
            "ip": log.get("ip_address", "N/A"),
            "time": time_ago,
            "created_at": created_at
        })
    
    return logs


def format_time_ago(iso_timestamp: str) -> str:
    """Format ISO timestamp to 'X minutes/hours/days ago' format"""
    try:
        # Parse the ISO timestamp
        if iso_timestamp.endswith('Z'):
            iso_timestamp = iso_timestamp[:-1] + '+00:00'
        created = datetime.fromisoformat(iso_timestamp)
        now = datetime.now(timezone.utc)
        
        diff = now - created
        seconds = diff.total_seconds()
        
        if seconds < 60:
            return "Just now"
        elif seconds < 3600:
            mins = int(seconds / 60)
            return f"{mins} minute{'s' if mins != 1 else ''} ago"
        elif seconds < 86400:
            hours = int(seconds / 3600)
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif seconds < 604800:
            days = int(seconds / 86400)
            return f"{days} day{'s' if days != 1 else ''} ago"
        else:
            weeks = int(seconds / 604800)
            return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    except Exception:
        return "Unknown"


@router.post("", response_model=dict)
async def create_activity_log(
    log_data: ActivityLogCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create a new activity log entry"""
    db = await get_db()
    
    # Get IP from request if not provided
    ip_address = log_data.ip_address or request.client.host if request.client else "Unknown"
    
    log_entry = {
        "user_email": log_data.user_email,
        "user_name": log_data.user_name,
        "action": log_data.action,
        "target": log_data.target,
        "details": log_data.details,
        "activity_type": log_data.activity_type.value,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.activity_logs.insert_one(log_entry)
    
    return {
        "id": str(result.inserted_id),
        "message": "Activity logged successfully"
    }



# ============ DELETE ENDPOINTS (Super Admin only) ============

@router.delete("/{log_id}")
async def delete_activity_log(
    log_id: str,
    current_user: dict = Depends(require_super_admin)
):
    """Delete a single activity log entry (Super Admin only)"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log ID")
    
    log = await db.activity_logs.find_one({"_id": obj_id})
    if not log:
        raise HTTPException(status_code=404, detail="Activity log not found")
    
    await db.activity_logs.delete_one({"_id": obj_id})
    
    return {"message": "Activity log deleted successfully"}


@router.delete("/user/{user_email}")
async def delete_user_activity_logs(
    user_email: str,
    current_user: dict = Depends(require_super_admin)
):
    """Delete all activity logs for a specific user (Super Admin only)"""
    db = await get_db()
    
    # Count logs before deletion
    count = await db.activity_logs.count_documents({"user_email": user_email})
    
    if count == 0:
        raise HTTPException(status_code=404, detail=f"No activity logs found for {user_email}")
    
    # Delete all logs for this user
    result = await db.activity_logs.delete_many({"user_email": user_email})
    
    return {
        "message": f"Deleted {result.deleted_count} activity log(s) for {user_email}",
        "deleted_count": result.deleted_count
    }


@router.delete("/bulk/all")
async def delete_all_activity_logs(
    current_user: dict = Depends(require_super_admin)
):
    """Delete ALL activity logs (Super Admin only) - Use with caution!"""
    db = await get_db()
    
    count = await db.activity_logs.count_documents({})
    
    if count == 0:
        raise HTTPException(status_code=404, detail="No activity logs to delete")
    
    result = await db.activity_logs.delete_many({})
    
    return {
        "message": f"Deleted all {result.deleted_count} activity logs",
        "deleted_count": result.deleted_count
    }


@router.get("/users/list")
async def get_users_with_logs(
    current_user: dict = Depends(require_super_admin)
):
    """Get list of users who have activity logs (for dropdown filter)"""
    db = await get_db()
    
    # Get unique user emails from activity logs
    pipeline = [
        {"$group": {"_id": "$user_email", "count": {"$sum": 1}, "user_name": {"$first": "$user_name"}}},
        {"$sort": {"count": -1}}
    ]
    
    users = []
    async for doc in db.activity_logs.aggregate(pipeline):
        # Get user role from users collection
        user = await db.users.find_one({"email": doc["_id"]}, {"role": 1})
        users.append({
            "email": doc["_id"],
            "name": doc.get("user_name", doc["_id"]),
            "role": user.get("role", "Unknown") if user else "Unknown",
            "log_count": doc["count"]
        })
    
    return users
