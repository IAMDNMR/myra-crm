from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import auth
import uuid
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/quotes", tags=["quotes"])

class LineItemSchema(BaseModel):
    product_id: str
    quantity: int
    unit_price: float

class QuoteCreateSchema(BaseModel):
    deal_id: str
    quote_number: str
    valid_until: Optional[str] = None
    line_items: List[LineItemSchema]

@router.get("/")
def get_all(deal_id: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("quotes", "read"))):
    q = db.query(models.Quote)
    if deal_id:
        q = q.filter(models.Quote.deal_id == deal_id)
    quotes = q.order_by(models.Quote.created_at.desc()).all()
    
    # Eager load isn't setup natively on models right now, so we do manual mapping or just join.
    # We will return the line items manually since it's a simple app.
    result = []
    for qt in quotes:
        items = db.query(models.QuoteLineItem).filter(models.QuoteLineItem.quote_id == qt.id).all()
        # attach products to items
        items_with_prod = []
        for it in items:
            prod = db.query(models.Product).filter(models.Product.id == it.product_id).first()
            items_with_prod.append({
                "id": it.id,
                "product_id": it.product_id,
                "product_name": prod.name if prod else "Unknown",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
            })
        result.append({
            "id": qt.id,
            "deal_id": qt.deal_id,
            "quote_number": qt.quote_number,
            "status": qt.status,
            "total_amount": qt.total_amount,
            "valid_until": qt.valid_until,
            "created_at": qt.created_at,
            "line_items": items_with_prod
        })
    return result

@router.post("/")
def create(data: QuoteCreateSchema, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("quotes", "write"))):
    total = sum([item.quantity * item.unit_price for item in data.line_items])
    
    valid_until_dt = None
    if data.valid_until:
        try:
            valid_until_dt = datetime.fromisoformat(data.valid_until.replace("Z", "+00:00"))
        except:
            pass

    quote = models.Quote(
        id=str(uuid.uuid4()),
        deal_id=data.deal_id,
        quote_number=data.quote_number,
        total_amount=total,
        valid_until=valid_until_dt,
        created_by=current_user.id
    )
    db.add(quote)
    db.flush() # get id

    for li in data.line_items:
        line_item = models.QuoteLineItem(
            id=str(uuid.uuid4()),
            quote_id=quote.id,
            product_id=li.product_id,
            quantity=li.quantity,
            unit_price=li.unit_price
        )
        db.add(line_item)
    
    db.commit()
    db.refresh(quote)
    return quote

@router.put("/{item_id}")
def update_status(item_id: str, data: dict, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("quotes", "write"))):
    quote = db.query(models.Quote).filter(models.Quote.id == item_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if "status" in data:
        quote.status = data["status"]
    db.commit()
    db.refresh(quote)
    return quote

@router.delete("/{item_id}")
def delete(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("quotes", "delete"))):
    quote = db.query(models.Quote).filter(models.Quote.id == item_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # cascade delete items
    db.query(models.QuoteLineItem).filter(models.QuoteLineItem.quote_id == item_id).delete()
    db.delete(quote)
    db.commit()
    return {"status": "deleted"}
