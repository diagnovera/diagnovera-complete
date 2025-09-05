import React, { useState, useEffect } from 'react';
import { AlertCircle, Activity, Brain, FileText, Stethoscope, Camera, Beaker } from 'lucide-react';

const MedicalDiagnosticSystem = () => {
  const [activeTab, setActiveTab] = useState('patient-entry');
  const [patientData, setPatientData] = useState({
    demographics: { age: '', sex: '' },
    chiefComplaint: '',
    hpi: '',
    pmh: '',
    medications: '',
    allergies: '',
    vitals: {
      temperature: '',
      heartRate: '',
      bpSystolic: '',
      bpDiastolic: '',
      oxygenSaturation: '',
      respiratoryRate: ''
    },
    examination: '',
    laboratory: '',
    imaging: '',
    procedures: ''
  });
  
  const [diagnosisResults, setDiagnosisResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (section, field, value) => {
    if (section === 'demographics' || section === 'vitals') {
      setPatientData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setPatientData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // In production, this would call your actual API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encounter_id: `ENC-${Date.now()}`,
          timestamp: new Date().toISOString(),
          subjective: {
            age: parseInt(patientData.demographics.age),
            sex: patientData.demographics.sex,
            chief_complaint: patientData.chiefComplaint,
            hpi: patientData.hpi,
            pmh: patientData.pmh,
            medications: patientData.medications,
            allergies: patientData.allergies
          },
          vitals: {
            temperature: parseFloat(patientData.vitals.temperature),
            heart_rate: parseFloat(patientData.vitals.heartRate),
            bp_systolic: parseFloat(patientData.vitals.bpSystolic),
            bp_diastolic: parseFloat(patientData.vitals.bpDiastolic),
            oxygen_saturation: parseFloat(patientData.vitals.oxygenSaturation),
            respiratory_rate: parseFloat(patientData.vitals.respiratoryRate)
          },
          examination: patientData.examination,
          laboratory: patientData.laboratory,
          imaging: patientData.imaging,
          procedures: patientData.procedures
        }),
      });
      
      if (!response.ok) throw new Error('Diagnosis failed');
      
      const results = await response.json();
      setDiagnosisResults(results);
      setActiveTab('results');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const SubjectiveDomainForm = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Stethoscope className="mr-2" /> Subjective Domain
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Age</label>
            <input
              type="number"
              value={patientData.demographics.age}
              onChange={(e) => handleInputChange('demographics', 'age', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Years"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sex</label>
            <select
              value={patientData.demographics.sex}
              onChange={(e) => handleInputChange('demographics', 'sex', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Chief Complaint</label>
            <textarea
              value={patientData.chiefComplaint}
              onChange={(e) => handleInputChange('subjective', 'chiefComplaint', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              rows="2"
              placeholder="Primary reason for visit..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">History of Present Illness</label>
            <textarea
              value={patientData.hpi}
              onChange={(e) => handleInputChange('subjective', 'hpi', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Detailed description of current illness..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Past Medical/Surgical History</label>
            <textarea
              value={patientData.pmh}
              onChange={(e) => handleInputChange('subjective', 'pmh', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              rows="2"
              placeholder="Previous conditions, surgeries..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Current Medications</label>
              <textarea
                value={patientData.medications}
                onChange={(e) => handleInputChange('subjective', 'medications', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="List all current medications..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Allergies</label>
              <textarea
                value={patientData.allergies}
                onChange={(e) => handleInputChange('subjective', 'allergies', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="Drug and other allergies..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const VitalsDomainForm = () => (
    <div className="bg-green-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Activity className="mr-2" /> Vitals Domain
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Temperature (°C)</label>
          <input
            type="number"
            step="0.1"
            value={patientData.vitals.temperature}
            onChange={(e) => handleInputChange('vitals', 'temperature', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
            placeholder="37.0"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Heart Rate (bpm)</label>
          <input
            type="number"
            value={patientData.vitals.heartRate}
            onChange={(e) => handleInputChange('vitals', 'heartRate', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
            placeholder="72"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">BP Systolic (mmHg)</label>
          <input
            type="number"
            value={patientData.vitals.bpSystolic}
            onChange={(e) => handleInputChange('vitals', 'bpSystolic', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
            placeholder="120"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">BP Diastolic (mmHg)</label>
          <input
            type="number"
            value={patientData.vitals.bpDiastolic}
            onChange={(e) => handleInputChange('vitals', 'bpDiastolic', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
            placeholder="80"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">O₂ Saturation (%)</label>
          <input
            type="number"
            value={patientData.vitals.oxygenSaturation}
            onChange={(e) => handleInputChange('vitals', 'oxygenSaturation', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
            placeholder="98"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Respiratory Rate (/min)</label>
          <input
            type="number"
            value={patientData.vitals.respiratoryRate}
            onChange={(e) => handleInputChange('vitals', 'respiratoryRate', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
            placeholder="16"
          />
        </div>
      </div>
    </div>
  );

  const OtherDomainsForm = () => (
    <div className="space-y-6">
      <div className="bg-purple-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="mr-2" /> Examination Domain
        </h3>
        <textarea
          value={patientData.examination}
          onChange={(e) => handleInputChange('other', 'examination', e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500"
          rows="4"
          placeholder="Physical examination findings..."
        />
      </div>
      
      <div className="bg-yellow-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Beaker className="mr-2" /> Laboratory Domain
        </h3>
        <textarea
          value={patientData.laboratory}
          onChange={(e) => handleInputChange('other', 'laboratory', e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-yellow-500"
          rows="3"
          placeholder="Lab results (e.g., CBC: WBC 12.5, Hgb 14.2...)"
        />
      </div>
      
      <div className="bg-red-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Camera className="mr-2" /> Imaging Domain
        </h3>
        <textarea
          value={patientData.imaging}
          onChange={(e) => handleInputChange('other', 'imaging', e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500"
          rows="3"
          placeholder="Imaging findings (X-ray, CT, MRI...)"
        />
      </div>
      
      <div className="bg-indigo-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Brain className="mr-2" /> Procedures & Pathology Domain
        </h3>
        <textarea
          value={patientData.procedures}
          onChange={(e) => handleInputChange('other', 'procedures', e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
          rows="3"
          placeholder="Procedures performed and pathology results..."
        />
      </div>
    </div>
  );

  const DiagnosisResults = () => {
    if (!diagnosisResults) return null;
    
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-2">Diagnosis Results</h2>
          <p className="opacity-90">Based on complex multi-domain analysis</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Differential Diagnoses</h3>
          <div className="space-y-4">
            {diagnosisResults.diagnoses?.map((diagnosis, index) => (
              <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-lg">{diagnosis.icd10_code}</h4>
                    <p className="text-gray-600">{diagnosis.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {(diagnosis.probability * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Probability</div>
                  </div>
                </div>
                
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 rounded p-2">
                    <span className="font-medium">Bayesian Score:</span> {diagnosis.scores?.bayesian?.toFixed(3) || 'N/A'}
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <span className="font-medium">Kuramoto Sync:</span> {diagnosis.scores?.kuramoto?.toFixed(3) || 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <AlertCircle className="inline mr-2" size={16} />
            These results are generated using advanced probabilistic analysis including Bayesian inference, 
            Kuramoto coupling, and Markov chain analysis. Always confirm with clinical judgment.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold mb-8 text-center">Medical Diagnostic System</h1>
          
          <div className="mb-8">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('patient-entry')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'patient-entry'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Patient Data Entry
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'results'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                disabled={!diagnosisResults}
              >
                Diagnosis Results
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <AlertCircle className="inline mr-2" size={20} />
              {error}
            </div>
          )}
          
          {activeTab === 'patient-entry' ? (
            <form onSubmit={handleSubmit} className="space-y-8">
              <SubjectiveDomainForm />
              <VitalsDomainForm />
              <OtherDomainsForm />
              
              <div className="flex justify-center pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                  }`}
                >
                  {loading ? 'Processing...' : 'Generate Diagnosis'}
                </button>
              </div>
            </form>
          ) : (
            <DiagnosisResults />
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalDiagnosticSystem;