import os

models_list = [
    ("Lead", "leads", "lead_data"),
    ("Deal", "deals", "deal_data"),
    ("Pipeline", "pipelines", "pipeline_data"),
    ("Stage", "stages", "stage_data"),
    ("Task", "tasks", "task_data"),
    ("Activity", "activities", "activity_data"),
    ("CustomTaskStatus", "task_statuses", "status_data"),
    ("Profile", "profiles", "profile_data")
]

template = """from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models
import auth
import uuid

router = APIRouter(prefix="/{route_name}", tags=["{route_name}"])

@router.get("/")
def get_all(db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    return db.query(models.{model_name}).all()

@router.get("/{{item_id}}")
def get_one(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.{model_name}).filter(models.{model_name}.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/")
def create(data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = models.{model_name}(id=str(uuid.uuid4()), **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{{item_id}}")
def update(item_id: str, data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.{model_name}).filter(models.{model_name}.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in data.items():
        if hasattr(item, key):
            setattr(item, key, value)
            
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{{item_id}}")
def delete(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.get_current_user)):
    item = db.query(models.{model_name}).filter(models.{model_name}.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {{"status": "deleted"}}
"""

os.makedirs("routers", exist_ok=True)

for model_name, route_name, var_name in models_list:
    filename = f"routers/{route_name}.py"
    if not os.path.exists(filename):
        with open(filename, "w") as f:
            f.write(template.format(model_name=model_name, route_name=route_name))
        print(f"Generated {filename}")
