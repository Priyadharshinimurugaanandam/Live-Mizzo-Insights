import os
import json
import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path
import threading

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from database import init_db, get_db
from config import SURGEON_NAME, WATCH_FOLDER, HOST, PORT

# ========================================
# LOGGER + DATABASE
# ========================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
init_db()

# ========================================
# FASTAPI + CORS
# ========================================
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# WEBSOCKET MANAGER
# ========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"✅ WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"❌ WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        logger.info(f"📡 Broadcasting to {len(self.active_connections)} clients: {message['type']}")
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")

manager = ConnectionManager()

# ========================================
# JSON PARSER
# ========================================
def parse_surgery_json(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Parse surgery JSON events"""
    surgery = {
        "procedure_name": "",
        "date": "",
        "time": "",
        "duration": 0,
        "surgeon_name": "",  # Get from JSON, not config
        "patient_info": "",
        "instruments": {},
        "clutch_count": 0,
    }

    start_time = None
    current_instrument = None

    for event in data:
        if not isinstance(event, dict):
            continue
        
        event_type = event.get("event", "")
        value = event.get("value", "")

        try:
            if event_type == "Surgery type selected":
                surgery["procedure_name"] = str(value)
            
            elif event_type == "Surgeon Name":
                surgery["surgeon_name"] = str(value)  # Get from JSON
            
            elif event_type == "Patient Info":
                surgery["patient_info"] = str(value)
            
            elif event_type == "Surgery started":
                try:
                    dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                    surgery["date"] = dt.strftime("%Y-%m-%d")
                    surgery["time"] = dt.strftime("%H:%M")
                    start_time = dt
                except:
                    pass
            
            elif event_type == "Surgery stopped":
                try:
                    stop_dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                    if start_time:
                        surgery["duration"] = int((stop_dt - start_time).total_seconds() / 60)
                except:
                    pass
            
            elif event_type == "Surgery duration":
                try:
                    parts = value.split(":")
                    h, m = int(parts[0]), int(parts[1])
                    surgery["duration"] = h * 60 + m
                except:
                    pass
            
            elif event_type == "Clutch Pedal Pressed":
                surgery["clutch_count"] += 1
            
            elif "Instrument Name" in event_type:
                current_instrument = str(value)
                if current_instrument not in surgery["instruments"]:
                    surgery["instruments"][current_instrument] = {
                        "duration": 0,
                        "count": 0
                    }
            
            elif "Instrument Connected duration is" in event_type and current_instrument:
                try:
                    duration_seconds = float(value)
                    surgery["instruments"][current_instrument]["duration"] = round(duration_seconds / 60, 2)
                except:
                    pass
            
            elif "Instrument Count is" in event_type and current_instrument:
                try:
                    surgery["instruments"][current_instrument]["count"] = int(value)
                except:
                    pass

        except Exception as e:
            logger.warning(f"Parse error: {e}")
            continue

    return surgery

# ========================================
# DATABASE OPERATIONS
# ========================================
async def save_surgery(surgery: dict, is_live: bool = False):
    """Save or update surgery in database"""
    db = await get_db()
    
    instruments_names = ",".join(surgery["instruments"].keys())
    instruments_durations = ",".join([
        str(inst["duration"]) for inst in surgery["instruments"].values()
    ])

    try:
        # Check for existing live surgery by THIS surgeon
        cursor = await db.execute(
            "SELECT id FROM surgeries WHERE is_live = 1 AND surgeon_name = ?",
            (surgery["surgeon_name"],)
        )
        existing = await cursor.fetchone()

        if existing and is_live:
            # Update existing live surgery
            await db.execute("""
                UPDATE surgeries SET
                    procedure_name = ?,
                    date = ?,
                    time = ?,
                    duration = ?,
                    patient_info = ?,
                    instruments_names = ?,
                    instruments_durations = ?,
                    clutch_count = ?
                WHERE id = ?
            """, (
                surgery["procedure_name"],
                surgery["date"],
                surgery["time"],
                surgery["duration"],
                surgery["patient_info"],
                instruments_names,
                instruments_durations,
                surgery["clutch_count"],
                existing[0]
            ))
            surgery_id = existing[0]
            logger.info(f"🔄 Updated live surgery ID={surgery_id}")
        else:
            # Insert new surgery
            cursor = await db.execute("""
                INSERT INTO surgeries (
                    procedure_name, date, time, duration, surgeon_name,
                    patient_info, instruments_names, instruments_durations,
                    clutch_count, is_live
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                surgery["procedure_name"],
                surgery["date"],
                surgery["time"],
                surgery["duration"],
                surgery["surgeon_name"],
                surgery["patient_info"],
                instruments_names,
                instruments_durations,
                surgery["clutch_count"],
                1 if is_live else 0
            ))
            surgery_id = cursor.lastrowid
            logger.info(f"➕ New surgery ID={surgery_id}, is_live={is_live}")

        await db.commit()
        await db.close()
        return surgery_id

    except Exception as e:
        logger.error(f"Database error: {e}")
        await db.close()
        return None

async def mark_surgery_complete(surgery_id: int):
    """Mark surgery as complete (not live)"""
    db = await get_db()
    await db.execute("UPDATE surgeries SET is_live = 0 WHERE id = ?", (surgery_id,))
    await db.commit()
    await db.close()
    logger.info(f"✅ Surgery {surgery_id} marked complete")

# ========================================
# FILE WATCHER
# ========================================
class SurgeryFileHandler(FileSystemEventHandler):
    def __init__(self, loop):
        self.loop = loop
        self.last_modified = {}
        self.surgeon_surgery_map = {}  # Track live surgeries per surgeon

    def on_modified(self, event):
        if event.is_directory:
            return
        
        if event.src_path.endswith('.json'):
            logger.info(f"🔔 File modified: {event.src_path}")
            
            current_time = datetime.now().timestamp()
            if event.src_path in self.last_modified:
                if current_time - self.last_modified[event.src_path] < 2:
                    return
            
            self.last_modified[event.src_path] = current_time
            
            asyncio.run_coroutine_threadsafe(
                self.process_file(event.src_path),
                self.loop
            )

    async def process_file(self, filepath: str):
        """Process JSON file"""
        try:
            logger.info(f"📄 Processing: {filepath}")
            
            with open(filepath, 'r') as f:
                data = json.load(f)
            
            logger.info(f"📊 Loaded {len(data)} events")
            
            surgery = parse_surgery_json(data)
            
            if not surgery["procedure_name"] or not surgery["surgeon_name"]:
                logger.warning("⚠️  Missing procedure or surgeon name")
                return

            logger.info(f"🔍 {surgery['procedure_name']} by {surgery['surgeon_name']}")
            
            is_complete = surgery["duration"] > 0
            surgeon_name = surgery["surgeon_name"]
            
            if is_complete:
                # Mark previous live surgery as complete
                if surgeon_name in self.surgeon_surgery_map:
                    await mark_surgery_complete(self.surgeon_surgery_map[surgeon_name])
                    del self.surgeon_surgery_map[surgeon_name]
                
                # Save as completed
                surgery_id = await save_surgery(surgery, is_live=False)
                logger.info(f"✅ Completed: {surgery['procedure_name']} ({surgery['duration']} min)")
                
                await manager.broadcast({
                    "type": "surgery_complete",
                    "surgery": surgery
                })
            else:
                # Save/update as live
                surgery_id = await save_surgery(surgery, is_live=True)
                self.surgeon_surgery_map[surgeon_name] = surgery_id
                logger.info(f"🔴 LIVE: {surgery['procedure_name']} - {surgery['duration']} min")
                
                await manager.broadcast({
                    "type": "surgery_update",
                    "surgery": surgery,
                    "is_live": True
                })

        except Exception as e:
            logger.error(f"❌ Error: {e}", exc_info=True)

observer = None

def start_file_watcher(loop):
    """Start file watcher"""
    global observer
    event_handler = SurgeryFileHandler(loop)
    observer = Observer()
    observer.schedule(event_handler, str(WATCH_FOLDER), recursive=False)
    observer.start()
    logger.info(f"👀 Watching: {WATCH_FOLDER}")

# ========================================
# API ENDPOINTS
# ========================================
@app.get("/surgeries")
async def get_surgeries(surgeon: str = None):
    """Get surgeries, optionally filtered by surgeon"""
    try:
        db = await get_db()
        
        if surgeon:
            cursor = await db.execute("""
                SELECT * FROM surgeries 
                WHERE surgeon_name = ?
                ORDER BY created_at DESC
            """, (surgeon,))
        else:
            cursor = await db.execute("""
                SELECT * FROM surgeries 
                ORDER BY created_at DESC
            """)
        
        rows = await cursor.fetchall()
        await db.close()

        surgeries = []
        for row in rows:
            surgeries.append({
                "id": row[0],
                "procedure_name": row[1],
                "date": row[2],
                "time": row[3],
                "duration": row[4],
                "surgeon_name": row[5],
                "patient_info": row[6],
                "instruments_names": row[7],
                "instruments_durations": row[8],
                "clutch_count": row[9],
                "created_at": row[10],
                "is_live": row[11]
            })

        logger.info(f"📤 Returning {len(surgeries)} surgeries")
        return surgeries

    except Exception as e:
        logger.error(f"Fetch error: {e}")
        return []

@app.get("/config")
async def get_config():
    """Get configuration"""
    return {
        "surgeon_name": SURGEON_NAME,
        "watch_folder": str(WATCH_FOLDER)
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint"""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ========================================
# STARTUP/SHUTDOWN
# ========================================
@app.on_event("startup")
async def startup_event():
    """Start file watcher"""
    loop = asyncio.get_event_loop()
    threading.Thread(target=start_file_watcher, args=(loop,), daemon=True).start()
    logger.info("🚀 Server started")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop file watcher"""
    global observer
    if observer:
        observer.stop()
        observer.join()
    logger.info("🛑 Server stopped")

# ========================================
# RUN
# ========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)