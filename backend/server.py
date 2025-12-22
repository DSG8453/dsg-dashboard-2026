from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

# Import routers
from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.tools import router as tools_router
from routes.credentials import router as credentials_router
from routes.issues import router as issues_router
from routes.settings import router as settings_router
from routes.devices import router as devices_router
from database import connect_db, close_db

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

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "DSG Transport API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
