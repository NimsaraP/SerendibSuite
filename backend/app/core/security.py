import hashlib
import os
import secrets
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.app.models.user_session import UserSession

def hash_password(password: str, salt: bytes = None) -> str:
    """Hashes a password using PBKDF2 HMAC SHA256 (part of Python standard library)."""
    if salt is None:
        salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"{salt.hex()}${hashed.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored hash."""
    if "$" not in hashed_password:
        return False
    try:
        salt_hex, hash_hex = hashed_password.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, 100000)
        return expected_hash.hex() == hash_hex
    except Exception:
        return False

def create_session_token(db: Session, user_id: int, days: int = 7) -> str:
    """Creates a secure random session token and stores it in the DB."""
    token = secrets.token_urlsafe(64)
    expires = datetime.utcnow() + timedelta(days=days)
    
    session_record = UserSession(
        session_token=token,
        user_id=user_id,
        expires_at=expires
    )
    db.add(session_record)
    db.commit()
    return token
