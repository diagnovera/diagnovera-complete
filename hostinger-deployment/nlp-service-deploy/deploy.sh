#!/bin/bash
# Deploy NLP service on Hostinger

# Build Docker image
docker build -t nlp-service:latest .

# Stop existing container if running
docker stop nlp-service 2>/dev/null || true
docker rm nlp-service 2>/dev/null || true

# Run new container
docker run -d \
  --name nlp-service \
  --restart always \
  -p 5000:5000 \
  nlp-service:latest

echo "NLP service deployed successfully!"