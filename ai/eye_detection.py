"""
ai/eye_detection.py — MediaPipe face mesh / face detection for eye status.

Strategy:
  MediaPipe 0.10.x uses a task-based API.
  We use FaceLandmarker to get 478-point facial landmarks when a face is
  detected, then examine the Eye Aspect Ratio (EAR) of each eye to determine
  whether eyes are open or closed.

  If no face is detected we return "no_face" gracefully — never crash.

Eye Aspect Ratio (EAR):
  EAR = (‖p2−p6‖ + ‖p3−p5‖) / (2 × ‖p1−p4‖)
  where p1..p6 are six specific eye-landmark points.
  EAR < 0.20 → eyes likely closed.
  EAR ≥ 0.20 → eyes likely open.

  We use the MediaPipe canonical face mesh landmark indices for both eyes.

Fallback:
  If MediaPipe is unavailable or the model file is missing, we fall back to
  OpenCV Haar-cascade face detection and return "open" / "no_face" only,
  without per-eye detail.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np


# MediaPipe task API may not be available in all builds; import lazily.
_mp_available = False
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
    _mp_available = True
except Exception:
    pass  # Silently fall back to OpenCV Haar cascade.


# ---------------------------------------------------------------------------
# MediaPipe FaceLandmarker model — bundled with mediapipe 0.10.x
# ---------------------------------------------------------------------------
# Locate the bundled model asset that ships with the mediapipe package.
def _find_model() -> Optional[Path]:
    """Return path to face_landmarker.task bundled with mediapipe, or None."""
    try:
        import mediapipe as mp
        pkg_dir = Path(mp.__file__).parent
        # The model is typically at mediapipe/modules/... or in tasks/
        candidates = list(pkg_dir.rglob("face_landmarker*.task"))
        if candidates:
            return candidates[0]
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Eye landmark indices (MediaPipe 478-point canonical face mesh)
# ---------------------------------------------------------------------------
# Left eye  (from the subject's perspective)
_LEFT_EYE_INDICES  = [362, 385, 387, 263, 373, 380]
# Right eye
_RIGHT_EYE_INDICES = [33,  160, 158, 133, 153, 144]

EAR_OPEN_THRESHOLD = 0.20  # EAR below this → eye considered closed


def _ear(landmarks, eye_indices, w: int, h: int) -> float:
    """Compute Eye Aspect Ratio for six landmark indices."""
    pts = []
    for idx in eye_indices:
        lm = landmarks[idx]
        pts.append(np.array([lm.x * w, lm.y * h]))

    # EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
    A = np.linalg.norm(pts[1] - pts[5])
    B = np.linalg.norm(pts[2] - pts[4])
    C = np.linalg.norm(pts[0] - pts[3])
    if C < 1e-6:
        return 0.0
    return (A + B) / (2.0 * C)


@dataclass
class EyeResult:
    """
    Structured result from face / eye detection.

    Attributes:
        face_detected : Whether at least one face was found.
        eyes_status   : "open", "closed", "partial", or "no_face".
        num_faces     : How many faces were detected.
        method        : Which detector was used ("mediapipe" or "haar").
    """
    face_detected: bool
    eyes_status: str        # stored in DB — max 20 chars
    num_faces: int
    method: str


def analyse_eyes(image_path: Path) -> EyeResult:
    """
    Detect faces and eye status in an image.

    Args:
        image_path : Absolute path to the image file.

    Returns:
        EyeResult with face_detected, eyes_status, num_faces, method.

    Never raises — returns a graceful "no_face" result on any error.
    """
    try:
        return _analyse_with_mediapipe(image_path)
    except Exception:
        # MediaPipe failed for any reason — fall back to Haar cascade.
        try:
            return _analyse_with_haar(image_path)
        except Exception:
            # If everything fails, return a safe default.
            return EyeResult(
                face_detected=False,
                eyes_status="no_face",
                num_faces=0,
                method="error",
            )


# ---------------------------------------------------------------------------
# MediaPipe implementation
# ---------------------------------------------------------------------------
def _analyse_with_mediapipe(image_path: Path) -> EyeResult:
    if not _mp_available:
        raise RuntimeError("mediapipe not available")

    model_path = _find_model()
    if model_path is None:
        raise RuntimeError("FaceLandmarker model not found")

    base_opts = mp_python.BaseOptions(model_asset_path=str(model_path))
    opts = mp_vision.FaceLandmarkerOptions(
        base_options=base_opts,
        num_faces=5,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )

    # Read image for MediaPipe (RGB).
    bgr = cv2.imread(str(image_path))
    if bgr is None:
        raise ValueError("Could not read image")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = bgr.shape[:2]

    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    with mp_vision.FaceLandmarker.create_from_options(opts) as detector:
        result = detector.detect(mp_image)

    num_faces = len(result.face_landmarks) if result.face_landmarks else 0

    if num_faces == 0:
        return EyeResult(
            face_detected=False,
            eyes_status="no_face",
            num_faces=0,
            method="mediapipe",
        )

    # Analyse eye status for the first (most prominent) face.
    landmarks = result.face_landmarks[0]
    left_ear  = _ear(landmarks, _LEFT_EYE_INDICES,  w, h)
    right_ear = _ear(landmarks, _RIGHT_EYE_INDICES, w, h)

    if left_ear < EAR_OPEN_THRESHOLD and right_ear < EAR_OPEN_THRESHOLD:
        eyes_status = "closed"
    elif left_ear < EAR_OPEN_THRESHOLD or right_ear < EAR_OPEN_THRESHOLD:
        eyes_status = "partial"
    else:
        eyes_status = "open"

    return EyeResult(
        face_detected=True,
        eyes_status=eyes_status,
        num_faces=num_faces,
        method="mediapipe",
    )


# ---------------------------------------------------------------------------
# Haar cascade fallback (no landmarks — coarser result)
# ---------------------------------------------------------------------------
def _analyse_with_haar(image_path: Path) -> EyeResult:
    bgr = cv2.imread(str(image_path))
    if bgr is None:
        raise ValueError("Could not read image")

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(cascade_path)

    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    num_faces = len(faces)

    if num_faces == 0:
        return EyeResult(
            face_detected=False,
            eyes_status="no_face",
            num_faces=0,
            method="haar",
        )

    return EyeResult(
        face_detected=True,
        # Haar cascade cannot determine eye status — use "open" as safe default.
        eyes_status="open",
        num_faces=num_faces,
        method="haar",
    )
