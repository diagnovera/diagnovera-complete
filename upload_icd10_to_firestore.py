#!/usr/bin/env python3
"""
upload_icd10_to_firestore.py
Uploads ICD10 codes from Excel to Firestore for DIAGNOVERA
"""

import pandas as pd
import os
import sys
import argparse
from datetime import datetime

# Set up environment
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'diagnovera-sa-key.json'

try:
    from google.cloud import firestore
    print("✓ Google Cloud Firestore imported successfully")
except ImportError:
    print("✗ Installing required packages...")
    os.system(f"{sys.executable} -m pip install google-cloud-firestore pandas openpyxl")
    from google.cloud import firestore

class ICD10Uploader:
    def __init__(self, project_id):
        self.project_id = project_id
        try:
            self.db = firestore.Client(project=project_id)
            print(f"✓ Connected to Firestore project: {project_id}")
        except Exception as e:
            print(f"✗ Failed to connect: {e}")
            sys.exit(1)
    
    def read_excel(self, filepath):
        """Read ICD10 Excel file"""
        print(f"\nReading Excel file: {filepath}")
        try:
            df = pd.read_excel(filepath)
            print(f"✓ Loaded {len(df)} ICD10 codes")
            print(f"Columns: {list(df.columns)[:5]}...")  # Show first 5 columns
            return df
        except Exception as e:
            print(f"✗ Error reading file: {e}")
            sys.exit(1)
    
    def upload_to_firestore(self, df):
        """Upload ICD10 codes to Firestore"""
        print(f"\nUploading {len(df)} codes to Firestore...")
        
        collection = self.db.collection('icd10_reference_library')
        batch = self.db.batch()
        batch_count = 0
        total_uploaded = 0
        
        for idx, row in df.iterrows():
            try:
                # Get ICD code
                icd_code = str(row.get('CODE', '')).strip()
                if not icd_code:
                    continue
                
                # Get descriptions
                short_desc = ''
                long_desc = ''
                
                for col in df.columns:
                    if 'SHORT' in col.upper():
                        short_desc = str(row[col])[:100] if pd.notna(row[col]) else ''
                    elif 'LONG' in col.upper() or 'DESCRIPTION' in col.upper():
                        long_desc = str(row[col]) if pd.notna(row[col]) else ''
                
                # Create document
                doc_data = {
                    'icd10_code': icd_code,
                    'short_description': short_desc,
                    'description': long_desc or short_desc,
                    'category': self._get_category(icd_code),
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                    'status': 'active',
                    'complex_plane_data': {
                        'subjective': [],
                        'vitals': [],
                        'examination': [],
                        'laboratory': [],
                        'imaging': [],
                        'procedures': []
                    }
                }
                
                # Add to batch
                doc_ref = collection.document(icd_code)
                batch.set(doc_ref, doc_data)
                batch_count += 1
                
                # Commit batch every 400 documents
                if batch_count >= 400:
                    batch.commit()
                    total_uploaded += batch_count
                    print(f"  Uploaded {total_uploaded}/{len(df)} codes...")
                    batch = self.db.batch()
                    batch_count = 0
                    
            except Exception as e:
                print(f"  Error with code {icd_code}: {e}")
                continue
        
        # Commit remaining
        if batch_count > 0:
            batch.commit()
            total_uploaded += batch_count
        
        print(f"\n✓ Successfully uploaded {total_uploaded} ICD10 codes!")
        
        # Update statistics
        self._update_stats(total_uploaded)
    
    def _get_category(self, icd_code):
        """Get category from ICD code"""
        if not icd_code:
            return "Other"
        
        categories = {
            'A': 'Infectious diseases', 'B': 'Infectious diseases',
            'C': 'Neoplasms', 'D': 'Blood diseases',
            'E': 'Endocrine', 'F': 'Mental disorders',
            'G': 'Nervous system', 'H': 'Eye and ear',
            'I': 'Circulatory system', 'J': 'Respiratory system',
            'K': 'Digestive system', 'L': 'Skin diseases',
            'M': 'Musculoskeletal', 'N': 'Genitourinary',
            'O': 'Pregnancy', 'P': 'Perinatal',
            'Q': 'Congenital', 'R': 'Symptoms',
            'S': 'Injury', 'T': 'Injury',
            'V': 'External causes', 'W': 'External causes',
            'X': 'External causes', 'Y': 'External causes',
            'Z': 'Health factors'
        }
        
        return categories.get(icd_code[0].upper(), 'Other')
    
    def _update_stats(self, count):
        """Update system statistics"""
        stats_ref = self.db.collection('system_stats').document('icd10_library')
        stats_ref.set({
            'total_codes': count,
            'last_updated': datetime.utcnow(),
            'status': 'active',
            'version': 'ICD10-2026'
        })
        print("✓ Updated system statistics")
    
    def verify_upload(self):
        """Verify the upload"""
        print("\nVerifying upload...")
        
        # Count documents
        docs = self.db.collection('icd10_reference_library').limit(5).stream()
        
        print("\nSample uploaded codes:")
        for doc in docs:
            data = doc.to_dict()
            print(f"  {data['icd10_code']}: {data['description'][:60]}...")
        
        # Get total count
        stats = self.db.collection('system_stats').document('icd10_library').get()
        if stats.exists:
            total = stats.to_dict().get('total_codes', 0)
            print(f"\nTotal codes in database: {total}")

def main():
    parser = argparse.ArgumentParser(description='Upload ICD10 codes to Firestore')
    parser.add_argument('--project-id', required=True, help='Google Cloud Project ID')
    parser.add_argument('--excel-file', required=True, help='Path to ICD10 Excel file')
    parser.add_argument('--verify', action='store_true', help='Verify after upload')
    
    args = parser.parse_args()
    
    # Check if service account key exists
    if not os.path.exists('diagnovera-sa-key.json'):
        print("✗ Service account key not found: diagnovera-sa-key.json")
        print("Please download it from Google Cloud Console")
        sys.exit(1)
    
    # Check if Excel file exists
    if not os.path.exists(args.excel_file):
        print(f"✗ Excel file not found: {args.excel_file}")
        sys.exit(1)
    
    # Create uploader and run
    uploader = ICD10Uploader(args.project_id)
    df = uploader.read_excel(args.excel_file)
    
    # Confirm upload
    print(f"\nReady to upload {len(df)} ICD10 codes to project: {args.project_id}")
    response = input("Continue? (yes/no): ")
    
    if response.lower() == 'yes':
        uploader.upload_to_firestore(df)
        
        if args.verify:
            uploader.verify_upload()
    else:
        print("Upload cancelled")

if __name__ == "__main__":
    main()