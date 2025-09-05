#!/bin/bash
export GOOGLE_APPLICATION_CREDENTIALS="/c/diagnovera/diagnovera-sa-key.json"
export GCP_PROJECT_ID="genial-core-467800-k8"
cd diagnovera-backend
python main.py
