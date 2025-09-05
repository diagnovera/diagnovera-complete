@echo off
set GOOGLE_APPLICATION_CREDENTIALS=%cd%\diagnovera-sa-key.json
set GCP_PROJECT_ID=genial-core-467800-k8
cd diagnovera-backend
python main.py
