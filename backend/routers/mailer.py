from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models
import auth
import uuid
import csv
import io
from email_sender import send_email

router = APIRouter(prefix="/mailer", tags=["mailer"])

# ── Schemas ──────────────────────────────────────────────────

class SendEmailRequest(BaseModel):
    subject: str
    body: str
    target_type: str  # "all", "selected", "list"
    list_id: Optional[str] = None
    contact_ids: Optional[List[str]] = None

class SingleEmailRequest(BaseModel):
    to_email: str
    to_name: Optional[str] = None
    subject: str
    body: str

class MailingListCreate(BaseModel):
    name: str
    description: Optional[str] = None

# ── Mailing Lists ───────────────────────────────────────────

@router.get("/lists")
def get_lists(db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("mailer", "read"))):
    lists = db.query(models.MailingList).order_by(models.MailingList.created_at.desc()).all()
    result = []
    for ml in lists:
        count = db.query(models.MailingListContact).filter(models.MailingListContact.list_id == ml.id).count()
        result.append({
            "id": ml.id,
            "name": ml.name,
            "description": ml.description,
            "created_at": ml.created_at,
            "contact_count": count
        })
    return result

@router.post("/lists")
def create_list(data: MailingListCreate, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("mailer", "write"))):
    ml = models.MailingList(id=str(uuid.uuid4()), name=data.name, description=data.description)
    db.add(ml)
    db.commit()
    db.refresh(ml)
    return ml

@router.delete("/lists/{list_id}")
def delete_list(list_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("mailer", "delete"))):
    ml = db.query(models.MailingList).filter(models.MailingList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")
    # Delete associations first
    db.query(models.MailingListContact).filter(models.MailingListContact.list_id == list_id).delete()
    db.delete(ml)
    db.commit()
    return {"status": "deleted"}

@router.post("/lists/{list_id}/upload")
async def upload_csv(list_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("mailer", "write"))):
    ml = db.query(models.MailingList).filter(models.MailingList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")

    contents = await file.read()
    decoded = contents.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))

    added_count = 0
    skipped_count = 0
    for row in reader:
        row_clean = {k.strip().lower() if k else '': v.strip() for k, v in row.items()}
        email = row_clean.get('email')
        if not email:
            skipped_count += 1
            continue

        contact = db.query(models.Contact).filter(models.Contact.email == email).first()
        if not contact:
            first_name = row_clean.get('first_name', '')
            if not first_name and 'name' in row_clean:
                parts = row_clean['name'].split(' ', 1)
                first_name = parts[0]
            last_name = row_clean.get('last_name', '')
            if not last_name and 'name' in row_clean and len(row_clean['name'].split(' ', 1)) > 1:
                last_name = row_clean['name'].split(' ', 1)[1]

            contact = models.Contact(
                id=str(uuid.uuid4()),
                first_name=first_name,
                last_name=last_name,
                email=email,
                source="Mailing List Upload"
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)

        link = db.query(models.MailingListContact).filter_by(list_id=ml.id, contact_id=contact.id).first()
        if not link:
            new_link = models.MailingListContact(id=str(uuid.uuid4()), list_id=ml.id, contact_id=contact.id)
            db.add(new_link)
            added_count += 1
        else:
            skipped_count += 1

    db.commit()
    return {"message": f"Added {added_count} contacts. Skipped {skipped_count}.", "added": added_count, "skipped": skipped_count}

# ── Campaigns ────────────────────────────────────────────────

@router.get("/campaigns")
def get_campaigns(db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("mailer", "read"))):
    campaigns = db.query(models.Campaign).order_by(models.Campaign.created_at.desc()).all()
    result = []
    for c in campaigns:
        sender = db.query(models.Profile).filter(models.Profile.id == c.sent_by).first()
        ml = db.query(models.MailingList).filter(models.MailingList.id == c.list_id).first() if c.list_id else None
        result.append({
            "id": c.id,
            "subject": c.subject,
            "body": c.body,
            "target_type": c.target_type,
            "list_name": ml.name if ml else None,
            "recipients": c.recipients,
            "status": c.status,
            "sent_by_name": sender.full_name if sender else "Unknown",
            "created_at": c.created_at,
        })
    return result

@router.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("mailer", "delete"))):
    c = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(c)
    db.commit()
    return {"status": "deleted"}

# ── Send Bulk Campaign ──────────────────────────────────────

@router.post("/send")
def send_campaign(data: SendEmailRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("mailer", "write"))):
    contacts = []

    if data.target_type == "all":
        contacts = db.query(models.Contact).filter(models.Contact.email.isnot(None), models.Contact.email != "").all()
    elif data.target_type == "selected":
        if not data.contact_ids:
            raise HTTPException(status_code=400, detail="No contacts selected")
        contacts = db.query(models.Contact).filter(models.Contact.id.in_(data.contact_ids), models.Contact.email.isnot(None)).all()
    elif data.target_type == "list":
        if not data.list_id:
            raise HTTPException(status_code=400, detail="No list selected")
        links = db.query(models.MailingListContact).filter(models.MailingListContact.list_id == data.list_id).all()
        contact_ids = [link.contact_id for link in links]
        if not contact_ids:
            raise HTTPException(status_code=400, detail="Selected list has no contacts")
        contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids), models.Contact.email.isnot(None)).all()

    sent_count = 0
    for contact in contacts:
        if not contact.email:
            continue
        body = data.body
        body = body.replace("{{first_name}}", contact.first_name or "there")
        body = body.replace("{{last_name}}", contact.last_name or "")
        body = body.replace("{{email}}", contact.email or "")
        body = body.replace("{{company}}", "")

        subject = data.subject
        subject = subject.replace("{{first_name}}", contact.first_name or "there")
        subject = subject.replace("{{last_name}}", contact.last_name or "")

        background_tasks.add_task(send_email, contact.email, subject, body, reply_to=current_user.email)
        sent_count += 1

    # Save campaign record
    campaign = models.Campaign(
        id=str(uuid.uuid4()),
        subject=data.subject,
        body=data.body,
        target_type=data.target_type,
        list_id=data.list_id,
        recipients=sent_count,
        status="sent",
        sent_by=current_user.id
    )
    db.add(campaign)
    db.commit()

    return {"message": f"Campaign sent to {sent_count} recipients.", "recipients": sent_count, "campaign_id": campaign.id}

# ── Send Single Email ───────────────────────────────────────

@router.post("/send-single")
def send_single(data: SingleEmailRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("mailer", "write"))):
    body = data.body
    body = body.replace("{{first_name}}", data.to_name or "there")

    background_tasks.add_task(send_email, data.to_email, data.subject, body, reply_to=current_user.email)

    # Save as campaign with 1 recipient
    campaign = models.Campaign(
        id=str(uuid.uuid4()),
        subject=data.subject,
        body=data.body,
        target_type="single",
        recipients=1,
        status="sent",
        sent_by=current_user.id
    )
    db.add(campaign)
    db.commit()

    return {"message": f"Email sent to {data.to_email}", "campaign_id": campaign.id}
