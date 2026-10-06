from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database.db import get_db
from backend.app.models.booking import Booking
from backend.app.models.client import Client
from backend.app.schemas.booking import BookingCreate, BookingRead

# -----------------------------------------------------------------------------
# Router
# -----------------------------------------------------------------------------
# prefix="/api/bookings" means every route defined below starts with that path.
# tags=["bookings"] groups them under "bookings" in the Swagger UI at /docs.
router = APIRouter(prefix="/api/bookings", tags=["bookings"])


# -----------------------------------------------------------------------------
# POST /api/bookings/  — Create a new booking
# -----------------------------------------------------------------------------
@router.post(
    "/",
    response_model=BookingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db)):
    """
    Create a new booking for an existing client.

    Steps:
      1. FastAPI parses + validates the JSON body into BookingCreate.
      2. We check that the client_id points to a real row in the clients table.
         If not → 404 Not Found.
      3. Build a Booking ORM object and save it to MySQL.
      4. Return the saved booking serialised via BookingRead (201 Created).
    """
    # ------------------------------------------------------------------
    # Guard: make sure the client exists before creating the booking.
    # Without this check, MySQL would raise a foreign-key constraint error,
    # which is harder to debug and gives a poor error message to the caller.
    # ------------------------------------------------------------------
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id={payload.client_id} does not exist.",
        )

    title_clean = payload.title.strip()

    # Guard: A client can have multiple bookings, but duplicate bookings with the same title are rejected.
    existing_booking = db.query(Booking).filter(
        Booking.client_id == payload.client_id,
        func.lower(Booking.title) == title_clean.lower(),
    ).first()
    if existing_booking:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A booking titled '{title_clean}' already exists for client '{client.name}' (Booking #{existing_booking.id}). Duplicate bookings are not allowed.",
        )

    # model_dump() → plain Python dict → ** unpacks as keyword args to Booking()
    new_booking = Booking(**payload.model_dump())

    db.add(new_booking)       # stage the INSERT (not sent to MySQL yet)
    db.commit()               # flush INSERT to MySQL and confirm
    db.refresh(new_booking)   # reload row to get auto-generated id, created_at

    return new_booking


# -----------------------------------------------------------------------------
# GET /api/bookings/  — List all bookings
# -----------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[BookingRead],
)
def list_bookings(db: Session = Depends(get_db)):
    """
    Return every booking row from the database.

    Equivalent SQL:
        SELECT * FROM bookings;
    """
    bookings = db.query(Booking).all()
    return bookings


# -----------------------------------------------------------------------------
# GET /api/bookings/{booking_id}  — Get one booking by ID
# -----------------------------------------------------------------------------
@router.get(
    "/{booking_id}",
    response_model=BookingRead,
)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    """
    Return one booking by primary key.

    FastAPI converts {booking_id} in the URL to int automatically.
    If the conversion fails (e.g. /api/bookings/abc), FastAPI returns 422.

    Equivalent SQL:
        SELECT * FROM bookings WHERE id = :booking_id LIMIT 1;
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with id={booking_id} does not exist.",
        )

    return booking
