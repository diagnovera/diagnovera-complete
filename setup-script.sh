#!/bin/bash
# setup_medical_diagnostic_system.sh
# Complete setup script for Medical Diagnostic System on Google Cloud

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed. Please install it first."
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
echo "Enter your Google Cloud Project ID:"
read PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    print_error "Project ID cannot be empty"
    exit 1
fi

# Set project
print_status "Setting up project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Get region
echo "Enter your preferred region (default: us-central1):"
read REGION
REGION=${REGION:-us-central1}

print_status "Using region: $REGION"

# Enable required APIs
print_status "Enabling required Google Cloud APIs..."
gcloud services enable \
    firestore.googleapis.com \
    cloudfunctions.googleapis.com \
    cloudbuild.googleapis.com \
    pubsub.googleapis.com \
    appengine.googleapis.com \
    storage.googleapis.com \
    vpcaccess.googleapis.com \
    language.googleapis.com \
    healthcare.googleapis.com \
    aiplatform.googleapis.com \
    discoveryengine.googleapis.com

# Create App Engine app if it doesn't exist
print_status "Creating App Engine application..."
gcloud app create --region=$REGION 2>/dev/null || print_warning "App Engine app already exists"

# Create Firestore database
print_status "Creating Firestore database..."
gcloud firestore databases create --region=$REGION 2>/dev/null || print_warning "Firestore database already exists"

# Create Cloud Storage bucket
BUCKET_NAME="${PROJECT_ID}-diagnostic-data"
print_status "Creating Cloud Storage bucket: $BUCKET_NAME"
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME 2>/dev/null || print_warning "Bucket already exists"

# Create Pub/Sub topics
print_status "Creating Pub/Sub topics..."
gcloud pubsub topics create diagnostic-processing 2>/dev/null || print_warning "Topic 'diagnostic-processing' already exists"
gcloud pubsub topics create library-building 2>/dev/null || print_warning "Topic 'library-building' already exists"

# Create VPC network for App Engine
print_status "Creating VPC network..."
gcloud compute networks create diagnostic-vpc \
    --subnet-mode=custom \
    --bgp-routing-mode=regional 2>/dev/null || print_warning "VPC already exists"

# Create subnet
gcloud compute networks subnets create diagnostic-subnet \
    --network=diagnostic-vpc \
    --region=$REGION \
    --range=10.0.0.0/24 2>/dev/null || print_warning "Subnet already exists"

# Create VPC connector
print_status "Creating VPC connector..."
gcloud compute networks vpc-access connectors create diagnostic-connector \
    --region=$REGION \
    --subnet=diagnostic-subnet \
    --subnet-project=$PROJECT_ID \
    --min-instances=2 \
    --max-instances=10 2>/dev/null || print_warning "VPC connector already exists"

# Create service account for the application
SERVICE_ACCOUNT_NAME="medical-diagnostic-sa"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

print_status "Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Medical Diagnostic System Service Account" 2>/dev/null || print_warning "Service account already exists"

# Grant necessary roles to service account
print_status "Granting IAM roles to service account..."
ROLES=(
    "roles/datastore.user"
    "roles/storage.objectAdmin"
    "roles/pubsub.publisher"
    "roles/pubsub.subscriber"
    "roles/cloudfunctions.invoker"
    "roles/logging.logWriter"
    "roles/cloudtrace.agent"
    "roles/healthcare.fhirResourceReader"
    "roles/ml.developer"
)

for ROLE in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="$ROLE" \
        --quiet
done

# Create directories
print_status "Creating project directories..."
mkdir -p medical_diagnostic_system/{cloud_functions,tests,docs}
mkdir -p medical_diagnostic_system/cloud_functions/{patient_processor,library_builder}

# Copy files (assuming they exist in current directory)
print_status "Setting up project files..."

# Create main.py
cat > medical_diagnostic_system/main.py << 'EOF'
# Copy the main.py content from the artifact here
EOF

# Create requirements.txt
cat > medical_diagnostic_system/requirements.txt << 'EOF'
Flask==2.3.2
flask-cors==4.0.0
google-cloud-firestore==2.11.1
google-cloud-storage==2.10.0
google-cloud-pubsub==2.18.0
google-cloud-aiplatform==1.28.0
numpy==1.24.3
pandas==2.0.3
gunicorn==20.1.0
python-dotenv==1.0.0
EOF

# Create app.yaml with actual project ID
cat > medical_diagnostic_system/app.yaml << EOF
runtime: python39
env: standard

instance_class: F4
automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.7

env_variables:
  GCP_PROJECT_ID: "$PROJECT_ID"
  GCS_BUCKET_NAME: "$BUCKET_NAME"
  ENVIRONMENT: "production"

handlers:
- url: /api/.*
  script: auto
  secure: always

vpc_access_connector:
  name: projects/$PROJECT_ID/locations/$REGION/connectors/diagnostic-connector
EOF

# Upload ICD10 file to Cloud Storage
print_status "Uploading ICD10 data file to Cloud Storage..."
if [ -f "ICD10_2026.xlsx" ]; then
    gsutil cp ICD10_2026.xlsx gs://$BUCKET_NAME/icd10_codes.xlsx
else
    print_warning "ICD10_2026.xlsx not found in current directory"
fi

# Deploy Cloud Functions
print_status "Deploying Cloud Functions..."

# Deploy patient processor function
cd medical_diagnostic_system/cloud_functions/patient_processor
cat > main.py << 'EOF'
# Copy the patient processor function content here
EOF

cat > requirements.txt << 'EOF'
google-cloud-firestore==2.11.1
google-cloud-storage==2.10.0
google-cloud-language==2.10.1
google-cloud-aiplatform==1.28.0
numpy==1.24.3
EOF

gcloud functions deploy process-patient-encounter \
    --entry-point=process_encounter \
    --runtime=python39 \
    --trigger-topic=diagnostic-processing \
    --memory=512MB \
    --timeout=300s \
    --region=$REGION \
    --service-account=$SERVICE_ACCOUNT_EMAIL

# Deploy library builder function
cd ../library_builder
cat > main.py << 'EOF'
# Copy the library builder function content here
EOF

cat > requirements.txt << 'EOF'
google-cloud-firestore==2.11.1
google-cloud-storage==2.10.0
google-cloud-aiplatform==1.28.0
google-cloud-discoveryengine==0.11.0
pandas==2.0.3
numpy==1.24.3
EOF

gcloud functions deploy build-reference-library \
    --entry-point=build_library \
    --runtime=python39 \
    --trigger-topic=library-building \
    --memory=2GB \
    --timeout=540s \
    --region=$REGION \
    --service-account=$SERVICE_ACCOUNT_EMAIL

# Deploy App Engine
cd ../../
print_status "Deploying App Engine application..."
gcloud app deploy --quiet

# Create initial Firestore collections
print_status "Initializing Firestore collections..."
cat > init_firestore.py << EOF
from google.cloud import firestore
import datetime

db = firestore.Client()

# Create collections with sample documents
collections = [
    'icd10_reference_library',
    'patient_encounters',
    'diagnosis_results',
    'processed_encounters',
    'library_build_tasks'
]

for collection in collections:
    doc_ref = db.collection(collection).document('_init')
    doc_ref.set({
        'initialized': True,
        'created_at': datetime.datetime.utcnow(),
        'description': f'Collection for {collection}'
    })
    print(f'Initialized collection: {collection}')

# Delete init documents
for collection in collections:
    db.collection(collection).document('_init').delete()
EOF

python init_firestore.py
rm init_firestore.py

# Update Vercel environment variables
print_status "Setting up Vercel environment variables..."
echo ""
echo "Add these environment variables to your Vercel project:"
echo "NEXT_PUBLIC_API_URL=https://${PROJECT_ID}.appspot.com"
echo ""

# Create test script
cat > test_deployment.sh << 'EOF'
#!/bin/bash
# Test the deployment

PROJECT_ID=$1
API_URL="https://${PROJECT_ID}.appspot.com"

echo "Testing health endpoint..."
curl -X GET "${API_URL}/api/health"

echo -e "\n\nTesting diagnosis endpoint with sample data..."
curl -X POST "${API_URL}/api/diagnose" \
  -H "Content-Type: application/json" \
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
    "laboratory": "Troponin I: 2.5 ng/mL (elevated), CK-MB: 25 ng/mL",
    "imaging": "ECG shows ST elevation in leads V2-V4"
  }'
EOF

chmod +x test_deployment.sh

# Final summary
print_status "Deployment completed successfully!"
echo ""
echo "========================================="
echo "DEPLOYMENT SUMMARY"
echo "========================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "App Engine URL: https://${PROJECT_ID}.appspot.com"
echo "Cloud Storage Bucket: gs://$BUCKET_NAME"
echo ""
echo "Next steps:"
echo "1. Update your Vercel frontend environment variables:"
echo "   NEXT_PUBLIC_API_URL=https://${PROJECT_ID}.appspot.com"
echo ""
echo "2. Test the deployment:"
echo "   ./test_deployment.sh $PROJECT_ID"
echo ""
echo "3. Monitor logs:"
echo "   gcloud app logs tail -s default"
echo ""
echo "4. View Firestore data:"
echo "   https://console.cloud.google.com/firestore/data?project=$PROJECT_ID"
echo ""
echo "5. Trigger reference library build:"
echo "   curl -X POST https://${PROJECT_ID}.appspot.com/api/build-reference-library"
echo ""
echo "========================================="