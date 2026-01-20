import os
import json
import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path
import threading
import shutil

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from database import init_db, get_db
from config import WATCH_FOLDER, HOST, PORT

# ========================================
# SETUP
# ========================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
init_db()

ARCHIVE_FOLDER = WATCH_FOLDER.parent / "completed_surgeries"
ARCHIVE_FOLDER.mkdir(exist_ok=True)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, 
                   allow_methods=["*"], allow_headers=["*"])

# ========================================
# WEBSOCKET MANAGER
# ========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for conn in self.active_connections[:]:
            try:
                await conn.send_json(message)
            except:
                self.disconnect(conn)

manager = ConnectionManager()

# ========================================
# JSON PARSER
# ========================================
def parse_surgery_json(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    surgery = {
        "procedure_name": "", "date": "", "time": "", "duration": 0,
        "surgeon_name": "", "patient_info": "", "instruments": {},
        "clutch_count": 0, "is_ended": False, "end_timestamp": None,
    }

    start_time = None
    instrument_start_times = {}
    instrument_positions = {}

    for event in data:
        if not isinstance(event, dict):
            continue

        event_type = event.get("event", "")
        value = event.get("value", "")
        
        try:
            event_time = datetime.fromisoformat(event.get("time", "").replace("Z", "+00:00"))
        except:
            event_time = datetime.now()

        # ═══ LOG FILE ENDED = SURGERY COMPLETE ═══
        if event_type == "Log file ended" and value == "Now":
            surgery["is_ended"] = True
            surgery["end_timestamp"] = event_time
            
            # Finalize all active instruments
            for inst_name, inst_start in instrument_start_times.items():
                if inst_name in surgery["instruments"]:
                    elapsed = (event_time - inst_start).total_seconds() / 60
                    surgery["instruments"][inst_name]["duration"] += round(elapsed, 2)
            
            # Calculate total duration from start to now
            if start_time:
                surgery["duration"] = int((event_time - start_time).total_seconds() / 60)
            
            logger.info("🛑 LOG FILE ENDED → Surgery marked as COMPLETE")
            continue

        # Basic info
        if event_type == "Surgery type selected":
            surgery["procedure_name"] = str(value)
        elif event_type == "Surgeon Name":
            surgery["surgeon_name"] = str(value).strip()
        elif event_type == "Patient Info":
            surgery["patient_info"] = str(value)
        elif event_type == "Surgery started":
            try:
                start_time = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                surgery["date"] = start_time.strftime("%Y-%m-%d")
                surgery["time"] = start_time.strftime("%H:%M")
            except:
                pass
        elif event_type == "Clutch Pedal Pressed":
            surgery["clutch_count"] += 1

        # Instrument connected
        elif "Instrument Name" in event_type and value:
            inst_name = str(value)
            position = event_type.replace(" Instrument Name", "")
            
            if inst_name not in surgery["instruments"]:
                surgery["instruments"][inst_name] = {
                    "duration": 0, "count": 0, "is_active": True, "position": position
                }
            else:
                surgery["instruments"][inst_name]["is_active"] = True
            
            instrument_start_times[inst_name] = event_time
            instrument_positions[position] = inst_name
            surgery["instruments"][inst_name]["count"] += 1

        # Instrument removed
        elif "Instrument removed" in event_type:
            position = event_type.replace(" Instrument removed", "")
            inst_name = instrument_positions.get(position)
            
            if inst_name and inst_name in instrument_start_times:
                elapsed = (event_time - instrument_start_times[inst_name]).total_seconds() / 60
                surgery["instruments"][inst_name]["duration"] += round(elapsed, 2)
                surgery["instruments"][inst_name]["is_active"] = False
                del instrument_start_times[inst_name]
                del instrument_positions[position]

    # Live surgery: add active duration for connected instruments
    if not surgery["is_ended"] and instrument_start_times:
        current_time = datetime.now()
        for inst_name, inst_start in instrument_start_times.items():
            if inst_name in surgery["instruments"]:
                elapsed = (current_time - inst_start).total_seconds() / 60
                surgery["instruments"][inst_name]["active_duration"] = round(elapsed, 2)

    # Live duration calculation
    if not surgery["is_ended"] and start_time:
        surgery["duration"] = int((datetime.now() - start_time).total_seconds() / 60)

    return surgery

# ========================================
# DATABASE OPERATIONS
# ========================================
async def save_surgery(surgery: dict, is_live: bool = False) -> int | None:
    db = await get_db()
    surgeon_name = surgery["surgeon_name"].strip()
    instruments_names = ",".join(surgery["instruments"].keys())
    instruments_durations = ",".join(str(round(v["duration"], 2)) for v in surgery["instruments"].values())

    try:
        cursor = await db.execute(
            "SELECT id FROM surgeries WHERE is_live = 1 AND LOWER(TRIM(surgeon_name)) = LOWER(?)",
            (surgeon_name,)
        )
        existing = await cursor.fetchone()

        if existing and is_live:
            await db.execute("""
                UPDATE surgeries SET procedure_name=?, date=?, time=?, duration=?,
                patient_info=?, instruments_names=?, instruments_durations=?, clutch_count=?
                WHERE id=?
            """, (surgery["procedure_name"], surgery["date"], surgery["time"], surgery["duration"],
                  surgery["patient_info"], instruments_names, instruments_durations,
                  surgery["clutch_count"], existing[0]))
            surgery_id = existing[0]
        else:
            cursor = await db.execute("""
                INSERT INTO surgeries (procedure_name, date, time, duration, surgeon_name,
                patient_info, instruments_names, instruments_durations, clutch_count, is_live)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (surgery["procedure_name"], surgery["date"], surgery["time"], surgery["duration"],
                  surgeon_name, surgery["patient_info"], instruments_names,
                  instruments_durations, surgery["clutch_count"], 1 if is_live else 0))
            surgery_id = cursor.lastrowid

        await db.commit()
        return surgery_id
    except Exception as e:
        logger.error(f"DB error: {e}")
        return None
    finally:
        await db.close()

def archive_json(filepath: Path, surgeon: str, procedure: str):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = f"{surgeon.replace(' ', '_')}_{procedure.replace(' ', '_')}_{timestamp}.json"
        shutil.copy2(filepath, ARCHIVE_FOLDER / safe_name)
        logger.info(f"✅ Archived: {safe_name}")
    except Exception as e:
        logger.error(f"Archive error: {e}")

def serialize_surgery_data(surgery: dict) -> dict:
    serialized = surgery.copy()
    if "end_timestamp" in serialized and isinstance(serialized["end_timestamp"], datetime):
        serialized["end_timestamp"] = serialized["end_timestamp"].isoformat()
    
    if "instruments" in serialized:
        instruments_clean = {}
        for name, data in serialized["instruments"].items():
            instruments_clean[name] = {
                "duration": data.get("duration", 0),
                "count": data.get("count", 0),
                "is_active": data.get("is_active", False),
                "position": data.get("position", ""),
                "active_duration": data.get("active_duration", 0)
            }
        serialized["instruments"] = instruments_clean
    return serialized

# ========================================
# FILE WATCHER
# ========================================
class SurgeryFileHandler(FileSystemEventHandler):
    def __init__(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        self.last_modified = {}
        self.surgeon_surgery_map: Dict[str, int] = {}
        self.last_saved_hash: Dict[str, str] = {}
        self.completed_surgeries: set = set()  # Track completed surgery IDs

    def _get_hash(self, surgery: dict) -> str:
        data = {
            "procedure": surgery.get("procedure_name", ""),
            "duration": surgery.get("duration", 0),
            "clutch": surgery.get("clutch_count", 0),
            "ended": surgery.get("is_ended", False),
            "instruments": {k: round(v.get("duration", 0), 1) for k, v in surgery.get("instruments", {}).items()}
        }
        return json.dumps(data, sort_keys=True)

    def on_modified(self, event):
        if event.is_directory or not event.src_path.endswith('.json'):
            return
        
        path = event.src_path
        now = datetime.now().timestamp()
        if path in self.last_modified and now - self.last_modified[path] < 1.5:
            return
        self.last_modified[path] = now
        asyncio.run_coroutine_threadsafe(self.process_file(path), self.loop)

    async def process_file(self, filepath_str: str):
        filepath = Path(filepath_str)
        try:
            await asyncio.sleep(0.15)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read().strip()

            if not content or content == '[]':
                return

            data = json.loads(content)
            if not isinstance(data, list) or not data:
                return

            surgery = parse_surgery_json(data)
            if not surgery["surgeon_name"] or not surgery["procedure_name"]:
                return

            surgeon = surgery["surgeon_name"].strip()
            surgeon_key = surgeon.lower()
            current_hash = self._get_hash(surgery)

            # Check if already saved
            if surgeon_key in self.last_saved_hash and self.last_saved_hash[surgeon_key] == current_hash:
                logger.info(f"⏭️  No changes for {surgeon}")
                return

            is_complete = surgery["is_ended"]
            logger.info(f"→ {surgeon} | {surgery['procedure_name']} | "
                       f"{'COMPLETE' if is_complete else 'LIVE'} | {surgery['duration']} min")

            if is_complete:
                # Check if already completed
                db = await get_db()
                try:
                    cursor = await db.execute("""
                        SELECT id FROM surgeries 
                        WHERE LOWER(TRIM(surgeon_name)) = LOWER(?)
                        AND procedure_name = ? AND duration = ? AND is_live = 0
                        ORDER BY created_at DESC LIMIT 1
                    """, (surgeon, surgery["procedure_name"], surgery["duration"]))
                    existing = await cursor.fetchone()
                finally:
                    await db.close()

                if existing:
                    logger.info(f"⏭️  Already completed: ID {existing[0]}")
                    surgery_id = existing[0]
                else:
                    # Mark old live as complete
                    if surgeon_key in self.surgeon_surgery_map:
                        old_id = self.surgeon_surgery_map[surgeon_key]
                        db = await get_db()
                        await db.execute("UPDATE surgeries SET is_live=0 WHERE id=?", (old_id,))
                        await db.commit()
                        await db.close()
                        del self.surgeon_surgery_map[surgeon_key]

                    # Save as completed
                    surgery_id = await save_surgery(surgery, is_live=False)
                    if surgery_id:
                        archive_json(filepath, surgeon, surgery["procedure_name"])
                        logger.info(f"✅ Completed surgery saved: ID {surgery_id}")

                # Broadcast completion
                await manager.broadcast({
                    "type": "surgery_complete",
                    "surgery": serialize_surgery_data(surgery),
                    "surgeon_name": surgeon,
                    "surgery_id": surgery_id,
                    "status": "completed"
                })
                self.last_saved_hash[surgeon_key] = current_hash

            else:
                # Live surgery
                surgery_id = await save_surgery(surgery, is_live=True)
                if surgery_id:
                    self.surgeon_surgery_map[surgeon_key] = surgery_id
                    await manager.broadcast({
                        "type": "surgery_update",
                        "surgery": serialize_surgery_data(surgery),
                        "surgeon_name": surgeon,
                        "surgery_id": surgery_id,
                        "status": "live"
                    })
                    self.last_saved_hash[surgeon_key] = current_hash

        except Exception as e:
            logger.error(f"Process error: {e}")

    async def start_polling(self):
        filepath = WATCH_FOLDER / "current_surgery.json"
        while True:
            await asyncio.sleep(60)
            if filepath.exists():
                await self.process_file(str(filepath))

# ========================================
# STARTUP
# ========================================
observer: Observer | None = None
file_handler: SurgeryFileHandler | None = None

def start_file_watcher(loop: asyncio.AbstractEventLoop):
    global observer, file_handler
    file_handler = SurgeryFileHandler(loop)
    observer = Observer()
    observer.schedule(file_handler, str(WATCH_FOLDER), recursive=False)
    observer.start()
    asyncio.run_coroutine_threadsafe(file_handler.start_polling(), loop)

# ========================================
# API ROUTES
# ========================================
@app.get("/surgeries/{surgeon_name}")
async def get_surgeries_by_surgeon(surgeon_name: str):
    db = await get_db()
    try:
        cursor = await db.execute("""
            SELECT * FROM surgeries 
            WHERE LOWER(TRIM(surgeon_name)) = LOWER(?)
            ORDER BY created_at DESC LIMIT 50
        """, (surgeon_name.strip(),))
        rows = await cursor.fetchall()
        return [{
            "id": r[0], "procedure_name": r[1], "date": r[2], "time": r[3],
            "duration": r[4], "surgeon_name": r[5], "patient_info": r[6],
            "instruments_names": r[7], "instruments_durations": r[8],
            "clutch_count": r[9], "created_at": r[10], "is_live": bool(r[11])
        } for r in rows]
    finally:
        await db.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Send last surgery on connect
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM surgeries ORDER BY created_at DESC LIMIT 1")
        row = await cursor.fetchone()
        if row:
            instruments = {}
            if row[7] and row[8]:
                names = row[7].split(',')
                durations = row[8].split(',')
                for n, d in zip(names, durations):
                    instruments[n] = {"duration": float(d), "count": 0}
            
            await manager.broadcast({
                "type": "surgery_complete" if not row[11] else "surgery_update",
                "surgery": {
                    "procedure_name": row[1], "date": row[2], "time": row[3],
                    "duration": row[4], "surgeon_name": row[5], "patient_info": row[6],
                    "instruments": instruments, "clutch_count": row[9],
                    "is_ended": not row[11]
                },
                "surgeon_name": row[5],
                "surgery_id": row[0],
                "status": "completed" if not row[11] else "live"
            })
    finally:
        await db.close()
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.on_event("startup")
async def startup():
    loop = asyncio.get_running_loop()
    threading.Thread(target=start_file_watcher, args=(loop,), daemon=True).start()

@app.on_event("shutdown")
async def shutdown():
    global observer
    if observer:
        observer.stop()
        observer.join()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")