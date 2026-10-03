"""
ai/similarity.py — Perceptual hash (pHash) for image similarity grouping.

How it works:
  ImageHash calculates a perceptual hash — a compact fingerprint that
  captures the broad visual structure of an image.  Two images that look
  nearly identical (e.g. near-duplicate shots) will have similar hashes.

  We use pHash (perceptual hash), which is more robust to small changes
  (resize, minor exposure) than MD5/SHA (which change completely if even
  one pixel changes).

  Hamming distance between two hashes tells how similar they are:
    distance == 0  → identical images
    distance <= 10 → likely near-duplicates (same scene, minor variation)
    distance > 10  → different images

Current milestone:
  We compute and store the hash string for each photo.
  Cross-photo comparison (finding groups) will be implemented in a later
  milestone when the event photo gallery is built, since comparing every
  photo against every other photo requires iterating the event's photo set.
"""

from dataclasses import dataclass
from pathlib import Path

import imagehash
from PIL import Image, UnidentifiedImageError


@dataclass
class SimilarityResult:
    """
    Result from perceptual hashing.

    Attributes:
        phash : Hex string representation of the perceptual hash (16 chars).
                Stored in photo_analysis.similarity_group.
    """
    phash: str


def compute_phash(image_path: Path) -> SimilarityResult:
    """
    Compute the perceptual hash (pHash) of an image.

    Args:
        image_path : Absolute path to the image file.

    Returns:
        SimilarityResult with phash string.

    Raises:
        FileNotFoundError     : If the file does not exist.
        ValueError            : If the file cannot be opened as an image.
    """
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    try:
        img = Image.open(image_path)
        img.load()  # Force decode — catches corrupt files early.
    except UnidentifiedImageError:
        raise ValueError(f"Pillow could not identify image: {image_path.name}")
    except Exception as exc:
        raise ValueError(f"Failed to open image: {exc}") from exc

    phash_obj = imagehash.phash(img)
    return SimilarityResult(phash=str(phash_obj))


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """
    Calculate Hamming distance between two pHash strings.

    A distance of 0 means identical; ≤ 10 means likely near-duplicate.
    Both strings must be the same length (same hash size).

    Args:
        hash_a, hash_b : pHash hex strings from compute_phash().

    Returns:
        Integer Hamming distance.
    """
    h_a = imagehash.hex_to_hash(hash_a)
    h_b = imagehash.hex_to_hash(hash_b)
    return h_a - h_b  # imagehash overloads __sub__ as Hamming distance
