import json
import time
import random
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
WATCH_FOLDER = Path(__file__).parent / "watch_folder"
OUTPUT_FILE = WATCH_FOLDER / "current_surgery.json"
SURGERY_DURATION_MINUTES = 45
LIVE_UPDATE_INTERVAL = 5  # Update every 5 seconds (simulates real-time)

# Surgery data
PROCEDURES = ["Cholecystectomy", "Adrenalectomy", "Nephrectomy", "Hernia Repair"]
SURGEONS = ["Dr.Meril M", "Dr.Raj", "Dr.Rajesh Srivatsava"]
INSTRUMENTS_LEFT = [
    "Monopolar_Cautery_Hook",
    "Vessel Sealer Extend", 
    "SynchroSeal",
    "Small_Graptor"
]
INSTRUMENTS_RIGHT = [
    "Cobra_Grasper",
    "Fenestrated_Bipolar_Forceps",
    "SynchroSeal"
]

def create_watch_folder():
    """Create watch folder if it doesn't exist"""
    WATCH_FOLDER.mkdir(exist_ok=True)
    print(f"✅ Watch folder ready: {WATCH_FOLDER}")

def generate_patient_info():
    """Generate random patient information"""
    name = f"Patient_{random.randint(1, 100)}"
    age = random.randint(25, 75)
    bmi = round(random.uniform(18.5, 35.0), 1)
    return f"Name: {name}, Age: {age}, BMI: {bmi}"

def simulate_live_surgery():
    """Simulate a live surgery with real-time minute updates"""
    
    create_watch_folder()
    
    procedure = random.choice(PROCEDURES)
    surgeon = random.choice(SURGEONS)
    start_time = datetime.now()
    
    print("\n" + "="*60)
    print("🏥 SIMULATING LIVE SURGERY (Real-time Updates)")
    print("="*60)
    print(f"Procedure: {procedure}")
    print(f"Surgeon: {surgeon}")
    print(f"Start Time: {start_time.strftime('%H:%M:%S')}")
    print(f"Target Duration: {SURGERY_DURATION_MINUTES} minutes")
    print(f"Updates every {LIVE_UPDATE_INTERVAL} seconds")
    print("="*60 + "\n")
    
    events = []
    
    # Initial events
    print("📝 Surgery started...")
    events.append({
        "time": start_time.isoformat(),
        "event": "Surgery type selected",
        "value": procedure
    })
    
    events.append({
        "time": start_time.isoformat(),
        "event": "Surgeon Name",
        "value": surgeon
    })
    
    events.append({
        "time": (start_time + timedelta(seconds=10)).isoformat(),
        "event": "Patient Info",
        "value": generate_patient_info()
    })
    
    events.append({
        "time": (start_time + timedelta(seconds=20)).isoformat(),
        "event": "Surgery started",
        "value": start_time.strftime("%Y-%m-%d %H:%M:%S")
    })
    
    # Write initial file (surgery started, duration = 0)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(events, f, indent=2)
    print(f"🔴 LIVE surgery started (0 min)\n")
    
    # Generate clutch presses schedule
    clutch_schedule = sorted([
        random.randint(1, SURGERY_DURATION_MINUTES * 60) 
        for _ in range(random.randint(40, 70))
    ])
    
    # Generate instrument usage
    left_instruments = random.sample(INSTRUMENTS_LEFT, random.randint(2, 4))
    right_instruments = random.sample(INSTRUMENTS_RIGHT, random.randint(2, 3))
    
    instrument_data = []
    for instrument in left_instruments:
        instrument_data.append({
            "name": instrument,
            "arm": "PrimaryLeft",
            "start_min": random.randint(2, 10),
            "duration": round(random.uniform(300, 1500), 6)
        })
    
    for instrument in right_instruments:
        instrument_data.append({
            "name": instrument,
            "arm": "PrimaryRight",
            "start_min": random.randint(2, 10),
            "duration": round(random.uniform(300, 1200), 6)
        })
    
    # Sort by start time
    instrument_data.sort(key=lambda x: x['start_min'])
    
    clutch_count = 0
    instruments_added = set()
    current_minute = 0
    
    # Simulate surgery progression
    while current_minute < SURGERY_DURATION_MINUTES:
        time.sleep(LIVE_UPDATE_INTERVAL)
        
        # Advance time by 1-2 minutes per update
        current_minute += random.randint(1, 2)
        if current_minute > SURGERY_DURATION_MINUTES:
            current_minute = SURGERY_DURATION_MINUTES
        
        current_time = start_time + timedelta(minutes=current_minute)
        
        # Add clutch presses that occurred up to this minute
        new_clutches = sum(1 for t in clutch_schedule if t <= current_minute * 60 and t > (current_minute - 2) * 60)
        for _ in range(new_clutches):
            clutch_count += 1
            events.append({
                "time": current_time.isoformat(),
                "event": "Clutch Pedal Pressed",
                "value": str(clutch_count)
            })
        
        # Add instruments that should be active by now
        for inst in instrument_data:
            if inst['start_min'] <= current_minute and inst['name'] not in instruments_added:
                # Add instrument
                events.append({
                    "time": current_time.isoformat(),
                    "event": f"{inst['arm']} Instrument Name",
                    "value": inst['name']
                })
                events.append({
                    "time": current_time.isoformat(),
                    "event": f"{inst['arm']} Instrument Count is ",
                    "value": "1"
                })
                # Calculate duration proportional to current time
                elapsed_ratio = current_minute / SURGERY_DURATION_MINUTES
                current_duration = inst['duration'] * elapsed_ratio
                events.append({
                    "time": current_time.isoformat(),
                    "event": f"{inst['arm']} Instrument Connected duration is ",
                    "value": str(current_duration)
                })
                instruments_added.add(inst['name'])
        
        # Write updated file (still LIVE, no stop event yet)
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(events, f, indent=2)
        
        print(f"🔴 LIVE UPDATE: {current_minute}/{SURGERY_DURATION_MINUTES} min | Clutch: {clutch_count} | Instruments: {len(instruments_added)}")
    
    # Surgery completion
    print(f"\n✅ Completing surgery...")
    end_time = start_time + timedelta(minutes=SURGERY_DURATION_MINUTES)
    
    # Update all instrument durations to final
    for inst in instrument_data:
        # Find and update the duration event
        for i, event in enumerate(events):
            if (event.get('event', '').startswith(inst['arm']) and 
                'Instrument Connected duration' in event.get('event', '') and
                inst['name'] in [e.get('value', '') for e in events if 'Instrument Name' in e.get('event', '')]):
                events.append({
                    "time": end_time.isoformat(),
                    "event": f"{inst['arm']} Instrument Connected duration is ",
                    "value": str(inst['duration'])
                })
                break
    
    # Add final events
    events.append({
        "time": end_time.isoformat(),
        "event": "Surgery stopped",
        "value": end_time.strftime("%Y-%m-%d %H:%M:%S")
    })
    
    hours = SURGERY_DURATION_MINUTES // 60
    minutes = SURGERY_DURATION_MINUTES % 60
    events.append({
        "time": end_time.isoformat(),
        "event": "Surgery duration",
        "value": f"{hours}:{minutes:02d}:00"
    })
    
    # Write final completed file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(events, f, indent=2)
    
    print("\n" + "="*60)
    print("🎉 SURGERY COMPLETED!")
    print("="*60)
    print(f"Total Events: {len(events)}")

    print(f"Clutch Presses: {clutch_count}")
    print(f"Instruments: {len(instruments_added)}")
    print(f"File: {OUTPUT_FILE}")
    print("="*60 + "\n")

def simulate_quick_test():
    """Quick test with faster updates"""
    global SURGERY_DURATION_MINUTES, LIVE_UPDATE_INTERVAL
    SURGERY_DURATION_MINUTES = 10
    LIVE_UPDATE_INTERVAL = 2
    simulate_live_surgery()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("LIVE SURGERY SIMULATOR")
    print("="*60)
    print("\nOptions:")
    print("  1. Full simulation (45 min, 5 sec updates)")
    print("  2. Quick test (10 min, 2 sec updates)")
    print("="*60)
    
    choice = input("\nEnter choice (1-2, or Enter for full): ").strip()
    
    if choice == "2":
        simulate_quick_test()
    else:
        simulate_live_surgery()
    
    print("\n✅ Check your dashboard - it should update in real-time!")