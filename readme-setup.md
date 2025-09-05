# Medical Diagnostic System - Google Cloud Setup Guide

## Overview

This medical diagnostic system implements a sophisticated approach using complex plane mathematics to analyze patient data and match it against a comprehensive ICD-10 disease reference library. The system consists of:

- **Process A**: Static ICD-10 reference library built from medical literature
- **Process B**: Dynamic patient encounter processing
- **Complex Plane Analysis**: Maps clinical variables to angles (θ) with magnitudes
- **Advanced Algorithms**: Bayesian probability, Kuramoto synchronization, and Markov analysis

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Vercel Frontend   │────▶│  Google App Engine   │────▶│ Cloud Firestore DB  │
│   (React/Next.js)   │     │    (Flask API)       │     │  (NoSQL Database)   │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────────┐
                            │  Cloud Pub/Sub       │
                            │  (Message Queue)     │
                            └──────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
          ┌──────────────────────┐          ┌──────────────────────┐
          │  Cloud Function       │          │  Cloud Function      │
          │  (Patient Processor)  │          │  (Library Builder)   │
          └──────────────────────┘          └──────────────────────┘
```

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK** installed ([Download here](https://cloud.google.com/sdk/docs/install))
3. **Python 3.9+** installed
4. **Node.js 16+** and npm (for Vercel frontend)
5. **Git** for version control

## Quick Start

### 1. Clone and Setup Project Structure

```bash
# Create project directory
mkdir medical-diagnostic-system
cd medical-diagnostic-system

# Download the setup script
curl -O https://raw.githubusercontent.com/your-repo/setup_medical_diagnostic_system.sh
chmod +x setup_medical_diagnostic_system.sh

# Run the setup script
./setup_medical_diagnostic_system.sh
```

### 2. Manual Setup (Alternative)

If you prefer manual setup:

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Configure gcloud
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  firestore.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  pubsub.googleapis.com \
  appengine.googleapis.com \
  storage.googleapis.com \
  vpcaccess.googleapis.com \
  language.googleapis.com \
  aiplatform.googleapis.com

# Create App Engine app
gcloud app create --region=$REGION

# Create Firestore database
gcloud firestore databases create --region=$REGION

# Create Storage bucket
gsutil mb -p $PROJECT_ID gs://${PROJECT_ID}-diagnostic-data

# Create Pub/Sub topics
gcloud pubsub topics create diagnostic-processing
gcloud pubsub topics create library-building
```

### 3. Initialize ICD-10 Reference Library

```bash
# Install Python dependencies
pip install google-cloud-firestore google-cloud-storage pandas openpyxl

# Run the initialization script
python initialize_reference_library.py \
  --project-id $PROJECT_ID \
  --bucket-name ${PROJECT_ID}-diagnostic-data \
  --file-path ICD10_2026.xlsx \
  --upload-to-gcs
```

### 4. Deploy Backend Services

```bash
# Deploy App Engine
cd medical_diagnostic_system
gcloud app deploy

# Deploy Cloud Functions
cd cloud_functions/patient_processor
gcloud functions deploy process-patient-encounter \
  --entry-point=process_encounter \
  --runtime=python39 \
  --trigger-topic=diagnostic-processing \
  --memory=512MB \
  --timeout=300s

cd ../library_builder
gcloud functions deploy build-reference-library \
  --entry-point=build_library \
  --runtime=python39 \
  --trigger-topic=library-building \
  --memory=2GB \
  --timeout=540s
```

### 5. Configure Vercel Frontend

1. Create a new Vercel project
2. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://YOUR_PROJECT_ID.appspot.com
   ```
3. Deploy the React components provided

## API Endpoints

### Health Check
```bash
GET /api/health
```

### Diagnose Patient Encounter
```bash
POST /api/diagnose
Content-Type: application/json

{
  "encounter_id": "ENC-001",
  "subjective": {
    "age": 55,
    "sex": "M",
    "chief_complaint": "chest pain",
    "hpi": "sudden onset chest pain",
    "pmh": "hypertension",
    "medications": "lisinopril",
    "allergies": "none"
  },
  "vitals": {
    "temperature": 37.2,
    "heart_rate": 110,
    "bp_systolic": 160,
    "bp_diastolic": 95,
    "oxygen_saturation": 94,
    "respiratory_rate": 22
  },
  "examination": "Patient appears distressed",
  "laboratory": "Troponin I: 2.5 ng/mL",
  "imaging": "ECG shows ST elevation"
}
```

### Get Reference Library
```bash
GET /api/reference-library?category=Cardiovascular&limit=10
```

### Build Reference Library
```bash
POST /api/build-reference-library
Content-Type: application/json

{
  "source": "medical_literature",
  "depth": "comprehensive"
}
```

## Complex Plane Representation

Each clinical variable is mapped to:
- **Angle (θ)**: Unique identifier for the variable (0-360°)
- **Magnitude**: Value strength or presence (0-1)
- **Confidence**: Reliability of the data point

Example mapping:
```python
{
  "variable": "chest_pain",
  "angle": 0,
  "magnitude": 0.95,
  "confidence": 0.9,
  "weight": 0.85
}
```

## Monitoring and Debugging

### View Logs
```bash
# App Engine logs
gcloud app logs tail -s default

# Cloud Function logs
gcloud functions logs read process-patient-encounter
gcloud functions logs read build-reference-library
```

### Firestore Console
```
https://console.cloud.google.com/firestore/data?project=YOUR_PROJECT_ID
```

### Error Handling

Common issues and solutions:

1. **Permission Denied**
   ```bash
   gcloud auth application-default login
   ```

2. **Quota Exceeded**
   - Check quotas in Cloud Console
   - Enable billing or request quota increase

3. **Function Timeout**
   - Increase timeout in function deployment
   - Optimize processing logic

## Testing

### Unit Tests
```bash
cd medical_diagnostic_system
python -m pytest tests/
```

### Integration Test
```bash
./test_deployment.sh $PROJECT_ID
```

### Load Testing
```bash
# Install Apache Bench
apt-get install apache2-utils

# Run load test
ab -n 1000 -c 10 -p test_data.json -T application/json \
  https://YOUR_PROJECT_ID.appspot.com/api/diagnose
```

## Security Best Practices

1. **Service Account Permissions**
   - Use least privilege principle
   - Rotate keys regularly

2. **API Security**
   - Implement authentication (Firebase Auth recommended)
   - Use API keys for external access
   - Enable CORS only for trusted domains

3. **Data Privacy**
   - Encrypt sensitive patient data
   - Implement audit logging
   - Comply with HIPAA requirements

## Cost Optimization

1. **Firestore**
   - Use batch operations
   - Implement data retention policies
   - Archive old data to Cloud Storage

2. **Cloud Functions**
   - Use appropriate memory allocation
   - Implement caching where possible
   - Monitor execution times

3. **App Engine**
   - Use automatic scaling wisely
   - Set appropriate instance classes
   - Monitor traffic patterns

## Maintenance

### Daily Tasks
- Monitor error logs
- Check system health metrics
- Review diagnostic accuracy

### Weekly Tasks
- Update reference library with new literature
- Analyze performance metrics
- Review and optimize slow queries

### Monthly Tasks
- Security audit
- Cost analysis
- Backup verification

## Support and Contributing

For issues or questions:
1. Check the troubleshooting guide
2. Review logs for error messages
3. Open an issue on GitHub

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Acknowledgments

- ICD-10 data from CMS
- Medical literature sources
- Google Cloud Platform documentation