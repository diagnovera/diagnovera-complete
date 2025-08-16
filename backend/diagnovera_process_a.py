"""
DIAGNOVERA Process A - Automated Backend ICD-10 Library Builder
Connects to Firestore, queries medical databases, extracts 6 domains,
and builds expanded reference library with complex angular properties
"""

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud import pubmed
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass, asdict
import asyncio
import aiohttp
from datetime import datetime
import json
import re
from Bio import Entrez
from concurrent.futures import ThreadPoolExecutor
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Firestore Configuration
PROJECT_NAME = "DIAGNOVERA"
PROJECT_NUMBER = "924070815611"
PROJECT_ID = "genial-core-467800-k8"

# Initialize Firebase Admin
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {
    'projectId': PROJECT_ID,
})

db = firestore.client()

# Configure Entrez for PubMed
Entrez.email = "diagnovera@medical.ai"
Entrez.api_key = "YOUR_PUBMED_API_KEY"  # Replace with actual API key

@dataclass
class ComplexVariable:
    """Represents a clinical variable in complex plane"""
    name: str
    angle: float  # theta in radians
    magnitude: float  # expected value or presence strength
    domain: str
    subdomain: Optional[str] = None
    
    def to_complex(self) -> complex:
        """Convert to complex number representation"""
        return self.magnitude * np.exp(1j * self.angle)

@dataclass
class DomainData:
    """Container for domain-specific expected values"""
    subjective: List[ComplexVariable]
    vitals: List[ComplexVariable]
    examination: List[ComplexVariable]
    laboratory: List[ComplexVariable]
    imaging: List[ComplexVariable]
    procedures_pathology: List[ComplexVariable]

class MedicalDatabaseExtractor:
    """Extracts expected values from medical literature"""
    
    def __init__(self):
        self.angle_allocator = AngleAllocator()
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def extract_expected_values(self, icd_code: str, description: str) -> DomainData:
        """Extract 6 domains of expected values from medical literature"""
        
        # Query multiple sources concurrently
        tasks = [
            self.query_pubmed(icd_code, description),
            self.query_uptodate_simulator(icd_code, description),
            self.query_clinical_guidelines(icd_code, description)
        ]
        
        results = await asyncio.gather(*tasks)
        
        # Merge and process results
        merged_data = self.merge_medical_data(results)
        
        # Extract domain values
        return self.extract_domains(merged_data, icd_code)
    
    async def query_pubmed(self, icd_code: str, description: str) -> Dict:
        """Query PubMed for disease-specific literature"""
        try:
            # Search for articles
            search_query = f"{description} clinical features diagnosis"
            handle = Entrez.esearch(db="pubmed", term=search_query, retmax=10)
            search_results = Entrez.read(handle)
            handle.close()
            
            pmids = search_results["IdList"]
            
            if not pmids:
                return {}
            
            # Fetch article details
            handle = Entrez.efetch(db="pubmed", id=pmids, rettype="medline", retmode="text")
            records = handle.read()
            handle.close()
            
            # Extract relevant information
            extracted_data = self.parse_pubmed_records(records)
            
            return extracted_data
            
        except Exception as e:
            logger.error(f"PubMed query error for {icd_code}: {e}")
            return {}
    
    async def query_uptodate_simulator(self, icd_code: str, description: str) -> Dict:
        """Simulate UpToDate query (replace with actual API when available)"""
        # This is a simulator - replace with actual UpToDate API integration
        
        # Simulate expected clinical features based on ICD category
        category = icd_code[0]
        
        simulated_data = {
            'subjective': {
                'demographics': self.get_demographic_patterns(category),
                'chief_complaints': self.get_common_complaints(description),
                'physical_findings': self.get_examination_findings(category)
            },
            'vitals': self.get_vital_sign_ranges(category),
            'laboratory': self.get_lab_patterns(category),
            'imaging': self.get_imaging_findings(description)
        }
        
        return simulated_data
    
    def extract_domains(self, medical_data: Dict, icd_code: str) -> DomainData:
        """Extract and organize data into 6 domains with complex plane mapping"""
        
        domains = DomainData(
            subjective=[],
            vitals=[],
            examination=[],
            laboratory=[],
            imaging=[],
            procedures_pathology=[]
        )
        
        # Process subjective domain
        if 'subjective' in medical_data:
            domains.subjective = self.process_subjective_domain(medical_data['subjective'])
        
        # Process vitals domain
        if 'vitals' in medical_data:
            domains.vitals = self.process_vitals_domain(medical_data['vitals'])
        
        # Process examination domain
        if 'examination' in medical_data:
            domains.examination = self.process_examination_domain(medical_data['examination'])
        
        # Process laboratory domain
        if 'laboratory' in medical_data:
            domains.laboratory = self.process_laboratory_domain(medical_data['laboratory'])
        
        # Process imaging domain
        if 'imaging' in medical_data:
            domains.imaging = self.process_imaging_domain(medical_data['imaging'])
        
        # Process procedures/pathology domain
        if 'procedures' in medical_data:
            domains.procedures_pathology = self.process_procedures_domain(medical_data['procedures'])
        
        return domains
    
    def process_subjective_domain(self, subjective_data: Dict) -> List[ComplexVariable]:
        """Process subjective domain data into complex variables"""
        variables = []
        
        # Demographics
        if 'demographics' in subjective_data:
            for demo, value in subjective_data['demographics'].items():
                angle = self.angle_allocator.get_angle('subjective', 'demographics', demo)
                variables.append(ComplexVariable(
                    name=demo,
                    angle=angle,
                    magnitude=value.get('prevalence', 0.5),
                    domain='subjective',
                    subdomain='demographics'
                ))
        
        # Chief complaints
        if 'chief_complaints' in subjective_data:
            for complaint in subjective_data['chief_complaints']:
                angle = self.angle_allocator.get_angle('subjective', 'chief_complaints', complaint['name'])
                variables.append(ComplexVariable(
                    name=complaint['name'],
                    angle=angle,
                    magnitude=complaint.get('frequency', 0.5),
                    domain='subjective',
                    subdomain='chief_complaints'
                ))
        
        return variables
    
    def process_vitals_domain(self, vitals_data: Dict) -> List[ComplexVariable]:
        """Process vital signs into complex variables"""
        variables = []
        
        vital_signs = ['temperature', 'heart_rate', 'blood_pressure_systolic', 
                       'blood_pressure_diastolic', 'respiratory_rate', 'oxygen_saturation']
        
        for vital in vital_signs:
            if vital in vitals_data:
                angle = self.angle_allocator.get_angle('vitals', None, vital)
                # For vitals, magnitude represents typical deviation from normal
                variables.append(ComplexVariable(
                    name=vital,
                    angle=angle,
                    magnitude=vitals_data[vital].get('typical_value', 1.0),
                    domain='vitals'
                ))
        
        return variables
    
    def process_laboratory_domain(self, lab_data: Dict) -> List[ComplexVariable]:
        """Process laboratory values into complex variables"""
        variables = []
        
        for lab_test, values in lab_data.items():
            angle = self.angle_allocator.get_angle('laboratory', None, lab_test)
            variables.append(ComplexVariable(
                name=lab_test,
                angle=angle,
                magnitude=values.get('expected_abnormality', 0.5),
                domain='laboratory'
            ))
        
        return variables

class AngleAllocator:
    """Allocates unique angles for each variable in complex plane"""
    
    def __init__(self):
        self.angle_map = {}
        self.domain_base_angles = {
            'subjective': 0,
            'vitals': np.pi/3,
            'examination': 2*np.pi/3,
            'laboratory': np.pi,
            'imaging': 4*np.pi/3,
            'procedures_pathology': 5*np.pi/3
        }
        self.subdomain_offsets = {}
        
    def get_angle(self, domain: str, subdomain: Optional[str], variable: str) -> float:
        """Get unique angle for a variable"""
        key = f"{domain}:{subdomain}:{variable}"
        
        if key not in self.angle_map:
            base_angle = self.domain_base_angles[domain]
            
            # Calculate offset within domain
            domain_key = f"{domain}:{subdomain}" if subdomain else domain
            if domain_key not in self.subdomain_offsets:
                self.subdomain_offsets[domain_key] = 0
            
            offset = self.subdomain_offsets[domain_key]
            self.subdomain_offsets[domain_key] += np.pi/180  # 1 degree increments
            
            self.angle_map[key] = base_angle + offset
        
        return self.angle_map[key]

class ProcessAOrchestrator:
    """Main orchestrator for Process A - Building the reference library"""
    
    def __init__(self):
        self.extractor = MedicalDatabaseExtractor()
        self.batch_size = 50
        
    async def build_reference_library(self):
        """Main process to build the expanded ICD-10 reference library"""
        logger.info(f"Starting Process A for project {PROJECT_NAME}")
        
        try:
            # Read existing ICD-10 data from Firestore
            icd_collection = db.collection('icd10_2026')
            icd_docs = icd_collection.stream()
            
            icd_records = []
            for doc in icd_docs:
                data = doc.to_dict()
                data['id'] = doc.id
                icd_records.append(data)
            
            logger.info(f"Found {len(icd_records)} ICD-10 records to process")
            
            # Process in batches
            async with self.extractor as extractor:
                for i in range(0, len(icd_records), self.batch_size):
                    batch = icd_records[i:i + self.batch_size]
                    await self.process_batch(batch, extractor)
                    
                    # Progress update
                    progress = min(100, (i + self.batch_size) / len(icd_records) * 100)
                    logger.info(f"Progress: {progress:.1f}% complete")
                    
                    # Rate limiting
                    await asyncio.sleep(2)
            
            logger.info("Process A completed successfully!")
            
        except Exception as e:
            logger.error(f"Error in Process A: {e}")
            raise
    
    async def process_batch(self, batch: List[Dict], extractor: MedicalDatabaseExtractor):
        """Process a batch of ICD codes"""
        tasks = []
        
        for record in batch:
            task = self.process_single_icd(record, extractor)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Store successful results
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error processing {batch[i]['CODE']}: {result}")
            else:
                await self.store_expanded_record(result)
    
    async def process_single_icd(self, icd_record: Dict, extractor: MedicalDatabaseExtractor) -> Dict:
        """Process single ICD code to extract domains and build expanded record"""
        
        icd_code = icd_record.get('CODE', '')
        description = icd_record.get('LONG DESCRIPTION (VALID ICD-10 FY2022)', '')
        
        logger.info(f"Processing {icd_code}: {description[:50]}...")
        
        # Extract expected values from medical literature
        domain_data = await extractor.extract_expected_values(icd_code, description)
        
        # Build expanded record
        expanded_record = {
            'icd10_code': icd_code,
            'short_description': icd_record.get('SHORT DESCRIPTION (VALID ICD-10 FY2022)', ''),
            'long_description': description,
            'original_data': icd_record,
            'complex_plane_data': {
                'subjective': [asdict(var) for var in domain_data.subjective],
                'vitals': [asdict(var) for var in domain_data.vitals],
                'examination': [asdict(var) for var in domain_data.examination],
                'laboratory': [asdict(var) for var in domain_data.laboratory],
                'imaging': [asdict(var) for var in domain_data.imaging],
                'procedures_pathology': [asdict(var) for var in domain_data.procedures_pathology]
            },
            'metadata': {
                'processed_timestamp': datetime.utcnow().isoformat(),
                'version': '1.0',
                'extraction_sources': ['pubmed', 'uptodate_simulator', 'clinical_guidelines']
            }
        }
        
        return expanded_record
    
    async def store_expanded_record(self, record: Dict):
        """Store expanded record in new Firestore collection"""
        try:
            collection = db.collection('icd10_expanded_reference_library')
            doc_ref = collection.document(record['icd10_code'])
            doc_ref.set(record)
            logger.info(f"Stored expanded record for {record['icd10_code']}")
        except Exception as e:
            logger.error(f"Error storing record {record['icd10_code']}: {e}")

def main():
    """Main entry point for Process A"""
    orchestrator = ProcessAOrchestrator()
    asyncio.run(orchestrator.build_reference_library())

if __name__ == "__main__":
    main()