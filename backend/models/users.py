from sqlalchemy import Column, String, Enum, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
import enum
from database import Base
import uuid
from datetime import datetime

def generate_uuid():
    return str(uuid.uuid4())

class AppRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    rep = "rep"
    read_only = "read_only"

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True, default=generate_uuid)
    full_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True)
    legacy_role = Column('role', Enum(AppRole), default=AppRole.admin)
    role_id = Column(String, ForeignKey("roles.id"), nullable=True)
    role_obj = relationship("Role")
    
    @property
    def role_name(self):
        return self.role_obj.name if self.role_obj else (self.legacy_role.value if self.legacy_role else "read_only")
    
    avatar_url = Column(String, nullable=True)
    teams_webhook_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    hashed_password = Column(String, nullable=False)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
