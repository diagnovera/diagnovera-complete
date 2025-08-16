#!/usr/bin/env python3
"""
upload_icd10_to_firestore.py

Script to upload ICD10 data from Excel to Firestore
Run this after setting up your Google Cloud project
"""

import pandas as pd
import numpy as np
from google.cloud import firestore
import os
import sys
from datetime import datetime
import argparse
from typing import Dict, List
import json

# Add color output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_status(message, status="info"):
    """Print colored status messages"""
    if status == "success":
        print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")
    elif status == "error":
        print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")
    elif status == "warning":
        print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")
    else:
        print(f"{Colors.OKBLUE}ℹ {message}{Colors.ENDC}")

class ICD10Uploader:
    def __init__(self, project_id: str):
        """Initialize uploader with project ID"""
        self.project_id = project_id
        try:
            self.db = firestore.Client(project=project_id)
            print_status(f"Connected to Firestore project: {project_id}", "success")
        except Exception as e:
            print_status(f"Failed to connect to Firestore: {e}", "error")
            sys.exit(1)
        
        # Disease category mapping
        self.category_map = {
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
        
        # Clinical patterns for initial complex plane setup
        self.clinical_patterns = {
            'Cardiovascular': {
                'keywords': ['myocardial', 'cardiac', 'heart', 'coronary', 'arterial', 'venous'],
                'vitals': ['blood_pressure', 'heart_rate'],
                'labs': ['troponin', 'bnp', 'ck_mb']
            },
            'Respiratory': {
                'keywords': ['pulmonary', 'respiratory', 'lung', 'bronchial', 'pneumonia'],
                'vitals': ['respiratory_rate', 'oxygen_saturation'],
                'labs': ['arterial_blood_gas', 'white_blood_cells']
            },
            'Infectious': {
                'keywords': ['infection', 'bacterial', 'viral', 'fever', 'sepsis'],
                'vitals': ['temperature', 'heart_rate'],
                'labs': ['white_blood_cells', 'crp', 'procalcitonin']
            },
            'Neurological': {
                'keywords': ['cerebral', 'neurological', 'brain', 'stroke', 'seizure'],
                'vitals': ['blood_pressure', 'glasgow_coma_scale'],
                'labs': ['glucose', 'electrolytes']
            }
        }
    
    def read_excel_file(self, filepath: str) -> pd.DataFrame:
        """Read ICD10 Excel file"""
        print_status(f"Reading Excel file: {filepath}")
        
        try:
            df = pd.read_excel(filepath, sheet_name=0)
            print_status(f"Successfully read {len(df)} rows", "success")
            
            # Display column info
            print(f"\n{Colors.BOLD}Column Information:{Colors.ENDC}")
            for col in df.columns:
                print(f"  - {col}")
            
            # Display sample data
            print(f"\n{Colors.BOLD}Sample Data (first 3 rows):{Colors.ENDC}")
            print(df.head(3).to_string())
            
            return df
            
        except Exception as e:
            print_status(f"Error reading Excel file: {e}", "error")
            sys.exit(1)
    
    def get_disease_category(self, icd_code: str) -> str:
        """Determine disease category from ICD code"""
        if not icd_code:
            return "Other"
        
        first_letter = icd_code[0].upper()
        return self.category_map.get(first_letter, "Other")
    
    def get_clinical_type(self, description: str) -> str:
        """Determine clinical type based on description keywords"""
        description_lower = description.lower()
        
        for clinical_type, pattern in self.clinical_patterns.items():
            for keyword in pattern['keywords']:
                if keyword in description_lower:
                    return clinical_type
        
        return "General"
    
    def create_complex_plane_template(self, icd_code: str, description: str) -> Dict:
        """Create initial complex plane template for disease"""
        clinical_type = self.get_clinical_type(description)
        
        # Base template structure
        template = {
            'subjective': [],
            'vitals': [],
            'examination': [],
            'laboratory': [],
            'imaging': [],
            'procedures': []
        }
        
        # Add placeholders based on clinical type
        if clinical_type == "Cardiovascular":
            template['subjective'] = [
                {'variable': 'chest_pain', 'angle': 0, 'magnitude': 0, 'confidence': 0},
                {'variable': 'dyspnea', 'angle': 60, 'magnitude': 0, 'confidence': 0},
                {'variable': 'palpitations', 'angle': 120, 'magnitude': 0, 'confidence': 0}
            ]
            template['vitals'] = [
                {'variable': 'blood_pressure', 'angle': 0, 'magnitude': 0, 'range': {'min': 0, 'max': 0}},
                {'variable': 'heart_rate', 'angle': 90, 'magnitude': 0, 'range': {'min': 0, 'max': 0}}
            ]
            template['laboratory'] = [
                {'variable': 'troponin', 'angle': 0, 'magnitude': 0, 'elevated': False},
                {'variable': 'bnp', 'angle': 45, 'magnitude': 0, 'elevated': False}
            ]
        elif clinical_type == "Respiratory":
            template['subjective'] = [
                {'variable': 'cough', 'angle': 0, 'magnitude': 0, 'confidence': 0},
                {'variable': 'dyspnea', 'angle': 60, 'magnitude': 0, 'confidence': 0},
                {'variable': 'sputum', 'angle': 120, 'magnitude': 0, 'confidence': 0}
            ]
            template['vitals'] = [
                {'variable': 'respiratory_rate', 'angle': 0, 'magnitude': 0, 'range': {'min': 0, 'max': 0}},
                {'variable': 'oxygen_saturation', 'angle': 90, 'magnitude': 0, 'range': {'min': 0, 'max': 0}}
            ]
        
        return template
    
    def create_disease_document(self, row: pd.Series) -> Dict:
        """Create Firestore document for a disease"""
        # Extract ICD code and descriptions
        icd_code = str(row.get('CODE', '')).strip()
        
        # Find description columns
        short_desc = ''
        long_desc = ''
        
        for col in row.index:
            if 'SHORT DESCRIPTION' in col:
                short_desc = str(row[col]).strip() if pd.notna(row[col]) else ''
            elif 'LONG DESCRIPTION' in col:
                long_desc = str(row[col]).strip() if pd.notna(row[col]) else ''
        
        # Use long description if available, otherwise short
        description = long_desc if long_desc else short_desc
        
        # Create document
        doc = {
            'icd10_code': icd_code,
            'short_description': short_desc,
            'description': description,
            'category': self.get_disease_category(icd_code),
            'clinical_type': self.get_clinical_type(description),
            'confidence_score': 0.0,  # Will be updated by AI processing
            'sources': [],  # Will be populated by library builder
            'complex_plane_data': self.create_complex_plane_template(icd_code, description),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'status': 'template',  # template -> processing -> completed
            'version': '2026',  # From filename
            'clinical_criteria': {
                'major_criteria': [],
                'minor_criteria': [],
                'exclusion_criteria': []
            },
            'metadata': {
                'prevalence': None,
                'age_groups': [],
                'sex_distribution': None,
                'risk_factors': [],
                'complications': [],
                'differential_diagnoses': []
            }
        }
        
        return doc
    
    def upload_batch(self, documents: List[Dict], collection_name: str = 'icd10_reference_library'):
        """Upload a batch of documents to Firestore"""
        batch = self.db.batch()
        
        for doc in documents:
            doc_ref = self.db.collection(collection_name).document(doc['icd10_code'])
            batch.set(doc_ref, doc)
        
        batch.commit()
    
    def upload_to_firestore(self, df: pd.DataFrame, batch_size: int = 500):
        """Upload all ICD10 codes to Firestore"""
        print_status(f"\nStarting upload of {len(df)} ICD10 codes to Firestore")
        
        total_uploaded = 0
        errors = 0
        batch_documents = []
        
        # Progress tracking
        print(f"\n{Colors.BOLD}Upload Progress:{Colors.ENDC}")
        
        for idx, row in df.iterrows():
            try:
                # Skip if no code
                icd_code = str(row.get('CODE', '')).strip()
                if not icd_code or pd.isna(row.get('CODE')):
                    continue
                
                # Create document
                doc = self.create_disease_document(row)
                batch_documents.append(doc)
                
                # Upload when batch is full
                if len(batch_documents) >= batch_size:
                    self.upload_batch(batch_documents)
                    total_uploaded += len(batch_documents)
                    
                    # Progress bar
                    progress = (total_uploaded / len(df)) * 100
                    bar_length = 40
                    filled_length = int(bar_length * total_uploaded // len(df))
                    bar = '█' * filled_length + '-' * (bar_length - filled_length)
                    print(f'\r{Colors.OKGREEN}Progress: |{bar}| {progress:.1f}% ({total_uploaded}/{len(df)}){Colors.ENDC}', end='')
                    
                    batch_documents = []
                
            except Exception as e:
                print_status(f"\nError processing row {idx}: {e}", "error")
                errors += 1
                continue
        
        # Upload remaining documents
        if batch_documents:
            self.upload_batch(batch_documents)
            total_uploaded += len(batch_documents)
        
        print()  # New line after progress bar
        print_status(f"Upload completed! Uploaded: {total_uploaded}, Errors: {errors}", "success")
        
        # Update statistics
        self._update_statistics(total_uploaded, errors)
    
    def _update_statistics(self, uploaded: int, errors: int):
        """Update system statistics"""
        stats_doc = {
            'total_diseases': uploaded,
            'template_count': uploaded,
            'completed_count': 0,
            'processing_count': 0,
            'error_count': errors,
            'last_updated': datetime.utcnow(),
            'version': '2026',
            'categories': list(set(self.category_map.values()))
        }
        
        self.db.collection('system_stats').document('reference_library').set(stats_doc)
        print_status("Updated system statistics", "success")
    
    def verify_upload(self, sample_size: int = 5):
        """Verify upload by checking random samples"""
        print_status(f"\nVerifying upload with {sample_size} random samples:")
        
        # Get random documents
        docs = list(self.db.collection('icd10_reference_library').limit(sample_size).stream())
        
        for doc in docs:
            data = doc.to_dict()
            print(f"\n{Colors.BOLD}ICD Code:{Colors.ENDC} {data['icd10_code']}")
            print(f"  Description: {data['description'][:80]}...")
            print(f"  Category: {data['category']}")
            print(f"  Clinical Type: {data['clinical_type']}")
            print(f"  Status: {data['status']}")

def main():
    parser = argparse.ArgumentParser(description='Upload ICD10 codes to Firestore')
    parser.add_argument('--project-id', required=True, help='Google Cloud Project ID')
    parser.add_argument('--excel-file', required=True, help='Path to ICD10 Excel file')
    parser.add_argument('--batch-size', type=int, default=500, help='Batch size for uploads')
    parser.add_argument('--verify', action='store_true', help='Verify upload after completion')
    parser.add_argument('--dry-run', action='store_true', help='Test without uploading')
    
    args = parser.parse_args()
    
    # Display header
    print(f"\n{Colors.BOLD}{Colors.HEADER}ICD-10 Reference Library Uploader{Colors.ENDC}")
    print(f"{Colors.OKBLUE}{'='*50}{Colors.ENDC}\n")
    
    # Check if file exists
    if not os.path.exists(args.excel_file):
        print_status(f"Excel file not found: {args.excel_file}", "error")
        sys.exit(1)
    
    # Set Google Cloud credentials if provided
    if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
        print_status(f"Using service account: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}", "success")
    else:
        print_status("Using default credentials", "warning")
    
    # Initialize uploader
    uploader = ICD10Uploader(args.project_id)
    
    # Read Excel file
    df = uploader.read_excel_file(args.excel_file)
    
    if args.dry_run:
        print_status("\nDRY RUN MODE - No data will be uploaded", "warning")
        
        # Show sample conversions
        print(f"\n{Colors.BOLD}Sample Document Conversions:{Colors.ENDC}")
        for i in range(min(3, len(df))):
            doc = uploader.create_disease_document(df.iloc[i])
            print(f"\n{Colors.OKCYAN}Document {i+1}:{Colors.ENDC}")
            print(f"  ICD Code: {doc['icd10_code']}")
            print(f"  Description: {doc['description'][:60]}...")
            print(f"  Category: {doc['category']}")
            print(f"  Clinical Type: {doc['clinical_type']}")
            print(f"  Complex Plane Domains: {list(doc['complex_plane_data'].keys())}")
    else:
        # Confirm upload
        print(f"\n{Colors.WARNING}Ready to upload {len(df)} ICD10 codes to Firestore{Colors.ENDC}")
        print(f"Project: {args.project_id}")
        print(f"Collection: icd10_reference_library")
        
        response = input(f"\n{Colors.BOLD}Continue with upload? (yes/no): {Colors.ENDC}")
        if response.lower() != 'yes':
            print_status("Upload cancelled", "warning")
            return
        
        # Upload to Firestore
        uploader.upload_to_firestore(df, batch_size=args.batch_size)
        
        # Verify if requested
        if args.verify:
            uploader.verify_upload()
    
    print(f"\n{Colors.OKGREEN}Process completed!{Colors.ENDC}")

if __name__ == "__main__":
    main()