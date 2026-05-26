from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, ConfigDict
import models
import auth
from database import get_db

router = APIRouter(
    prefix="/companies",
    tags=["companies"],
    dependencies=[Depends(auth.get_current_user)]
)

class CompanyBase(BaseModel):
    name: str
    domain: str | None = None
    industry: str | None = None
    size: str | None = None
    website: str | None = None
    owner_id: str | None = None

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    name: str | None = None

class CompanyResponse(CompanyBase):
    id: str
    created_at: str
    model_config = ConfigDict(from_attributes=True)

@router.get("/")
def read_companies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    total = db.query(models.Company).count()
    companies = db.query(models.Company).offset(skip).limit(limit).all()
    for c in companies:
        c.created_at = c.created_at.isoformat() if c.created_at else None
    
    return {
        "items": [CompanyResponse.model_validate(c).model_dump() for c in companies],
        "total": total
    }

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import csv
import io

@router.post("/", response_model=CompanyResponse)
def create_company(company: CompanyCreate, db: Session = Depends(get_db)):
    # Module 4: Duplicate Detection
    if company.domain:
        existing = db.query(models.Company).filter(models.Company.domain == company.domain).first()
        if existing:
            raise HTTPException(status_code=409, detail="A company with this domain already exists.")
            
    db_company = models.Company(**company.model_dump())
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    db_company.created_at = db_company.created_at.isoformat() if db_company.created_at else None
    return db_company

@router.post("/import")
async def import_companies(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")
        
    content = await file.read()
    try:
        decoded = content.decode('utf-8')
    except Exception:
        decoded = content.decode('latin-1')
        
    reader = csv.DictReader(io.StringIO(decoded))
    
    def get_val(row, *keys):
        for k in keys:
            if k in row and row[k].strip():
                return row[k].strip()
        return None

    imported_count = 0
    skipped_count = 0
    
    for row in reader:
        row = {k.strip().lower(): v for k, v in row.items() if k}
        
        name = get_val(row, 'name', 'company name', 'company')
        domain = get_val(row, 'domain', 'website domain')
        industry = get_val(row, 'industry')
        size = get_val(row, 'size', 'employees', 'company size')
        website = get_val(row, 'website', 'url')
        
        if not name:
            skipped_count += 1
            continue
            
        if domain:
            existing = db.query(models.Company).filter(models.Company.domain == domain).first()
            if existing:
                skipped_count += 1
                continue
                
        new_company = models.Company(
            name=name,
            domain=domain,
            industry=industry,
            size=size,
            website=website
        )
        db.add(new_company)
        imported_count += 1
        
    db.commit()
    return {"message": f"Successfully imported {imported_count} companies. Skipped {skipped_count} duplicates/invalid rows."}

@router.get("/{company_id}", response_model=CompanyResponse)
def read_company(company_id: str, db: Session = Depends(get_db)):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    company.created_at = company.created_at.isoformat() if company.created_at else None
    return company

@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(company_id: str, company: CompanyUpdate, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if db_company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    update_data = company.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_company, key, value)
        
    db.commit()
    db.refresh(db_company)
    db_company.created_at = db_company.created_at.isoformat() if db_company.created_at else None
    return db_company

@router.delete("/{company_id}")
def delete_company(company_id: str, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if db_company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    db.delete(db_company)
    db.commit()
    return {"message": "Company deleted"}
