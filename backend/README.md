
# Diagnovera Backend (Cloud Run-ready)

Minimal FastAPI backend with Docker, suitable for Google Cloud Run.

## Endpoints
- `GET /ping` → `{"status":"ok"}`
- `GET /healthz` → health check
- `GET /version` → returns APP_VERSION
- `POST /classify` → dummy classifier: `{ "text": "..." }`

## Local run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

## Build & Deploy (Cloud Run)
```bash
PROJECT_ID=icd10-diagnosis-system-2024
REGION=us-central1
REPO=diagnovera
IMAGE=diagnovera-api
TAG=$(date +%Y%m%d-%H%M%S)
URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$IMAGE:$TAG"

gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="Diagnovera containers" || true
gcloud auth configure-docker "$REGION-docker.pkg.dev" -q

docker build -t "$URI" .
docker push "$URI"

gcloud run deploy diagnovera-api --image "$URI" --region "$REGION" --platform managed --allow-unauthenticated       --set-env-vars "CORS_ALLOWLIST=https://your-app.vercel.app,http://localhost:5173"       --set-env-vars "APP_VERSION=$TAG"
```

## Notes
- Tighten CORS in production (replace `*` with your exact frontend domains).
- Add real logic to `/classify` and expand dependencies in `requirements.txt` as needed.
