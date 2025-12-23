from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
import jwt

load_dotenv()

# Import routers
from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.tools import router as tools_router
from routes.credentials import router as credentials_router
from routes.issues import router as issues_router
from routes.settings import router as settings_router
from routes.devices import router as devices_router
from routes.activity_logs import router as activity_logs_router
from routes.ip_management import router as ip_management_router
from routes.secure_access import router as secure_access_router
from routes.gateway import router as gateway_router
from database import connect_db, close_db
from utils.websocket_manager import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_db()
    yield
    # Shutdown
    await close_db()

app = FastAPI(
    title="DSG Transport LLC API",
    description="Secure management portal API with encrypted credential storage",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(tools_router, prefix="/api/tools", tags=["Tools"])
app.include_router(credentials_router, prefix="/api/credentials", tags=["Credentials"])
app.include_router(issues_router, prefix="/api/issues", tags=["Issues"])
app.include_router(settings_router, prefix="/api/settings", tags=["Settings"])
app.include_router(devices_router, prefix="/api/devices", tags=["Devices"])
app.include_router(activity_logs_router, prefix="/api/activity-logs", tags=["Activity Logs"])
app.include_router(ip_management_router, prefix="/api/ip-management", tags=["IP Management"])
app.include_router(secure_access_router, prefix="/api/secure-access", tags=["Secure Access"])
app.include_router(gateway_router, prefix="/api/gateway", tags=["Tool Gateway"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "DSG Transport API"}


# WebSocket endpoint for real-time updates
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time dashboard updates"""
    try:
        # Verify JWT token
        secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key")
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        user_email = payload.get("sub")
        
        if not user_email:
            await websocket.close(code=4001)
            return
        
        # Connect user
        await manager.connect(websocket, user_email)
        
        try:
            while True:
                # Keep connection alive, listen for messages
                data = await websocket.receive_text()
                
                # Handle ping/pong for connection health
                if data == "ping":
                    await websocket.send_text("pong")
                    
        except WebSocketDisconnect:
            manager.disconnect(websocket)
            
    except jwt.ExpiredSignatureError:
        await websocket.close(code=4002)
    except jwt.InvalidTokenError:
        await websocket.close(code=4003)
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await websocket.close(code=4000)
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
