from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


# =============================================================================
# ClientCreate — the shape of the JSON body sent in POST /api/clients
# =============================================================================
class ClientCreate(BaseModel):
    """
    What the caller must send when creating a new client.

    Pydantic automatically:
      - Parses the incoming JSON into this class.
      - Validates types (e.g. email must be a valid email address).
      - Returns a clear 422 error if a required field is missing or wrong type.
    """

    # TODO (auth milestone): user_id will be taken from the JWT token.
    # Optional for Gate 2: if omitted, the API attaches the client to the
    # existing demo photographer user (see create_client).
    user_id: Optional[int] = None

    name: str
    email: EmailStr        # Pydantic validates this is a real email format

    phone: Optional[str] = None   # Optional — may be omitted or sent as null
    notes: Optional[str] = None

    # Custom validator: strip leading/trailing whitespace from name and check min length.
    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("Client name must be at least 2 characters long")
        if len(stripped) > 100:
            raise ValueError("Client name cannot exceed 100 characters")
        if any(c.isdigit() for c in stripped):
            raise ValueError("Client name cannot contain numbers. Only letters are allowed.")
        import re
        if not re.match(r"^[A-Za-z\s\.\'\-]+$", stripped):
            raise ValueError("Client name can only contain letters, spaces, hyphens, and apostrophes.")
        return stripped

    @field_validator("phone")
    @classmethod
    def phone_format_check(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            return None
        if any(c.isalpha() for c in stripped):
            raise ValueError("Phone number cannot contain letters. Numbers only (e.g. +94 77 123 4567).")
        import re
        if not re.match(r"^\+?[0-9\s\-\(\)]+$", stripped):
            raise ValueError("Phone number contains invalid characters. Only digits, +, -, and spaces are allowed.")
        digits = [c for c in stripped if c.isdigit()]
        if len(digits) < 9 or len(digits) > 15:
            raise ValueError("Phone number must contain between 9 and 15 digits (e.g. +94 77 123 4567)")
        return stripped

    @field_validator("notes")
    @classmethod
    def notes_length_check(cls, value: Optional[str]) -> Optional[str]:
        if value and len(value) > 1000:
            raise ValueError("Notes cannot exceed 1000 characters")
        return value


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("Client name must be at least 2 characters long")
        if len(stripped) > 100:
            raise ValueError("Client name cannot exceed 100 characters")
        if any(c.isdigit() for c in stripped):
            raise ValueError("Client name cannot contain numbers.")
        import re
        if not re.match(r"^[A-Za-z\s\.\'\-]+$", stripped):
            raise ValueError("Client name can only contain letters, spaces, hyphens, and apostrophes.")
        return stripped

    @field_validator("phone")
    @classmethod
    def phone_format_check(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            return None
        if any(c.isalpha() for c in stripped):
            raise ValueError("Phone number cannot contain letters.")
        import re
        if not re.match(r"^\+?[0-9\s\-\(\)]+$", stripped):
            raise ValueError("Phone number contains invalid characters.")
        digits = [c for c in stripped if c.isdigit()]
        if len(digits) < 9 or len(digits) > 15:
            raise ValueError("Phone number must contain between 9 and 15 digits.")
        return stripped

    @field_validator("notes")
    @classmethod
    def notes_length_check(cls, value: Optional[str]) -> Optional[str]:
        if value and len(value) > 1000:
            raise ValueError("Notes cannot exceed 1000 characters")
        return value

# =============================================================================
# ClientRead — the shape of the JSON returned in API responses
# =============================================================================
class ClientRead(BaseModel):
    """
    What the API sends back when returning a client.

    This class deliberately does NOT include sensitive fields.
    We control exactly what leaves the server.
    """
    id: int
    user_id: int
    name: str
    email: str
    phone: Optional[str]
    notes: Optional[str]
    created_at: datetime

    # model_config tells Pydantic to read data from SQLAlchemy ORM objects
    # (which have attributes) rather than expecting a plain dictionary.
    model_config = {"from_attributes": True}
