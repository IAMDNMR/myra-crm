import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# We are using a local SQLite file for temporary testing so it acts as a "cache"
# This requires zero setup on your machine.
SQLITE_URL = "sqlite:///./temp_cache.db"

# connect_args={"check_same_thread": False} is needed for SQLite in FastAPI
engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False}, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
