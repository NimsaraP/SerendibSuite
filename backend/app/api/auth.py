from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database.db import get_db
from backend.app.models.user import User
from backend.app.models.user_session import UserSession
from backend.app.schemas.auth import UserRegister, UserLogin, UserResponse
from backend.app.core.security import hash_password, verify_password, create_session_token
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(data: UserRegister, db: Session = Depends(get_db)):
    # Enforce unique, normalized email address
    email_clean = data.email.strip().lower()
    
    existing = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail="A user with this email address already exists."
        )
        
    new_user = User(
        name=data.name.strip(),
        email=email_clean,
        password_hash=hash_password(data.password),
        role="photographer"  # Public registration defaults to photographer. Clients are created by photographers.
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

@router.post("/login")
def login(data: UserLogin, response: Response, db: Session = Depends(get_db)):
    email_clean = data.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()
    
    # Return safe, consistent authentication errors without leaking whether an account exists.
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
        
    # Generate secure token
    token = create_session_token(db, user.id, days=7)
    
    # Set HttpOnly, Lax SameSite cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
        max_age=7 * 24 * 3600
    )
    
    # Set CSRF token cookie (Not HttpOnly so JS can read it)
    import secrets
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600
    )
    
    return {"message": "Login successful", "role": user.role}

@router.post("/logout")
def logout(response: Response, session_token: str = Cookie(None), db: Session = Depends(get_db)):
    if session_token:
        # Server-side revocation
        session_record = db.query(UserSession).filter(UserSession.session_token == session_token).first()
        if session_record:
            db.delete(session_record)
            db.commit()
            
    response.delete_cookie("session_token", httponly=True, samesite="lax")
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
