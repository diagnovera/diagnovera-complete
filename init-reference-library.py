#!/usr/bin/env python3
"""
initialize_reference_library.py

Script to initialize the ICD10 reference library in Firestore
from the Excel file data
"""

import pandas as pd
import numpy as np
from google.cloud import firestore, storage
import json
from datetime import datetime
import argparse
import logging
from typing import Dict, List
import sys

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ICD10LibraryInitializer:
    """Initialize ICD10 reference library with complex plane mappings"""
    
    def __init__(self, project_id: str, bucket_name: str):
        self.project_id = project_id
        self.bucket_name = bucket_name
        self.db = firestore.Client(project=project_id)
        self.storage_client = storage.Client(project=project_id)
        
        # Disease category mappings
        self.category_mappings = {
            'A': 'Infectious and parasitic diseases',
            'B': 'Infectious and parasitic diseases',
            'C': 'Neoplasms',
            'D': 'Neoplasms and diseases of blood',
            'E': 'Endocrine, nutritional and metabolic',
            'F': 'Mental and behavioral disorders',
            'G': 'Diseases of the nervous system',
            'H': 'Diseases of the eye and ear',
            'I': 'Diseases of the circulatory system',
            'J': 'Diseases of the respiratory system',
            'K': 'Diseases of the digestive system',
            'L': 'Diseases of the skin',
            'M': 'Diseases of the musculoskeletal system',
            'N': 'Diseases of the genitourinary system',
            'O': 'Pregnancy, childbirth and puerperium',
            'P': 'Certain conditions in the perinatal period',
            'Q': 'Congenital malformations',
            'R': 'Symptoms and signs',
            'S': 'Injury and poisoning',
            'T': 'Injury and poisoning',
            'V': 'External causes of morbidity',
            'W': 'External causes of morbidity',
            'X': 'External causes of morbidity',
            'Y': 'External causes of morbidity',
            'Z': 'Factors influencing health status'
        }
        
        # Common clinical patterns for different disease categories
        self.clinical_patterns = self._load_clinical_patterns()
    
    def _load_clinical_patterns(self) -> Dict:
        """Load common clinical patterns for disease categories"""
        return {
            'Cardiovascular': {
                'subjective': ['chest_pain', 'dyspnea', 'palpitations', 'fatigue', 'edema'],
                'vitals': ['blood_pressure', 'heart_rate', 'respiratory_rate'],
                'laboratory': ['troponin', 'bnp', 'ck_mb', 'd_dimer'],
                'imaging': ['ecg_changes', 'echo_findings', 'angiography']
            },
            'Respiratory': {
                'subjective': ['cough', 'dyspnea', 'sputum', 'chest_pain', 'wheezing'],
                'vitals': ['oxygen_saturation', 'respiratory_rate', 'temperature'],
                'laboratory': ['arterial_blood_gas', 'white_blood_cells', 'procalcitonin'],
                'imaging': ['chest_xray', 'ct_chest', 'pulmonary_function']
            },
            'Infectious': {
                'subjective': ['fever', 'chills', 'malaise', 'myalgia', 'headache'],
                'vitals': ['temperature', 'heart_rate', 'blood_pressure'],
                'laboratory': ['white_blood_cells', 'crp', 'procalcitonin', 'cultures'],
                'imaging': ['chest_xray', 'ct_scan']
            },
            'Neurological': {
                'subjective': ['headache', 'dizziness', 'weakness', 'numbness', 'confusion'],
                'vitals': ['blood_pressure', 'heart_rate', 'glasgow_coma_scale'],
                'laboratory': ['glucose', 'electrolytes', 'toxicology'],
                'imaging': ['ct_head', 'mri_brain', 'eeg']
            }
        }
    
    def read_icd10_file(self, file_path: str) -> pd.DataFrame:
        """Read ICD10 codes from Excel file"""
        logger.info(f"Reading ICD10 file: {file_path}")
        
        try:
            # Read Excel file
            df = pd.read_excel(file_path, sheet_name=0)
            logger.info(f"Loaded {len(df)} ICD10 codes")
            
            # Standardize column names
            df.columns = df.columns.str.strip().str.upper()
            
            # Required columns
            required_cols = ['CODE', 'LONG DESCRIPTION']
            for col in required_cols:
                if not any(col in c for c in df.columns):
                    raise ValueError(f"Required column '{col}' not found")
            
            return df
            
        except Exception as e:
            logger.error(f"Error reading ICD10 file: {e}")
            raise
    
    def categorize_disease(self, icd_code: str) -> str:
        """Categorize disease based on ICD code"""
        if not icd_code:
            return 'Other'
        
        first_letter = icd_code[0].upper()
        category = self.category_mappings.get(first_letter, 'Other')
        
        # More specific categorization for common conditions
        if icd_code.startswith('I2'):
            return 'Cardiovascular'
        elif icd_code.startswith('J'):
            return 'Respiratory'
        elif icd_code.startswith(('A', 'B')):
            return 'Infectious'
        elif icd_code.startswith('G'):
            return 'Neurological'
        elif icd_code.startswith('E'):
            return 'Endocrine'
        elif icd_code.startswith('C'):
            return 'Neoplasms'
        
        return category
    
    def generate_complex_plane_template(self, icd_code: str, description: str) -> Dict:
        """Generate template complex plane data for a disease"""
        category = self.categorize_disease(icd_code)
        
        # Get clinical pattern for category
        pattern_key = category if category in self.clinical_patterns else 'Cardiovascular'
        pattern = self.clinical_patterns[pattern_key]
        
        complex_data = {}
        
        # Subjective domain
        subjective_vars = pattern.get('subjective', [])
        angle_step = 360 / max(len(subjective_vars), 1)
        complex_data['subjective'] = [
            {
                'variable': var,
                'angle': idx * angle_step,
                'magnitude': 0.0,  # To be filled by AI agent
                'confidence': 0.0,
                'weight': 0.8
            }
            for idx, var in enumerate(subjective_vars)
        ]
        
        # Vitals domain
        vital_angles = {
            'temperature': 0,
            'heart_rate': 60,
            'blood_pressure': 120,
            'respiratory_rate': 180,
            'oxygen_saturation': 240,
            'glasgow_coma_scale': 300
        }
        
        complex_data['vitals'] = [
            {
                'variable': var,
                'angle': vital_angles.get(var, idx * 60),
                'range': {'min': 0, 'max': 0},  # To be filled
                'magnitude': 0.0
            }
            for idx, var in enumerate(pattern.get('vitals', []))
            if var in vital_angles
        ]
        
        # Laboratory domain
        lab_vars = pattern.get('laboratory', [])
        angle_step = 360 / max(len(lab_vars), 1)
        complex_data['laboratory'] = [
            {
                'variable': var,
                'angle': idx * angle_step,
                'magnitude': 0.0,
                'elevated': False,
                'range': ''
            }
            for idx, var in enumerate(lab_vars)
        ]
        
        # Imaging domain
        imaging_vars = pattern.get('imaging', [])
        angle_step = 360 / max(len(imaging_vars), 1)
        complex_data['imaging'] = [
            {
                'variable': var,
                'angle': idx * angle_step,
                'magnitude': 0.0,
                'finding': '',
                'confidence': 0.0
            }
            for idx, var in enumerate(imaging_vars)
        ]
        
        return complex_data
    
    def create_disease_profile(self, icd_code: str, short_desc: str, long_desc: str) -> Dict:
        """Create a disease profile document"""
        category = self.categorize_disease(icd_code)
        
        profile = {
            'icd10_code': icd_code,
            'short_description': short_desc,
            'description': long_desc,
            'category': category,
            'confidence_score': 0.0,  # To be updated by AI agent
            'sources': [],  # To be filled by AI agent
            'complex_plane_data': self.generate_complex_plane_template(icd_code, long_desc),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'status': 'template',  # template, processing, completed
            'clinical_criteria': {
                'major_criteria': [],
                'minor_criteria': [],
                'exclusion_criteria': []
            },
            'profile_data': {
                'prevalence': None,
                'age_distribution': None,
                'sex_distribution': None,
                'risk_factors': [],
                'complications': [],
                'differential_diagnoses': []
            }
        }
        
        return profile
    
    def upload_to_firestore(self, df: pd.DataFrame, batch_size: int = 500):
        """Upload disease profiles to Firestore"""
        logger.info("Starting upload to Firestore...")
        
        total_count = len(df)
        uploaded_count = 0
        error_count = 0
        
        # Process in batches
        for start_idx in range(0, total_count, batch_size):
            end_idx = min(start_idx + batch_size, total_count)
            batch_df = df.iloc[start_idx:end_idx]
            
            batch = self.db.batch()
            
            for _, row in batch_df.iterrows():
                try:
                    # Extract data
                    icd_code = str(row.get('CODE', '')).strip()
                    
                    # Find description columns
                    short_desc = ''
                    long_desc = ''
                    
                    for col in df.columns:
                        if 'SHORT DESCRIPTION' in col:
                            short_desc = str(row[col]).strip()
                        elif 'LONG DESCRIPTION' in col:
                            long_desc = str(row[col]).strip()
                    
                    if not icd_code or not long_desc:
                        continue
                    
                    # Create profile
                    profile = self.create_disease_profile(
                        icd_code, short_desc, long_desc
                    )
                    
                    # Add to batch
                    doc_ref = self.db.collection('icd10_reference_library').document(icd_code)
                    batch.set(doc_ref, profile)
                    
                except Exception as e:
                    logger.error(f"Error processing {icd_code}: {e}")
                    error_count += 1
                    continue
            
            # Commit batch
            try:
                batch.commit()
                uploaded_count += (end_idx - start_idx)
                logger.info(f"Uploaded {uploaded_count}/{total_count} profiles")
            except Exception as e:
                logger.error(f"Batch commit error: {e}")
                error_count += batch_size
        
        logger.info(f"Upload completed. Uploaded: {uploaded_count}, Errors: {error_count}")
        
        # Update statistics
        self._update_statistics(uploaded_count, error_count)
    
    def _update_statistics(self, uploaded_count: int, error_count: int):
        """Update library statistics in Firestore"""
        stats_ref = self.db.collection('system_stats').document('reference_library')
        stats_ref.set({
            'total_diseases': uploaded_count,
            'template_count': uploaded_count,
            'completed_count': 0,
            'error_count': error_count,
            'last_updated': datetime.utcnow(),
            'categories': list(set(self.category_mappings.values()))
        })
    
    def upload_file_to_gcs(self, file_path: str):
        """Upload ICD10 file to Google Cloud Storage"""
        logger.info(f"Uploading {file_path} to GCS bucket {self.bucket_name}")
        
        bucket = self.storage_client.bucket(self.bucket_name)
        blob_name = f"reference_data/icd10_codes_{datetime.now().strftime('%Y%m%d')}.xlsx"
        blob = bucket.blob(blob_name)
        
        blob.upload_from_filename(file_path)
        logger.info(f"File uploaded to gs://{self.bucket_name}/{blob_name}")
    
    def trigger_ai_processing(self, limit: int = None):
        """Trigger AI processing for disease profiles"""
        logger.info("Creating AI processing tasks...")
        
        # Query template profiles
        query = self.db.collection('icd10_reference_library').where('status', '==', 'template')
        
        if limit:
            query = query.limit(limit)
        
        profiles = list(query.stream())
        logger.info(f"Found {len(profiles)} profiles to process")
        
        # Create processing tasks
        batch_size = 100
        for i in range(0, len(profiles), batch_size):
            batch_profiles = profiles[i:i+batch_size]
            task_id = f"AI_PROCESS_{datetime.utcnow().timestamp()}"
            
            task_doc = {
                'task_id': task_id,
                'type': 'ai_enrichment',
                'status': 'pending',
                'icd_codes': [p.id for p in batch_profiles],
                'created_at': datetime.utcnow(),
                'config': {
                    'search_depth': 'comprehensive',
                    'sources': ['pubmed', 'medical_textbooks', 'clinical_guidelines'],
                    'enrich_domains': ['subjective', 'vitals', 'laboratory', 'imaging']
                }
            }
            
            self.db.collection('library_build_tasks').document(task_id).set(task_doc)
            logger.info(f"Created task {task_id} for {len(batch_profiles)} profiles")

def main():
    parser = argparse.ArgumentParser(description='Initialize ICD10 Reference Library')
    parser.add_argument('--project-id', required=True, help='Google Cloud Project ID')
    parser.add_argument('--bucket-name', required=True, help='GCS Bucket name')
    parser.add_argument('--file-path', required=True, help='Path to ICD10 Excel file')
    parser.add_argument('--upload-to-gcs', action='store_true', help='Upload file to GCS')
    parser.add_argument('--trigger-ai', action='store_true', help='Trigger AI processing')
    parser.add_argument('--ai-limit', type=int, help='Limit number of profiles for AI processing')
    
    args = parser.parse_args()
    
    # Initialize
    initializer = ICD10LibraryInitializer(args.project_id, args.bucket_name)
    
    try:
        # Read ICD10 file
        df = initializer.read_icd10_file(args.file_path)
        
        # Upload to GCS if requested
        if args.upload_to_gcs:
            initializer.upload_file_to_gcs(args.file_path)
        
        # Upload to Firestore
        initializer.upload_to_firestore(df)
        
        # Trigger AI processing if requested
        if args.trigger_ai:
            initializer.trigger_ai_processing(limit=args.ai_limit)
        
        logger.info("Initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"Initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()