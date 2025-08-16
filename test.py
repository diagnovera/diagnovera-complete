import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'diagnovera-sa-key.json'
os.environ['GCP_PROJECT_ID'] = 'genial-core-467800-k8'

from google.cloud import firestore
db = firestore.Client(project='genial-core-467800-k8')
print("✓ Connected to DIAGNOVERA!")