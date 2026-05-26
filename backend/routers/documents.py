from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import auth
import uuid
import os
import aiofiles
from typing import Optional

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.get("/")
def get_documents(deal_id: Optional[str] = None, contact_id: Optional[str] = None, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("documents", "read"))):
    q = db.query(models.Document)
    if deal_id:
        q = q.filter(models.Document.deal_id == deal_id)
    if contact_id:
        q = q.filter(models.Document.contact_id == contact_id)
    return q.order_by(models.Document.created_at.desc()).all()

@router.post("/")
async def upload_document(
    file: UploadFile = File(...),
    deal_id: Optional[str] = Form(None),
    contact_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(auth.require_permission("documents", "write"))
):
    if not deal_id and not contact_id:
        raise HTTPException(status_code=400, detail="Must provide deal_id or contact_id")

    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    size = 0
    async with aiofiles.open(file_path, 'wb') as out_file:
        while content := await file.read(1024 * 1024):  # async read chunk
            await out_file.write(content)
            size += len(content)

    doc = models.Document(
        id=str(uuid.uuid4()),
        filename=file.filename,
        file_path=file_path,
        size_bytes=size,
        deal_id=deal_id,
        contact_id=contact_id,
        uploaded_by=current_user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    return doc

@router.get("/{item_id}/download")
def download_document(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("documents", "read"))):
    doc = db.query(models.Document).filter(models.Document.id == item_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File on disk not found")
        
    return FileResponse(path=doc.file_path, filename=doc.filename)

@router.delete("/{item_id}")
def delete_document(item_id: str, db: Session = Depends(get_db), current_user: models.Profile = Depends(auth.require_permission("documents", "delete"))):
    doc = db.query(models.Document).filter(models.Document.id == item_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except:
            pass
            
    db.delete(doc)
    db.commit()
    return {"status": "deleted"}
