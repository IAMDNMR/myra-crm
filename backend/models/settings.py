from sqlalchemy import Column, String, Integer, Boolean, DateTime
from database import Base
import uuid
from datetime import datetime

def generate_uuid():
    return str(uuid.uuid4())

class LeadSource(Base):
    __tablename__ = "lead_sources"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class CustomFieldDefinition(Base):
    __tablename__ = "custom_field_definitions"
    id = Column(String, primary_key=True, default=generate_uuid)
    entity_type = Column(String, nullable=False, index=True) # e.g. "lead"
    name = Column(String, nullable=False) # Internal key, e.g. "custom_industry"
    label = Column(String, nullable=False) # Display name, e.g. "Industry"
    field_type = Column(String, default="text") # text, number, date
    created_at = Column(DateTime, default=datetime.utcnow)
