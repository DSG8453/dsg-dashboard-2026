import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

async def create_superadmin():
    # Connect to MongoDB
    mongo_url = "mongodb+srv://dsgadmin:Diamond3108@dsg-transport.ifwzxvg.mongodb.net/dsg-transport?retryWrites=true&w=majority"
    client = AsyncIOMotorClient(mongo_url)
    db = client["dsg-transport"]
    
    # Check if superadmin exists
    existing = await db.users.find_one({"email": "info@dsgtransport.net"})
    
    if existing:
        print("✅ Super Admin already exists!")
        print(f"Email: {existing['email']}")
        print(f"Role: {existing.get('role', 'N/A')}")
    else:
        # Hash password directly with bcrypt
        password = "admin123"
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        hashed_password = hashed.decode('utf-8')
        
        # Create Super Admin
        superadmin = {
            "email": "info@dsgtransport.net",
            "password": hashed_password,
            "name": "Super Admin",
            "role": "Super Administrator",
            "status": "Active",
            "access_level": "superadmin",
            "initials": "SA",
            "password_login_enabled": True,
            "two_step_verification": False,
            "created_at": "2025-01-12T00:00:00Z"
        }
        
        await db.users.insert_one(superadmin)
        print("✅ Super Admin created!")
        print("Email: info@dsgtransport.net")
        print("Password: admin123")
        print("⚠️  CHANGE PASSWORD AFTER FIRST LOGIN!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_superadmin())
