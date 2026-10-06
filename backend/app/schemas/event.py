from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, field_validator

from backend.app.models.event import EVENT_STATUSES


# =============================================================================
# EventCreate — the shape of the JSON body sent in POST /api/events/
# =============================================================================
class EventCreate(BaseModel):
    """
    What the caller must send when creating a new event.

    Required fields  → booking_id, name, event_date
    Optional fields  → location, status (defaults to "scheduled")
    """

    booking_id: int     # must match an existing bookings.id row
    name: str           # e.g. "Ceremony" or "Reception"
    event_date: date    # ISO-8601 date string: "2025-12-14"
    event_time: Optional[str] = None  # e.g. "10:00 AM" or "14:30"

    location: Optional[str] = None

    # Optional — if omitted the model default "scheduled" is used.
    # We still validate it so callers cannot store arbitrary strings.
    status: Optional[str] = "scheduled"

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------
    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("Event name must be at least 2 characters long")
        if len(stripped) > 200:
            raise ValueError("Event name cannot exceed 200 characters")
        return stripped

    @field_validator("location")
    @classmethod
    def location_length_check(cls, value: Optional[str]) -> Optional[str]:
        if value and len(value) > 255:
            raise ValueError("Location cannot exceed 255 characters")
        return value

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in EVENT_STATUSES:
            raise ValueError(
                f"status must be one of: {', '.join(EVENT_STATUSES)}"
            )
        return value


# =============================================================================
# EventRead — the shape of the JSON returned in API responses
# =============================================================================
class EventRead(BaseModel):
    """
    What the API sends back when returning an event.
    Controls exactly which fields leave the server.
    """
    id: int
    booking_id: int
    name: str
    event_date: date
    event_time: Optional[str] = None
    location: Optional[str]
    status: str
    created_at: datetime

    # from_attributes=True lets Pydantic read values from SQLAlchemy ORM
    # objects (which use attribute access) instead of plain dicts.
    model_config = {"from_attributes": True}
