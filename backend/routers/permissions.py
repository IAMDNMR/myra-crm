from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models
import auth

router = APIRouter(prefix="/permissions", tags=["permissions"])

@router.get("/")
def get_permissions(db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    perms = db.query(models.Permission).all()
    # Group by resource for easier frontend consumption
    grouped = {}
    for p in perms:
        if p.resource not in grouped:
            grouped[p.resource] = []
        grouped[p.resource].append({
            "id": p.id,
            "action": p.action,
            "description": p.description
        })
    
    return [
        {"resource": res, "permissions": acts}
        for res, acts in grouped.items()
    ]
