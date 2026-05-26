from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, ConfigDict
from database import get_db
import models
import auth

router = APIRouter(prefix="/notifications", tags=["notifications"])

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    message: str | None
    link: str | None
    is_read: bool
    created_at: str

    model_config = ConfigDict(from_attributes=True)

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("notifications", "read"))):
    items = db.query(models.Notification).filter(models.Notification.user_id == current_user.id).order_by(models.Notification.created_at.desc()).limit(50).all()
    for item in items:
        item.created_at = item.created_at.isoformat() if item.created_at else None
    return items

@router.put("/{notif_id}/read")
def mark_read(notif_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("notifications", "write"))):
    item = db.query(models.Notification).filter(models.Notification.id == notif_id, models.Notification.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = True
    db.commit()
    return {"status": "ok"}

@router.put("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("notifications", "write"))):
    db.query(models.Notification).filter(models.Notification.user_id == current_user.id, models.Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"status": "ok"}
