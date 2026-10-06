"""
ai/personalization.py — Adaptive personalization engine for SerendibSuite.

Learns the photographer's individual artistic and technical preferences from
logged overrides (e.g. when the photographer keeps a soft/motion shot that the
generic rule flagged as review, or when the photographer keeps emotional closed-eye laughter shots).

Adjusts blur thresholds and recommendation scoring over time so AI picks converge
toward the specific photographer's judgment.
"""

from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.app.models.culling_override import CullingOverride
from ai.blur_detection import DEFAULT_BLUR_THRESHOLD


def compute_personalization_insights(db: Session) -> Dict[str, Any]:
    """
    Analyzes all historical override events to compute the photographer's learned profile.
    """
    overrides = db.query(CullingOverride).order_by(CullingOverride.created_at.desc()).all()
    total_overrides = len(overrides)

    if total_overrides == 0:
        return {
            "total_overrides": 0,
            "learned_blur_threshold": DEFAULT_BLUR_THRESHOLD,
            "default_blur_threshold": DEFAULT_BLUR_THRESHOLD,
            "blur_adjustment_delta": 0.0,
            "soft_focus_preference": "Standard (Default 100.0)",
            "emotional_closed_eye_keeps": 0,
            "personalization_convergence": "0% (Collecting data)",
            "convergence_percentage": 0,
            "summary_insight": (
                "No overrides logged yet. The AI is currently using standard baseline models. "
                "As you override AI recommendations, SerendibSuite will learn your preferred sharpness and framing."
            ),
            "recent_overrides": [],
        }

    # 1. Analyze blur score overrides
    # When AI recommended "review" (due to blur) but photographer kept the photo:
    kept_soft_scores = [
        o.blur_score for o in overrides
        if o.ai_recommendation == "review" and o.photographer_decision == "keep"
        and o.blur_score is not None and o.blur_score < DEFAULT_BLUR_THRESHOLD
    ]

    # When AI recommended "keep" but photographer rejected (too soft for their taste):
    rejected_sharp_scores = [
        o.blur_score for o in overrides
        if o.ai_recommendation == "keep" and o.photographer_decision == "reject"
        and o.blur_score is not None and o.blur_score >= DEFAULT_BLUR_THRESHOLD
    ]

    # Calculate adaptive threshold
    learned_threshold = DEFAULT_BLUR_THRESHOLD

    if kept_soft_scores and len(kept_soft_scores) >= 2:
        # Photographer tolerates softer focus (e.g. motion/dance shots, soft portraits)
        avg_soft_kept = sum(kept_soft_scores) / len(kept_soft_scores)
        # Shift threshold downwards towards the average kept soft score (smooth decay)
        learned_threshold = max(45.0, (DEFAULT_BLUR_THRESHOLD * 0.4) + (avg_soft_kept * 0.6))
    elif rejected_sharp_scores and len(rejected_sharp_scores) >= 2:
        # Photographer demands extra sharp focus
        avg_sharp_rejected = sum(rejected_sharp_scores) / len(rejected_sharp_scores)
        learned_threshold = min(160.0, (DEFAULT_BLUR_THRESHOLD * 0.4) + (avg_sharp_rejected * 0.6))

    learned_threshold = round(learned_threshold, 1)
    delta = round(learned_threshold - DEFAULT_BLUR_THRESHOLD, 1)

    # 2. Closed-eye / emotional expression keeps
    closed_eye_keeps = sum(
        1 for o in overrides
        if o.eyes_status in ("closed", "partial") and o.photographer_decision == "keep"
    )

    # 3. Convergence level based on sample count
    # 1-4 overrides: learning started (25-50%)
    # 5-10 overrides: well adapted (60-85%)
    # >10 overrides: highly personalized (90-98%)
    conv_pct = min(98, max(15, total_overrides * 8))

    # Formulate style preference description
    if delta < -10.0:
        focus_desc = f"Permissive / Candid Tolerant ({learned_threshold} vs default {DEFAULT_BLUR_THRESHOLD})"
    elif delta > 10.0:
        focus_desc = f"High Precision Sharpness ({learned_threshold} vs default {DEFAULT_BLUR_THRESHOLD})"
    else:
        focus_desc = f"Balanced Standard ({learned_threshold})"

    recent_logs = [
        {
            "id": o.id,
            "photo_id": o.photo_id,
            "event_id": o.event_id,
            "ai_recommendation": o.ai_recommendation,
            "photographer_decision": o.photographer_decision,
            "blur_score": round(o.blur_score, 1) if o.blur_score is not None else None,
            "eyes_status": o.eyes_status,
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M:%S") if o.created_at else "",
        }
        for o in overrides[:10]
    ]

    return {
        "total_overrides": total_overrides,
        "learned_blur_threshold": learned_threshold,
        "default_blur_threshold": DEFAULT_BLUR_THRESHOLD,
        "blur_adjustment_delta": delta,
        "soft_focus_preference": focus_desc,
        "emotional_closed_eye_keeps": closed_eye_keeps,
        "personalization_convergence": f"{conv_pct}%",
        "convergence_percentage": conv_pct,
        "summary_insight": (
            f"Model has adapted to your style based on {total_overrides} logged overrides. "
            f"Your personalized sharpness threshold is tuned to {learned_threshold} "
            f"(baseline was {DEFAULT_BLUR_THRESHOLD})."
        ),
        "recent_overrides": recent_logs,
    }


def get_personalized_blur_threshold(db: Session) -> float:
    """
    Returns the currently learned blur threshold for this photographer.
    Used when running the AI pipeline on new photos.
    """
    try:
        insights = compute_personalization_insights(db)
        return float(insights.get("learned_blur_threshold", DEFAULT_BLUR_THRESHOLD))
    except Exception:
        return DEFAULT_BLUR_THRESHOLD
