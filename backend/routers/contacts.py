from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, ConfigDict
import models
import auth
from database import get_db

router = APIRouter(
    prefix="/contacts",
    tags=["contacts"],
    dependencies=[Depends(auth.get_current_user)]
)

class ContactBase(BaseModel):
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    title: str | None = None
    company_id: str | None = None
    owner_id: str | None = None
    source: str | None = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(ContactBase):
    first_name: str | None = None
    last_name: str | None = None

class ContactResponse(ContactBase):
    id: str
    created_at: str
    model_config = ConfigDict(from_attributes=True)

@router.get("/")
def read_contacts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    total = db.query(models.Contact).count()
    contacts = db.query(models.Contact).offset(skip).limit(limit).all()
    # Pydantic will convert datetime objects to string automatically, but we can also handle it explicitly
    for c in contacts:
        c.created_at = c.created_at.isoformat() if c.created_at else None
    
    # We serialize manually or use a new response model. Let's just return dict.
    return {
        "items": [ContactResponse.model_validate(c).model_dump() for c in contacts],
        "total": total
    }

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import csv
import io

@router.post("/", response_model=ContactResponse)
def create_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    # Module 4: Duplicate Detection
    if contact.email:
        existing = db.query(models.Contact).filter(models.Contact.email == contact.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="A contact with this email already exists.")
            
    db_contact = models.Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    db_contact.created_at = db_contact.created_at.isoformat() if db_contact.created_at else None
    return db_contact

@router.post("/import")
async def import_contacts(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")
        
    content = await file.read()
    try:
        decoded = content.decode('utf-8')
    except Exception:
        decoded = content.decode('latin-1')
        
    reader = csv.DictReader(io.StringIO(decoded))
    
    # Simple mapping heuristic
    def get_val(row, *keys):
        for k in keys:
            if k in row and row[k].strip():
                return row[k].strip()
        return None

    imported_count = 0
    skipped_count = 0
    
    for row in reader:
        # Standardize keys by lowercasing and stripping
        row = {k.strip().lower(): v for k, v in row.items() if k}
        
        first_name = get_val(row, 'first_name', 'first name', 'firstname', 'name')
        last_name = get_val(row, 'last_name', 'last name', 'lastname')
        email = get_val(row, 'email', 'email address')
        phone = get_val(row, 'phone', 'phone number', 'mobile')
        title = get_val(row, 'title', 'job title')
        
        if not first_name:
            skipped_count += 1
            continue
            
        if not last_name:
            last_name = "-" # Default if missing
            
        if email:
            existing = db.query(models.Contact).filter(models.Contact.email == email).first()
            if existing:
                skipped_count += 1
                continue
                
        new_contact = models.Contact(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            title=title
        )
        db.add(new_contact)
        imported_count += 1
        
    db.commit()
    return {"message": f"Successfully imported {imported_count} contacts. Skipped {skipped_count} duplicates/invalid rows."}

@router.get("/{contact_id}", response_model=ContactResponse)
def read_contact(contact_id: str, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact.created_at = contact.created_at.isoformat() if contact.created_at else None
    return contact

@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(contact_id: str, contact: ContactUpdate, db: Session = Depends(get_db)):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if db_contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    update_data = contact.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_contact, key, value)
        
    db.commit()
    db.refresh(db_contact)
    db_contact.created_at = db_contact.created_at.isoformat() if db_contact.created_at else None
    return db_contact

@router.delete("/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if db_contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    db.delete(db_contact)
    db.commit()
    return {"message": "Contact deleted"}
