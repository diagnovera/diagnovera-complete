'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, X, Loader2, Download, RotateCcw, BarChart3, GitBranch, Type, Send, Wifi, WifiOff } from 'lucide-react';

// Configuration
const config = {
  BACKEND_URL: typeof window !== 'undefined' && window.location ? 
    (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://diagnovera-backend-924070815611.us-central1.run.app') :
    'http://localhost:5000',
  N8N_WEBHOOK_URL: 'https://n8n.srv934967.hstgr.cloud/webhook/medical-diagnosis'
};

console.log('Backend URL:', config.BACKEND_URL);

// D3 Module Handler
class D3Module {
  static instance = null;
  static loadPromise = null;

  static async load() {
    if (this.instance) return this.instance;
    
    if (!this.loadPromise) {
      this.loadPromise = import('d3').then(module => {
        this.instance = module;
        return module;
      });
    }
    
    return this.loadPromise;
  }
}

// WebSocket Service
class WebSocketService {
  constructor() {
    this.socket = null;
    this.callbacks = {};
    this.connectionAttempts = 0;
    this.maxAttempts = 3;
    this.isConnecting = false;
  }

  async connect() {
    if (this.isConnecting || (this.socket && this.socket.connected)) {
      return;
    }

    this.isConnecting = true;

    if (typeof window === 'undefined') {
      console.warn('WebSocket can only be initialized in browser environment');
      return;
    }

    try {
      const io = await import('socket.io-client');
      
      console.log('Attempting to connect to WebSocket at:', config.BACKEND_URL);

      this.socket = io.default(config.BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 10000,
        autoConnect: true
      });

      this.socket.on('connect', () => {
        console.log('Connected to backend WebSocket');
        this.connectionAttempts = 0;
        this.isConnecting = false;
      });

      this.socket.on('connect_error', (error) => {
        console.warn('WebSocket connection error:', error.message);
        this.connectionAttempts++;
        this.isConnecting = false;

        if (this.connectionAttempts >= this.maxAttempts) {
          console.error('Max connection attempts reached. Running in offline mode.');
          if (this.callbacks.onConnectionError) {
            this.callbacks.onConnectionError(error);
          }
        }
      });

      this.socket.on('n8n_update', (data) => {
        if (this.callbacks.onN8nUpdate) {
          this.callbacks.onN8nUpdate(data);
        }
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from backend WebSocket');
        this.isConnecting = false;
      });
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.isConnecting = false;
      if (this.callbacks.onConnectionError) {
        this.callbacks.onConnectionError(error);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  onN8nUpdate(callback) {
    this.callbacks.onN8nUpdate = callback;
  }

  onConnectionError(callback) {
    this.callbacks.onConnectionError = callback;
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

const websocketService = new WebSocketService();

// n8n Service with AI integration
const n8nService = {
  async sendToN8n(patientData, processedData) {
    try {
      const payload = {
        patient_id: patientData.demographics.mrn || 'unknown',
        timestamp: new Date().toISOString(),
        demographics: {
          mrn: patientData.demographics.mrn || 'unknown',
          age: patientData.demographics.age || '',
          sex: patientData.demographics.sex || 'Unknown'
        },
        chief_complaint: patientData.subjective.chiefComplaint || '',
        symptoms: patientData.subjective.symptoms || [],
        text: `${patientData.subjective.chiefComplaint}. Patient reports: ${patientData.subjective.symptoms.join(', ')}`,
        medical_history: patientData.subjective.pastMedicalHistory || [],
        medications: patientData.subjective.medications || [],
        allergies: patientData.subjective.allergyHistory || [],
        vitals: {
          temperature: patientData.objective.vitals.temperature || '',
          heart_rate: patientData.objective.vitals.heartRate || '',
          blood_pressure: patientData.objective.vitals.bloodPressure || '',
          respiratory_rate: patientData.objective.vitals.respiratoryRate || '',
          oxygen_saturation: patientData.objective.vitals.o2Saturation || ''
        },
        laboratory: patientData.objective.laboratory || [],
        imaging: patientData.objective.imaging || [],
        complex_analysis: {
          total_data_points: Object.values(processedData).flat().length,
          domains: Object.keys(processedData),
          complex_plane_data: processedData
        }
      };

      console.log('Sending to n8n:', JSON.stringify(payload, null, 2));

      const response = await fetch(config.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log('n8n response:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }

      if (!responseText || responseText.trim() === '') {
        return {
          success: true,
          status: 'completed',
          message: 'Workflow executed but returned no data',
          patient_id: payload.patient_id,
          timestamp: new Date().toISOString(),
          diagnoses: ['Analysis pending - check n8n workflow'],
          recommendations: ['Verify n8n webhook response configuration'],
          confidence: 0,
          urgency_level: 'ROUTINE'
        };
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        return {
          error: true,
          message: 'Invalid JSON response from n8n',
          raw_response: responseText,
          patient_id: payload.patient_id
        };
      }

      const normalizedResponse = {
        success: data.success !== false,
        status: data.status || 'completed',
        patient_id: data.patient_id || payload.patient_id,
        encounter_id: data.encounter_id || `ENC-${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        diagnoses: data.diagnoses || data.diagnosis_list || data.differential_diagnoses || [],
        recommendations: data.recommendations || data.clinical_recommendations || [],
        labs_to_order: data.labs_to_order || data.suggested_labs || data.laboratory_tests || [],
        confidence: data.confidence !== undefined ? data.confidence : 0.5,
        urgency_level: data.urgency_level || data.priority || 'ROUTINE',
        summary: data.summary || data.clinical_summary || 'Analysis complete',
        critical_findings: data.critical_findings || {},
        diagnostic_report: data.diagnostic_report || {},
        patient_data: data.patient_data || {
          chief_complaint: payload.chief_complaint,
          symptoms: payload.symptoms,
          vitals: payload.vitals
        },
        debug: {
          workflow_response: data.debug_info || null,
          original_response_keys: Object.keys(data)
        }
      };

      return normalizedResponse;

    } catch (error) {
      console.error('Error sending to n8n:', error);
      return {
        error: true,
        success: false,
        message: error.message,
        patient_id: patientData.demographics.mrn || 'unknown',
        timestamp: new Date().toISOString(),
        diagnoses: [],
        recommendations: ['Unable to complete analysis - ' + error.message],
        confidence: 0,
        urgency_level: 'ERROR',
        debug: {
          error_type: error.name,
          error_message: error.message,
          webhook_url: config.N8N_WEBHOOK_URL
        }
      };
    }
  }
};

// Data cache and fallback data
const dataCache = new Map();

const getFallbackData = (dataFile) => {
  const fallbacks = {
    symptoms: ['Chest pain', 'Shortness of breath', 'Fever', 'Cough', 'Fatigue', 'Headache', 'Nausea', 'Dizziness'],
    medications: ['Aspirin', 'Metoprolol', 'Lisinopril', 'Atorvastatin', 'Metformin', 'Levothyroxine'],
    allergies: ['Penicillin', 'Sulfa drugs', 'Latex', 'Peanuts', 'Shellfish'],
    past_medical_history: ['Hypertension', 'Diabetes Type 2', 'Hyperlipidemia', 'GERD', 'Asthma'],
    past_surgical_history: ['Appendectomy', 'Cholecystectomy', 'Knee arthroscopy', 'Hernia repair'],
    laboratory_tests: ['Complete Blood Count', 'Basic Metabolic Panel', 'Troponin', 'BNP', 'D-dimer', 'CRP'],
    imaging_studies: ['Chest X-ray', 'CT Chest', 'Echocardiogram', 'EKG', 'MRI Brain'],
    diagnoses: ['Acute MI', 'Pneumonia', 'Heart Failure', 'COPD Exacerbation', 'Pulmonary Embolism'],
    chief_complaint: ['Chest pain', 'Shortness of breath', 'Abdominal pain', 'Headache', 'Fever']
  };
  return fallbacks[dataFile] || [];
};

// Data loader hook
const useDataLoader = (dataFile) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dataFile) return;

    if (dataCache.has(dataFile)) {
      setData(dataCache.get(dataFile));
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        let response = await fetch(`/data/${dataFile}.json`);
        
        if (!response.ok) {
          response = await fetch(`/data/${dataFile}`);
        }
        
        if (!response.ok) {
          response = await fetch(`${window.location.origin}/data/${dataFile}.json`);
        }

        if (!response.ok) {
          throw new Error(`Failed to load ${dataFile}`);
        }

        const result = await response.json();
        const items = result.items || result || [];

        dataCache.set(dataFile, items);
        setData(items);
      } catch (err) {
        console.error(`Error loading ${dataFile}:`, err);
        setError(err.message);
        
        const fallbackData = getFallbackData(dataFile);
        setData(fallbackData);
        dataCache.set(dataFile, fallbackData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataFile]);

  return { data, loading, error };
};

// EpicAutocompleteField component
const EpicAutocompleteField = ({
  label,
  dataFile,
  value,
  onChange,
  placeholder,
  multiple = false,
  color = "#5B9BD5",
  maxResults = 50
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const { data: options, loading, error } = useDataLoader(dataFile);

  const filteredOptions = useMemo(() => {
    if (!searchTerm || searchTerm.length === 0) {
      return options.slice(0, maxResults);
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = options
      .filter(option => option.toLowerCase().includes(lowerSearchTerm))
      .slice(0, maxResults);

    return filtered;
  }, [searchTerm, options, maxResults]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback((option) => {
    if (multiple) {
      const newValue = Array.isArray(value) ? value : [];
      const updatedValue = newValue.includes(option)
        ? newValue.filter(v => v !== option)
        : [...newValue, option];
      onChange(updatedValue);
      setSearchTerm("");
    } else {
      onChange(option);
      setIsOpen(false);
      setSearchTerm("");
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [multiple, value, onChange]);

  const removeItem = useCallback((item, e) => {
    e.stopPropagation();
    const newValue = Array.isArray(value) ? value.filter(v => v !== item) : [];
    onChange(newValue);
  }, [value, onChange]);

  const displayValue = Array.isArray(value) ? value : (value ? [value] : []);

  return (
    <div className="mb-3" ref={dropdownRef}>
      <div className="flex items-center mb-1">
        <div
          className="w-2 h-2 rounded-full mr-2"
          style={{ backgroundColor: color }}
        />
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {label}
        </label>
        {loading && (
          <Loader2 className="ml-2 h-3 w-3 animate-spin text-gray-400" />
        )}
      </div>

      <div
        className="relative bg-white border-2 border-gray-200 hover:border-[#4a90e2] transition-all"
        style={{ borderLeftColor: color, borderLeftWidth: "4px" }}
      >
        <div className="flex items-center p-2 min-h-[36px]">
          {displayValue.length > 0 && (
            <div className="flex flex-wrap gap-1 mr-2">
              {displayValue.slice(0, 2).map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-800 rounded"
                  style={{ backgroundColor: `${color}20`, color: color }}
                >
                  {item}
                  {multiple && (
                    <button
                      onClick={(e) => removeItem(item, e)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
              {displayValue.length > 2 && (
                <span className="text-xs text-gray-500">+{displayValue.length - 2}</span>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            placeholder={displayValue.length === 0 ? placeholder : "Search..."}
            className="flex-1 outline-none text-sm bg-transparent"
          />

          <ChevronDown
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
              inputRef.current?.focus();
            }}
            className={`ml-2 h-3 w-3 text-gray-400 transition-transform cursor-pointer ${isOpen ? "rotate-180" : ""}`}
          />
        </div>

        {isOpen && (
          <div className="absolute z-[100] w-full mt-1 bg-white border-2 border-[#4a90e2] shadow-lg max-h-64 overflow-auto">
            {loading ? (
              <div className="p-3 text-gray-500 text-center text-sm">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                Loading options...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-gray-500 text-center text-sm">
                {searchTerm ? `No matches found for "${searchTerm}"` : "Start typing to search..."}
              </div>
            ) : (
              <>
                {searchTerm && (
                  <div className="p-2 bg-gray-50 border-b text-xs text-gray-600 sticky top-0">
                    Showing {filteredOptions.length} results for "{searchTerm}"
                  </div>
                )}
                {filteredOptions.map((option, index) => (
                  <div
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(option);
                    }}
                    className={`px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer ${
                      displayValue.includes(option) ? "bg-blue-100 font-medium" : ""
                    }`}
                  >
                    {option}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Lab Field Component
const EpicLabField = ({
  label,
  dataFile,
  value,
  onChange,
  placeholder,
  color = '#70AD47',
  maxResults = 50,
  debounceMs = 300
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const { data: options, loading } = useDataLoader(dataFile);

  const handleSelect = useCallback((option) => {
    const currentLabs = Array.isArray(value) ? value : [];
    if (!currentLabs.find(lab => lab.name === option)) {
      onChange([...currentLabs, { name: option, value: '', unit: '' }]);
    }
    setIsOpen(false);
    setSearchTerm('');
  }, [value, onChange]);

  const updateLabValue = useCallback((labName, field, fieldValue) => {
    const currentLabs = Array.isArray(value) ? value : [];
    onChange(currentLabs.map(lab =>
      lab.name === labName ? { ...lab, [field]: fieldValue } : lab
    ));
  }, [value, onChange]);

  const removeItem = useCallback((labName) => {
    onChange((Array.isArray(value) ? value : []).filter(lab => lab.name !== labName));
  }, [value, onChange]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options.slice(0, maxResults);
    const lowerSearchTerm = searchTerm.toLowerCase();
    return options.filter(option => option.toLowerCase().includes(lowerSearchTerm)).slice(0, maxResults);
  }, [searchTerm, options, maxResults]);

  const displayLabs = Array.isArray(value) ? value : [];

  return (
    <div className="mb-3" ref={dropdownRef}>
      <div className="flex items-center mb-1">
        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</label>
      </div>

      {displayLabs.map((lab, index) => (
        <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-green-50 border border-green-200">
          <span className="text-sm font-medium flex-1">{lab.name}</span>
          <input
            type="text"
            placeholder="Value"
            value={lab.value}
            onChange={(e) => updateLabValue(lab.name, 'value', e.target.value)}
            className="w-16 p-1 text-sm border rounded"
          />
          <input
            type="text"
            placeholder="Unit"
            value={lab.unit}
            onChange={(e) => updateLabValue(lab.name, 'unit', e.target.value)}
            className="w-16 p-1 text-sm border rounded"
          />
          <button onClick={() => removeItem(lab.name)} className="text-red-500">
            <X size={14} />
          </button>
        </div>
      ))}

      <div
        className="relative bg-white border-2 border-gray-200 hover:border-[#70AD47]"
        style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
      >
        <div className="flex items-center p-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="flex-1 outline-none text-sm"
          />
          <ChevronDown 
            onClick={() => setIsOpen(!isOpen)}
            className="ml-2 h-3 w-3 text-gray-400 cursor-pointer" 
          />
        </div>

        {isOpen && (
          <div className="absolute z-[100] w-full mt-1 bg-white border-2 border-[#70AD47] shadow-lg max-h-48 overflow-auto">
            {filteredOptions.map((option, index) => (
              <div
                key={index}
                onClick={() => handleSelect(option)}
                className="px-3 py-2 text-sm hover:bg-green-50 cursor-pointer"
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Imaging Field Component
const EpicImagingField = ({
  label,
  dataFile,
  value,
  onChange,
  placeholder,
  color = '#FECA57',
  maxResults = 50
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const { data: options, loading } = useDataLoader(dataFile);

  const handleSelect = useCallback((option) => {
    const currentImaging = Array.isArray(value) ? value : [];
    if (!currentImaging.find(img => img.study === option)) {
      onChange([...currentImaging, { study: option, findings: '' }]);
    }
    setIsOpen(false);
    setSearchTerm('');
  }, [value, onChange]);

  const updateFindings = useCallback((study, findings) => {
    const currentImaging = Array.isArray(value) ? value : [];
    onChange(currentImaging.map(img =>
      img.study === study ? { ...img, findings } : img
    ));
  }, [value, onChange]);

  const removeItem = useCallback((study) => {
    onChange((Array.isArray(value) ? value : []).filter(img => img.study !== study));
  }, [value, onChange]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options.slice(0, maxResults);
    const lowerSearchTerm = searchTerm.toLowerCase();
    return options.filter(option => option.toLowerCase().includes(lowerSearchTerm)).slice(0, maxResults);
  }, [searchTerm, options, maxResults]);

  const displayImaging = Array.isArray(value) ? value : [];

  return (
    <div className="mb-3" ref={dropdownRef}>
      <div className="flex items-center mb-1">
        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</label>
      </div>

      {displayImaging.map((img, index) => (
        <div key={index} className="mb-2 p-2 bg-yellow-50 border border-yellow-200">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">{img.study}</div>
              <textarea
                placeholder="Enter imaging findings..."
                value={img.findings}
                onChange={(e) => updateFindings(img.study, e.target.value)}
                className="w-full mt-1 p-2 text-sm border border-gray-300 rounded resize-none"
                rows="2"
              />
            </div>
            <button onClick={() => removeItem(img.study)} className="text-red-500 p-1">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}

      <div
        className="relative bg-white border-2 border-gray-200 hover:border-[#FECA57]"
        style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
      >
        <div className="flex items-center p-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="flex-1 outline-none text-sm"
          />
          <ChevronDown 
            onClick={() => setIsOpen(!isOpen)}
            className="ml-2 h-3 w-3 text-gray-400 cursor-pointer" 
          />
        </div>

        {isOpen && (
          <div className="absolute z-[100] w-full mt-1 bg-white border-2 border-[#FECA57] shadow-lg max-h-48 overflow-auto">
            {filteredOptions.map((option, index) => (
              <div
                key={index}
                onClick={() => handleSelect(option)}
                className="px-3 py-2 text-sm hover:bg-yellow-50 cursor-pointer"
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Complex Plane Visualization
const ComplexPlaneChart = React.memo(({ data, showConnections, showLabels, selectedDomains }) => {
  const svgRef = useRef(null);
  const [d3Module, setD3Module] = useState(null);

  useEffect(() => {
    D3Module.load().then(d3 => {
      setD3Module(d3);
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data || !d3Module) return;

    const svg = d3Module.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 500;
    const height = 500;
    const margin = 60;
    const radius = Math.min(width, height) / 2 - margin;
    const centerX = width / 2;
    const centerY = height / 2;

    const g = svg.append("g")
      .attr("transform", `translate(${centerX},${centerY})`);

    // Background
    g.append("rect")
      .attr("x", -width/2)
      .attr("y", -height/2)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#f8f9fa");

    // Grid circles
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(r => {
      g.append("circle")
        .attr("r", radius * r)
        .attr("fill", "none")
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", r === 1 ? "0" : "3,3");
    });

    // Axes
    g.append("line")
      .attr("x1", -radius)
      .attr("y1", 0)
      .attr("x2", radius)
      .attr("y2", 0)
      .attr("stroke", "#999")
      .attr("stroke-width", 1);

    g.append("line")
      .attr("x1", 0)
      .attr("y1", -radius)
      .attr("x2", 0)
      .attr("y2", radius)
      .attr("stroke", "#999")
      .attr("stroke-width", 1);

    // Labels
    g.append("text")
      .attr("x", radius + 10)
      .attr("y", 5)
      .attr("font-size", "10px")
      .attr("fill", "#666")
      .text("Real");

    g.append("text")
      .attr("x", -5)
      .attr("y", -radius - 5)
      .attr("font-size", "10px")
      .attr("fill", "#666")
      .attr("text-anchor", "end")
      .text("Imaginary");

    // Collect all points
    let allPoints = [];
    Object.entries(data).forEach(([domain, points]) => {
      if (Array.isArray(points) && points.length > 0) {
        if (selectedDomains === 'all' || selectedDomains === domain) {
          allPoints = allPoints.concat(points);
        }
      }
    });

    if (allPoints.length === 0) return;

    // Draw points
    allPoints.forEach((point, i) => {
      const angle = point.angle * Math.PI / 180;
      const x = radius * point.magnitude * Math.cos(angle);
      const y = radius * point.magnitude * Math.sin(angle);

      // Connection line
      g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", y)
        .attr("stroke", point.color)
        .attr("stroke-width", 2)
        .attr("opacity", 0.6);

      // Point circle
      const pointG = g.append("g")
        .attr("transform", `translate(${x},${y})`);

      pointG.append("circle")
        .attr("r", 6)
        .attr("fill", point.color)
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .style("cursor", "pointer");

      // Label
      if (showLabels && point.name) {
        pointG.append("text")
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .attr("font-size", "8px")
          .attr("fill", "#333")
          .attr("font-weight", "500")
          .text(point.name.length > 12 ? point.name.substring(0, 12) + '...' : point.name);
      }
    });

    // Center point
    g.append("circle")
      .attr("r", 4)
      .attr("fill", "#333");

  }, [data, showConnections, showLabels, selectedDomains, d3Module]);

  if (!d3Module) {
    return (
      <div className="w-[500px] h-[500px] border border-gray-300 bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <svg ref={svgRef} width={500} height={500} className="border border-gray-300 bg-white" />
  );
});

// Kuramoto Analysis
const KuramotoAnalysis = ({ data, n8nResults }) => {
  const svgRef = useRef(null);
  const [orderParameter, setOrderParameter] = useState(0);
  const [coupling, setCoupling] = useState(0.5);
  const [isRunning, setIsRunning] = useState(false);
  const [d3Module, setD3Module] = useState(null);

  useEffect(() => {
    D3Module.load().then(d3 => {
      setD3Module(d3);
    });
  }, []);

  const hasData = data && Object.keys(data).length > 0 && Object.values(data).flat().length > 0;

  if (!hasData || !d3Module) {
    return (
      <div className="bg-white border-2 border-gray-300 p-4">
        <h3 className="text-sm font-bold mb-3">Kuramoto Synchronization Analysis</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          No patient data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-300 p-4">
      <h3 className="text-sm font-bold mb-3">Kuramoto Synchronization Analysis</h3>
      <svg ref={svgRef} width={400} height={300} className="border border-gray-200" />
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Order Parameter: {orderParameter.toFixed(3)}</span>
          <span className="text-xs text-gray-500">(0 = chaos, 1 = sync)</span>
        </div>
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`w-full py-2 text-xs font-bold rounded ${
            isRunning ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}
        >
          {isRunning ? 'Stop Simulation' : 'Start Simulation'}
        </button>
      </div>
    </div>
  );
};

// Bayesian Analysis
const BayesianAnalysis = ({ n8nResults }) => {
  const svgRef = useRef(null);
  const [d3Module, setD3Module] = useState(null);

  useEffect(() => {
    D3Module.load().then(d3 => {
      setD3Module(d3);
    });
  }, []);

  const hasData = n8nResults && n8nResults.diagnoses && n8nResults.diagnoses.length > 0;

  if (!hasData || !d3Module) {
    return (
      <div className="bg-white border-2 border-gray-300 p-4">
        <h3 className="text-sm font-bold mb-3">Diagnostic Probability Analysis</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          Waiting for diagnosis results...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-300 p-4">
      <h3 className="text-sm font-bold mb-3">Diagnostic Probability Analysis</h3>
      <svg ref={svgRef} width={450} height={300} />
      <div className="mt-4 space-y-2 text-xs">
        <div className="font-semibold">Diagnostic Results:</div>
        {n8nResults.diagnoses.map((diagnosis, idx) => (
          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span className="font-medium">{idx + 1}. {diagnosis}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// N8n Results Display
const N8nResultsDisplay = ({ results }) => {
  const [displayFormat, setDisplayFormat] = useState('bullets');

  if (!results) return null;

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 size={18} />
          Analysis Results
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setDisplayFormat('bullets')}
            className={`px-3 py-1 text-xs rounded ${
              displayFormat === 'bullets' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setDisplayFormat('json')}
            className={`px-3 py-1 text-xs rounded ${
              displayFormat === 'json' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Raw Data
          </button>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded">
        {displayFormat === 'bullets' ? (
          <div className="space-y-4">
            {results.summary && (
              <div className="bg-blue-50 p-3 rounded">
                <h4 className="font-semibold text-sm mb-1">Summary:</h4>
                <p className="text-sm text-gray-700">{results.summary}</p>
              </div>
            )}

            {results.diagnoses && results.diagnoses.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Diagnoses:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {results.diagnoses.map((diagnosis, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{diagnosis}</li>
                  ))}
                </ul>
              </div>
            )}

            {results.recommendations && results.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {results.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {results.confidence !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Confidence:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-500 h-4 rounded-full"
                    style={{ width: `${results.confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm">{(results.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        ) : (
          <pre className="text-xs overflow-auto bg-gray-50 p-3 rounded">
            {JSON.stringify(results, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

// Main Component
const DiagnoVeraEnterpriseInterface = () => {
  const [patientData, setPatientData] = useState({
    demographics: { mrn: '', age: '', sex: 'Male' },
    subjective: {
      chiefComplaint: '',
      symptoms: [],
      medications: [],
      allergyHistory: [],
      pastMedicalHistory: [],
      pastSurgicalHistory: []
    },
    objective: {
      vitals: {
        temperature: '',
        heartRate: '',
        bloodPressure: '',
        respiratoryRate: '',
        o2Saturation: ''
      },
      laboratory: [],
      imaging: []
    }
  });

  const [processedData, setProcessedData] = useState({});
  const [showConnections, setShowConnections] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedDomains, setSelectedDomains] = useState('all');
  const [suspectedDiagnoses, setSuspectedDiagnoses] = useState([]);
  const [n8nStatus, setN8nStatus] = useState('disconnected');
  const [n8nResults, setN8nResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const connectTimer = setTimeout(() => {
      try {
        websocketService.connect();
        websocketService.onN8nUpdate((data) => {
          setN8nResults(data);
          setN8nStatus('connected');
        });
        websocketService.onConnectionError(() => {
          setN8nStatus('offline');
        });
      } catch (error) {
        setN8nStatus('offline');
      }
    }, 100);

    return () => {
      clearTimeout(connectTimer);
      websocketService.disconnect();
    };
  }, []);

  const updateDemographics = useCallback((field, value) => {
    setPatientData(prev => ({
      ...prev,
      demographics: { ...prev.demographics, [field]: value }
    }));
  }, []);

  const updateSubjective = useCallback((field, value) => {
    setPatientData(prev => ({
      ...prev,
      subjective: { ...prev.subjective, [field]: value }
    }));
  }, []);

  const updateVitals = useCallback((field, value) => {
    setPatientData(prev => ({
      ...prev,
      objective: {
        ...prev.objective,
        vitals: { ...prev.objective.vitals, [field]: value }
      }
    }));
  }, []);

  const updateLaboratory = useCallback((value) => {
    setPatientData(prev => ({
      ...prev,
      objective: { ...prev.objective, laboratory: value }
    }));
  }, []);

  const updateImaging = useCallback((value) => {
    setPatientData(prev => ({
      ...prev,
      objective: { ...prev.objective, imaging: value }
    }));
  }, []);

  const processDataToComplexPlane = useCallback(() => {
    const complexData = {
      symptoms: [],
      vitals: [],
      labs: [],
      medications: []
    };

    // Process symptoms
    patientData.subjective.symptoms.forEach((symptom, idx) => {
      const angle = (idx * 30) % 360;
      const magnitude = 0.7 + Math.random() * 0.3;
      complexData.symptoms.push({
        name: symptom,
        real: magnitude * Math.cos(angle * Math.PI / 180),
        imaginary: magnitude * Math.sin(angle * Math.PI / 180),
        magnitude,
        angle,
        color: '#e74c3c'
      });
    });

    // Process vitals
    Object.entries(patientData.objective.vitals).forEach(([vital, value], idx) => {
      if (value) {
        const angle = 90 + (idx * 20);
        const normalizedValue = parseFloat(value) / 100;
        const magnitude = Math.min(normalizedValue, 1);
        complexData.vitals.push({
          name: vital,
          real: magnitude * Math.cos(angle * Math.PI / 180),
          imaginary: magnitude * Math.sin(angle * Math.PI / 180),
          magnitude,
          angle,
          color: '#3498db'
        });
      }
    });

    setProcessedData(complexData);
  }, [patientData]);

  useEffect(() => {
    processDataToComplexPlane();
  }, [patientData, processDataToComplexPlane]);

  const submitToN8n = async () => {
    setIsProcessing(true);
    setError(null);
    setN8nStatus('processing');

    try {
      if (!patientData.subjective.chiefComplaint &&
          (!patientData.subjective.symptoms || patientData.subjective.symptoms.length === 0)) {
        setError('Please enter a chief complaint or select at least one symptom');
        setN8nStatus('error');
        return;
      }

      const result = await n8nService.sendToN8n(patientData, processedData);

      if (result.error) {
        throw new Error(result.message || 'Error from n8n workflow');
      }

      setN8nResults({
        diagnoses: result.diagnoses || [],
        recommendations: result.recommendations || [],
        labs_to_order: result.labs_to_order || [],
        confidence: result.confidence || 0,
        summary: result.summary || 'Analysis complete',
        urgency_level: result.urgency_level || 'ROUTINE',
        timestamp: new Date().toISOString()
      });

      setN8nStatus('completed');

    } catch (err) {
      console.error('Error submitting to n8n:', err);
      setError(`Failed to analyze: ${err.message}`);
      setN8nStatus('error');

      // Provide mock results for testing
      if (patientData.subjective.symptoms.length > 0) {
        setN8nResults({
          diagnoses: ['Differential diagnosis pending', 'Further evaluation needed'],
          recommendations: [
            'Complete physical examination',
            'Review vital signs trend',
            'Consider additional testing'
          ],
          labs_to_order: ['CBC', 'BMP'],
          confidence: 0.5,
          summary: 'Analysis completed locally due to connection error',
          urgency_level: 'ROUTINE',
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setPatientData({
      demographics: { mrn: '', age: '', sex: 'Male' },
      subjective: {
        chiefComplaint: '',
        symptoms: [],
        medications: [],
        allergyHistory: [],
        pastMedicalHistory: [],
        pastSurgicalHistory: []
      },
      objective: {
        vitals: {
          temperature: '',
          heartRate: '',
          bloodPressure: '',
          respiratoryRate: '',
          o2Saturation: ''
        },
        laboratory: [],
        imaging: []
      }
    });
    setProcessedData({});
    setSuspectedDiagnoses([]);
    setN8nResults(null);
    setN8nStatus('disconnected');
    setError(null);
  };

  const exportData = () => {
    const exportObj = {
      timestamp: new Date().toISOString(),
      patientData,
      processedData,
      suspectedDiagnoses,
      n8nResults
    };

    const dataStr = JSON.stringify(exportObj, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `diagnovera-patient-${patientData.demographics.mrn || 'unknown'}-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 shadow-2xl rounded-lg p-4 mb-4 border-t-4 border-blue-500">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white tracking-wider">
                    DIAGNOVERA
                  </span>
                  <span className="text-xs text-blue-400 font-semibold align-super">
                    ™
                  </span>
                </div>
                <div className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-full animate-pulse"></div>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-blue-300 font-medium uppercase tracking-widest">
                  Clinical Decision Support System
                </span>
                <span className="text-xs text-gray-400">
                  Advanced Diagnostic Analysis Platform
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
                {n8nStatus === 'connected' ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <Wifi className="h-4 w-4 text-green-500" />
                  </div>
                ) : n8nStatus === 'offline' ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <WifiOff className="h-4 w-4 text-yellow-500" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <WifiOff className="h-4 w-4 text-red-500" />
                  </div>
                )}
                <span className="text-xs text-gray-300 font-medium">
                  n8n: {n8nStatus}
                </span>
              </div>

              <button
                onClick={resetForm}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all"
              >
                <RotateCcw size={14} />
                <span className="text-sm font-semibold">Reset</span>
              </button>

              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg transition-all"
              >
                <Download size={14} />
                <span className="text-sm font-semibold">Export</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                <span className="text-xs text-gray-400">Session: {Date.now().toString(36).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
                <span className="text-xs text-gray-400">v2.1.0 - Enterprise Integration</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Type size={18} />
                Demographics
              </h2>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="MRN"
                  value={patientData.demographics.mrn}
                  onChange={(e) => updateDemographics('mrn', e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="Age"
                  value={patientData.demographics.age}
                  onChange={(e) => updateDemographics('age', e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                />
                <select
                  value={patientData.demographics.sex}
                  onChange={(e) => updateDemographics('sex', e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3">Subjective Data</h2>
              
              <EpicAutocompleteField
                label="Chief Complaint"
                dataFile="chief_complaint"
                value={patientData.subjective.chiefComplaint}
                onChange={(value) => updateSubjective('chiefComplaint', value)}
                placeholder="Select chief complaint..."
                multiple={false}
                color="#e74c3c"
              />

              <EpicAutocompleteField
                label="Symptoms"
                dataFile="symptoms"
                value={patientData.subjective.symptoms}
                onChange={(value) => updateSubjective('symptoms', value)}
                placeholder="Search symptoms..."
                multiple={true}
                color="#e74c3c"
              />

              <EpicAutocompleteField
                label="Current Medications"
                dataFile="medications"
                value={patientData.subjective.medications}
                onChange={(value) => updateSubjective('medications', value)}
                placeholder="Search medications..."
                multiple={true}
                color="#f39c12"
              />

              <EpicAutocompleteField
                label="Allergies"
                dataFile="allergies"
                value={patientData.subjective.allergyHistory}
                onChange={(value) => updateSubjective('allergyHistory', value)}
                placeholder="Search allergies..."
                multiple={true}
                color="#e74c3c"
              />

              <EpicAutocompleteField
                label="Past Medical History"
                dataFile="past_medical_history"
                value={patientData.subjective.pastMedicalHistory}
                onChange={(value) => updateSubjective('pastMedicalHistory', value)}
                placeholder="Search conditions..."
                multiple={true}
                color="#9b59b6"
              />

              <EpicAutocompleteField
                label="Past Surgical History"
                dataFile="past_surgical_history"
                value={patientData.subjective.pastSurgicalHistory}
                onChange={(value) => updateSubjective('pastSurgicalHistory', value)}
                placeholder="Search procedures..."
                multiple={true}
                color="#34495e"
              />
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3">Objective Data</h2>

              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2">Vital Signs</h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Temperature (°F)"
                    value={patientData.objective.vitals.temperature}
                    onChange={(e) => updateVitals('temperature', e.target.value)}
                    className="p-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Heart Rate"
                    value={patientData.objective.vitals.heartRate}
                    onChange={(e) => updateVitals('heartRate', e.target.value)}
                    className="p-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Blood Pressure"
                    value={patientData.objective.vitals.bloodPressure}
                    onChange={(e) => updateVitals('bloodPressure', e.target.value)}
                    className="p-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Respiratory Rate"
                    value={patientData.objective.vitals.respiratoryRate}
                    onChange={(e) => updateVitals('respiratoryRate', e.target.value)}
                    className="p-2 border rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="O2 Saturation (%)"
                    value={patientData.objective.vitals.o2Saturation}
                    onChange={(e) => updateVitals('o2Saturation', e.target.value)}
                    className="p-2 border rounded text-sm col-span-2"
                  />
                </div>
              </div>

              <EpicLabField
                label="Laboratory Tests"
                dataFile="laboratory_tests"
                value={patientData.objective.laboratory}
                onChange={updateLaboratory}
                placeholder="Search lab tests..."
                color="#70AD47"
              />

              <EpicImagingField
                label="Imaging Studies"
                dataFile="imaging_studies"
                value={patientData.objective.imaging}
                onChange={updateImaging}
                placeholder="Search imaging..."
                color="#FECA57"
              />
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3">Suspected Diagnoses</h2>
              <EpicAutocompleteField
                label="Add Diagnoses"
                dataFile="diagnoses"
                value={suspectedDiagnoses}
                onChange={setSuspectedDiagnoses}
                placeholder="Search diagnoses..."
                multiple={true}
                color="#9b59b6"
              />
            </div>

            <button
              onClick={submitToN8n}
              disabled={isProcessing}
              className={`w-full py-3 rounded font-bold flex items-center justify-center gap-2 ${
                isProcessing
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Processing with AI...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Analyze with AI
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <GitBranch size={18} />
                  Complex Plane Analysis
                </h2>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={showConnections}
                      onChange={(e) => setShowConnections(e.target.checked)}
                    />
                    Connections
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={showLabels}
                      onChange={(e) => setShowLabels(e.target.checked)}
                    />
                    Labels
                  </label>
                  <select
                    value={selectedDomains}
                    onChange={(e) => setSelectedDomains(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="all">All Domains</option>
                    <option value="symptoms">Symptoms</option>
                    <option value="vitals">Vitals</option>
                    <option value="medications">Medications</option>
                  </select>
                </div>
              </div>
              <ComplexPlaneChart 
                data={processedData} 
                showConnections={showConnections}
                showLabels={showLabels}
                selectedDomains={selectedDomains}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KuramotoAnalysis data={processedData} n8nResults={n8nResults} />
              <BayesianAnalysis n8nResults={n8nResults} />
            </div>

            {n8nResults && (
              <N8nResultsDisplay results={n8nResults} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnoVeraEnterpriseInterface;