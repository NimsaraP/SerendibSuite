from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from backend.app.database.db import get_db
from backend.app.models.event import Event
from backend.app.models.booking import Booking
from backend.app.models.client import Client
from backend.app.models.user import User
from backend.app.schemas.event import EventCreate, EventRead, EventUpdate
from backend.app.api.deps import get_current_photographer

router = APIRouter(prefix="/api/events", tags=["events"])

@router.post(
    "/",
    response_model=EventRead,
    status_code=status.HTTP_201_CREATED,
)
def create_event(payload: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    booking = db.query(Booking).join(Client).filter(Booking.id == payload.booking_id, Client.user_id == current_user.id).options(joinedload(Booking.client)).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with id={payload.booking_id} does not exist.",
        )

    if payload.event_date < booking.booking_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Event date ({payload.event_date}) cannot be earlier than booking date "
                f"({booking.booking_date}) for booking '{booking.title}'."
            ),
        )

    name_clean = payload.name.strip()

    existing_name = db.query(Event).filter(
        Event.booking_id == payload.booking_id,
        func.lower(Event.name) == name_clean.lower(),
    ).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An event named '{name_clean}' already exists for this booking (Event #{existing_name.id}).",
        )

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
                detail=f"An event ('{existing_slot.name}') is already scheduled at {time_clean} on {payload.event_date} for this booking.",
            )

    new_event = Event(**payload.model_dump())
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    new_event.booking = booking

    return new_event

@router.get(
    "/",
    response_model=List[EventRead],
)
def list_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    events = (
        db.query(Event)
        .join(Booking, Event.booking_id == Booking.id)
        .join(Client, Booking.client_id == Client.id)
        .filter(Client.user_id == current_user.id)
        .options(joinedload(Event.booking).joinedload(Booking.client))
        .all()
    )
    return events

@router.get(
    "/{event_id}",
    response_model=EventRead,
)
def get_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    event = (
        db.query(Event)
        .join(Booking, Event.booking_id == Booking.id)
        .join(Client, Booking.client_id == Client.id)
        .filter(Event.id == event_id, Client.user_id == current_user.id)
        .options(joinedload(Event.booking).joinedload(Booking.client))
        .first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id={event_id} does not exist.",
        )
    return event


@router.put("/{event_id}", response_model=EventRead)
def update_event(event_id: int, payload: EventUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    event = db.query(Event).join(Booking).join(Client).filter(Event.id == event_id, Client.user_id == current_user.id).options(joinedload(Event.booking).joinedload(Booking.client)).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
        
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return event
        
    for key, value in update_data.items():
        setattr(event, key, value)
        
    db.commit()
    db.refresh(event)
    return event

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    event = db.query(Event).join(Booking).join(Client).filter(Event.id == event_id, Client.user_id == current_user.id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    db.delete(event)
    db.commit()
    return None
