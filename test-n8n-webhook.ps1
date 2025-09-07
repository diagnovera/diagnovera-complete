# PowerShell script to test n8n webhook
# Save this as test-n8n-webhook.ps1

# Webhook URL
$webhookUrl = "https://n8n.srv934967.hstgr.cloud/webhook/medical-diagnosis"

# Create test payload
$testPayload = @{
    patient_id = "TEST-123"
    timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
    demographics = @{
        mrn = "TEST-123"
        age = "45"
        sex = "Male"
    }
    chief_complaint = "Chest pain"
    symptoms = @("chest pain", "shortness of breath", "diaphoresis")
    text = "Chest pain. Patient reports: chest pain, shortness of breath, diaphoresis"
    vitals = @{
        temperature = "98.6"
        heart_rate = "110"
        blood_pressure = "140/90"
        respiratory_rate = "22"
        oxygen_saturation = "94"
    }
    laboratory = @(
        @{
            name = "Troponin"
            value = "0.02"
            unit = "ng/mL"
        }
    )
    imaging = @()
    medications = @("Aspirin", "Metoprolol")
    allergies = @("Penicillin")
    medical_history = @("Hypertension", "Diabetes Type 2")
    complex_analysis = @{
        total_data_points = 8
        domains = @("symptoms", "vitals", "labs", "medications")
        complex_plane_data = @{
            symptoms = @(
                @{
                    name = "chest pain"
                    real = 0.7
                    imaginary = 0.3
                    magnitude = 0.76
                    angle = 23
                    color = "#e74c3c"
                }
            )
        }
    }
}

# Convert to JSON
$jsonPayload = $testPayload | ConvertTo-Json -Depth 10

# Display what we're sending
Write-Host "Sending to: $webhookUrl" -ForegroundColor Cyan
Write-Host "Payload:" -ForegroundColor Yellow
Write-Host $jsonPayload

Write-Host "`nSending request..." -ForegroundColor Green

try {
    # Send the request
    $response = Invoke-RestMethod -Uri $webhookUrl `
        -Method Post `
        -Headers @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        } `
        -Body $jsonPayload `
        -ErrorAction Stop

    # Display response
    Write-Host "`nResponse received!" -ForegroundColor Green
    Write-Host "Response type: $($response.GetType().Name)" -ForegroundColor Cyan
    
    # Pretty print the response
    if ($response -is [string]) {
        Write-Host "String response:" -ForegroundColor Yellow
        Write-Host $response
    } else {
        Write-Host "JSON response:" -ForegroundColor Yellow
        $response | ConvertTo-Json -Depth 10 | Write-Host
    }

    # Check for specific fields
    if ($response.diagnoses) {
        Write-Host "`nDiagnoses found:" -ForegroundColor Green
        $response.diagnoses | ForEach-Object { Write-Host "  - $_" }
    }

    if ($response.urgency_level) {
        Write-Host "`nUrgency Level: $($response.urgency_level)" -ForegroundColor $(
            switch ($response.urgency_level) {
                "EMERGENT" { "Red" }
                "URGENT" { "Yellow" }
                default { "Green" }
            }
        )
    }

} catch {
    Write-Host "`nError occurred!" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    
    # Try to get the response body
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}

# Alternative simpler version using Invoke-WebRequest for more details
Write-Host "`n`nTrying with Invoke-WebRequest for more details..." -ForegroundColor Cyan

try {
    $webResponse = Invoke-WebRequest -Uri $webhookUrl `
        -Method Post `
        -Headers @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        } `
        -Body $jsonPayload `
        -UseBasicParsing

    Write-Host "Status Code: $($webResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Content Type: $($webResponse.Headers['Content-Type'])" -ForegroundColor Cyan
    Write-Host "Content Length: $($webResponse.RawContentLength) bytes" -ForegroundColor Cyan
    Write-Host "`nRaw Content:" -ForegroundColor Yellow
    Write-Host $webResponse.Content

} catch {
    Write-Host "Web request failed: $_" -ForegroundColor Red
}