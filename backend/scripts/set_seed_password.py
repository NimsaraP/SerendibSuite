import sys
import getpass
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.database.db import SessionLocal
from backend.app.models.user import User
from backend.app.core.security import hash_password

def update_seed_password():
    print("=========================================")
    print(" Set Seed Photographer Password securely")
    print("=========================================")
    print("This will update the password for 'seed.photographer@serendibsuite.test'.")
    print("Make sure your database is running and migrations have been applied if needed.\n")
    
    email = "seed.photographer@serendibsuite.test"
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"❌ User {email} not found. Have you run seed_test_data.py?")
            return
            
        password = getpass.getpass(prompt="Enter new secure password: ")
        confirm = getpass.getpass(prompt="Confirm new secure password: ")
        
        if password != confirm:
            print("❌ Passwords do not match.")
            return
            
        if len(password) < 6:
            print("❌ Password is too weak.")
            return
            
        user.password_hash = hash_password(password)
        db.commit()
        
        print(f"\n✅ Password successfully updated for {email}!")
        print("You can now login via the frontend API.")
    finally:
        db.close()

if __name__ == "__main__":
    update_seed_password()
