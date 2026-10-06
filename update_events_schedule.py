import sqlite3
from datetime import date

DB_PATH = "storage/serendibsuite.db"

def update_events():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Add event_time column if it does not already exist
    cursor.execute("PRAGMA table_info(events)")
    columns = [row[1] for row in cursor.fetchall()]
    if "event_time" not in columns:
        print("Adding column 'event_time' to table 'events'...")
        cursor.execute("ALTER TABLE events ADD COLUMN event_time VARCHAR(30) DEFAULT NULL")
        conn.commit()
    else:
        print("Column 'event_time' already exists.")

    # 2. Updated schedule for all 13 events
    schedules = {
        1: {
            "name": "Sunrise Pre-Shoot - Viharamahadevi Park",
            "event_date": "2026-10-08",
            "event_time": "07:30 AM",
            "location": "Viharamahadevi Park, Colombo",
        },
        2: {
            "name": "Kandy Royal Poruwa Ceremony",
            "event_date": "2026-10-10",
            "event_time": "09:30 AM",
            "location": "Earl's Regency, Kandy",
        },
        3: {
            "name": "Shangri-La Luxury Evening Reception",
            "event_date": "2026-10-12",
            "event_time": "06:30 PM",
            "location": "Shangri-La Ballroom, Colombo",
        },
        4: {
            "name": "Mount Lavinia Beach Sunset Shoot",
            "event_date": "2026-10-14",
            "event_time": "04:45 PM",
            "location": "Mount Lavinia Hotel Beach",
        },
        13: {
            "name": "Grand Luxury Wedding & Reception",
            "event_date": "2026-10-15",
            "event_time": "10:00 AM",
            "location": "Galle Face Hotel, Colombo",
        },
        5: {
            "name": "Cinnamon Grand Corporate Gala & Awards",
            "event_date": "2026-10-18",
            "event_time": "07:00 PM",
            "location": "Oak Room, Cinnamon Grand, Colombo",
        },
        6: {
            "name": "Bentota Coastal Destination Wedding",
            "event_date": "2026-10-22",
            "event_time": "03:30 PM",
            "location": "Taj Bentota Resort & Spa",
        },
        7: {
            "name": "Nuwara Eliya Tea Estate Couple Session",
            "event_date": "2026-10-28",
            "event_time": "08:00 AM",
            "location": "Heritance Tea Factory, Nuwara Eliya",
        },
        8: {
            "name": "St. Mary's Church Ceremony & Blessing",
            "event_date": "2026-11-05",
            "event_time": "10:30 AM",
            "location": "St. Mary's Church, Negombo",
        },
        9: {
            "name": "Galle Fort Sunset Heritage Shoot",
            "event_date": "2026-11-12",
            "event_time": "05:00 PM",
            "location": "Lighthouse Beach, Galle Fort",
        },
        10: {
            "name": "Hilton Colombo Annual Banquet Shoot",
            "event_date": "2026-11-20",
            "event_time": "07:30 PM",
            "location": "Hilton Grand Ballroom, Colombo",
        },
        11: {
            "name": "Anantara Kalutara Luxury Outdoor Reception",
            "event_date": "2026-12-02",
            "event_time": "06:00 PM",
            "location": "Anantara Kalutara Resort",
        },
        12: {
            "name": "Grand Christmas Eve Celebration Shoot",
            "event_date": "2026-12-24",
            "event_time": "05:30 PM",
            "location": "The Kingsbury Hotel, Colombo",
        },
    }

    for event_id, data in schedules.items():
        cursor.execute(
            """
            UPDATE events 
            SET name = ?, event_date = ?, event_time = ?, location = ?, status = 'scheduled'
            WHERE id = ?
            """,
            (data["name"], data["event_date"], data["event_time"], data["location"], event_id),
        )
        print(f"Updated Event #{event_id}: {data['name']} on {data['event_date']} at {data['event_time']}")

    conn.commit()
    conn.close()
    print("All 13 events successfully updated with authentic times and progressive dates!")

if __name__ == "__main__":
    update_events()
