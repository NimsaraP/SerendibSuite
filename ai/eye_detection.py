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

    Tries:
      1. MediaPipe FaceLandmarker (if available)
      2. OpenCV YuNet Deep Learning Face Detector (FaceDetectorYN)
      3. OpenCV Haar cascade fallback
      4. Safe default (no_face)
    """
    try:
        return _analyse_with_mediapipe(image_path)
    except Exception:
        pass

    try:
        return _analyse_with_yunet(image_path)
    except Exception:
        pass

    try:
        return _analyse_with_haar(image_path)
    except Exception:
        pass

    return EyeResult(
        face_detected=False,
        eyes_status="no_face",
        num_faces=0,
        method="fallback",
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
        num_faces=10,
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

    # In couple & group wedding photos, ALL detected faces must have both eyes open.
    # If ANY face has closed eyes (blinked), status is "closed".
    # If ANY face has one eye closed (partial) and none fully closed, status is "partial".
    has_closed = False
    has_partial = False

    for landmarks in result.face_landmarks:
        left_ear  = _ear(landmarks, _LEFT_EYE_INDICES,  w, h)
        right_ear = _ear(landmarks, _RIGHT_EYE_INDICES, w, h)

        if left_ear < EAR_OPEN_THRESHOLD and right_ear < EAR_OPEN_THRESHOLD:
            has_closed = True
        elif left_ear < EAR_OPEN_THRESHOLD or right_ear < EAR_OPEN_THRESHOLD:
            has_partial = True

    if has_closed:
        eyes_status = "closed"
    elif has_partial:
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
# OpenCV YuNet Deep Learning Face Detector (Fast, accurate, DNN based)
# ---------------------------------------------------------------------------
def _analyse_with_yunet(image_path: Path) -> EyeResult:
    model_path = Path(__file__).parent / "models" / "face_detection_yunet.onnx"
    if not model_path.exists() or not hasattr(cv2, "FaceDetectorYN"):
        raise RuntimeError("YuNet model or FaceDetectorYN not available")

    bgr = cv2.imread(str(image_path))
    if bgr is None:
        raise ValueError("Could not read image")
    h, w = bgr.shape[:2]

    detector = cv2.FaceDetectorYN.create(str(model_path), "", (w, h), 0.5, 0.3, 5000)
    _, faces = detector.detect(bgr)

    num_faces = len(faces) if faces is not None else 0
    if num_faces == 0:
        return EyeResult(
            face_detected=False,
            eyes_status="no_face",
            num_faces=0,
            method="yunet",
        )

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    has_closed = False
    has_partial = False

    for face in faces:
        fx, fy, fw, fh = int(face[0]), int(face[1]), int(face[2]), int(face[3])
        # Sample cheek skin tone for comparison with eye center
        cheek = gray[max(0, fy + int(fh * 0.55)):min(h, fy + int(fh * 0.75)),
                     max(0, fx + int(fw * 0.25)):min(w, fx + int(fw * 0.75))]
        skin_med = float(np.median(cheek)) if cheek.size > 0 else 128.0

        eye_rw = max(8, int(fw * 0.10))
        eye_rh = max(6, int(fh * 0.08))

        def _is_eye_open(ex, ey):
            patch = gray[max(0, ey - eye_rh):min(h, ey + eye_rh),
                         max(0, ex - eye_rw):min(w, ex + eye_rw)]
            if patch.size == 0:
                return True
            ch, cw = patch.shape
            center = patch[int(ch * 0.25):int(ch * 0.75), int(cw * 0.25):int(cw * 0.75)]
            if center.size == 0:
                return True

            c_mean = float(np.mean(center))
            c_min = float(np.min(center))
            sobelx = cv2.Sobel(patch, cv2.CV_64F, 1, 0, ksize=3)
            mag_x = float(np.mean(np.abs(sobelx)))
            center_skin_ratio = c_mean / (skin_med + 1e-5)

            # An eye is closed/squinting shut if:
            # 1. Center intensity is as light as or lighter than face skin and lacks horizontal iris gradient
            # 2. Or center skin ratio >= 1.03 (smooth eyelid skin)
            # 3. Or horizontal gradient is very low and minimum pixel is not dark (no dark pupil)
            # 4. Or minimum pixel in center is not dark (> 35.0)
            is_closed = (
                (center_skin_ratio >= 0.98 and mag_x < 26.0) or
                (center_skin_ratio >= 1.03) or
                (mag_x < 18.0 and c_min > 25.0) or
                (c_min > 35.0 and mag_x < 28.0)
            )
            return not is_closed

        rex, rey = int(face[4]), int(face[5])
        lex, ley = int(face[6]), int(face[7])

        r_open = _is_eye_open(rex, rey)
        l_open = _is_eye_open(lex, ley)

        if not r_open and not l_open:
            has_closed = True
        elif not r_open or not l_open:
            has_partial = True

    # In couple & group photos, ALL detected faces must have both eyes open.
    # If ANY face has closed eyes (blinked), status is "closed".
    # If ANY face has one eye closed (partial) and none fully closed, status is "partial".
    if has_closed:
        eyes_status = "closed"
    elif has_partial:
        eyes_status = "partial"
    else:
        eyes_status = "open"

    return EyeResult(
        face_detected=True,
        eyes_status=eyes_status,
        num_faces=num_faces,
        method="yunet",
    )


def _get_cascade_path(filename: str) -> str:
    local_path = Path(__file__).parent / "models" / filename
    if local_path.exists():
        return str(local_path)
    return str(Path(cv2.data.haarcascades) / filename)


# ---------------------------------------------------------------------------
# Haar cascade fallback (face + eye cascade)
# ---------------------------------------------------------------------------
def _analyse_with_haar(image_path: Path) -> EyeResult:
    if not hasattr(cv2, "CascadeClassifier"):
        raise RuntimeError("CascadeClassifier not available in cv2")

    bgr = cv2.imread(str(image_path))
    if bgr is None:
        raise ValueError("Could not read image")

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade_path = _get_cascade_path("haarcascade_frontalface_default.xml")
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

    # Check eyes with eye cascade across all detected faces
    eyes_status = "open"
    eye_cascade_path = _get_cascade_path("haarcascade_eye.xml")
    eye_cascade = cv2.CascadeClassifier(eye_cascade_path)
    if not eye_cascade.empty():
        has_closed = False
        has_partial = False
        for (fx, fy, fw, fh) in faces:
            roi_gray = gray[fy : fy + int(fh * 0.6), fx : fx + fw]
            eyes = eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=3, minSize=(15, 15))
            if len(eyes) == 0:
                has_closed = True
            elif len(eyes) == 1:
                has_partial = True

        if has_closed:
            eyes_status = "closed"
        elif has_partial:
            eyes_status = "partial"
        else:
            eyes_status = "open"

    return EyeResult(
        face_detected=True,
        eyes_status=eyes_status,
        num_faces=num_faces,
        method="haar",
    )
