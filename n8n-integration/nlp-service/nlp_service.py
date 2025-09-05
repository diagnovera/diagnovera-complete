"""
Simplified Medical NLP Service for n8n Integration
Lighter version without heavy ML dependencies for easier deployment
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import json
from typing import Dict, List, Any, Tuple
from datetime import datetime

app = Flask(__name__)
CORS(app)


class SimpleMedicalNLPExtractor:
    """Simplified medical entity extractor using regex patterns"""

    def __init__(self):
        # Common medical patterns
        self.symptom_patterns = {
            'pain': r'\b(pain|ache|sore|hurt|discomfort|burning|stabbing|sharp|dull)\b',
            'respiratory': r'\b(cough|wheeze|shortness of breath|dyspnea|breathing difficulty|breathless)\b',
            'cardiac': r'\b(chest pain|palpitation|irregular heartbeat|tachycardia|bradycardia)\b',
            'gastrointestinal': r'\b(nausea|vomiting|diarrhea|constipation|abdominal pain|bloating)\b',
            'neurological': r'\b(headache|dizziness|vertigo|confusion|seizure|numbness|tingling)\b',
            'general': r'\b(fever|fatigue|weakness|malaise|chills|sweating|weight loss)\b'
        }

        self.critical_indicators = [
            'severe', 'acute', 'sudden onset', 'crushing', 'radiating',
            '10/10', 'worst ever', 'thunderclap', 'emergency', 'critical'
        ]

        self.negation_terms = [
            'no', 'not', 'denies', 'negative', 'without', 'absent',
            'none', 'neither', 'nor', 'never'
        ]

        # Common medications
        self.medication_patterns = [
            r'\b\w+azole\b', r'\b\w+cillin\b', r'\b\w+mycin\b',
            r'\b\w+pril\b', r'\b\w+olol\b', r'\b\w+statin\b',
            r'\baspirine?\b', r'\bibuprofen\b', r'\bacetaminophen\b',
            r'\bmetformin\b', r'\binsulin\b', r'\bwarfarin\b'
        ]

        # Lab value patterns
        self.lab_pattern = r'(\w+(?:\s+\w+)?)\s*[:=]\s*([\d.]+)\s*(\w+)?'

        # ICD-10 mapping
        self.icd_suggestions = {
            'chest pain': ['R07.9', 'I20.9'],
            'myocardial infarction': ['I21.9', 'I21.0'],
            'hypertension': ['I10'],
            'diabetes': ['E11.9', 'E10.9'],
            'pneumonia': ['J18.9'],
            'copd': ['J44.9'],
            'asthma': ['J45.9'],
            'depression': ['F32.9'],
            'anxiety': ['F41.9']
        }

    def extract_entities(self, text_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract medical entities from text"""
        results = {
            "symptoms": [],
            "medications": [],
            "lab_values": [],
            "critical_indicators": [],
            "negations": [],
            "suspected_icd10": [],
            "urgency_score": 0.0
        }

        # Combine all text
        full_text = self._combine_text_fields(text_data).lower()

        # Extract symptoms by category
        all_symptoms = []
        for category, pattern in self.symptom_patterns.items():
            matches = re.findall(pattern, full_text, re.IGNORECASE)
            for match in matches:
                # Check if negated
                if not self._is_negated(match, full_text):
                    all_symptoms.append({
                        'symptom': match,
                        'category': category
                    })

        results['symptoms'] = all_symptoms

        # Extract medications
        for pattern in self.medication_patterns:
            matches = re.findall(pattern, full_text, re.IGNORECASE)
            results['medications'].extend(matches)

        # Extract lab values
        lab_matches = re.findall(self.lab_pattern, full_text)
        for match in lab_matches:
            test_name, value, unit = match
            try:
                numeric_value = float(value)
                results['lab_values'].append({
                    'test': test_name,
                    'value': numeric_value,
                    'unit': unit if unit else None
                })
            except ValueError:
                pass

        # Check for critical indicators
        for indicator in self.critical_indicators:
            if indicator in full_text:
                results['critical_indicators'].append(indicator)

        # Suggest ICD-10 codes
        for condition, codes in self.icd_suggestions.items():
            if condition in full_text:
                for code in codes:
                    results['suspected_icd10'].append({
                        'code': code,
                        'condition': condition,
                        'confidence': 0.7
                    })

        # Calculate urgency score
        results['urgency_score'] = self._calculate_urgency(results)

        # Remove duplicates
        results['medications'] = list(set(results['medications']))

        return results

    def _combine_text_fields(self, text_data: Dict[str, Any]) -> str:
        """Combine all text fields"""
        text_parts = []

        if 'subjective' in text_data:
            for field, value in text_data['subjective'].items():
                if isinstance(value, str):
                    text_parts.append(f"{field}: {value}")

        for field in ['examination', 'laboratory', 'imaging', 'procedures']:
            if field in text_data and text_data[field]:
                text_parts.append(f"{field}: {text_data[field]}")

        return " ".join(text_parts)

    def _is_negated(self, term: str, full_text: str) -> bool:
        """Check if a term is negated"""
        position = full_text.find(term)
        if position == -1:
            return False

        # Check for negation terms within 50 characters before the term
        context_start = max(0, position - 50)
        context = full_text[context_start:position]

        for neg_term in self.negation_terms:
            if neg_term in context:
                return True
        return False

    def _calculate_urgency(self, entities: Dict[str, Any]) -> float:
        """Calculate urgency score"""
        score = 0.0

        # Critical indicators
        score += len(entities['critical_indicators']) * 0.3

        # Emergency symptoms
        emergency_keywords = ['chest pain', 'difficulty breathing', 'severe bleeding']
        for symptom_dict in entities['symptoms']:
            symptom = symptom_dict['symptom']
            if any(keyword in symptom for keyword in emergency_keywords):
                score += 0.3

        # Multiple symptoms
        score += min(len(entities['symptoms']) * 0.05, 0.2)

        # Abnormal labs (simplified)
        for lab in entities['lab_values']:
            # Simple check for critical values
            if lab['test'] in ['troponin', 'lactate', 'd-dimer'] and lab['value'] > 1.0:
                score += 0.2

        return min(score, 1.0)


# Initialize extractor
extractor = SimpleMedicalNLPExtractor()


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "simplified-medical-nlp",
        "version": "1.0"
    })


@app.route('/extract', methods=['POST'])
def extract_entities():
    """Extract medical entities from patient data"""
    try:
        data = request.json

        # Handle both direct JSON and stringified JSON
        if 'text_data' in data:
            text_data = data['text_data']
            if isinstance(text_data, str):
                text_data = json.loads(text_data)
        else:
            text_data = data

        # Extract entities
        entities = extractor.extract_entities(text_data)

        # Add metadata
        response = {
            "entities": entities,
            "urgency_score": entities['urgency_score'],
            "processing": {
                "timestamp": datetime.now().isoformat(),
                "version": "1.0"
            }
        }

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/suggest_icd10', methods=['POST'])
def suggest_icd10():
    """Suggest ICD-10 codes based on text"""
    try:
        data = request.json
        text = data.get('text', '')

        suggestions = []

        # Check against known patterns
        for condition, codes in extractor.icd_suggestions.items():
            if condition in text.lower():
                for code in codes:
                    suggestions.append({
                        "icd10_code": code,
                        "condition": condition,
                        "confidence": 0.7
                    })

        return jsonify({
            "suggestions": suggestions[:5],
            "count": len(suggestions)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    import os

    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)