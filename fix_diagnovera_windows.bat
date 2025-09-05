@echo off
REM fix_diagnovera_windows.bat
REM Fix setup for DIAGNOVERA on Windows

echo ======================================
echo   DIAGNOVERA Windows Setup Fix
echo ======================================
echo.

REM Step 1: Install required packages
echo Step 1: Installing Google Cloud packages...
python -m pip install --upgrade pip
python -m pip install google-cloud-firestore google-cloud-storage google-cloud-pubsub pandas numpy flask flask-cors

REM Step 2: Create test script
echo Step 2: Creating test script...
echo import os > test_connection.py
echo os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'diagnovera-sa-key.json' >> test_connection.py
echo os.environ['GCP_PROJECT_ID'] = 'genial-core-467800-k8' >> test_connection.py
echo. >> test_connection.py
echo print("Testing DIAGNOVERA connection...") >> test_connection.py
echo. >> test_connection.py
echo try: >> test_connection.py
echo     from google.cloud import firestore >> test_connection.py
echo     print("✓ google-cloud-firestore imported successfully") >> test_connection.py
echo     db = firestore.Client(project='genial-core-467800-k8') >> test_connection.py
echo     print("✓ Connected to DIAGNOVERA Firestore!") >> test_connection.py
echo     print(f"Project: {db.project}") >> test_connection.py
echo except ImportError as e: >> test_connection.py
echo     print(f"✗ Import error: {e}") >> test_connection.py
echo     print("Run: python -m pip install google-cloud-firestore") >> test_connection.py
echo except Exception as e: >> test_connection.py
echo     print(f"✗ Connection error: {e}") >> test_connection.py

echo.
echo Test script created: test_connection.py
echo.

REM Step 3: Create environment setup
echo Step 3: Creating environment setup...
echo @echo off > setup_env.bat
echo echo Setting DIAGNOVERA environment variables... >> setup_env.bat
echo set GOOGLE_APPLICATION_CREDENTIALS=%cd%\diagnovera-sa-key.json >> setup_env.bat
echo set GCP_PROJECT_ID=genial-core-467800-k8 >> setup_env.bat
echo set GCS_BUCKET_NAME=genial-core-467800-k8-diagnostic-data >> setup_env.bat
echo echo Environment variables set! >> setup_env.bat

echo.
echo Environment setup created: setup_env.bat
echo.

REM Step 4: Check for service account key
echo Step 4: Checking for service account key...
if exist diagnovera-sa-key.json (
    echo ✓ Found service account key
) else (
    echo ✗ Service account key not found!
    echo.
    echo Please create a service account key:
    echo 1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=genial-core-467800-k8
    echo 2. Create or select a service account
    echo 3. Create a JSON key
    echo 4. Save it as: diagnovera-sa-key.json
    echo.
)

echo.
echo ======================================
echo   Setup Complete!
echo ======================================
echo.
echo Next steps:
echo 1. Run: setup_env.bat
echo 2. Test: python test_connection.py
echo.
pause