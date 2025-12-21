from fastapi import APIRouter, Depends, HTTPException, status
from models.schemas import ToolCreate, ToolResponse
from database import get_db
from routes.auth import get_current_user, require_admin
from bson import ObjectId
from typing import List

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_tools(current_user: dict = Depends(get_current_user)):
    """Get all tools"""
    db = await get_db()
    
    tools = []
    async for tool in db.tools.find():
        # Count credentials for current user
        cred_count = await db.credentials.count_documents({
            "user_id": current_user["id"],
            "tool_id": str(tool["_id"])
        })
        
        tools.append({
            "id": str(tool["_id"]),
            "name": tool["name"],
            "category": tool["category"],
            "description": tool["description"],
            "icon": tool.get("icon", "Globe"),
            "url": tool.get("url", "#"),
            "credentials_count": cred_count
        })
    
    return tools

@router.post("", response_model=dict)
async def create_tool(tool_data: ToolCreate, current_user: dict = Depends(require_admin)):
    """Create a new tool (admin only)"""
    db = await get_db()
    
    new_tool = {
        "name": tool_data.name,
        "category": tool_data.category,
        "description": tool_data.description,
        "icon": tool_data.icon,
        "url": tool_data.url
    }
    
    result = await db.tools.insert_one(new_tool)
    
    return {
        "id": str(result.inserted_id),
        "name": tool_data.name,
        "category": tool_data.category,
        "description": tool_data.description,
        "icon": tool_data.icon,
        "url": tool_data.url,
        "credentials_count": 0
    }

@router.get("/{tool_id}", response_model=dict)
async def get_tool(tool_id: str, current_user: dict = Depends(get_current_user)):
    """Get tool by ID"""
    db = await get_db()
    
    tool = await db.tools.find_one({"_id": ObjectId(tool_id)})
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )
    
    cred_count = await db.credentials.count_documents({
        "user_id": current_user["id"],
        "tool_id": tool_id
    })
    
    return {
        "id": str(tool["_id"]),
        "name": tool["name"],
        "category": tool["category"],
        "description": tool["description"],
        "icon": tool.get("icon", "Globe"),
        "url": tool.get("url", "#"),
        "credentials_count": cred_count
    }

@router.put("/{tool_id}", response_model=dict)
async def update_tool(tool_id: str, tool_data: ToolCreate, current_user: dict = Depends(require_admin)):
    """Update tool (admin only)"""
    db = await get_db()
    
    tool = await db.tools.find_one({"_id": ObjectId(tool_id)})
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )
    
    await db.tools.update_one(
        {"_id": ObjectId(tool_id)},
        {"$set": {
            "name": tool_data.name,
            "category": tool_data.category,
            "description": tool_data.description,
            "icon": tool_data.icon,
            "url": tool_data.url
        }}
    )
    
    return {
        "id": tool_id,
        "name": tool_data.name,
        "category": tool_data.category,
        "description": tool_data.description,
        "icon": tool_data.icon,
        "url": tool_data.url,
        "credentials_count": 0
    }

@router.delete("/{tool_id}")
async def delete_tool(tool_id: str, current_user: dict = Depends(require_admin)):
    """Delete tool (admin only)"""
    db = await get_db()
    
    tool = await db.tools.find_one({"_id": ObjectId(tool_id)})
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )
    
    # Delete all credentials for this tool
    await db.credentials.delete_many({"tool_id": tool_id})
    await db.tools.delete_one({"_id": ObjectId(tool_id)})
    
    return {"message": "Tool deleted successfully"}
