"""
Integrated launcher:
- Starts backend (subprocess)
- Starts frontend as a separate OS Process that runs Hypercorn + Quart (serves your Vite build)
- Provides a simple interactive menu to restart/stop each process
"""

import sys
import json
import subprocess
import argparse

def split_ints(x):
    return [int(i) for i in x.split(",")]

parser = argparse.ArgumentParser(description="Start ANT backend/frontend")
parser.add_argument("gpu_ids", type=split_ints, help="GPU IDs to be utilized by ANT, separated by commas")
parser.add_argument("--config", type=str, default="config/default.json", help="JSON config for ANT")
parser.add_argument("--cert_path", type=str, default="./cert/", help="SSL Certificate Path")
args, unknown_args = parser.parse_known_args()

GPU_IDS = args.gpu_ids
CONFIG = args.config
CERT_PATH = args.cert_path

with open(CONFIG, "r") as f:
    opt = json.load(f)

BACKEND_PROC = None
FRONTEND_PROC = None

def start_backend():
    global BACKEND_PROC
    backend_args = ["python", "src/backend/launch.py",
                    ",".join(map(str, GPU_IDS)),
                    "--config", CONFIG] + unknown_args
    print(f"Starting backend with args: {backend_args}")
    BACKEND_PROC = subprocess.Popen(backend_args)
    print(f"Backend started with PID {BACKEND_PROC.pid}")

def stop_process(proc, name="Process"):
    if proc is None:
        return
    # handle Popen and multiprocessing.Process objects
    try:
        if isinstance(proc, subprocess.Popen):
            if proc.poll() is None:
                print(f"Stopping {name} (PID {proc.pid})...")
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                print(f"{name} stopped.")
        else:
            # assume multiprocessing.Process
            if proc.is_alive():
                print(f"Stopping {name} (PID {proc.pid})...")
                proc.terminate()  # sends SIGTERM on POSIX
                proc.join(timeout=5)
                if proc.is_alive():
                    print(f"{name} did not exit; killing...")
                    proc.kill()
                    proc.join(timeout=2)
                print(f"{name} stopped.")
    except Exception as e:
        print(f"Error when stopping {name}: {e}")

def start_frontend():
    global FRONTEND_PROC
    frontend_args = ["python", "src/frontend/launch.py",
                    "--config", CONFIG,
                    "--cert_path", CERT_PATH] + unknown_args
    print(f"Starting frontend with args: {frontend_args}")
    FRONTEND_PROC = subprocess.Popen(frontend_args)
    print(f"Backend started with PID {FRONTEND_PROC.pid}")

def menu():
    start_backend()
    start_frontend()

    try:
        while True:
            print("\n===== CONTROL MENU =====")
            print("1) Restart frontend")
            print("2) Quit")
            print("========================")
            choice = input("Choose: ").strip()

            if choice == "1":
                stop_process(FRONTEND_PROC, "Frontend")
                start_frontend()
            elif choice == "2":
                print("Stopping all processes...")
                stop_process(BACKEND_PROC, "Backend")
                stop_process(FRONTEND_PROC, "Frontend")
                sys.exit(0)
            else:
                print("Invalid option")

    except KeyboardInterrupt:
        print("Interrupted; shutting down...")
        stop_process(BACKEND_PROC, "Backend")
        stop_process(FRONTEND_PROC, "Frontend")
        sys.exit(0)

if __name__ == "__main__":    
    menu()
