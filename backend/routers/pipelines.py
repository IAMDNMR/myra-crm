from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models
import auth
import uuid

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

@router.get("/")
def get_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("pipelines", "read"))):
    return db.query(models.Pipeline).offset(skip).limit(limit).all()

@router.get("/{item_id}")
def get_one(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("pipelines", "read"))):
    item = db.query(models.Pipeline).filter(models.Pipeline.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/")
def create(data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("pipelines", "write"))):
    item = models.Pipeline(id=str(uuid.uuid4()), **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{item_id}")
def update(item_id: str, data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("pipelines", "write"))):
    item = db.query(models.Pipeline).filter(models.Pipeline.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in data.items():
        if hasattr(item, key):
            setattr(item, key, value)
            
    db.commit()
    db.refresh(item)
    return item

@router.put("/{item_id}/set_default")
def set_default(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("pipelines", "write"))):
    # Set all other pipelines to is_default = False
    db.query(models.Pipeline).update({"is_default": False})
    
    item = db.query(models.Pipeline).filter(models.Pipeline.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_default = True
    db.commit()
    return {"status": "success"}

@router.delete("/{item_id}")
def delete(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("pipelines", "delete"))):
    item = db.query(models.Pipeline).filter(models.Pipeline.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted"}
