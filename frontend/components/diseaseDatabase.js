// Disease Database for DiagnoVera
// This file contains disease information for Bayesian analysis

export const diseaseDatabase = {
  // Cardiovascular Diseases
  'Myocardial Infarction': {
    symptoms: ['chest pain', 'sweating', 'dyspnea', 'nausea', 'diaphoresis', 'radiating pain'],
    labs: { 'Troponin': { min: 0.04, indicator: 'high' }, 'CK-MB': { min: 5, indicator: 'high' } },
    vitals: { heartRate: { min: 100, max: 150 }, systolicBP: { min: 140 } },
    prior: 0.05
  },
  'Pneumonia': {
    symptoms: ['cough', 'fever', 'dyspnea', 'chills', 'fatigue', 'sputum'],
    labs: { 'WBC': { min: 12, indicator: 'high' }, 'CRP': { min: 10, indicator: 'high' } },
    vitals: { temperature: { min: 100.4 }, respiratoryRate: { min: 22 } },
    prior: 0.10
  },
  'Heart Failure': {
    symptoms: ['dyspnea', 'orthopnea', 'edema', 'fatigue', 'weakness', 'pnd'],
    labs: { 'BNP': { min: 100, indicator: 'high' }, 'Troponin': { min: 0.02, indicator: 'high' } },
    vitals: { o2Saturation: { max: 92 }, respiratoryRate: { min: 20 } },
    prior: 0.08
  },
  'COPD Exacerbation': {
    symptoms: ['dyspnea', 'cough', 'wheezing', 'fatigue'],
    labs: { 'ABG': { indicator: 'abnormal' }, 'WBC': { min: 11, indicator: 'high' } },
    vitals: { o2Saturation: { max: 90 }, respiratoryRate: { min: 24 } },
    prior: 0.07
  },
  'Pulmonary Embolism': {
    symptoms: ['dyspnea', 'chest pain', 'hemoptysis', 'anxiety', 'leg swelling'],
    labs: { 'D-dimer': { min: 500, indicator: 'high' }, 'Troponin': { min: 0.01, indicator: 'high' } },
    vitals: { heartRate: { min: 100 }, o2Saturation: { max: 94 } },
    prior: 0.03
  },
  'Sepsis': {
    symptoms: ['fever', 'chills', 'weakness', 'confusion', 'malaise'],
    labs: { 'WBC': { min: 12, max: 4, indicator: 'abnormal' }, 'Lactate': { min: 2, indicator: 'high' } },
    vitals: { temperature: { min: 101, max: 96 }, heartRate: { min: 90 }, systolicBP: { max: 90 } },
    prior: 0.04
  },
  'Acute Kidney Injury': {
    symptoms: ['fatigue', 'edema', 'nausea', 'confusion'],
    labs: { 'Creatinine': { min: 1.5, indicator: 'high' }, 'BUN': { min: 40, indicator: 'high' } },
    vitals: { urineOutput: { max: 400, unit: 'mL/day' } },
    prior: 0.06
  },
  'Stroke': {
    symptoms: ['weakness', 'confusion', 'headache', 'dizziness'],
    labs: { 'Glucose': { indicator: 'check' } },
    vitals: { systolicBP: { min: 140 } },
    prior: 0.04
  }
};

// Function to find similar diseases based on symptoms
export function findSimilarDiseases(symptomString) {
  if (!symptomString) return [];

  const symptomWords = symptomString.toLowerCase().split(/\s+/);
  const diseaseScores = [];

  Object.entries(diseaseDatabase).forEach(([disease, info]) => {
    let score = 0;
    const diseaseSymptoms = info.symptoms || [];

    symptomWords.forEach(word => {
      diseaseSymptoms.forEach(symptom => {
        if (symptom.includes(word) || word.includes(symptom)) {
          score += 1;
        }
      });
    });

    if (score > 0) {
      diseaseScores.push({
        disease,
        similarity: score / Math.max(symptomWords.length, diseaseSymptoms.length)
      });
    }
  });

  return diseaseScores
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

// Export default as well for compatibility
export default diseaseDatabase;