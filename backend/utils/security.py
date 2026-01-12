import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Settings
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Get secrets from Secret Manager
try:
    from services.secret_manager_service import SecretManagerService
    secret_manager = SecretManagerService()
    SECRET_KEY = secret_manager.get_secret("jwt-secret") or os.getenv("JWT_SECRET_KEY", "fallback-dev-key")
    ENCRYPTION_KEY_VALUE = secret_manager.get_secret("encryption-key") or os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
except Exception as e:
    print(f"Warning: Could not load secrets from Secret Manager: {e}")
    SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-dev-key")
    ENCRYPTION_KEY_VALUE = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())

ENCRYPTION_KEY = ENCRYPTION_KEY_VALUE
fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def decode_token(token: str) -> dict:
    return verify_token(token)

def encrypt_credential(credential: str) -> str:
    return fernet.encrypt(credential.encode()).decode()

def decrypt_credential(encrypted_credential: str) -> str:
    return fernet.decrypt(encrypted_credential.encode()).decode()
