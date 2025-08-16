# DIAGNOVERA Complete Deployment Guide

## Prerequisites

1. **Google Cloud Setup**
   - Active GCP Project: `genial-core-467800-k8`
   - Billing enabled
   - Required APIs enabled
   - gcloud CLI installed locally

2. **Vercel Account**
   - Create account at https://vercel.com
   - Install Vercel CLI: `npm i -g vercel`

3. **Local Tools**
   ```bash
   # Install required tools
   brew install google-cloud-sdk  # macOS
   # or
   curl https://sdk.cloud.google.com | bash  # Linux

   # Install Python 3.9+
   brew install python@3.9

   # Install Node.js 18+
   brew install node@18

   # Install Docker
   # Download from https://www.docker.com/products/docker-desktop
   ```

## Step 1: Initial Google Cloud Setup

### 1.1 Authenticate and Set Project
```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project genial-core-467800-k8

# Set default region
gcloud config set compute/region us-central1
```

### 1.2 Enable Required APIs
```bash
# Enable necessary APIs
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 1.3 Create Service Account
```bash
# Create service account for Process A
gcloud iam service-accounts create diagnovera-process-a \
  --display-name="DIAGNOVERA Process A Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding genial-core-467800-k8 \
  --member="serviceAccount:diagnovera-process-a@genial-core-467800-k8.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding genial-core-467800-k8 \
  --member="serviceAccount:diagnovera-process-a@genial-core-467800-k8.iam.gserviceaccount.com" \
  --role="roles/pubsub.editor"

# Download service account key
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=diagnovera-process-a@genial-core-467800-k8.iam.gserviceaccount.com
```

## Step 2: Setup Project Structure

### 2.1 Create Directory Structure
```bash
mkdir diagnovera
cd diagnovera

# Create backend directory
mkdir -p backend/src
mkdir -p backend/tests

# Create frontend directory
mkdir -p frontend/components
mkdir -p frontend/pages/api
mkdir -p frontend/lib

# Create deployment directory
mkdir -p deployment/terraform
mkdir -p deployment/k8s
```

### 2.2 Initialize Backend (Process A)

Create `backend/requirements.txt`:
```txt
firebase-admin==6.1.0
google-cloud-firestore==2.11.1
google-cloud-pubmed==0.1.0
biopython==1.81
numpy==1.24.3
pandas==2.0.3
aiohttp==3.8.5
asyncio==3.4.3
python-dotenv==1.0.0
fastapi==0.104.1
uvicorn==0.24.0
```

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY service-account-key.json .

ENV PYTHONPATH=/app
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Create `backend/src/main.py`:
```python
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from .process_a import ProcessAOrchestrator

app = FastAPI(title="DIAGNOVERA Process A")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://diagnovera.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "process-a"}

@app.post("/api/process-a/run")
async def run_process_a(background_tasks: BackgroundTasks):
    """Trigger Process A execution"""
    background_tasks.add_task(run_process_a_task)
    return {"status": "started", "message": "Process A initiated"}

async def run_process_a_task():
    orchestrator = ProcessAOrchestrator()
    await orchestrator.build_reference_library()

@app.get("/api/process-a/status")
def get_process_status():
    # Implementation to check process status from Firestore
    return {"status": "running", "progress": 45.5}
```

Copy the Process A code from the artifact into `backend/src/process_a.py`

### 2.3 Initialize Frontend (Process B)

Create `frontend/package.json`:
```json
{
  "name": "diagnovera-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "firebase": "10.5.0",
    "lucide-react": "0.288.0",
    "axios": "1.5.1",
    "@tailwindcss/forms": "0.5.6"
  },
  "devDependencies": {
    "@types/node": "20.8.7",
    "@types/react": "18.2.31",
    "autoprefixer": "10.4.16",
    "postcss": "8.4.31",
    "tailwindcss": "3.3.5",
    "typescript": "5.2.2"
  }
}
```

Install dependencies:
```bash
cd frontend
npm install
```

Create `frontend/lib/firebase.ts`:
```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "genial-core-467800-k8.firebaseapp.com",
  projectId: "genial-core-467800-k8",
  storageBucket: "genial-core-467800-k8.appspot.com",
  messagingSenderId: "924070815611",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
```

## Step 3: Deploy Process A Backend

### 3.1 Build and Push Docker Image
```bash
cd backend

# Configure Docker for Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Create Artifact Registry repository
gcloud artifacts repositories create diagnovera \
  --repository-format=docker \
  --location=us-central1

# Build image
docker build -t us-central1-docker.pkg.dev/genial-core-467800-k8/diagnovera/process-a:latest .

# Push image
docker push us-central1-docker.pkg.dev/genial-core-467800-k8/diagnovera/process-a:latest
```

### 3.2 Deploy to Cloud Run
```bash
# Deploy Process A to Cloud Run
gcloud run deploy diagnovera-process-a \
  --image us-central1-docker.pkg.dev/genial-core-467800-k8/diagnovera/process-a:latest \
  --platform managed \
  --region us-central1 \
  --service-account diagnovera-process-a@genial-core-467800-k8.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10
```

### 3.3 Setup Cloud Scheduler
```bash
# Get the Cloud Run service URL
SERVICE_URL=$(gcloud run services describe diagnovera-process-a --region us-central1 --format 'value(status.url)')

# Create Cloud Scheduler job
gcloud scheduler jobs create http diagnovera-daily-run \
  --location us-central1 \
  --schedule "0 2 * * *" \
  --uri "$SERVICE_URL/api/process-a/run" \
  --http-method POST \
  --oidc-service-account-email diagnovera-process-a@genial-core-467800-k8.iam.gserviceaccount.com
```

## Step 4: Setup Firestore

### 4.1 Create Firestore Database (if not exists)
```bash
# Create Firestore database
gcloud firestore databases create --region=us-central1
```

### 4.2 Deploy Security Rules
Create `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ICD-10 base data (read-only)
    match /icd10_2026/{document=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    
    // Expanded reference library
    match /icd10_expanded_reference_library/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.email == 'diagnovera-process-a@genial-core-467800-k8.iam.gserviceaccount.com';
    }
    
    // Patient encounters
    match /patient_encounters/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### 4.3 Create Indexes
Create `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "icd10_expanded_reference_library",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "icd10_code", "order": "ASCENDING"},
        {"fieldPath": "metadata.version", "order": "DESCENDING"}
      ]
    }
  ]
}
```

Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

## Step 5: Deploy Frontend to Vercel

### 5.1 Prepare Environment Variables
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
NEXT_PUBLIC_API_ENDPOINT=https://diagnovera-process-a-xxxxx.a.run.app
```

### 5.2 Deploy to Vercel
```bash
cd frontend

# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Follow prompts:
# - Set up and deploy: Y
# - Which scope: Select your account
# - Link to existing project: N
# - Project name: diagnovera
# - Directory: ./
# - Override settings: N

# Set environment variables
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
vercel env add NEXT_PUBLIC_API_ENDPOINT

# Deploy to production
vercel --prod
```

## Step 6: Configure PubMed API

### 6.1 Register for PubMed API Key
1. Go to https://www.ncbi.nlm.nih.gov/account/
2. Create an account or login
3. Go to Account Settings → API Key Management
4. Generate new API key

### 6.2 Store API Key in Secret Manager
```bash
# Create secret
echo -n "your-pubmed-api-key" | gcloud secrets create pubmed-api-key \
  --data-file=- \
  --replication-policy="automatic"

# Grant access to service account
gcloud secrets add-iam-policy-binding pubmed-api-key \
  --member="serviceAccount:diagnovera-process-a@genial-core-467800-k8.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 7: Initial Data Load

### 7.1 Trigger First Run
```bash
# Manually trigger Process A
curl -X POST https://diagnovera-process-a-xxxxx.a.run.app/api/process-a/run
```

### 7.2 Monitor Progress
```bash
# Check logs
gcloud run services logs read diagnovera-process-a --region us-central1

# Check Firestore for results
# Use Firebase Console or gcloud firestore
```

## Step 8: Setup Monitoring

### 8.1 Create Monitoring Dashboard
```bash
# Create uptime check
gcloud monitoring uptime create diagnovera-health \
  --display-name="DIAGNOVERA Health Check" \
  --resource-type="gae-app" \
  --resource-labels="module_id=diagnovera-process-a" \
  --http-check-path="/health"
```

### 8.2 Set Up Alerts
```bash
# Create alert policy for failures
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="DIAGNOVERA Process A Failure" \
  --condition-display-name="Cloud Run Error Rate" \
  --condition-metric-type="run.googleapis.com/request_count" \
  --condition-filter='resource.type="cloud_run_revision" AND metric.label.response_code_class!="2xx"'
```

## Step 9: Testing

### 9.1 Test Process A API
```bash
# Health check
curl https://diagnovera-process-a-xxxxx.a.run.app/health

# Check status
curl https://diagnovera-process-a-xxxxx.a.run.app/api/process-a/status
```

### 9.2 Test Frontend
1. Navigate to https://diagnovera.vercel.app
2. Login with test credentials
3. Enter sample patient data
4. Run analysis
5. Verify results display correctly

## Step 10: Production Checklist

- [ ] All environment variables set correctly
- [ ] Service accounts have minimal required permissions
- [ ] Firestore security rules tested
- [ ] API endpoints secured with authentication
- [ ] Error handling and logging implemented
- [ ] Monitoring and alerts configured
- [ ] Backup strategy in place
- [ ] Documentation updated
- [ ] Load testing completed
- [ ] Disaster recovery plan documented

## Troubleshooting

### Common Issues

1. **Firestore Permission Denied**
   ```bash
   # Check service account permissions
   gcloud projects get-iam-policy genial-core-467800-k8 \
     --flatten="bindings[].members" \
     --filter="bindings.members:diagnovera-process-a@"
   ```

2. **Cloud Run Timeout**
   ```bash
   # Increase timeout
   gcloud run services update diagnovera-process-a \
     --timeout=3600 \
     --region=us-central1
   ```

3. **Memory Issues**
   ```bash
   # Increase memory
   gcloud run services update diagnovera-process-a \
     --memory=4Gi \
     --region=us-central1
   ```

## Maintenance

### Daily Tasks
- Monitor Process A execution logs
- Check error rates in Cloud Monitoring
- Verify data quality in Firestore

### Weekly Tasks
- Review API usage and costs
- Update medical database credentials if needed
- Check for security updates

### Monthly Tasks
- Analyze performance metrics
- Optimize batch sizes if needed
- Review and update documentation

## Support

For issues or questions:
1. Check Cloud Logging for detailed error messages
2. Review Firestore data structure
3. Verify all API keys are valid
4. Contact: support@diagnovera.com