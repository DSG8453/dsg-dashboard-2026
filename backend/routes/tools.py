from fastapi import APIRouter, Depends, HTTPException, status
from models.schemas import ToolCreate, ToolResponse
from database import get_db
from routes.auth import get_current_user, require_admin
from bson import ObjectId
from typing import List, Optional
from pydantic import BaseModel
from utils.websocket_manager import notify_tool_deleted, notify_tool_access_change, notify_tool_created, notify_tool_updated

router = APIRouter()

class ToolCredentials(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    login_url: Optional[str] = None
    username_field: Optional[str] = "username"
    password_field: Optional[str] = "password"
    notes: Optional[str] = None

class ToolCreateWithCredentials(BaseModel):
    name: str
    category: str
    description: str
    icon: str = "Globe"
    url: str = "#"
    credentials: Optional[ToolCredentials] = None

@router.get("", response_model=List[dict])
async def get_tools(current_user: dict = Depends(get_current_user)):
    """Get all tools - credentials ONLY visible to Super Admin"""
    db = await get_db()
    
    is_super_admin = current_user.get("role") == "Super Administrator"
    
    tools = []
    async for tool in db.tools.find().limit(200):
        tool_data = {
            "id": str(tool["_id"]),
            "name": tool["name"],
            "category": tool["category"],
            "description": tool["description"],
            "icon": tool.get("icon", "Globe"),
            "url": tool.get("url", "#"),
            "has_credentials": bool(tool.get("credentials") and tool.get("credentials", {}).get("username"))
        }
        
        # ONLY Super Admin can see credentials - Admin/Users see NOTHING
        if is_super_admin and tool.get("credentials"):
            tool_data["credentials"] = tool.get("credentials", {})
        
        tools.append(tool_data)
    
    return tools

@router.post("", response_model=dict)
async def create_tool(tool_data: ToolCreateWithCredentials, current_user: dict = Depends(require_admin)):
    """Create a new tool (Super Admin only can add credentials)"""
    db = await get_db()
    
    # Only Super Admin can create tools
    if current_user.get("role") != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can create tools"
        )
    
    new_tool = {
        "name": tool_data.name,
        "category": tool_data.category,
        "description": tool_data.description,
        "icon": tool_data.icon,
        "url": tool_data.url,
        "credentials": tool_data.credentials.dict() if tool_data.credentials else None
    }
    
    result = await db.tools.insert_one(new_tool)
    tool_id = str(result.inserted_id)
    
    # Notify all connected users about the new tool
    await notify_tool_created(tool_data.name, tool_id)
    
    return {
        "id": tool_id,
        "name": tool_data.name,
        "category": tool_data.category,
        "description": tool_data.description,
        "icon": tool_data.icon,
        "url": tool_data.url,
        "has_credentials": bool(tool_data.credentials),
        "credentials": tool_data.credentials.dict() if tool_data.credentials else None
    }

@router.get("/{tool_id}", response_model=dict)
async def get_tool(tool_id: str, current_user: dict = Depends(get_current_user)):
    """Get tool by ID - credentials only for Super Admin"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(tool_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid tool ID")
    
    tool = await db.tools.find_one({"_id": obj_id})
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )
    
    is_super_admin = current_user.get("role") == "Super Administrator"
    
    tool_data = {
        "id": str(tool["_id"]),
        "name": tool["name"],
        "category": tool["category"],
        "description": tool["description"],
        "icon": tool.get("icon", "Globe"),
        "url": tool.get("url", "#"),
        "has_credentials": bool(tool.get("credentials"))
    }
    
    # Only Super Admin can see credentials
    if is_super_admin and tool.get("credentials"):
        tool_data["credentials"] = tool.get("credentials")
    
    return tool_data

@router.put("/{tool_id}", response_model=dict)
async def update_tool(tool_id: str, tool_data: ToolCreateWithCredentials, current_user: dict = Depends(require_admin)):
    """Update tool (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can update tools
    if current_user.get("role") != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can update tools"
        )
    
    try:
        obj_id = ObjectId(tool_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid tool ID")
    
    tool = await db.tools.find_one({"_id": obj_id})
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )
    
    update_data = {
        "name": tool_data.name,
        "category": tool_data.category,
        "description": tool_data.description,
        "icon": tool_data.icon,
        "url": tool_data.url,
    }
    
    # Update credentials if provided
    if tool_data.credentials:
        update_data["credentials"] = tool_data.credentials.dict()
    
    await db.tools.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    # Notify all connected users about the tool update
    await notify_tool_updated(tool_data.name, tool_id)
    
    return {
        "id": tool_id,
        "name": tool_data.name,
        "category": tool_data.category,
        "description": tool_data.description,
        "icon": tool_data.icon,
        "url": tool_data.url,
        "has_credentials": bool(tool_data.credentials),
        "credentials": tool_data.credentials.dict() if tool_data.credentials else None
    }

@router.delete("/{tool_id}")
async def delete_tool(tool_id: str, current_user: dict = Depends(require_admin)):
    """Delete tool (Super Admin only) - Also removes from all users' allowed_tools"""
    db = await get_db()
    
    # Only Super Admin can delete tools
    if current_user.get("role") != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can delete tools"
        )
    
    try:
        obj_id = ObjectId(tool_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid tool ID")
    
    tool = await db.tools.find_one({"_id": obj_id})
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )
    
    # Get list of affected users BEFORE deleting
    affected_users = await db.users.find(
        {"allowed_tools": tool_id},
        {"email": 1}
    ).to_list(1000)
    affected_emails = [u["email"] for u in affected_users]
    tool_name = tool["name"]
    
    # Delete all credentials for this tool
    await db.credentials.delete_many({"tool_id": tool_id})
    
    # Remove tool from ALL users' allowed_tools arrays
    await db.users.update_many(
        {"allowed_tools": tool_id},
        {"$pull": {"allowed_tools": tool_id}}
    )
    
    # Delete the tool
    await db.tools.delete_one({"_id": obj_id})
    
    # Notify all affected users in real-time
    if affected_emails:
        await notify_tool_deleted(affected_emails, tool_name, tool_id)
    
    return {"message": f"Tool '{tool_name}' deleted successfully and removed from all users"}

# Endpoint for Admin/User to get tool URL for direct access (no credentials)
@router.get("/{tool_id}/access")
async def get_tool_access_url(tool_id: str, current_user: dict = Depends(get_current_user)):
    """Get tool URL for direct access - no credentials returned"""
    db = await get_db()
    
    try:
        obj_id = ObjectId(tool_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid tool ID")
    
    tool = await db.tools.find_one({"_id": obj_id})
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )
    
    # Return only the URL for direct access
    return {
        "url": tool.get("url", "#"),
        "name": tool["name"]
    }
