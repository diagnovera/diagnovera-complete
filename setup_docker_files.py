#!/usr/bin/env python3
"""
setup_docker_files.py
Creates all missing Docker-related files for DIAGNOVERA
"""

import os
from pathlib import Path


def create_backend_dockerfile():
    """Create Dockerfile for backend"""
    content = """FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    python3-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "main.py"]
"""
    Path('diagnovera-backend').mkdir(exist_ok=True)
    with open('diagnovera-backend/Dockerfile', 'w') as f:
        f.write(content)
    print("✓ Created diagnovera-backend/Dockerfile")


def create_frontend_dockerfile():
    """Create Dockerfile for frontend"""
    content = """FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 5173

# Run development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
"""
    Path('diagnovera-frontend').mkdir(exist_ok=True)
    with open('diagnovera-frontend/Dockerfile', 'w') as f:
        f.write(content)
    print("✓ Created diagnovera-frontend/Dockerfile")


def create_process_a_lite_dockerfile():
    """Create Dockerfile for process-a-lite"""
    content = """FROM python:3.9-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

CMD ["python", "process_a_lite.py"]
"""
    Path('process-a-lite').mkdir(exist_ok=True)
    with open('process-a-lite/Dockerfile', 'w') as f:
        f.write(content)
    print("✓ Created process-a-lite/Dockerfile")


def create_backend_main():
    """Create minimal main.py for backend"""
    content = '''from flask import Flask, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app, origins=['http://localhost:5173', 'http://localhost:3000'])

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'diagnovera-backend',
        'project': os.environ.get('GCP_PROJECT_ID', 'genial-core-467800-k8')
    })

@app.route('/api/diagnose', methods=['POST'])
def diagnose():
    # Placeholder for diagnosis endpoint
    return jsonify({
        'status': 'success',
        'message': 'Diagnosis endpoint placeholder',
        'diagnoses': []
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)
'''
    if not os.path.exists('diagnovera-backend/main.py'):
        with open('diagnovera-backend/main.py', 'w') as f:
            f.write(content)
        print("✓ Created diagnovera-backend/main.py")


def create_backend_requirements():
    """Create requirements.txt for backend"""
    content = """Flask==2.3.2
flask-cors==4.0.0
google-cloud-firestore==2.11.1
google-cloud-storage==2.10.0
google-cloud-pubsub==2.18.0
numpy==1.24.3
pandas==2.0.3
python-dotenv==1.0.0
gunicorn==20.1.0
"""
    with open('diagnovera-backend/requirements.txt', 'w') as f:
        f.write(content)
    print("✓ Created diagnovera-backend/requirements.txt")


def create_process_a_lite_files():
    """Create minimal files for process-a-lite"""
    # requirements.txt
    requirements = """google-cloud-firestore==2.11.1
google-cloud-pubsub==2.18.0
pandas==2.0.3
numpy==1.24.3
"""
    with open('process-a-lite/requirements.txt', 'w') as f:
        f.write(requirements)
    print("✓ Created process-a-lite/requirements.txt")

    # process_a_lite.py
    if not os.path.exists('process-a-lite/process_a_lite.py'):
        code = '''import os
import time

print("Process A Lite service started...")
print(f"Project ID: {os.environ.get('GCP_PROJECT_ID', 'not set')}")

# Keep service running
while True:
    time.sleep(60)
    print("Process A Lite: Still running...")
'''
        with open('process-a-lite/process_a_lite.py', 'w') as f:
            f.write(code)
        print("✓ Created process-a-lite/process_a_lite.py")


def create_docker_compose():
    """Create updated docker-compose.yml"""
    content = """services:
  backend:
    build: ./diagnovera-backend
    ports:
      - "8080:8080"
    environment:
      - GCP_PROJECT_ID=genial-core-467800-k8
      - GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
      - FIRESTORE_EMULATOR_HOST=firestore-emulator:8787
    volumes:
      - ./diagnovera-sa-key.json:/app/service-account.json:ro
      - ./resources:/app/resources:ro
    depends_on:
      - firestore-emulator

  frontend:
    build: ./diagnovera-frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8080
    depends_on:
      - backend

  process-a-lite:
    build: ./process-a-lite
    environment:
      - GCP_PROJECT_ID=genial-core-467800-k8
      - BACKEND_URL=http://backend:8080
    depends_on:
      - backend

  firestore-emulator:
    image: google/cloud-sdk:latest
    command: gcloud emulators firestore start --host-port=0.0.0.0:8787
    ports:
      - "8787:8787"
    environment:
      - CLOUDSDK_CORE_PROJECT=genial-core-467800-k8
"""
    with open('docker-compose.yml', 'w') as f:
        f.write(content)
    print("✓ Created docker-compose.yml")


def main():
    print("Setting up Docker files for DIAGNOVERA...")
    print("=" * 50)

    # Create all Dockerfiles
    create_backend_dockerfile()
    create_frontend_dockerfile()
    create_process_a_lite_dockerfile()

    # Create missing application files
    create_backend_main()
    create_backend_requirements()
    create_process_a_lite_files()

    # Create docker-compose.yml
    create_docker_compose()

    print("\n" + "=" * 50)
    print("✓ All Docker files created!")
    print("\nNext steps:")
    print("1. Make sure you have diagnovera-sa-key.json in the root directory")
    print("2. Run: docker-compose build")
    print("3. Run: docker-compose up")


if __name__ == "__main__":
    main()