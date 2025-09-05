# main.py - Fixed version

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
from datetime import datetime

app = Flask(__name__)

# CORS configuration - FIXED: Added missing comma
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://*.vercel.app",
            "https://your-frontend-domain.com"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

# Store latest analysis - ONLY DECLARED ONCE
latest_analysis = None
connected_clients = 0


@app.route('/')
def index():
    """Root endpoint with API information"""
    return jsonify({
        'status': 'ok',
        'message': 'DiagnoVera Backend API',
        'version': '1.0.0',
        'endpoints': {
            'health': '/health',
            'latest_analysis': '/api/nlp/latest',
            'n8n_webhook': '/webhook/n8n-result',
            'analyze': '/api/analyze'
        },
        'connected_clients': connected_clients
    })


@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'connected_clients': connected_clients
    })


@app.route('/api/nlp/latest')
def get_latest_analysis():
    """Get the latest analysis results"""
    if latest_analysis:
        return jsonify(latest_analysis)
    else:
        return jsonify({
            'message': 'No analysis available yet',
            'status': 'empty'
        })


@app.route('/webhook/n8n-result', methods=['POST'])
def n8n_webhook():
    """Receive results from n8n webhook"""
    global latest_analysis

    try:
        data = request.get_json()
        print(f"Received n8n webhook: {data}")

        latest_analysis = {
            **data,
            'receivedAt': datetime.utcnow().isoformat()
        }

        # Emit to all connected WebSocket clients
        socketio.emit('n8n_update', latest_analysis)

        return jsonify({
            'success': True,
            'message': 'Analysis received and broadcasted',
            'connected_clients': connected_clients
        })
    except Exception as e:
        print(f"Error processing n8n webhook: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Mock analysis endpoint for testing"""
    try:
        data = request.get_json()
        print(f"Received analysis request: {data}")

        # Mock analysis response
        mock_analysis = {
            'diagnoses': [
                'Acute Myocardial Infarction',
                'Unstable Angina',
                'Heart Failure'
            ],
            'recommendations': [
                'Order ECG stat',
                'Serial troponin levels',
                'Chest X-ray',
                'Consider cardiology consultation'
            ],
            'labs_to_order': [
                'Troponin I',
                'BNP',
                'Complete Blood Count',
                'Basic Metabolic Panel',
                'PT/INR'
            ],
            'confidence': 0.85,
            'summary': 'Patient presents with symptoms consistent with acute coronary syndrome. High risk features present.',
            'timestamp': datetime.utcnow().isoformat()
        }

        global latest_analysis
        latest_analysis = mock_analysis

        # Emit to WebSocket clients
        socketio.emit('n8n_update', mock_analysis)

        return jsonify({
            'success': True,
            'analysis': mock_analysis
        })
    except Exception as e:
        print(f"Error in analysis: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    global connected_clients
    connected_clients += 1
    print(f'Client connected. Total clients: {connected_clients}')
    emit('connected', {
        'message': 'Connected to DiagnoVera backend',
        'clientId': request.sid
    })


@socketio.on('disconnect')
def handle_disconnect():
    global connected_clients
    connected_clients -= 1
    print(f'Client disconnected. Total clients: {connected_clients}')


@socketio.on('request_analysis')
def handle_request_analysis():
    if latest_analysis:
        emit('n8n_update', latest_analysis)


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'message': f'The endpoint {request.method} {request.url} does not exist',
        'status': 'error'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'message': str(error),
        'status': 'error'
    }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)