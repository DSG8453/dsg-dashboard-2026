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
    current_user: dict = Depends(require_super_admin)
):
    """Get activity logs (Super Admin only)"""
    db = await get_db()
    
    # Build filter
    query_filter = {}
    if activity_type and activity_type != "all":
        query_filter["activity_type"] = activity_type
    
    logs = []
    cursor = db.activity_logs.find(query_filter).sort("created_at", -1).limit(limit)
    
    async for log in cursor:
        # Format time ago
        created_at = log.get("created_at", "")
        time_ago = format_time_ago(created_at) if created_at else "Unknown"
        
        logs.append({
            "id": str(log["_id"]),
            "user": log.get("user_email", "Unknown"),
            "user_name": log.get("user_name", "Unknown"),
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
    except:
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
