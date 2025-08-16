# cloud_functions/patient_processor/main.py
"""
Cloud Function to process patient encounters asynchronously
"""

import json
import base64
import logging
from google.cloud import firestore, storage, language_v1
from google.cloud import aiplatform
import numpy as np
from datetime import datetime
from typing import Dict, List

# Initialize clients
db = firestore.Client()
storage_client = storage.Client()
language_client = language_v1.LanguageServiceClient()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NLPProcessor:
    """Process text domains using Google Cloud Natural Language API"""
    
    def __init__(self):
        self.language_client = language_client
        self.medical_entities = self._load_medical_entities()
    
    def _load_medical_entities(self):
        """Load medical entity mappings"""
        # In production, load from Firestore or GCS
        return {
            'symptoms': {
                'chest_pain': ['chest pain', 'angina', 'chest discomfort', 'chest pressure'],
                'dyspnea': ['shortness of breath', 'difficulty breathing', 'breathlessness', 'SOB'],
                'fever': ['fever', 'pyrexia', 'elevated temperature', 'febrile'],
                'cough': ['cough', 'coughing', 'productive cough', 'dry cough'],
                'nausea': ['nausea', 'feeling sick', 'queasy'],
                'vomiting': ['vomiting', 'emesis', 'throwing up'],
                'headache': ['headache', 'cephalalgia', 'head pain'],
                'fatigue': ['fatigue', 'tiredness', 'exhaustion', 'lethargy']
            },
            'negations': ['no', 'not', 'denies', 'negative', 'absent', 'without', 'none']
        }
    
    def extract_clinical_entities(self, text: str, domain: str) -> List[Dict]:
        """Extract clinical entities from text"""
        try:
            # Analyze text using Google Cloud NLP
            document = language_v1.Document(
                content=text,
                type_=language_v1.Document.Type.PLAIN_TEXT,
            )
            
            # Entity analysis
            entities = self.language_client.analyze_entities(
                request={'document': document}
            ).entities
            
            # Sentiment analysis for context
            sentiment = self.language_client.analyze_sentiment(
                request={'document': document}
            ).document_sentiment
            
            # Extract medical entities
            extracted_vars = []
            text_lower = text.lower()
            
            for symptom, variations in self.medical_entities['symptoms'].items():
                for variation in variations:
                    if variation in text_lower:
                        # Check for negation
                        is_negated = any(neg in text_lower for neg in self.medical_entities['negations'])
                        
                        extracted_vars.append({
                            'variable': symptom,
                            'present': not is_negated,
                            'confidence': 0.9 if not is_negated else 0.8,
                            'text_segment': variation
                        })
                        break
            
            return extracted_vars
            
        except Exception as e:
            logger.error(f"NLP processing error: {e}")
            return []
    
    def process_domain(self, domain_text: str, domain_type: str) -> Dict:
        """Process a complete domain text"""
        entities = self.extract_clinical_entities(domain_text, domain_type)
        
        # Convert to angle-based representation
        angle_step = 360 / max(len(entities), 1)
        complex_data = []
        
        for idx, entity in enumerate(entities):
            complex_data.append({
                'variable': entity['variable'],
                'angle': idx * angle_step,
                'magnitude': 1.0 if entity['present'] else 0.0,
                'confidence': entity['confidence']
            })
        
        return {
            'raw_entities': entities,
            'complex_plane_data': complex_data
        }

def process_encounter(event, context):
    """
    Main Cloud Function entry point for processing patient encounters
    
    Args:
        event: Pub/Sub message
        context: Event metadata
    """
    try:
        # Decode Pub/Sub message
        if 'data' in event:
            message_data = base64.b64decode(event['data']).decode('utf-8')
            message = json.loads(message_data)
            encounter_id = message['encounter_id']
        else:
            logger.error("No data in Pub/Sub message")
            return
        
        logger.info(f"Processing encounter: {encounter_id}")
        
        # Retrieve encounter data from Firestore
        encounter_doc = db.collection('patient_encounters').document(encounter_id).get()
        if not encounter_doc.exists:
            logger.error(f"Encounter {encounter_id} not found")
            return
        
        encounter_data = encounter_doc.to_dict()['data']
        
        # Initialize NLP processor
        nlp_processor = NLPProcessor()
        
        # Process text domains
        processed_data = encounter_data.copy()
        
        # Process subjective domain
        if 'subjective' in encounter_data:
            subjective = encounter_data['subjective']
            
            # Combine all subjective text
            subjective_text = f"""
            Chief Complaint: {subjective.get('chief_complaint', '')}
            History of Present Illness: {subjective.get('hpi', '')}
            Past Medical History: {subjective.get('pmh', '')}
            Medications: {subjective.get('medications', '')}
            Allergies: {subjective.get('allergies', '')}
            """
            
            subjective_processed = nlp_processor.process_domain(
                subjective_text, 'subjective'
            )
            processed_data['subjective_nlp'] = subjective_processed
        
        # Process examination domain
        if 'examination' in encounter_data:
            exam_processed = nlp_processor.process_domain(
                encounter_data['examination'], 'examination'
            )
            processed_data['examination_nlp'] = exam_processed
        
        # Process imaging domain
        if 'imaging' in encounter_data:
            imaging_processed = nlp_processor.process_domain(
                encounter_data['imaging'], 'imaging'
            )
            processed_data['imaging_nlp'] = imaging_processed
        
        # Store processed data
        db.collection('processed_encounters').document(encounter_id).set({
            'encounter_id': encounter_id,
            'original_data': encounter_data,
            'processed_data': processed_data,
            'processing_timestamp': firestore.SERVER_TIMESTAMP,
            'status': 'completed'
        })
        
        logger.info(f"Successfully processed encounter: {encounter_id}")
        
    except Exception as e:
        logger.error(f"Error processing encounter: {e}")
        
        # Update status to failed
        if 'encounter_id' in locals():
            db.collection('patient_encounters').document(encounter_id).update({
                'status': 'failed',
                'error': str(e),
                'failed_at': firestore.SERVER_TIMESTAMP
            })

# cloud_functions/patient_processor/requirements.txt
google-cloud-firestore==2.11.1
google-cloud-storage==2.10.0
google-cloud-language==2.10.1
google-cloud-aiplatform==1.28.0
numpy==1.24.3

---

# cloud_functions/library_builder/main.py
"""
Cloud Function to build ICD10 reference library from medical literature
Uses AI to search and extract disease profiles
"""

import json
import base64
import logging
import pandas as pd
from google.cloud import firestore, storage, aiplatform
from google.cloud import discoveryengine_v1beta
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
import re

# Initialize clients
db = firestore.Client()
storage_client = storage.Client()
aiplatform.init()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MedicalLiteratureSearcher:
    """Search medical literature using Google's APIs"""
    
    def __init__(self):
        self.search_client = discoveryengine_v1beta.SearchServiceClient()
        self.medical_sources = [
            'pubmed',
            'harrison',
            'cecil',
            'uptodate',
            'nejm',
            'lancet',
            'jama'
        ]
    
    def search_disease_info(self, icd_code: str, description: str) -> List[Dict]:
        """Search for disease information across medical sources"""
        search_results = []
        
        # Construct search queries
        queries = [
            f"{icd_code} {description} clinical presentation",
            f"{description} symptoms signs diagnosis",
            f"{description} laboratory findings imaging",
            f"{icd_code} diagnostic criteria"
        ]
        
        for query in queries:
            try:
                # In production, this would use actual medical literature APIs
                # For now, we'll simulate with structured data
                results = self._simulate_literature_search(query, icd_code, description)
                search_results.extend(results)
            except Exception as e:
                logger.error(f"Search error for {query}: {e}")
        
        return search_results
    
    def _simulate_literature_search(self, query: str, icd_code: str, description: str) -> List[Dict]:
        """Simulate literature search results"""
        # In production, replace with actual API calls
        
        # Example structure based on disease type
        if 'myocardial infarction' in description.lower():
            return [{
                'source': 'Harrison\'s Internal Medicine',
                'clinical_features': {
                    'symptoms': ['chest pain', 'dyspnea', 'diaphoresis', 'nausea'],
                    'signs': ['tachycardia', 'hypertension', 'S3 gallop'],
                    'risk_factors': ['hypertension', 'diabetes', 'smoking', 'hyperlipidemia']
                },
                'vitals': {
                    'heart_rate': {'min': 90, 'max': 120, 'typical': 105},
                    'blood_pressure': {'systolic': {'min': 140, 'max': 180}, 'diastolic': {'min': 85, 'max': 105}},
                    'temperature': {'min': 36.5, 'max': 38.0}
                },
                'laboratory': {
                    'troponin': {'elevated': True, 'range': '>0.04 ng/mL'},
                    'ck_mb': {'elevated': True, 'range': '>6.3 ng/mL'},
                    'bnp': {'range': '>100 pg/mL'}
                },
                'imaging': {
                    'ecg': ['ST elevation', 'Q waves', 'T wave inversion'],
                    'echo': ['wall motion abnormality', 'reduced ejection fraction']
                }
            }]
        
        # Default structure for other diseases
        return [{
            'source': 'Medical Literature',
            'clinical_features': {
                'symptoms': ['symptom1', 'symptom2'],
                'signs': ['sign1', 'sign2']
            }
        }]

class ReferenceLibraryBuilder:
    """Build ICD10 reference library with complex plane representation"""
    
    def __init__(self):
        self.literature_searcher = MedicalLiteratureSearcher()
        self.angle_allocator = AngleAllocator()
    
    def build_disease_profile(self, icd_code: str, description: str) -> Dict:
        """Build comprehensive disease profile"""
        logger.info(f"Building profile for {icd_code}: {description}")
        
        # Search medical literature
        literature_results = self.literature_searcher.search_disease_info(
            icd_code, description
        )
        
        # Extract and structure information
        profile = {
            'icd10_code': icd_code,
            'description': description,
            'sources': [],
            'confidence_score': 0.0,
            'complex_plane_data': {},
            'clinical_criteria': {}
        }
        
        # Process literature results
        for result in literature_results:
            profile['sources'].append(result.get('source', 'Unknown'))
            
            # Extract clinical features
            if 'clinical_features' in result:
                profile['complex_plane_data']['subjective'] = self._process_symptoms(
                    result['clinical_features']
                )
            
            # Extract vital signs
            if 'vitals' in result:
                profile['complex_plane_data']['vitals'] = self._process_vitals(
                    result['vitals']
                )
            
            # Extract laboratory values
            if 'laboratory' in result:
                profile['complex_plane_data']['laboratory'] = self._process_labs(
                    result['laboratory']
                )
            
            # Extract imaging findings
            if 'imaging' in result:
                profile['complex_plane_data']['imaging'] = self._process_imaging(
                    result['imaging']
                )
        
        # Calculate confidence score based on sources
        profile['confidence_score'] = min(len(literature_results) / 5.0, 1.0)
        
        # Assign category
        profile['category'] = self._categorize_disease(icd_code)
        
        return profile
    
    def _process_symptoms(self, clinical_features: Dict) -> List[Dict]:
        """Convert symptoms to complex plane representation"""
        symptoms = clinical_features.get('symptoms', [])
        complex_data = []
        
        angle_step = 360 / max(len(symptoms), 1)
        
        for idx, symptom in enumerate(symptoms):
            complex_data.append({
                'variable': symptom.replace(' ', '_'),
                'angle': idx * angle_step,
                'magnitude': 0.9,  # High probability for primary symptoms
                'confidence': 0.85,
                'weight': 0.9 if idx < 3 else 0.7  # Primary symptoms weighted higher
            })
        
        return complex_data
    
    def _process_vitals(self, vitals: Dict) -> List[Dict]:
        """Convert vital signs to complex plane representation"""
        vital_angles = {
            'temperature': 0,
            'heart_rate': 60,
            'blood_pressure': 120,
            'respiratory_rate': 240,
            'oxygen_saturation': 300
        }
        
        complex_data = []
        
        for vital_name, ranges in vitals.items():
            if vital_name in vital_angles:
                complex_data.append({
                    'variable': vital_name,
                    'angle': vital_angles[vital_name],
                    'range': ranges,
                    'magnitude': 0.8
                })
        
        return complex_data
    
    def _process_labs(self, laboratory: Dict) -> List[Dict]:
        """Convert laboratory values to complex plane representation"""
        complex_data = []
        angle_step = 360 / max(len(laboratory), 1)
        
        for idx, (lab_name, lab_info) in enumerate(laboratory.items()):
            complex_data.append({
                'variable': lab_name,
                'angle': idx * angle_step,
                'elevated': lab_info.get('elevated', False),
                'range': lab_info.get('range', ''),
                'magnitude': 0.9 if lab_info.get('elevated') else 0.3,
                'critical': lab_info.get('critical', False)
            })
        
        return complex_data
    
    def _process_imaging(self, imaging: Dict) -> List[Dict]:
        """Convert imaging findings to complex plane representation"""
        complex_data = []
        all_findings = []
        
        # Flatten imaging findings
        for modality, findings in imaging.items():
            for finding in findings:
                all_findings.append({
                    'modality': modality,
                    'finding': finding
                })
        
        angle_step = 360 / max(len(all_findings), 1)
        
        for idx, finding_info in enumerate(all_findings):
            complex_data.append({
                'variable': f"{finding_info['modality']}_{finding_info['finding']}".replace(' ', '_'),
                'angle': idx * angle_step,
                'finding': finding_info['finding'],
                'magnitude': 0.85,
                'confidence': 0.8
            })
        
        return complex_data
    
    def _categorize_disease(self, icd_code: str) -> str:
        """Categorize disease based on ICD code"""
        # ICD-10 category mapping
        categories = {
            'A': 'Infectious',
            'B': 'Infectious',
            'C': 'Neoplasms',
            'D': 'Blood',
            'E': 'Endocrine',
            'F': 'Mental',
            'G': 'Nervous',
            'H': 'Sensory',
            'I': 'Cardiovascular',
            'J': 'Respiratory',
            'K': 'Digestive',
            'L': 'Skin',
            'M': 'Musculoskeletal',
            'N': 'Genitourinary',
            'O': 'Pregnancy',
            'P': 'Perinatal',
            'Q': 'Congenital',
            'R': 'Symptoms',
            'S': 'Injury',
            'T': 'Injury',
            'V': 'External',
            'W': 'External',
            'X': 'External',
            'Y': 'External',
            'Z': 'Factors'
        }
        
        first_letter = icd_code[0].upper()
        return categories.get(first_letter, 'Other')

class AngleAllocator:
    """Allocate angles for variables in complex plane"""
    
    def __init__(self):
        self.allocated_angles = {}
    
    def allocate_angle(self, domain: str, variable: str) -> float:
        """Allocate unique angle for variable"""
        key = f"{domain}:{variable}"
        
        if key not in self.allocated_angles:
            # Allocate based on domain and variable index
            domain_offset = {
                'subjective': 0,
                'vitals': 0,
                'examination': 0,
                'laboratory': 0,
                'imaging': 0,
                'procedures': 0
            }
            
            current_count = sum(1 for k in self.allocated_angles if k.startswith(f"{domain}:"))
            angle = domain_offset.get(domain, 0) + (current_count * 30)  # 30-degree increments
            self.allocated_angles[key] = angle % 360
        
        return self.allocated_angles[key]

def build_library(event, context):
    """
    Main Cloud Function entry point for building reference library
    
    Args:
        event: Pub/Sub message
        context: Event metadata
    """
    try:
        # Decode Pub/Sub message
        if 'data' in event:
            message_data = base64.b64decode(event['data']).decode('utf-8')
            message = json.loads(message_data)
            task_id = message['task_id']
        else:
            logger.error("No data in Pub/Sub message")
            return
        
        logger.info(f"Starting library build task: {task_id}")
        
        # Retrieve task configuration
        task_doc = db.collection('library_build_tasks').document(task_id).get()
        if not task_doc.exists:
            logger.error(f"Task {task_id} not found")
            return
        
        task_config = task_doc.to_dict()
        
        # Load ICD10 codes from Cloud Storage
        bucket_name = task_config.get('bucket_name', 'medical-diagnostic-data')
        file_name = task_config.get('file_name', 'icd10_codes.csv')
        
        # Download and read ICD10 codes
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        # Read CSV data
        csv_content = blob.download_as_text()
        
        # Parse ICD10 codes (assuming CSV format)
        import io
        import csv
        
        icd_codes = []
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        for row in csv_reader:
            icd_codes.append({
                'code': row.get('CODE', ''),
                'description': row.get('LONG DESCRIPTION', '')
            })
        
        # Initialize builder
        library_builder = ReferenceLibraryBuilder()
        
        # Build profiles for each disease
        batch_size = 100
        batch = []
        
        for idx, icd_info in enumerate(icd_codes[:1000]):  # Limit for testing
            try:
                profile = library_builder.build_disease_profile(
                    icd_info['code'],
                    icd_info['description']
                )
                
                batch.append(profile)
                
                # Write batch to Firestore
                if len(batch) >= batch_size:
                    batch_ref = db.collection('icd10_reference_library')
                    for profile in batch:
                        batch_ref.document(profile['icd10_code']).set(profile)
                    
                    logger.info(f"Processed {idx + 1} diseases")
                    batch = []
                
            except Exception as e:
                logger.error(f"Error processing {icd_info['code']}: {e}")
        
        # Write remaining batch
        if batch:
            batch_ref = db.collection('icd10_reference_library')
            for profile in batch:
                batch_ref.document(profile['icd10_code']).set(profile)
        
        # Update task status
        db.collection('library_build_tasks').document(task_id).update({
            'status': 'completed',
            'completed_at': firestore.SERVER_TIMESTAMP,
            'diseases_processed': len(icd_codes)
        })
        
        logger.info(f"Library build completed: {task_id}")
        
    except Exception as e:
        logger.error(f"Error in library build: {e}")
        
        # Update task status to failed
        if 'task_id' in locals():
            db.collection('library_build_tasks').document(task_id).update({
                'status': 'failed',
                'error': str(e),
                'failed_at': firestore.SERVER_TIMESTAMP
            })

# cloud_functions/library_builder/requirements.txt
google-cloud-firestore==2.11.1
google-cloud-storage==2.10.0
google-cloud-aiplatform==1.28.0
google-cloud-discoveryengine==0.11.0
pandas==2.0.3
numpy==1.24.3