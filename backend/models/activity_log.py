from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

class ActivityType(str, Enum):
    ACCESS = "access"          # Tool access
    AUTH = "auth"              # Login/Logout
    ADMIN = "admin"            # Admin actions (suspend, assign tools, add user)
    SECURITY = "security"      # Security events
    SETTINGS = "settings"      # Settings changes

class ActivityLogCreate(BaseModel):
    user_email: str
    user_name: str
    action: str
    target: str = "System"        # Tool name or user affected
    details: Optional[str] = None # Additional details
    activity_type: ActivityType = ActivityType.ADMIN
    ip_address: Optional[str] = None

class ActivityLogResponse(BaseModel):
    id: str
    user_email: str
    user_name: str
    action: str
    target: str
    details: Optional[str] = None
    activity_type: str
    ip_address: Optional[str] = None
    created_at: str
