#!/usr/bin/env python3
import sys
sys.path.append('..')

from initialize_reference_library import ICD10LibraryInitializer
import os

# Use the initialization script from the artifact
# This will upload your ICD10_2026.xlsx to Firestore

if __name__ == "__main__":
    project_id = os.environ.get('GCP_PROJECT_ID')
    bucket_name = f"{project_id}-diagnostic-data"
    
    initializer = ICD10LibraryInitializer(project_id, bucket_name)
    
    # Read the Excel file
    df = initializer.read_icd10_file('../resources/ICD10_2026.xlsx')
    
    # Upload to Firestore
    initializer.upload_to_firestore(df)
    
    print("ICD10 library initialized successfully!")