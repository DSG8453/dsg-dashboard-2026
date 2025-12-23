"""
WebSocket Manager for Real-time Updates
Handles real-time notifications for dashboard updates
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Set
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        # Map user_email to their websocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Map websocket to user_email for cleanup
        self.connection_users: Dict[WebSocket, str] = {}
    
    async def connect(self, websocket: WebSocket, user_email: str):
        """Accept websocket connection and register user"""
        await websocket.accept()
        
        if user_email not in self.active_connections:
            self.active_connections[user_email] = []
        
        self.active_connections[user_email].append(websocket)
        self.connection_users[websocket] = user_email
        print(f"[WS] User {user_email} connected. Total connections: {len(self.connection_users)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove websocket connection"""
        if websocket in self.connection_users:
            user_email = self.connection_users[websocket]
            
            if user_email in self.active_connections:
                if websocket in self.active_connections[user_email]:
                    self.active_connections[user_email].remove(websocket)
                
                # Clean up empty lists
                if not self.active_connections[user_email]:
                    del self.active_connections[user_email]
            
            del self.connection_users[websocket]
            print(f"[WS] User {user_email} disconnected. Total connections: {len(self.connection_users)}")
    
    async def send_to_user(self, user_email: str, message: dict):
        """Send message to specific user (all their connections)"""
        if user_email in self.active_connections:
            disconnected = []
            for connection in self.active_connections[user_email]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"[WS] Error sending to {user_email}: {e}")
                    disconnected.append(connection)
            
            # Clean up disconnected sockets
            for conn in disconnected:
                self.disconnect(conn)
    
    async def send_to_users(self, user_emails: List[str], message: dict):
        """Send message to multiple users"""
        for email in user_emails:
            await self.send_to_user(email, message)
    
    async def broadcast(self, message: dict, exclude: str = None):
        """Broadcast message to all connected users except excluded"""
        for user_email in list(self.active_connections.keys()):
            if user_email != exclude:
                await self.send_to_user(user_email, message)
    
    def get_connected_users(self) -> List[str]:
        """Get list of connected user emails"""
        return list(self.active_connections.keys())


# Global connection manager instance
manager = ConnectionManager()


# Notification types
class NotificationType:
    TOOL_ACCESS_UPDATED = "tool_access_updated"
    TOOL_DELETED = "tool_deleted"
    TOOL_CREATED = "tool_created"
    ROLE_CHANGED = "role_changed"
    USER_SUSPENDED = "user_suspended"
    USER_REACTIVATED = "user_reactivated"
    REFRESH_DASHBOARD = "refresh_dashboard"
    CREDENTIALS_UPDATED = "credentials_updated"


async def notify_tool_access_change(user_email: str, tool_ids: List[str], action: str = "updated"):
    """Notify user when their tool access changes"""
    await manager.send_to_user(user_email, {
        "type": NotificationType.TOOL_ACCESS_UPDATED,
        "action": action,
        "tool_ids": tool_ids,
        "message": f"Your tool access has been {action}"
    })


async def notify_tool_deleted(affected_users: List[str], tool_name: str, tool_id: str):
    """Notify all affected users when a tool is deleted"""
    await manager.send_to_users(affected_users, {
        "type": NotificationType.TOOL_DELETED,
        "tool_id": tool_id,
        "tool_name": tool_name,
        "message": f"Tool '{tool_name}' has been removed"
    })


async def notify_role_changed(user_email: str, new_role: str):
    """Notify user when their role changes"""
    await manager.send_to_user(user_email, {
        "type": NotificationType.ROLE_CHANGED,
        "new_role": new_role,
        "message": f"Your role has been changed to {new_role}"
    })


async def notify_user_status_changed(user_email: str, status: str):
    """Notify user when their account status changes"""
    notification_type = NotificationType.USER_SUSPENDED if status == "Suspended" else NotificationType.USER_REACTIVATED
    await manager.send_to_user(user_email, {
        "type": notification_type,
        "status": status,
        "message": f"Your account has been {status.lower()}"
    })


async def notify_refresh_dashboard(user_emails: List[str], reason: str = ""):
    """Tell specific users to refresh their dashboard"""
    await manager.send_to_users(user_emails, {
        "type": NotificationType.REFRESH_DASHBOARD,
        "reason": reason,
        "message": "Please refresh to see updates"
    })
