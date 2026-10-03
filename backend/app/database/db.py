import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# ---------------------------------------------------------------------------
# Load environment variables from backend/.env
# ---------------------------------------------------------------------------
# __file__ is the absolute path of THIS file (db.py).
# .parent      → backend/app/database/
# .parent.parent.parent → backend/
# So this always finds backend/.env regardless of where uvicorn is launched from.
_env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. "
        "Make sure backend/.env exists and contains DATABASE_URL."
    )

# ---------------------------------------------------------------------------
# SQLAlchemy Engine
# ---------------------------------------------------------------------------
# The engine is the object that knows HOW to talk to the database.
# pool_pre_ping=True tells SQLAlchemy to check the connection is still alive
# before using it — useful when XAMPP restarts between coding sessions.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
# A "session" is like a temporary workspace for one request.
# autocommit=False  → we manually commit (safer, no accidental writes)
# autoflush=False   → we control when SQLAlchemy sends SQL to MySQL
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------------------------------------------------------------
# Base class for future ORM models
# ---------------------------------------------------------------------------
# When we later define models (e.g. Event, Photo), they will inherit from
# this Base so SQLAlchemy knows which tables to manage.
class Base(DeclarativeBase):
    pass

# ---------------------------------------------------------------------------
# Dependency: get_db
# ---------------------------------------------------------------------------
# FastAPI calls this function automatically for every route that needs a DB
# session.  The "yield" makes it a generator: code before yield = setup,
# code after yield = teardown (always runs, even if an error occurs).
def get_db():
    db = SessionLocal()
    try:
        yield db          # hand the session to the route handler
    finally:
        db.close()        # always close the session when the request ends
