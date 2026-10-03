from datetime import datetime
from typing import Optional

from sqlalchemy import String, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.db import Base


class Photo(Base):
    """
    Represents one uploaded photo file attached to an Event.

    Belongs to one Event.
    Has one PhotoAnalysis (created later by the AI pipeline).

    File storage strategy: we store the file on the local filesystem
    and record its path here.  We do NOT store binary data in MySQL
    (that would make the database very large and slow).
    """
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # The original filename as uploaded by the photographer (e.g. "DSC_0042.jpg").
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # The filename we give it on disk — typically a UUID to avoid collisions.
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relative path from the storage root (e.g. "events/7/abc123.jpg").
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # MIME type tells us whether it's JPEG, PNG, etc. (e.g. "image/jpeg").
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # File size in bytes.  BigInteger supports files up to ~9 exabytes.
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="photos")

    # uselist=False means "there is at most ONE analysis per photo" (not a list).
    analysis: Mapped[Optional["PhotoAnalysis"]] = relationship(
        "PhotoAnalysis", back_populates="photo", uselist=False
    )
