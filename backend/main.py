from flask import Flask, jsonify
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
