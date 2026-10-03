from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.database.db import get_db, engine, Base
from backend.app.api.clients import router as clients_router

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

# Register feature routers.
# include_router() mounts all routes from clients.py into the main app.
app.include_router(clients_router)


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
    Attempts a minimal query against MySQL to confirm the connection works.
    """
    try:
        # text() wraps a raw SQL string safely.
        # "SELECT 1" is the simplest possible query — it returns the number 1.
        # If MySQL is running and reachable, this succeeds instantly.
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "connected",
        }
    except Exception as error:
        # Return a clear failure message WITHOUT exposing internal error details
        # to the outside world — only log the detail on the server side.
        print(f"[db-health] Connection failed: {error}")
        return {
            "status": "error",
            "database": "unreachable",
            "detail": "Could not connect to the database. Check XAMPP and .env.",
        }
