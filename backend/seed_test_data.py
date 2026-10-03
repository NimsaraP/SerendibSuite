"""
backend/seed_test_data.py — Create test data for SerendibSuite.

Usage (from the project root):
    .venv\\Scripts\\python.exe backend/seed_test_data.py

Safe to run multiple times: existing records are reused, not duplicated.
Deduplication keys:
  User    — email
  Client  — email
  Booking — title (within any client; we match by client too)
  Event   — name + booking_id

This script imports the existing database setup and ORM models.
It does NOT change any models or schema.
"""

import sys
from pathlib import Path
from datetime import date

# ---------------------------------------------------------------------------
# Make sure the project root is on sys.path so imports work whether this
# script is run from the root or from the backend/ directory.
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]   # SerendibSuite/
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ---------------------------------------------------------------------------
# Imports — existing infrastructure only, nothing invented
# ---------------------------------------------------------------------------
from backend.app.database.db import SessionLocal, engine, Base

# Importing the models package registers all six models with Base.metadata
# so that create_all() knows about every table.
import backend.app.models  # noqa: F401

from backend.app.models.user    import User
from backend.app.models.client  import Client
from backend.app.models.booking import Booking
from backend.app.models.event   import Event


# ---------------------------------------------------------------------------
# Seed constants — identifiers used to avoid duplicate creation
# ---------------------------------------------------------------------------
TEST_USER_EMAIL    = "seed.photographer@serendibsuite.test"
TEST_CLIENT_EMAIL  = "seed.client@serendibsuite.test"
TEST_BOOKING_TITLE = "[SEED] Silva Family Portrait Session"
TEST_EVENT_NAME    = "[SEED] Garden Photoshoot — Morning"


def run_seed():
    # Ensure all tables exist (safe no-op if they already do).
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ------------------------------------------------------------------
        # 1. User — find by unique email, or create
        # ------------------------------------------------------------------
        user = db.query(User).filter(User.email == TEST_USER_EMAIL).first()
        if user:
            print(f"[User]    Found existing  => id={user.id}")
        else:
            user = User(
                name="Seed Photographer",
                email=TEST_USER_EMAIL,
                # Storing a placeholder hash — no real auth is implemented yet.
                # Never store a real password here.
                password_hash="seed_placeholder_hash_not_real",
            )
            db.add(user)
            db.flush()   # get the auto-generated id without committing yet
            print(f"[User]    Created new     => id={user.id}")

        # ------------------------------------------------------------------
        # 2. Client — find by email, or create linked to the user
        # ------------------------------------------------------------------
        client = db.query(Client).filter(Client.email == TEST_CLIENT_EMAIL).first()
        if client:
            print(f"[Client]  Found existing  => id={client.id}")
        else:
            client = Client(
                user_id=user.id,
                name="Silva Family",
                email=TEST_CLIENT_EMAIL,
                phone="+94 71 234 5678",
                notes="Test client created by seed_test_data.py",
            )
            db.add(client)
            db.flush()
            print(f"[Client]  Created new     => id={client.id}")

        # ------------------------------------------------------------------
        # 3. Booking — find by title + client_id, or create
        # ------------------------------------------------------------------
        booking = (
            db.query(Booking)
            .filter(
                Booking.client_id == client.id,
                Booking.title     == TEST_BOOKING_TITLE,
            )
            .first()
        )
        if booking:
            print(f"[Booking] Found existing  => id={booking.id}")
        else:
            booking = Booking(
                client_id=client.id,
                title=TEST_BOOKING_TITLE,
                booking_date=date(2025, 11, 15),
                status="confirmed",
                notes="Test booking created by seed_test_data.py",
            )
            db.add(booking)
            db.flush()
            print(f"[Booking] Created new     => id={booking.id}")

        # ------------------------------------------------------------------
        # 4. Event — find by name + booking_id, or create
        # ------------------------------------------------------------------
        event = (
            db.query(Event)
            .filter(
                Event.booking_id == booking.id,
                Event.name       == TEST_EVENT_NAME,
            )
            .first()
        )
        if event:
            print(f"[Event]   Found existing  => id={event.id}")
        else:
            event = Event(
                booking_id=booking.id,
                name=TEST_EVENT_NAME,
                event_date=date(2025, 11, 20),
                location="Viharamahadevi Park, Colombo",
                status="scheduled",
            )
            db.add(event)
            db.flush()
            print(f"[Event]   Created new     => id={event.id}")

        # ------------------------------------------------------------------
        # 5. Commit all changes atomically
        # ------------------------------------------------------------------
        db.commit()

        print()
        print("=" * 50)
        print("  SerendibSuite — Test Data Summary")
        print("=" * 50)
        print(f"  User ID    : {user.id}")
        print(f"  Client ID  : {client.id}")
        print(f"  Booking ID : {booking.id}")
        print(f"  Event ID   : {event.id}")
        print("=" * 50)
        print()
        print("You can now open the frontend and select the event above")
        print("to test Photo Upload and AI Analysis.")
        print()
        print("Or verify via the API:")
        print(f"  GET http://127.0.0.1:8000/api/clients/{client.id}")
        print(f"  GET http://127.0.0.1:8000/api/bookings/{booking.id}")
        print(f"  GET http://127.0.0.1:8000/api/events/{event.id}")

    except Exception as exc:
        db.rollback()
        print(f"\n[ERROR] Seed failed — transaction rolled back.\n{exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
