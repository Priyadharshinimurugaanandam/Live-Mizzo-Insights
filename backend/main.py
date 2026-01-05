import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_db

# ========================================
# 1. Logger + Initialize DB
# ========================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize SQLite database
init_db()

# ========================================
# 2. FastAPI + Router + CORS
# ========================================
app = FastAPI()
router = APIRouter()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# 3. Parse JSON → Surgery Row
# ========================================
def parse_json_events(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    row = {
        "procedure_name": "",
        "date": "",
        "time": "",
        "duration": 0,
        "surgeon_name": "",
        "surgeon_image": "/default-surgeon.jpg",
        "instruments_names": [],
        "instruments_images": [],
        "instruments_durations": [],
        "clutch_names": ["Clutch Pedal"],
        "clutch_counts": [0],
    }

    start_time = None
    current_instrument = None
    instruments: Dict[str, float] = {}

    for ev in events:
        if not isinstance(ev, dict):
            continue
        event_type = ev.get("event", "")
        value = ev.get("value", "")

        try:
            if event_type == "Surgery type selected":
                row["procedure_name"] = str(value)
            elif event_type == "Surgeon Name":
                row["surgeon_name"] = str(value)
            elif event_type == "Surgery started" and value:
                try:
                    dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                    row["date"] = dt.strftime("%Y-%m-%d")
                    row["time"] = dt.strftime("%H:%M")
                    start_time = dt
                except:
                    pass
            elif event_type == "Surgery stopped" and value:
                try:
                    stop_dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                    if start_time:
                        row["duration"] = int((stop_dt - start_time).total_seconds() / 60)
                except:
                    pass
            elif event_type == "Surgery duration" and value:
                try:
                    h, m, s = map(int, value.split(":"))
                    row["duration"] = h * 60 + m
                except:
                    pass
            elif event_type == "Clutch Pedal Pressed":
                row["clutch_counts"][0] += 1
            elif "Instrument Name" in event_type and value:
                current_instrument = str(value)
                if current_instrument not in instruments:
                    instruments[current_instrument] = 0.0
            elif "Instrument Connected duration is" in event_type and value:
                if current_instrument:
                    try:
                        instruments[current_instrument] = round(float(value) / 60, 2)
                    except:
                        pass
        except Exception as e:
            logger.warning(f"Parse error: {e}")

    # Finalize
    row["instruments_names"] = list(instruments.keys())
    row["instruments_images"] = [
        f"/instruments/{name.lower().replace(' ', '_').replace(',', '')}.jpg"
        for name in instruments
    ]
    row["instruments_durations"] = [instruments[n] for n in instruments]

    final_row = {
        "procedure_name": row["procedure_name"],
        "date": row["date"],
        "time": row["time"],
        "duration": row["duration"],
        "surgeon_name": row["surgeon_name"],
        "surgeon_image": row["surgeon_image"],
        "instruments_names": ",".join(row["instruments_names"]),
        "instruments": ",".join(row["instruments_images"]),
        "instruments_durations": ",".join(map(str, row["instruments_durations"])),
        "clutch_names": ",".join(row["clutch_names"]),
        "clutch_counts": ",".join(map(str, row["clutch_counts"])),
    }
    return final_row

# ========================================
# 4. POST /upload/json → INSERT INTO surgeries
# ========================================
@router.post("/upload/json")
async def upload_json(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(400, "Only .json files allowed")

    try:
        content = await file.read()
        data = json.loads(content)
        if not isinstance(data, list):
            raise HTTPException(400, "JSON must be array of events")

        surgery_row = parse_json_events(data)

        if not surgery_row["procedure_name"] or not surgery_row["surgeon_name"]:
            raise HTTPException(400, "Missing procedure_name or surgeon_name")

        # INSERT INTO SQLite
        db = await get_db()
        await db.execute("""
            INSERT INTO surgeries (
                procedure_name, date, time, duration, surgeon_name, surgeon_image,
                instruments_names, instruments, instruments_durations,
                clutch_names, clutch_counts
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            surgery_row["procedure_name"],
            surgery_row["date"],
            surgery_row["time"],
            surgery_row["duration"],
            surgery_row["surgeon_name"],
            surgery_row["surgeon_image"],
            surgery_row["instruments_names"],
            surgery_row["instruments"],
            surgery_row["instruments_durations"],
            surgery_row["clutch_names"],
            surgery_row["clutch_counts"],
        ))
        await db.commit()
        await db.close()

        logger.info(f"Uploaded to surgeries: {surgery_row['surgeon_name']} - {surgery_row['procedure_name']}")
        return {"message": "Success", "data": surgery_row}

    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(500, str(e))

# ========================================
# 5. GET /surgeries → FETCH ALL
# ========================================
@router.get("/surgeries")
async def get_surgeries():
    try:
        db = await get_db()
        cursor = await db.execute("""
            SELECT * FROM surgeries ORDER BY created_at DESC
        """)
        rows = await cursor.fetchall()
        await db.close()

        # Convert rows to dictionaries
        surgeries = []
        for row in rows:
            surgeries.append({
                "id": row[0],
                "procedure_name": row[1],
                "date": row[2],
                "time": row[3],
                "duration": row[4],
                "surgeon_name": row[5],
                "surgeon_image": row[6],
                "instruments_names": row[7],
                "instruments_images": row[8],
                "instruments_durations": row[9],
                "clutch_names": row[10],
                "clutch_counts": row[11],
                "created_at": row[12] if len(row) > 12 else None
            })

        return surgeries

    except Exception as e:
        logger.error(f"Fetch error: {e}")
        raise HTTPException(500, str(e))

# ========================================
# 6. INCLUDE ROUTER
# ========================================
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)