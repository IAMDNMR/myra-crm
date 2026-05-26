from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import uuid
from datetime import datetime
from sqlalchemy import DateTime

def generate_uuid():
    return str(uuid.uuid4())

class Permission(Base):
    __tablename__ = "permissions"
    id = Column(String, primary_key=True, default=generate_uuid)
    resource = Column(String, nullable=False) # e.g., 'deals', 'contacts', 'settings'
    action = Column(String, nullable=False)   # e.g., 'read', 'write', 'delete', 'manage'
    description = Column(String, nullable=True)

class Role(Base):
    __tablename__ = "roles"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)
    is_system = Column(Boolean, default=False) # True for default roles (admin, manager, etc)
    created_at = Column(DateTime, default=datetime.utcnow)

class RolePermission(Base):
    __tablename__ = "role_permissions"
    id = Column(String, primary_key=True, default=generate_uuid)
    role_id = Column(String, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(String, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

