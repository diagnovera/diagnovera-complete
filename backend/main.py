from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import logging
from datetime import datetime
import json
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configure CORS - add your production URLs
CORS(app, origins=[
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    'https://your-app.vercel.app',  # Add your Vercel URL
    'https://*.vercel.app',  # Allow all Vercel preview deployments
    'https://n8n.srv934967.hstgr.cloud'  # Allow n8n webhook
])

# Initialize SocketIO with CORS support
socketio = SocketIO(app, cors_allowed_origins="*")

# Store for webhook data (in production, use Redis or a database)
webhook_data_store = {}


class NLPProcessor:
    """Process NLP data from n8n webhook"""
    
    @staticmethod
    def parse_medical_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse medical data from webhook payload"""
        parsed_data = {
            "timestamp": datetime.now().isoformat(),
            "patient_id": data.get("patient_id", "unknown"),
            "symptoms": [],
            "vitals": {},
            "nlp_entities": [],
            "raw_text": data.get("text", ""),
            "confidence_scores": {}
        }
        
        # Extract symptoms from NLP results
        if "nlp_results" in data:
            nlp = data["nlp_results"]
            if "entities" in nlp:
                parsed_data["nlp_entities"] = nlp["entities"]
                # Extract medical entities
                for entity in nlp["entities"]:
                    if entity.get("type") == "symptom":
                        parsed_data["symptoms"].append({
                            "name": entity.get("value"),
                            "confidence": entity.get("confidence", 0.0)
                        })
            
            # Extract confidence scores
            if "confidence" in nlp:
                parsed_data["confidence_scores"] = nlp["confidence"]
        
        # Extract vitals if present
        if "vitals" in data:
            parsed_data["vitals"] = data["vitals"]
        
        return parsed_data
    
    @staticmethod
    def prepare_bayesian_input(parsed_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare data for Bayesian module processing"""
        bayesian_input = {
            "observations": [],
            "prior_probabilities": {},
            "timestamp": parsed_data["timestamp"]
        }
        
        # Convert symptoms to observations
        for symptom in parsed_data["symptoms"]:
            bayesian_input["observations"].append({
                "feature": symptom["name"],
                "value": True,
                "confidence": symptom["confidence"]
            })
        
        # Add vitals as observations
        for vital, value in parsed_data["vitals"].items():
            bayesian_input["observations"].append({
                "feature": f"vital_{vital}",
                "value": value,
                "confidence": 1.0  # Assume vitals are accurate
            })
        
        return bayesian_input


# ==================== EXISTING ENDPOINTS ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'diagnovera-backend',
        'project': os.environ.get('GCP_PROJECT_ID', 'genial-core-467800-k8'),
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0',
        'websocket_enabled': True  # Added to indicate WebSocket support
    })


@app.route('/api/diagnose', methods=['POST'])
def diagnose():
    """Main diagnosis endpoint"""
    try:
        # Get request data
        data = request.get_json()

        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No data provided'
            }), 400

        # Log the request
        logger.info(f"Diagnosis request received: {data.get('encounter_id', 'unknown')}")

        # TODO: Implement actual diagnosis logic
        # For now, return a placeholder response
        return jsonify({
            'status': 'success',
            'message': 'Diagnosis processed',
            'encounter_id': data.get('encounter_id', f'ENC-{int(datetime.utcnow().timestamp())}'),
            'diagnoses': [
                {
                    'icd10_code': 'R07.9',
                    'description': 'Chest pain, unspecified',
                    'probability': 0.75,
                    'rank': 1
                }
            ],
            'timestamp': datetime.utcnow().isoformat()
        })

    except Exception as e:
        logger.error(f"Error in diagnose endpoint: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500


@app.route('/api/reference-library', methods=['GET'])
def get_reference_library():
    """Get ICD-10 reference library"""
    try:
        # TODO: Implement Firestore query
        return jsonify({
            'status': 'success',
            'count': 0,
            'diseases': []
        })
    except Exception as e:
        logger.error(f"Error in reference library: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve reference library'
        }), 500


@app.route('/api/patient-encounters', methods=['GET'])
def get_patient_encounters():
    """Get patient encounters"""
    try:
        # TODO: Implement Firestore query
        return jsonify({
            'status': 'success',
            'count': 0,
            'encounters': []
        })
    except Exception as e:
        logger.error(f"Error retrieving encounters: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve encounters'
        }), 500


# ==================== NEW N8N WEBHOOK ENDPOINTS ====================

@app.route('/webhook/n8n', methods=['POST'])
def n8n_webhook():
    """Handle incoming n8n webhook"""
    try:
        # Get webhook data
        webhook_data = request.get_json()
        logger.info(f"Received n8n webhook: {json.dumps(webhook_data, indent=2)}")
        
        # Process NLP data
        nlp_processor = NLPProcessor()
        parsed_data = nlp_processor.parse_medical_data(webhook_data)
        
        # Prepare for Bayesian module
        bayesian_input = nlp_processor.prepare_bayesian_input(parsed_data)
        
        # Store data with unique ID
        webhook_id = f"webhook_{datetime.now().timestamp()}"
        webhook_data_store[webhook_id] = {
            "original": webhook_data,
            "parsed": parsed_data,
            "bayesian_input": bayesian_input,
            "ai_response": webhook_data.get("ai_response", {})
        }
        
        # Emit to connected frontend clients via WebSocket
        socketio.emit('n8n_update', {
            'webhook_id': webhook_id,
            'parsed_data': parsed_data,
            'bayesian_input': bayesian_input,
            'ai_response': webhook_data.get("ai_response", {})
        })
        
        return jsonify({
            "status": "success",
            "webhook_id": webhook_id,
            "message": "Webhook processed successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/webhook-data/<webhook_id>', methods=['GET'])
def get_webhook_data(webhook_id):
    """Get processed webhook data by ID"""
    if webhook_id in webhook_data_store:
        return jsonify(webhook_data_store[webhook_id]), 200
    return jsonify({"error": "Webhook data not found"}), 404


@app.route('/api/nlp/latest', methods=['GET'])
def get_latest_nlp():
    """Get the latest NLP processed data"""
    if webhook_data_store:
        latest_id = max(webhook_data_store.keys())
        return jsonify({
            "webhook_id": latest_id,
            "data": webhook_data_store[latest_id]["parsed"]
        }), 200
    return jsonify({"error": "No data available"}), 404


# ==================== WEBSOCKET EVENT HANDLERS ====================

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected")
    emit('connected', {'data': 'Connected to DiagnoVera backend'})


@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected")


# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {str(error)}")
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500


if __name__ == '__main__':
    # Get port from environment variable (Cloud Run sets this)
    port = int(os.environ.get('PORT', 8080))

    # In production, debug should be False
    debug_mode = os.environ.get('ENVIRONMENT', 'development') == 'development'

    # Run the app with SocketIO
    logger.info(f"Diagnovera backend starting on port {port} with WebSocket support")
    
    # Use socketio.run instead of app.run for WebSocket support
    socketio.run(app, host='0.0.0.0', port=port, debug=debug_mode)