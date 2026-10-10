from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.db import get_db
from backend.app.models.user_session import UserSession
from backend.app.models.user import User
from datetime import datetime

def get_current_user(session_token: str = Cookie(None), db: Session = Depends(get_db)) -> User:
    """
    Dependency to retrieve the currently logged in user based on the session_token cookie.
    Raises 401 Unauthorized if missing, invalid, or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    
    if not session_token:
        raise credentials_exception
        
    session_record = db.query(UserSession).filter(UserSession.session_token == session_token).first()
    if not session_record:
        raise credentials_exception
        
    if session_record.expires_at < datetime.utcnow():
        db.delete(session_record)
        db.commit()
        raise credentials_exception
        
    return session_record.user
