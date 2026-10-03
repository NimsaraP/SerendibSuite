"""
ai/blur_detection.py — OpenCV Laplacian-variance blur detector.

How it works:
  1. Read the image with OpenCV.
  2. Convert to grayscale (colour doesn't affect sharpness).
  3. Apply the Laplacian operator — a second-order edge detector.
  4. Measure the variance of the result.
     A sharp image has strong, high-contrast edges → high variance.
     A blurry image has soft edges → low variance.

Threshold guidance:
  The default threshold (100.0) works well for typical camera JPEG photos
  at ≥ 8 MP.  For lower-resolution or compressed images, you may need to
  lower it (e.g., 50.0).  For high-resolution studio shots you may raise it
  (e.g., 200.0).  Pass a custom threshold when calling detect_blur() if
  needed — do not assume one value is universal.
"""

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


# Default blurriness threshold — configurable per call.
DEFAULT_BLUR_THRESHOLD = 100.0


@dataclass
class BlurResult:
    """
    Structured result from blur detection.

    Attributes:
        blur_score   : Laplacian variance — higher = sharper.
        is_blurry    : True if blur_score < threshold.
        threshold    : The threshold that was used.
    """
    blur_score: float
    is_blurry: bool
    threshold: float


def detect_blur(image_path: Path, threshold: float = DEFAULT_BLUR_THRESHOLD) -> BlurResult:
    """
    Calculate the Laplacian-variance sharpness score for an image file.

    Args:
        image_path : Absolute path to the image (JPEG or PNG).
        threshold  : Variance below this value is considered blurry.

    Returns:
        BlurResult with blur_score, is_blurry, and threshold used.

    Raises:
        FileNotFoundError  : If image_path does not exist.
        ValueError         : If OpenCV cannot decode the file.
    """
    if not image_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    # imread returns None if the file cannot be decoded.
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"OpenCV could not decode image: {image_path.name}")

    # Convert to single-channel grayscale.
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Laplacian second derivative — highlights edges.
    # .var() gives the variance of all pixel values in the result.
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    return BlurResult(
        blur_score=round(variance, 4),
        is_blurry=variance < threshold,
        threshold=threshold,
    )
