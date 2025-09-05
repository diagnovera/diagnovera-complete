#!/bin/bash
# quick_start_diagnovera.sh
# Quick start script to get Diagnovera up and running

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    case $2 in
        "error")
            echo -e "${RED}✗ $1${NC}"
            ;;
        "success")
            echo -e "${GREEN}✓ $1${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠ $1${NC}"
            ;;
        *)
            echo -e "${BLUE}ℹ $1${NC}"
            ;;
    esac
}

# Header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Diagnovera Quick Start Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check prerequisites
print_status "Checking prerequisites..." "info"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_status "gcloud CLI is not installed" "error"
    echo "Please install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_status "Python 3 is not installed" "error"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_status "Node.js is not installed" "error"
    exit 1
fi

print_status "All prerequisites met!" "success"

# Get project configuration
echo ""
echo "Enter your Google Cloud Project ID:"
read PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    print_status "Project ID is required" "error"
    exit 1
fi

echo "Enter your preferred region (default: us-central1):"
read REGION
REGION=${REGION:-us-central1}

# Set up Google Cloud
print_status "Configuring Google Cloud project..." "info"
gcloud config set project $PROJECT_ID

# Enable required APIs
print_status "Enabling required APIs (this may take a few minutes)..." "info"
gcloud services enable \
    firestore.googleapis.com \
    cloudfunctions.googleapis.com \
    cloudbuild.googleapis.com \
    pubsub.googleapis.com \
    cloudrun.googleapis.com \
    storage.googleapis.com \
    language.googleapis.com \
    healthcare.googleapis.com \
    aiplatform.googleapis.com \
    artifactregistry.googleapis.com || print_status "Some APIs may already be enabled" "warning"

# Create Firestore database
print_status "Creating Firestore database..." "info"
gcloud firestore databases create --region=$REGION 2>/dev/null || print_status "Firestore database already exists" "warning"

# Create Storage bucket
BUCKET_NAME="${PROJECT_ID}-diagnostic-data"
print_status "Creating Cloud Storage bucket: $BUCKET_NAME" "info"
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME 2>/dev/null || print_status "Bucket already exists" "warning"

# Create Pub/Sub topics
print_status "Creating Pub/Sub topics..." "info"
gcloud pubsub topics create diagnostic-processing 2>/dev/null || print_status "Topic 'diagnostic-processing' already exists" "warning"
gcloud pubsub topics create library-building 2>/dev/null || print_status "Topic 'library-building' already exists" "warning"

# Set up backend
print_status "Setting up backend..." "info"
cd diagnovera-backend

# Create .env file
cat > .env << EOF
GCP_PROJECT_ID=$PROJECT_ID
GCS_BUCKET_NAME=$BUCKET_NAME
ENVIRONMENT=development
PORT=8080
EOF

# Install Python dependencies
print_status "Installing Python dependencies..." "info"
pip install -r requirements.txt

# Set up frontend
print_status "Setting up frontend..." "info"
cd ../diagnovera-frontend

# Update .env.local
cat > .env.local << EOF
VITE_API_URL=http://localhost:8080
EOF

# Install Node dependencies
print_status "Installing frontend dependencies..." "info"
npm install

# Upload ICD10 data
cd ..
print_status "Preparing to upload ICD10 data..." "info"

# Check if service account key exists
if [ -f "terraform/terraform-sa.json" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="terraform/terraform-sa.json"
    print_status "Using service account from terraform/terraform-sa.json" "success"
else
    print_status "No service account key found, using default credentials" "warning"
fi

# Create upload script in backend
cat > diagnovera-backend/upload_icd10.py << 'EOF'
import sys
sys.path.append('.')
from scripts.upload_icd10_to_firestore import main

if __name__ == "__main__":
    main()
EOF

# Ask if user wants to upload ICD10 data now
echo ""
echo -e "${YELLOW}Do you want to upload ICD10 data to Firestore now? (yes/no)${NC}"
read UPLOAD_NOW

if [ "$UPLOAD_NOW" = "yes" ]; then
    print_status "Uploading ICD10 data..." "info"
    cd diagnovera-backend
    python upload_icd10.py \
        --project-id $PROJECT_ID \
        --excel-file ../resources/ICD10_2026.xlsx \
        --batch-size 500
    cd ..
else
    print_status "You can upload ICD10 data later by running:" "info"
    echo "  cd diagnovera-backend"
    echo "  python upload_icd10.py --project-id $PROJECT_ID --excel-file ../resources/ICD10_2026.xlsx"
fi

# Create run scripts
print_status "Creating run scripts..." "info"

# Backend run script
cat > run_backend.sh << EOF
#!/bin/bash
export GCP_PROJECT_ID=$PROJECT_ID
export GCS_BUCKET_NAME=$BUCKET_NAME
export GOOGLE_APPLICATION_CREDENTIALS=terraform/terraform-sa.json
cd diagnovera-backend
python main.py
EOF
chmod +x run_backend.sh

# Frontend run script
cat > run_frontend.sh << EOF
#!/bin/bash
cd diagnovera-frontend
npm run dev
EOF
chmod +x run_frontend.sh

# Create deploy script
cat > deploy_to_cloud.sh << EOF
#!/bin/bash
# Deploy to Google Cloud

# Deploy backend to Cloud Run
echo "Deploying backend to Cloud Run..."
cd diagnovera-backend
gcloud run deploy diagnovera-backend \\
    --source . \\
    --platform managed \\
    --region $REGION \\
    --allow-unauthenticated \\
    --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,GCS_BUCKET_NAME=$BUCKET_NAME"

# Get the service URL
SERVICE_URL=\$(gcloud run services describe diagnovera-backend --region=$REGION --format='value(status.url)')
echo "Backend deployed at: \$SERVICE_URL"

# Update frontend with production API URL
cd ../diagnovera-frontend
echo "VITE_API_URL=\$SERVICE_URL" > .env.production

# Build and deploy frontend (you can deploy to Vercel instead)
npm run build
echo "Frontend built. Deploy the 'dist' folder to your hosting service."
EOF
chmod +x deploy_to_cloud.sh

# Create test script
cat > test_system.sh << EOF
#!/bin/bash
# Test the diagnostic system

echo "Testing health endpoint..."
curl -s http://localhost:8080/api/health | python -m json.tool

echo -e "\n\nTesting diagnosis endpoint..."
curl -s -X POST http://localhost:8080/api/diagnose \\
  -H "Content-Type: application/json" \\
  -d '{
    "encounter_id": "TEST-001",
    "subjective": {
      "age": 55,
      "sex": "M",
      "chief_complaint": "chest pain",
      "hpi": "sudden onset chest pain with shortness of breath",
      "pmh": "hypertension, diabetes",
      "medications": "metformin, lisinopril",
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
    "examination": "Patient appears distressed, diaphoretic",
    "laboratory": "Troponin I: 2.5 ng/mL (elevated)",
    "imaging": "ECG shows ST elevation in V2-V4"
  }' | python -m json.tool
EOF
chmod +x test_system.sh

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
print_status "Project ID: $PROJECT_ID" "info"
print_status "Region: $REGION" "info"
print_status "Bucket: $BUCKET_NAME" "info"
echo ""
echo "To run the system locally:"
echo "  1. In terminal 1: ./run_backend.sh"
echo "  2. In terminal 2: ./run_frontend.sh"
echo "  3. Open http://localhost:5173 in your browser"
echo ""
echo "To test the system:"
echo "  ./test_system.sh"
echo ""
echo "To deploy to Google Cloud:"
echo "  ./deploy_to_cloud.sh"
echo ""
print_status "Happy coding! 🚀" "success"