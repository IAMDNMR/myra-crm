from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

CRATE_URL = "crate://localhost:4200"
engine = create_engine(CRATE_URL)

try:
    with engine.connect() as conn:
        print("Successfully connected to CrateDB!")
except Exception as e:
    print("Failed to connect to CrateDB:")
    print(e)
