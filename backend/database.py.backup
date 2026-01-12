import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "dsg_transport")

client: AsyncIOMotorClient = None
db = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.tools.create_index("name")
    await db.credentials.create_index([("user_id", 1), ("tool_id", 1)])
    await db.issues.create_index("user_id")
    
    print(f"Connected to MongoDB: {DB_NAME}")
    
    # Seed initial data if empty
    await seed_initial_data()

async def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")

async def get_db():
    return db

async def seed_initial_data():
    """Seed initial admin user and tools if database is empty"""
    from utils.security import hash_password
    
    # Check if admin exists
    admin = await db.users.find_one({"email": "admin@dsgtransport.com"})
    if not admin:
        # Create admin user
        admin_user = {
            "email": "admin@dsgtransport.com",
            "password": hash_password("admin123"),
            "name": "Admin User",
            "role": "Administrator",
            "status": "Active",
            "access_level": "full",
            "initials": "AU",
            "created_at": "2025-12-01T00:00:00Z"
        }
        await db.users.insert_one(admin_user)
        print("Admin user created")
        
        # Create sample users
        sample_users = [
            {
                "email": "john.smith@dsgtransport.com",
                "password": hash_password("john123"),
                "name": "John Smith",
                "role": "User",
                "status": "Active",
                "access_level": "standard",
                "initials": "JS",
                "created_at": "2025-12-05T00:00:00Z"
            },
            {
                "email": "sarah.johnson@dsgtransport.com",
                "password": hash_password("sarah123"),
                "name": "Sarah Johnson",
                "role": "User",
                "status": "Active",
                "access_level": "standard",
                "initials": "SJ",
                "created_at": "2025-12-08T00:00:00Z"
            }
        ]
        await db.users.insert_many(sample_users)
        print("Sample users created")
    
    # Check if tools exist
    tools_count = await db.tools.count_documents({})
    if tools_count == 0:
        tools = [
            {"name": "Bitwarden", "category": "Security", "description": "Password manager for secure credential storage and sharing across the team.", "icon": "Shield", "url": "https://vault.bitwarden.com"},
            {"name": "Zoho Assist", "category": "Support", "description": "Remote desktop support and control panel for IT assistance and troubleshooting.", "icon": "Monitor", "url": "https://assist.zoho.com"},
            {"name": "Ascend TMS", "category": "TMS", "description": "Transportation management system for fleet operations and logistics tracking.", "icon": "Truck", "url": "#"},
            {"name": "RMIS", "category": "Compliance", "description": "Risk management and compliance tracking system for regulatory requirements.", "icon": "FileCheck", "url": "#"},
            {"name": "DAT Load Board", "category": "Freight", "description": "Load board platform for finding and posting freight opportunities.", "icon": "Package", "url": "#"},
            {"name": "Truckstop", "category": "Freight", "description": "Freight matching and load board services for trucking companies.", "icon": "Cloud", "url": "#"},
            {"name": "Fleet Maintenance", "category": "Operations", "description": "Vehicle maintenance tracking and scheduling system for fleet management.", "icon": "Wrench", "url": "#"},
            {"name": "Fuel Cards Portal", "category": "Finance", "description": "Fuel card management and expense tracking for fleet operations.", "icon": "Database", "url": "#"},
        ]
        await db.tools.insert_many(tools)
        print("Default tools created")
    
    # Check if settings exist
    settings = await db.settings.find_one({"type": "support"})
    if not settings:
        await db.settings.insert_one({
            "type": "support",
            "whatsapp_number": "+1234567890",
            "support_email": "support@dsgtransport.com",
            "business_hours": "Mon-Fri 9AM-6PM EST"
        })
        print("Default settings created")
