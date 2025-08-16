import os 
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'diagnovera-sa-key.json' 
os.environ['GCP_PROJECT_ID'] = 'genial-core-467800-k8' 
 
print("Testing DIAGNOVERA connection...") 
 
try: 
    from google.cloud import firestore 
    print("✓ google-cloud-firestore imported successfully") 
    db = firestore.Client(project='genial-core-467800-k8') 
    print("✓ Connected to DIAGNOVERA Firestore!") 
    print(f"Project: {db.project}") 
except ImportError as e: 
    print(f"✗ Import error: {e}") 
    print("Run: python -m pip install google-cloud-firestore") 
except Exception as e: 
    print(f"✗ Connection error: {e}") 
