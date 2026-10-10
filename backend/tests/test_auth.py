import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from backend.app.main import app
from backend.app.database.db import get_db, Base
from backend.app.models.user import User
from backend.app.models.user_session import UserSession
from backend.app.core.security import verify_password

from sqlalchemy.pool import StaticPool

# Use in-memory SQLite for isolated tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

try:
    client = TestClient(app)
    HAS_TESTCLIENT = True
except ImportError:
    HAS_TESTCLIENT = False

class TestAuth(unittest.TestCase):
    def setUp(self):
        # Create tables for each test
        Base.metadata.create_all(bind=engine)
        
    def tearDown(self):
        # Drop tables after each test
        Base.metadata.drop_all(bind=engine)

    def test_a_registration_success(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed, cannot use TestClient")
        response = client.post("/api/auth/register", json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "strongpassword123"
        })
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["email"], "test@example.com")
        self.assertEqual(data["name"], "Test User")
        self.assertEqual(data["role"], "photographer")
        
        # Verify password is not in plaintext
        db = TestingSessionLocal()
        user = db.query(User).filter_by(email="test@example.com").first()
        self.assertNotEqual(user.password_hash, "strongpassword123")
        self.assertTrue(verify_password("strongpassword123", user.password_hash))
        db.close()

    def test_b_registration_duplicate_email(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        client.post("/api/auth/register", json={
            "name": "Test User",
            "email": "duplicate@example.com",
            "password": "password123"
        })
        response = client.post("/api/auth/register", json={
            "name": "Another User",
            "email": "DUPLICATE@example.com",
            "password": "password456"
        })
        self.assertEqual(response.status_code, 409)

    def test_c_invalid_registration_input(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        response = client.post("/api/auth/register", json={
            "name": "Test User",
            "email": "not-an-email",
            "password": "123"
        })
        self.assertEqual(response.status_code, 422) # Unprocessable Entity from Pydantic

    def test_d_successful_login(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        client.post("/api/auth/register", json={
            "name": "Login User",
            "email": "login@example.com",
            "password": "password123"
        })
        response = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 200)
        # Check for cookie
        self.assertIn("session_token", response.cookies)
        self.assertEqual(response.json()["role"], "photographer")

    def test_e_invalid_credentials(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        client.post("/api/auth/register", json={
            "name": "Wrong Creds User",
            "email": "wrong@example.com",
            "password": "password123"
        })
        response = client.post("/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("session_token", response.cookies)

    def test_f_authenticated_me_lookup(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        client.post("/api/auth/register", json={
            "name": "Me User",
            "email": "me@example.com",
            "password": "password123"
        })
        login_resp = client.post("/api/auth/login", json={
            "email": "me@example.com",
            "password": "password123"
        })
        cookie = login_resp.cookies.get("session_token")
        
        me_resp = client.get("/api/auth/me", cookies={"session_token": cookie})
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["email"], "me@example.com")

    def test_g_unauthenticated_me_rejection(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        me_resp = client.get("/api/auth/me") # No cookies
        self.assertEqual(me_resp.status_code, 401)

    def test_h_logout_and_session_invalidation(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        client.post("/api/auth/register", json={
            "name": "Logout User",
            "email": "logout@example.com",
            "password": "password123"
        })
        login_resp = client.post("/api/auth/login", json={
            "email": "logout@example.com",
            "password": "password123"
        })
        cookie = login_resp.cookies.get("session_token")
        
        # Test logout
        logout_resp = client.post("/api/auth/logout", cookies={"session_token": cookie})
        self.assertEqual(logout_resp.status_code, 200)
        
        # Me lookup should fail now because session row is deleted
        me_resp = client.get("/api/auth/me", cookies={"session_token": cookie})
        self.assertEqual(me_resp.status_code, 401)

    def test_i_expired_session_rejection(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        # Direct DB manipulation to simulate expired session
        db = TestingSessionLocal()
        user = User(name="Expired", email="expired@example.com", password_hash="123", role="photographer")
        db.add(user)
        db.commit()
        db.refresh(user)
        
        session = UserSession(session_token="fake_token", user_id=user.id, expires_at=datetime.utcnow() - timedelta(days=1))
        db.add(session)
        db.commit()
        db.close()
        
        me_resp = client.get("/api/auth/me", cookies={"session_token": "fake_token"})
        self.assertEqual(me_resp.status_code, 401)

    def test_j_existing_clients_compatibility(self):
        if not HAS_TESTCLIENT:
            self.skipTest("httpx not installed")
        # Create a client directly via API
        resp = client.post("/api/clients/", json={
            "name": "Test Client",
            "email": "client@example.com",
            "phone": "+94 77 123 4567",
            "notes": "Test"
        })
        self.assertEqual(resp.status_code, 201) # Since endpoints are NOT protected in this stage, it should work.

if __name__ == '__main__':
    unittest.main()
