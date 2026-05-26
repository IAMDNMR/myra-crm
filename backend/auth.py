import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-very-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080")) # 7 days default

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.Profile).filter(models.Profile.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

def require_permission(resource: str, action: str):
    def permission_dependency(current_user: models.Profile = Depends(get_current_user), db: Session = Depends(get_db)):
        # Admin overrides
        if current_user.role_name == "admin":
            return current_user
            
        if not current_user.role_id:
            raise HTTPException(status_code=403, detail="No role assigned")
            
        role = db.query(models.Role).filter(models.Role.id == current_user.role_id).first()
        if not role:
            raise HTTPException(status_code=403, detail="Role not found")
            
        # Check permissions
        has_perm = any(p.resource == resource and p.action == action for p in role.permissions)
        if not has_perm:
            raise HTTPException(status_code=403, detail=f"Permission denied: Requires {resource}:{action}")
            
        return current_user
    return permission_dependency
