#!/bin/bash
# setup_diagnovera_project.sh
# Specific setup for DIAGNOVERA project: genial-core-467800-k8

PROJECT_ID="genial-core-467800-k8"
PROJECT_NAME="DIAGNOVERA"
PROJECT_NUMBER="924070815611"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  DIAGNOVERA Project Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Project Name: ${GREEN}${PROJECT_NAME}${NC}"
echo -e "Project ID: ${GREEN}${PROJECT_ID}${NC}"
echo -e "Project Number: ${GREEN}${PROJECT_NUMBER}${NC}"
echo ""

# Step 1: Set the project
echo -e "${YELLOW}Step 1: Setting project...${NC}"
gcloud config set project ${PROJECT_ID}

# Step 2: Re-authenticate
echo -e "${YELLOW}Step 2: Authenticating...${NC}"
echo "Choose authentication method:"
echo "1) Browser login (recommended)"
echo "2) Use existing service account"
read -p "Enter choice (1-2): " AUTH_CHOICE

if [ "$AUTH_CHOICE" = "1" ]; then
    gcloud auth login
    gcloud auth application-default login
fi

# Step 3: Create service account for DIAGNOVERA
echo -e "${YELLOW}Step 3: Creating DIAGNOVERA service account...${NC}"

SERVICE_ACCOUNT_NAME="diagnovera-backend"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Create service account
gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
    --display-name="DIAGNOVERA Backend Service" \
    --project=${PROJECT_ID} 2>/dev/null || echo "Service account may already exist"

# Step 4: Grant necessary roles
echo -e "${YELLOW}Step 4: Granting permissions...${NC}"

ROLES=(
    "roles/editor"  # Full access for development
    "roles/datastore.owner"
    "roles/storage.admin"
    "roles/pubsub.admin"
    "roles/cloudfunctions.admin"
    "roles/run.admin"
)

for ROLE in "${ROLES[@]}"; do
    echo "Granting ${ROLE}..."
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="${ROLE}" \
        --quiet 2>/dev/null || echo "Role may already be granted"
done

# Step 5: Create and download service account key
echo -e "${YELLOW}Step 5: Creating service account key...${NC}"

KEY_FILE="diagnovera-sa-key.json"
gcloud iam service-accounts keys create ${KEY_FILE} \
    --iam-account=${SERVICE_ACCOUNT_EMAIL} \
    --project=${PROJECT_ID}

if [ -f "${KEY_FILE}" ]; then
    echo -e "${GREEN}✓ Service account key created: ${KEY_FILE}${NC}"
    export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/${KEY_FILE}"
else
    echo -e "${RED}✗ Failed to create service account key${NC}"
fi

# Step 6: Enable required APIs
echo -e "${YELLOW}Step 6: Enabling APIs for DIAGNOVERA...${NC}"

APIS=(
    "firestore.googleapis.com"
    "cloudfunctions.googleapis.com"
    "cloudbuild.googleapis.com"
    "pubsub.googleapis.com"
    "run.googleapis.com"
    "storage.googleapis.com"
    "storage-component.googleapis.com"
    "language.googleapis.com"
    "healthcare.googleapis.com"
    "aiplatform.googleapis.com"
)

for API in "${APIS[@]}"; do
    echo -n "Enabling ${API}... "
    gcloud services enable ${API} --project=${PROJECT_ID} 2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}Already enabled${NC}"
done

# Step 7: Create Firestore database
echo -e "${YELLOW}Step 7: Setting up Firestore...${NC}"
gcloud firestore databases create --location=us-central1 --project=${PROJECT_ID} 2>/dev/null || echo "Firestore may already exist"

# Step 8: Create Cloud Storage bucket
echo -e "${YELLOW}Step 8: Creating storage bucket...${NC}"
BUCKET_NAME="${PROJECT_ID}-diagnostic-data"
gsutil mb -p ${PROJECT_ID} -c STANDARD -l us-central1 gs://${BUCKET_NAME} 2>/dev/null || echo "Bucket may already exist"

# Step 9: Create Pub/Sub topics
echo -e "${YELLOW}Step 9: Creating Pub/Sub topics...${NC}"
gcloud pubsub topics create diagnostic-processing --project=${PROJECT_ID} 2>/dev/null || echo "Topic may already exist"
gcloud pubsub topics create library-building --project=${PROJECT_ID} 2>/dev/null || echo "Topic may already exist"

# Step 10: Create environment files
echo -e "${YELLOW}Step 10: Creating environment files...${NC}"

# Main .env
cat > .env << EOF
GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/${KEY_FILE}
GCP_PROJECT_ID=${PROJECT_ID}
EOF

# Backend .env
mkdir -p diagnovera-backend
cat > diagnovera-backend/.env << EOF
GCP_PROJECT_ID=${PROJECT_ID}
GCS_BUCKET_NAME=${BUCKET_NAME}
ENVIRONMENT=development
PORT=8080
GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/${KEY_FILE}
EOF

# Frontend .env.local
mkdir -p diagnovera-frontend
cat > diagnovera-frontend/.env.local << EOF
VITE_API_URL=http://localhost:8080
EOF

# Create run scripts
cat > run_backend.sh << EOF
#!/bin/bash
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/${KEY_FILE}"
export GCP_PROJECT_ID="${PROJECT_ID}"
cd diagnovera-backend
python main.py
EOF
chmod +x run_backend.sh

# Windows batch file
cat > run_backend.bat << EOF
@echo off
set GOOGLE_APPLICATION_CREDENTIALS=%cd%\\${KEY_FILE}
set GCP_PROJECT_ID=${PROJECT_ID}
cd diagnovera-backend
python main.py
EOF

# Test script
cat > test_diagnovera.py << EOF
import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '${KEY_FILE}'
os.environ['GCP_PROJECT_ID'] = '${PROJECT_ID}'

print("Testing DIAGNOVERA connection...")
print(f"Project: ${PROJECT_ID}")
print(f"Credentials: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}")

try:
    from google.cloud import firestore
    db = firestore.Client(project='${PROJECT_ID}')
    
    # Test write
    test_ref = db.collection('_test').document('connection_test')
    test_ref.set({'status': 'connected', 'project': '${PROJECT_ID}'})
    
    # Test read
    doc = test_ref.get()
    if doc.exists:
        print("✓ Successfully connected to Firestore!")
        print(f"✓ Test document: {doc.to_dict()}")
        
        # Cleanup
        test_ref.delete()
        print("✓ Cleanup completed")
    else:
        print("✗ Could not read test document")
        
except Exception as e:
    print(f"✗ Connection failed: {e}")
    print("\nTroubleshooting:")
    print("1. Check if billing is enabled: https://console.cloud.google.com/billing?project=${PROJECT_ID}")
    print("2. Check if Firestore API is enabled: https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${PROJECT_ID}")
    print("3. Check IAM permissions: https://console.cloud.google.com/iam-admin/iam?project=${PROJECT_ID}")
EOF

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DIAGNOVERA Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Key files created:"
echo "  - ${KEY_FILE} (Keep this secure!)"
echo "  - .env (environment variables)"
echo "  - run_backend.sh (Unix/Mac)"
echo "  - run_backend.bat (Windows)"
echo "  - test_diagnovera.py (connection test)"
echo ""
echo "Test your connection:"
echo "  python test_diagnovera.py"
echo ""
echo "Run your backend:"
echo "  ./run_backend.sh (Unix/Mac)"
echo "  run_backend.bat (Windows)"
echo ""
echo "Important links:"
echo "  Console: https://console.cloud.google.com/home/dashboard?project=${PROJECT_ID}"
echo "  Firestore: https://console.cloud.google.com/firestore/data?project=${PROJECT_ID}"
echo "  Storage: https://console.cloud.google.com/storage/browser?project=${PROJECT_ID}"
echo "  APIs: https://console.cloud.google.com/apis/dashboard?project=${PROJECT_ID}"
echo "  Billing: https://console.cloud.google.com/billing?project=${PROJECT_ID}"
echo ""
echo -e "${YELLOW}Note: Add ${KEY_FILE} to your .gitignore!${NC}"
echo "echo '${KEY_FILE}' >> .gitignore"