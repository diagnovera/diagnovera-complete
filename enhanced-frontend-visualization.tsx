import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Activity, Brain, FileText, Stethoscope, Camera, Beaker, Eye, X, Info } from 'lucide-react';
import { PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import * as d3 from 'd3';

const MedicalDiagnosticSystem = () => {
  const [activeTab, setActiveTab] = useState('patient-entry');
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [showComplexPlane, setShowComplexPlane] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('all');
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

  // Mock diagnosis results with complex plane data
  const mockDiagnosisResults = {
    encounter_id: "ENC-2024-001",
    timestamp: "2024-01-15T10:30:00Z",
    diagnoses: [
      {
        icd10_code: "I21.9",
        description: "Acute myocardial infarction, unspecified",
        probability: 0.85,
        scores: {
          bayesian: 0.82,
          kuramoto: 0.88,
          combined: 0.85
        },
        complex_plane_data: {
          subjective: [
            { variable: "chest_pain", angle: 0, magnitude: 0.9, matched: true },
            { variable: "dyspnea", angle: 30, magnitude: 0.7, matched: true },
            { variable: "nausea", angle: 60, magnitude: 0.5, matched: true },
            { variable: "diaphoresis", angle: 90, magnitude: 0.8, matched: true },
            { variable: "arm_pain", angle: 120, magnitude: 0.6, matched: true }
          ],
          vitals: [
            { variable: "temperature", angle: 0, magnitude: 0.3, value: 37.2, reference: "36.5-37.5" },
            { variable: "heart_rate", angle: 60, magnitude: 0.9, value: 110, reference: "90-120" },
            { variable: "bp_systolic", angle: 120, magnitude: 0.8, value: 160, reference: "140-180" },
            { variable: "bp_diastolic", angle: 180, magnitude: 0.7, value: 95, reference: "90-100" },
            { variable: "oxygen_sat", angle: 240, magnitude: 0.6, value: 94, reference: "92-96" },
            { variable: "resp_rate", angle: 300, magnitude: 0.7, value: 22, reference: "18-24" }
          ],
          laboratory: [
            { variable: "troponin", angle: 0, magnitude: 0.95, matched: true },
            { variable: "ck_mb", angle: 45, magnitude: 0.85, matched: true },
            { variable: "bnp", angle: 90, magnitude: 0.7, matched: true },
            { variable: "d_dimer", angle: 135, magnitude: 0.4, matched: false }
          ],
          imaging: [
            { variable: "st_elevation", angle: 0, magnitude: 0.9, matched: true },
            { variable: "wall_motion", angle: 90, magnitude: 0.8, matched: true },
            { variable: "pericardial_eff", angle: 180, magnitude: 0.1, matched: false }
          ]
        }
      },
      {
        icd10_code: "I20.0",
        description: "Unstable angina",
        probability: 0.72,
        scores: {
          bayesian: 0.70,
          kuramoto: 0.74,
          combined: 0.72
        },
        complex_plane_data: {
          subjective: [
            { variable: "chest_pain", angle: 0, magnitude: 0.8, matched: true },
            { variable: "dyspnea", angle: 30, magnitude: 0.6, matched: true },
            { variable: "nausea", angle: 60, magnitude: 0.3, matched: false },
            { variable: "diaphoresis", angle: 90, magnitude: 0.5, matched: true },
            { variable: "arm_pain", angle: 120, magnitude: 0.4, matched: false }
          ],
          vitals: [
            { variable: "temperature", angle: 0, magnitude: 0.2, value: 37.0, reference: "36.5-37.5" },
            { variable: "heart_rate", angle: 60, magnitude: 0.7, value: 95, reference: "80-100" },
            { variable: "bp_systolic", angle: 120, magnitude: 0.6, value: 150, reference: "130-160" },
            { variable: "bp_diastolic", angle: 180, magnitude: 0.5, value: 90, reference: "80-95" },
            { variable: "oxygen_sat", angle: 240, magnitude: 0.3, value: 96, reference: "95-100" },
            { variable: "resp_rate", angle: 300, magnitude: 0.4, value: 18, reference: "16-20" }
          ],
          laboratory: [
            { variable: "troponin", angle: 0, magnitude: 0.3, matched: false },
            { variable: "ck_mb", angle: 45, magnitude: 0.2, matched: false },
            { variable: "bnp", angle: 90, magnitude: 0.4, matched: false },
            { variable: "d_dimer", angle: 135, magnitude: 0.2, matched: false }
          ],
          imaging: [
            { variable: "st_depression", angle: 0, magnitude: 0.7, matched: true },
            { variable: "t_wave_inv", angle: 90, magnitude: 0.6, matched: true },
            { variable: "normal_wall", angle: 180, magnitude: 0.8, matched: true }
          ]
        }
      }
    ],
    metadata: {
      domains_processed: ["subjective", "vitals", "laboratory", "imaging"],
      analysis_methods: ["bayesian", "kuramoto", "markov"],
      confidence_level: "high"
    }
  };

  const ComplexPlaneVisualization = ({ disease, domain = 'all' }) => {
    const canvasRef = React.useRef(null);
    
    useEffect(() => {
      if (!canvasRef.current || !disease.complex_plane_data) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 40;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Draw grid
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      
      // Concentric circles
      for (let i = 0.2; i <= 1; i += 0.2) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * i, 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      // Radial lines
      for (let angle = 0; angle < 360; angle += 30) {
        const radian = (angle * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + radius * Math.cos(radian),
          centerY + radius * Math.sin(radian)
        );
        ctx.stroke();
      }
      
      // Get data points based on selected domain
      let dataPoints = [];
      if (domain === 'all') {
        Object.keys(disease.complex_plane_data).forEach(key => {
          dataPoints = dataPoints.concat(disease.complex_plane_data[key]);
        });
      } else {
        dataPoints = disease.complex_plane_data[domain] || [];
      }
      
      // Draw data points
      dataPoints.forEach((point, index) => {
        const radian = (point.angle * Math.PI) / 180;
        const x = centerX + radius * point.magnitude * Math.cos(radian);
        const y = centerY + radius * point.magnitude * Math.sin(radian);
        
        // Draw line from center
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = point.matched ? '#3b82f6' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw point
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = point.matched ? '#3b82f6' : '#ef4444';
        ctx.fill();
        
        // Draw label
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const labelRadius = radius * point.magnitude + 20;
        const labelX = centerX + labelRadius * Math.cos(radian);
        const labelY = centerY + labelRadius * Math.sin(radian);
        
        ctx.save();
        ctx.translate(labelX, labelY);
        if (Math.abs(radian) > Math.PI / 2) {
          ctx.rotate(radian + Math.PI);
        } else {
          ctx.rotate(radian);
        }
        ctx.fillText(point.variable, 0, 0);
        ctx.restore();
      });
      
      // Draw center point
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#374151';
      ctx.fill();
      
    }, [disease, domain]);
    
    return (
      <div className="relative">
        <canvas ref={canvasRef} width={400} height={400} className="w-full max-w-md mx-auto" />
        <div className="absolute top-2 right-2 bg-white p-2 rounded shadow-md">
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Matched</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Not Matched</span>
          </div>
        </div>
      </div>
    );
  };

  const DomainRadarChart = ({ disease }) => {
    const radarData = useMemo(() => {
      if (!disease.complex_plane_data) return [];
      
      const data = {};
      Object.entries(disease.complex_plane_data).forEach(([domain, points]) => {
        if (Array.isArray(points)) {
          const avgMagnitude = points.reduce((sum, p) => sum + p.magnitude, 0) / points.length;
          const matchedRatio = points.filter(p => p.matched).length / points.length;
          
          data[domain] = {
            domain: domain.charAt(0).toUpperCase() + domain.slice(1),
            patient: avgMagnitude * 100,
            reference: matchedRatio * 100,
            fullMark: 100
          };
        }
      });
      
      return Object.values(data);
    }, [disease]);
    
    return (
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="domain" />
          <PolarRadiusAxis angle={90} domain={[0, 100]} />
          <Radar name="Patient Values" dataKey="patient" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
          <Radar name="Disease Match" dataKey="reference" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
          <Legend />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    );
  };

  const DiagnosisDetailModal = ({ disease, onClose }) => {
    const [viewMode, setViewMode] = useState('complex-plane');
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{disease.icd10_code}: {disease.description}</h2>
                <p className="text-gray-600">Probability: {(disease.probability * 100).toFixed(1)}%</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="mb-6">
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setViewMode('complex-plane')}
                  className={`px-4 py-2 rounded ${viewMode === 'complex-plane' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  Complex Plane View
                </button>
                <button
                  onClick={() => setViewMode('radar')}
                  className={`px-4 py-2 rounded ${viewMode === 'radar' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  Domain Analysis
                </button>
                <button
                  onClick={() => setViewMode('details')}
                  className={`px-4 py-2 rounded ${viewMode === 'details' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  Detailed Scores
                </button>
              </div>
              
              {viewMode === 'complex-plane' && (
                <div>
                  <div className="mb-4">
                    <label className="text-sm font-medium">Select Domain:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      className="ml-2 px-3 py-1 border rounded"
                    >
                      <option value="all">All Domains</option>
                      <option value="subjective">Subjective</option>
                      <option value="vitals">Vitals</option>
                      <option value="laboratory">Laboratory</option>
                      <option value="imaging">Imaging</option>
                    </select>
                  </div>
                  <ComplexPlaneVisualization disease={disease} domain={selectedDomain} />
                  <div className="mt-4 p-4 bg-blue-50 rounded">
                    <p className="text-sm text-blue-800">
                      <Info className="inline mr-2" size={16} />
                      This complex plane visualization shows how patient data matches the disease profile. 
                      Each variable is represented as a vector with an angle (θ) and magnitude. 
                      Blue indicates matching features, red indicates non-matching.
                    </p>
                  </div>
                </div>
              )}
              
              {viewMode === 'radar' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Domain-wise Analysis</h3>
                  <DomainRadarChart disease={disease} />
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded">
                      <h4 className="font-medium mb-2">Kuramoto Synchronization</h4>
                      <div className="text-2xl font-bold text-blue-600">{(disease.scores.kuramoto * 100).toFixed(1)}%</div>
                      <p className="text-sm text-gray-600">Phase coupling strength</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded">
                      <h4 className="font-medium mb-2">Bayesian Probability</h4>
                      <div className="text-2xl font-bold text-green-600">{(disease.scores.bayesian * 100).toFixed(1)}%</div>
                      <p className="text-sm text-gray-600">Posterior probability</p>
                    </div>
                  </div>
                </div>
              )}
              
              {viewMode === 'details' && (
                <div className="space-y-6">
                  {Object.entries(disease.complex_plane_data).map(([domain, variables]) => (
                    <div key={domain} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3 capitalize">{domain} Domain</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {variables.map((v, idx) => (
                          <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded">
                            <span className="font-medium">{v.variable}:</span>
                            <span className={v.matched ? 'text-green-600' : 'text-red-600'}>
                              {v.magnitude.toFixed(2)} @ {v.angle}°
                              {v.value && ` (${v.value})`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DiagnosisResults = () => {
    if (!diagnosisResults) return null;
    
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-2">Diagnosis Results</h2>
          <p className="opacity-90">Complex multi-domain analysis with phase space visualization</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Differential Diagnoses</h3>
            <div className="space-y-3">
              {diagnosisResults.diagnoses?.map((diagnosis, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                     onClick={() => setSelectedDisease(diagnosis)}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{diagnosis.icd10_code}</h4>
                      <p className="text-gray-600 text-sm">{diagnosis.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {(diagnosis.probability * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">Probability</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDisease(diagnosis);
                      }}
                      className="flex items-center text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="mr-1" size={16} />
                      View Complex Analysis
                    </button>
                    <div className="flex space-x-4 text-xs">
                      <span>Bayesian: {(diagnosis.scores?.bayesian * 100).toFixed(0)}%</span>
                      <span>Kuramoto: {(diagnosis.scores?.kuramoto * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Analysis Overview</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <h4 className="font-medium mb-2">Confidence Level</h4>
                <div className="flex items-center justify-between">
                  <div className={`text-2xl font-bold ${
                    diagnosisResults.metadata?.confidence_level === 'high' ? 'text-green-600' :
                    diagnosisResults.metadata?.confidence_level === 'medium' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {diagnosisResults.metadata?.confidence_level?.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Based on {diagnosisResults.metadata?.domains_processed?.length} domains
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-600">Analysis Methods</div>
                  <div className="font-medium">{diagnosisResults.metadata?.analysis_methods?.length} algorithms</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-600">Processing Time</div>
                  <div className="font-medium">2.3 seconds</div>
                </div>
              </div>
              
              <div className="pt-4">
                <button 
                  onClick={() => setShowComplexPlane(!showComplexPlane)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  <Brain className="inline mr-2" size={20} />
                  View All Complex Plane Visualizations
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {showComplexPlane && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Complex Plane Analysis - All Diseases</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {diagnosisResults.diagnoses?.map((diagnosis, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">{diagnosis.icd10_code}: {diagnosis.description}</h4>
                  <ComplexPlaneVisualization disease={diagnosis} domain="all" />
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <AlertCircle className="inline mr-2" size={16} />
            These results use complex mathematical modeling including Bayesian inference, 
            Kuramoto phase coupling, and Markov chain analysis. Each variable is represented 
            in complex plane with specific angles (θ) and magnitudes.
          </p>
        </div>
        
        {selectedDisease && (
          <DiagnosisDetailModal 
            disease={selectedDisease} 
            onClose={() => setSelectedDisease(null)} 
          />
        )}
      </div>
    );
  };

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
    
    // Simulate API call
    setTimeout(() => {
      setDiagnosisResults(mockDiagnosisResults);
      setActiveTab('results');
      setLoading(false);
    }, 2000);
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
      </div>
    </div>
  );

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
              >
                Diagnosis Results
              </button>
            </div>
          </div>
          
          {activeTab === 'patient-entry' ? (
            <div className="space-y-8">
              <SubjectiveDomainForm />
              <VitalsDomainForm />
              
              <div className="flex justify-center pt-6">
                <button
                  onClick={handleSubmit}
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
            </div>
          ) : (
            <DiagnosisResults />
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalDiagnosticSystem;