from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.db import Base


class Client(Base):
    """
    A client is a person or organisation that hires the photographer.

    Belongs to one User (photographer).
    Has many Bookings.
    """
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ForeignKey links this column to users.id.
    # ondelete="CASCADE" means if the User is deleted, their Clients are too.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Clients must have an email so we can contact them.
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Phone is optional — some clients may not provide one.
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Free-form text notes about the client (e.g. preferences, VIP status).
    # Text stores longer strings than String(n).
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Many-to-one: this Client belongs to one User.
    user: Mapped["User"] = relationship("User", back_populates="clients")

    # One-to-many: this Client can have many Bookings.
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="client")
