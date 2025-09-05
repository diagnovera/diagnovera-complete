import requests
import json
import time

# Test health endpoint
response = requests.get('http://localhost:8080/api/health')
print(f"Health check: {response.json()}")

# Test diagnosis
test_encounter = {
    "encounter_id": "TEST-001",
    "subjective": {
        "age": 55,
        "sex": "M",
        "chief_complaint": "chest pain and shortness of breath",
        "hpi": "Sudden onset chest pain, radiating to left arm",
        "pmh": "Hypertension, Type 2 Diabetes",
        "medications": "Metformin 500mg, Lisinopril 10mg",
        "allergies": "Penicillin"
    },
    "vitals": {
        "temperature": 37.2,
        "heart_rate": 110,
        "bp_systolic": 160,
        "bp_diastolic": 95,
        "oxygen_saturation": 94,
        "respiratory_rate": 22
    },
    "examination": "Patient appears distressed, diaphoretic",
    "laboratory": "Troponin I: 2.5 ng/mL (elevated)",
    "imaging": "ECG shows ST elevation in V2-V4"
}

response = requests.post(
    'http://localhost:8080/api/diagnose',
    json=test_encounter
)

print(f"Diagnosis result: {json.dumps(response.json(), indent=2)}")