from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.database.db import get_db, engine, Base, DB_DRIVER, IS_XAMPP
from backend.app.api.clients import router as clients_router
from backend.app.api.bookings import router as bookings_router
from backend.app.api.events import router as events_router
from backend.app.api.photos import router as photos_router

# Importing the models package triggers all six model files to load.
# This registers every table with Base.metadata so create_all() knows
# about them.
import backend.app.models  # noqa: F401

# Create the FastAPI application instance.
# The title and version appear in the auto-generated Swagger docs at /docs.
app = FastAPI(
    title="SerendibSuite API",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS — Cross-Origin Resource Sharing
# ---------------------------------------------------------------------------
# The browser blocks JavaScript from calling an API on a different "origin"
# (protocol + host + port).  When the HTML file is opened directly from disk
# (file://) or from a different port, FastAPI needs to tell the browser
# "this is allowed".
# allow_origins=["*"] permits all origins — fine for local development.
# Tighten this to ["http://localhost:5500"] etc. before going to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register feature routers.
# include_router() mounts all routes from the feature files into the main app.
from backend.app.api.auth import router as auth_router
app.include_router(auth_router)
app.include_router(clients_router)
app.include_router(bookings_router)
app.include_router(events_router)
app.include_router(photos_router)


@app.on_event("startup")
def create_tables():
    """
    Runs once when the server starts.
    Creates all tables that are registered with Base.metadata IF they do
    not already exist.  Safe to run repeatedly — it will never drop or
    overwrite existing tables.
    """
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health_check():
    """
    Health check endpoint.
    Call this to verify the API server is running correctly.
    """
    return {
        "status": "ok",
        "service": "SerendibSuite API",
    }


@app.get("/api/db-health")
def db_health_check(db: Session = Depends(get_db)):
    """
    Database connectivity check endpoint.
    Attempts a minimal query against the active database and reports
    whether it is connected to XAMPP MySQL or standalone SQLite.
    """
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "connected",
            "engine": DB_DRIVER,
            "is_xampp": IS_XAMPP,
            "mode": "XAMPP MySQL Connected" if IS_XAMPP else "Standalone Mode (SQLite Active)",
            "message": "Connected to local XAMPP MySQL database." if IS_XAMPP else "Operating in standalone mode with SQLite database. Site works smoothly without XAMPP.",
        }
    except Exception as error:
        print(f"[db-health] Connection failed: {error}")
        return {
            "status": "error",
            "database": "unreachable",
            "detail": "Could not connect to the database. Check XAMPP and .env.",
        }
