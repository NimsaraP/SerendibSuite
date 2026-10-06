from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.db import Base


class CullingOverride(Base):
    """
    Audit and learning record for when a photographer overrides an AI recommendation.
    Used by the Personalization Layer to adapt blur thresholds and selection preferences
    to the specific photographer's taste over time.
    """
    __tablename__ = "culling_overrides"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    photo_id: Mapped[int] = mapped_column(
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    ai_recommendation: Mapped[str] = mapped_column(String(20), nullable=False)
    photographer_decision: Mapped[str] = mapped_column(String(20), nullable=False)

    blur_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_blurry: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    face_detected: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    eyes_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    photo: Mapped["Photo"] = relationship("Photo")
    event: Mapped["Event"] = relationship("Event")
