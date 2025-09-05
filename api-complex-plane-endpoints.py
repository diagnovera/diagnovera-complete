"""
API endpoints for serving complex plane visualization data
Extends the main Flask API with visualization-specific endpoints
"""

from flask import Blueprint, jsonify, request
import numpy as np
from typing import Dict, List, Any
import json

# Create blueprint for visualization endpoints
visualization_bp = Blueprint('visualization', __name__)

@visualization_bp.route('/api/visualization/disease/<icd10_code>', methods=['GET'])
def get_disease_visualization(icd10_code):
    """Get complex plane data for a specific disease"""
    try:
        # Get disease from Firestore
        disease_ref = db.collection('icd10_diseases').document(icd10_code)
        disease_doc = disease_ref.get()
        
        if not disease_doc.exists:
            return jsonify({"error": "Disease not found"}), 404
        
        disease_data = disease_doc.to_dict()
        
        # Transform complex plane data for visualization
        visualization_data = {
            "icd10_code": icd10_code,
            "description": disease_data.get("description", ""),
            "confidence_score": disease_data.get("confidence_score", 0),
            "sources": disease_data.get("sources", [])[:10],
            "complex_plane_data": {},
            "profile_data": disease_data.get("profile_data", {})
        }
        
        # Process each domain
        for domain_name, variables in disease_data.get("domains", {}).items():
            domain_data = []
            
            for var in variables:
                # Convert to visualization format
                viz_var = {
                    "variable": var.get("name", ""),
                    "angle": var.get("angle", 0),
                    "magnitude": float(var.get("value", 0)),
                    "matched": True,  # For reference library, all are matched
                    "confidence": var.get("confidence", 1.0)
                }
                
                # Add additional data based on domain
                if domain_name == "vitals" and "range" in var:
                    viz_var["value"] = var.get("value")
                    viz_var["reference"] = f"{var['range'].get('min', 'N/A')}-{var['range'].get('max', 'N/A')}"
                elif domain_name == "laboratory" and "data" in var:
                    viz_var["data"] = var.get("data", {})
                
                domain_data.append(viz_var)
            
            visualization_data["complex_plane_data"][domain_name] = domain_data
        
        return jsonify(visualization_data)
        
    except Exception as e:
        logger.error(f"Error getting disease visualization: {str(e)}")
        return jsonify({"error": "Failed to retrieve visualization data"}), 500

@visualization_bp.route('/api/visualization/compare', methods=['POST'])
def compare_patient_disease():
    """Compare patient data with disease profile in complex plane"""
    try:
        data = request.get_json()
        encounter_id = data.get("encounter_id")
        icd10_code = data.get("icd10_code")
        
        if not encounter_id or not icd10_code:
            return jsonify({"error": "encounter_id and icd10_code required"}), 400
        
        # Get patient encounter
        encounter_ref = db.collection('encounters').document(encounter_id)
        encounter_doc = encounter_ref.get()
        
        if not encounter_doc.exists:
            return jsonify({"error": "Encounter not found"}), 404
        
        # Get disease profile
        disease_ref = db.collection('icd10_diseases').document(icd10_code)
        disease_doc = disease_ref.get()
        
        if not disease_doc.exists:
            return jsonify({"error": "Disease not found"}), 404
        
        encounter_data = encounter_doc.to_dict()
        disease_data = disease_doc.to_dict()
        
        # Process patient encounter to complex plane
        patient_complex = process_patient_to_complex_plane(encounter_data)
        
        # Compare with disease profile
        comparison_result = {
            "encounter_id": encounter_id,
            "icd10_code": icd10_code,
            "disease_description": disease_data.get("description", ""),
            "comparison_data": {}
        }
        
        # Compare each domain
        for domain_name in ["subjective", "vitals", "laboratory", "imaging"]:
            patient_vars = patient_complex.get(domain_name, [])
            disease_vars = disease_data.get("domains", {}).get(domain_name, [])
            
            domain_comparison = compare_domain_variables(patient_vars, disease_vars)
            comparison_result["comparison_data"][domain_name] = domain_comparison
        
        # Calculate overall similarity scores
        comparison_result["similarity_scores"] = {
            "overall": calculate_overall_similarity(comparison_result["comparison_data"]),
            "kuramoto_sync": calculate_kuramoto_synchronization(patient_complex, disease_data),
            "bayesian_match": calculate_bayesian_match(patient_complex, disease_data)
        }
        
        return jsonify(comparison_result)
        
    except Exception as e:
        logger.error(f"Error comparing patient and disease: {str(e)}")
        return jsonify({"error": "Comparison failed"}), 500

@visualization_bp.route('/api/visualization/library/summary', methods=['GET'])
def get_library_summary():
    """Get summary statistics of the disease library"""
    try:
        # Query statistics from Firestore
        diseases = db.collection('icd10_diseases').stream()
        
        summary = {
            "total_diseases": 0,
            "categories": {},
            "confidence_distribution": {
                "high": 0,    # > 0.8
                "medium": 0,  # 0.5 - 0.8
                "low": 0      # < 0.5
            },
            "domain_coverage": {
                "subjective": 0,
                "vitals": 0,
                "laboratory": 0,
                "imaging": 0,
                "examination": 0,
                "procedures": 0
            },
            "average_variables_per_disease": 0,
            "last_updated": None
        }
        
        total_variables = 0
        
        for disease_doc in diseases:
            disease = disease_doc.to_dict()
            summary["total_diseases"] += 1
            
            # Category count
            category = disease.get("category", "Unknown")
            summary["categories"][category] = summary["categories"].get(category, 0) + 1
            
            # Confidence distribution
            confidence = disease.get("confidence_score", 0)
            if confidence > 0.8:
                summary["confidence_distribution"]["high"] += 1
            elif confidence > 0.5:
                summary["confidence_distribution"]["medium"] += 1
            else:
                summary["confidence_distribution"]["low"] += 1
            
            # Domain coverage
            domains = disease.get("domains", {})
            for domain in domains:
                if domain in summary["domain_coverage"] and len(domains[domain]) > 0:
                    summary["domain_coverage"][domain] += 1
                total_variables += len(domains[domain])
            
            # Track last update
            processed_at = disease.get("processed_at")
            if processed_at and (not summary["last_updated"] or processed_at > summary["last_updated"]):
                summary["last_updated"] = processed_at
        
        # Calculate average
        if summary["total_diseases"] > 0:
            summary["average_variables_per_disease"] = total_variables / summary["total_diseases"]
        
        return jsonify(summary)
        
    except Exception as e:
        logger.error(f"Error getting library summary: {str(e)}")
        return jsonify({"error": "Failed to get summary"}), 500

@visualization_bp.route('/api/visualization/export/<icd10_code>', methods=['GET'])
def export_disease_visualization(icd10_code):
    """Export disease visualization data in various formats"""
    try:
        format_type = request.args.get('format', 'json').lower()
        
        # Get disease data
        disease_ref = db.collection('icd10_diseases').document(icd10_code)
        disease_doc = disease_ref.get()
        
        if not disease_doc.exists:
            return jsonify({"error": "Disease not found"}), 404
        
        disease_data = disease_doc.to_dict()
        
        if format_type == 'json':
            return jsonify(disease_data)
            
        elif format_type == 'csv':
            # Convert complex plane data to CSV
            csv_data = convert_complex_to_csv(disease_data)
            return csv_data, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename={icd10_code}_complex_plane.csv'
            }
            
        elif format_type == 'matlab':
            # Export as MATLAB-compatible format
            matlab_data = convert_to_matlab_format(disease_data)
            return matlab_data, 200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': f'attachment; filename={icd10_code}_complex_plane.mat'
            }
            
        else:
            return jsonify({"error": "Unsupported format"}), 400
            
    except Exception as e:
        logger.error(f"Error exporting visualization: {str(e)}")
        return jsonify({"error": "Export failed"}), 500

# Helper functions
def process_patient_to_complex_plane(encounter_data: Dict) -> Dict[str, List[Dict]]:
    """Convert patient encounter data to complex plane representation"""
    complex_data = {}
    
    # Process subjective domain
    subjective_data = encounter_data.get("data", {}).get("subjective", {})
    if subjective_data:
        # Use NLP to extract features
        features = []
        
        # Process chief complaint and HPI
        text_fields = [
            subjective_data.get("chief_complaint", ""),
            subjective_data.get("hpi", ""),
            subjective_data.get("pmh", "")
        ]
        
        for text in text_fields:
            if text:
                # Extract medical concepts (simplified)
                concepts = extract_medical_concepts_simple(text)
                features.extend(concepts)
        
        complex_data["subjective"] = assign_angles_to_features(features)
    
    # Process vitals
    vitals_data = encounter_data.get("data", {}).get("vitals", {})
    if vitals_data:
        vitals_complex = []
        
        # Fixed angles for vitals
        vital_angles = {
            "temperature": 0,
            "heart_rate": 60,
            "bp_systolic": 120,
            "bp_diastolic": 180,
            "oxygen_saturation": 240,
            "respiratory_rate": 300
        }
        
        for vital, angle in vital_angles.items():
            if vital in vitals_data and vitals_data[vital]:
                vitals_complex.append({
                    "name": vital,
                    "angle": angle,
                    "value": float(vitals_data[vital])
                })
        
        complex_data["vitals"] = vitals_complex
    
    # Process other domains similarly
    # ... (laboratory, imaging, etc.)
    
    return complex_data

def compare_domain_variables(patient_vars: List[Dict], disease_vars: List[Dict]) -> List[Dict]:
    """Compare patient and disease variables in a domain"""
    comparison = []
    
    # Create lookup for disease variables
    disease_lookup = {var["name"]: var for var in disease_vars}
    
    # Check patient variables against disease
    for patient_var in patient_vars:
        var_name = patient_var["name"]
        
        if var_name in disease_lookup:
            disease_var = disease_lookup[var_name]
            
            # Calculate match score
            if "value" in patient_var and "range" in disease_var:
                # Numerical comparison
                in_range = (
                    patient_var["value"] >= disease_var["range"].get("min", float('-inf')) and
                    patient_var["value"] <= disease_var["range"].get("max", float('inf'))
                )
                match_score = 1.0 if in_range else 0.0
            else:
                # Binary comparison
                match_score = 1.0 if patient_var.get("value", 0) > 0 else 0.0
            
            comparison.append({
                "variable": var_name,
                "patient_angle": patient_var["angle"],
                "disease_angle": disease_var["angle"],
                "patient_magnitude": patient_var.get("value", 0),
                "disease_magnitude": disease_var.get("value", 0),
                "matched": match_score > 0.5,
                "match_score": match_score
            })
    
    return comparison

def calculate_overall_similarity(comparison_data: Dict[str, List[Dict]]) -> float:
    """Calculate overall similarity score between patient and disease"""
    total_matches = 0
    total_variables = 0
    
    for domain, comparisons in comparison_data.items():
        for comp in comparisons:
            total_variables += 1
            if comp["matched"]:
                total_matches += 1
    
    return total_matches / total_variables if total_variables > 0 else 0.0

def calculate_kuramoto_synchronization(patient_data: Dict, disease_data: Dict) -> float:
    """Calculate Kuramoto synchronization between patient and disease patterns"""
    # Extract all angles from both patterns
    patient_angles = []
    disease_angles = []
    
    for domain in patient_data:
        for var in patient_data[domain]:
            patient_angles.append(np.deg2rad(var["angle"]))
    
    for domain in disease_data.get("domains", {}):
        for var in disease_data["domains"][domain]:
            disease_angles.append(np.deg2rad(var["angle"]))
    
    if not patient_angles or not disease_angles:
        return 0.0
    
    # Calculate phase difference
    # For simplicity, compare average phase coherence
    patient_mean_phase = np.mean(np.exp(1j * np.array(patient_angles)))
    disease_mean_phase = np.mean(np.exp(1j * np.array(disease_angles)))
    
    # Kuramoto order parameter
    synchronization = np.abs(patient_mean_phase * np.conj(disease_mean_phase))
    
    return float(synchronization)

def extract_medical_concepts_simple(text: str) -> List[Dict]:
    """Simple extraction of medical concepts from text"""
    # In production, use full NLP pipeline
    # This is a simplified version
    concepts = []
    
    # Common symptom keywords
    symptom_keywords = {
        "pain": ["pain", "ache", "hurt"],
        "dyspnea": ["shortness of breath", "dyspnea", "breathing difficulty"],
        "fever": ["fever", "temperature", "pyrexia"],
        "cough": ["cough", "coughing"],
        "nausea": ["nausea", "nauseous"],
        "fatigue": ["fatigue", "tired", "weakness"]
    }
    
    text_lower = text.lower()
    
    for concept, keywords in symptom_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            concepts.append({
                "name": concept,
                "value": 1
            })
    
    return concepts

def assign_angles_to_features(features: List[Dict]) -> List[Dict]:
    """Assign angles to features for complex plane representation"""
    angle_increment = 360 / max(len(features), 1)
    
    for i, feature in enumerate(features):
        feature["angle"] = i * angle_increment
    
    return features

def convert_complex_to_csv(disease_data: Dict) -> str:
    """Convert complex plane data to CSV format"""
    import csv
    import io
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Domain", "Variable", "Angle (degrees)", "Magnitude", 
        "Confidence", "Additional Data"
    ])
    
    # Data rows
    for domain, variables in disease_data.get("domains", {}).items():
        for var in variables:
            writer.writerow([
                domain,
                var.get("name", ""),
                var.get("angle", 0),
                var.get("value", 0),
                var.get("confidence", 1.0),
                json.dumps(var.get("data", {})) if "data" in var else ""
            ])
    
    return output.getvalue()

def convert_to_matlab_format(disease_data: Dict) -> bytes:
    """Convert to MATLAB-compatible format"""
    # In production, use scipy.io.savemat
    # This is a simplified JSON representation
    matlab_struct = {
        "icd10_code": disease_data.get("icd10_code", ""),
        "description": disease_data.get("description", ""),
        "domains": {}
    }
    
    for domain, variables in disease_data.get("domains", {}).items():
        angles = [var["angle"] for var in variables]
        magnitudes = [var.get("value", 0) for var in variables]
        names = [var["name"] for var in variables]
        
        matlab_struct["domains"][domain] = {
            "angles": angles,
            "magnitudes": magnitudes,
            "names": names
        }
    
    return json.dumps(matlab_struct, indent=2).encode()

# Register blueprint with main app
# In main app file: app.register_blueprint(visualization_bp)