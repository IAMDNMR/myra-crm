from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
import enum
from database import Base
import uuid
from datetime import datetime

def generate_uuid():
    return str(uuid.uuid4())

class DealStatus(str, enum.Enum):
    open = "open"
    won = "won"
    lost = "lost"

class Pipeline(Base):
    __tablename__ = "pipelines"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Stage(Base):
    __tablename__ = "stages"
    id = Column(String, primary_key=True, default=generate_uuid)
    pipeline_id = Column(String, ForeignKey("pipelines.id"), nullable=False)
    name = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False)
    probability = Column(Float, nullable=False)
    color = Column(String, nullable=True)

class Deal(Base):
    __tablename__ = "deals"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    stage_id = Column(String, ForeignKey("stages.id"), nullable=True)
    pipeline_id = Column(String, ForeignKey("pipelines.id"), nullable=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)
    owner_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    close_date = Column(DateTime, nullable=True)
    probability = Column(Float, nullable=False)
    status = Column(Enum(DealStatus), default=DealStatus.open)
    lost_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DealStageHistory(Base):
    __tablename__ = "deal_stage_history"
    id = Column(String, primary_key=True, default=generate_uuid)
    deal_id = Column(String, ForeignKey("deals.id"), nullable=False)
    from_stage_id = Column(String, ForeignKey("stages.id"), nullable=True)
    to_stage_id = Column(String, ForeignKey("stages.id"), nullable=False)
    changed_by = Column(String, ForeignKey("profiles.id"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)

class QuoteStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    accepted = "accepted"
    rejected = "rejected"

class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    sku = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    unit_price = Column(Float, nullable=False, default=0.0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Quote(Base):
    __tablename__ = "quotes"
    id = Column(String, primary_key=True, default=generate_uuid)
    deal_id = Column(String, ForeignKey("deals.id"), nullable=False)
    quote_number = Column(String, nullable=False)
    status = Column(Enum(QuoteStatus), default=QuoteStatus.draft)
    total_amount = Column(Float, nullable=False, default=0.0)
    valid_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, ForeignKey("profiles.id"), nullable=True)

class QuoteLineItem(Base):
    __tablename__ = "quote_line_items"
    id = Column(String, primary_key=True, default=generate_uuid)
    quote_id = Column(String, ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False, default=0.0)
