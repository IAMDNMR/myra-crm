from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models
import auth
import uuid

router = APIRouter(prefix="/leads", tags=["leads"])

@router.get("/")
def get_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    return db.query(models.Lead).offset(skip).limit(limit).all()

@router.get("/{item_id}")
def get_one(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.Lead).filter(models.Lead.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/")
def create(data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = models.Lead(id=str(uuid.uuid4()), **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{item_id}")
def update(item_id: str, data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.Lead).filter(models.Lead.id == item_id).first()
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
    item = db.query(models.Lead).filter(models.Lead.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted"}

class ConvertLeadRequest(BaseModel):
    create_company: bool = True
    create_deal: bool = True
    deal_name: Optional[str] = None
    pipeline_id: Optional[str] = None
    stage_id: Optional[str] = None
    deal_value: Optional[float] = 0.0

@router.post("/{item_id}/convert")
def convert_lead(item_id: str, data: ConvertLeadRequest, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    lead = db.query(models.Lead).filter(models.Lead.id == item_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Split name into first and last
    parts = lead.name.split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    company_id = None
    if data.create_company and lead.company_name:
        company = models.Company(
            id=str(uuid.uuid4()),
            name=lead.company_name,
            owner_id=lead.owner_id or current_user.id
        )
        db.add(company)
        db.commit()
        company_id = company.id

    contact = models.Contact(
        id=str(uuid.uuid4()),
        first_name=first_name,
        last_name=last_name,
        email=lead.email,
        phone=lead.phone,
        company_id=company_id,
        source=lead.source,
        owner_id=lead.owner_id or current_user.id
    )
    db.add(contact)
    db.commit()
    
    # Add initial note to contact if lead has notes
    if lead.notes:
        activity = models.Activity(
            id=str(uuid.uuid4()),
            type=models.ActivityType.note,
            subject="Notes from Lead",
            body=lead.notes,
            contact_id=contact.id,
            user_id=current_user.id
        )
        db.add(activity)

    deal_id = None
    if data.create_deal:
        deal = models.Deal(
            id=str(uuid.uuid4()),
            name=data.deal_name or f"Deal with {lead.name}",
            value=data.deal_value,
            company_id=company_id,
            contact_id=contact.id,
            pipeline_id=data.pipeline_id,
            stage_id=data.stage_id,
            owner_id=lead.owner_id or current_user.id,
            status=models.DealStatus.open
        )
        db.add(deal)
        db.commit()
        deal_id = deal.id

    # Mark lead as qualified (or we could delete it)
    lead.status = models.LeadStatus.qualified
    db.commit()

    return {
        "status": "success",
        "contact_id": contact.id,
        "company_id": company_id,
        "deal_id": deal_id
    }
