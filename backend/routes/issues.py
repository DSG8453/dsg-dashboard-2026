from fastapi import APIRouter, Depends, HTTPException, status
from models.schemas import IssueCreate, IssueUpdate, IssueResponse, IssueStatus
from database import get_db
from routes.auth import get_current_user, require_admin
from bson import ObjectId
from typing import List
from datetime import datetime

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_issues(current_user: dict = Depends(get_current_user)):
    """Get issues based on role:
    - Super Admin: sees ALL issues with FULL details (resolution, admin notes, AI analysis)
    - Admin/User: sees ONLY their own issues with LIMITED info (status only, no resolution details)
    """
    db = await get_db()
    
    is_super_admin = current_user["role"] == "Super Administrator"
    
    # Super Admin sees all, others see only their own
    query = {}
    if not is_super_admin:
        query["user_id"] = current_user["id"]
    
    issues = []
    async for issue in db.issues.find(query).sort("created_at", -1):
        issue_data = {
            "id": str(issue["_id"]),
            "user_id": issue["user_id"],
            "user_name": issue.get("user_name", ""),
            "user_email": issue.get("user_email", ""),
            "title": issue["title"],
            "description": issue["description"],
            "category": issue["category"],
            "priority": issue["priority"],
            "status": issue["status"],
            "created_at": issue.get("created_at", ""),
        }
        
        # Only Super Admin can see resolution details, admin notes, and AI analysis
        if is_super_admin:
            issue_data["ai_analysis"] = issue.get("ai_analysis")
            issue_data["admin_notes"] = issue.get("admin_notes")
            issue_data["resolution"] = issue.get("resolution")
        else:
            # Admin/User can only see if resolved or not, not HOW it was resolved
            issue_data["ai_analysis"] = None
            issue_data["admin_notes"] = None
            # Only show that it's resolved, not the resolution details
            if issue.get("resolution"):
                issue_data["resolution"] = {
                    "resolved_at": issue["resolution"].get("resolved_at"),
                    "note": None,  # Hide the resolution note
                    "resolved_by": None  # Hide who resolved it
                }
            else:
                issue_data["resolution"] = None
        
        issues.append(issue_data)
    
    return issues

@router.post("", response_model=dict)
async def create_issue(issue_data: IssueCreate, current_user: dict = Depends(get_current_user)):
    """Create a new issue"""
    db = await get_db()
    
    now = datetime.utcnow().isoformat() + "Z"
    new_issue = {
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "title": issue_data.title,
        "description": issue_data.description,
        "category": issue_data.category,
        "priority": issue_data.priority.value,
        "status": "open",
        "created_at": now,
        "ai_analysis": None,
        "admin_notes": "",
        "resolution": None
    }
    
    result = await db.issues.insert_one(new_issue)
    
    return {
        "id": str(result.inserted_id),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "title": issue_data.title,
        "description": issue_data.description,
        "category": issue_data.category,
        "priority": issue_data.priority.value,
        "status": "open",
        "created_at": now,
        "ai_analysis": None,
        "admin_notes": "",
        "resolution": None
    }

@router.get("/{issue_id}", response_model=dict)
async def get_issue(issue_id: str, current_user: dict = Depends(get_current_user)):
    """Get issue by ID"""
    db = await get_db()
    
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )
    
    # Users can only view their own issues
    if current_user["role"] != "Administrator" and issue["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return {
        "id": str(issue["_id"]),
        "user_id": issue["user_id"],
        "user_name": issue.get("user_name", ""),
        "user_email": issue.get("user_email", ""),
        "title": issue["title"],
        "description": issue["description"],
        "category": issue["category"],
        "priority": issue["priority"],
        "status": issue["status"],
        "created_at": issue.get("created_at", ""),
        "ai_analysis": issue.get("ai_analysis"),
        "admin_notes": issue.get("admin_notes"),
        "resolution": issue.get("resolution")
    }

@router.put("/{issue_id}", response_model=dict)
async def update_issue(issue_id: str, issue_data: IssueUpdate, current_user: dict = Depends(require_admin)):
    """Update issue (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can update issues
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can manage issues"
        )
    
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )
    
    update_data = {}
    if issue_data.status is not None:
        update_data["status"] = issue_data.status.value
    if issue_data.admin_notes is not None:
        update_data["admin_notes"] = issue_data.admin_notes
    
    if update_data:
        await db.issues.update_one(
            {"_id": ObjectId(issue_id)},
            {"$set": update_data}
        )
    
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    return {
        "id": str(issue["_id"]),
        "user_id": issue["user_id"],
        "user_name": issue.get("user_name", ""),
        "user_email": issue.get("user_email", ""),
        "title": issue["title"],
        "description": issue["description"],
        "category": issue["category"],
        "priority": issue["priority"],
        "status": issue["status"],
        "created_at": issue.get("created_at", ""),
        "ai_analysis": issue.get("ai_analysis"),
        "admin_notes": issue.get("admin_notes"),
        "resolution": issue.get("resolution")
    }

@router.post("/{issue_id}/analyze")
async def analyze_issue(issue_id: str, current_user: dict = Depends(require_admin)):
    """Send issue to AI for analysis (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can analyze issues
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can analyze issues"
        )
    
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )
    
    # Mock AI analysis based on category
    ai_responses = {
        "tool_access": {
            "diagnosis": f"Access issue detected for {issue.get('user_name', 'user')}. Possible causes: 1) Expired credentials, 2) IP whitelist restrictions, 3) Tool-specific permission settings.",
            "suggested_fix": "1. Verify user's saved credentials are current\n2. Check if user's IP is whitelisted\n3. Confirm tool permissions in admin panel\n4. Clear browser cache and retry",
            "confidence": 0.88
        },
        "performance": {
            "diagnosis": "Performance degradation identified. Possible causes: Network latency, browser cache issues, or heavy DOM rendering.",
            "suggested_fix": "1. Implement virtualized list rendering\n2. Add loading states for async operations\n3. Enable browser caching for static assets\n4. Consider pagination for large datasets",
            "confidence": 0.82
        },
        "login": {
            "diagnosis": "Authentication issue detected. Could be session expiration, SSO configuration, or credential mismatch.",
            "suggested_fix": "1. Reset user's password\n2. Clear session storage\n3. Verify SSO provider connection\n4. Check for account lockout status",
            "confidence": 0.90
        },
        "ui_bug": {
            "diagnosis": "UI rendering issue reported. May be caused by CSS conflicts, JavaScript errors, or responsive design issues.",
            "suggested_fix": "1. Check browser console for errors\n2. Test in different browsers\n3. Clear cache and hard refresh\n4. Review recent UI changes for conflicts",
            "confidence": 0.75
        }
    }
    
    category = issue.get("category", "other")
    analysis = ai_responses.get(category, {
        "diagnosis": "Issue requires manual investigation. Insufficient data for automated diagnosis.",
        "suggested_fix": "1. Gather more details from user\n2. Check system logs\n3. Review recent changes\n4. Escalate to development team if needed",
        "confidence": 0.60
    })
    
    ai_analysis = {
        **analysis,
        "analyzed_at": datetime.utcnow().isoformat() + "Z"
    }
    
    await db.issues.update_one(
        {"_id": ObjectId(issue_id)},
        {"$set": {"ai_analysis": ai_analysis, "status": "analyzed"}}
    )
    
    return ai_analysis

@router.post("/{issue_id}/resolve")
async def resolve_issue(issue_id: str, resolution_note: str, current_user: dict = Depends(require_admin)):
    """Resolve issue and notify user (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can resolve issues
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can resolve issues"
        )
    
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )
    
    resolution = {
        "note": resolution_note,
        "resolved_by": current_user["name"],
        "applied_fix": issue.get("ai_analysis", {}).get("suggested_fix", "Manual fix applied"),
        "resolved_at": datetime.utcnow().isoformat() + "Z"
    }
    
    await db.issues.update_one(
        {"_id": ObjectId(issue_id)},
        {"$set": {"resolution": resolution, "status": "resolved"}}
    )
    
    # In production, send notification to user here
    
    return {"message": f"Issue resolved. User {issue.get('user_name', '')} will be notified."}

@router.delete("/{issue_id}")
async def delete_issue(issue_id: str, current_user: dict = Depends(require_admin)):
    """Delete issue (Super Admin only)"""
    db = await get_db()
    
    # Only Super Admin can delete issues
    if current_user["role"] != "Super Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can delete issues"
        )
    
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )
    
    await db.issues.delete_one({"_id": ObjectId(issue_id)})
    
    return {"message": "Issue deleted successfully"}
