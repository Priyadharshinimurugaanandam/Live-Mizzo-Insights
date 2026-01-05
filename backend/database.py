import sqlite3
import aiosqlite
import os
from pathlib import Path

# Database path in the same directory as main.py
DB_PATH = Path(__file__).parent / "misso.db"

def init_db():
    """Initialize the SQLite database with the surgeries table"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS surgeries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            procedure_name TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            duration INTEGER NOT NULL,
            surgeon_name TEXT NOT NULL,
            surgeon_image TEXT,
            instruments_names TEXT,
            instruments TEXT,
            instruments_durations TEXT,
            clutch_names TEXT,
            clutch_counts TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()
    print(f"✅ Database initialized at: {DB_PATH}")

async def get_db():
    """Get async database connection"""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db