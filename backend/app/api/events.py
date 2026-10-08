from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from backend.app.database.db import get_db
from backend.app.models.event import Event
from backend.app.models.booking import Booking
from backend.app.schemas.event import EventCreate, EventRead

# -----------------------------------------------------------------------------
# Router
# -----------------------------------------------------------------------------
# prefix="/api/events" → every route here starts with /api/events.
# tags=["events"]      → grouped under "events" in the Swagger UI at /docs.
router = APIRouter(prefix="/api/events", tags=["events"])


# -----------------------------------------------------------------------------
# POST /api/events/  — Create a new event
# -----------------------------------------------------------------------------
@router.post(
    "/",
    response_model=EventRead,
    status_code=status.HTTP_201_CREATED,
)
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    """
    Create a new event within an existing booking.

    Steps:
      1. FastAPI parses + validates the JSON body into EventCreate.
      2. We verify the booking_id points to a real row in the bookings table.
         If not → 404 Not Found.
      3. Build an Event ORM object and save it to MySQL.
      4. Return the saved event serialised via EventRead (201 Created).
    """
    # ------------------------------------------------------------------
    # Guard: verify the booking exists before attempting the INSERT.
    # This gives the caller a clean 404 instead of a raw FK constraint
    # violation from MySQL.
    # ------------------------------------------------------------------
    booking = db.query(Booking).options(joinedload(Booking.client)).filter(Booking.id == payload.booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with id={payload.booking_id} does not exist.",
        )

    # Guard: The event date cannot be earlier than the booking date.
    if payload.event_date < booking.booking_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Event date ({payload.event_date}) cannot be earlier than booking date "
                f"({booking.booking_date}) for booking '{booking.title}'."
            ),
        )

    name_clean = payload.name.strip()

    # 1. Guard: Check for duplicate event name under this booking
    existing_name = db.query(Event).filter(
        Event.booking_id == payload.booking_id,
        func.lower(Event.name) == name_clean.lower(),
    ).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An event named '{name_clean}' already exists for this booking (Event #{existing_name.id}). Duplicate event names are not allowed.",
        )

    # 2. Guard: Check for duplicate date & time slot under this booking
    if payload.event_time:
        time_clean = payload.event_time.strip()
        existing_slot = db.query(Event).filter(
            Event.booking_id == payload.booking_id,
            Event.event_date == payload.event_date,
            Event.event_time == time_clean,
        ).first()
        if existing_slot:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An event ('{existing_slot.name}') is already scheduled at {time_clean} on {payload.event_date} for this booking. Duplicate time slots are not allowed.",
            )

    # model_dump() → plain Python dict → ** unpacks as keyword args to Event()
    new_event = Event(**payload.model_dump())

    db.add(new_event)       # stage the INSERT (not sent to MySQL yet)
    db.commit()             # flush INSERT to MySQL and confirm
    db.refresh(new_event)   # reload row to get auto-generated id, created_at
    new_event.booking = booking

    return new_event


# -----------------------------------------------------------------------------
# GET /api/events/  — List all events
# -----------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[EventRead],
)
def list_events(db: Session = Depends(get_db)):
    """
    Return every event row from the database.

    Equivalent SQL:
        SELECT * FROM events;
    """
    events = db.query(Event).options(
        joinedload(Event.booking).joinedload(Booking.client)
    ).all()
    return events


# -----------------------------------------------------------------------------
# GET /api/events/{event_id}  — Get one event by ID
# -----------------------------------------------------------------------------
@router.get(
    "/{event_id}",
    response_model=EventRead,
)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """
    Return one event by primary key.

    FastAPI converts {event_id} in the URL to int automatically.
    If the conversion fails (e.g. /api/events/abc), FastAPI returns 422.

    Equivalent SQL:
        SELECT * FROM events WHERE id = :event_id LIMIT 1;
    """
    event = db.query(Event).options(
        joinedload(Event.booking).joinedload(Booking.client)
    ).filter(Event.id == event_id).first()

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id={event_id} does not exist.",
        )

    return event
