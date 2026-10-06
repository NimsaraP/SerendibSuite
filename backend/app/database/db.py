import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# ---------------------------------------------------------------------------
# Load environment variables from backend/.env
# ---------------------------------------------------------------------------
_env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

# Storage directory for local files and SQLite fallback
_storage_dir = Path(__file__).resolve().parents[3] / "storage"
_storage_dir.mkdir(parents=True, exist_ok=True)


def _try_init_mysql(url_str: str):
    """
    Attempts connecting to MySQL.
    If MySQL server is reachable, auto-creates database if it doesn't exist yet,
    so the user does not need to manually configure it in phpMyAdmin.
    """
    from sqlalchemy.engine.url import make_url
    url = make_url(url_str)
    db_name = url.database

    # Connect to MySQL server root (without specific database) to ensure database exists
    root_url = url.set(database="")
    root_engine = create_engine(root_url, pool_pre_ping=True)
    with root_engine.connect() as conn:
        if db_name:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
            conn.commit()
    root_engine.dispose()

    # Connect directly to the target database
    target_engine = create_engine(url_str, pool_pre_ping=True)
    with target_engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return target_engine


# ---------------------------------------------------------------------------
# Database Engine Initialization with Resilient XAMPP & SQLite Fallback
# ---------------------------------------------------------------------------
engine = None
DB_DRIVER = "sqlite"
IS_XAMPP = False

if DATABASE_URL and not DATABASE_URL.startswith("sqlite"):
    # 1. Try configured MySQL URL (e.g. port 3314)
    try:
        engine = _try_init_mysql(DATABASE_URL)
        DB_DRIVER = "mysql"
        IS_XAMPP = True
        print(f"[db] Connected to XAMPP MySQL successfully: {DATABASE_URL}")
    except Exception as exc1:
        # 2. Try default MySQL port 3306 in case user's XAMPP runs on default port
        if "3314" in DATABASE_URL:
            alt_url = DATABASE_URL.replace("3314", "3306")
            try:
                engine = _try_init_mysql(alt_url)
                DB_DRIVER = "mysql"
                IS_XAMPP = True
                DATABASE_URL = alt_url
                print(f"[db] Connected to XAMPP MySQL on default port 3306: {alt_url}")
            except Exception:
                pass

        if not engine:
            print(f"[db] Notice: Could not connect to XAMPP MySQL ({exc1}).")
            print("[db] Operating in Standalone mode without XAMPP. Falling back to SQLite automatically.")

if not engine:
    # Fallback to local SQLite database in storage/
    sqlite_path = _storage_dir / "serendibsuite.db"
    DATABASE_URL = f"sqlite:///{sqlite_path.as_posix()}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    DB_DRIVER = "sqlite"
    IS_XAMPP = False
    print(f"[db] Standalone SQLite database active: {DATABASE_URL}")

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------------------------------------------------------------
# Base class for ORM models
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass

# ---------------------------------------------------------------------------
# Dependency: get_db
# ---------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
