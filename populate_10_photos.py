import os
import urllib.request
from pathlib import Path
import cv2

from backend.app.database.db import SessionLocal
from backend.app.models.user import User
from backend.app.models.client import Client
from backend.app.models.booking import Booking
from backend.app.models.event import Event
from backend.app.models.photo import Photo
from backend.app.models.photo_analysis import PhotoAnalysis
from backend.app.models.culling_override import CullingOverride
from ai.pipeline import run_pipeline

STORAGE_DIR = Path("storage")
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

PHOTO_SPECS = [
    {
        "filename": "01_bride_portrait.jpg",
        "url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
        "desc": "Real Person Portrait (Bride)",
        "decision": "keep",
    },
    {
        "filename": "02_groom_portrait.jpg",
        "url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
        "desc": "Real Person Portrait (Groom)",
        "decision": "keep",
    },
    {
        "filename": "03_wedding_guest_smiling.jpg",
        "url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
        "desc": "Real Person Portrait (Guest)",
        "decision": "keep",
    },
    {
        "filename": "04_bridesmaid_portrait.jpg",
        "url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
        "desc": "Real Person Portrait (Bridesmaid)",
        "decision": "keep",
    },
    {
        "filename": "05_groomsman_portrait.jpg",
        "url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
        "desc": "Real Person Portrait (Groomsman)",
        "decision": "keep",
    },
    {
        "filename": "06_senior_guest_portrait.jpg",
        "url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80",
        "desc": "Real Person Portrait (Event Guest)",
        "decision": "keep",
    },
    {
        "filename": "07_candid_smile_portrait.jpg",
        "url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
        "desc": "Real Person Portrait (Candid Smile)",
        "decision": "keep",
    },
    {
        "filename": "08_evening_session_portrait.jpg",
        "url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80",
        "desc": "Real Person Portrait (Evening Session)",
        "decision": "review",
    },
    {
        "filename": "09_wedding_reception_decor.jpg",
        "url": "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80",
        "desc": "Random Shot (Reception Floral Decor)",
        "decision": None,
    },
    {
        "filename": "10_wedding_rings_macro.jpg",
        "url": "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&q=80",
        "desc": "Random Shot (Wedding Rings Macro)",
        "decision": None,
    },
]


def populate():
    db = SessionLocal()
    print("Cleaning old photos and analyses...")
    db.query(CullingOverride).delete()
    db.query(PhotoAnalysis).delete()
    old_photos = db.query(Photo).all()
    for p in old_photos:
        try:
            stored_file = STORAGE_DIR / p.stored_filename
            if stored_file.exists():
                stored_file.unlink()
        except Exception:
            pass
    db.query(Photo).delete()
    db.commit()

    # Find or create a flagship showcase event
    event = db.query(Event).filter(Event.name == "Grand Luxury Wedding & Reception").first()
    if not event:
        # Get or create client
        client = db.query(Client).first()
        if not client:
            user = db.query(User).first()
            user_id = user.id if user else 1
            client = Client(user_id=user_id, name="Perera & Silva Wedding", email="couple@serendib.test", phone="+94 77 123 4567")
            db.add(client)
            db.commit()
            db.refresh(client)

        from datetime import date

        # Get or create booking
        booking = db.query(Booking).filter(Booking.client_id == client.id).first()
        if not booking:
            booking = Booking(client_id=client.id, title="Perera & Silva Grand Wedding", booking_date=date(2026, 10, 15), status="confirmed")
            db.add(booking)
            db.commit()
            db.refresh(booking)

        event = Event(
            booking_id=booking.id,
            name="Grand Luxury Wedding & Reception",
            event_date=date(2026, 10, 15),
            location="Galle Face Hotel, Colombo",
            status="scheduled",
        )
        db.add(event)
        db.commit()
        db.refresh(event)

    print(f"Target Event: #{event.id} '{event.name}'")

    downloaded = 0
    for idx, spec in enumerate(PHOTO_SPECS, 1):
        filename = spec["filename"]
        url = spec["url"]
        desc = spec["desc"]
        print(f"[{idx}/10] Downloading {filename} ({desc})...")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=15).read()

        # Temporary write to measure and analyse
        temp_path = STORAGE_DIR / f"temp_{idx}.jpg"
        temp_path.write_bytes(data)

        # Run AI analysis pipeline
        analysis_res = run_pipeline(temp_path)

        # Insert photo record
        stored_filename = f"event_{event.id}_photo_{idx}_{filename}"
        final_path = STORAGE_DIR / stored_filename
        temp_path.replace(final_path)

        photo = Photo(
            event_id=event.id,
            original_filename=filename,
            stored_filename=stored_filename,
            file_path=str(final_path),
            file_size=len(data),
            mime_type="image/jpeg",
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)

        # Insert analysis record
        pa = PhotoAnalysis(
            photo_id=photo.id,
            blur_score=round(analysis_res.blur_score, 1),
            is_blurry=analysis_res.is_blurry,
            face_detected=analysis_res.face_detected,
            eyes_status=analysis_res.eyes_status,
            similarity_group=analysis_res.similarity_group,
            ai_recommendation=analysis_res.ai_recommendation,
            photographer_decision=spec["decision"],
        )
        db.add(pa)
        db.commit()

        # If override, log it to culling_overrides
        if spec["decision"] and spec["decision"] != analysis_res.ai_recommendation:
            ov = CullingOverride(
                photo_id=photo.id,
                event_id=event.id,
                ai_recommendation=analysis_res.ai_recommendation,
                photographer_decision=spec["decision"],
                blur_score=round(analysis_res.blur_score, 1),
                is_blurry=analysis_res.is_blurry,
                face_detected=analysis_res.face_detected,
                eyes_status=analysis_res.eyes_status,
            )
            db.add(ov)
            db.commit()

        downloaded += 1
        print(f"     -> Stored Photo #{photo.id}: Face={analysis_res.face_detected}, Eyes={analysis_res.eyes_status}, Blur={analysis_res.blur_score:.1f}, AI={analysis_res.ai_recommendation}")

    print(f"\nSuccessfully populated exactly {downloaded} photos (8 real person portraits + 2 random detail shots)!")
    db.close()


if __name__ == "__main__":
    populate()
