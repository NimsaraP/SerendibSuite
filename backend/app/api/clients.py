from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.db import get_db
from backend.app.models.client import Client
from backend.app.models.user import User
from backend.app.schemas.client import ClientCreate, ClientRead

# Same placeholder photographer used by backend/seed_test_data.py.
# Gate 2 has no auth, so new clients created from the UI attach here.
DEMO_USER_EMAIL = "seed.photographer@serendibsuite.test"
DEMO_USER_NAME = "Seed Photographer"
DEMO_USER_PASSWORD_HASH = "seed_placeholder_hash_not_real"


def _get_or_create_demo_user(db: Session) -> User:
    """Find the demo photographer, or create them if the database is empty."""
    user = db.query(User).filter(User.email == DEMO_USER_EMAIL).first()
    if user is not None:
        return user

    user = User(
        name=DEMO_USER_NAME,
        email=DEMO_USER_EMAIL,
        password_hash=DEMO_USER_PASSWORD_HASH,
    )
    db.add(user)
    db.flush()
    return user

# -----------------------------------------------------------------------------
# Router
# -----------------------------------------------------------------------------
# APIRouter is like a mini FastAPI app for one feature.
# prefix="/api/clients" means every route here starts with /api/clients.
# tags=["clients"] groups these routes together in the Swagger UI.
router = APIRouter(prefix="/api/clients", tags=["clients"])


# -----------------------------------------------------------------------------
# POST /api/clients  — Create a new client
# -----------------------------------------------------------------------------
@router.post(
    "/",
    response_model=ClientRead,              # FastAPI serializes the return value using this schema
    status_code=status.HTTP_201_CREATED,    # 201 = "something was created" (not just 200 OK)
)
def create_client(payload: ClientCreate, db: Session = Depends(get_db)):
    """
    Create a new client record in the database.

    FastAPI automatically:
      1. Parses the request body JSON into a ClientCreate object.
      2. Runs Pydantic validation (required fields, email format, etc.).
      3. Returns 422 Unprocessable Entity if validation fails.

    We then:
      4. Build a Client ORM object from the validated data.
      5. Add it to the session and commit to MySQL.
      6. Refresh to get the auto-generated id and created_at from the DB.
      7. Return the saved Client — FastAPI serializes it via ClientRead.
    """
    data = payload.model_dump()

    if data.get("user_id") is None:
        data["user_id"] = _get_or_create_demo_user(db).id
    else:
        owner = db.query(User).filter(User.id == data["user_id"]).first()
        if owner is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id={data['user_id']} does not exist.",
            )

    new_client = Client(**data)

    db.add(new_client)      # stage the INSERT (not sent to MySQL yet)
    db.commit()             # send the INSERT to MySQL and confirm
    db.refresh(new_client)  # reload the row so we have id, created_at, etc.

    return new_client


# -----------------------------------------------------------------------------
# GET /api/clients  — List all clients
# -----------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[ClientRead],
)
def list_clients(db: Session = Depends(get_db)):
    """
    Return every client row from the database.

    db.query(Client).all() translates to:
        SELECT * FROM clients;
    SQLAlchemy returns a Python list of Client ORM objects.
    FastAPI serializes each one using ClientRead.
    """
    clients = db.query(Client).all()
    return clients


# -----------------------------------------------------------------------------
# GET /api/clients/{client_id}  — Get one client by ID
# -----------------------------------------------------------------------------
@router.get(
    "/{client_id}",
    response_model=ClientRead,
)
def get_client(client_id: int, db: Session = Depends(get_db)):
    """
    Return one client by primary key.

    FastAPI extracts {client_id} from the URL and converts it to int.
    If the conversion fails (e.g. /api/clients/abc), FastAPI returns 422.

    db.query(Client).filter(...).first() translates to:
        SELECT * FROM clients WHERE id = :client_id LIMIT 1;

    If no row is found, first() returns None and we raise a 404.
    """
    client = db.query(Client).filter(Client.id == client_id).first()

    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id={client_id} does not exist.",
        )

    return client
