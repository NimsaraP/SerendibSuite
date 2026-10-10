from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.db import Base


class User(Base):
    """
    Represents a photographer who logs in and uses the system.

    One User can have many Clients (the people who hire them).
    """
    __tablename__ = "users"

    # Primary key — SQLAlchemy auto-increments this integer.
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # nullable=False means MySQL will REJECT an INSERT that omits this column.
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # unique=True creates a UNIQUE index — no two users share the same email.
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    # Storing the password hash securely
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Role: 'photographer' or 'client'
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default="photographer")

    # server_default=func.now() means MySQL itself sets this to NOW() on INSERT.
    # That way it works even if someone inserts a row outside of Python.
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relationship: one User → many Clients.
    # back_populates="user" means Client.user points back to this User.
    clients: Mapped[list["Client"]] = relationship("Client", back_populates="user", foreign_keys="[Client.user_id]")

    # If this user is a client, this links back to the CRM client record
    client_profile: Mapped[list["Client"]] = relationship("Client", back_populates="login_user", foreign_keys="[Client.login_user_id]")

    # Sessions for authentication
    sessions: Mapped[list["UserSession"]] = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
