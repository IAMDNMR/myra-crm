from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import uuid

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/leads")
async def create_lead_from_webhook(request: Request, db: Session = Depends(get_db)):
    # Support both JSON and Form Data
    try:
        data = await request.json()
    except:
        form_data = await request.form()
        data = dict(form_data)
    
    if "name" not in data and "first_name" not in data:
        raise HTTPException(status_code=400, detail="Name is required")

    name = data.get("name") or f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
    company_name = data.get("company_name") or data.get("company")
    email = data.get("email")
    phone = data.get("phone")
    notes = data.get("notes") or data.get("message")
    
    owner_id = data.get("owner_id")
    redirect_url = data.get("redirect_url")

    lead = models.Lead(
        id=str(uuid.uuid4()),
        name=name,
        company_name=company_name,
        email=email,
        phone=phone,
        notes=notes,
        source="Web Form",
        owner_id=owner_id if owner_id else None
    )
    db.add(lead)
    db.commit()
    
    if redirect_url:
        return RedirectResponse(url=redirect_url, status_code=303)
        
    return {"status": "success", "message": "Lead captured successfully"}
