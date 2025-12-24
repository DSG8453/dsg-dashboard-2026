from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Enums
class UserRole(str, Enum):
    SUPER_ADMIN = "Super Administrator"
    ADMIN = "Administrator"
    USER = "User"

class UserStatus(str, Enum):
    ACTIVE = "Active"
    SUSPENDED = "Suspended"
    PENDING = "Pending"

class AccessLevel(str, Enum):
    FULL = "full"
    STANDARD = "standard"
    LIMITED = "limited"
    READONLY = "readonly"

class IssueStatus(str, Enum):
    OPEN = "open"
    ANALYZED = "analyzed"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"

class IssuePriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

# Auth Models
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.USER
    status: UserStatus = UserStatus.PENDING
    access_level: AccessLevel = AccessLevel.STANDARD

class UserCreate(UserBase):
    # Password is optional - Google SSO users don't need it
    password: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    access_level: Optional[AccessLevel] = None

class UserResponse(UserBase):
    id: str
    initials: str
    created_at: str
    last_active: Optional[str] = None

# Tool Models
class ToolBase(BaseModel):
    name: str
    category: str
    description: str
    icon: str = "Globe"
    url: str = "#"

class ToolCreate(ToolBase):
    pass

class ToolResponse(ToolBase):
    id: str
    credentials_count: int = 0

# Credential Models
class CredentialCreate(BaseModel):
    tool_id: str
    label: str = "Default Account"
    username: str
    password: str

class CredentialUpdate(BaseModel):
    label: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class CredentialResponse(BaseModel):
    id: str
    tool_id: str
    label: str
    username: str
    # Password is never returned in response!
    created_at: str
    updated_at: str

class CredentialWithPassword(CredentialResponse):
    """Only used when user explicitly requests to view password"""
    password: str

# Issue Models
class IssueCreate(BaseModel):
    title: str
    description: str
    category: str
    priority: IssuePriority = IssuePriority.MEDIUM

class IssueUpdate(BaseModel):
    status: Optional[IssueStatus] = None
    admin_notes: Optional[str] = None

class AIAnalysis(BaseModel):
    diagnosis: str
    suggested_fix: str
    confidence: float
    analyzed_at: str

class Resolution(BaseModel):
    note: str
    resolved_by: str
    applied_fix: str
    resolved_at: str

class IssueResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    title: str
    description: str
    category: str
    priority: IssuePriority
    status: IssueStatus
    created_at: str
    ai_analysis: Optional[AIAnalysis] = None
    admin_notes: Optional[str] = None
    resolution: Optional[Resolution] = None

# Settings Models
class SupportSettings(BaseModel):
    whatsapp_number: str
    support_email: EmailStr
    business_hours: str

class SupportSettingsUpdate(BaseModel):
    whatsapp_number: Optional[str] = None
    support_email: Optional[EmailStr] = None
    business_hours: Optional[str] = None
