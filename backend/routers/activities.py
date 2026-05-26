from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models
import auth
import uuid
from email_sender import send_email

router = APIRouter(prefix="/activities", tags=["activities"])

class ActivityCreateRequest(BaseModel):
    type: str
    subject: Optional[str] = None
    body: Optional[str] = None
    contact_id: Optional[str] = None
    deal_id: Optional[str] = None
    user_id: Optional[str] = None
    send_email: Optional[bool] = False

@router.get("/")
def get_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    total = db.query(models.Activity).count()
    items = db.query(models.Activity).offset(skip).limit(limit).all()
    return {"items": items, "total": total}

@router.get("/{item_id}")
def get_one(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.Activity).filter(models.Activity.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/")
def create(data: ActivityCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = models.Activity(
        id=str(uuid.uuid4()),
        type=data.type,
        subject=data.subject,
        body=data.body,
        contact_id=data.contact_id,
        deal_id=data.deal_id,
        user_id=data.user_id or current_user.id
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    if data.send_email and data.type == "email" and data.contact_id:
        contact = db.query(models.Contact).filter(models.Contact.id == data.contact_id).first()
        if contact and contact.email:
            background_tasks.add_task(send_email, contact.email, data.subject, data.body, reply_to=current_user.email)

    return item

@router.put("/{item_id}")
def update(item_id: str, data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.Activity).filter(models.Activity.id == item_id).first()
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
    item = db.query(models.Activity).filter(models.Activity.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted"}
