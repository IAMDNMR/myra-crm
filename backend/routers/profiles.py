from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models
import auth
import uuid

router = APIRouter(prefix="/profiles", tags=["profiles"])

@router.get("/")
def get_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    return db.query(models.Profile).offset(skip).limit(limit).all()

@router.get("/{item_id}")
def get_one(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.Profile).filter(models.Profile.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/")
def create(data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add users")
    
    existing = db.query(models.Profile).filter(models.Profile.email == data.get("email")).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    raw_password = data.get("password", "Password123!")
    hashed_password = auth.get_password_hash(raw_password)
    
    item = models.Profile(
        id=str(uuid.uuid4()),
        email=data.get("email"),
        full_name=data.get("full_name"),
        role=data.get("role", "read_only"),
        hashed_password=hashed_password
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{item_id}")
def update(item_id: str, data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.Profile).filter(models.Profile.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in data.items():
        if hasattr(item, key):
            setattr(item, key, value)
            
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.Profile).filter(models.Profile.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted"}
