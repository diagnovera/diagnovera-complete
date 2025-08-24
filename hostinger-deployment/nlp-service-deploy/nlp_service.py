"""
Medical NLP Service for n8n Integration
Extracts medical entities and provides structured data for diagnosis
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy
import scispacy
from negspacy.negation import Negex
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
import re
import json
from typing import Dict, List, Any, Tuple
import numpy as np

app = Flask(__name__)
CORS(app)

# Load medical NLP models
print("Loading NLP models...")
nlp = spacy.load("en_core_sci_md")  # Scientific spaCy model
nlp.add_pipe("negex")  # Add negation detection

# Load BioBERT for medical entity recognition
tokenizer = AutoTokenizer.from_pretrained("dmis-lab/biobert-v1.1")
model = AutoModelForTokenClassification.from_pretrained("dmis-lab/biobert-v1.1")
ner_pipeline = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")


class MedicalNLPExtractor:
    """Extracts medical entities from clinical text"""

    def __init__(self):
        self.symptom_patterns = [
            r"pain", r"ache", r"discomfort", r"burning", r"tingling",
            r"numbness", r"weakness", r"fatigue", r"fever", r"chills",
            r"nausea", r"vomiting", r"diarrhea", r"constipation",
            r"cough", r"shortness of breath", r"dyspnea", r"wheezing",
            r"headache", r"dizziness", r"vertigo", r"syncope"
        ]

        self.critical_patterns = [
            r"severe", r"acute", r"sudden onset", r"crushing",
            r"radiating", r"10/10", r"worst ever", r"thunderclap"
        ]

        # ICD-10 patterns for common conditions
        self.icd_patterns = {
            "I21": ["myocardial infarction", "heart attack", "MI", "STEMI", "NSTEMI"],
            "J44": ["COPD", "chronic obstructive pulmonary"],
            "E11": ["type 2 diabetes", "diabetes mellitus type 2", "DM2"],
            "I10": ["hypertension", "high blood pressure", "HTN"],
            "N18": ["chronic kidney disease", "CKD", "renal failure"],
            "F32": ["depression", "major depressive"],
            "J18": ["pneumonia", "lung infection"],
            "I50": ["heart failure", "CHF", "congestive heart failure"]
        }

    def extract_entities(self, text_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract medical entities from all text fields"""
        results = {
            "symptoms": [],
            "diagnoses": [],
            "medications": [],
            "procedures": [],
            "anatomy": [],
            "lab_values": [],
            "negations": [],
            "critical_indicators": [],
            "suspected_icd10": []
        }

        # Combine all text fields
        full_text = self._combine_text_fields(text_data)

        # Process with spaCy
        doc = nlp(full_text)

        # Extract entities
        for ent in doc.ents:
            if ent.label_ in ["DISEASE", "SYMPTOM", "CONDITION"]:
                # Check for negation
                if any(token._.negex for token in ent):
                    results["negations"].append(ent.text)
                else:
                    results["symptoms"].append(ent.text)

            elif ent.label_ in ["DRUG", "CHEMICAL"]:
                results["medications"].append(ent.text)

            elif ent.label_ in ["PROCEDURE", "TEST"]:
                results["procedures"].append(ent.text)

            elif ent.label_ in ["ANATOMY", "BODY_PART"]:
                results["anatomy"].append(ent.text)

        # Extract lab values with regex
        lab_pattern = r"(\w+)\s*[:=]\s*([\d.]+)\s*(\w+)?"
        lab_matches = re.findall(lab_pattern, full_text)
        for match in lab_matches:
            results["lab_values"].append({
                "test": match[0],
                "value": float(match[1]) if match[1].replace('.', '').isdigit() else match[1],
                "unit": match[2] if match[2] else None
            })

        # Check for critical indicators
        for pattern in self.critical_patterns:
            if re.search(pattern, full_text, re.IGNORECASE):
                results["critical_indicators"].append(pattern)

        # Suggest ICD-10 codes based on text
        for icd_code, patterns in self.icd_patterns.items():
            for pattern in patterns:
                if re.search(pattern, full_text, re.IGNORECASE):
                    results["suspected_icd10"].append({
                        "code": icd_code,
                        "matched_term": pattern
                    })

        # Use BioBERT for additional entity extraction
        bert_entities = ner_pipeline(full_text)
        for entity in bert_entities:
            if entity['entity_group'] == 'DISEASE' and entity['word'] not in results["symptoms"]:
                results["symptoms"].append(entity['word'])

        # Remove duplicates
        for key in results:
            if isinstance(results[key], list) and key != "lab_values" and key != "suspected_icd10":
                results[key] = list(set(results[key]))

        return results

    def _combine_text_fields(self, text_data: Dict[str, Any]) -> str:
        """Combine all text fields into a single string"""
        text_parts = []

        if "subjective" in text_data:
            for field, value in text_data["subjective"].items():
                if isinstance(value, str):
                    text_parts.append(f"{field}: {value}")

        for field in ["examination", "laboratory", "imaging", "procedures"]:
            if field in text_data and text_data[field]:
                text_parts.append(f"{field}: {text_data[field]}")

        return " ".join(text_parts)

    def calculate_urgency_score(self, entities: Dict[str, Any]) -> float:
        """Calculate urgency score based on extracted entities"""
        score = 0.0

        # Critical indicators add significant weight
        score += len(entities["critical_indicators"]) * 0.3

        # Check for emergency conditions
        emergency_symptoms = ["chest pain", "difficulty breathing", "altered mental status",
                              "severe bleeding", "stroke", "heart attack"]
        for symptom in entities["symptoms"]:
            if any(emergency in symptom.lower() for emergency in emergency_symptoms):
                score += 0.4

        # Multiple concerning symptoms
        score += min(len(entities["symptoms"]) * 0.05, 0.3)

        # Abnormal lab values (would need thresholds in real implementation)
        score += min(len(entities["lab_values"]) * 0.1, 0.2)

        return min(score, 1.0)  # Cap at 1.0


# Initialize extractor
extractor = MedicalNLPExtractor()


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "medical-nlp"})


@app.route('/extract', methods=['POST'])
def extract_entities():
    """Extract medical entities from patient data"""
    try:
        data = request.json
        text_data = json.loads(data.get('text_data', '{}'))

        # Extract entities
        entities = extractor.extract_entities(text_data)

        # Calculate urgency
        urgency_score = extractor.calculate_urgency_score(entities)

        # Add metadata
        response = {
            "entities": entities,
            "urgency_score": urgency_score,
            "processing": {
                "models_used": ["spacy_scimed", "negex", "biobert"],
                "confidence": 0.85  # Would calculate based on model outputs
            }
        }

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/analyze_critical', methods=['POST'])
def analyze_critical():
    """Analyze text specifically for critical findings"""
    try:
        data = request.json
        text = data.get('text', '')

        critical_findings = []

        # Define critical patterns with severity
        critical_patterns = {
            "immediate": [
                "cardiac arrest", "respiratory failure", "unconscious",
                "not breathing", "no pulse", "anaphylaxis"
            ],
            "urgent": [
                "chest pain radiating", "severe headache sudden",
                "difficulty breathing", "altered mental status",
                "severe bleeding", "stroke symptoms"
            ],
            "high": [
                "fever above 103", "blood pressure over 180",
                "oxygen below 90", "heart rate over 150"
            ]
        }

        # Check each pattern
        for severity, patterns in critical_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    critical_findings.append({
                        "finding": pattern,
                        "severity": severity,
                        "context": text[max(0, text.lower().find(pattern) - 50):
                                        min(len(text), text.lower().find(pattern) + 50)]
                    })

        return jsonify({
            "critical_findings": critical_findings,
            "has_critical": len(critical_findings) > 0,
            "max_severity": critical_findings[0]["severity"] if critical_findings else None
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/suggest_icd10', methods=['POST'])
def suggest_icd10():
    """Suggest ICD-10 codes based on symptoms and findings"""
    try:
        data = request.json
        symptoms = data.get('symptoms', [])
        findings = data.get('findings', [])

        # Simple ICD-10 suggestion logic (would be more sophisticated in production)
        suggestions = []

        # Map symptoms to ICD-10 codes
        symptom_icd_map = {
            "chest pain": ["I20.9", "R07.9"],
            "shortness of breath": ["R06.02", "J96.9"],
            "fever": ["R50.9"],
            "headache": ["R51.9"],
            "abdominal pain": ["R10.9"],
            "cough": ["R05"],
            "hypertension": ["I10"],
            "diabetes": ["E11.9"]
        }

        for symptom in symptoms:
            symptom_lower = symptom.lower()
            for key, codes in symptom_icd_map.items():
                if key in symptom_lower:
                    for code in codes:
                        suggestions.append({
                            "icd10_code": code,
                            "matched_symptom": symptom,
                            "confidence": 0.7
                        })

        # Remove duplicates and sort by confidence
        seen = set()
        unique_suggestions = []
        for s in suggestions:
            if s["icd10_code"] not in seen:
                seen.add(s["icd10_code"])
                unique_suggestions.append(s)

        return jsonify({
            "suggestions": unique_suggestions[:10],  # Top 10
            "count": len(unique_suggestions)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)