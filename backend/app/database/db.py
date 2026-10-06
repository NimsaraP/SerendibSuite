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

# Storage directory for local files and SQLite fallback
_storage_dir = Path(__file__).resolve().parents[3] / "storage"
_storage_dir.mkdir(parents=True, exist_ok=True)

if not DATABASE_URL:
    sqlite_path = _storage_dir / "serendibsuite.db"
    DATABASE_URL = f"sqlite:///{sqlite_path.as_posix()}"
    print(f"[db] DATABASE_URL not set in .env. Using default SQLite: {DATABASE_URL}")

# SQLAlchemy Engine with automatic resilient fallback
if not DATABASE_URL.startswith("sqlite"):
    try:
        test_engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        with test_engine.connect() as test_conn:
            test_conn.execute(text("SELECT 1"))
        engine = test_engine
        print(f"[db] Connected to MySQL successfully: {DATABASE_URL}")
    except Exception as exc:
        print(f"[db] Notice: Could not connect to MySQL server ({exc}). Falling back to SQLite automatically.")
        sqlite_path = _storage_dir / "serendibsuite.db"
        DATABASE_URL = f"sqlite:///{sqlite_path.as_posix()}"
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False},
        )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

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
