from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import models
from database import get_db
import auth

router = APIRouter(prefix="/settings", tags=["Settings"])

# Schemas
class LeadSourceCreate(BaseModel):
    name: str
    is_active: bool = True
    order_index: int = 0

class LeadSourceResponse(LeadSourceCreate):
    id: str

    class Config:
        orm_mode = True

class CustomFieldDefinitionCreate(BaseModel):
    entity_type: str
    name: str
    label: str
    field_type: str = "text"

class CustomFieldDefinitionResponse(CustomFieldDefinitionCreate):
    id: str

    class Config:
        orm_mode = True

# Lead Sources
@router.get("/lead-sources", response_model=List[LeadSourceResponse])
def get_lead_sources(db: Session = Depends(get_db)):
    return db.query(models.LeadSource).order_by(models.LeadSource.order_index).all()

@router.post("/lead-sources", response_model=LeadSourceResponse)
def create_lead_source(
    source: LeadSourceCreate,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(auth.get_current_user)
):
    if current_user.role_name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can configure lead sources")
    
    db_source = models.LeadSource(**source.dict())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source

@router.put("/lead-sources/{source_id}", response_model=LeadSourceResponse)
def update_lead_source(
    source_id: str,
    source: LeadSourceCreate,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(auth.get_current_user)
):
    if current_user.role_name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can configure lead sources")
        
    db_source = db.query(models.LeadSource).filter(models.LeadSource.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    for key, value in source.dict().items():
        setattr(db_source, key, value)
        
    db.commit()
    db.refresh(db_source)
    return db_source

@router.delete("/lead-sources/{source_id}")
def delete_lead_source(
    source_id: str,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(auth.get_current_user)
):
    if current_user.role_name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can configure lead sources")
        
    db_source = db.query(models.LeadSource).filter(models.LeadSource.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    db.delete(db_source)
    db.commit()
    return {"ok": True}

# Custom Field Definitions
@router.get("/custom-fields/{entity_type}", response_model=List[CustomFieldDefinitionResponse])
def get_custom_fields(entity_type: str, db: Session = Depends(get_db)):
    return db.query(models.CustomFieldDefinition).filter(models.CustomFieldDefinition.entity_type == entity_type).all()

@router.post("/custom-fields", response_model=CustomFieldDefinitionResponse)
def create_custom_field(
    field: CustomFieldDefinitionCreate,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(auth.get_current_user)
):
    # Only allow creation, standard users might need to create fields dynamically during import
    # But let's restrict to users with some permission if needed. For now allow authenticated users to define fields.
    db_field = models.CustomFieldDefinition(**field.dict())
    db.add(db_field)
    try:
        db.commit()
        db.refresh(db_field)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Field creation failed, perhaps name already exists.")
    return db_field
