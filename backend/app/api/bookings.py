from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from backend.app.database.db import get_db
from backend.app.models.booking import Booking
from backend.app.models.client import Client
from backend.app.models.user import User
from backend.app.schemas.booking import BookingCreate, BookingRead, BookingUpdate
from backend.app.api.deps import get_current_photographer

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

@router.post(
    "/",
    response_model=BookingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    client = db.query(Client).filter(Client.id == payload.client_id, Client.user_id == current_user.id).first()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id={payload.client_id} does not exist.",
        )

    title_clean = payload.title.strip()

    existing_booking = db.query(Booking).filter(
        Booking.client_id == payload.client_id,
        func.lower(Booking.title) == title_clean.lower(),
    ).first()
    if existing_booking:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A booking titled '{title_clean}' already exists for client '{client.name}' (Booking #{existing_booking.id}).",
        )

    new_booking = Booking(**payload.model_dump())
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    new_booking.client = client

    return new_booking

@router.get(
    "/",
    response_model=List[BookingRead],
)
def list_bookings(db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    bookings = db.query(Booking).join(Client).filter(Client.user_id == current_user.id).options(joinedload(Booking.client)).all()
    return bookings

@router.get(
    "/{booking_id}",
    response_model=BookingRead,
)
def get_booking(booking_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    booking = db.query(Booking).join(Client).filter(Booking.id == booking_id, Client.user_id == current_user.id).options(joinedload(Booking.client)).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with id={booking_id} does not exist.",
        )
    return booking


@router.put("/{booking_id}", response_model=BookingRead)
def update_booking(booking_id: int, payload: BookingUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    booking = db.query(Booking).join(Client).filter(Booking.id == booking_id, Client.user_id == current_user.id).options(joinedload(Booking.client)).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
        
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return booking
        
    for key, value in update_data.items():
        setattr(booking, key, value)
        
    db.commit()
    db.refresh(booking)
    return booking

@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    booking = db.query(Booking).join(Client).filter(Booking.id == booking_id, Client.user_id == current_user.id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    db.delete(booking)
    db.commit()
    return None
