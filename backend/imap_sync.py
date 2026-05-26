import imaplib
import email
from email.header import decode_header
import os
import asyncio
from datetime import datetime
import uuid
import logging
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

IMAP_SERVER = os.getenv("IMAP_SERVER", "outlook.office365.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", 993))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

def parse_header(header_value):
    if not header_value:
        return ""
    decoded_parts = decode_header(header_value)
    result = ""
    for string, charset in decoded_parts:
        if isinstance(string, bytes):
            result += string.decode(charset or 'utf-8', errors='ignore')
        else:
            result += string
    return result

def extract_email(header_value):
    if "<" in header_value and ">" in header_value:
        return header_value.split("<")[1].split(">")[0].strip()
    return header_value.strip()

def sync_emails():
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("IMAP credentials not found. Skipping sync.")
        return

    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(SMTP_USERNAME, SMTP_PASSWORD)
        mail.select("inbox")

        # Search for unseen emails
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK" or not messages[0]:
            mail.logout()
            return

        email_ids = messages[0].split()
        
        db = SessionLocal()
        
        for email_id in email_ids:
            res, msg_data = mail.fetch(email_id, "(RFC822)")
            if res != "OK":
                continue

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    subject = parse_header(msg.get("Subject"))
                    from_header = parse_header(msg.get("From"))
                    to_header = parse_header(msg.get("To"))
                    
                    from_email = extract_email(from_header)
                    to_email = extract_email(to_header)
                    
                    # Extract Body
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get("Content-Disposition"))
                            if content_type == "text/plain" and "attachment" not in content_disposition:
                                body = part.get_payload(decode=True).decode(errors='ignore')
                                break
                    else:
                        body = msg.get_payload(decode=True).decode(errors='ignore')

                    # Find matching contact by email
                    contact = db.query(models.Contact).filter(
                        (models.Contact.email == from_email) | (models.Contact.email == to_email)
                    ).first()

                    if contact:
                        # Find an active deal for this contact, if any
                        deal = db.query(models.Deal).filter(models.Deal.contact_id == contact.id).first()
                        
                        activity = models.Activity(
                            id=str(uuid.uuid4()),
                            type="email",
                            subject=subject[:255] if subject else "No Subject",
                            body=body,
                            contact_id=contact.id,
                            deal_id=deal.id if deal else None,
                            logged_at=datetime.utcnow(),
                            user_id=contact.owner_id
                        )
                        db.add(activity)
                        db.commit()

        db.close()
        mail.logout()
    except Exception as e:
        logger.error(f"Error syncing emails: {e}")

async def email_sync_loop():
    while True:
        try:
            sync_emails()
        except Exception as e:
            logger.error(f"Sync loop error: {e}")
        await asyncio.sleep(60)  # Check every 60 seconds
