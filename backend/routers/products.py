from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import auth
import uuid

router = APIRouter(prefix="/products", tags=["products"])

@router.get("/")
def get_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("products", "read"))):
    return db.query(models.Product).order_by(models.Product.name).offset(skip).limit(limit).all()

@router.get("/{item_id}")
def get_one(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("products", "read"))):
    item = db.query(models.Product).filter(models.Product.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/")
def create(data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("products", "write"))):
    item = models.Product(id=str(uuid.uuid4()), **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{item_id}")
def update(item_id: str, data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("products", "write"))):
    item = db.query(models.Product).filter(models.Product.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in data.items():
        if hasattr(item, key):
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("products", "delete"))):
    item = db.query(models.Product).filter(models.Product.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted"}
