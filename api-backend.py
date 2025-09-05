"""
Flask API Backend for Medical Diagnostic System
Handles patient data processing and diagnosis generation
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from datetime import datetime
import logging
from typing import Dict, List, Any
import json

# Google Cloud imports
from google.cloud import firestore
from google.cloud import storage
from google.cloud import pubsub_v1
from google.cloud import tasks_v2
from google.cloud import aiplatform
import google.auth

# Import diagnostic engine modules
from diagnostic_engine import (
    DiagnosticEngine, 
    PatientEncounter,
    SubjectiveDomainProcessor,
    VitalsDomainProcessor,
    BayesianAnalyzer,
    KuramotoAnalyzer
)

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["https://your-app.vercel.app", "http://localhost:3000"])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Google Cloud clients
db = firestore.Client()
storage_client = storage.Client()
publisher = pubsub_v1.PublisherClient()
tasks_client = tasks_v2.CloudTasksClient()

# Get project info
_, project_id = google.auth.default()
topic_path = publisher.topic_path(project_id, 'diagnosis-requests')

# Initialize diagnostic engine
diagnostic_engine = DiagnosticEngine("Section111ValidICD10Jan2022.xlsx")

# API Routes
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    })

@app.route('/api/diagnose', methods=['POST'])
def diagnose():
    """Main diagnosis endpoint"""
    try:
        # Validate request
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Log request
        encounter_id = data.get('encounter_id', f"ENC-{datetime.utcnow().timestamp()}")
        logger.info(f"Processing diagnosis request for encounter: {encounter_id}")
        
        # Store raw data in Firestore
        encounter_ref = db.collection('encounters').document(encounter_id)
        encounter_ref.set({
            'data': data,
            'status': 'processing',
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Process synchronously for immediate results
        # For heavy workloads, this would be async via Pub/Sub
        results = process_diagnosis(data, encounter_id)
        
        # Update Firestore with results
        encounter_ref.update({
            'status': 'completed',
            'results': results,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Error processing diagnosis: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/diagnose/async', methods=['POST'])
def diagnose_async():
    """Asynchronous diagnosis endpoint for heavy processing"""
    try:
        data = request.get_json()
        encounter_id = data.get('encounter_id', f"ENC-{datetime.utcnow().timestamp()}")
        
        # Store in Firestore
        encounter_ref = db.collection('encounters').document(encounter_id)
        encounter_ref.set({
            'data': data,
            'status': 'queued',
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        # Publish to Pub/Sub for async processing
        message_data = json.dumps({
            'encounter_id': encounter_id,
            'data': data
        }).encode('utf-8')
        
        future = publisher.publish(topic_path, message_data)
        future.result()  # Wait for publish confirmation
        
        return jsonify({
            "encounter_id": encounter_id,
            "status": "queued",
            "message": "Diagnosis processing started"
        }), 202
        
    except Exception as e:
        logger.error(f"Error queuing diagnosis: {str(e)}")
        return jsonify({"error": "Failed to queue diagnosis"}), 500

@app.route('/api/encounters/<encounter_id>', methods=['GET'])
def get_encounter(encounter_id):
    """Get encounter details and results"""
    try:
        encounter_ref = db.collection('encounters').document(encounter_id)
        encounter = encounter_ref.get()
        
        if not encounter.exists:
            return jsonify({"error": "Encounter not found"}), 404
        
        return jsonify(encounter.to_dict())
        
    except Exception as e:
        logger.error(f"Error retrieving encounter: {str(e)}")
        return jsonify({"error": "Failed to retrieve encounter"}), 500

@app.route('/api/library/search', methods=['GET'])
def search_icd10():
    """Search ICD10 disease library"""
    try:
        query = request.args.get('q', '').lower()
        limit = int(request.args.get('limit', 10))
        
        if not query:
            return jsonify({"error": "Query parameter required"}), 400
        
        # Search in Firestore ICD10 collection
        diseases = []
        icd10_ref = db.collection('icd10_diseases')
        
        # Simple text search (in production, use full-text search)
        docs = icd10_ref.limit(1000).stream()
        
        for doc in docs:
            data = doc.to_dict()
            if query in data.get('description', '').lower() or query in doc.id.lower():
                diseases.append({
                    'icd10_code': doc.id,
                    'description': data.get('description', ''),
                    'domains': data.get('domains', {})
                })
                if len(diseases) >= limit:
                    break
        
        return jsonify({"results": diseases, "count": len(diseases)})
        
    except Exception as e:
        logger.error(f"Error searching ICD10: {str(e)}")
        return jsonify({"error": "Search failed"}), 500

@app.route('/api/library/build', methods=['POST'])
def build_library():
    """Trigger AI-powered library building (Process A)"""
    try:
        # This would typically require admin authentication
        data = request.get_json()
        diseases = data.get('diseases', [])
        
        if not diseases:
            return jsonify({"error": "No diseases specified"}), 400
        
        # Create Cloud Tasks for each disease
        queue_path = tasks_client.queue_path(
            project_id, 'us-central1', 'literature-scraping-queue'
        )
        
        tasks_created = []
        for disease in diseases:
            task = {
                'http_request': {
                    'http_method': tasks_v2.HttpMethod.POST,
                    'url': f'https://{request.host}/api/library/build-disease',
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({
                        'icd10_code': disease['code'],
                        'description': disease['description']
                    }).encode()
                }
            }
            
            response = tasks_client.create_task(
                parent=queue_path,
                task=task
            )
            tasks_created.append(response.name)
        
        return jsonify({
            "message": f"Created {len(tasks_created)} tasks",
            "tasks": tasks_created
        })
        
    except Exception as e:
        logger.error(f"Error building library: {str(e)}")
        return jsonify({"error": "Failed to start library building"}), 500

@app.route('/api/library/build-disease', methods=['POST'])
def build_disease_reference():
    """Build reference data for a single disease using AI"""
    try:
        data = request.get_json()
        icd10_code = data.get('icd10_code')
        description = data.get('description')
        
        # This would use AI to search medical literature
        # For now, placeholder implementation
        logger.info(f"Building reference for {icd10_code}: {description}")
        
        # In production, this would:
        # 1. Use LLM to search medical databases
        # 2. Extract relevant clinical features
        # 3. Assign complex plane representations
        # 4. Store in Firestore
        
        disease_ref = db.collection('icd10_diseases').document(icd10_code)
        disease_ref.set({
            'description': description,
            'domains': {
                'subjective': {},  # Would be populated by AI
                'vitals': {},      # Would be populated by AI
                'examination': {}, # Would be populated by AI
                'laboratory': {},  # Would be populated by AI
                'imaging': {},     # Would be populated by AI
                'procedures': {}   # Would be populated by AI
            },
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'status': 'ai_processing'
        })
        
        return jsonify({"message": "Disease reference creation started"})
        
    except Exception as e:
        logger.error(f"Error building disease reference: {str(e)}")
        return jsonify({"error": "Failed to build disease reference"}), 500

# Core processing function
def process_diagnosis(data: Dict[str, Any], encounter_id: str) -> Dict[str, Any]:
    """Process patient data and generate diagnosis"""
    try:
        # Convert raw data to PatientEncounter
        encounter = diagnostic_engine.process_patient_encounter(data)
        
        # Run diagnosis
        diagnosis_results = diagnostic_engine.diagnose(encounter)
        
        # Format results
        formatted_results = {
            "encounter_id": encounter_id,
            "timestamp": datetime.utcnow().isoformat(),
            "diagnoses": []
        }
        
        for icd_code, probability, scores in diagnosis_results:
            # Get disease description from Firestore
            disease_doc = db.collection('icd10_diseases').document(icd_code).get()
            description = disease_doc.to_dict().get('description', 'Unknown') if disease_doc.exists else 'Unknown'
            
            formatted_results["diagnoses"].append({
                "icd10_code": icd_code,
                "description": description,
                "probability": float(probability),
                "scores": {
                    "bayesian": float(scores.get("bayesian", 0)),
                    "kuramoto": float(scores.get("kuramoto", 0)),
                    "combined": float(scores.get("combined", 0))
                }
            })
        
        # Store analysis metadata
        formatted_results["metadata"] = {
            "domains_processed": list(data.keys()),
            "analysis_methods": ["bayesian", "kuramoto", "markov"],
            "confidence_level": calculate_confidence(diagnosis_results)
        }
        
        return formatted_results
        
    except Exception as e:
        logger.error(f"Error in diagnosis processing: {str(e)}")
        raise

def calculate_confidence(results: List) -> str:
    """Calculate overall confidence level"""
    if not results:
        return "low"
    
    top_probability = results[0][1] if results else 0
    
    if top_probability > 0.8:
        return "high"
    elif top_probability > 0.5:
        return "medium"
    else:
        return "low"

# Analytics endpoints
@app.route('/api/analytics/summary', methods=['GET'])
def get_analytics_summary():
    """Get diagnostic system analytics"""
    try:
        # Query BigQuery for analytics
        from google.cloud import bigquery
        client = bigquery.Client()
        
        # Get diagnosis statistics
        query = """
        SELECT 
            COUNT(DISTINCT encounter_id) as total_encounters,
            COUNT(DISTINCT patient_id) as unique_patients,
            AVG(ARRAY_LENGTH(diagnoses)) as avg_diagnoses_per_encounter,
            APPROX_TOP_COUNT(diagnoses[OFFSET(0)].icd10_code, 10) as top_diagnoses
        FROM `medical_analytics.diagnosis_results`
        WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        """
        
        query_job = client.query(query)
        results = list(query_job.result())
        
        if results:
            row = results[0]
            return jsonify({
                "total_encounters": row.total_encounters,
                "unique_patients": row.unique_patients,
                "avg_diagnoses_per_encounter": float(row.avg_diagnoses_per_encounter),
                "top_diagnoses": [
                    {"code": item.value, "count": item.count} 
                    for item in row.top_diagnoses
                ]
            })
        else:
            return jsonify({"message": "No analytics data available"})
            
    except Exception as e:
        logger.error(f"Error fetching analytics: {str(e)}")
        return jsonify({"error": "Failed to fetch analytics"}), 500

@app.route('/api/export/<encounter_id>', methods=['GET'])
def export_encounter(encounter_id):
    """Export encounter data in various formats"""
    try:
        format_type = request.args.get('format', 'json').lower()
        
        # Get encounter data
        encounter_ref = db.collection('encounters').document(encounter_id)
        encounter = encounter_ref.get()
        
        if not encounter.exists:
            return jsonify({"error": "Encounter not found"}), 404
        
        data = encounter.to_dict()
        
        if format_type == 'json':
            return jsonify(data)
        elif format_type == 'pdf':
            # Generate PDF report
            pdf_content = generate_pdf_report(data)
            return send_file(
                io.BytesIO(pdf_content),
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'encounter_{encounter_id}.pdf'
            )
        elif format_type == 'hl7':
            # Generate HL7 message
            hl7_message = generate_hl7_message(data)
            return hl7_message, 200, {'Content-Type': 'text/plain'}
        else:
            return jsonify({"error": "Unsupported format"}), 400
            
    except Exception as e:
        logger.error(f"Error exporting encounter: {str(e)}")
        return jsonify({"error": "Export failed"}), 500

# WebSocket support for real-time updates (using Socket.IO)
from flask_socketio import SocketIO, emit, join_room, leave_room

socketio = SocketIO(app, cors_allowed_origins="*")

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to diagnostic system'})

@socketio.on('subscribe_encounter')
def handle_subscribe(data):
    encounter_id = data.get('encounter_id')
    if encounter_id:
        join_room(encounter_id)
        emit('subscribed', {'encounter_id': encounter_id})

@socketio.on('unsubscribe_encounter')
def handle_unsubscribe(data):
    encounter_id = data.get('encounter_id')
    if encounter_id:
        leave_room(encounter_id)
        emit('unsubscribed', {'encounter_id': encounter_id})

# Pub/Sub message handler for async processing
def process_pubsub_message(message):
    """Process diagnosis requests from Pub/Sub"""
    try:
        # Decode message
        message_data = json.loads(message.data.decode('utf-8'))
        encounter_id = message_data['encounter_id']
        patient_data = message_data['data']
        
        logger.info(f"Processing async diagnosis for: {encounter_id}")
        
        # Update status
        encounter_ref = db.collection('encounters').document(encounter_id)
        encounter_ref.update({'status': 'processing'})
        
        # Send real-time update
        socketio.emit('status_update', {
            'encounter_id': encounter_id,
            'status': 'processing'
        }, room=encounter_id)
        
        # Process diagnosis
        results = process_diagnosis(patient_data, encounter_id)
        
        # Update with results
        encounter_ref.update({
            'status': 'completed',
            'results': results,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        # Send real-time completion update
        socketio.emit('diagnosis_complete', {
            'encounter_id': encounter_id,
            'results': results
        }, room=encounter_id)
        
        # Acknowledge message
        message.ack()
        
    except Exception as e:
        logger.error(f"Error processing Pub/Sub message: {str(e)}")
        message.nack()

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

# Main entry point
if __name__ == '__main__':
    # For local development
    app.run(debug=True, host='0.0.0.0', port=8080)
else:
    # For production with gunicorn
    pass