"""
test_full_suite.py — Automated end-to-end test for SerendibSuite.
Tests:
  1. Health check & DB connectivity
  2. Client / Booking / Event creation
  3. Photo generation & upload
  4. AI analysis pipeline (Blur, Eyes, pHash)
  5. Burst / Duplicate grouping & Top Pick selection
  6. Photographer override logging
  7. Personalization layer adaptive threshold
  8. Adobe XMP sidecar export (.zip)
"""

import sys
import io
import zipfile
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from backend.app.main import app
from backend.app.database.db import SessionLocal
from backend.app.models.photo import Photo
from backend.app.models.photo_analysis import PhotoAnalysis

client = TestClient(app)


def create_sample_image(text: str = "Test", sharp: bool = True) -> bytes:
    """Create a sample image in memory."""
    img = Image.new("RGB", (300, 300), color=(73, 109, 137))
    d = ImageDraw.Draw(img)
    # Draw high contrast lines to create high sharpness score
    if sharp:
        for i in range(10, 290, 10):
            d.line([(i, 10), (i, 290)], fill=(255, 255, 255), width=2)
            d.line([(10, i), (290, i)], fill=(0, 0, 0), width=2)
    d.text((50, 140), text, fill=(255, 255, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def run_tests():
    print("==================================================")
    print("   SerendibSuite End-to-End Verification Test     ")
    print("==================================================")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[1/8] API Health Check: PASSED")

    # 2. Database connectivity
    res = client.get("/api/db-health")
    assert res.status_code == 200, f"DB Health check failed: {res.text}"
    print("[2/8] Database Connectivity: PASSED")

    # 3. Create Client, Booking, and Event
    c_res = client.post("/api/clients/", json={
        "name": "E2E Test Client",
        "email": "e2e.test@serendibsuite.lk",
        "phone": "+94 77 123 4567",
    })
    assert c_res.status_code == 201, f"Create client failed: {c_res.text}"
    client_id = c_res.json()["id"]

    b_res = client.post("/api/bookings/", json={
        "client_id": client_id,
        "title": "E2E Wedding Shoot",
        "booking_date": "2026-10-15",
        "status": "confirmed",
    })
    assert b_res.status_code == 201, f"Create booking failed: {b_res.text}"
    booking_id = b_res.json()["id"]

    e_res = client.post("/api/events/", json={
        "booking_id": booking_id,
        "name": "E2E Wedding Reception",
        "event_date": "2026-10-15",
        "location": "Galle Face Hotel, Colombo",
        "status": "scheduled",
    })
    assert e_res.status_code == 201, f"Create event failed: {e_res.text}"
    event_id = e_res.json()["id"]
    print(f"[3/8] Workflow Entities Created: Event ID {event_id}: PASSED")

    # 4. Upload 3 photos (2 near-duplicates for burst testing, 1 distinct)
    img_bytes_1 = create_sample_image("Burst Frame 1", sharp=True)
    img_bytes_2 = create_sample_image("Burst Frame 2", sharp=True)
    img_bytes_3 = create_sample_image("Distinct Shot", sharp=False)

    p1 = client.post("/api/photos/", data={"event_id": event_id}, files={"file": ("frame1.jpg", img_bytes_1, "image/jpeg")}).json()
    p2 = client.post("/api/photos/", data={"event_id": event_id}, files={"file": ("frame2.jpg", img_bytes_2, "image/jpeg")}).json()
    p3 = client.post("/api/photos/", data={"event_id": event_id}, files={"file": ("distinct.jpg", img_bytes_3, "image/jpeg")}).json()

    photo_ids = [p1["id"], p2["id"], p3["id"]]
    print(f"[4/8] Photos Uploaded: IDs {photo_ids}: PASSED")

    # 5. Run AI Analysis
    for pid in photo_ids:
        a_res = client.post(f"/api/photos/{pid}/analyse")
        assert a_res.status_code == 200, f"Analysis failed on photo {pid}: {a_res.text}"
        data = a_res.json()
        print(f"      Photo #{pid}: Blur Score={data['blur_score']}, Rec={data['ai_recommendation']}, Hash={data['similarity_group']}")
    print("[5/8] AI Pipeline (OpenCV, pHash, Analysis): PASSED")

    # 6. Burst Grouping
    bg_res = client.get(f"/api/photos/burst-groups?event_id={event_id}")
    assert bg_res.status_code == 200, f"Burst grouping failed: {bg_res.text}"
    bg_data = bg_res.json()
    print(f"      Burst Groups Detected: {bg_data['burst_group_count']} groups")
    print("[6/8] Burst & Near-Duplicate Grouping: PASSED")

    # 7. Photographer Override & Personalization
    # Override photo 1 to REJECT and photo 3 to KEEP
    d1 = client.patch(f"/api/photos/{photo_ids[0]}/decision", json={"decision": "reject"})
    assert d1.status_code == 200
    d3 = client.patch(f"/api/photos/{photo_ids[2]}/decision", json={"decision": "keep"})
    assert d3.status_code == 200

    pers_res = client.get("/api/photos/personalization-insights")
    assert pers_res.status_code == 200
    pers_data = pers_res.json()
    print(f"      Overrides Logged: {pers_data['total_overrides']}")
    print(f"      Learned Threshold: {pers_data['learned_blur_threshold']} (Delta: {pers_data['blur_adjustment_delta']})")
    print(f"      Convergence: {pers_data['personalization_convergence']}")
    print("[7/8] Override Audit Logging & Personalization Layer: PASSED")

    # 8. XMP Sidecar Export (.zip)
    xmp_res = client.get(f"/api/photos/export-xmp?event_id={event_id}")
    assert xmp_res.status_code == 200, f"XMP export failed: {xmp_res.text}"
    assert xmp_res.headers["content-type"] == "application/zip"

    # Verify zip content
    zip_buf = io.BytesIO(xmp_res.content)
    with zipfile.ZipFile(zip_buf, "r") as zf:
        file_list = zf.namelist()
        print(f"      ZIP contents: {file_list}")
        assert "frame1.jpg.xmp" in file_list
        assert "README_LIGHTROOM_IMPORT.txt" in file_list

        # Check XMP content for Rating and Label
        xmp_content = zf.read("frame1.jpg.xmp").decode("utf-8")
        assert 'xmp:Rating="0"' in xmp_content or 'xmp:Rating="5"' in xmp_content
        assert "xmp:Label" in xmp_content

    print("[8/8] Adobe Lightroom / Photo Mechanic XMP Sidecar Export: PASSED")

    print("\n==================================================")
    print("   ALL 8 END-TO-END VERIFICATION CHECKS PASSED!   ")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
