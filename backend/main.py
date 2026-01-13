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

# Assuming these exist in your project
from database import init_db, get_db
from config import WATCH_FOLDER, HOST, PORT

# ========================================
# LOGGER + DATABASE + ARCHIVE
# ========================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
init_db()

ARCHIVE_FOLDER = WATCH_FOLDER.parent / "completed_surgeries"
ARCHIVE_FOLDER.mkdir(exist_ok=True)

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
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"❌ WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        logger.info(f"📡 Broadcasting ({message.get('type')}) to {len(self.active_connections)} clients")
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
                disconnected.append(connection)
        for dc in disconnected:
            self.disconnect(dc)

manager = ConnectionManager()

# ========================================
# JSON PARSER
# ========================================
def parse_surgery_json(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Parse surgery events and detect end status"""
    surgery = {
        "procedure_name": "",
        "date": "",
        "time": "",
        "duration": 0,
        "surgeon_name": "",
        "patient_info": "",
        "instruments": {},
        "clutch_count": 0,
        "is_ended": False,
        "end_timestamp": None,
    }

    start_time = None
    current_instrument = None

    for event in data:
        if not isinstance(event, dict):
            continue

        event_type = event.get("event", "")
        value = event.get("value", "")
        event_time_str = event.get("time")

        # ─── Detect final log marker ───
        if event_type == "Log file ended" and value == "Now":
            surgery["is_ended"] = True
            try:
                surgery["end_timestamp"] = datetime.fromisoformat(event_time_str)
            except:
                surgery["end_timestamp"] = datetime.now()
            continue

        if event_type == "Surgery type selected":
            surgery["procedure_name"] = str(value)

        elif event_type == "Surgeon Name":
            surgery["surgeon_name"] = str(value)

        elif event_type == "Patient Info":
            surgery["patient_info"] = str(value)

        elif event_type == "Surgery started":
            try:
                dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                surgery["date"] = dt.strftime("%Y-%m-%d")
                surgery["time"] = dt.strftime("%H:%M")
                start_time = dt
            except Exception as e:
                logger.error(f"Start time parse error: {e}")

        elif event_type == "Surgery stopped":
            try:
                stop_time = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                if start_time:
                    surgery["duration"] = int((stop_time - start_time).total_seconds() / 60)
                    surgery["is_ended"] = True
                    surgery["end_timestamp"] = stop_time
            except Exception as e:
                logger.error(f"Stop time parse error: {e}")

        elif event_type == "Surgery duration" and surgery["duration"] == 0:
            try:
                h, m, _ = map(int, value.split(":"))
                surgery["duration"] = h * 60 + m
            except:
                pass

        elif event_type == "Clutch Pedal Pressed":
            surgery["clutch_count"] += 1

        elif "Instrument Name" in event_type:
            current_instrument = str(value)
            if current_instrument not in surgery["instruments"]:
                surgery["instruments"][current_instrument] = {"duration": 0, "count": 0}

        elif "Instrument Connected duration is" in event_type and current_instrument:
            try:
                sec = float(value)
                surgery["instruments"][current_instrument]["duration"] = round(sec / 60, 2)
            except:
                pass

        elif "Instrument Count is" in event_type and current_instrument:
            try:
                surgery["instruments"][current_instrument]["count"] = int(value)
            except:
                pass

    # Final duration calculation
    if surgery["is_ended"] and start_time and surgery["end_timestamp"]:
        surgery["duration"] = max(0, int((surgery["end_timestamp"] - start_time).total_seconds() / 60))
    elif start_time and not surgery["is_ended"]:
        surgery["duration"] = max(0, int((datetime.now() - start_time).total_seconds() / 60))

    return surgery

# ========================================
# DATABASE & ARCHIVE HELPERS
# ========================================
async def save_surgery(surgery: dict, is_live: bool = False) -> int | None:
    db = await get_db()

    instruments_names = ",".join(surgery["instruments"].keys())
    instruments_durations = ",".join(
        str(round(v["duration"], 2)) for v in surgery["instruments"].values()
    )

    try:
        # Check for existing live surgery by surgeon
        cursor = await db.execute(
            "SELECT id FROM surgeries WHERE is_live = 1 AND surgeon_name = ?",
            (surgery["surgeon_name"],)
        )
        existing = await cursor.fetchone()

        if existing and is_live:
            # Update existing live record
            await db.execute("""
                UPDATE surgeries SET
                    procedure_name = ?, date = ?, time = ?, duration = ?,
                    patient_info = ?, instruments_names = ?, instruments_durations = ?,
                    clutch_count = ?, is_live = 1
                WHERE id = ?
            """, (
                surgery["procedure_name"], surgery["date"], surgery["time"], surgery["duration"],
                surgery["patient_info"], instruments_names, instruments_durations,
                surgery["clutch_count"], existing[0]
            ))
            surgery_id = existing[0]
            logger.info(f"Updated live surgery {surgery_id} – {surgery['duration']} min")
        else:
            # Insert new record
            cursor = await db.execute("""
                INSERT INTO surgeries (
                    procedure_name, date, time, duration, surgeon_name,
                    patient_info, instruments_names, instruments_durations,
                    clutch_count, is_live
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                surgery["procedure_name"], surgery["date"], surgery["time"], surgery["duration"],
                surgery["surgeon_name"], surgery["patient_info"], instruments_names,
                instruments_durations, surgery["clutch_count"], 1 if is_live else 0
            ))
            surgery_id = cursor.lastrowid
            logger.info(f"Inserted {'live' if is_live else 'completed'} surgery {surgery_id}")

        await db.commit()
        return surgery_id

    except Exception as e:
        logger.error(f"DB error: {e}", exc_info=True)
        return None
    finally:
        await db.close()


async def mark_surgery_complete(surgery_id: int):
    db = await get_db()
    try:
        await db.execute("UPDATE surgeries SET is_live = 0 WHERE id = ?", (surgery_id,))
        await db.commit()
        logger.info(f"Marked surgery {surgery_id} as completed")
    except Exception as e:
        logger.error(f"Error marking complete: {e}")
    finally:
        await db.close()


def archive_and_clear_json(filepath: Path, surgeon_name: str, procedure_name: str):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_surgeon = surgeon_name.replace(" ", "_").replace(".", "")
        safe_proc = procedure_name.replace(" ", "_").replace("/", "-")

        archive_name = f"{safe_surgeon}_{safe_proc}_{timestamp}.json"
        archive_path = ARCHIVE_FOLDER / archive_name

        shutil.copy2(filepath, archive_path)
        logger.info(f"Archived → {archive_path}")

        # Clear current file → ready for next surgery
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        logger.info(f"Cleared current_surgery.json")

    except Exception as e:
        logger.error(f"Archive/clear error: {e}")

# ========================================
# FILE WATCHER
# ========================================
class SurgeryFileHandler(FileSystemEventHandler):
    def __init__(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        self.last_modified = {}
        self.surgeon_surgery_map: Dict[str, int] = {}  # surgeon → live surgery id

    def on_modified(self, event):
        if event.is_directory or not event.src_path.endswith('.json'):
            return

        now = datetime.now().timestamp()
        path = event.src_path
        if path in self.last_modified and now - self.last_modified[path] < 1.5:
            return
        self.last_modified[path] = now

        logger.info(f"File changed: {path}")
        asyncio.run_coroutine_threadsafe(self.process_file(path), self.loop)

    async def process_file(self, filepath_str: str):
        filepath = Path(filepath_str)
        max_retries = 4
        for attempt in range(max_retries):
            try:
                await asyncio.sleep(0.15)

                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read().strip()

                if not content or content == '[]':
                    if attempt == max_retries - 1:
                        logger.warning(f"File empty after retries: {filepath}")
                    await asyncio.sleep(0.4)
                    continue

                data = json.loads(content)
                if not isinstance(data, list) or not data:
                    logger.warning("Invalid or empty event list")
                    return

                surgery = parse_surgery_json(data)
                if not surgery["surgeon_name"] or not surgery["procedure_name"]:
                    logger.warning("Missing surgeon or procedure – skipping")
                    return

                surgeon = surgery["surgeon_name"]
                is_complete = surgery["is_ended"] and surgery["duration"] > 0

                logger.info(f"→ {surgeon} | {surgery['procedure_name']} | "
                            f"{'COMPLETE' if is_complete else 'LIVE'} | "
                            f"{surgery['duration']} min")

                if is_complete:
                    # Complete surgery logic
                    if surgeon in self.surgeon_surgery_map:
                        old_id = self.surgeon_surgery_map[surgeon]
                        await mark_surgery_complete(old_id)
                        del self.surgeon_surgery_map[surgeon]

                    surgery_id = await save_surgery(surgery, is_live=False)
                    if surgery_id:
                        logger.info(f"Completed surgery saved → ID {surgery_id}")

                        # Archive & clear file
                        archive_and_clear_json(filepath, surgeon, surgery["procedure_name"])

                        # Broadcast completion – frontend should KEEP showing this
                        await manager.broadcast({
                            "type": "surgery_complete",
                            "surgery": surgery,
                            "surgeon_name": surgeon,
                            "surgery_id": surgery_id,
                            "status": "completed"
                        })

                else:
                    # Live update
                    surgery_id = await save_surgery(surgery, is_live=True)
                    if surgery_id:
                        self.surgeon_surgery_map[surgeon] = surgery_id
                        logger.info(f"Live update → ID {surgery_id}")

                        await manager.broadcast({
                            "type": "surgery_update",
                            "surgery": surgery,
                            "surgeon_name": surgeon,
                            "surgery_id": surgery_id,
                            "status": "live"
                        })

                break  # success

            except json.JSONDecodeError as e:
                logger.warning(f"JSON error (attempt {attempt+1}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"Process error: {e}", exc_info=True)
                break

# ========================================
# FILE WATCHER SETUP
# ========================================
observer: Observer | None = None

def start_file_watcher(loop: asyncio.AbstractEventLoop):
    global observer
    handler = SurgeryFileHandler(loop)
    observer = Observer()
    observer.schedule(handler, str(WATCH_FOLDER), recursive=False)
    observer.start()
    logger.info(f"Started watching: {WATCH_FOLDER}")

# ========================================
# API ROUTES
# ========================================
@app.get("/surgeries/{surgeon_name}")
async def get_surgeries_by_surgeon(surgeon_name: str):
    db = await get_db()
    try:
        cursor = await db.execute("""
            SELECT * FROM surgeries 
            WHERE surgeon_name = ?
            ORDER BY created_at DESC
            LIMIT 50
        """, (surgeon_name,))
        rows = await cursor.fetchall()

        return [
            {
                "id": r[0], "procedure_name": r[1], "date": r[2], "time": r[3],
                "duration": r[4], "surgeon_name": r[5], "patient_info": r[6],
                "instruments_names": r[7], "instruments_durations": r[8],
                "clutch_count": r[9], "created_at": r[10], "is_live": bool(r[11])
            }
            for r in rows
        ]
    except Exception as e:
        logger.error(f"Query error: {e}")
        return []
    finally:
        await db.close()


@app.get("/config")
async def get_config():
    return {"watch_folder": str(WATCH_FOLDER)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ========================================
# LIFECYCLE
# ========================================
@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    threading.Thread(target=start_file_watcher, args=(loop,), daemon=True).start()
    logger.info("Server startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    global observer
    if observer:
        observer.stop()
        observer.join()
    logger.info("Server shutdown complete")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")