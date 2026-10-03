from datetime import datetime, date
from typing import Optional

from sqlalchemy import String, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.db import Base


EVENT_STATUSES = ("scheduled", "in_progress", "completed", "cancelled")


class Event(Base):
    """
    A single shoot/occasion within a Booking.

    Example: A "Smith Wedding" Booking might have:
      - Event: "Ceremony"  (church, 10:00)
      - Event: "Reception" (hotel, 18:00)

    Belongs to one Booking.
    Has many Photos.
    """
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # The actual date the photo shoot takes place.
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Where the shoot happens.
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="scheduled", index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="events")
    photos: Mapped[list["Photo"]] = relationship("Photo", back_populates="event")
