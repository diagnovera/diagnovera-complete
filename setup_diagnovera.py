#!/usr/bin/env python3
"""
setup_diagnovera.py

Complete setup script for DIAGNOVERA project
Project ID: genial-core-467800-k8
"""

import os
import sys
import json
import subprocess
import time
from pathlib import Path

# DIAGNOVERA Project Configuration
PROJECT_ID = "genial-core-467800-k8"
PROJECT_NAME = "DIAGNOVERA"
PROJECT_NUMBER = "924070815611"
BUCKET_NAME = f"{PROJECT_ID}-diagnostic-data"
REGION = "us-central1"

class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header():
    """Print DIAGNOVERA header"""
    print(f"\n{Colors.BLUE}{'='*50}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}  DIAGNOVERA Medical Diagnostic System Setup{Colors.ENDC}")
    print(f"{Colors.BLUE}{'='*50}{Colors.ENDC}")
    print(f"\nProject: {Colors.GREEN}{PROJECT_NAME}{Colors.ENDC}")
    print(f"ID: {Colors.GREEN}{PROJECT_ID}{Colors.ENDC}")
    print(f"Number: {Colors.GREEN}{PROJECT_NUMBER}{Colors.ENDC}\n")

def check_prerequisites():
    """Check if required tools are installed"""
    print(f"{Colors.YELLOW}Checking prerequisites...{Colors.ENDC}")
    
    # Check Python packages
    required_packages = ['google-cloud-firestore', 'google-cloud-storage', 'pandas', 'numpy']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"{Colors.YELLOW}Installing required packages...{Colors.ENDC}")
        subprocess.run([sys.executable, '-m', 'pip', 'install'] + missing_packages)
    
    print(f"{Colors.GREEN}✓ Prerequisites checked{Colors.ENDC}")

def create_service_account_key():
    """Create or find service account key"""
    print(f"\n{Colors.YELLOW}Setting up authentication...{Colors.ENDC}")
    
    # Look for existing keys
    possible_keys = [
        'diagnovera-sa-key.json',
        'diagnovera-key.json',
        'service-account.json',
        f'{PROJECT_ID}-key.json'
    ]
    
    for key_file in possible_keys:
        if os.path.exists(key_file):
            print(f"{Colors.GREEN}✓ Found existing key: {key_file}{Colors.ENDC}")
            return os.path.abspath(key_file)
    
    # Create new key
    print(f"\n{Colors.YELLOW}No service account key found.{Colors.ENDC}")
    print("\nTo create a service account key:")
    print(f"\n1. Go to: {Colors.BLUE}https://console.cloud.google.com/iam-admin/serviceaccounts?project={PROJECT_ID}{Colors.ENDC}")
    print("2. Click 'CREATE SERVICE ACCOUNT' (or select existing)")
    print("3. Name: 'diagnovera-backend'")
    print("4. Grant role: 'Basic > Editor'")
    print("5. Click 'Done'")
    print("6. Click on the service account")
    print("7. Go to 'KEYS' tab")
    print("8. Add Key > Create new key > JSON")
    print("9. Save as 'diagnovera-sa-key.json' in this directory")
    
    input(f"\n{Colors.BOLD}Press Enter when you've saved the key file...{Colors.ENDC}")
    
    if os.path.exists('diagnovera-sa-key.json'):
        print(f"{Colors.GREEN}✓ Key file found!{Colors.ENDC}")
        return os.path.abspath('diagnovera-sa-key.json')
    else:
        print(f"{Colors.RED}✗ Key file not found{Colors.ENDC}")
        return None

def create_env_files(key_path):
    """Create environment files"""
    print(f"\n{Colors.YELLOW}Creating environment files...{Colors.ENDC}")
    
    # Root .env
    with open('.env', 'w') as f:
        f.write(f"GOOGLE_APPLICATION_CREDENTIALS={key_path}\n")
        f.write(f"GCP_PROJECT_ID={PROJECT_ID}\n")
    
    # Backend .env
    os.makedirs('diagnovera-backend', exist_ok=True)
    with open('diagnovera-backend/.env', 'w') as f:
        f.write(f"GCP_PROJECT_ID={PROJECT_ID}\n")
        f.write(f"GCS_BUCKET_NAME={BUCKET_NAME}\n")
        f.write("ENVIRONMENT=development\n")
        f.write("PORT=8080\n")
        f.write(f"GOOGLE_APPLICATION_CREDENTIALS={key_path}\n")
    
    # Frontend .env.local
    os.makedirs('diagnovera-frontend', exist_ok=True)
    with open('diagnovera-frontend/.env.local', 'w') as f:
        f.write("VITE_API_URL=http://localhost:8080\n")
    
    print(f"{Colors.GREEN}✓ Environment files created{Colors.ENDC}")

def test_connection(key_path):
    """Test Google Cloud connection"""
    print(f"\n{Colors.YELLOW}Testing connection to Google Cloud...{Colors.ENDC}")
    
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = key_path
    os.environ['GCP_PROJECT_ID'] = PROJECT_ID
    
    try:
        from google.cloud import firestore
        
        # Initialize Firestore
        db = firestore.Client(project=PROJECT_ID)
        
        # Test write
        test_doc = db.collection('_test').document('setup_test')
        test_doc.set({
            'message': 'DIAGNOVERA connection test',
            'timestamp': firestore.SERVER_TIMESTAMP,
            'project': PROJECT_ID
        })
        
        # Test read
        doc = test_doc.get()
        if doc.exists:
            print(f"{Colors.GREEN}✓ Successfully connected to Firestore!{Colors.ENDC}")
            # Cleanup
            test_doc.delete()
            return True
        
    except Exception as e:
        print(f"{Colors.RED}✗ Connection failed: {e}{Colors.ENDC}")
        print(f"\n{Colors.YELLOW}Troubleshooting:{Colors.ENDC}")
        print(f"1. Enable Firestore API: https://console.cloud.google.com/apis/library/firestore.googleapis.com?project={PROJECT_ID}")
        print(f"2. Check billing: https://console.cloud.google.com/billing?project={PROJECT_ID}")
        print(f"3. Verify IAM permissions: https://console.cloud.google.com/iam-admin/iam?project={PROJECT_ID}")
        return False

def create_helper_scripts(key_path):
    """Create helper scripts"""
    print(f"\n{Colors.YELLOW}Creating helper scripts...{Colors.ENDC}")
    
    # run_backend.sh (Unix/Mac)
    with open('run_backend.sh', 'w') as f:
        f.write(f"""#!/bin/bash
echo "Starting DIAGNOVERA Backend..."
export GOOGLE_APPLICATION_CREDENTIALS="{key_path}"
export GCP_PROJECT_ID="{PROJECT_ID}"
export GCS_BUCKET_NAME="{BUCKET_NAME}"

cd diagnovera-backend
python main.py
""")
    os.chmod('run_backend.sh', 0o755)
    
    # run_backend.bat (Windows)
    with open('run_backend.bat', 'w') as f:
        f.write(f"""@echo off
echo Starting DIAGNOVERA Backend...
set GOOGLE_APPLICATION_CREDENTIALS={key_path}
set GCP_PROJECT_ID={PROJECT_ID}
set GCS_BUCKET_NAME={BUCKET_NAME}

cd diagnovera-backend
python main.py
""")
    
    # upload_icd10.sh
    with open('upload_icd10.sh', 'w') as f:
        f.write(f"""#!/bin/bash
echo "Uploading ICD10 data to DIAGNOVERA..."
export GOOGLE_APPLICATION_CREDENTIALS="{key_path}"
export GCP_PROJECT_ID="{PROJECT_ID}"

python diagnovera-backend/upload_icd10.py \\
    --project-id {PROJECT_ID} \\
    --excel-file resources/ICD10_2026.xlsx \\
    --batch-size 500
""")
    os.chmod('upload_icd10.sh', 0o755)
    
    # Quick test script
    with open('test_diagnovera.py', 'w') as f:
        f.write(f"""import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '{key_path}'
os.environ['GCP_PROJECT_ID'] = '{PROJECT_ID}'

print("Testing DIAGNOVERA connection...")

try:
    from google.cloud import firestore
    db = firestore.Client(project='{PROJECT_ID}')
    
    # Quick test
    test_ref = db.collection('_test').document('quick_test')
    test_ref.set({{'test': True, 'project': '{PROJECT_ID}'}})
    doc = test_ref.get()
    
    if doc.exists:
        print("✓ Connected to DIAGNOVERA Firestore!")
        test_ref.delete()
    
    # Check if ICD10 library exists
    icd_count = len(list(db.collection('icd10_reference_library').limit(1).stream()))
    if icd_count > 0:
        print("✓ ICD10 reference library found!")
    else:
        print("! ICD10 library not yet uploaded. Run: ./upload_icd10.sh")
        
except Exception as e:
    print(f"✗ Error: {{e}}")
    print(f"\\nCheck: https://console.cloud.google.com/firestore/data?project={PROJECT_ID}")
""")
    
    print(f"{Colors.GREEN}✓ Helper scripts created{Colors.ENDC}")

def enable_apis():
    """Guide to enable APIs"""
    print(f"\n{Colors.YELLOW}Enabling APIs...{Colors.ENDC}")
    print("\nPlease enable these APIs in the Google Cloud Console:")
    
    apis = [
        ("Firestore", f"https://console.cloud.google.com/apis/library/firestore.googleapis.com?project={PROJECT_ID}"),
        ("Cloud Functions", f"https://console.cloud.google.com/apis/library/cloudfunctions.googleapis.com?project={PROJECT_ID}"),
        ("Cloud Storage", f"https://console.cloud.google.com/apis/library/storage.googleapis.com?project={PROJECT_ID}"),
        ("Pub/Sub", f"https://console.cloud.google.com/apis/library/pubsub.googleapis.com?project={PROJECT_ID}"),
        ("Cloud Run", f"https://console.cloud.google.com/apis/library/run.googleapis.com?project={PROJECT_ID}"),
        ("Natural Language", f"https://console.cloud.google.com/apis/library/language.googleapis.com?project={PROJECT_ID}")
    ]
    
    for api_name, url in apis:
        print(f"\n{api_name}: {Colors.BLUE}{url}{Colors.ENDC}")
    
    input(f"\n{Colors.BOLD}Press Enter when you've enabled all APIs...{Colors.ENDC}")

def main():
    """Main setup process"""
    print_header()
    
    # Check prerequisites
    check_prerequisites()
    
    # Set up authentication
    key_path = create_service_account_key()
    if not key_path:
        print(f"{Colors.RED}Setup cannot continue without service account key{Colors.ENDC}")
        return
    
    # Create environment files
    create_env_files(key_path)
    
    # Test connection
    connection_ok = test_connection(key_path)
    
    if not connection_ok:
        print(f"\n{Colors.YELLOW}Would you like to enable APIs manually? (yes/no): {Colors.ENDC}", end='')
        if input().lower() == 'yes':
            enable_apis()
            # Test again
            test_connection(key_path)
    
    # Create helper scripts
    create_helper_scripts(key_path)
    
    # Summary
    print(f"\n{Colors.GREEN}{'='*50}{Colors.ENDC}")
    print(f"{Colors.GREEN}{Colors.BOLD}  DIAGNOVERA Setup Complete!{Colors.ENDC}")
    print(f"{Colors.GREEN}{'='*50}{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}Quick Start:{Colors.ENDC}")
    print("1. Test connection: python test_diagnovera.py")
    print("2. Run backend: ./run_backend.sh (or run_backend.bat on Windows)")
    print("3. Upload ICD10: ./upload_icd10.sh")
    
    print(f"\n{Colors.BOLD}Important Links:{Colors.ENDC}")
    print(f"Console: https://console.cloud.google.com/home/dashboard?project={PROJECT_ID}")
    print(f"Firestore: https://console.cloud.google.com/firestore/data?project={PROJECT_ID}")
    print(f"Storage: https://console.cloud.google.com/storage/browser?project={PROJECT_ID}")
    
    print(f"\n{Colors.YELLOW}Remember to add your key file to .gitignore!{Colors.ENDC}")
    print(f"echo '{os.path.basename(key_path)}' >> .gitignore")

if __name__ == "__main__":
    main()