from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from database import get_db
import models
import auth
import uuid

router = APIRouter(prefix="/email_templates", tags=["email_templates"])

class TemplateCreate(BaseModel):
    name: str
    subject: str
    body: str
    category: str | None = None
    created_by: str | None = None

@router.get("/")
def get_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("email_templates", "read"))):
    items = db.query(models.EmailTemplate).offset(skip).limit(limit).all()
    return items

@router.post("/")
def create(data: TemplateCreate, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("email_templates", "write"))):
    item = models.EmailTemplate(
        id=str(uuid.uuid4()),
        name=data.name,
        subject=data.subject,
        body=data.body,
        category=data.category,
        created_by=data.created_by
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("email_templates", "delete"))):
    item = db.query(models.EmailTemplate).filter(models.EmailTemplate.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted"}
