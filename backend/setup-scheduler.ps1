# setup-scheduler.ps1
Write-Host "Setting up Cloud Scheduler for DIAGNOVERA Process A..." -ForegroundColor Green

# Get the Cloud Run service URL
$SERVICE_URL = gcloud run services describe diagnovera-process-a `
    --region us-central1 `
    --format "value(status.url)"

if ([string]::IsNullOrEmpty($SERVICE_URL)) {
    Write-Host "Error: Could not retrieve service URL. Make sure the service is deployed." -ForegroundColor Red
    exit 1
}

Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Yellow

# Create Cloud Scheduler job
Write-Host "Creating Cloud Scheduler job..." -ForegroundColor Green

gcloud scheduler jobs create http diagnovera-daily-run `
    --location us-central1 `
    --schedule "0 2 * * *" `
    --uri "$SERVICE_URL/api/process-a/run" `
    --http-method POST `
    --oidc-service-account-email diagnovera-process-a@genial-core-467800-k8.iam.gserviceaccount.com `
    --time-zone "America/Los_Angeles"

Write-Host "Cloud Scheduler job created successfully!" -ForegroundColor Green

# Test the service
Write-Host "`nTesting service health endpoint..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$SERVICE_URL/health" -UseBasicParsing
    Write-Host "Health check response: " -NoNewline
    Write-Host $response.Content -ForegroundColor Green
} catch {
    Write-Host "Health check failed: $_" -ForegroundColor Red
}

https://accounts.google.com/o/oauth2/auth?client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&scope=email%20openid%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloudplatformprojects.readonly%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Ffirebase%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloud-platform&response_type=code&state=158888830&redirect_uri=http%3A%2F%2Flocalhost%3A9005