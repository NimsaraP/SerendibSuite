from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.db import Base


# Valid choices the photographer can make after reviewing the AI suggestion.
PHOTOGRAPHER_DECISIONS = ("keep", "delete", "undecided")


class PhotoAnalysis(Base):
    """
    Stores AI analysis results for one Photo.

    This table is populated by the AI pipeline (OpenCV / MediaPipe / ImageHash).
    It is intentionally separate from Photo so that:
      - Photos can exist without analysis (not yet processed).
      - We can re-run analysis without touching the Photo record.

    Belongs to one Photo (one-to-one relationship).
    """
    __tablename__ = "photo_analysis"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # unique=True enforces the one-to-one: each photo can have only one analysis.
    photo_id: Mapped[int] = mapped_column(
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # -----------------------------------------------------------------------
    # Blur detection (OpenCV Laplacian variance)
    # -----------------------------------------------------------------------
    # Higher score = sharper image.  Typical threshold: < 100 = blurry.
    blur_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_blurry: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # -----------------------------------------------------------------------
    # Face / eye detection (MediaPipe)
    # -----------------------------------------------------------------------
    face_detected: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # e.g. "open", "closed", "partial", "no_face"
    eyes_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # -----------------------------------------------------------------------
    # Duplicate grouping (ImageHash perceptual hash)
    # -----------------------------------------------------------------------
    # Photos with the same hash group are near-duplicates of each other.
    similarity_group: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # -----------------------------------------------------------------------
    # AI recommendation and photographer override
    # -----------------------------------------------------------------------
    # What the AI suggests: "keep" or "delete"
    ai_recommendation: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # What the photographer ultimately decided (overrides AI if different).
    photographer_decision: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # When did the AI analysis run?
    analyzed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationship back to Photo
    photo: Mapped["Photo"] = relationship("Photo", back_populates="analysis")
