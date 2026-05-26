from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models
import auth
import uuid

router = APIRouter(prefix="/roles", tags=["roles"])

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = [] # list of permission_ids

@router.get("/")
def get_roles(db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    roles = db.query(models.Role).options(joinedload(models.Role.permissions)).all()
    result = []
    for r in roles:
        result.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "is_system": r.is_system,
            "permissions": [{"id": p.id, "resource": p.resource, "action": p.action} for p in r.permissions]
        })
    return result

@router.post("/")
def create_role(data: RoleCreate, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    if current_user.role_name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage roles")
    
    if db.query(models.Role).filter_by(name=data.name).first():
        raise HTTPException(status_code=400, detail="Role name already exists")
    
    role = models.Role(id=str(uuid.uuid4()), name=data.name, description=data.description)
    db.add(role)
    
    for pid in data.permissions:
        db.add(models.RolePermission(role_id=role.id, permission_id=pid))
        
    db.commit()
    db.refresh(role)
    return {"status": "success", "id": role.id}

@router.put("/{role_id}")
def update_role(role_id: str, data: RoleCreate, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    if current_user.role_name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage roles")
        
    role = db.query(models.Role).filter_by(id=role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    if role.is_system and data.name != role.name:
        raise HTTPException(status_code=400, detail="Cannot rename system roles")
        
    role.name = data.name
    role.description = data.description
    
    # Update permissions
    db.query(models.RolePermission).filter_by(role_id=role.id).delete()
    for pid in data.permissions:
        db.add(models.RolePermission(role_id=role.id, permission_id=pid))
        
    db.commit()
    return {"status": "success"}

@router.delete("/{role_id}")
def delete_role(role_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    if current_user.role_name != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage roles")
        
    role = db.query(models.Role).filter_by(id=role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
        
    # Reassign users to read_only
    read_only = db.query(models.Role).filter_by(name="read_only").first()
    db.query(models.Profile).filter_by(role_id=role.id).update({"role_id": read_only.id})
    
    db.delete(role)
    db.commit()
    return {"status": "deleted"}
