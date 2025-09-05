"""
Medical Diagnostic System Architecture
Based on complex domain analysis and ICD-10 disease matching
"""

import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
import pandas as pd
from abc import ABC, abstractmethod

# Domain Enumerations
class DomainType(Enum):
    SUBJECTIVE = "subjective"
    VITALS = "vitals"
    EXAMINATION = "examination"
    LABORATORY = "laboratory"
    IMAGING = "imaging"
    PROCEDURES_PATHOLOGY = "procedures_pathology"

class SubjectiveDomain(Enum):
    DEMOGRAPHICS = "demographics"
    CHIEF_COMPLAINTS = "chief_complaints"
    HISTORY_PRESENT_ILLNESS = "history_present_illness"
    PAST_MEDICAL_HISTORY = "past_medical_history"
    MEDICATIONS = "medications"
    ALLERGIES = "allergies"

# Data Structures
@dataclass
class ComplexVariable:
    """Represents a variable in complex plane with angle and value"""
    name: str
    angle: float  # theta in radians
    value: complex  # placeholder value (0 or 1 for categorical, actual value for numerical)
    domain: DomainType
    
    def to_complex(self) -> complex:
        """Convert to complex number representation"""
        return self.value * np.exp(1j * self.angle)

@dataclass
class DomainData:
    """Container for domain-specific data"""
    domain_type: DomainType
    variables: List[ComplexVariable]
    
    def to_complex_array(self) -> np.ndarray:
        """Convert all variables to complex array"""
        return np.array([var.to_complex() for var in self.variables])

@dataclass
class PatientEncounter:
    """Represents a single patient encounter (Process B)"""
    encounter_id: str
    domains: Dict[DomainType, DomainData]
    timestamp: str
    
    def get_feature_vector(self) -> np.ndarray:
        """Extract complete feature vector from all domains"""
        features = []
        for domain in DomainType:
            if domain in self.domains:
                features.extend(self.domains[domain].to_complex_array())
        return np.array(features)

@dataclass
class ICD10Disease:
    """Represents a disease in the reference library (Process A)"""
    icd10_code: str
    description: str
    domains: Dict[DomainType, DomainData]
    
    def get_reference_vector(self) -> np.ndarray:
        """Extract reference feature vector"""
        features = []
        for domain in DomainType:
            if domain in self.domains:
                features.extend(self.domains[domain].to_complex_array())
        return np.array(features)

# Abstract Base Classes for Processors
class DomainProcessor(ABC):
    """Abstract base class for domain-specific processors"""
    
    @abstractmethod
    def process(self, raw_data: Any) -> DomainData:
        """Process raw data into domain-specific format"""
        pass
    
    @abstractmethod
    def assign_angles(self, variables: List[str]) -> Dict[str, float]:
        """Assign angles to variables in complex plane"""
        pass

class NLPProcessor:
    """Natural Language Processing for text domains"""
    
    def extract_variables(self, text: str) -> Dict[str, int]:
        """Extract variables from text and assign presence/absence"""
        # Placeholder for NLP implementation
        # Would use spaCy, BioBERT, or similar medical NLP models
        variables = {}
        # Extract medical entities and assign 1 for presence, 0 for absence
        return variables
    
    def process_negation(self, text: str) -> Dict[str, int]:
        """Handle negation detection in medical text"""
        # Detect phrases like "no fever", "denies chest pain", etc.
        pass

# Domain-Specific Processors
class SubjectiveDomainProcessor(DomainProcessor):
    """Process subjective domain data"""
    
    def __init__(self):
        self.nlp_processor = NLPProcessor()
        self.angle_assignments = {}
        self._initialize_angles()
    
    def _initialize_angles(self):
        """Initialize angle assignments for common subjective variables"""
        # Distribute angles evenly across 2π for each subdomain
        base_angle = 0
        angle_increment = 2 * np.pi / 1000  # Assuming ~1000 possible variables
        
        # This would be populated from medical ontologies
        self.angle_assignments = {
            "age": base_angle,
            "sex": base_angle + angle_increment,
            "fever": base_angle + 2 * angle_increment,
            "cough": base_angle + 3 * angle_increment,
            # ... more variables
        }
    
    def process(self, raw_data: Dict[str, Any]) -> DomainData:
        """Process subjective domain data"""
        variables = []
        
        # Process demographics (numerical)
        if "age" in raw_data:
            variables.append(ComplexVariable(
                name="age",
                angle=self.angle_assignments["age"],
                value=complex(raw_data["age"] / 100.0),  # Normalize age
                domain=DomainType.SUBJECTIVE
            ))
        
        # Process text fields with NLP
        for field in ["chief_complaint", "hpi", "pmh"]:
            if field in raw_data:
                extracted = self.nlp_processor.extract_variables(raw_data[field])
                for var_name, presence in extracted.items():
                    if var_name in self.angle_assignments:
                        variables.append(ComplexVariable(
                            name=var_name,
                            angle=self.angle_assignments[var_name],
                            value=complex(presence),
                            domain=DomainType.SUBJECTIVE
                        ))
        
        return DomainData(DomainType.SUBJECTIVE, variables)
    
    def assign_angles(self, variables: List[str]) -> Dict[str, float]:
        """Assign angles to new variables"""
        new_assignments = {}
        max_angle = max(self.angle_assignments.values()) if self.angle_assignments else 0
        angle_increment = 2 * np.pi / 1000
        
        for var in variables:
            if var not in self.angle_assignments:
                max_angle += angle_increment
                new_assignments[var] = max_angle
                self.angle_assignments[var] = max_angle
        
        return new_assignments

class VitalsDomainProcessor(DomainProcessor):
    """Process vital signs domain data"""
    
    def __init__(self):
        self.vital_angles = {
            "temperature": 0,
            "heart_rate": np.pi / 3,
            "bp_systolic": 2 * np.pi / 3,
            "bp_diastolic": np.pi,
            "oxygen_saturation": 4 * np.pi / 3,
            "respiratory_rate": 5 * np.pi / 3
        }
        self.normalization_factors = {
            "temperature": (35, 42),  # min, max for normalization
            "heart_rate": (40, 200),
            "bp_systolic": (70, 200),
            "bp_diastolic": (40, 120),
            "oxygen_saturation": (70, 100),
            "respiratory_rate": (8, 40)
        }
    
    def process(self, raw_data: Dict[str, float]) -> DomainData:
        """Process vital signs data"""
        variables = []
        
        for vital, value in raw_data.items():
            if vital in self.vital_angles:
                # Normalize value to [0, 1]
                min_val, max_val = self.normalization_factors[vital]
                normalized = (value - min_val) / (max_val - min_val)
                normalized = max(0, min(1, normalized))  # Clamp to [0, 1]
                
                variables.append(ComplexVariable(
                    name=vital,
                    angle=self.vital_angles[vital],
                    value=complex(normalized),
                    domain=DomainType.VITALS
                ))
        
        return DomainData(DomainType.VITALS, variables)
    
    def assign_angles(self, variables: List[str]) -> Dict[str, float]:
        """Vitals have fixed angles"""
        return self.vital_angles

# Probabilistic Analysis Modules
class BayesianAnalyzer:
    """Bayesian probability analysis for disease matching"""
    
    def __init__(self, disease_library: List[ICD10Disease]):
        self.disease_library = disease_library
        self.prior_probabilities = self._calculate_priors()
    
    def _calculate_priors(self) -> Dict[str, float]:
        """Calculate prior probabilities for diseases"""
        # In real implementation, would use epidemiological data
        # For now, uniform priors
        n_diseases = len(self.disease_library)
        return {disease.icd10_code: 1.0 / n_diseases for disease in self.disease_library}
    
    def calculate_likelihood(self, patient_vector: np.ndarray, 
                           disease_vector: np.ndarray) -> float:
        """Calculate likelihood P(symptoms|disease)"""
        # Complex number similarity in high-dimensional space
        # Using cosine similarity of complex vectors
        dot_product = np.sum(patient_vector * np.conj(disease_vector))
        norm_patient = np.linalg.norm(patient_vector)
        norm_disease = np.linalg.norm(disease_vector)
        
        if norm_patient == 0 or norm_disease == 0:
            return 0.0
        
        similarity = np.abs(dot_product) / (norm_patient * norm_disease)
        return similarity
    
    def get_posterior_probabilities(self, patient_encounter: PatientEncounter) -> Dict[str, float]:
        """Calculate posterior probabilities for all diseases"""
        patient_vector = patient_encounter.get_feature_vector()
        posteriors = {}
        
        # Calculate likelihoods
        likelihoods = {}
        for disease in self.disease_library:
            disease_vector = disease.get_reference_vector()
            likelihoods[disease.icd10_code] = self.calculate_likelihood(
                patient_vector, disease_vector
            )
        
        # Calculate evidence (normalization factor)
        evidence = sum(
            likelihoods[code] * self.prior_probabilities[code] 
            for code in likelihoods
        )
        
        # Calculate posteriors using Bayes' theorem
        for disease in self.disease_library:
            code = disease.icd10_code
            posteriors[code] = (
                likelihoods[code] * self.prior_probabilities[code] / evidence
                if evidence > 0 else 0
            )
        
        return posteriors

class KuramotoAnalyzer:
    """Kuramoto coupling analysis for synchronization patterns"""
    
    def __init__(self, coupling_strength: float = 0.1):
        self.coupling_strength = coupling_strength
    
    def analyze_phase_coupling(self, patient_vector: np.ndarray, 
                             disease_vector: np.ndarray) -> float:
        """Analyze phase coupling between patient and disease patterns"""
        # Extract phases from complex numbers
        patient_phases = np.angle(patient_vector)
        disease_phases = np.angle(disease_vector)
        
        # Calculate order parameter (synchronization measure)
        phase_diff = patient_phases - disease_phases
        order_parameter = np.abs(np.mean(np.exp(1j * phase_diff)))
        
        return order_parameter
    
    def get_synchronization_scores(self, patient_encounter: PatientEncounter,
                                 disease_library: List[ICD10Disease]) -> Dict[str, float]:
        """Calculate synchronization scores for all diseases"""
        patient_vector = patient_encounter.get_feature_vector()
        scores = {}
        
        for disease in disease_library:
            disease_vector = disease.get_reference_vector()
            scores[disease.icd10_code] = self.analyze_phase_coupling(
                patient_vector, disease_vector
            )
        
        return scores

class MarkovAnalyzer:
    """Markov chain analysis for disease progression patterns"""
    
    def __init__(self):
        self.transition_matrix = None
        self.state_mapping = {}
    
    def build_transition_matrix(self, historical_data: List[Tuple[str, str]]):
        """Build transition matrix from historical disease progressions"""
        # Count transitions
        transitions = {}
        for current, next_state in historical_data:
            if current not in transitions:
                transitions[current] = {}
            if next_state not in transitions[current]:
                transitions[current][next_state] = 0
            transitions[current][next_state] += 1
        
        # Create state mapping
        all_states = set()
        for current, next_state in historical_data:
            all_states.add(current)
            all_states.add(next_state)
        
        self.state_mapping = {state: i for i, state in enumerate(sorted(all_states))}
        n_states = len(self.state_mapping)
        
        # Build probability matrix
        self.transition_matrix = np.zeros((n_states, n_states))
        for current, next_counts in transitions.items():
            i = self.state_mapping[current]
            total = sum(next_counts.values())
            for next_state, count in next_counts.items():
                j = self.state_mapping[next_state]
                self.transition_matrix[i, j] = count / total
    
    def predict_progression(self, current_disease: str, steps: int = 1) -> Dict[str, float]:
        """Predict disease progression probabilities"""
        if current_disease not in self.state_mapping:
            return {}
        
        current_idx = self.state_mapping[current_disease]
        current_state = np.zeros(len(self.state_mapping))
        current_state[current_idx] = 1.0
        
        # Calculate future state probabilities
        future_state = current_state @ np.linalg.matrix_power(self.transition_matrix, steps)
        
        # Convert back to disease codes
        predictions = {}
        for disease, idx in self.state_mapping.items():
            if future_state[idx] > 0.01:  # Threshold for relevance
                predictions[disease] = future_state[idx]
        
        return predictions

# Main Diagnostic Engine
class DiagnosticEngine:
    """Main engine combining all analysis methods"""
    
    def __init__(self, icd10_file_path: str):
        self.disease_library = []
        self.bayesian = None
        self.kuramoto = KuramotoAnalyzer()
        self.markov = MarkovAnalyzer()
        self.processors = {
            DomainType.SUBJECTIVE: SubjectiveDomainProcessor(),
            DomainType.VITALS: VitalsDomainProcessor(),
            # Add other processors as implemented
        }
        
    def load_icd10_library(self, file_path: str):
        """Load ICD10 disease library from file"""
        # This would parse the Excel file and build the reference library
        # For now, placeholder
        pass
    
    def build_reference_library(self):
        """Build Process A - Reference library from medical literature"""
        # This would use AI agents to search medical literature
        # and populate expected values for each disease
        pass
    
    def process_patient_encounter(self, patient_data: Dict[str, Any]) -> PatientEncounter:
        """Process patient data into structured encounter (Process B)"""
        domains = {}
        
        # Process each domain
        if "subjective" in patient_data:
            domains[DomainType.SUBJECTIVE] = self.processors[DomainType.SUBJECTIVE].process(
                patient_data["subjective"]
            )
        
        if "vitals" in patient_data:
            domains[DomainType.VITALS] = self.processors[DomainType.VITALS].process(
                patient_data["vitals"]
            )
        
        # Add other domains as implemented
        
        return PatientEncounter(
            encounter_id=patient_data.get("encounter_id", "unknown"),
            domains=domains,
            timestamp=patient_data.get("timestamp", "")
        )
    
    def diagnose(self, patient_encounter: PatientEncounter) -> List[Tuple[str, float, Dict[str, float]]]:
        """
        Perform diagnosis using all analysis methods
        Returns: List of (icd10_code, probability, analysis_scores)
        """
        # Bayesian analysis
        bayesian_probs = self.bayesian.get_posterior_probabilities(patient_encounter)
        
        # Kuramoto synchronization
        kuramoto_scores = self.kuramoto.get_synchronization_scores(
            patient_encounter, self.disease_library
        )
        
        # Combine scores (weighted ensemble)
        combined_scores = {}
        for disease in self.disease_library:
            code = disease.icd10_code
            combined_scores[code] = {
                "bayesian": bayesian_probs.get(code, 0),
                "kuramoto": kuramoto_scores.get(code, 0),
                "combined": 0.7 * bayesian_probs.get(code, 0) + 
                           0.3 * kuramoto_scores.get(code, 0)
            }
        
        # Sort by combined probability
        results = [
            (code, scores["combined"], scores)
            for code, scores in combined_scores.items()
        ]
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results[:10]  # Return top 10 differential diagnoses

# Example usage
if __name__ == "__main__":
    # Initialize diagnostic engine
    engine = DiagnosticEngine("Section111ValidICD10Jan2022.xlsx")
    
    # Example patient data
    patient_data = {
        "encounter_id": "ENC001",
        "timestamp": "2024-01-15T10:30:00",
        "subjective": {
            "age": 45,
            "sex": "M",
            "chief_complaint": "Severe chest pain radiating to left arm",
            "hpi": "Patient presents with acute onset chest pain, started 2 hours ago",
            "pmh": "Hypertension, diabetes mellitus type 2"
        },
        "vitals": {
            "temperature": 37.2,
            "heart_rate": 110,
            "bp_systolic": 160,
            "bp_diastolic": 95,
            "oxygen_saturation": 94,
            "respiratory_rate": 22
        }
    }
    
    # Process encounter
    encounter = engine.process_patient_encounter(patient_data)
    
    # Get diagnosis (would work once library is loaded)
    # diagnoses = engine.diagnose(encounter)
    # for icd_code, probability, scores in diagnoses:
    #     print(f"ICD-10: {icd_code}, Probability: {probability:.3f}")
