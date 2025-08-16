import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { ChevronDown, X, Loader2, Download, FileText } from 'lucide-react';

// Data cache to prevent redundant fetches
const dataCache = new Map();

// Production data loader hook with caching
const useDataLoader = (dataFile) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dataFile) return;

    // Check cache first
    if (dataCache.has(dataFile)) {
      setData(dataCache.get(dataFile));
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch from public/data directory
        const response = await fetch(`/data/${dataFile}.json`);
        if (!response.ok) throw new Error(`Failed to load ${dataFile}`);
        
        const result = await response.json();
        const items = result.items || [];
        
        // Cache the result
        dataCache.set(dataFile, items);
        setData(items);
      } catch (err) {
        console.error(`Error loading ${dataFile}:`, err);
        setError(err.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataFile]);

  return { data, loading, error };
};

// Preload critical data files
export const preloadDataFiles = (files) => {
  files.forEach(file => {
    if (!dataCache.has(file)) {
      fetch(`/data/${file}.json`)
        .then(res => res.json())
        .then(result => {
          dataCache.set(file, result.items || []);
        })
        .catch(err => console.error(`Failed to preload ${file}:`, err));
    }
  });
};

// Epic-style Autocomplete with performance optimizations
const EpicAutocompleteField = ({ 
  label, 
  dataFile,
  value, 
  onChange, 
  placeholder, 
  multiple = false,
  color = '#5B9BD5',
  maxResults = 50,
  debounceMs = 300
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  
  const { data: options, loading, error } = useDataLoader(dataFile);

  // Debounce search term
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

  // Virtualized filtering with memoization
  const filteredOptions = useMemo(() => {
    if (!debouncedSearchTerm) return options.slice(0, maxResults);
    
    const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    const filtered = [];
    
    // Efficient filtering for large datasets
    for (let i = 0; i < options.length && filtered.length < maxResults; i++) {
      if (options[i].toLowerCase().includes(lowerSearchTerm)) {
        filtered.push(options[i]);
      }
    }
    
    return filtered;
  }, [debouncedSearchTerm, options, maxResults]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((option) => {
    if (multiple) {
      const newValue = Array.isArray(value) ? value : [];
      const updatedValue = newValue.includes(option) 
        ? newValue.filter(v => v !== option)
        : [...newValue, option];
      onChange(updatedValue);
    } else {
      onChange(option);
      setIsOpen(false);
      setSearchTerm('');
      setDebouncedSearchTerm('');
    }
  }, [multiple, value, onChange]);

  const removeItem = useCallback((item, e) => {
    e.stopPropagation();
    const newValue = Array.isArray(value) ? value.filter(v => v !== item) : [];
    onChange(newValue);
  }, [value, onChange]);

  const displayValue = Array.isArray(value) ? value : (value ? [value] : []);

  if (error) {
    return (
      <div className="mb-3">
        <label className="block text-xs font-semibold text-red-600 mb-1">
          {label} - Error loading options
        </label>
        <div className="text-xs text-red-500">{error}</div>
      </div>
    );
  }

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
        className="relative bg-white border-2 border-gray-200 hover:border-[#4a90e2] transition-all cursor-pointer"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
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
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={displayValue.length === 0 ? placeholder : ''}
            className="flex-1 outline-none text-sm"
            onFocus={() => setIsOpen(true)}
          />
          
          <ChevronDown className={`ml-2 h-3 w-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-[#4a90e2] shadow-lg max-h-48 overflow-auto">
            {loading ? (
              <div className="p-3 text-gray-500 text-center text-sm">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                Loading options...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-gray-500 text-center text-sm">
                {searchTerm ? 'No matches found' : 'Start typing to search...'}
              </div>
            ) : (
              <>
                {debouncedSearchTerm && (
                  <div className="p-2 bg-gray-50 border-b text-xs text-gray-600">
                    Showing {filteredOptions.length} of {options.length} options
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
                      displayValue.includes(option) ? 'bg-blue-100 font-medium' : ''
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

// Imaging Field Component with findings
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

  // Debounce search
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
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="flex-1 outline-none text-sm"
            onFocus={() => setIsOpen(true)}
          />
          <ChevronDown className="ml-2 h-3 w-3 text-gray-400" />
        </div>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-[#FECA57] shadow-lg max-h-48 overflow-auto">
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

// Lab Field Component with performance optimizations
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

  // Debounce search
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
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="flex-1 outline-none text-sm"
            onFocus={() => setIsOpen(true)}
          />
          <ChevronDown className="ml-2 h-3 w-3 text-gray-400" />
        </div>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-[#70AD47] shadow-lg max-h-48 overflow-auto">
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

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
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

    // Connection polygon
    if (showConnections && allPoints.length > 2) {
      const hull = d3.polygonHull(allPoints.map(p => {
        const angle = p.angle * Math.PI / 180;
        return [
          radius * p.magnitude * Math.cos(angle),
          radius * p.magnitude * Math.sin(angle)
        ];
      }));

      if (hull) {
        g.append("path")
          .datum(hull)
          .attr("d", d => "M" + d.join("L") + "Z")
          .attr("fill", "rgba(74, 144, 226, 0.1)")
          .attr("stroke", "#4a90e2")
          .attr("stroke-width", 2);
      }
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

  }, [data, showConnections, showLabels, selectedDomains]);

  return (
    <svg ref={svgRef} width={500} height={500} className="border border-gray-300 bg-white" />
  );
});

// Main Component
const DiagnoVeraEpicInterface = () => {
  const [currentDomain, setCurrentDomain] = useState('subjective');
  const [showConnectedLines, setShowConnectedLines] = useState(true);
  const [showDataLabels, setShowDataLabels] = useState(true);
  const [selectedGraphDomains, setSelectedGraphDomains] = useState('all');

  const [patientData, setPatientData] = useState({
    demographics: {
      age: '',
      sex: '',
      mrn: '',
      name: '',
      provider: ''
    },
    subjective: {
      chiefComplaint: '',
      symptoms: [],
      pastMedicalHistory: [],
      pastSurgicalHistory: [],
      socialHistory: [],
      familyHistory: [],
      allergyHistory: [],
      medications: []
    },
    objective: {
      vitals: {
        weight: '',
        temperature: '',
        heartRate: '',
        respiratoryRate: '',
        systolicBP: '',
        diastolicBP: '',
        o2Saturation: '',
        urineOutput: '',
        urineOutputUnit: 'mL/hr'
      },
      laboratory: [],
      examFindings: [],
      imaging: [],
      procedures: [],
      pathology: []
    }
  });

  // Preload critical data files on mount
  useEffect(() => {
    preloadDataFiles([
      'chief-complaints',
      'symptoms',
      'laboratory-tests',
      'exam-findings',
      'imaging-studies'
    ]);
  }, []);

  // CONSISTENT Domain configuration with FIXED angular positions
  const domainConfig = {
    // Subjective domains (0-180°)
    chiefComplaint: { color: '#E84855', baseAngle: 0, angleStep: 0, magnitude: 0.9 },
    symptoms: { color: '#3CBBB1', baseAngle: 15, angleStep: 5, magnitude: 0.7 },
    pastMedicalHistory: { color: '#8B5A3C', baseAngle: 45, angleStep: 4, magnitude: 0.6 },
    pastSurgicalHistory: { color: '#D4A574', baseAngle: 70, angleStep: 4, magnitude: 0.6 },
    socialHistory: { color: '#4682B4', baseAngle: 95, angleStep: 4, magnitude: 0.5 },
    familyHistory: { color: '#9370DB', baseAngle: 120, angleStep: 4, magnitude: 0.5 },
    allergyHistory: { color: '#DC143C', baseAngle: 145, angleStep: 4, magnitude: 0.8 },
    medications: { color: '#FF6B6B', baseAngle: 170, angleStep: 3, magnitude: 0.7 },
    
    // Objective domains (180-360°)
    vitals: { color: '#4ECDC4', baseAngle: 180, angleStep: 5, magnitude: 0.8 },
    laboratory: { color: '#95E1D3', baseAngle: 225, angleStep: 3, magnitude: 0.7 },
    examFindings: { color: '#F38181', baseAngle: 270, angleStep: 4, magnitude: 0.6 },
    imaging: { color: '#FECA57', baseAngle: 315, angleStep: 5, magnitude: 0.65 },
    procedures: { color: '#48DBFB', baseAngle: 340, angleStep: 4, magnitude: 0.7 },
    pathology: { color: '#FF9FF3', baseAngle: 355, angleStep: 3, magnitude: 0.75 }
  };

  // Deterministic angle calculation
  const getItemAngle = (domainKey, itemIndex, itemValue) => {
    const config = domainConfig[domainKey];
    const hash = itemValue.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const subAngle = (hash % 10) * 0.1;
    return (config.baseAngle + (itemIndex * config.angleStep) + subAngle) % 360;
  };

  const updatePatientData = useCallback((domain, field, value) => {
    setPatientData(prev => ({
      ...prev,
      [domain]: {
        ...prev[domain],
        [field]: value
      }
    }));
  }, []);

  const updateVital = useCallback((vitalName, value) => {
    setPatientData(prev => ({
      ...prev,
      objective: {
        ...prev.objective,
        vitals: {
          ...prev.objective.vitals,
          [vitalName]: value
        }
      }
    }));
  }, []);

  // Convert to complex numbers format
  const processedData = useMemo(() => {
    const complexData = {};
    
    const toComplex = (angle, magnitude) => {
      const radian = angle * Math.PI / 180;
      return {
        real: magnitude * Math.cos(radian),
        imaginary: magnitude * Math.sin(radian),
        magnitude,
        angle
      };
    };

    // Process chief complaint
    if (patientData.subjective.chiefComplaint) {
      const angle = getItemAngle('chiefComplaint', 0, patientData.subjective.chiefComplaint);
      complexData.chiefComplaint = [{
        name: patientData.subjective.chiefComplaint,
        ...toComplex(angle, domainConfig.chiefComplaint.magnitude),
        color: domainConfig.chiefComplaint.color
      }];
    }

    // Process all array fields
    const arrayFields = [
      { data: patientData.subjective.symptoms, key: 'symptoms' },
      { data: patientData.subjective.pastMedicalHistory, key: 'pastMedicalHistory' },
      { data: patientData.subjective.pastSurgicalHistory, key: 'pastSurgicalHistory' },
      { data: patientData.subjective.socialHistory, key: 'socialHistory' },
      { data: patientData.subjective.familyHistory, key: 'familyHistory' },
      { data: patientData.subjective.allergyHistory, key: 'allergyHistory' },
      { data: patientData.subjective.medications, key: 'medications' },
      { data: patientData.objective.examFindings, key: 'examFindings' },
      { data: patientData.objective.procedures, key: 'procedures' },
      { data: patientData.objective.pathology, key: 'pathology' }
    ];

    arrayFields.forEach(({ data, key }) => {
      if (Array.isArray(data) && data.length > 0) {
        const sortedData = [...data].sort();
        complexData[key] = sortedData.map((item, index) => {
          const angle = getItemAngle(key, index, item);
          return {
            name: item,
            ...toComplex(angle, domainConfig[key].magnitude),
            color: domainConfig[key].color
          };
        });
      }
    });

    // Process vitals
    const vitalsList = [
      { key: 'weight', name: 'Weight', position: 0 },
      { key: 'temperature', name: 'Temp', position: 1, normal: [97, 99] },
      { key: 'heartRate', name: 'HR', position: 2, normal: [60, 100] },
      { key: 'respiratoryRate', name: 'RR', position: 3, normal: [12, 20] },
      { key: 'systolicBP', name: 'SBP', position: 4, normal: [90, 120] },
      { key: 'diastolicBP', name: 'DBP', position: 5, normal: [60, 80] },
      { key: 'o2Saturation', name: 'O2', position: 6, normal: [95, 100] },
      { key: 'urineOutput', name: 'UO', position: 7 }
    ];

    const vitalsData = [];
    vitalsList.forEach((vital) => {
      const value = patientData.objective?.vitals?.[vital.key];
      if (value) {
        let magnitude = domainConfig.vitals.magnitude;
        if (vital.normal) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            const [min, max] = vital.normal;
            if (numValue < min || numValue > max) {
              magnitude = Math.min(0.95, magnitude * 1.3);
            }
          }
        }
        const angle = domainConfig.vitals.baseAngle + (vital.position * domainConfig.vitals.angleStep);
        let displayValue = `${vital.name}: ${value}`;
        if (vital.key === 'urineOutput' && patientData.objective.vitals.urineOutputUnit) {
          displayValue += ` ${patientData.objective.vitals.urineOutputUnit}`;
        }
        vitalsData.push({
          name: displayValue,
          ...toComplex(angle, magnitude),
          color: domainConfig.vitals.color
        });
      }
    });
    if (vitalsData.length > 0) complexData.vitals = vitalsData;

    // Process laboratory
    const labData = [];
    if (patientData.objective?.laboratory?.length > 0) {
      const sortedLabs = [...patientData.objective.laboratory].sort((a, b) => a.name.localeCompare(b.name));
      sortedLabs.forEach((lab, index) => {
        if (lab.name && lab.value) {
          const angle = getItemAngle('laboratory', index, lab.name);
          labData.push({
            name: `${lab.name}: ${lab.value}${lab.unit || ''}`,
            ...toComplex(angle, domainConfig.laboratory.magnitude),
            color: domainConfig.laboratory.color
          });
        }
      });
    }
    if (labData.length > 0) complexData.laboratory = labData;

    // Process imaging
    const imagingData = [];
    if (patientData.objective?.imaging?.length > 0) {
      const sortedImaging = [...patientData.objective.imaging].sort((a, b) => a.study.localeCompare(b.study));
      sortedImaging.forEach((img, index) => {
        const angle = getItemAngle('imaging', index, img.study);
        const magnitude = img.findings ? domainConfig.imaging.magnitude * 1.1 : domainConfig.imaging.magnitude;
        imagingData.push({
          name: img.study,
          findings: img.findings,
          ...toComplex(angle, magnitude),
          color: domainConfig.imaging.color
        });
      });
    }
    if (imagingData.length > 0) complexData.imaging = imagingData;

    return complexData;
  }, [patientData, domainConfig, getItemAngle]);

  // Export complex data
  const exportComplexData = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      patient: patientData.demographics,
      complexPlaneData: processedData,
      metadata: {
        domainConfig,
        totalDataPoints: Object.values(processedData).flat().length,
        angleMapping: "Consistent deterministic angles based on domain and item position"
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnovera_${patientData.demographics.mrn || 'patient'}_${Date.now()}.json`;
    a.click();
  };

  const renderSubjectiveDomain = () => (
    <div className="space-y-2">
      <EpicAutocompleteField
        label="Chief Complaint"
        dataFile="chief-complaints"
        value={patientData.subjective.chiefComplaint}
        onChange={(value) => updatePatientData('subjective', 'chiefComplaint', value)}
        placeholder="Select chief complaint..."
        color={domainConfig.chiefComplaint.color}
      />
      
      <EpicAutocompleteField
        label="Symptoms"
        dataFile="symptoms"
        value={patientData.subjective.symptoms}
        onChange={(value) => updatePatientData('subjective', 'symptoms', value)}
        placeholder="Add symptoms..."
        multiple={true}
        color={domainConfig.symptoms.color}
      />

      <EpicAutocompleteField
        label="Past Medical History"
        dataFile="past-medical-history"
        value={patientData.subjective.pastMedicalHistory}
        onChange={(value) => updatePatientData('subjective', 'pastMedicalHistory', value)}
        placeholder="Add conditions..."
        multiple={true}
        color={domainConfig.pastMedicalHistory.color}
      />

      <EpicAutocompleteField
        label="Past Surgical History"
        dataFile="past-surgical-history"
        value={patientData.subjective.pastSurgicalHistory}
        onChange={(value) => updatePatientData('subjective', 'pastSurgicalHistory', value)}
        placeholder="Add surgeries..."
        multiple={true}
        color={domainConfig.pastSurgicalHistory.color}
      />

      <EpicAutocompleteField
        label="Social History"
        dataFile="social-history"
        value={patientData.subjective.socialHistory}
        onChange={(value) => updatePatientData('subjective', 'socialHistory', value)}
        placeholder="Add social factors..."
        multiple={true}
        color={domainConfig.socialHistory.color}
      />

      <EpicAutocompleteField
        label="Family History"
        dataFile="family-history"
        value={patientData.subjective.familyHistory}
        onChange={(value) => updatePatientData('subjective', 'familyHistory', value)}
        placeholder="Add family conditions..."
        multiple={true}
        color={domainConfig.familyHistory.color}
      />

      <EpicAutocompleteField
        label="Allergy History"
        dataFile="allergy-history"
        value={patientData.subjective.allergyHistory}
        onChange={(value) => updatePatientData('subjective', 'allergyHistory', value)}
        placeholder="Add allergies..."
        multiple={true}
        color={domainConfig.allergyHistory.color}
      />
      
      <EpicAutocompleteField
        label="Current Medications"
        dataFile="medications"
        value={patientData.subjective.medications}
        onChange={(value) => updatePatientData('subjective', 'medications', value)}
        placeholder="Add medications..."
        multiple={true}
        color={domainConfig.medications.color}
      />
    </div>
  );

  const renderObjectiveDomain = () => (
    <div className="space-y-2">
      {/* Vitals Section */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 p-3">
        <div className="flex items-center mb-2">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: domainConfig.vitals.color }} />
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Vital Signs</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'weight', label: 'Weight (kg)', placeholder: 'kg' },
            { key: 'temperature', label: 'Temperature (°F)', placeholder: '97-99' },
            { key: 'heartRate', label: 'Heart Rate', placeholder: '60-100' },
            { key: 'respiratoryRate', label: 'Resp Rate', placeholder: '12-20' },
            { key: 'systolicBP', label: 'Systolic BP', placeholder: '90-120' },
            { key: 'diastolicBP', label: 'Diastolic BP', placeholder: '60-80' },
            { key: 'o2Saturation', label: 'O2 Sat (%)', placeholder: '95-100' }
          ].map(vital => (
            <div key={vital.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {vital.label}
              </label>
              <input
                type="number"
                value={patientData.objective.vitals[vital.key]}
                onChange={(e) => updateVital(vital.key, e.target.value)}
                className="w-full p-1.5 text-sm border-2 border-gray-200 focus:border-teal-400 rounded"
                placeholder={vital.placeholder}
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Urine Output
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={patientData.objective.vitals.urineOutput}
                onChange={(e) => updateVital('urineOutput', e.target.value)}
                className="flex-1 p-1.5 text-sm border-2 border-gray-200 focus:border-teal-400 rounded"
                placeholder="Amount"
              />
              <select
                value={patientData.objective.vitals.urineOutputUnit}
                onChange={(e) => updateVital('urineOutputUnit', e.target.value)}
                className="w-24 p-1.5 text-sm border-2 border-gray-200 focus:border-teal-400 rounded"
              >
                <option value="mL/hr">mL/hr</option>
                <option value="mL/day">mL/day</option>
                <option value="L/day">L/day</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <EpicLabField
        label="Laboratory Tests"
        dataFile="laboratory-tests"
        value={patientData.objective.laboratory}
        onChange={(value) => updatePatientData('objective', 'laboratory', value)}
        placeholder="Add lab tests..."
        color={domainConfig.laboratory.color}
      />

      <EpicAutocompleteField
        label="Physical Exam"
        dataFile="exam-findings"
        value={patientData.objective.examFindings}
        onChange={(value) => updatePatientData('objective', 'examFindings', value)}
        placeholder="Add findings..."
        multiple={true}
        color={domainConfig.examFindings.color}
      />
      
      <EpicImagingField
        label="Imaging Studies"
        dataFile="imaging-studies"
        value={patientData.objective.imaging}
        onChange={(value) => updatePatientData('objective', 'imaging', value)}
        placeholder="Add imaging study..."
        color={domainConfig.imaging.color}
      />
      
      <EpicAutocompleteField
        label="Procedures"
        dataFile="procedures"
        value={patientData.objective.procedures}
        onChange={(value) => updatePatientData('objective', 'procedures', value)}
        placeholder="Add procedures..."
        multiple={true}
        color={domainConfig.procedures.color}
      />

      <EpicAutocompleteField
        label="Pathology"
        dataFile="pathology"
        value={patientData.objective.pathology}
        onChange={(value) => updatePatientData('objective', 'pathology', value)}
        placeholder="Add pathology..."
        multiple={true}
        color={domainConfig.pathology.color}
      />
    </div>
  );

  // Generate summary table data
  const summaryTableData = useMemo(() => {
    const allData = [];
    Object.entries(processedData).forEach(([domain, points]) => {
      if (Array.isArray(points)) {
        points.forEach(point => {
          allData.push({
            domain: domain.charAt(0).toUpperCase() + domain.slice(1).replace(/([A-Z])/g, ' $1'),
            name: point.name,
            angle: point.angle,
            real: point.real,
            imaginary: point.imaginary,
            magnitude: point.magnitude,
            color: point.color
          });
        });
      }
    });
    return allData.sort((a, b) => a.angle - b.angle);
  }, [processedData]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Epic-style Header */}
      <header className="bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-lg">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-white text-blue-800 px-3 py-1 rounded font-bold text-lg">
                DIAGNOVERA
              </div>
              <div className="text-sm opacity-90">Clinical Complex Analysis System</div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="opacity-75">Provider:</span>
                <input
                  type="text"
                  value={patientData.demographics.provider}
                  onChange={(e) => setPatientData(prev => ({
                    ...prev,
                    demographics: { ...prev.demographics, provider: e.target.value }
                  }))}
                  className="ml-2 px-2 py-1 bg-blue-700 border border-blue-600 rounded text-white placeholder-blue-300"
                  placeholder="Enter name"
                />
              </div>
              <button
                onClick={exportComplexData}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
              >
                <Download size={14} />
                Export Data
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Patient Banner */}
      <div className="bg-white border-b-2 border-gray-300 px-4 py-3">
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'name', label: 'Patient Name', placeholder: 'Last, First' },
            { key: 'mrn', label: 'MRN', placeholder: 'Medical Record #' },
            { key: 'age', label: 'Age', placeholder: 'Years', type: 'number' },
            { key: 'sex', label: 'Sex', type: 'select' }
          ].map(field => (
            <div key={field.key}>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  value={patientData.demographics[field.key]}
                  onChange={(e) => setPatientData(prev => ({
                    ...prev,
                    demographics: { ...prev.demographics, [field.key]: e.target.value }
                  }))}
                  className="w-full p-2 text-sm border-2 border-gray-300 focus:border-blue-500 rounded"
                >
                  <option value="">Select...</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={patientData.demographics[field.key]}
                  onChange={(e) => setPatientData(prev => ({
                    ...prev,
                    demographics: { ...prev.demographics, [field.key]: e.target.value }
                  }))}
                  className="w-full p-2 text-sm border-2 border-gray-300 focus:border-blue-500 rounded"
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 p-4">
        {/* Left Panel - Navigation */}
        <div className="w-48">
          <div className="bg-white border-2 border-gray-300 shadow-md">
            <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white px-3 py-2">
              <h3 className="text-sm font-bold">CHART SECTIONS</h3>
            </div>
            <nav className="p-2">
              {[
                { id: 'subjective', name: 'Subjective', icon: '📝', color: '#3CBBB1' },
                { id: 'objective', name: 'Objective', icon: '🔬', color: '#4ECDC4' }
              ].map(domain => (
                <button
                  key={domain.id}
                  onClick={() => setCurrentDomain(domain.id)}
                  className={`w-full text-left px-3 py-2 mb-1 text-sm font-medium transition-all ${
                    currentDomain === domain.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                  style={{
                    borderLeft: `4px solid ${currentDomain === domain.id ? domain.color : 'transparent'}`
                  }}
                >
                  <span className="mr-2">{domain.icon}</span>
                  {domain.name.toUpperCase()}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Center Panel - Documentation */}
        <div className="flex-1">
          <div className="bg-white border-2 border-gray-300 shadow-md">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2">
              <h3 className="text-sm font-bold uppercase">
                {currentDomain === 'subjective' ? 'Subjective' : 'Objective'} Documentation
              </h3>
            </div>
            <div className="p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {currentDomain === 'subjective' ? renderSubjectiveDomain() : renderObjectiveDomain()}
            </div>
          </div>
        </div>

        {/* Right Panel - Visualization */}
        <div className="w-[520px]">
          <div className="bg-white border-2 border-gray-300 shadow-md">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2">
              <h3 className="text-sm font-bold uppercase">Complex Plane Analysis</h3>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <select
                  value={selectedGraphDomains}
                  onChange={(e) => setSelectedGraphDomains(e.target.value)}
                  className="text-xs border-2 border-gray-300 px-2 py-1 rounded font-medium"
                >
                  <option value="all">ALL DOMAINS</option>
                  <option value="chiefComplaint">Chief Complaint</option>
                  <option value="symptoms">Symptoms</option>
                  <option value="vitals">Vitals</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="examFindings">Exam Findings</option>
                  <option value="imaging">Imaging</option>
                  <option value="procedures">Procedures</option>
                  <option value="pathology">Pathology</option>
                  <option value="medications">Medications</option>
                  <option value="allergyHistory">Allergies</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConnectedLines(!showConnectedLines)}
                    className={`px-3 py-1 text-xs font-bold rounded ${
                      showConnectedLines 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    HULL
                  </button>
                  <button
                    onClick={() => setShowDataLabels(!showDataLabels)}
                    className={`px-3 py-1 text-xs font-bold rounded ${
                      showDataLabels 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    LABELS
                  </button>
                </div>
              </div>
              <ComplexPlaneChart
                data={processedData}
                showConnections={showConnectedLines}
                showLabels={showDataLabels}
                selectedDomains={selectedGraphDomains}
              />
              
              {/* Complex Data Summary Table */}
              <div className="mt-4 border-2 border-gray-300">
                <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-3 py-2">
                  <h4 className="text-xs font-bold uppercase">Complex Data Summary</h4>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left border-r">Domain</th>
                        <th className="px-2 py-1 text-left border-r">Item</th>
                        <th className="px-2 py-1 text-center border-r">Angle°</th>
                        <th className="px-2 py-1 text-center border-r">Real</th>
                        <th className="px-2 py-1 text-center border-r">Imag</th>
                        <th className="px-2 py-1 text-center">Complex</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryTableData.map((item, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="px-2 py-1 border-r">
                            <div className="flex items-center gap-1">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="truncate">{item.domain}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1 border-r truncate" title={item.name}>
                            {item.name}
                          </td>
                          <td className="px-2 py-1 text-center border-r">
                            {item.angle.toFixed(1)}
                          </td>
                          <td className="px-2 py-1 text-center border-r">
                            {item.real.toFixed(3)}
                          </td>
                          <td className="px-2 py-1 text-center border-r">
                            {item.imaginary.toFixed(3)}
                          </td>
                          <td className="px-2 py-1 text-center font-mono text-xs">
                            {item.real.toFixed(2)}{item.imaginary >= 0 ? '+' : ''}{item.imaginary.toFixed(2)}i
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-100 px-3 py-2 text-xs font-semibold">
                  Total Data Points: {summaryTableData.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnoVeraEpicInterface;