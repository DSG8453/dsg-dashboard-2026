import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# JWT Settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dsg-transport-super-secret-key-change-in-production-2025")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Credential encryption key - In production, store this securely!
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
try:
    fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except:
    # Generate new key if invalid
    ENCRYPTION_KEY = Fernet.generate_key()
    fernet = Fernet(ENCRYPTION_KEY)
    print(f"Generated new encryption key. Add to .env: ENCRYPTION_KEY={ENCRYPTION_KEY.decode()}")

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def encrypt_credential(plain_text: str) -> str:
    """Encrypt a credential using Fernet (AES-128-CBC)"""
    return fernet.encrypt(plain_text.encode()).decode()

def decrypt_credential(encrypted_text: str) -> str:
    """Decrypt a credential"""
    try:
        return fernet.decrypt(encrypted_text.encode()).decode()
    except:
        return "[Decryption Error]"
