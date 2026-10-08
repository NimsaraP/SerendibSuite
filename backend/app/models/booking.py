from datetime import datetime, date
from typing import Optional

from sqlalchemy import String, Text, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.db import Base


# Valid values for the status column.
# Keeping these as plain strings (not a DB ENUM) makes the schema easier
# to change later without an ALTER TABLE.
BOOKING_STATUSES = ("enquiry", "confirmed", "completed", "cancelled")


class Booking(Base):
    """
    A booking is a confirmed (or pending) job request from a Client.

    Belongs to one Client.
    Has many Events (a wedding booking may have: ceremony, reception, etc.).
    """
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Short description of the booking, e.g. "Smith Wedding - June 2025"
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # The date the booking was made (not the event date — that lives on Event).
    booking_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Status tracks the lifecycle of the booking.
    # Default "enquiry" = not yet confirmed.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="enquiry", index=True
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="bookings")
    events: Mapped[list["Event"]] = relationship("Event", back_populates="booking")

    @property
    def client_name(self) -> Optional[str]:
        return self.client.name if self.client else None
