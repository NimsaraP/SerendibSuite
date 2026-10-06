from datetime import datetime
from typing import Optional, Literal

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

    # Photographer decision — set via PATCH /api/photos/{id}/decision
    photographer_decision: Optional[str]

    # Human-readable explanation — returned in API but not in DB
    reason: str

    model_config = {"from_attributes": True}


# =============================================================================
# PhotoWithAnalysis — photo metadata + optional analysis, returned together
# so the frontend can render the full card in one request.
# =============================================================================
class AnalysisSummary(BaseModel):
    """Lightweight analysis info embedded inside PhotoWithAnalysis."""
    blur_score: Optional[float]
    is_blurry: Optional[bool]
    face_detected: Optional[bool]
    eyes_status: Optional[str]
    similarity_group: Optional[str] = None
    ai_recommendation: Optional[str]
    photographer_decision: Optional[str]
    reason: Optional[str] = None

    model_config = {"from_attributes": True}


class PhotoWithAnalysis(BaseModel):
    """
    Photo metadata with its analysis embedded (analysis may be None if not
    yet run).  Returned by GET /api/photos/with-analysis?event_id=X.
    """
    id: int
    event_id: int
    original_filename: str
    file_size: int
    created_at: datetime
    analysis: Optional[AnalysisSummary]

    model_config = {"from_attributes": True}


# =============================================================================
# DecisionRequest — request body for PATCH /api/photos/{id}/decision
# =============================================================================
class DecisionRequest(BaseModel):
    """
    Photographer decision on a photo.
    Only "keep" and "reject" are accepted.
    """
    decision: Literal["keep", "reject"]


# =============================================================================
# DecisionRead — response body after updating photographer_decision
# =============================================================================
class DecisionRead(BaseModel):
    """
    Returned after successfully updating photographer_decision.
    """
    photo_id: int
    original_filename: str
    ai_recommendation: Optional[str]
    photographer_decision: Optional[str]   # the newly stored value

    model_config = {"from_attributes": True}
