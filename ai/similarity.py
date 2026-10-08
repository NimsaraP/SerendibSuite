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

    if image_path.suffix.lower() == ".svg":
        import hashlib
        content = image_path.read_bytes()
        return SimilarityResult(phash=hashlib.sha256(content).hexdigest()[:16])

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
    return int(h_a - h_b)  # imagehash overloads __sub__ as Hamming distance


def _frame_quality_score(item: dict) -> float:
    """
    Calculate a ranking score for picking the best frame in a burst.
    Higher score = better candidate to keep.
    """
    analysis = item.get("analysis") or {}
    blur_score = float(analysis.get("blur_score") or 0.0)
    is_blurry = analysis.get("is_blurry")
    eyes_status = analysis.get("eyes_status") or "no_face"

    score = blur_score

    # Penalize blurry frames
    if is_blurry is True:
        score -= 200.0

    # Eye status bonus / penalties
    if eyes_status == "open":
        score += 150.0
    elif eyes_status in ("closed", "partial"):
        score -= 150.0

    return score


def find_burst_groups(photo_items: list[dict], max_distance: int = 10) -> list[dict]:
    """
    Group near-duplicate photos using pHash Hamming distance clustering.
    Only clusters with 2 or more photos are classified as burst groups.

    Args:
        photo_items: List of dicts representing photos with analysis info:
                     [{"id": 1, "original_filename": "DSC_001.JPG", "analysis": {...}}, ...]
        max_distance: Maximum Hamming distance for near-duplicate grouping (default 10).

    Returns:
        List of burst groups:
        [
          {
            "group_id": 1,
            "count": 3,
            "top_pick_id": 2,
            "photos": [
               {...photo_dict, "is_top_pick": True/False, "quality_score": float},
               ...
            ]
          },
          ...
        ]
    """
    # Filter photos that have a valid similarity_group (pHash hex)
    valid_photos = []
    for p in photo_items:
        phash = (p.get("analysis") or {}).get("similarity_group")
        if phash and len(phash) >= 8:
            valid_photos.append(p)

    n = len(valid_photos)
    if n < 2:
        return []

    # Build adjacency list using Hamming distance
    adj = {i: [] for i in range(n)}
    for i in range(n):
        hash_i = valid_photos[i]["analysis"]["similarity_group"]
        for j in range(i + 1, n):
            hash_j = valid_photos[j]["analysis"]["similarity_group"]
            try:
                dist = hamming_distance(hash_i, hash_j)
                if dist <= max_distance:
                    adj[i].append(j)
                    adj[j].append(i)
            except Exception:
                continue

    # Find connected components (BFS / DFS)
    visited = [False] * n
    burst_groups = []
    group_num = 1

    for start_node in range(n):
        if visited[start_node]:
            continue

        cluster_indices = []
        queue = [start_node]
        visited[start_node] = True

        while queue:
            curr = queue.pop(0)
            cluster_indices.append(curr)
            for neighbor in adj[curr]:
                if not visited[neighbor]:
                    visited[neighbor] = True
                    queue.append(neighbor)

        # Only consider groups with 2 or more images as bursts/duplicates
        if len(cluster_indices) >= 2:
            cluster_photos = []
            best_id = None
            best_score = -float("inf")

            for idx in cluster_indices:
                p_copy = dict(valid_photos[idx])
                q_score = _frame_quality_score(p_copy)
                p_copy["quality_score"] = round(q_score, 2)
                cluster_photos.append(p_copy)

                if q_score > best_score:
                    best_score = q_score
                    best_id = p_copy["id"]

            for p in cluster_photos:
                p["is_top_pick"] = (p["id"] == best_id)

            burst_groups.append({
                "group_id": group_num,
                "count": len(cluster_photos),
                "top_pick_id": best_id,
                "photos": cluster_photos,
            })
            group_num += 1

    return burst_groups
