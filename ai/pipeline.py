"""
ai/pipeline.py — Orchestrates all CV/AI steps for one photo.

Runs:
  1. Blur detection (OpenCV)
  2. Face / eye analysis (MediaPipe → Haar fallback)
  3. Perceptual hashing (ImageHash)
  4. Recommendation logic

Returns a single AnalysisResult dataclass that maps directly onto the
PhotoAnalysis SQLAlchemy model fields — no field invention.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ai.blur_detection import detect_blur, DEFAULT_BLUR_THRESHOLD
from ai.eye_detection import analyse_eyes
from ai.similarity import compute_phash


# ---------------------------------------------------------------------------
# Result type — mirrors PhotoAnalysis model columns exactly
# ---------------------------------------------------------------------------
@dataclass
class AnalysisResult:
    """
    Full analysis result for one photo.

    Every field maps to an existing PhotoAnalysis column.
    No invented fields.

    Attributes:
        blur_score         : Laplacian variance (higher = sharper).
        is_blurry          : True if blur_score < blur_threshold.
        face_detected      : Whether at least one face was found.
        eyes_status        : "open" | "closed" | "partial" | "no_face".
        similarity_group   : pHash hex string (16 chars) for the image.
        ai_recommendation  : "keep" | "review" (max 10 chars — fits DB column).
        reason             : Human-readable explanation (not stored in DB,
                             returned in API response for transparency).
    """
    blur_score:         float
    is_blurry:          bool
    face_detected:      bool
    eyes_status:        str
    similarity_group:   str
    ai_recommendation:  str    # "keep" or "review"
    reason:             str    # explanation — not in DB, only in API response


# ---------------------------------------------------------------------------
# Recommendation rules
# ---------------------------------------------------------------------------
def _make_recommendation(
    is_blurry: bool,
    face_detected: bool,
    eyes_status: str,
) -> tuple[str, str]:
    """
    Apply simple transparent rules to produce a recommendation.

    Returns:
        (ai_recommendation, reason)
        ai_recommendation is "keep" or "review" — always ≤ 10 chars.

    Rules (in priority order):
      1. Blurry → review (poor technical quality)
      2. Face with closed eyes → review (common reject in portrait photography)
      3. Face with partially open eyes → review (uncertain quality)
      4. Face with open eyes, sharp → keep (good portrait)
      5. No face, sharp → keep (landscape / detail shot)
      6. Anything else → review (not enough information)

    IMPORTANT: "review" is a recommendation only.
    The photographer always makes the final decision.
    """
    if is_blurry:
        return ("review", "Image appears blurry (low sharpness score). Recommend review before keeping.")

    if face_detected:
        if eyes_status == "closed":
            return ("review", "Face detected but eyes appear closed. Recommend review.")
        if eyes_status == "partial":
            return ("review", "Face detected but one eye may be closed. Recommend review.")
        if eyes_status == "open":
            return ("keep", "Sharp image with face and open eyes detected. Recommended to keep.")
        # eyes_status unknown / unexpected
        return ("review", "Face detected but eye status unclear. Recommend review.")

    # No face — likely a landscape, venue, or detail shot.
    if not is_blurry:
        return ("keep", "Sharp image, no face detected (landscape or detail shot). Recommended to keep.")

    return ("review", "Insufficient information to make a confident recommendation.")


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def run_pipeline(
    image_path: Path,
    blur_threshold: float = DEFAULT_BLUR_THRESHOLD,
) -> AnalysisResult:
    """
    Run the full AI analysis pipeline on a single image file.

    Args:
        image_path      : Absolute path to the stored image file.
        blur_threshold  : Laplacian variance below which the image is
                          considered blurry (default 100.0).

    Returns:
        AnalysisResult with all fields populated.

    Raises:
        FileNotFoundError : If image_path does not exist.
        ValueError        : If the image cannot be decoded.
    """
    # ------------------------------------------------------------------
    # Step 1 — Blur detection
    # ------------------------------------------------------------------
    blur_result = detect_blur(image_path, threshold=blur_threshold)

    # ------------------------------------------------------------------
    # Step 2 — Face / eye detection
    #          (never raises — returns "no_face" on any error)
    # ------------------------------------------------------------------
    eye_result = analyse_eyes(image_path)

    # ------------------------------------------------------------------
    # Step 3 — Perceptual hash
    # ------------------------------------------------------------------
    sim_result = compute_phash(image_path)

    # ------------------------------------------------------------------
    # Step 4 — Recommendation
    # ------------------------------------------------------------------
    recommendation, reason = _make_recommendation(
        is_blurry=blur_result.is_blurry,
        face_detected=eye_result.face_detected,
        eyes_status=eye_result.eyes_status,
    )

    return AnalysisResult(
        blur_score=blur_result.blur_score,
        is_blurry=blur_result.is_blurry,
        face_detected=eye_result.face_detected,
        eyes_status=eye_result.eyes_status,
        similarity_group=sim_result.phash,
        ai_recommendation=recommendation,
        reason=reason,
    )
