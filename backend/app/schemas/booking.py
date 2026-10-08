from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, field_validator

from backend.app.models.booking import BOOKING_STATUSES


# =============================================================================
# BookingCreate — the shape of the JSON body sent in POST /api/bookings/
# =============================================================================
class BookingCreate(BaseModel):
    """
    What the caller must send when creating a new booking.

    Required fields   → title, booking_date, client_id
    Optional fields   → status (defaults to "enquiry"), notes
    """

    client_id: int          # must match an existing clients.id row
    title: str              # short description, e.g. "Smith Wedding - June 2025"
    booking_date: date      # ISO-8601 date string: "2025-06-14"

    # status is optional here: if omitted the database default "enquiry" is used.
    # We still validate it so callers cannot store arbitrary strings.
    status: Optional[str] = "enquiry"

    notes: Optional[str] = None

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------
    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 3:
            raise ValueError("Booking title must be at least 3 characters long")
        if len(stripped) > 200:
            raise ValueError("Booking title cannot exceed 200 characters")
        return stripped

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in BOOKING_STATUSES:
            raise ValueError(
                f"status must be one of: {', '.join(BOOKING_STATUSES)}"
            )
        return value

    @field_validator("notes")
    @classmethod
    def notes_length_check(cls, value: Optional[str]) -> Optional[str]:
        if value and len(value) > 1000:
            raise ValueError("Notes cannot exceed 1000 characters")
        return value


# =============================================================================
# BookingRead — the shape of the JSON returned in API responses
# =============================================================================
class BookingRead(BaseModel):
    """
    What the API sends back when returning a booking.
    Controls exactly which fields leave the server.
    """
    id: int
    client_id: int
    title: str
    booking_date: date
    status: str
    notes: Optional[str]
    created_at: datetime
    client_name: Optional[str] = None

    # from_attributes=True lets Pydantic read values from SQLAlchemy ORM
    # objects (which use attribute access) instead of plain dicts.
    model_config = {"from_attributes": True}
