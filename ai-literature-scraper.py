"""
AI-Powered Medical Literature Scraper
Builds the ICD-10 reference library (Process A) by searching medical literature
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import numpy as np
from datetime import datetime

# AI and NLP imports
from transformers import AutoTokenizer, AutoModelForTokenClassification
from transformers import pipeline
import torch
from sentence_transformers import SentenceTransformer
import openai
from langchain.llms import VertexAI
from langchain.embeddings import VertexAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.document_loaders import PyPDFLoader, JSONLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Medical NLP specific
import scispacy
import spacy
from negspacy.negation import Negex
from medcat import CAT

# Web scraping and APIs
import aiohttp
import requests
from bs4 import BeautifulSoup
from scholarly import scholarly
import pubmed_parser as pp
from Bio import Entrez

# Google Cloud
from google.cloud import aiplatform
from google.cloud import storage
from google.cloud import firestore
from google.cloud import tasks_v2

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
db = firestore.Client()
storage_client = storage.Client()
nlp = spacy.load("en_ner_bc5cdr_md")  # BioBERT-based NER model
nlp.add_pipe("negex")

@dataclass
class MedicalConcept:
    """Represents a medical concept extracted from literature"""
    name: str
    category: str  # symptom, sign, lab_value, imaging_finding, etc.
    value: Any
    negated: bool
    confidence: float
    source: str
    context: str

@dataclass
class DiseaseProfile:
    """Complete disease profile from literature"""
    icd10_code: str
    disease_name: str
    subjective_features: List[MedicalConcept]
    vital_ranges: Dict[str, Dict[str, float]]  # {"temperature": {"min": 37.5, "max": 39.0}}
    examination_findings: List[MedicalConcept]
    laboratory_values: Dict[str, Dict[str, Any]]
    imaging_findings: List[MedicalConcept]
    procedures: List[MedicalConcept]
    sources: List[str]
    confidence_score: float

class MedicalLiteratureAI:
    """AI agent for searching and extracting medical knowledge"""
    
    def __init__(self, project_id: str):
        self.project_id = project_id
        
        # Initialize AI models
        self.vertex_llm = VertexAI(
            model_name="gemini-pro",
            project=project_id,
            location="us-central1",
            max_output_tokens=2048,
            temperature=0.1  # Low temperature for factual extraction
        )
        
        # Medical embedding model
        self.embeddings = SentenceTransformer('pritamdeka/BioBERT-mnli-snli-scinli-scitail-mednli-stsb')
        
        # Configure medical literature APIs
        Entrez.email = "your-email@example.com"
        self.pubmed_api_key = "your-pubmed-api-key"
        
        # Knowledge graph for relationships
        self.knowledge_graph = {}
        
    async def search_medical_literature(self, disease_name: str, icd10_code: str) -> List[Dict]:
        """Search multiple medical databases for disease information"""
        sources = []
        
        # Search strategies
        search_tasks = [
            self._search_pubmed(disease_name, icd10_code),
            self._search_medical_textbooks(disease_name),
            self._search_clinical_guidelines(disease_name),
            self._search_medical_databases(disease_name),
            self._search_scholarly_articles(disease_name)
        ]
        
        # Execute searches concurrently
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Search error: {result}")
            else:
                sources.extend(result)
        
        return sources
    
    async def _search_pubmed(self, disease_name: str, icd10_code: str) -> List[Dict]:
        """Search PubMed for relevant articles"""
        try:
            # Construct sophisticated query
            query = f"""
            ("{disease_name}"[Title/Abstract] OR "{icd10_code}"[All Fields]) 
            AND ("diagnosis"[Title/Abstract] OR "clinical features"[Title/Abstract] 
            OR "symptoms"[Title/Abstract] OR "laboratory"[Title/Abstract] 
            OR "imaging"[Title/Abstract] OR "vital signs"[Title/Abstract])
            AND ("systematic review"[Publication Type] OR "meta-analysis"[Publication Type] 
            OR "clinical trial"[Publication Type] OR "guideline"[Publication Type])
            """
            
            # Search PubMed
            handle = Entrez.esearch(
                db="pubmed",
                term=query,
                retmax=50,
                sort="relevance",
                api_key=self.pubmed_api_key
            )
            record = Entrez.read(handle)
            handle.close()
            
            # Fetch full articles
            id_list = record["IdList"]
            articles = []
            
            if id_list:
                handle = Entrez.efetch(
                    db="pubmed",
                    id=id_list,
                    rettype="medline",
                    retmode="text"
                )
                medline_records = handle.read()
                handle.close()
                
                # Parse MEDLINE format
                for article in pp.parse_medline_str(medline_records):
                    articles.append({
                        "title": article.get("title", ""),
                        "abstract": article.get("abstract", ""),
                        "pmid": article.get("pmid", ""),
                        "journal": article.get("journal", ""),
                        "year": article.get("year", ""),
                        "source": "pubmed",
                        "relevance_score": self._calculate_relevance(
                            article.get("abstract", ""), disease_name
                        )
                    })
            
            return sorted(articles, key=lambda x: x["relevance_score"], reverse=True)[:20]
            
        except Exception as e:
            logger.error(f"PubMed search error: {e}")
            return []
    
    async def _search_medical_textbooks(self, disease_name: str) -> List[Dict]:
        """Search medical textbooks and reference materials"""
        textbook_sources = []
        
        # Simulate access to medical textbook APIs
        # In production, this would connect to actual textbook databases
        textbook_queries = [
            f"Harrison's Internal Medicine {disease_name}",
            f"Cecil Medicine {disease_name}",
            f"UpToDate {disease_name}",
            f"Merck Manual {disease_name}"
        ]
        
        # Use LLM to extract structured information
        for query in textbook_queries:
            prompt = f"""
            Extract clinical information about {disease_name} including:
            1. Typical symptoms and signs
            2. Vital sign ranges
            3. Common laboratory findings
            4. Typical imaging findings
            5. Diagnostic procedures
            
            Format as structured JSON with specific values and ranges.
            """
            
            try:
                response = self.vertex_llm.predict(prompt)
                textbook_sources.append({
                    "source": query,
                    "content": response,
                    "type": "textbook"
                })
            except Exception as e:
                logger.error(f"Textbook search error: {e}")
        
        return textbook_sources
    
    def _calculate_relevance(self, text: str, disease_name: str) -> float:
        """Calculate relevance score using semantic similarity"""
        if not text:
            return 0.0
        
        # Encode texts
        disease_embedding = self.embeddings.encode(disease_name)
        text_embedding = self.embeddings.encode(text[:1000])  # First 1000 chars
        
        # Cosine similarity
        similarity = np.dot(disease_embedding, text_embedding) / (
            np.linalg.norm(disease_embedding) * np.linalg.norm(text_embedding)
        )
        
        return float(similarity)
    
    def extract_medical_concepts(self, text: str, source: str) -> List[MedicalConcept]:
        """Extract medical concepts from text using NLP"""
        concepts = []
        
        # Process with scispaCy
        doc = nlp(text)
        
        # Extract entities
        for ent in doc.ents:
            # Check for negation
            negated = any(
                token._.negex for token in ent 
                if hasattr(token._, 'negex')
            )
            
            concept = MedicalConcept(
                name=ent.text,
                category=self._categorize_entity(ent.label_),
                value=1 if not negated else 0,
                negated=negated,
                confidence=0.8,  # Placeholder
                source=source,
                context=ent.sent.text
            )
            concepts.append(concept)
        
        return concepts
    
    def _categorize_entity(self, label: str) -> str:
        """Categorize medical entity by type"""
        category_map = {
            "DISEASE": "diagnosis",
            "SYMPTOM": "symptom",
            "SIGN": "sign",
            "CHEMICAL": "laboratory",
            "TREATMENT": "procedure",
            "TEST": "laboratory",
            "ANATOMY": "examination"
        }
        return category_map.get(label, "other")
    
    async def build_disease_profile(self, disease_name: str, icd10_code: str) -> DiseaseProfile:
        """Build comprehensive disease profile from literature"""
        logger.info(f"Building profile for {icd10_code}: {disease_name}")
        
        # Search literature
        sources = await self.search_medical_literature(disease_name, icd10_code)
        
        # Extract concepts from all sources
        all_concepts = []
        source_urls = []
        
        for source in sources:
            content = source.get("abstract") or source.get("content", "")
            if content:
                concepts = self.extract_medical_concepts(content, source.get("source", ""))
                all_concepts.extend(concepts)
                source_urls.append(source.get("pmid") or source.get("source"))
        
        # Organize by domain
        subjective_features = [c for c in all_concepts if c.category in ["symptom", "sign"]]
        examination_findings = [c for c in all_concepts if c.category == "examination"]
        laboratory_concepts = [c for c in all_concepts if c.category == "laboratory"]
        imaging_findings = [c for c in all_concepts if c.category == "imaging"]
        procedures = [c for c in all_concepts if c.category == "procedure"]
        
        # Extract vital signs using LLM
        vital_ranges = await self._extract_vital_ranges(sources, disease_name)
        
        # Extract laboratory values
        lab_values = await self._extract_lab_values(laboratory_concepts, disease_name)
        
        # Calculate confidence score
        confidence = self._calculate_profile_confidence(all_concepts, sources)
        
        return DiseaseProfile(
            icd10_code=icd10_code,
            disease_name=disease_name,
            subjective_features=subjective_features,
            vital_ranges=vital_ranges,
            examination_findings=examination_findings,
            laboratory_values=lab_values,
            imaging_findings=imaging_findings,
            procedures=procedures,
            sources=source_urls[:10],  # Top 10 sources
            confidence_score=confidence
        )
    
    async def _extract_vital_ranges(self, sources: List[Dict], disease_name: str) -> Dict:
        """Extract vital sign ranges using LLM"""
        # Combine relevant source texts
        combined_text = "\n\n".join([
            s.get("abstract", s.get("content", ""))[:500] 
            for s in sources[:5]
        ])
        
        prompt = f"""
        Based on medical literature about {disease_name}, extract typical vital sign ranges:
        
        {combined_text}
        
        Return a JSON object with the following structure:
        {{
            "temperature": {{"min": null, "max": null, "typical": null}},
            "heart_rate": {{"min": null, "max": null, "typical": null}},
            "blood_pressure_systolic": {{"min": null, "max": null, "typical": null}},
            "blood_pressure_diastolic": {{"min": null, "max": null, "typical": null}},
            "respiratory_rate": {{"min": null, "max": null, "typical": null}},
            "oxygen_saturation": {{"min": null, "max": null, "typical": null}}
        }}
        
        Use null for unknown values. Include units.
        """
        
        try:
            response = self.vertex_llm.predict(prompt)
            return json.loads(response)
        except Exception as e:
            logger.error(f"Error extracting vitals: {e}")
            return {}
    
    async def _extract_lab_values(self, lab_concepts: List[MedicalConcept], 
                                 disease_name: str) -> Dict:
        """Extract laboratory value ranges"""
        lab_values = {}
        
        # Group similar lab tests
        lab_groups = {}
        for concept in lab_concepts:
            test_name = self._normalize_lab_name(concept.name)
            if test_name not in lab_groups:
                lab_groups[test_name] = []
            lab_groups[test_name].append(concept)
        
        # Extract ranges for each test
        for test_name, concepts in lab_groups.items():
            contexts = [c.context for c in concepts[:3]]
            
            prompt = f"""
            Extract laboratory value information for {test_name} in {disease_name}:
            
            Contexts:
            {' '.join(contexts)}
            
            Return JSON: {{"range": {{"min": null, "max": null}}, "unit": "", "typical": null}}
            """
            
            try:
                response = self.vertex_llm.predict(prompt)
                lab_values[test_name] = json.loads(response)
            except:
                lab_values[test_name] = {"present": True}
        
        return lab_values
    
    def _normalize_lab_name(self, name: str) -> str:
        """Normalize laboratory test names"""
        # Map variations to standard names
        normalizations = {
            "wbc": "white_blood_cell_count",
            "white blood cell": "white_blood_cell_count",
            "hemoglobin": "hemoglobin",
            "hgb": "hemoglobin",
            "glucose": "blood_glucose",
            "sugar": "blood_glucose",
            # Add more mappings
        }
        
        name_lower = name.lower()
        for variant, standard in normalizations.items():
            if variant in name_lower:
                return standard
        
        return name.lower().replace(" ", "_")
    
    def _calculate_profile_confidence(self, concepts: List[MedicalConcept], 
                                    sources: List[Dict]) -> float:
        """Calculate confidence score for the disease profile"""
        # Factors:
        # 1. Number of high-quality sources
        # 2. Consistency of findings
        # 3. Source reliability scores
        
        source_score = min(len(sources) / 10, 1.0) * 0.3
        concept_score = min(len(concepts) / 50, 1.0) * 0.3
        
        # Average relevance of top sources
        relevance_scores = [s.get("relevance_score", 0.5) for s in sources[:5]]
        avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.5
        relevance_score = avg_relevance * 0.4
        
        return source_score + concept_score + relevance_score

class ReferenceLibraryBuilder:
    """Orchestrates the building of the ICD-10 reference library"""
    
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.ai_agent = MedicalLiteratureAI(project_id)
        self.db = firestore.Client()
        self.storage = storage.Client()
        
    async def build_library_from_icd10_file(self, file_path: str):
        """Build complete reference library from ICD10 file"""
        import pandas as pd
        
        # Load ICD10 codes
        df = pd.read_excel(file_path)
        
        # Process in batches
        batch_size = 10
        for i in range(0, len(df), batch_size):
            batch = df.iloc[i:i+batch_size]
            
            tasks = []
            for _, row in batch.iterrows():
                icd10_code = row.get('code', '')
                disease_name = row.get('description', '')
                
                if icd10_code and disease_name:
                    tasks.append(self.process_disease(icd10_code, disease_name))
            
            # Process batch concurrently
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # Add delay to respect rate limits
            await asyncio.sleep(2)
    
    async def process_disease(self, icd10_code: str, disease_name: str):
        """Process single disease and store in database"""
        try:
            # Check if already processed
            doc_ref = self.db.collection('icd10_diseases').document(icd10_code)
            doc = doc_ref.get()
            
            if doc.exists and doc.to_dict().get('status') == 'completed':
                logger.info(f"Skipping {icd10_code} - already processed")
                return
            
            # Build disease profile
            profile = await self.ai_agent.build_disease_profile(disease_name, icd10_code)
            
            # Convert to complex plane representation
            complex_representation = self._convert_to_complex_plane(profile)
            
            # Store in Firestore
            doc_ref.set({
                'icd10_code': icd10_code,
                'description': disease_name,
                'domains': complex_representation,
                'sources': profile.sources,
                'confidence_score': profile.confidence_score,
                'status': 'completed',
                'processed_at': firestore.SERVER_TIMESTAMP,
                'profile_data': {
                    'vital_ranges': profile.vital_ranges,
                    'laboratory_values': profile.laboratory_values,
                    'subjective_count': len(profile.subjective_features),
                    'examination_count': len(profile.examination_findings)
                }
            })
            
            logger.info(f"Successfully processed {icd10_code}: {disease_name}")
            
        except Exception as e:
            logger.error(f"Error processing {icd10_code}: {e}")
            
            # Mark as failed
            doc_ref.set({
                'icd10_code': icd10_code,
                'description': disease_name,
                'status': 'failed',
                'error': str(e),
                'processed_at': firestore.SERVER_TIMESTAMP
            }, merge=True)
    
    def _convert_to_complex_plane(self, profile: DiseaseProfile) -> Dict[str, List[Dict]]:
        """Convert disease profile to complex plane representation"""
        domains = {}
        
        # Subjective domain
        subjective_vars = []
        angle = 0
        angle_increment = 2 * np.pi / max(len(profile.subjective_features), 100)
        
        for feature in profile.subjective_features:
            subjective_vars.append({
                'name': feature.name,
                'angle': angle,
                'value': 0 if feature.negated else 1,
                'confidence': feature.confidence
            })
            angle += angle_increment
        
        domains['subjective'] = subjective_vars
        
        # Vitals domain - fixed angles
        vitals_vars = []
        vital_angles = {
            'temperature': 0,
            'heart_rate': np.pi / 3,
            'blood_pressure_systolic': 2 * np.pi / 3,
            'blood_pressure_diastolic': np.pi,
            'respiratory_rate': 4 * np.pi / 3,
            'oxygen_saturation': 5 * np.pi / 3
        }
        
        for vital, angle in vital_angles.items():
            if vital in profile.vital_ranges:
                ranges = profile.vital_ranges[vital]
                # Use typical value if available, otherwise midpoint
                if ranges.get('typical'):
                    value = ranges['typical']
                elif ranges.get('min') and ranges.get('max'):
                    value = (ranges['min'] + ranges['max']) / 2
                else:
                    continue
                    
                vitals_vars.append({
                    'name': vital,
                    'angle': angle,
                    'value': value,
                    'range': ranges
                })
        
        domains['vitals'] = vitals_vars
        
        # Laboratory domain
        lab_vars = []
        angle = 0
        angle_increment = 2 * np.pi / max(len(profile.laboratory_values), 50)
        
        for lab_name, lab_data in profile.laboratory_values.items():
            lab_vars.append({
                'name': lab_name,
                'angle': angle,
                'value': 1,  # Presence indicator
                'data': lab_data
            })
            angle += angle_increment
        
        domains['laboratory'] = lab_vars
        
        # Similar conversion for other domains
        domains['examination'] = self._convert_concepts_to_complex(profile.examination_findings)
        domains['imaging'] = self._convert_concepts_to_complex(profile.imaging_findings)
        domains['procedures'] = self._convert_concepts_to_complex(profile.procedures)
        
        return domains
    
    def _convert_concepts_to_complex(self, concepts: List[MedicalConcept]) -> List[Dict]:
        """Convert list of concepts to complex representation"""
        vars_list = []
        angle = 0
        angle_increment = 2 * np.pi / max(len(concepts), 50)
        
        for concept in concepts:
            vars_list.append({
                'name': concept.name,
                'angle': angle,
                'value': 0 if concept.negated else 1,
                'confidence': concept.confidence
            })
            angle += angle_increment
        
        return vars_list

# Cloud Function entry point
async def process_disease_batch(request):
    """Cloud Function to process a batch of diseases"""
    request_json = request.get_json()
    
    if not request_json or 'diseases' not in request_json:
        return {'error': 'No diseases provided'}, 400
    
    project_id = os.environ.get('GCP_PROJECT')
    builder = ReferenceLibraryBuilder(project_id)
    
    results = []
    for disease in request_json['diseases']:
        try:
            await builder.process_disease(
                disease['icd10_code'],
                disease['disease_name']
            )
            results.append({
                'icd10_code': disease['icd10_code'],
                'status': 'success'
            })
        except Exception as e:
            results.append({
                'icd10_code': disease['icd10_code'],
                'status': 'error',
                'error': str(e)
            })
    
    return {'results': results}

if __name__ == "__main__":
    # Example usage
    async def main():
        builder = ReferenceLibraryBuilder("your-project-id")
        await builder.build_library_from_icd10_file("Section111ValidICD10Jan2022.xlsx")
    
    asyncio.run(main())