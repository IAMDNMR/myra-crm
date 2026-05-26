from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
import auth
import models
import os
from email_sender import send_email

router = APIRouter(prefix="/support", tags=["support"])

class ContactAdminRequest(BaseModel):
    subject: str
    message: str

@router.post("/contact-admin")
def contact_admin(data: ContactAdminRequest, background_tasks: BackgroundTasks, current_user: models.Profile = Depends(auth.require_permission("support", "write"))):
    admin_email = os.getenv("SUPERUSER_EMAIL")
    if not admin_email:
        raise HTTPException(status_code=500, detail="Admin email is not configured on the server.")
    
    subject = f"Support Request from {current_user.full_name or current_user.email}: {data.subject}"
    body = f"User: {current_user.full_name} ({current_user.email})\nRole: {current_user.role}\n\nMessage:\n{data.message}"
    
    background_tasks.add_task(send_email, admin_email, subject, body, reply_to=current_user.email)
    
    return {"status": "success", "message": "Your message has been sent to the administrator."}
