import axios from 'axios';
import { config } from '../config';

export const n8nService = {
  // Send patient data to n8n webhook
  async sendToN8n(patientData, processedData) {
    try {
      const payload = {
        patient_id: patientData.demographics.mrn || 'unknown',
        timestamp: new Date().toISOString(),
        
        // Chief complaint and symptoms
        text: `${patientData.subjective.chiefComplaint}. Patient reports: ${patientData.subjective.symptoms.join(', ')}`,
        
        // NLP results structure
        nlp_results: {
          entities: [
            ...patientData.subjective.symptoms.map(symptom => ({
              type: 'symptom',
              value: symptom,
              confidence: 0.85
            })),
            ...patientData.subjective.medications.map(med => ({
              type: 'medication',
              value: med,
              confidence: 0.90
            }))
          ],
          confidence: {
            overall: 0.82
          }
        },
        
        // Vitals
        vitals: patientData.objective.vitals,
        
        // Laboratory values
        laboratory: patientData.objective.laboratory,
        
        // Imaging
        imaging: patientData.objective.imaging,
        
        // Complex plane data for AI analysis
        complex_analysis: {
          total_data_points: Object.values(processedData).flat().length,
          domains: Object.keys(processedData),
          complex_plane_data: processedData
        },
        
        // Medical history
        medical_history: {
          past_medical: patientData.subjective.pastMedicalHistory,
          past_surgical: patientData.subjective.pastSurgicalHistory,
          medications: patientData.subjective.medications,
          allergies: patientData.subjective.allergyHistory
        }
      };

      const response = await axios.post(config.N8N_WEBHOOK_URL, payload);
      return response.data;
    } catch (error) {
      console.error('Error sending to n8n:', error);
      throw error;
    }
  },

  // Get latest analysis from backend
  async getLatestAnalysis() {
    try {
      const response = await axios.get(`${config.BACKEND_URL}/api/nlp/latest`);
      return response.data;
    } catch (error) {
      console.error('Error fetching latest analysis:', error);
      throw error;
    }
  }
};