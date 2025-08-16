import os
import time
from datetime import datetime

print("Process A Lite service started...")
print(f"Project ID: {os.environ.get('GCP_PROJECT_ID', 'not set')}")
print(f"Backend URL: {os.environ.get('BACKEND_URL', 'not set')}")

# Simple implementation for now
class ProcessALite:
    def __init__(self):
        self.project_id = os.environ.get('GCP_PROJECT_ID', 'genial-core-467800-k8')
        self.backend_url = os.environ.get('BACKEND_URL', 'http://backend:8080')
    
    def run(self):
        print(f"[{datetime.now()}] Process A Lite running...")
        print(f"Connected to backend at: {self.backend_url}")

# Keep service running
processor = ProcessALite()
while True:
    processor.run()
    time.sleep(60)
