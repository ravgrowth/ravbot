import os
import subprocess
import time
import hashlib

OUTPUT_DIR = os.path.join(os.getcwd(), "src", "types")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "supabase.ts")
PROJECT_ID = "pjqvhpnpncwhevslmqrj"

def run_generation():
    """Generate Supabase types and write them to OUTPUT_FILE."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    cmd = ["supabase", "gen", "types", "typescript", "--project-id", PROJECT_ID]
    try:
        print(f"⚡ Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(result.stdout)
        print(f"✅ Types generated successfully at {OUTPUT_FILE}")
        return result.stdout
    except subprocess.CalledProcessError as e:
        print("❌ Supabase CLI failed:")
        print(e.stderr or e.stdout)
        return None

def checksum(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest() if data else ""

def watch(interval=60):
    """Re-run generation every time schema output changes."""
    print(f"👀 Watching Supabase schema every {interval} seconds...")
    last_hash = None
    while True:
        data = run_generation()
        new_hash = checksum(data or "")
        if new_hash != last_hash:
            print("🔄 Schema change detected → types updated.")
            last_hash = new_hash
        else:
            print("⏸️  No schema change.")
        time.sleep(interval)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "watch":
        watch(interval=60)  # checks every 60s
    else:
        run_generation()
