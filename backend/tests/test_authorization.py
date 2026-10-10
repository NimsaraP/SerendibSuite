import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database.db import get_db, Base
from backend.app.models.user import User
from backend.app.models.client import Client
from backend.app.models.booking import Booking
from backend.app.models.event import Event
from backend.app.core.security import create_session_token

class TestAuthorization(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:", 
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        
        self.db = TestingSessionLocal()
        
        def override_get_db():
            try:
                db = TestingSessionLocal()
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        
        # Create Photographer A
        self.photo_a = User(name="Photo A", email="a@test.com", password_hash="hash", role="photographer")
        self.db.add(self.photo_a)
        
        # Create Photographer B
        self.photo_b = User(name="Photo B", email="b@test.com", password_hash="hash", role="photographer")
        self.db.add(self.photo_b)
        
        # Create Client User (Role = client)
        self.client_user = User(name="Client", email="c@test.com", password_hash="hash", role="client")
        self.db.add(self.client_user)
        
        self.db.commit()
        
        # Set up sessions
        self.token_a = create_session_token(self.db, self.photo_a.id)
        self.token_b = create_session_token(self.db, self.photo_b.id)
        self.token_c = create_session_token(self.db, self.client_user.id)
        
        # We need a CSRF token as well
        self.csrf = "fake_csrf"
        
        self.cookies_a = {"session_token": self.token_a, "csrf_token": self.csrf}
        self.cookies_b = {"session_token": self.token_b, "csrf_token": self.csrf}
        self.cookies_c = {"session_token": self.token_c, "csrf_token": self.csrf}
        self.headers = {"X-CSRF-Token": self.csrf}
        
        # Create some resources for Photographer A
        self.client_a = Client(name="Client A", email="ca@test.com", user_id=self.photo_a.id)
        self.db.add(self.client_a)
        self.db.commit()
        
        from datetime import date
        self.booking_a = Booking(title="Booking A", booking_date=date(2024, 1, 1), status="confirmed", client_id=self.client_a.id)
        self.db.add(self.booking_a)
        self.db.commit()
        
        self.event_a = Event(name="Event A", event_date=date(2024, 1, 2), status="scheduled", booking_id=self.booking_a.id)
        self.db.add(self.event_a)
        self.db.commit()
        
    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)
        app.dependency_overrides.clear()
        
    def test_unauthenticated_requests_rejected(self):
        res = self.client.get("/api/clients/")
        self.assertEqual(res.status_code, 401)
        
    def test_client_role_cannot_access_photographer_apis(self):
        res = self.client.get("/api/clients/", cookies=self.cookies_c)
        self.assertEqual(res.status_code, 403)
        self.assertIn("Only photographers", res.json()["detail"])
        
    def test_photographer_cannot_read_others_clients(self):
        # A can read their own client
        res_a = self.client.get(f"/api/clients/{self.client_a.id}", cookies=self.cookies_a)
        self.assertEqual(res_a.status_code, 200)
        
        # B cannot read A's client
        res_b = self.client.get(f"/api/clients/{self.client_a.id}", cookies=self.cookies_b)
        self.assertEqual(res_b.status_code, 404)
        
    def test_photographer_cannot_create_booking_for_others_client(self):
        payload = {
            "title": "Booking B",
            "booking_date": "2024-01-01",
            "client_id": self.client_a.id,
            "status": "confirmed"
        }
        res_b = self.client.post("/api/bookings/", json=payload, cookies=self.cookies_b, headers=self.headers)
        self.assertEqual(res_b.status_code, 404)
        
    def test_photographer_cannot_read_others_bookings(self):
        res_b = self.client.get(f"/api/bookings/{self.booking_a.id}", cookies=self.cookies_b)
        self.assertEqual(res_b.status_code, 404)
        
    def test_photographer_cannot_create_event_for_others_booking(self):
        payload = {
            "name": "Event B",
            "event_date": "2024-01-02",
            "booking_id": self.booking_a.id,
            "status": "scheduled"
        }
        res_b = self.client.post("/api/events/", json=payload, cookies=self.cookies_b, headers=self.headers)
        self.assertEqual(res_b.status_code, 404)
        
    def test_photographer_cannot_read_others_events(self):
        res_b = self.client.get(f"/api/events/{self.event_a.id}", cookies=self.cookies_b)
        self.assertEqual(res_b.status_code, 404)

    def test_csrf_protection_on_post(self):
        payload = {
            "name": "Client new",
            "email": "cnew@test.com"
        }
        # Post without CSRF header should fail
        res_fail = self.client.post("/api/clients/", json=payload, cookies=self.cookies_a)
        self.assertEqual(res_fail.status_code, 403)
        self.assertIn("CSRF", res_fail.json()["detail"])
        
        # Post with CSRF header should succeed
        res_success = self.client.post("/api/clients/", json=payload, cookies=self.cookies_a, headers=self.headers)
        self.assertEqual(res_success.status_code, 201)

if __name__ == '__main__':
    unittest.main()
