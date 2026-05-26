from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
import models
import auth
from database import engine, get_db
from seed import seed_defaults

# Create all tables in the database
models.Base.metadata.create_all(bind=engine)
seed_defaults()

from contextlib import asynccontextmanager
import asyncio
from imap_sync import email_sync_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background IMAP sync
    task = asyncio.create_task(email_sync_loop())
    yield
    task.cancel()

app = FastAPI(title="MYRA CRM API", description="Manage Your Relationships & Activities", version="1.0.0", lifespan=lifespan)

from routers import contacts
from routers import companies
import os
from dotenv import load_dotenv

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Configure CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:8080"], # For production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contacts.router)
app.include_router(companies.router)

from routers import leads, deals, pipelines, stages, tasks, activities, task_statuses, profiles, support, products, quotes, webhooks, documents, notifications, mailer, deal_stage_history, roles, permissions, email_templates
app.include_router(leads.router)
app.include_router(deals.router)
app.include_router(pipelines.router)
app.include_router(stages.router)
app.include_router(tasks.router)
app.include_router(activities.router)
app.include_router(task_statuses.router)
app.include_router(profiles.router)
app.include_router(support.router)
app.include_router(products.router)
app.include_router(quotes.router)
app.include_router(webhooks.router)
app.include_router(documents.router)
app.include_router(notifications.router)
app.include_router(mailer.router)
app.include_router(deal_stage_history.router)
app.include_router(roles.router)
app.include_router(permissions.router)
app.include_router(email_templates.router)

from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None

class Token(BaseModel):
    access_token: str
    token_type: str

class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str

    class Config:
        orm_mode = True


class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/auth/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.Profile).filter(models.Profile.email == login_data.username).first()
    if not user or not auth.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str

@app.post("/auth/signup")
def signup(signup_data: SignupRequest, db: Session = Depends(get_db)):
    existing_user = db.query(models.Profile).filter(models.Profile.email == signup_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(signup_data.password)
    import uuid
    new_user = models.Profile(
        id=str(uuid.uuid4()),
        email=signup_data.email,
        full_name=signup_data.full_name,
        hashed_password=hashed_password,
        legacy_role="read_only" # default for security
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = auth.create_access_token(data={"sub": new_user.id})
    return {"access_token": access_token}

@app.get("/auth/me")
def get_me(current_user: models.Profile = Depends(auth.get_current_user)):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role_name,
        "avatar_url": current_user.avatar_url,
        "permissions": [f"{p.resource}:{p.action}" for p in getattr(current_user.role_obj, "permissions", [])]
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}
