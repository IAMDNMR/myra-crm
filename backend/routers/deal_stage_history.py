from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
import models
import auth
import uuid
from database import get_db
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/deal_stage_history", tags=["deal_stage_history"])

class HistoryCreate(BaseModel):
    deal_id: str
    from_stage_id: Optional[str] = None
    to_stage_id: str
    changed_by: Optional[str] = None

@router.get("/")
def get_history(db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("deal_stage_history", "read"))):
    return db.query(models.DealStageHistory).options(
        joinedload(models.DealStageHistory.from_stage),
        joinedload(models.DealStageHistory.to_stage),
        joinedload(models.DealStageHistory.profiles)
    ).all()

@router.post("/")
def create_history(data: HistoryCreate, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("deal_stage_history", "write"))):
    history = models.DealStageHistory(
        id=str(uuid.uuid4()),
        deal_id=data.deal_id,
        from_stage_id=data.from_stage_id,
        to_stage_id=data.to_stage_id,
        changed_by=data.changed_by
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history
