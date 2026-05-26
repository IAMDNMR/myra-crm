from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from database import Base
import uuid
from datetime import datetime

def generate_uuid():
    return str(uuid.uuid4())

class MailingList(Base):
    __tablename__ = "mailing_lists"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class MailingListContact(Base):
    __tablename__ = "mailing_list_contacts"
    id = Column(String, primary_key=True, default=generate_uuid)
    list_id = Column(String, ForeignKey("mailing_lists.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(String, primary_key=True, default=generate_uuid)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    target_type = Column(String, nullable=False)  # all, selected, list
    list_id = Column(String, ForeignKey("mailing_lists.id", ondelete="SET NULL"), nullable=True)
    recipients = Column(Integer, default=0)
    status = Column(String, default="sent")  # sent, draft
    sent_by = Column(String, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
