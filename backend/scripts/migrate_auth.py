import sys
import os
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import text
from backend.app.database.db import engine

def migrate():
    """
    Manually runs ALTER TABLE statements to add required Auth columns.
    This script is non-destructive and will safely skip if columns exist.
    """
    print("Connecting to database to apply Auth migrations...")
    
    with engine.connect() as conn:
        try:
            # 1. Add role column to users table
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'photographer' NOT NULL"))
            print("✔ Added 'role' column to 'users' table.")
        except Exception as e:
            if "Duplicate column name" in str(e) or "duplicate column name" in str(e).lower():
                print("⏭ 'role' column already exists in 'users'. Skipping.")
            else:
                print(f"❌ Error altering users table: {e}")
                
        try:
            # 2. Add login_user_id to clients table
            conn.execute(text("ALTER TABLE clients ADD COLUMN login_user_id INTEGER DEFAULT NULL"))
            print("✔ Added 'login_user_id' column to 'clients' table.")
            
            # Note for MySQL/SQLite: SQLite doesn't strictly support ALTER TABLE ADD CONSTRAINT FOREIGN KEY in a single line easily in older versions,
            # but since XAMPP is MySQL mostly, this usually works. For SQLite, constraints aren't strictly enforced if added later unless rebuilt.
            # We skip adding the explicit constraint in SQL to maintain cross-engine compatibility with SQLite fallback.
            # SQLAlchemy ORM will still enforce it in Python logic.
        except Exception as e:
            if "Duplicate column name" in str(e) or "duplicate column name" in str(e).lower():
                print("⏭ 'login_user_id' column already exists in 'clients'. Skipping.")
            else:
                print(f"❌ Error altering clients table: {e}")
                
        conn.commit()

    print("Migration complete. Do not forget to restart your backend server if it's running.")

if __name__ == "__main__":
    migrate()
