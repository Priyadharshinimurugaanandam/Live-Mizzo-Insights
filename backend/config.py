import os
from pathlib import Path

# Configuration
SURGEON_NAME = "Dr.Meril M"  # Change this to match your surgeon

# Watch folder for JSON files
WATCH_FOLDER = Path(__file__).parent.parent / "watch_folder"
WATCH_FOLDER.mkdir(exist_ok=True)

# Database
DB_PATH = Path(__file__).parent / "misso.db"

# Server
HOST = "127.0.0.1"
PORT = 8001

print(f"📋 Config loaded:")
print(f"   Surgeon: {SURGEON_NAME}")
print(f"   Watch folder: {WATCH_FOLDER}")
print(f"   Database: {DB_PATH}")