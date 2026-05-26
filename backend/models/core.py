from sqlalchemy import Column, String, Integer, Text, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import enum
from database import Base
import uuid
from datetime import datetime

def generate_uuid():
    return str(uuid.uuid4())

class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    not_interested = "not_interested"
    qualified = "qualified"

class Company(Base):
    __tablename__ = "companies"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    domain = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    size = Column(String, nullable=True)
    website = Column(String, nullable=True)
    owner_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Lead(Base):
    __tablename__ = "leads"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    source = Column(String, nullable=True)
    status = Column(Enum(LeadStatus), default=LeadStatus.new)
    notes = Column(Text, nullable=True)
    owner_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(String, primary_key=True, default=generate_uuid)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    title = Column(String, nullable=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)
    owner_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False, default=0)
    deal_id = Column(String, ForeignKey("deals.id", ondelete="CASCADE"), nullable=True)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True)
    uploaded_by = Column(String, ForeignKey("profiles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
