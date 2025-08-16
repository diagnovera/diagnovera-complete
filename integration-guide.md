# Integration Guide: Diagnovera Medical Diagnostic System

## Overview
You have an existing project structure that needs to be integrated with the comprehensive Google Cloud backend implementation. Here's how to merge everything together.

## Current Structure Analysis

### What You Have:
1. **diagnovera-backend/** - Basic backend setup with Docker
2. **diagnovera-frontend/** - React frontend with Vite
3. **process-a-lite/** - Separate Python service
4. **terraform/** - Infrastructure as code (partially configured)
5. **resources/** - ICD10 Excel file

### What Needs Integration:
- Complex plane analysis engine
- Cloud Functions for async processing
- Firestore database structure
- Pub/Sub messaging
- NLP processing for text domains

## Step-by-Step Integration

### 1. Update Backend Structure

First, let's enhance your existing `diagnovera-backend/main.py`:

```bash
cd diagnovera-backend
```

Replace the current `main.py` with the enhanced version:

```python
# Copy the main.py content from the artifact "gcloud-backend-main"
# This includes:
# - ComplexPlaneMapper class
# - DiagnosticEngine class
# - All API endpoints
# - Firestore integration
```

Update `requirements.txt`:
```txt
Flask==2.3.2
flask-cors==4.0.0
google-cloud-firestore==2.11.1
google-cloud-storage==2.10.0
google-cloud-pubsub==2.18.0
google-cloud-aiplatform==1.28.0
google-cloud-language==2.10.1
numpy==1.24.3
pandas==2.0.3
gunicorn==20.1.0
python-dotenv==1.0.0
openpyxl==3.1.2
```

Update `Dockerfile`:
```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Use gunicorn for production
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
```

### 2. Create Cloud Functions Directory

```bash
mkdir -p diagnovera-backend/cloud_functions/{patient_processor,library_builder}
```

Add the Cloud Functions from the artifacts:
- Copy patient processor function to `cloud_functions/patient_processor/main.py`
- Copy library builder function to `cloud_functions/library_builder/main.py`

### 3. Update Frontend API Integration

In `diagnovera-frontend/src/api.ts`, update the API endpoints:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = {
  // Health check
  health: async () => {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.json();
  },

  // Main diagnosis endpoint
  diagnose: async (encounterData: any) => {
    const response = await fetch(`${API_BASE_URL}/api/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encounterData),
    });
    return response.json();
  },

  // Get reference library
  getReferenceLibrary: async (params?: { category?: string; search?: string; limit?: number }) => {
    const queryString = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_BASE_URL}/api/reference-library?${queryString}`);
    return response.json();
  },

  // Trigger library build
  buildReferenceLibrary: async (config: any) => {
    const response = await fetch(`${API_BASE_URL}/api/build-reference-library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  },
};
```

### 4. Update Terraform Configuration

Update `terraform/main.tf` to include all necessary resources:

```hcl
# Add to your existing main.tf

# Firestore Database
resource "google_firestore_database" "diagnostic_db" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}

# Cloud Storage Bucket
resource "google_storage_bucket" "diagnostic_data" {
  name          = "${var.project_id}-diagnostic-data"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# Pub/Sub Topics
resource "google_pubsub_topic" "diagnostic_processing" {
  name = "diagnostic-processing"
}

resource "google_pubsub_topic" "library_building" {
  name = "library-building"
}

# Cloud Functions
resource "google_cloudfunctions_function" "patient_processor" {
  name        = "process-patient-encounter"
  description = "Process patient encounters with NLP"
  runtime     = "python39"
  
  available_memory_mb   = 512
  source_archive_bucket = google_storage_bucket.function_bucket.name
  source_archive_object = google_storage_bucket_object.patient_processor_zip.name
  
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.diagnostic_processing.name
  }
  
  entry_point = "process_encounter"
  timeout     = 300
}

resource "google_cloudfunctions_function" "library_builder" {
  name        = "build-reference-library"
  description = "Build ICD10 reference library"
  runtime     = "python39"
  
  available_memory_mb   = 2048
  source_archive_bucket = google_storage_bucket.function_bucket.name
  source_archive_object = google_storage_bucket_object.library_builder_zip.name
  
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.library_building.name
  }
  
  entry_point = "build_library"
  timeout     = 540
}
```

### 5. Initialize ICD10 Library

Create a new script `diagnovera-backend/scripts/init_library.py`:

```python
#!/usr/bin/env python3
import sys
sys.path.append('..')

from initialize_reference_library import ICD10LibraryInitializer
import os

# Use the initialization script from the artifact
# This will upload your ICD10_2026.xlsx to Firestore

if __name__ == "__main__":
    project_id = os.environ.get('GCP_PROJECT_ID')
    bucket_name = f"{project_id}-diagnostic-data"
    
    initializer = ICD10LibraryInitializer(project_id, bucket_name)
    
    # Read the Excel file
    df = initializer.read_icd10_file('../resources/ICD10_2026.xlsx')
    
    # Upload to Firestore
    initializer.upload_to_firestore(df)
    
    print("ICD10 library initialized successfully!")
```

### 6. Update Process A Lite Integration

Modify `process-a-lite/process_a_lite.py` to work with the main backend:

```python
import requests
from google.cloud import pubsub_v1
import json

class ProcessALite:
    def __init__(self, project_id, backend_url):
        self.project_id = project_id
        self.backend_url = backend_url
        self.publisher = pubsub_v1.PublisherClient()
        self.topic_path = self.publisher.topic_path(project_id, 'library-building')
    
    def trigger_library_build(self, icd_codes):
        """Trigger library building for specific ICD codes"""
        message = {
            'task_id': f'LITE-{datetime.utcnow().timestamp()}',
            'icd_codes': icd_codes,
            'source': 'process_a_lite'
        }
        
        # Publish to Pub/Sub
        future = self.publisher.publish(
            self.topic_path,
            json.dumps(message).encode('utf-8')
        )
        
        return future.result()
```

### 7. Environment Configuration

Create `.env` files for each component:

**diagnovera-backend/.env**:
```env
GCP_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-project-id-diagnostic-data
ENVIRONMENT=development
PORT=8080
```

**diagnovera-frontend/.env.local**:
```env
VITE_API_URL=http://localhost:8080
```

### 8. Docker Compose for Local Development

Create `docker-compose.yml` in the root directory:

```yaml
version: '3.8'

services:
  backend:
    build: ./diagnovera-backend
    ports:
      - "8080:8080"
    environment:
      - GCP_PROJECT_ID=${GCP_PROJECT_ID}
      - GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
    volumes:
      - ./terraform/terraform-sa.json:/app/service-account.json:ro
      - ./resources:/app/resources:ro
    depends_on:
      - firestore-emulator

  frontend:
    build: ./diagnovera-frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8080
    depends_on:
      - backend

  process-a-lite:
    build: ./process-a-lite
    environment:
      - GCP_PROJECT_ID=${GCP_PROJECT_ID}
      - BACKEND_URL=http://backend:8080
    depends_on:
      - backend

  firestore-emulator:
    image: google/cloud-sdk:latest
    command: gcloud emulators firestore start --host-port=0.0.0.0:8787
    ports:
      - "8787:8787"
```

### 9. Deployment Script

Create `deploy.sh`:

```bash
#!/bin/bash

# Set variables
PROJECT_ID="your-project-id"
REGION="us-central1"

# Deploy backend to Cloud Run
echo "Deploying backend to Cloud Run..."
cd diagnovera-backend
gcloud run deploy diagnovera-backend \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID"

# Deploy Cloud Functions
echo "Deploying Cloud Functions..."
cd cloud_functions/patient_processor
gcloud functions deploy process-patient-encounter \
  --runtime python39 \
  --trigger-topic diagnostic-processing \
  --entry-point process_encounter \
  --memory 512MB \
  --timeout 300s

cd ../library_builder
gcloud functions deploy build-reference-library \
  --runtime python39 \
  --trigger-topic library-building \
  --entry-point build_library \
  --memory 2GB \
  --timeout 540s

# Deploy frontend to Firebase Hosting (or keep on Vercel)
cd ../../diagnovera-frontend
npm run build
firebase deploy --only hosting

echo "Deployment complete!"
```

### 10. Testing the Integration

Create `test_integration.py`:

```python
import requests
import json
import time

# Test health endpoint
response = requests.get('http://localhost:8080/api/health')
print(f"Health check: {response.json()}")

# Test diagnosis
test_encounter = {
    "encounter_id": "TEST-001",
    "subjective": {
        "age": 55,
        "sex": "M",
        "chief_complaint": "chest pain and shortness of breath",
        "hpi": "Sudden onset chest pain, radiating to left arm",
        "pmh": "Hypertension, Type 2 Diabetes",
        "medications": "Metformin 500mg, Lisinopril 10mg",
        "allergies": "Penicillin"
    },
    "vitals": {
        "temperature": 37.2,
        "heart_rate": 110,
        "bp_systolic": 160,
        "bp_diastolic": 95,
        "oxygen_saturation": 94,
        "respiratory_rate": 22
    },
    "examination": "Patient appears distressed, diaphoretic",
    "laboratory": "Troponin I: 2.5 ng/mL (elevated)",
    "imaging": "ECG shows ST elevation in V2-V4"
}

response = requests.post(
    'http://localhost:8080/api/diagnose',
    json=test_encounter
)

print(f"Diagnosis result: {json.dumps(response.json(), indent=2)}")
```

## Next Steps

1. **Run locally**:
   ```bash
   docker-compose up
   ```

2. **Initialize the database**:
   ```bash
   cd diagnovera-backend/scripts
   python init_library.py
   ```

3. **Deploy to Google Cloud**:
   ```bash
   ./deploy.sh
   ```

4. **Monitor**:
   - Cloud Console: https://console.cloud.google.com
   - Logs: `gcloud logging read`
   - Firestore: Check data in Firestore console

## Key Integration Points

1. **Complex Plane Analysis**: Now integrated into the main backend
2. **NLP Processing**: Handled by Cloud Functions
3. **Database**: Firestore for all disease profiles and patient data
4. **Frontend**: Connected via REST API
5. **Process A Lite**: Can trigger library building via Pub/Sub

This integration maintains your existing structure while adding the sophisticated diagnostic capabilities.