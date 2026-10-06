"""
test_all_features_audit.py — Comprehensive Audit of All System Functions
"""

import io
import sys
import os
import json
import zipfile
import urllib.request
import urllib.error
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.app.database.db import get_db, Base, engine
from backend.app.models.client import Client
from backend.app.models.booking import Booking
from backend.app.models.event import Event
from backend.app.models.photo import Photo
from backend.app.models.photo_analysis import PhotoAnalysis
from backend.app.models.culling_override import CullingOverride
from ai.blur_detection import detect_blur
from ai.eye_detection import analyse_eyes
from ai.similarity import compute_phash, find_burst_groups
from ai.personalization import compute_personalization_insights, get_personalized_blur_threshold
from ai.pipeline import run_pipeline
from backend.app.api.export_xmp import generate_xmp_content, create_xmp_zip_bundle


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def print_step(num, title):
    print(f"\n[{num:02d}] TESTING: {title}")


def report_ok(msg):
    print(f"     [PASS]: {msg}")


def report_fail(msg):
    print(f"     [FAIL]: {msg}")
    sys.exit(1)


def main():
    print("=" * 65)
    print("      SERENDIBSUITE COMPREHENSIVE SYSTEM AUDIT & TEST      ")
    print("=" * 65)

    # 1. API Health & Server Connection
    print_step(1, "API Health Endpoint & Live Backend Server")
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/api/health") as resp:
            data = json.loads(resp.read().decode())
            assert resp.status == 200
            assert data["status"] == "ok"
            report_ok(f"API is responding healthy: {data}")
    except Exception as e:
        report_fail(f"Could not reach backend API at port 8000: {e}")

    # 2. Frontend Web Server
    print_step(2, "Frontend Static Web Server & Core Files")
    urls_to_check = [
        "http://127.0.0.1:5500/",
        "http://127.0.0.1:5500/css/style.css",
        "http://127.0.0.1:5500/js/api.js",
        "http://127.0.0.1:5500/js/app.js",
    ]
    for url in urls_to_check:
        try:
            with urllib.request.urlopen(url) as resp:
                assert resp.status == 200
                report_ok(f"Static resource available: {url}")
        except Exception as e:
            report_fail(f"Failed to fetch {url}: {e}")

    # 3. Database Connectivity
    print_step(3, "Database Session & ORM Schema Tables")
    db = next(get_db())
    try:
        for model in [Client, Booking, Event, Photo, PhotoAnalysis, CullingOverride]:
            count = db.query(model).count()
            report_ok(f"Table '{model.__tablename__}' accessible (current row count: {count})")
    except Exception as e:
        report_fail(f"Database error: {e}")

    # 4. Client Form Validation & API Behavior
    print_step(4, "Client Creation & Input Validation (Valid & Invalid)")
    # Test Invalid client (too short name, invalid email)
    invalid_payload = json.dumps({"name": "A", "email": "not-an-email"}).encode()
    req = urllib.request.Request("http://127.0.0.1:8000/api/clients/", data=invalid_payload, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req)
        report_fail("Expected 422 for invalid client data, but succeeded")
    except urllib.error.HTTPError as err:
        assert err.code == 422
        report_ok(f"Rejected invalid client input with HTTP {err.code} Unprocessable Entity as expected")

    # Test Valid client
    valid_payload = json.dumps({
        "name": "Audit Test Couple",
        "email": "audit.test@example.com",
        "phone": "+94 77 123 4567",
        "notes": "Comprehensive audit test client"
    }).encode()
    req = urllib.request.Request("http://127.0.0.1:8000/api/clients/", data=valid_payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201
        client_data = json.loads(resp.read().decode())
        client_id = client_data["id"]
        report_ok(f"Created valid client #{client_id}: {client_data['name']}")

    # 5. Booking Creation & Validation
    print_step(5, "Booking Creation & Status Logic")
    valid_booking_payload = json.dumps({
        "client_id": client_id,
        "title": "Audit Grand Wedding Shoot",
        "booking_date": "2026-12-25",
        "status": "confirmed",
        "notes": "Full day coverage"
    }).encode()
    req = urllib.request.Request("http://127.0.0.1:8000/api/bookings/", data=valid_booking_payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201
        booking_data = json.loads(resp.read().decode())
        booking_id = booking_data["id"]
        report_ok(f"Created booking #{booking_id}: '{booking_data['title']}' (Status: {booking_data['status']})")

    # 6. Event Workspace Creation
    print_step(6, "Event Workspace Creation & Linking")
    valid_event_payload = json.dumps({
        "booking_id": booking_id,
        "name": "Ceremony & Reception 2026",
        "event_date": "2026-12-25",
        "location": "Galle Face Hotel, Colombo",
        "status": "scheduled"
    }).encode()
    req = urllib.request.Request("http://127.0.0.1:8000/api/events/", data=valid_event_payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201
        event_data = json.loads(resp.read().decode())
        event_id = event_data["id"]
        report_ok(f"Created event #{event_id}: '{event_data['name']}' in {event_data['location']}")

    # 7. File Upload Validations (Security & Constraints)
    print_step(7, "File Upload Security & Constraints Check")
    # 7.1 Non-existent event
    boundary = "----WebKitFormBoundaryAudit123"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="event_id"\r\n\r\n'
        f"999999\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
        f"fake\r\n"
        f"--{boundary}--\r\n"
    ).encode()
    req = urllib.request.Request("http://127.0.0.1:8000/api/photos/", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        urllib.request.urlopen(req)
        report_fail("Expected 404 for invalid event_id upload, but succeeded")
    except urllib.error.HTTPError as err:
        assert err.code == 404
        report_ok(f"Correctly blocked upload to non-existent event (HTTP {err.code})")

    # 7.2 Non-image binary rejection
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="event_id"\r\n\r\n'
        f"{event_id}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test.exe"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
        f"MZ12345\r\n"
        f"--{boundary}--\r\n"
    ).encode()
    req = urllib.request.Request("http://127.0.0.1:8000/api/photos/", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        urllib.request.urlopen(req)
        report_fail("Expected 415 for non-image file, but succeeded")
    except urllib.error.HTTPError as err:
        assert err.code == 415
        report_ok(f"Correctly blocked non-image MIME type / extension (HTTP {err.code})")

    # 8. Real Photo Ingestion & Local Storage
    print_step(8, "Photo Ingestion & Real Face Photo Upload")
    # Create sample burst frames & real face photo
    test_face_path = Path("storage/test_face.jpg")
    if not test_face_path.exists():
        urllib.request.urlretrieve("https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg", str(test_face_path))
    
    with open(test_face_path, "rb") as f:
        face_bytes = f.read()

    # Upload face photo
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="event_id"\r\n\r\n'
        f"{event_id}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="face_portrait.jpg"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + face_bytes + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request("http://127.0.0.1:8000/api/photos/", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201
        uploaded_face = json.loads(resp.read().decode())
        face_photo_id = uploaded_face["id"]
        report_ok(f"Uploaded real portrait photo #{face_photo_id} ({len(face_bytes)} bytes)")

    # Upload two burst photos
    burst_img = np.zeros((300, 300, 3), dtype=np.uint8)
    cv2.rectangle(burst_img, (50, 50), (250, 250), (0, 200, 255), -1)
    cv2.putText(burst_img, "Serendib", (70, 160), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    _, b1_bytes = cv2.imencode(".jpg", burst_img)
    _, b2_bytes = cv2.imencode(".jpg", burst_img)

    for i, b_data in enumerate([b1_bytes, b2_bytes], 1):
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="event_id"\r\n\r\n'
            f"{event_id}\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="burst_frame_{i}.jpg"\r\n'
            f"Content-Type: image/jpeg\r\n\r\n"
        ).encode() + b_data.tobytes() + f"\r\n--{boundary}--\r\n".encode()
        req = urllib.request.Request("http://127.0.0.1:8000/api/photos/", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 201
            uploaded = json.loads(resp.read().decode())
            report_ok(f"Uploaded burst photo #{uploaded['id']} (burst_frame_{i}.jpg)")

    # 9. Thumbnail Streaming & File Serve Security
    print_step(9, "Image Streaming Security & File Fetching")
    file_url = f"http://127.0.0.1:8000/api/photos/{face_photo_id}/file"
    with urllib.request.urlopen(file_url) as resp:
        assert resp.status == 200
        assert resp.headers.get("Content-Type") in ["image/jpeg", "image/jpg"]
        fetched_len = len(resp.read())
        assert fetched_len == len(face_bytes)
        report_ok(f"Successfully streamed photo binary ({fetched_len} bytes) from secure storage")

    # 10. AI Pipeline: Deep Learning Face Detection & Eye Status
    print_step(10, "OpenCV YuNet Deep Learning Face & Eye Analysis")
    req = urllib.request.Request(f"http://127.0.0.1:8000/api/photos/{face_photo_id}/analyse", data=b"", method="POST")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        analysis = json.loads(resp.read().decode())
        assert analysis["face_detected"] is True
        assert analysis["eyes_status"] in ["open", "closed", "partial"]
        assert analysis["blur_score"] > 0
        assert analysis["ai_recommendation"] in ["keep", "review"]
        report_ok(f"Face Detected: {analysis['face_detected']}, Eyes: '{analysis['eyes_status']}', Blur Score: {analysis['blur_score']:.1f}, AI Recommendation: {analysis['ai_recommendation']}")

    # 11. Burst & Near-Duplicate Grouping Engine
    print_step(11, "pHash Duplicate Detection & Smart Top Pick")
    # First analyse all photos in event
    req = urllib.request.Request(f"http://127.0.0.1:8000/api/photos/?event_id={event_id}")
    with urllib.request.urlopen(req) as resp:
        ev_photos = json.loads(resp.read().decode())
        for p in ev_photos:
            urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:8000/api/photos/{p['id']}/analyse", data=b"", method="POST"))

    burst_url = f"http://127.0.0.1:8000/api/photos/burst-groups?event_id={event_id}"
    with urllib.request.urlopen(burst_url) as resp:
        burst_data = json.loads(resp.read().decode())
        assert burst_data["burst_group_count"] >= 1
        groups = burst_data["groups"]
        assert len(groups) >= 1
        top_pick_id = groups[0]["top_pick_id"]
        report_ok(f"Detected {burst_data['burst_group_count']} burst group(s) with {burst_data['total_burst_photos']} near-duplicates. Designated Top Pick: #{top_pick_id}")

    # 12. Photographer Decision Logging & Overrides
    print_step(12, "Photographer Decisions (Keep / Reject) & Audit Logging")
    # Set decision to 'reject' on the face photo (simulating photographer override of AI recommendation)
    dec_payload = json.dumps({"decision": "reject"}).encode()
    req = urllib.request.Request(f"http://127.0.0.1:8000/api/photos/{face_photo_id}/decision", data=dec_payload, headers={"Content-Type": "application/json"}, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        dec_res = json.loads(resp.read().decode())
        assert dec_res["photographer_decision"] == "reject"
        report_ok(f"Recorded photographer decision: '{dec_res['photographer_decision']}' on Photo #{face_photo_id}")

    # Check override audit log in database
    overrides = db.query(CullingOverride).filter(CullingOverride.photo_id == face_photo_id).all()
    assert len(overrides) >= 1
    report_ok(f"Override audit log registered in DB: AI={overrides[-1].ai_recommendation} -> Photographer={overrides[-1].photographer_decision}")

    # 13. Personalization & Learned Threshold Adaptation
    print_step(13, "Personalization Insights & Adaptive Learning")
    with urllib.request.urlopen("http://127.0.0.1:8000/api/photos/personalization-insights") as resp:
        insights = json.loads(resp.read().decode())
        assert "learned_blur_threshold" in insights
        assert "total_overrides" in insights
        assert insights["total_overrides"] >= 1
        report_ok(f"Personalization Engine Active: Total Overrides={insights['total_overrides']}, Learned Threshold={insights['learned_blur_threshold']}, Convergence={insights.get('convergence_percentage', 0)}%")

    # 14. Adobe Lightroom XMP Sidecar Export
    print_step(14, "Adobe Lightroom / Photo Mechanic XMP Sidecar Export")
    xmp_url = f"http://127.0.0.1:8000/api/photos/export-xmp?event_id={event_id}"
    with urllib.request.urlopen(xmp_url) as resp:
        assert resp.status == 200
        assert resp.headers.get("Content-Type") == "application/zip"
        zip_content = resp.read()
        with zipfile.ZipFile(io.BytesIO(zip_content)) as zf:
            namelist = zf.namelist()
            assert any(n.endswith(".xmp") for n in namelist)
            assert "README_LIGHTROOM_IMPORT.txt" in namelist
            report_ok(f"Generated XMP bundle with {len(namelist)} files: {namelist}")

    print("\n" + "=" * 65)
    print("      🎉 ALL 14 COMPREHENSIVE SYSTEM CHECKS PASSED 100%!     ")
    print("=" * 65)


if __name__ == "__main__":
    main()
