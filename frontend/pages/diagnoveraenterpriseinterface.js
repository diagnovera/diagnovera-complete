'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, X, Loader2, Download, RotateCcw, Brain, BarChart3, GitBranch, Type, Send, Wifi, WifiOff } from 'lucide-react';

// Configuration
const config = {
  BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000',
  N8N_WEBHOOK_URL: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://n8n.srv934967.hstgr.cloud/webhook/medical-diagnosis'
};

console.log('Backend URL:', config.BACKEND_URL);

// Mock disease database
const diseaseDatabase = {
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
  }
};

const findSimilarDiseases = (symptomString) => {
  return [];
};

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

// n8n Service
const n8nService = {
  async sendToN8n(patientData, processedData) {
    try {
      const payload = {
        patient_id: patientData.demographics.mrn || 'unknown',
        timestamp: new Date().toISOString(),
        text: `${patientData.subjective.chiefComplaint}. Patient reports: ${patientData.subjective.symptoms.join(', ')}`,
        demographics: {
          age: patientData.demographics.age,
          sex: patientData.demographics.sex
        },
        symptoms: patientData.subjective.symptoms,
        chief_complaint: patientData.subjective.chiefComplaint,
        vitals: patientData.objective.vitals,
        laboratory: patientData.objective.laboratory,
        imaging: patientData.objective.imaging,
        medications: patientData.subjective.medications,
        allergies: patientData.subjective.allergyHistory,
        medical_history: patientData.subjective.pastMedicalHistory,
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
        complex_analysis: {
          total_data_points: Object.values(processedData).flat().length,
          domains: Object.keys(processedData),
          complex_plane_data: processedData
        }
      };

      console.log('Sending to n8n - Full payload:');
      console.log(JSON.stringify(payload, null, 2));

      const response = await fetch(config.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      // Get response as text first to debug
      const responseText = await response.text();
      console.log('Response text:', responseText);

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        console.log('Raw response:', responseText);

        // Check if it's the "Workflow was started" message
        if (responseText.includes('Workflow was started')) {
          throw new Error('n8n workflow is not configured to return results. Check webhook settings.');
        }

        // Return a default response if parsing fails
        data = {
          error: true,
          message: 'Invalid response from n8n',
          raw_response: responseText,
          patient_id: payload.patient_id
        };
      }

      console.log('n8n response - Parsed data:', data);
      return data;

    } catch (error) {
      console.error('Error sending to n8n:', error);
      throw error;
    }
  }
};

// Data cache
const dataCache = new Map();

// Fallback data
const getFallbackData = (dataFile) => {
  const fallbacks = {
    symptoms: ['Chest pain', 'Shortness of breath', 'Fever', 'Cough', 'Fatigue', 'Headache', 'Nausea', 'Dizziness'],
    medications: ['Aspirin', 'Metoprolol', 'Lisinopril', 'Atorvastatin', 'Metformin', 'Levothyroxine'],
    allergies: ['Penicillin', 'Sulfa drugs', 'Latex', 'Peanuts', 'Shellfish'],
    past_medical_history: ['Hypertension', 'Diabetes Type 2', 'Hyperlipidemia', 'GERD', 'Asthma'],
    past_surgical_history: ['Appendectomy', 'Cholecystectomy', 'Knee arthroscopy', 'Hernia repair'],
    laboratory_tests: ['Complete Blood Count', 'Basic Metabolic Panel', 'Troponin', 'BNP', 'D-dimer', 'CRP'],
    imaging_studies: ['Chest X-ray', 'CT Chest', 'Echocardiogram', 'EKG', 'MRI Brain'],
    diagnoses: ['Acute MI', 'Pneumonia', 'Heart Failure', 'COPD Exacerbation', 'Pulmonary Embolism']
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

// Preload data files
export const preloadDataFiles = (files) => {
  if (typeof window === 'undefined') return;
  
  files.forEach(file => {
    if (!dataCache.has(file)) {
      fetch(`/data/${file}.json`)
        .then(res => res.json())
        .then(result => {
          dataCache.set(file, result.items || result || []);
        })
        .catch(err => {
          console.warn(`Using fallback data for ${file}`);
          dataCache.set(file, getFallbackData(file));
        });
    }
  });
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

// Imaging Field Component
const EpicImagingField = ({
  label,
  dataFile,
  value,
  onChange,
  placeholder,
  color = '#FECA57',
  maxResults = 50,
  debounceMs = 300
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const { data: options, loading } = useDataLoader(dataFile);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  const filteredOptions = useMemo(() => {
    if (!debouncedSearchTerm) return options.slice(0, maxResults);

    const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    const filtered = [];

    for (let i = 0; i < options.length && filtered.length < maxResults; i++) {
      if (options[i].toLowerCase().includes(lowerSearchTerm)) {
        filtered.push(options[i]);
      }
    }

    return filtered;
  }, [debouncedSearchTerm, options, maxResults]);

  const handleSelect = useCallback((option) => {
    const currentImaging = Array.isArray(value) ? value : [];
    if (!currentImaging.find(img => img.study === option)) {
      onChange([...currentImaging, { study: option, findings: '' }]);
    }
    setIsOpen(false);
    setSearchTerm('');
    setDebouncedSearchTerm('');
    const input = dropdownRef.current?.querySelector('input[type="text"]');
    if (input) {
      input.value = '';
    }
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

  const displayImaging = Array.isArray(value) ? value : [];

  return (
    <div className="mb-3" ref={dropdownRef}>
      <div className="flex items-center mb-1">
        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</label>
        {loading && (
          <Loader2 className="ml-2 h-3 w-3 animate-spin text-gray-400" />
        )}
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
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center p-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            placeholder={placeholder}
            className="flex-1 outline-none text-sm"
            onFocus={() => setIsOpen(true)}
          />
          <ChevronDown className="ml-2 h-3 w-3 text-gray-400" />
        </div>

        {isOpen && (
          <div className="absolute z-[100] w-full mt-1 bg-white border-2 border-[#FECA57] shadow-lg max-h-48 overflow-auto">
            {loading ? (
              <div className="p-3 text-gray-500 text-center text-sm">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                Loading options...
              </div>
            ) : (
              <>
                {debouncedSearchTerm && (
                  <div className="p-2 bg-gray-50 border-b text-xs text-gray-600">
                    Showing {filteredOptions.length} results
                  </div>
                )}
                {filteredOptions.map((option, index) => (
                  <div
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(option);
                    }}
                    className="px-3 py-2 text-sm hover:bg-yellow-50 cursor-pointer"
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const { data: options, loading } = useDataLoader(dataFile);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  const filteredOptions = useMemo(() => {
    if (!debouncedSearchTerm) return options.slice(0, maxResults);

    const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    const filtered = [];

    for (let i = 0; i < options.length && filtered.length < maxResults; i++) {
      if (options[i].toLowerCase().includes(lowerSearchTerm)) {
        filtered.push(options[i]);
      }
    }

    return filtered;
  }, [debouncedSearchTerm, options, maxResults]);

  const handleSelect = useCallback((option) => {
    const currentLabs = Array.isArray(value) ? value : [];
    if (!currentLabs.find(lab => lab.name === option)) {
      onChange([...currentLabs, { name: option, value: '', unit: '' }]);
    }
    setIsOpen(false);
    setSearchTerm('');
    setDebouncedSearchTerm('');
    const input = dropdownRef.current?.querySelector('input[type="text"]');
    if (input) {
      input.value = '';
    }
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

  const displayLabs = Array.isArray(value) ? value : [];

  return (
    <div className="mb-3" ref={dropdownRef}>
      <div className="flex items-center mb-1">
        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</label>
        {loading && (
          <Loader2 className="ml-2 h-3 w-3 animate-spin text-gray-400" />
        )}
      </div>

      {displayLabs.map((lab, index) => (
        <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-green-50 border border-green-200">
          <span className="text-sm font-medium flex-1">{lab.name}</span>
          <input
            type="text"
            placeholder="Value"
            value={lab.value}
            onChange={(e) => updateLabValue(lab.name, 'value', e.target.value)}
            className="w-16 p-1 text-sm border"
          />
          <input
            type="text"
            placeholder="Unit"
            value={lab.unit}
            onChange={(e) => updateLabValue(lab.name, 'unit', e.target.value)}
            className="w-16 p-1 text-sm border"
          />
          <button onClick={() => removeItem(lab.name)} className="text-red-500">
            <X size={14} />
          </button>
        </div>
      ))}

      <div
        className="relative bg-white border-2 border-gray-200 hover:border-[#70AD47]"
        style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center p-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            placeholder={placeholder}
            className="flex-1 outline-none text-sm"
            onFocus={() => setIsOpen(true)}
          />
          <ChevronDown className="ml-2 h-3 w-3 text-gray-400" />
        </div>

        {isOpen && (
          <div className="absolute z-[100] w-full mt-1 bg-white border-2 border-[#70AD47] shadow-lg max-h-48 overflow-auto">
            {loading ? (
              <div className="p-3 text-gray-500 text-center text-sm">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                Loading options...
              </div>
            ) : (
              <>
                {debouncedSearchTerm && (
                  <div className="p-2 bg-gray-50 border-b text-xs text-gray-600">
                    Showing {filteredOptions.length} results
                  </div>
                )}
                {filteredOptions.map((option, index) => (
                  <div
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(option);
                    }}
                    className="px-3 py-2 text-sm hover:bg-green-50 cursor-pointer"
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

      g.append("text")
        .attr("x", 5)
        .attr("y", -radius * r + 3)
        .attr("font-size", "9px")
        .attr("fill", "#666")
        .text(`${r.toFixed(1)}`);
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

    // Angle lines
    for (let angle = 0; angle < 360; angle += 30) {
      const radian = angle * Math.PI / 180;
      g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", radius * Math.cos(radian))
        .attr("y2", radius * Math.sin(radian))
        .attr("stroke", "#eee")
        .attr("stroke-width", 0.5);
    }

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

    // Convert points to coordinates
    const coordinates = allPoints.map(p => {
      const angle = p.angle * Math.PI / 180;
      return {
        x: radius * p.magnitude * Math.cos(angle),
        y: radius * p.magnitude * Math.sin(angle),
        data: p
      };
    });

    // Sort points by angle for smooth curve
    coordinates.sort((a, b) => a.data.angle - b.data.angle);

    // Connection smooth curve using cardinal spline
    if (showConnections && coordinates.length > 2) {
      const closedCoordinates = [...coordinates, coordinates[0]];

      const line = d3Module.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3Module.curveCardinalClosed.tension(0.5));

      g.append("path")
        .datum(closedCoordinates)
        .attr("d", line)
        .attr("fill", "rgba(74, 144, 226, 0.1)")
        .attr("stroke", "#4a90e2")
        .attr("stroke-width", 2);
    }

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

      // Tooltip on hover
      pointG.append("title")
        .text(`${point.name}\nReal: ${point.real.toFixed(3)}\nImaginary: ${point.imaginary.toFixed(3)}\nMagnitude: ${point.magnitude.toFixed(3)}\nAngle: ${point.angle}°`);

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
const KuramotoAnalysis = ({ data }) => {
  const svgRef = useRef(null);
  const animationRef = useRef(null);
  const [orderParameter, setOrderParameter] = useState(0);
  const [coupling, setCoupling] = useState(0.8);
  const [isRunning, setIsRunning] = useState(false);
  const [oscillators, setOscillators] = useState([]);
  const [d3Module, setD3Module] = useState(null);

  useEffect(() => {
    D3Module.load().then(d3 => {
      setD3Module(d3);
    });
  }, []);

  const hasData = data && Object.keys(data).length > 0 && Object.values(data).flat().length > 0;

  useEffect(() => {
    if (!hasData) return;

    let newOscillators = [];
    Object.entries(data).forEach(([domain, points]) => {
      if (Array.isArray(points)) {
        points.forEach(point => {
          newOscillators.push({
            ...point,
            phase: (point.angle * Math.PI / 180),
            naturalFreq: 0.1 + (point.magnitude * 0.9),
            domain: domain
          });
        });
      }
    });
    setOscillators(newOscillators);
  }, [data, hasData]);

  useEffect(() => {
    if (!svgRef.current || oscillators.length === 0 || !d3Module) return;

    const svg = d3Module.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 400;
    const height = 400;
    const radius = 150;
    const centerX = width / 2;
    const centerY = height / 2;

    const g = svg.append("g")
      .attr("transform", `translate(${centerX},${centerY})`);

    // Background circle
    g.append("circle")
      .attr("r", radius)
      .attr("fill", "none")
      .attr("stroke", "#ddd")
      .attr("stroke-width", 2);

    // Kuramoto model simulation
    const simulate = () => {
      if (!isRunning) return;

      const N = oscillators.length;
      const newOscillators = oscillators.map((osc, i) => {
        let sumSin = 0, sumCos = 0;

        oscillators.forEach((other, j) => {
          if (i !== j) {
            sumSin += Math.sin(other.phase - osc.phase);
            sumCos += Math.cos(other.phase - osc.phase);
          }
        });

        const meanFieldPhase = Math.atan2(sumSin / N, sumCos / N);
        const newPhase = osc.phase + 0.01 * (osc.naturalFreq + coupling * Math.sin(meanFieldPhase - osc.phase));

        return {
          ...osc,
          phase: newPhase % (2 * Math.PI)
        };
      });

      setOscillators(newOscillators);

      // Calculate order parameter
      let rSum = 0, iSum = 0;
      newOscillators.forEach(osc => {
        rSum += Math.cos(osc.phase);
        iSum += Math.sin(osc.phase);
      });
      const r = Math.sqrt(rSum * rSum + iSum * iSum) / N;
      setOrderParameter(r);

      // Clear and redraw
      g.selectAll(".oscillator").remove();
      g.selectAll(".mean-field").remove();

      // Draw mean field vector
      if (r > 0.1) {
        g.append("line")
          .attr("class", "mean-field")
          .attr("x1", 0)
          .attr("y1", 0)
          .attr("x2", radius * r * (rSum / N))
          .attr("y2", radius * r * (iSum / N))
          .attr("stroke", "#ff6b6b")
          .attr("stroke-width", 3)
          .attr("marker-end", "url(#arrowhead)");
      }

      // Draw oscillators
      newOscillators.forEach(osc => {
        const x = radius * Math.cos(osc.phase);
        const y = radius * Math.sin(osc.phase);

        g.append("circle")
          .attr("class", "oscillator")
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", 6)
          .attr("fill", osc.color || "#4a90e2")
          .attr("stroke", "white")
          .attr("stroke-width", 2)
          .attr("opacity", 0.8);
      });

      // Draw domain labels
      const domainAngles = {};
      newOscillators.forEach(osc => {
        if (!domainAngles[osc.domain]) {
          domainAngles[osc.domain] = [];
        }
        domainAngles[osc.domain].push(osc.phase);
      });

      Object.entries(domainAngles).forEach(([domain, phases]) => {
        const avgPhase = phases.reduce((a, b) => a + b, 0) / phases.length;
        const labelRadius = radius + 20;
        const x = labelRadius * Math.cos(avgPhase);
        const y = labelRadius * Math.sin(avgPhase);

        g.append("text")
          .attr("x", x)
          .attr("y", y)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("fill", "#666")
          .text(domain.substring(0, 8));
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    // Arrow marker
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("markerWidth", 10)
      .attr("markerHeight", 7)
      .attr("refX", 9)
      .attr("refY", 3.5)
      .attr("orient", "auto")
      .append("polygon")
      .attr("points", "0 0, 10 3.5, 0 7")
      .attr("fill", "#ff6b6b");

    if (isRunning) {
      simulate();
    } else {
      // Draw static state
      g.selectAll(".oscillator").remove();
      oscillators.forEach(osc => {
        const x = radius * Math.cos(osc.phase);
        const y = radius * Math.sin(osc.phase);

        g.append("circle")
          .attr("class", "oscillator")
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", 6)
          .attr("fill", osc.color || "#4a90e2")
          .attr("stroke", "white")
          .attr("stroke-width", 2);
      });
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [oscillators, coupling, isRunning, d3Module]);

  // Clinical interpretation
  const getClinicalInterpretation = () => {
    if (coupling < 0.3) {
      return {
        state: "Decoupled State",
        color: "#e74c3c",
        interpretation: "Low physiological integration. Body systems operating independently.",
        clinicalSignificance: "May indicate: Shock states, multi-organ dysfunction, severe metabolic derangement, or medication effects disrupting normal feedback loops.",
        actionableInsights: [
          "• Evaluate for distributive shock or sepsis",
          "• Check for metabolic acidosis/alkalosis",
          "• Review medications affecting autonomic function",
          "• Consider ICU-level monitoring"
        ]
      };
    } else if (coupling < 0.7) {
      return {
        state: "Partial Synchronization",
        color: "#f39c12",
        interpretation: "Moderate physiological coupling. Some systems coordinating while others remain independent.",
        clinicalSignificance: "Typical in: Compensated disease states, early decompensation, recovery phase, or therapeutic intervention effects.",
        actionableInsights: [
          "• Monitor trend - improving or worsening?",
          "• Optimize current therapies",
          "• Watch for decompensation signs",
          "• Consider serial assessments"
        ]
      };
    } else if (coupling < 1.2) {
      return {
        state: "Healthy Synchronization",
        color: "#27ae60",
        interpretation: "Optimal physiological integration. Body systems working in coordinated harmony.",
        clinicalSignificance: "Indicates: Normal homeostasis, effective compensation mechanisms, good therapeutic response, or stable chronic disease.",
        actionableInsights: [
          "• Continue current management",
          "• Focus on preventive measures",
          "• Document baseline for future comparison",
          "• Consider discharge planning if acute"
        ]
      };
    } else {
      return {
        state: "Hyper-synchronization",
        color: "#9b59b6",
        interpretation: "Excessive coupling. Systems locked in rigid patterns with reduced adaptability.",
        clinicalSignificance: "Concerning for: Autonomic dysfunction, panic/anxiety states, medication toxicity, or pre-seizure states.",
        actionableInsights: [
          "• Evaluate for anxiety/panic disorder",
          "• Check for stimulant use/toxicity",
          "• Consider autonomic testing",
          "• Review for prodromal symptoms"
        ]
      };
    }
  };

  const interpretation = getClinicalInterpretation();

  if (!hasData || !d3Module) {
    return (
      <div className="bg-white border-2 border-gray-300 p-4">
        <h3 className="text-sm font-bold mb-3">Kuramoto Synchronization Analysis</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          {!d3Module ? (
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          ) : (
            "No patient data available. Enter clinical data to begin analysis."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-300 p-4">
      <h3 className="text-sm font-bold mb-3">Kuramoto Synchronization Analysis</h3>
      <svg ref={svgRef} width={400} height={400} className="border border-gray-200" />
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Order Parameter: {orderParameter.toFixed(3)}</span>
          <span className="text-xs text-gray-500">(0 = chaos, 1 = sync)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Total Oscillators: {oscillators.length}</span>
          <span className="text-xs text-gray-500">From patient data</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium">Coupling Strength:</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={coupling}
            onChange={(e) => setCoupling(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs w-8">{coupling.toFixed(1)}</span>
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

      {/* Clinical Interpretation Box */}
      <div className={`mt-4 p-4 border-2 rounded-lg`} style={{ borderColor: interpretation.color, backgroundColor: `${interpretation.color}15` }}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: interpretation.color }}></div>
            {interpretation.state}
          </h4>
          <span className="text-xs text-gray-600">K = {coupling.toFixed(1)}</span>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <span className="font-semibold">Interpretation:</span>
            <p className="text-gray-700 mt-1">{interpretation.interpretation}</p>
          </div>

          <div>
            <span className="font-semibold">Clinical Significance:</span>
            <p className="text-gray-700 mt-1">{interpretation.clinicalSignificance}</p>
          </div>

          <div>
            <span className="font-semibold">Actionable Insights:</span>
            <div className="mt-1 text-gray-700">
              {interpretation.actionableInsights.map((insight, idx) => (
                <div key={idx} className="ml-2">{insight}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
          <span className="font-semibold">Clinical Note:</span> The coupling constant (K) represents the strength of interaction between physiological systems.
          This analysis shows how synchronized the patient's various clinical parameters are, which can indicate overall system stability and coordination.
        </div>
      </div>
    </div>
  );
};

// Bayesian Analysis Component
const BayesianAnalysis = ({ patientData, processedData, suspectedDiagnoses = [] }) => {
  const [localDiseaseDatabase, setLocalDiseaseDatabase] = useState(diseaseDatabase);
  const svgRef = useRef(null);
  const [d3Module, setD3Module] = useState(null);

  useEffect(() => {
    D3Module.load().then(d3 => {
      setD3Module(d3);
    });
  }, []);

  const hasData = patientData && processedData && Object.values(processedData).flat().length > 0;

  useEffect(() => {
    if (!hasData) return;

    const newDiseases = {};

    suspectedDiagnoses.forEach(diagnosis => {
      if (!localDiseaseDatabase[diagnosis]) {
        newDiseases[diagnosis] = {
          symptoms: patientData.subjective.symptoms.slice(0, 5),
          labs: {},
          vitals: {},
          prior: 0.03,
          isUserAdded: true
        };

        patientData.objective.laboratory.forEach(lab => {
          if (lab.value) {
            newDiseases[diagnosis].labs[lab.name] = {
              value: parseFloat(lab.value),
              indicator: 'check'
            };
          }
        });
      }
    });

    const symptomString = patientData.subjective.symptoms.join(' ');
    const similarDiseases = findSimilarDiseases(symptomString);

    if (Array.isArray(similarDiseases)) {
      similarDiseases.slice(0, 3).forEach(({ disease, similarity }) => {
        if (disease && !localDiseaseDatabase[disease] && similarity > 0.3) {
          if (diseaseDatabase[disease]) {
            newDiseases[disease] = {
              ...diseaseDatabase[disease],
              isSimilarityBased: true,
              similarity: similarity
            };
          }
        }
      });
    }

    if (Object.keys(newDiseases).length > 0) {
      setLocalDiseaseDatabase(prev => ({ ...prev, ...newDiseases }));
    }
  }, [suspectedDiagnoses, patientData, hasData]);

  const calculateLikelihood = useCallback((disease, diseaseInfo, data) => {
    let likelihood = 1.0;
    let matchCount = 0;
    let totalChecks = 0;

    if (diseaseInfo.isUserAdded && suspectedDiagnoses.includes(disease)) {
      likelihood *= 2.0;
    }

    if (data.subjective.chiefComplaint) {
      const complaint = data.subjective.chiefComplaint.toLowerCase();
      if (Array.isArray(diseaseInfo.symptoms)) {
        diseaseInfo.symptoms.forEach(symptom => {
          totalChecks++;
          if (complaint.includes(symptom)) {
            likelihood *= 2.5;
            matchCount++;
          }
        });
      }
    }

    const symptoms = data.subjective.symptoms || [];
    if (Array.isArray(symptoms)) {
      symptoms.forEach(patientSymptom => {
        const symptomLower = patientSymptom.toLowerCase();
        if (Array.isArray(diseaseInfo.symptoms)) {
          diseaseInfo.symptoms.forEach(diseaseSymptom => {
            totalChecks++;
            if (symptomLower.includes(diseaseSymptom) || diseaseSymptom.includes(symptomLower)) {
              likelihood *= 1.8;
              matchCount++;
            }
          });
        }
      });
    }

    const vitals = data.objective.vitals || {};
    Object.entries(diseaseInfo.vitals || {}).forEach(([vital, criteria]) => {
      totalChecks++;
      const value = parseFloat(vitals[vital]);
      if (!isNaN(value)) {
        let matches = false;
        if (criteria.min && value >= criteria.min) matches = true;
        if (criteria.max && value <= criteria.max) matches = true;
        if (matches) {
          likelihood *= 2.0;
          matchCount++;
        }
      }
    });

    const labs = data.objective.laboratory || [];
    labs.forEach(lab => {
      if (lab.name && lab.value && diseaseInfo.labs && diseaseInfo.labs[lab.name]) {
        totalChecks++;
        const criteria = diseaseInfo.labs[lab.name];
        const value = parseFloat(lab.value);
        if (!isNaN(value)) {
          let matches = false;
          if (criteria.min && value >= criteria.min) matches = true;
          if (criteria.max && value <= criteria.max) matches = true;
          if (criteria.indicator === 'abnormal' && (value < criteria.min || value > criteria.max)) matches = true;
          if (matches) {
            likelihood *= 3.0;
            matchCount++;
          }
        }
      }
    });

    const matchRatio = totalChecks > 0 ? matchCount / totalChecks : 0;
    likelihood *= (1 + matchRatio);

    return Math.min(likelihood, 10);
  }, [suspectedDiagnoses]);

  const posteriorProbabilities = useMemo(() => {
    if (!hasData) return [];

    const likelihoods = {};
    let totalEvidence = 0;

    Object.entries(localDiseaseDatabase).forEach(([disease, diseaseInfo]) => {
      const likelihood = calculateLikelihood(disease, diseaseInfo, patientData);
      likelihoods[disease] = likelihood;
      totalEvidence += diseaseInfo.prior * likelihood;
    });

    const posteriors = {};
    Object.entries(localDiseaseDatabase).forEach(([disease, diseaseInfo]) => {
      posteriors[disease] = totalEvidence > 0
        ? (diseaseInfo.prior * likelihoods[disease]) / totalEvidence
        : diseaseInfo.prior;
    });

    const sorted = Object.entries(posteriors)
      .sort((a, b) => b[1] - a[1])
      .map(([disease, prob]) => ({
        disease,
        probability: prob,
        likelihood: likelihoods[disease],
        prior: localDiseaseDatabase[disease].prior,
        isUserAdded: localDiseaseDatabase[disease].isUserAdded
      }));

    const top5 = sorted.filter(d => !d.isUserAdded).slice(0, 5);
    const significantUserAdded = sorted.filter(d => d.isUserAdded && d.probability > 0.01);

    return [...top5, ...significantUserAdded];
  }, [patientData, localDiseaseDatabase, suspectedDiagnoses, calculateLikelihood, hasData]);

  useEffect(() => {
    if (!svgRef.current || posteriorProbabilities.length === 0 || !hasData || !d3Module) return;

    const svg = d3Module.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 20, bottom: 120, left: 50 };
    const width = 450 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3Module.scaleBand()
      .range([0, width])
      .padding(0.1)
      .domain(posteriorProbabilities.map(d => d.disease));

    const y = d3Module.scaleLinear()
      .range([height, 0])
      .domain([0, Math.max(...posteriorProbabilities.map(d => d.probability))]);

    const gradientCore = svg.append("defs")
      .append("linearGradient")
      .attr("id", "bar-gradient-core")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");

    gradientCore.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#4a90e2");

    gradientCore.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#357abd");

    const gradientUser = svg.append("defs")
      .append("linearGradient")
      .attr("id", "bar-gradient-user")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");

    gradientUser.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#9b59b6");

    gradientUser.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#8e44ad");

    g.selectAll(".bar")
      .data(posteriorProbabilities)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.disease))
      .attr("width", x.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .attr("fill", d => d.isUserAdded ? "url(#bar-gradient-user)" : "url(#bar-gradient-core)")
      .transition()
      .duration(750)
      .attr("y", d => y(d.probability))
      .attr("height", d => height - y(d.probability));

    g.selectAll(".text")
      .data(posteriorProbabilities)
      .enter().append("text")
      .attr("x", d => x(d.disease) + x.bandwidth() / 2)
      .attr("y", d => y(d.probability) - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .text(d => (d.probability * 100).toFixed(1) + '%');

    g.selectAll(".likelihood")
      .data(posteriorProbabilities)
      .enter().append("text")
      .attr("x", d => x(d.disease) + x.bandwidth() / 2)
      .attr("y", d => y(d.probability) + 15)
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", "#666")
      .text(d => `L: ${d.likelihood.toFixed(2)}`);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3Module.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em");

    // Y axis
    g.append("g")
      .call(d3Module.axisLeft(y).ticks(5).tickFormat(d => (d * 100).toFixed(0) + '%'));

    // Title
    svg.append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text("Bayesian Disease Probability Analysis");

    // Legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width + margin.left - 100}, 40)`);

    legend.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", "url(#bar-gradient-core)");

    legend.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .attr("font-size", "10px")
      .text("Core DB");

    legend.append("rect")
      .attr("y", 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", "url(#bar-gradient-user)");

    legend.append("text")
      .attr("x", 20)
      .attr("y", 32)
      .attr("font-size", "10px")
      .text("Suspected");

  }, [posteriorProbabilities, hasData, d3Module]);

  if (!hasData || !d3Module) {
    return (
      <div className="bg-white border-2 border-gray-300 p-4">
        <h3 className="text-sm font-bold mb-3">Bayesian Disease Analysis</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          {!d3Module ? (
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          ) : (
            "No patient data available. Enter clinical data to begin analysis."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-300 p-4">
      <h3 className="text-sm font-bold mb-3">Bayesian Disease Analysis</h3>
      <svg ref={svgRef} width={450} height={350} />
      <div className="mt-4 space-y-2 text-xs">
        <div className="font-semibold">Top Differential Diagnoses:</div>
        {posteriorProbabilities.slice(0, 5).map((result, idx) => (
          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span className={`font-medium ${result.isUserAdded ? 'text-purple-600' : ''}`}>
              {idx + 1}. {result.disease}
            </span>
            <div className="text-right">
              <span className="font-bold">{(result.probability * 100).toFixed(1)}%</span>
              <span className="text-gray-500 ml-2">
                (Prior: {(result.prior * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Replace the N8nResultsDisplay component with this improved version:
const N8nResultsDisplay = ({ results }) => {
  const [displayFormat, setDisplayFormat] = useState('bullets');

  if (!results) return null;

  const renderBulletFormat = () => {
    return (
      <div className="space-y-4">
        {results.urgency_level && (
          <div className={`p-3 rounded ${
            results.urgency_level === 'EMERGENT' ? 'bg-red-100 border-red-300' :
            results.urgency_level === 'URGENT' ? 'bg-orange-100 border-orange-300' :
            results.urgency_level === 'SEMI-URGENT' ? 'bg-yellow-100 border-yellow-300' :
            'bg-green-100 border-green-300'
          } border`}>
            <h4 className="font-semibold text-sm mb-1">Urgency Level: {results.urgency_level}</h4>
            {results.critical_findings?.triage_recommendation && (
              <p className="text-sm">{results.critical_findings.triage_recommendation}</p>
            )}
          </div>
        )}

        {results.summary && (
          <div className="bg-blue-50 p-3 rounded">
            <h4 className="font-semibold text-sm mb-1">Summary:</h4>
            <p className="text-sm text-gray-700">{results.summary}</p>
          </div>
        )}

        {results.diagnoses && results.diagnoses.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Suggested Diagnoses:</h4>
            <ul className="list-disc list-inside space-y-1">
              {results.diagnoses.map((diagnosis, idx) => (
                <li key={idx} className="text-sm text-gray-700">
                  {typeof diagnosis === 'object' ?
                    `${diagnosis.description || diagnosis.condition} ${diagnosis.icd10_code ? `(${diagnosis.icd10_code})` : ''} - ${(diagnosis.probability * 100 || diagnosis.confidence * 100 || 0).toFixed(0)}% confidence` :
                    diagnosis
                  }
                </li>
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

        {results.labs_to_order && results.labs_to_order.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Suggested Labs:</h4>
            <ul className="list-disc list-inside space-y-1">
              {results.labs_to_order.map((lab, idx) => (
                <li key={idx} className="text-sm text-gray-700">{lab}</li>
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
    );
  };

  const renderTextFormat = () => {
    return (
      <div className="prose prose-sm max-w-none space-y-4">
        {results.summary && (
          <div>
            <h4 className="font-semibold">Clinical Summary</h4>
            <p className="text-gray-700">{results.summary}</p>
          </div>
        )}

        {results.diagnostic_report && (
          <div>
            <h4 className="font-semibold">Diagnostic Report</h4>
            {results.diagnostic_report.clinical_reasoning && (
              <p className="text-gray-700">{results.diagnostic_report.clinical_reasoning}</p>
            )}
            {results.diagnostic_report.primary_diagnosis && (
              <p className="text-gray-700 mt-2">
                <strong>Primary Diagnosis:</strong> {results.diagnostic_report.primary_diagnosis.description}
                ({results.diagnostic_report.primary_diagnosis.icd10_code})
              </p>
            )}
          </div>
        )}

        {results.critical_findings && results.critical_findings.red_flags && (
          <div>
            <h4 className="font-semibold text-red-600">Critical Findings</h4>
            <ul className="list-disc list-inside">
              {results.critical_findings.red_flags.map((flag, idx) => (
                <li key={idx} className="text-red-700">{flag}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderJsonFormat = () => {
    return (
      <pre className="text-xs overflow-auto bg-gray-50 p-3 rounded">
        {JSON.stringify(results, null, 2)}
      </pre>
    );
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 size={18} />
          AI Analysis Results
          <span className="text-xs text-gray-500 font-normal">
            {results.timestamp ? new Date(results.timestamp).toLocaleTimeString() : ''}
          </span>
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
            onClick={() => setDisplayFormat('text')}
            className={`px-3 py-1 text-xs rounded ${
              displayFormat === 'text' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Report
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
        {displayFormat === 'bullets' && renderBulletFormat()}
        {displayFormat === 'text' && renderTextFormat()}
        {displayFormat === 'json' && renderJsonFormat()}
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

  // Connect to WebSocket on mount
  useEffect(() => {
    console.log('Home page mounted');
    console.log('Backend URL:', config.BACKEND_URL);
    
    const connectTimer = setTimeout(() => {
      try {
        websocketService.connect();

        websocketService.onN8nUpdate((data) => {
          console.log('Received n8n update:', data);
          setN8nResults(data);
          setN8nStatus('connected');

          if (data.diagnoses) {
            setSuspectedDiagnoses(prev => [...new Set([...prev, ...data.diagnoses])]);
          }
        });

        websocketService.onConnectionError((error) => {
          console.warn('WebSocket connection failed, continuing in offline mode');
          setN8nStatus('offline');
        });
      } catch (error) {
        console.error('WebSocket setup error:', error);
        setN8nStatus('offline');
      }
    }, 100);

    return () => {
      clearTimeout(connectTimer);
      websocketService.disconnect();
    };
  }, []);

  // Preload data files on mount
  useEffect(() => {
    const criticalFiles = [
      'symptoms',
      'medications',
      'allergies',
      'past_medical_history',
      'past_surgical_history',
      'vital_signs',
      'laboratory_tests',
      'imaging_studies',
      'diagnoses'
    ];
    preloadDataFiles(criticalFiles);
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

  // Process data into complex plane format
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

    // Process labs
    patientData.objective.laboratory.forEach((lab, idx) => {
      if (lab.value) {
        const angle = 180 + (idx * 25);
        const magnitude = 0.6 + Math.random() * 0.4;
        complexData.labs.push({
          name: `${lab.name}: ${lab.value} ${lab.unit}`,
          real: magnitude * Math.cos(angle * Math.PI / 180),
          imaginary: magnitude * Math.sin(angle * Math.PI / 180),
          magnitude,
          angle,
          color: '#27ae60'
        });
      }
    });

    // Process medications
    patientData.subjective.medications.forEach((med, idx) => {
      const angle = 270 + (idx * 15);
      const magnitude = 0.5 + Math.random() * 0.5;
      complexData.medications.push({
        name: med,
        real: magnitude * Math.cos(angle * Math.PI / 180),
        imaginary: magnitude * Math.sin(angle * Math.PI / 180),
        magnitude,
        angle,
        color: '#f39c12'
      });
    });

    setProcessedData(complexData);
  }, [patientData]);

  // Process data when patient data changes
  useEffect(() => {
    processDataToComplexPlane();
  }, [patientData, processDataToComplexPlane]);

// Replace the submitToN8n function (around line 1971) with this:
const submitToN8n = async () => {
  setIsProcessing(true);
  setError(null);
  setN8nStatus('processing');

  try {
    // Ensure we have at least some clinical data
    if (!patientData.subjective.chiefComplaint &&
        (!patientData.subjective.symptoms || patientData.subjective.symptoms.length === 0)) {
      setError('Please enter a chief complaint or select at least one symptom');
      setN8nStatus('error');
      return;
    }

    // Send to n8n webhook
    const payload = {
      // Patient identification
      patient_id: patientData.demographics.mrn || `TEMP-${Date.now()}`,
      timestamp: new Date().toISOString(),

      // Demographics
      age: patientData.demographics.age || '',
      gender: patientData.demographics.sex || 'Unknown',
      demographics: {
        mrn: patientData.demographics.mrn || `TEMP-${Date.now()}`,
        age: patientData.demographics.age || '',
        sex: patientData.demographics.sex || 'Unknown'
      },

      // Clinical data - ensure proper format
      chief_complaint: patientData.subjective.chiefComplaint || '',
      symptoms: patientData.subjective.symptoms || [],

      // Additional clinical context
      text: `${patientData.subjective.chiefComplaint || 'No chief complaint'}. Patient reports: ${(patientData.subjective.symptoms || []).join(', ') || 'No specific symptoms'}`,

      // Vitals
      vitals: patientData.objective.vitals || {},

      // History and medications
      medications: patientData.subjective.medications || [],
      allergies: patientData.subjective.allergyHistory || [],
      medical_history: patientData.subjective.pastMedicalHistory || [],

      // Diagnostic data
      laboratory: patientData.objective.laboratory || [],
      imaging: patientData.objective.imaging || [],

      // Complex analysis
      complex_analysis: processedData || {},

      // Include nested structure as well (in case n8n expects it)
      subjective: {
        chiefComplaint: patientData.subjective.chiefComplaint || '',
        symptoms: patientData.subjective.symptoms || [],
        medications: patientData.subjective.medications || [],
        allergyHistory: patientData.subjective.allergyHistory || [],
        pastMedicalHistory: patientData.subjective.pastMedicalHistory || [],
        pastSurgicalHistory: patientData.subjective.pastSurgicalHistory || []
      },
      objective: {
        vitals: patientData.objective.vitals || {},
        laboratory: patientData.objective.laboratory || [],
        imaging: patientData.objective.imaging || []
      }
    };

    console.log('Sending to n8n:', payload);
    console.log('Chief complaint:', payload.chief_complaint);
    console.log('Symptoms count:', payload.symptoms.length);

    const response = await fetch(config.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('n8n response:', result);

    // Set the results immediately
    setN8nResults({
      diagnoses: result.diagnoses || result.diagnosis_list || [],
      recommendations: result.recommendations || [],
      labs_to_order: result.labs_to_order || [],
      confidence: result.confidence || 0,
      summary: result.summary || 'Analysis complete',
      urgency_level: result.urgency_level || 'ROUTINE',
      critical_findings: result.critical_findings || {},
      diagnostic_report: result.diagnostic_report || {},
      timestamp: new Date().toISOString()
    });

    setN8nStatus('completed');

    // Update suspected diagnoses if we got any
    if (result.diagnoses && result.diagnoses.length > 0) {
      setSuspectedDiagnoses(prev => {
        const newDiagnoses = result.diagnoses.filter(d => !prev.includes(d));
        return [...prev, ...newDiagnoses];
      });
    }

  } catch (err) {
    console.error('Error submitting to n8n:', err);
    setError(`Failed to analyze: ${err.message}`);
    setN8nStatus('error');

    // Provide mock results for testing if n8n fails
    if (patientData.subjective.symptoms.length > 0) {
      setN8nResults({
        diagnoses: ['Differential diagnosis pending', 'Further evaluation needed'],
        recommendations: [
          'Complete physical examination',
          'Review vital signs trend',
          'Consider additional testing'
        ],
        labs_to_order: ['CBC', 'BMP', 'Urinalysis'],
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
        {/* Header */}
        <div className="bg-white shadow-md rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Brain className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-800">DiagnoVera Enterprise</h1>
              <span className="text-sm text-gray-500">Clinical Decision Support System</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {n8nStatus === 'connected' ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : n8nStatus === 'offline' ? (
                  <WifiOff className="h-4 w-4 text-yellow-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs text-gray-600">
                  {n8nStatus === 'offline' ? 'Offline Mode' : `n8n: ${n8nStatus}`}
                </span>
              </div>
              <button
                onClick={resetForm}
                className="flex items-center gap-2 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                <RotateCcw size={14} />
                Reset
              </button>
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                <Download size={14} />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Patient Data Entry */}
          <div className="lg:col-span-1 space-y-4">
            {/* Demographics */}
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

            {/* Subjective Data */}
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

            {/* Objective Data */}
            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3">Objective Data</h2>

              {/* Vitals */}
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

            {/* Suspected Diagnoses */}
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

            {/* Submit Button */}
            <button
              onClick={submitToN8n}
              disabled={isProcessing || n8nStatus === 'offline'}
              className={`w-full py-3 rounded font-bold flex items-center justify-center gap-2 ${
                isProcessing
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : n8nStatus === 'offline'
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Processing...
                </>
              ) : n8nStatus === 'offline' ? (
                <>
                  <Send size={16} />
                  Analyze Locally (Offline Mode)
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

          {/* Visualizations */}
          <div className="lg:col-span-2 space-y-4">
            {/* Complex Plane Visualization */}
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
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="all">All Domains</option>
                    <option value="symptoms">Symptoms</option>
                    <option value="vitals">Vitals</option>
                    <option value="labs">Labs</option>
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

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Kuramoto Analysis */}
              <KuramotoAnalysis data={processedData} />

              {/* Bayesian Analysis */}
              <BayesianAnalysis
                patientData={patientData}
                processedData={processedData}
                suspectedDiagnoses={suspectedDiagnoses}
              />
            </div>

            {/* n8n Results */}
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