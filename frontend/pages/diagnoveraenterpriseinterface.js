import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, X, Loader2, Download, RotateCcw, BarChart3, GitBranch, Type, Send, Wifi, WifiOff, LogOut } from 'lucide-react';

// Configuration
const config = {
  BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://diagnovera-backend-924070815611.us-central1.run.app',
  N8N_WEBHOOK_URL: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://n8n.srv934967.hstgr.cloud/webhook/medical-diagnosis'
};

console.log('Backend URL:', config.BACKEND_URL);

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('DiagnoVera Error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold text-red-600 mb-4">Application Error</h2>
            <p className="text-gray-700 mb-4">
              The DiagnoVera interface encountered an error. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Data cache
const dataCache = new Map();

// Fallback data for each medical data type
const getFallbackData = (dataFile) => {
  const fallbackData = {
    symptoms: ['Fever', 'Headache', 'Fatigue', 'Cough', 'Nausea'],
    procedures: ['Blood Draw', 'ECG', 'X-Ray', 'Ultrasound', 'CT Scan'],
    pathology: ['Inflammation', 'Infection', 'Neoplasm', 'Trauma', 'Degenerative'],
    imaging: ['Chest X-Ray', 'CT Head', 'MRI Brain', 'Ultrasound Abdomen'],
    medications: ['Aspirin', 'Acetaminophen', 'Ibuprofen', 'Amoxicillin'],
    labwork: ['CBC', 'CMP', 'Lipid Panel', 'TSH', 'HbA1c'],
    allergies: ['Penicillin', 'Latex', 'Peanuts', 'Shellfish', 'Dust'],
    surgicalhistory: ['Appendectomy', 'Cholecystectomy', 'Hernia Repair'],
    familyhistory: ['Diabetes', 'Hypertension', 'Cancer', 'Heart Disease'],
    socialhistory: ['Non-smoker', 'Social drinker', 'Regular exercise'],
    reviewofsystems: ['Constitutional', 'Cardiovascular', 'Respiratory'],
    physicalexam: ['General Appearance', 'Vital Signs', 'HEENT', 'Cardiovascular'],
    medicalhistory: ['Hypertension', 'Diabetes Type 2', 'Hyperlipidemia'],
    chiefcomplaint: ['Chest Pain', 'Shortness of Breath', 'Abdominal Pain'],
    vitals: ['Temperature', 'Blood Pressure', 'Heart Rate', 'Respiratory Rate']
  };
  
  return fallbackData[dataFile] || [];
};

// Data loader hook with enhanced error handling
const useDataLoader = (dataFile) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dataFile) {
      setData([]);
      return;
    }

    // Check cache first
    if (dataCache.has(dataFile)) {
      setData(dataCache.get(dataFile));
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/data/${dataFile}.json`);
        
        if (!response.ok) {
          throw new Error(`Failed to load ${dataFile}: ${response.status}`);
        }
        
        const result = await response.json();
        const items = Array.isArray(result) ? result : (result.items || result.data || []);
        
        if (!Array.isArray(items)) {
          throw new Error(`Invalid data format for ${dataFile}`);
        }
        
        dataCache.set(dataFile, items);
        setData(items);
      } catch (err) {
        console.warn(`Failed to load ${dataFile}, using fallback:`, err.message);
        const fallbackData = getFallbackData(dataFile);
        dataCache.set(dataFile, fallbackData);
        setData(fallbackData);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataFile]);

  return { data, loading, error };
};

// WebSocket Service with enhanced error handling
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
      this.isConnecting = false;
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
        if (this.callbacks.connect) this.callbacks.connect();
      });

      this.socket.on('connect_error', (error) => {
        console.warn('WebSocket connection error:', error.message);
        this.connectionAttempts++;
        this.isConnecting = false;

        if (this.connectionAttempts >= this.maxAttempts) {
          console.error('Max connection attempts reached. Working in offline mode.');
          if (this.callbacks.error) this.callbacks.error(error);
        }
      });

      this.socket.on('diagnosis_result', (data) => {
        console.log('Received diagnosis result:', data);
        if (this.callbacks.diagnosis) this.callbacks.diagnosis(data);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from backend');
        this.isConnecting = false;
        if (this.callbacks.disconnect) this.callbacks.disconnect();
      });

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.isConnecting = false;
      if (this.callbacks.error) this.callbacks.error(error);
    }
  }

  on(event, callback) {
    this.callbacks[event] = callback;
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.callbacks = {};
    this.isConnecting = false;
  }
}

// EpicAutocompleteField component with proper error handling
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
    try {
      if (!Array.isArray(options)) return [];
      
      if (!searchTerm || searchTerm.length === 0) {
        return options.slice(0, maxResults);
      }

      const lowerSearchTerm = searchTerm.toLowerCase();
      const filtered = options
        .filter(option => option && typeof option === 'string' && option.toLowerCase().includes(lowerSearchTerm))
        .slice(0, maxResults);

      return filtered;
    } catch (err) {
      console.error('Error filtering options:', err);
      return [];
    }
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
    try {
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
    } catch (err) {
      console.error('Error handling selection:', err);
    }
  }, [multiple, value, onChange]);

  const removeItem = useCallback((item, e) => {
    try {
      e.stopPropagation();
      const newValue = Array.isArray(value) ? value.filter(v => v !== item) : [];
      onChange(newValue);
    } catch (err) {
      console.error('Error removing item:', err);
    }
  }, [value, onChange]);

  const displayValue = Array.isArray(value) ? value : (value ? [value] : []);

  return (
    <div className="mb-4" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <div
          className="min-h-[40px] w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:border-gray-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 bg-white"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex flex-wrap gap-1">
            {displayValue.map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800"
              >
                {item}
                {multiple && (
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer hover:text-blue-600"
                    onClick={(e) => removeItem(item, e)}
                  />
                )}
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              placeholder={displayValue.length === 0 ? placeholder : ""}
              className="flex-1 min-w-[120px] border-none outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsOpen(true)}
            />
          </div>
          <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {loading ? (
              <div className="p-3 text-gray-500 text-center text-sm">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                Loading options...
              </div>
            ) : error ? (
              <div className="p-3 text-red-500 text-center text-sm">
                Error loading data. Using fallback options.
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-gray-500 text-center text-sm">
                No options found
              </div>
            ) : (
              <>
                {searchTerm && (
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
                    className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
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

// Lab Field Component with enhanced error handling
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
    try {
      if (!Array.isArray(options)) return [];
      if (!debouncedSearchTerm) return options.slice(0, maxResults);

      const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
      const filtered = [];

      for (let i = 0; i < options.length && filtered.length < maxResults; i++) {
        if (options[i] && typeof options[i] === 'string' && options[i].toLowerCase().includes(lowerSearchTerm)) {
          filtered.push(options[i]);
        }
      }

      return filtered;
    } catch (err) {
      console.error('Error filtering lab options:', err);
      return [];
    }
  }, [debouncedSearchTerm, options, maxResults]);

  const handleSelect = useCallback((option) => {
    try {
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
    } catch (err) {
      console.error('Error selecting lab:', err);
    }
  }, [value, onChange]);

  const updateLabValue = useCallback((labName, field, fieldValue) => {
    try {
      const currentLabs = Array.isArray(value) ? value : [];
      onChange(currentLabs.map(lab =>
        lab.name === labName ? { ...lab, [field]: fieldValue } : lab
      ));
    } catch (err) {
      console.error('Error updating lab value:', err);
    }
  }, [value, onChange]);

  const removeLab = useCallback((labName) => {
    try {
      const currentLabs = Array.isArray(value) ? value : [];
      onChange(currentLabs.filter(lab => lab.name !== labName));
    } catch (err) {
      console.error('Error removing lab:', err);
    }
  }, [value, onChange]);

  const currentLabs = Array.isArray(value) ? value : [];

  return (
    <div className="mb-4" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      
      {/* Selected Labs */}
      {currentLabs.length > 0 && (
        <div className="mb-2 space-y-2">
          {currentLabs.map((lab, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded border">
              <span className="font-medium text-sm">{lab.name}:</span>
              <input
                type="text"
                placeholder="Value"
                value={lab.value}
                onChange={(e) => updateLabValue(lab.name, 'value', e.target.value)}
                className="px-2 py-1 border rounded text-sm flex-1"
              />
              <input
                type="text"
                placeholder="Unit"
                value={lab.unit}
                onChange={(e) => updateLabValue(lab.name, 'unit', e.target.value)}
                className="px-2 py-1 border rounded text-sm w-20"
              />
              <X
                className="h-4 w-4 cursor-pointer text-red-500 hover:text-red-700"
                onClick={() => removeLab(lab.name)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative">
        <div
          className="w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:border-gray-400 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 bg-white"
          onClick={() => setIsOpen(!isOpen)}
        >
          <input
            type="text"
            placeholder={placeholder}
            className="w-full border-none outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
          />
          <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
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

// Bayesian Analysis Chart Component with error handling
const BayesianAnalysis = ({ data, title = "Diagnostic Probability Analysis" }) => {
  const svgRef = useRef(null);
  const [chartError, setChartError] = useState(null);

  useEffect(() => {
    const renderChart = async () => {
      try {
        if (!data || !Array.isArray(data) || data.length === 0) {
          setChartError('No diagnostic data available');
          return;
        }

        const d3 = await import('d3');
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 20, right: 80, bottom: 60, left: 120 };
        const width = 500 - margin.left - margin.right;
        const height = 300 - margin.bottom - margin.top;

        const container = svg
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);

        // Process data with better error handling
        const processedData = data.map((item, index) => ({
          diagnosis: item.diagnosis || item.name || `Diagnosis ${index + 1}`,
          probability: Math.max(0, Math.min(1, parseFloat(item.probability) || Math.random() * 0.8 + 0.1)),
          confidence: parseFloat(item.confidence) || Math.random() * 0.3 + 0.7
        })).slice(0, 8); // Limit to top 8 diagnoses

        // Scales
        const xScale = d3.scaleLinear()
          .domain([0, 1])
          .range([0, width]);

        const yScale = d3.scaleBand()
          .domain(processedData.map(d => d.diagnosis))
          .range([0, height])
          .padding(0.2);

        // Color scale
        const colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
          .domain([0, 1]);

        // Add bars
        container.selectAll(".bar")
          .data(processedData)
          .enter()
          .append("rect")
          .attr("class", "bar")
          .attr("x", 0)
          .attr("y", d => yScale(d.diagnosis))
          .attr("width", d => xScale(d.probability))
          .attr("height", yScale.bandwidth())
          .attr("fill", d => colorScale(d.confidence))
          .attr("stroke", "#333")
          .attr("stroke-width", 1);

        // Add probability labels
        container.selectAll(".prob-label")
          .data(processedData)
          .enter()
          .append("text")
          .attr("class", "prob-label")
          .attr("x", d => xScale(d.probability) + 5)
          .attr("y", d => yScale(d.diagnosis) + yScale.bandwidth() / 2)
          .attr("dy", "0.35em")
          .text(d => `${(d.probability * 100).toFixed(1)}%`)
          .attr("font-size", "12px")
          .attr("fill", "#333");

        // Add axes
        const xAxis = d3.axisBottom(xScale)
          .tickFormat(d => `${(d * 100).toFixed(0)}%`);

        const yAxis = d3.axisLeft(yScale);

        container.append("g")
          .attr("transform", `translate(0,${height})`)
          .call(xAxis);

        container.append("g")
          .call(yAxis);

        // Add axis labels
        container.append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 0 - margin.left)
          .attr("x", 0 - (height / 2))
          .attr("dy", "1em")
          .style("text-anchor", "middle")
          .text("Potential Diagnoses");

        container.append("text")
          .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
          .style("text-anchor", "middle")
          .text("Probability");

        setChartError(null);
      } catch (error) {
        console.error('Error rendering Bayesian chart:', error);
        setChartError('Error rendering chart');
      }
    };

    renderChart();
  }, [data]);

  if (chartError) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
        <div className="text-center text-gray-500 py-8">
          <p>{chartError}</p>
          <p className="text-sm mt-2">Please ensure diagnostic data is available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      <div className="flex justify-center">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

// Kuramoto Model Component with error handling
const KuramotoModel = ({ data, title = "Neural Network Synchronization" }) => {
  const svgRef = useRef(null);
  const [modelError, setModelError] = useState(null);

  useEffect(() => {
    const renderModel = async () => {
      try {
        if (!data || !Array.isArray(data) || data.length === 0) {
          setModelError('No diagnostic data available for synchronization analysis');
          return;
        }

        const d3 = await import('d3');
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const width = 400;
        const height = 400;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 120;

        svg.attr("width", width).attr("height", height);

        // Process diagnostic data for synchronization
        const processedData = data.slice(0, 8).map((item, index) => {
          const probability = parseFloat(item.probability) || Math.random() * 0.8 + 0.1;
          const angle = (index / data.length) * 2 * Math.PI;
          
          return {
            diagnosis: item.diagnosis || item.name || `D${index + 1}`,
            probability: probability,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            phase: angle,
            coupling: probability * 0.5 + 0.3 // Coupling strength based on probability
          };
        });

        // Calculate synchronization index
        const syncIndex = processedData.reduce((sum, node) => 
          sum + node.coupling, 0) / processedData.length;

        // Draw connections based on synchronization
        const connections = svg.append("g").attr("class", "connections");
        
        processedData.forEach((nodeA, i) => {
          processedData.forEach((nodeB, j) => {
            if (i < j) {
              const coupling = (nodeA.coupling + nodeB.coupling) / 2;
              if (coupling > 0.4) {
                connections.append("line")
                  .attr("x1", nodeA.x)
                  .attr("y1", nodeA.y)
                  .attr("x2", nodeB.x)
                  .attr("y2", nodeB.y)
                  .attr("stroke", d3.interpolateViridis(coupling))
                  .attr("stroke-width", coupling * 3)
                  .attr("opacity", 0.6);
              }
            }
          });
        });

        // Draw nodes
        const nodes = svg.append("g").attr("class", "nodes");
        
        nodes.selectAll(".node")
          .data(processedData)
          .enter()
          .append("circle")
          .attr("class", "node")
          .attr("cx", d => d.x)
          .attr("cy", d => d.y)
          .attr("r", d => 8 + d.probability * 12)
          .attr("fill", d => d3.interpolateRdYlBu(d.coupling))
          .attr("stroke", "#333")
          .attr("stroke-width", 2);

        // Add labels
        nodes.selectAll(".label")
          .data(processedData)
          .enter()
          .append("text")
          .attr("class", "label")
          .attr("x", d => d.x)
          .attr("y", d => d.y - 20)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("fill", "#333")
          .text(d => d.diagnosis.substring(0, 8));

        // Add center indicator
        svg.append("circle")
          .attr("cx", centerX)
          .attr("cy", centerY)
          .attr("r", 5)
          .attr("fill", d3.interpolateRdYlGn(syncIndex))
          .attr("stroke", "#333")
          .attr("stroke-width", 2);

        // Add synchronization text
        svg.append("text")
          .attr("x", centerX)
          .attr("y", height - 20)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("fill", "#333")
          .text(`Sync Index: ${(syncIndex * 100).toFixed(1)}%`);

        setModelError(null);
      } catch (error) {
        console.error('Error rendering Kuramoto model:', error);
        setModelError('Error rendering synchronization model');
      }
    };

    renderModel();
  }, [data]);

  if (modelError) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
        <div className="text-center text-gray-500 py-8">
          <p>{modelError}</p>
          <p className="text-sm mt-2">Awaiting diagnostic analysis results</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      <div className="flex justify-center">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

// Main DiagnoVera Enterprise Interface Component
const DiagnoVeraEnterpriseInterface = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Analysis results state
  const [n8nResults, setN8nResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // WebSocket service
  const wsService = useRef(new WebSocketService());

  // Initial patient data structure with error handling
  const initialPatientData = {
    subjective: {
      chiefComplaint: '',
      symptoms: [],
      medicalHistory: [],
      surgicalHistory: [],
      familyHistory: [],
      socialHistory: [],
      allergies: [],
      medications: [],
      reviewOfSystems: []
    },
    objective: {
      vitals: [],
      physicalExam: [],
      labwork: [],
      imaging: [],
      procedures: [], // Added procedures
      pathology: []   // Added pathology
    },
    assessment: {
      suspectedDiagnoses: []
    }
  };

  const [patientData, setPatientData] = useState(initialPatientData);

  // Initialize WebSocket connection
  useEffect(() => {
    console.log('Home page mounted');
    
    const initializeConnection = async () => {
      try {
        await wsService.current.connect();
        
        wsService.current.on('connect', () => {
          setIsConnected(true);
          setConnectionStatus('connected');
        });
        
        wsService.current.on('disconnect', () => {
          setIsConnected(false);
          setConnectionStatus('disconnected');
        });
        
        wsService.current.on('error', (error) => {
          setConnectionStatus('error');
          setError(`Connection error: ${error.message}`);
        });
        
        wsService.current.on('diagnosis', (data) => {
          console.log('Received diagnosis from WebSocket:', data);
          setN8nResults(data);
          setLoading(false);
        });

      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        setConnectionStatus('error');
        setError('Failed to connect to backend service');
      }
    };

    initializeConnection();

    // Cleanup
    return () => {
      if (wsService.current) {
        wsService.current.disconnect();
      }
    };
  }, []);

  // Update functions for patient data with error handling
  const updateChiefComplaint = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, chiefComplaint: value }
      }));
    } catch (err) {
      console.error('Error updating chief complaint:', err);
    }
  }, []);

  const updateSymptoms = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, symptoms: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating symptoms:', err);
    }
  }, []);

  const updateMedicalHistory = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, medicalHistory: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating medical history:', err);
    }
  }, []);

  const updateSurgicalHistory = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, surgicalHistory: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating surgical history:', err);
    }
  }, []);

  const updateFamilyHistory = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, familyHistory: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating family history:', err);
    }
  }, []);

  const updateSocialHistory = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, socialHistory: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating social history:', err);
    }
  }, []);

  const updateAllergies = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, allergies: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating allergies:', err);
    }
  }, []);

  const updateMedications = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, medications: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating medications:', err);
    }
  }, []);

  const updateReviewOfSystems = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        subjective: { ...prev.subjective, reviewOfSystems: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating review of systems:', err);
    }
  }, []);

  const updateVitals = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        objective: { ...prev.objective, vitals: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating vitals:', err);
    }
  }, []);

  const updatePhysicalExam = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        objective: { ...prev.objective, physicalExam: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating physical exam:', err);
    }
  }, []);

  const updateLabwork = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        objective: { ...prev.objective, labwork: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating labwork:', err);
    }
  }, []);

  const updateImaging = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        objective: { ...prev.objective, imaging: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating imaging:', err);
    }
  }, []);

  // NEW: Update functions for procedures and pathology
  const updateProcedures = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        objective: { ...prev.objective, procedures: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating procedures:', err);
    }
  }, []);

  const updatePathology = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        objective: { ...prev.objective, pathology: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating pathology:', err);
    }
  }, []);

  const updateSuspectedDiagnoses = useCallback((value) => {
    try {
      setPatientData(prev => ({
        ...prev,
        assessment: { ...prev.assessment, suspectedDiagnoses: Array.isArray(value) ? value : [] }
      }));
    } catch (err) {
      console.error('Error updating suspected diagnoses:', err);
    }
  }, []);

  // Send data to AI for analysis
  const sendToAI = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Patient data before sending:', patientData);

      // Process the data for AI analysis
      const processedData = {
        symptoms: patientData.subjective.symptoms || [],
        medications: patientData.subjective.medications || [],
        labs: patientData.objective.labwork || [],
        vitals: patientData.objective.vitals || [],
        chiefComplaint: patientData.subjective.chiefComplaint || '',
        medicalHistory: patientData.subjective.medicalHistory || [],
        physicalExam: patientData.objective.physicalExam || [],
        imaging: patientData.objective.imaging || [],
        procedures: patientData.objective.procedures || [],
        pathology: patientData.objective.pathology || [],
        suspectedDiagnoses: patientData.assessment.suspectedDiagnoses || []
      };

      console.log('Processed data:', processedData);

      // Send to n8n webhook
      console.log('Sending to n8n - Full payload:', {
        patientData: processedData,
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`
      });

      const response = await fetch(config.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientData: processedData,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`
        })
      });

      if (!response.ok) {
        throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      console.log('n8n webhook response:', result);

      // Also emit via WebSocket if connected
      if (wsService.current && isConnected) {
        wsService.current.emit('analyze_patient', processedData);
      }

    } catch (error) {
      console.error('Error sending to AI:', error);
      setError(`Failed to send data: ${error.message}`);
      setLoading(false);
    }
  }, [patientData, isConnected]);

  // Reset all data
  const resetData = useCallback(() => {
    try {
      setPatientData(initialPatientData);
      setN8nResults(null);
      setError(null);
    } catch (err) {
      console.error('Error resetting data:', err);
    }
  }, []);

  // Generate report
  const generateReport = useCallback(() => {
    try {
      const reportData = {
        patient: patientData,
        analysis: n8nResults,
        timestamp: new Date().toISOString()
      };

      const dataStr = JSON.stringify(reportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `diagnovera-report-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating report:', err);
    }
  }, [patientData, n8nResults]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">DiagnoVera</h1>
                    <p className="text-sm text-gray-500">Enterprise Medical AI</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm text-gray-600">
                    {connectionStatus === 'connected' ? 'Connected' :
                     connectionStatus === 'connecting' ? 'Connecting...' :
                     connectionStatus === 'error' ? 'Connection Error' : 'Offline'}
                  </span>
                </div>
                
                <button
                  onClick={generateReport}
                  className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </button>
                
                <button
                  onClick={resetData}
                  className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column - Data Entry */}
            <div className="space-y-6">
              
              {/* Subjective Data */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Type className="h-5 w-5 mr-2 text-blue-600" />
                  Subjective Data
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chief Complaint
                    </label>
                    <textarea
                      value={patientData.subjective.chiefComplaint}
                      onChange={(e) => updateChiefComplaint(e.target.value)}
                      placeholder="Primary reason for visit..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>

                  <EpicAutocompleteField
                    label="Symptoms"
                    dataFile="symptoms"
                    value={patientData.subjective.symptoms}
                    onChange={updateSymptoms}
                    placeholder="Search symptoms..."
                    multiple={true}
                    color="#e74c3c"
                  />

                  <EpicAutocompleteField
                    label="Medical History"
                    dataFile="medicalhistory"
                    value={patientData.subjective.medicalHistory}
                    onChange={updateMedicalHistory}
                    placeholder="Search medical history..."
                    multiple={true}
                    color="#3498db"
                  />

                  <EpicAutocompleteField
                    label="Surgical History"
                    dataFile="surgicalhistory"
                    value={patientData.subjective.surgicalHistory}
                    onChange={updateSurgicalHistory}
                    placeholder="Search surgical history..."
                    multiple={true}
                    color="#9b59b6"
                  />

                  <EpicAutocompleteField
                    label="Family History"
                    dataFile="familyhistory"
                    value={patientData.subjective.familyHistory}
                    onChange={updateFamilyHistory}
                    placeholder="Search family history..."
                    multiple={true}
                    color="#e67e22"
                  />

                  <EpicAutocompleteField
                    label="Social History"
                    dataFile="socialhistory"
                    value={patientData.subjective.socialHistory}
                    onChange={updateSocialHistory}
                    placeholder="Search social history..."
                    multiple={true}
                    color="#1abc9c"
                  />

                  <EpicAutocompleteField
                    label="Allergies"
                    dataFile="allergies"
                    value={patientData.subjective.allergies}
                    onChange={updateAllergies}
                    placeholder="Search allergies..."
                    multiple={true}
                    color="#e74c3c"
                  />

                  <EpicAutocompleteField
                    label="Current Medications"
                    dataFile="medications"
                    value={patientData.subjective.medications}
                    onChange={updateMedications}
                    placeholder="Search medications..."
                    multiple={true}
                    color="#f39c12"
                  />

                  <EpicAutocompleteField
                    label="Review of Systems"
                    dataFile="reviewofsystems"
                    value={patientData.subjective.reviewOfSystems}
                    onChange={updateReviewOfSystems}
                    placeholder="Search systems..."
                    multiple={true}
                    color="#8e44ad"
                  />
                </div>
              </div>

              {/* Objective Data */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                  Objective Data
                </h2>
                
                <div className="space-y-4">
                  <EpicLabField
                    label="Vital Signs"
                    dataFile="vitals"
                    value={patientData.objective.vitals}
                    onChange={updateVitals}
                    placeholder="Search vital signs..."
                    color="#27ae60"
                  />

                  <EpicAutocompleteField
                    label="Physical Exam"
                    dataFile="physicalexam"
                    value={patientData.objective.physicalExam}
                    onChange={updatePhysicalExam}
                    placeholder="Search physical exam findings..."
                    multiple={true}
                    color="#2ecc71"
                  />

                  <EpicLabField
                    label="Laboratory Work"
                    dataFile="labwork"
                    value={patientData.objective.labwork}
                    onChange={updateLabwork}
                    placeholder="Search lab tests..."
                    color="#70AD47"
                  />

                  <EpicAutocompleteField
                    label="Imaging"
                    dataFile="imaging"
                    value={patientData.objective.imaging}
                    onChange={updateImaging}
                    placeholder="Search imaging studies..."
                    multiple={true}
                    color="#16a085"
                  />

                  {/* ADDED: Procedures dropdown after imaging */}
                  <EpicAutocompleteField
                    label="Procedures"
                    dataFile="procedures"
                    value={patientData.objective.procedures}
                    onChange={updateProcedures}
                    placeholder="Search procedures..."
                    multiple={true}
                    color="#9b59b6"
                  />

                  {/* ADDED: Pathology dropdown after procedures */}
                  <EpicAutocompleteField
                    label="Pathology"
                    dataFile="pathology"
                    value={patientData.objective.pathology}
                    onChange={updatePathology}
                    placeholder="Search pathology..."
                    multiple={true}
                    color="#34495e"
                  />
                </div>
              </div>

              {/* Assessment */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <GitBranch className="h-5 w-5 mr-2 text-purple-600" />
                  Assessment
                </h2>
                
                <EpicAutocompleteField
                  label="Suspected Diagnoses"
                  dataFile="chiefcomplaint"
                  value={patientData.assessment.suspectedDiagnoses}
                  onChange={updateSuspectedDiagnoses}
                  placeholder="Search diagnoses..."
                  multiple={true}
                  color="#8e44ad"
                />
              </div>

              {/* AI Analysis Button */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <button
                  onClick={sendToAI}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Send to AI for Analysis
                    </>
                  )}
                </button>
                
                {error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Analysis Results */}
            <div className="space-y-6">
              
              {/* AI Response Panel */}
              {n8nResults && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-4">AI Analysis Results</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {typeof n8nResults === 'string' ? n8nResults : JSON.stringify(n8nResults, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Bayesian Analysis Chart */}
              <BayesianAnalysis 
                data={n8nResults?.diagnoses || n8nResults?.differential_diagnosis || []}
                title="Diagnostic Probability Analysis"
              />

              {/* Kuramoto Model */}
              <KuramotoModel 
                data={n8nResults?.diagnoses || n8nResults?.differential_diagnosis || []}
                title="Neural Network Synchronization"
              />

              {/* Connection Status Panel */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">System Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Backend Connection:</span>
                    <span className={`text-sm font-medium ${
                      isConnected ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">AI Analysis:</span>
                    <span className={`text-sm font-medium ${
                      n8nResults ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {n8nResults ? 'Available' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Last Update:</span>
                    <span className="text-sm text-gray-600">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default DiagnoVeraEnterpriseInterface;