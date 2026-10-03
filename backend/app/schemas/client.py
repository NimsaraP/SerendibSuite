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

    # Custom validator: strip leading/trailing whitespace from name.
    # Called automatically by Pydantic before storing the value.
    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


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
