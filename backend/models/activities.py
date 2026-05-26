from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
import enum
from database import Base
import uuid
from datetime import datetime

def generate_uuid():
    return str(uuid.uuid4())

class ActivityType(str, enum.Enum):
    email = "email"
    call = "call"
    meeting = "meeting"
    note = "note"
    task = "task"

class TaskType(str, enum.Enum):
    call = "call"
    email = "email"
    meeting = "meeting"
    follow_up = "follow_up"
    demo = "demo"
    other = "other"

class Priority(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"

class Activity(Base):
    __tablename__ = "activities"
    id = Column(String, primary_key=True, default=generate_uuid)
    type = Column(Enum(ActivityType), nullable=False)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    deal_id = Column(String, ForeignKey("deals.id"), nullable=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True)
    user_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow)

class CustomTaskStatus(Base):
    __tablename__ = "custom_task_statuses"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)
    order_index = Column(Integer, default=0)
    is_closed_state = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(Enum(TaskType), nullable=False)
    due_date = Column(DateTime, nullable=True)
    priority = Column(Enum(Priority), nullable=False)
    status_id = Column(String, ForeignKey("custom_task_statuses.id"), nullable=True)
    assignee_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    deal_id = Column(String, ForeignKey("deals.id"), nullable=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class EmailTemplate(Base):
    __tablename__ = "email_templates"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("profiles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
