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