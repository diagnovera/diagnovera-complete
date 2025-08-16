# medical_diagnostic_system/main.py
"""
Main Flask application for Medical Diagnostic System
Handles both Process A (Reference Library) and Process B (Patient Encounters)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import firestore, storage, pubsub_v1
from google.cloud import aiplatform
import numpy as np
import pandas as pd
from datetime import datetime
import json
import logging
from typing import Dict, List, Tuple, Optional
import os

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=['https://*.vercel.app', 'http://localhost:3000'])

# Initialize Google Cloud clients
db = firestore.Client()
storage_client = storage.Client()
publisher = pubsub_v1.PublisherClient()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
PROJECT_ID = os.environ.get('GCP_PROJECT_ID', 'your-project-id')
BUCKET_NAME = os.environ.get('GCS_BUCKET_NAME', 'medical-diagnostic-data')
PUBSUB_TOPIC = f'projects/{PROJECT_ID}/topics/diagnostic-processing'

# Domain configuration
DOMAINS = {
    'subjective': {
        'type': 'text',
        'nlp_required': True,
        'sub_domains': ['demographics', 'chief_complaint', 'hpi', 'pmh', 'medications', 'allergies']
    },
    'vitals': {
        'type': 'numerical',
        'nlp_required': False,
        'variables': ['temperature', 'heart_rate', 'bp_systolic', 'bp_diastolic', 'oxygen_saturation', 'respiratory_rate']
    },
    'examination': {
        'type': 'text',
        'nlp_required': True
    },
    'laboratory': {
        'type': 'mixed',
        'nlp_required': True
    },
    'imaging': {
        'type': 'text',
        'nlp_required': True
    },
    'procedures': {
        'type': 'text',
        'nlp_required': True
    }
}

class ComplexPlaneMapper:
    """Maps clinical variables to complex plane representation"""
    
    def __init__(self):
        self.angle_mapping = {}
        self._initialize_angle_mappings()
    
    def _initialize_angle_mappings(self):
        """Initialize angle mappings for each domain"""
        # This would be loaded from a configuration file in production
        angle_step = 360 / 20  # Assuming max 20 variables per domain
        
        # Example mappings
        self.angle_mapping['vitals'] = {
            'temperature': 0,
            'heart_rate': 60,
            'bp_systolic': 120,
            'bp_diastolic': 180,
            'oxygen_saturation': 240,
            'respiratory_rate': 300
        }
    
    def map_to_complex_plane(self, domain: str, variables: Dict) -> List[Dict]:
        """Convert domain variables to complex plane representation"""
        complex_data = []
        
        for var_name, value in variables.items():
            if var_name in self.angle_mapping.get(domain, {}):
                angle = self.angle_mapping[domain][var_name]
                
                # Calculate magnitude based on value type
                if isinstance(value, (int, float)):
                    # Normalize numerical values
                    magnitude = self._normalize_value(domain, var_name, value)
                else:
                    # Binary presence/absence for text
                    magnitude = 1.0 if value else 0.0
                
                complex_data.append({
                    'variable': var_name,
                    'angle': angle,
                    'magnitude': magnitude,
                    'value': value,
                    'timestamp': datetime.utcnow().isoformat()
                })
        
        return complex_data
    
    def _normalize_value(self, domain: str, variable: str, value: float) -> float:
        """Normalize numerical values to 0-1 range"""
        # In production, these ranges would come from the reference library
        normalization_ranges = {
            'vitals': {
                'temperature': (35.0, 42.0),
                'heart_rate': (40, 200),
                'bp_systolic': (70, 200),
                'bp_diastolic': (40, 130),
                'oxygen_saturation': (70, 100),
                'respiratory_rate': (8, 40)
            }
        }
        
        if domain in normalization_ranges and variable in normalization_ranges[domain]:
            min_val, max_val = normalization_ranges[domain][variable]
            normalized = (value - min_val) / (max_val - min_val)
            return max(0.0, min(1.0, normalized))  # Clamp to [0, 1]
        
        return 0.5  # Default if no range specified

class DiagnosticEngine:
    """Main diagnostic engine implementing Bayesian, Kuramoto, and Markov analysis"""
    
    def __init__(self, complex_mapper: ComplexPlaneMapper):
        self.complex_mapper = complex_mapper
        self.reference_library = None
        self._load_reference_library()
    
    def _load_reference_library(self):
        """Load ICD10 reference library from Firestore"""
        try:
            # Load pre-computed reference library
            ref_collection = db.collection('icd10_reference_library')
            self.reference_library = {}
            
            docs = ref_collection.stream()
            for doc in docs:
                self.reference_library[doc.id] = doc.to_dict()
            
            logger.info(f"Loaded {len(self.reference_library)} disease profiles")
        except Exception as e:
            logger.error(f"Error loading reference library: {e}")
            self.reference_library = {}
    
    def analyze_patient_encounter(self, encounter_data: Dict) -> Dict:
        """Main analysis function for patient encounters"""
        # Convert patient data to complex plane representation
        patient_complex_data = {}
        
        for domain, data in encounter_data.items():
            if domain in DOMAINS:
                patient_complex_data[domain] = self.complex_mapper.map_to_complex_plane(
                    domain, data
                )
        
        # Compare with reference library
        diagnosis_scores = []
        
        for icd_code, reference_profile in self.reference_library.items():
            scores = {
                'icd10_code': icd_code,
                'description': reference_profile.get('description', ''),
                'bayesian': self._calculate_bayesian_probability(
                    patient_complex_data, reference_profile
                ),
                'kuramoto': self._calculate_kuramoto_synchronization(
                    patient_complex_data, reference_profile
                ),
                'markov': self._calculate_markov_probability(
                    patient_complex_data, reference_profile
                )
            }
            
            # Combined score
            scores['combined'] = (
                scores['bayesian'] * 0.4 +
                scores['kuramoto'] * 0.3 +
                scores['markov'] * 0.3
            )
            
            diagnosis_scores.append(scores)
        
        # Sort by combined score
        diagnosis_scores.sort(key=lambda x: x['combined'], reverse=True)
        
        return {
            'diagnoses': diagnosis_scores[:10],  # Top 10 diagnoses
            'patient_complex_data': patient_complex_data,
            'analysis_timestamp': datetime.utcnow().isoformat()
        }
    
    def _calculate_bayesian_probability(self, patient_data: Dict, reference: Dict) -> float:
        """Calculate Bayesian probability for diagnosis"""
        # Simplified Bayesian calculation
        # In production, this would use proper prior probabilities and likelihood functions
        
        total_score = 0.0
        total_weight = 0.0
        
        for domain, patient_vars in patient_data.items():
            if domain in reference.get('complex_plane_data', {}):
                reference_vars = reference['complex_plane_data'][domain]
                
                for patient_var in patient_vars:
                    for ref_var in reference_vars:
                        if patient_var['variable'] == ref_var['variable']:
                            # Calculate similarity
                            angle_diff = abs(patient_var['angle'] - ref_var['angle'])
                            magnitude_diff = abs(patient_var['magnitude'] - ref_var.get('magnitude', 0))
                            
                            similarity = 1.0 - (angle_diff / 360.0 + magnitude_diff) / 2.0
                            weight = ref_var.get('weight', 1.0)
                            
                            total_score += similarity * weight
                            total_weight += weight
        
        return total_score / total_weight if total_weight > 0 else 0.0
    
    def _calculate_kuramoto_synchronization(self, patient_data: Dict, reference: Dict) -> float:
        """Calculate Kuramoto coupling/synchronization index"""
        # Simplified Kuramoto model
        # Measures phase synchronization between patient and reference patterns
        
        phase_differences = []
        
        for domain in patient_data:
            if domain in reference.get('complex_plane_data', {}):
                patient_phases = [np.radians(var['angle']) for var in patient_data[domain]]
                ref_phases = [np.radians(var['angle']) for var in reference['complex_plane_data'][domain]]
                
                if patient_phases and ref_phases:
                    # Calculate order parameter (synchronization measure)
                    min_len = min(len(patient_phases), len(ref_phases))
                    phase_diff = np.mean([
                        np.cos(patient_phases[i] - ref_phases[i])
                        for i in range(min_len)
                    ])
                    phase_differences.append(phase_diff)
        
        return np.mean(phase_differences) if phase_differences else 0.0
    
    def _calculate_markov_probability(self, patient_data: Dict, reference: Dict) -> float:
        """Calculate Markov chain probability"""
        # Simplified Markov chain analysis
        # In production, this would use transition probabilities between symptoms
        
        transition_score = 0.0
        domain_sequence = ['subjective', 'vitals', 'examination', 'laboratory', 'imaging']
        
        for i in range(len(domain_sequence) - 1):
            current_domain = domain_sequence[i]
            next_domain = domain_sequence[i + 1]
            
            if (current_domain in patient_data and 
                next_domain in patient_data and
                current_domain in reference.get('complex_plane_data', {}) and
                next_domain in reference.get('complex_plane_data', {})):
                
                # Calculate transition probability based on pattern matching
                current_match = self._domain_match_score(
                    patient_data[current_domain],
                    reference['complex_plane_data'][current_domain]
                )
                next_match = self._domain_match_score(
                    patient_data[next_domain],
                    reference['complex_plane_data'][next_domain]
                )
                
                transition_score += current_match * next_match
        
        return transition_score / (len(domain_sequence) - 1)
    
    def _domain_match_score(self, patient_domain: List, reference_domain: List) -> float:
        """Calculate match score between patient and reference domain data"""
        if not patient_domain or not reference_domain:
            return 0.0
        
        matches = 0
        total = len(patient_domain)
        
        for patient_var in patient_domain:
            for ref_var in reference_domain:
                if patient_var['variable'] == ref_var['variable']:
                    if patient_var['magnitude'] > 0.5 and ref_var.get('magnitude', 0) > 0.5:
                        matches += 1
                    break
        
        return matches / total if total > 0 else 0.0

# Initialize components
complex_mapper = ComplexPlaneMapper()
diagnostic_engine = DiagnosticEngine(complex_mapper)

# API Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'medical-diagnostic-system'
    })

@app.route('/api/diagnose', methods=['POST'])
def diagnose():
    """Main diagnostic endpoint"""
    try:
        encounter_data = request.json
        
        # Validate input
        if not encounter_data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Store encounter in Firestore
        encounter_id = encounter_data.get('encounter_id', f"ENC-{datetime.utcnow().timestamp()}")
        db.collection('patient_encounters').document(encounter_id).set({
            'data': encounter_data,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'status': 'processing'
        })
        
        # Perform diagnosis
        results = diagnostic_engine.analyze_patient_encounter(encounter_data)
        
        # Store results
        db.collection('diagnosis_results').document(encounter_id).set({
            'encounter_id': encounter_id,
            'results': results,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'status': 'completed'
        })
        
        # Publish to Pub/Sub for async processing if needed
        publisher.publish(
            PUBSUB_TOPIC,
            json.dumps({'encounter_id': encounter_id}).encode('utf-8')
        )
        
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Error in diagnosis: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reference-library', methods=['GET'])
def get_reference_library():
    """Get disease reference library"""
    try:
        # Optional filtering
        category = request.args.get('category')
        search = request.args.get('search')
        limit = int(request.args.get('limit', 100))
        
        query = db.collection('icd10_reference_library')
        
        if category:
            query = query.where('category', '==', category)
        
        if search:
            # Note: Firestore has limited text search capabilities
            # In production, consider using Elasticsearch or similar
            query = query.where('description', '>=', search).where('description', '<=', search + '\uf8ff')
        
        query = query.limit(limit)
        
        diseases = []
        for doc in query.stream():
            disease_data = doc.to_dict()
            disease_data['icd10_code'] = doc.id
            diseases.append(disease_data)
        
        return jsonify({
            'diseases': diseases,
            'count': len(diseases)
        })
        
    except Exception as e:
        logger.error(f"Error fetching reference library: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/build-reference-library', methods=['POST'])
def build_reference_library():
    """Endpoint to trigger reference library building from medical literature"""
    try:
        # This would trigger the AI agent to search medical literature
        # For now, we'll create a task
        task_id = f"BUILD-{datetime.utcnow().timestamp()}"
        
        db.collection('library_build_tasks').document(task_id).set({
            'task_id': task_id,
            'status': 'pending',
            'created_at': firestore.SERVER_TIMESTAMP,
            'config': request.json
        })
        
        # Publish to Pub/Sub for async processing
        publisher.publish(
            f'projects/{PROJECT_ID}/topics/library-building',
            json.dumps({'task_id': task_id}).encode('utf-8')
        )
        
        return jsonify({
            'task_id': task_id,
            'status': 'queued',
            'message': 'Reference library building task queued'
        })
        
    except Exception as e:
        logger.error(f"Error initiating library build: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # For local development only
    app.run(debug=True, port=8080)