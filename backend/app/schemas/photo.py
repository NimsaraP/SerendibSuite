from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# =============================================================================
# PhotoRead — the shape of the JSON returned when returning a photo record
# =============================================================================
class PhotoRead(BaseModel):
    """
    What the API sends back when returning a photo record.

    We do NOT expose the raw filesystem path (file_path) directly to the
    caller — instead we expose a safe relative identifier they can use to
    build a URL if needed in the future.
    """
    id: int
    event_id: int
    original_filename: str      # what the photographer called the file
    stored_filename: str        # UUID-based name we saved it as
    file_path: str              # relative path under storage/
    mime_type: str              # "image/jpeg" or "image/png"
    file_size: int              # bytes
    created_at: datetime

    # from_attributes=True lets Pydantic read from SQLAlchemy ORM objects.
    model_config = {"from_attributes": True}


# =============================================================================
# AnalysisRead — the shape of the JSON returned from POST /analyse
# =============================================================================
class AnalysisRead(BaseModel):
    """
    What the API sends back after running AI analysis on a photo.

    Maps directly to the PhotoAnalysis SQLAlchemy model columns plus
    a human-readable 'reason' field (not stored in DB) and photo metadata.
    """
    photo_id: int
    original_filename: str

    # Blur detection
    blur_score: Optional[float]
    is_blurry: Optional[bool]

    # Face / eye detection
    face_detected: Optional[bool]
    eyes_status: Optional[str]

    # Perceptual hash (stored as similarity_group in DB)
    similarity_group: Optional[str]

    # AI recommendation
    ai_recommendation: Optional[str]

    # Human-readable explanation — returned in API but not in DB
    reason: str

    model_config = {"from_attributes": True}
