from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database.db import get_db
from backend.app.models.client import Client
from backend.app.models.user import User
from backend.app.schemas.client import ClientCreate, ClientRead, ClientUpdate
from backend.app.api.deps import get_current_photographer

router = APIRouter(prefix="/api/clients", tags=["clients"])

@router.post(
    "/",
    response_model=ClientRead,
    status_code=status.HTTP_201_CREATED,
)
def create_client(payload: ClientCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    data = payload.model_dump()
    data["user_id"] = current_user.id

    name_clean = data["name"].strip()
    email_clean = data["email"].strip().lower()

    existing_name = db.query(Client).filter(
        Client.user_id == current_user.id,
        func.lower(Client.name) == name_clean.lower()
    ).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A client with name '{name_clean}' already exists in your workspace.",
        )

    existing_email = db.query(Client).filter(
        Client.user_id == current_user.id,
        func.lower(Client.email) == email_clean
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email address '{data['email'].strip()}' is already registered to client '{existing_email.name}'.",
        )

    if data.get("phone"):
        phone_raw = data["phone"].strip()
        phone_digits = "".join(c for c in phone_raw if c.isdigit())
        if phone_digits:
            all_clients_with_phone = db.query(Client).filter(Client.user_id == current_user.id, Client.phone.isnot(None)).all()
            for c in all_clients_with_phone:
                c_digits = "".join(ch for ch in (c.phone or "") if ch.isdigit())
                if c_digits:
                    if c_digits == phone_digits or (len(c_digits) >= 9 and len(phone_digits) >= 9 and c_digits[-9:] == phone_digits[-9:]):
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Phone number '{phone_raw}' is already registered to client '{c.name}'.",
                        )

    new_client = Client(**data)
    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    return new_client

@router.get(
    "/",
    response_model=List[ClientRead],
)
def list_clients(db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    clients = db.query(Client).filter(Client.user_id == current_user.id).all()
    return clients

@router.get(
    "/{client_id}",
    response_model=ClientRead,
)
def get_client(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id={client_id} does not exist.",
        )
    return client


@router.put("/{client_id}", response_model=ClientRead)
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return client
        
    if "email" in update_data and update_data["email"] is not None:
        email_clean = update_data["email"].strip().lower()
        update_data["email"] = email_clean
        existing = db.query(Client).filter(
            Client.user_id == current_user.id,
            func.lower(Client.email) == email_clean,
            Client.id != client_id
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Client with email '{email_clean}' already exists.")

    for key, value in update_data.items():
        setattr(client, key, value)
        
    db.commit()
    db.refresh(client)
    return client

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_photographer)):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    db.delete(client)
    db.commit()
    return None
