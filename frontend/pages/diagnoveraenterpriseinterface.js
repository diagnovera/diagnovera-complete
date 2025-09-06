// DiagnoVera Enterprise Interface - Complete JavaScript Implementation
// Version 2.0 - Full Production Code with All Fixes Applied
// File size: ~120KB

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, X, Loader2, Download, RotateCcw, BarChart3, GitBranch, Type, Send, Wifi, WifiOff, LogOut } from 'lucide-react';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  BACKEND_URL: 'https://diagnovera-backend-924070815611.us-central1.run.app',
  N8N_WEBHOOK_URL: 'https://n8n.srv934967.hstgr.cloud/webhook/medical-diagnosis'
};

console.log('DiagnoVera Enterprise Interface v2.0 Initialized');
console.log('Backend URL:', config.BACKEND_URL);
console.log('Webhook URL:', config.N8N_WEBHOOK_URL);

// ============================================================================
// CLIENT-ONLY WRAPPER COMPONENT
// ============================================================================

const ClientOnly = ({ children, fallback = null }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return fallback;
  }

  return children;
};

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

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
            {this.state.error && (
              <details className="mt-4 text-xs text-gray-500">
                <summary>Error Details</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// D3 MODULE HANDLER
// ============================================================================

class D3Module {
  static instance = null;
  static loadPromise = null;

  static async load() {
    if (this.instance) return this.instance;
    
    if (!this.loadPromise) {
      this.loadPromise = import('d3').then(module => {
        this.instance = module;
        console.log('D3.js module loaded successfully');
        return module;
      }).catch(error => {
        console.error('Failed to load D3.js:', error);
        throw error;
      });
    }
    
    return this.loadPromise;
  }
}

// ============================================================================
// WEBSOCKET SERVICE
// ============================================================================

class WebSocketService {
  constructor() {
    this.socket = null;
    this.callbacks = {};
    this.connectionAttempts = 0;
    this.maxAttempts = 3;
    this.isConnecting = false;
    this.reconnectTimeout = null;
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
        if (this.callbacks.onConnect) this.callbacks.onConnect();
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
        } else {
          // Retry connection
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, 2000 * this.connectionAttempts);
        }
      });

      this.socket.on('claude_update', (data) => {
        console.log('Received Claude AI update:', data);
        if (this.callbacks.onClaudeUpdate) {
          this.callbacks.onClaudeUpdate(data);
        }
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from backend WebSocket');
        this.isConnecting = false;
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
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
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnecting = false;
    this.connectionAttempts = 0;
  }

  onConnect(callback) {
    this.callbacks.onConnect = callback;
  }

  onClaudeUpdate(callback) {
    this.callbacks.onClaudeUpdate = callback;
  }

  onConnectionError(callback) {
    this.callbacks.onConnectionError = callback;
  }

  onDisconnect(callback) {
    this.callbacks.onDisconnect = callback;
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
      return true;
    }
    return false;
  }
}

const websocketService = new WebSocketService();

// ============================================================================
// DATA CACHE MANAGER
// ============================================================================

const dataCache = new Map();

// ============================================================================
// DATA LOADER HOOK - DIRECT JSON LOADING ONLY
// ============================================================================

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
        // Direct load from public/data folder only
        const primaryPath = `/data/${dataFile}.json`;
        console.log(`Loading data from: ${primaryPath}`);
        
        const response = await fetch(primaryPath);
        
        if (!response.ok) {
          throw new Error(`Failed to load ${dataFile}.json - Status: ${response.status}`);
        }
        
        const result = await response.json();
        const items = Array.isArray(result) ? result : (result.items || result.data || []);
        
        dataCache.set(dataFile, items);
        setData(items);
        console.log(`Successfully loaded ${items.length} items from ${dataFile}.json`);
        
      } catch (err) {
        console.error(`Error loading ${dataFile}:`, err);
        setError(err.message);
        // Return empty array - no fallback data
        setData([]);
        dataCache.set(dataFile, []);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataFile]);

  return { data, loading, error };
};

// ============================================================================
// PRELOAD DATA FILES UTILITY
// ============================================================================

const preloadDataFiles = (files) => {
  if (typeof window === 'undefined') return;
  
  console.log('Preloading data files:', files);
  
  files.forEach(file => {
    if (!dataCache.has(file)) {
      fetch(`/data/${file}.json`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(result => {
          const items = Array.isArray(result) ? result : (result.items || result.data || []);
          dataCache.set(file, items);
          console.log(`Preloaded ${file}: ${items.length} items`);
        })
        .catch(err => {
          console.error(`Failed to preload ${file}:`, err);
          dataCache.set(file, []); // Cache empty array
        });
    }
  });
};

// ============================================================================
// EPIC AUTOCOMPLETE FIELD COMPONENT
// ============================================================================

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
    if (!Array.isArray(options)) return [];
    
    if (!searchTerm || searchTerm.length === 0) {
      return options.slice(0, maxResults);
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = options
      .filter(option => option && typeof option === 'string' && option.toLowerCase().includes(lowerSearchTerm))
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
                <span className="text-xs text-gray-500">+{displayValue.length - 2} more</span>
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
                {searchTerm ? `No matches found for "${searchTerm}"` : "No data available"}
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

// ============================================================================
// EPIC IMAGING FIELD COMPONENT
// ============================================================================

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

  const { data: options, loading, error } = useDataLoader(dataFile);

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
  }, [debouncedSearchTerm, options, maxResults]);

  const handleSelect = useCallback((option) => {
    try {
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
    } catch (err) {
      console.error('Error selecting imaging:', err);
    }
  }, [value, onChange]);

  const updateFindings = useCallback((study, findings) => {
    try {
      const currentImaging = Array.isArray(value) ? value : [];
      onChange(currentImaging.map(img =>
        img.study === study ? { ...img, findings } : img
      ));
    } catch (err) {
      console.error('Error updating findings:', err);
    }
  }, [value, onChange]);

  const removeItem = useCallback((study) => {
    try {
      onChange((Array.isArray(value) ? value : []).filter(img => img.study !== study));
    } catch (err) {
      console.error('Error removing imaging:', err);
    }
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
        <div key={index} className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">{img.study}</div>
              <textarea
                placeholder="Enter imaging findings..."
                value={img.findings}
                onChange={(e) => updateFindings(img.study, e.target.value)}
                className="w-full mt-1 p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:border-yellow-400"
                rows="2"
              />
            </div>
            <button onClick={() => removeItem(img.study)} className="text-red-500 hover:text-red-700 p-1">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}

      <div
        className="relative bg-white border-2 border-gray-200 hover:border-[#FECA57] transition-all"
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

// ============================================================================
// EPIC LAB FIELD COMPONENT
// ============================================================================

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

  const { data: options, loading, error } = useDataLoader(dataFile);

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

  const removeItem = useCallback((labName) => {
    try {
      onChange((Array.isArray(value) ? value : []).filter(lab => lab.name !== labName));
    } catch (err) {
      console.error('Error removing lab:', err);
    }
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
        <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-green-50 border border-green-200 rounded">
          <span className="text-sm font-medium flex-1">{lab.name}</span>
          <input
            type="text"
            placeholder="Value"
            value={lab.value}
            onChange={(e) => updateLabValue(lab.name, 'value', e.target.value)}
            className="w-20 p-1 text-sm border rounded focus:outline-none focus:border-green-400"
          />
          <input
            type="text"
            placeholder="Unit"
            value={lab.unit}
            onChange={(e) => updateLabValue(lab.name, 'unit', e.target.value)}
            className="w-20 p-1 text-sm border rounded focus:outline-none focus:border-green-400"
          />
          <button onClick={() => removeItem(lab.name)} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      ))}

      <div
        className="relative bg-white border-2 border-gray-200 hover:border-[#70AD47] transition-all"
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

// ============================================================================
// COMPLEX PLANE VISUALIZATION COMPONENT
// ============================================================================

const ComplexPlaneChart = React.memo(({ data, showConnections, showLabels, selectedDomains }) => {
  const svgRef = useRef(null);
  const [d3Module, setD3Module] = useState(null);

  useEffect(() => {
    D3Module.load().then(d3 => {
      setD3Module(d3);
    }).catch(err => {
      console.error('Failed to load D3 for ComplexPlaneChart:', err);
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

    // FIX: Improved smooth curve that stays within bounds
    if (showConnections && allPoints.length > 2) {
      // Sort points by angle for smooth curve
      const sortedPoints = [...allPoints].sort((a, b) => a.angle - b.angle);
      
      // Create path data ensuring points stay within radius
      const pathData = sortedPoints.map(point => {
        const constrainedMagnitude = Math.min(point.magnitude, 0.95); // Keep within 95% of radius
        const x = radius * constrainedMagnitude * Math.cos(point.angle * Math.PI / 180);
        const y = radius * constrainedMagnitude * Math.sin(point.angle * Math.PI / 180);
        return { x, y };
      });

      // Add first point at end to close the loop
      pathData.push(pathData[0]);

      const line = d3Module.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3Module.curveCardinalClosed.tension(0.5)); // Smooth closed curve

      g.append("path")
        .datum(pathData)
        .attr("d", line)
        .attr("fill", "rgba(74, 144, 226, 0.1)")
        .attr("stroke", "#4a90e2")
        .attr("stroke-width", 2)
        .attr("stroke-linejoin", "round");
    }

    // Draw points
    allPoints.forEach((point, i) => {
      const constrainedMagnitude = Math.min(point.magnitude, 0.95);
      const angle = point.angle * Math.PI / 180;
      const x = radius * constrainedMagnitude * Math.cos(angle);
      const y = radius * constrainedMagnitude * Math.sin(angle);

      // Connection line from center
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
        .text(`${point.name}\nReal: ${point.real.toFixed(3)}\nImaginary: ${point.imaginary.toFixed(3)}\nMagnitude: ${constrainedMagnitude.toFixed(3)}\nAngle: ${point.angle}°`);

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

// ============================================================================
// KURAMOTO ANALYSIS COMPONENT - AI DATA ONLY
// ============================================================================

const KuramotoAnalysis = ({ data, aiResults }) => {
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

  // Auto-adjust coupling based on AI results
  useEffect(() => {
    if (aiResults) {
      let aiCoupling = 0.8;
      
      if (aiResults.urgency_level === 'EMERGENT') {
        aiCoupling = 0.2;
      } else if (aiResults.urgency_level === 'URGENT') {
        aiCoupling = 0.5;
      } else if (aiResults.urgency_level === 'SEMI-URGENT') {
        aiCoupling = 0.7;
      } else if (aiResults.urgency_level === 'ROUTINE') {
        aiCoupling = 1.0;
      }

      if (aiResults.confidence && aiResults.confidence < 0.5) {
        aiCoupling *= 0.7;
      }

      if (aiResults.critical_findings && aiResults.critical_findings.red_flags && aiResults.critical_findings.red_flags.length > 0) {
        aiCoupling *= 0.5;
      }

      setCoupling(aiCoupling);
    }
  }, [aiResults]);

  // Only add oscillators from AI results
  useEffect(() => {
    if (!hasData || !aiResults) return;

    let newOscillators = [];
    
    // Only process AI differential diagnoses
    if (aiResults.differential_diagnoses && aiResults.differential_diagnoses.length > 0) {
      aiResults.differential_diagnoses.forEach((diagnosis, idx) => {
        const angle = (idx * 45) % 360;
        const probability = diagnosis.probability || (0.9 - idx * 0.1);
        newOscillators.push({
          name: diagnosis.diagnosis || diagnosis.condition || diagnosis,
          phase: (angle * Math.PI / 180),
          naturalFreq: 0.5 + (probability * 0.5),
          magnitude: probability,
          angle: angle,
          color: '#8e44ad',
          domain: 'diagnosis',
          type: 'diagnosis',
          confidence: diagnosis.confidence || probability
        });
      });
    }

    setOscillators(newOscillators);
  }, [data, hasData, aiResults]);

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
      if (N === 0) return;

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
          .attr("r", 8)
          .attr("fill", osc.color || "#4a90e2")
          .attr("stroke", "white")
          .attr("stroke-width", 2)
          .attr("opacity", 0.8);

        // Add diagnosis labels
        g.append("text")
          .attr("x", x)
          .attr("y", y + 20)
          .attr("text-anchor", "middle")
          .attr("font-size", "8px")
          .attr("fill", "#8e44ad")
          .attr("font-weight", "bold")
          .text(osc.name.substring(0, 10) + (osc.name.length > 10 ? '...' : ''));
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
          .attr("r", 8)
          .attr("fill", osc.color || "#4a90e2")
          .attr("stroke", "white")
          .attr("stroke-width", 2);

        // Add diagnosis labels
        g.append("text")
          .attr("x", x)
          .attr("y", y + 20)
          .attr("text-anchor", "middle")
          .attr("font-size", "8px")
          .attr("fill", "#8e44ad")
          .attr("font-weight", "bold")
          .text(osc.name.substring(0, 10) + (osc.name.length > 10 ? '...' : ''));
      });
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [oscillators, coupling, isRunning, d3Module]);

  const getClinicalInterpretation = () => {
    let baseInterpretation;
    
    if (coupling < 0.3) {
      baseInterpretation = {
        state: "Decoupled State",
        color: "#e74c3c",
        interpretation: "Low physiological integration. Body systems operating independently.",
        clinicalSignificance: "May indicate: Shock states, multi-organ dysfunction, severe metabolic derangement."
      };
    } else if (coupling < 0.7) {
      baseInterpretation = {
        state: "Partial Synchronization",
        color: "#f39c12",
        interpretation: "Moderate physiological coupling. Some systems coordinating.",
        clinicalSignificance: "Typical in: Compensated disease states, early decompensation."
      };
    } else if (coupling < 1.2) {
      baseInterpretation = {
        state: "Healthy Synchronization",
        color: "#27ae60",
        interpretation: "Optimal physiological integration. Systems in harmony.",
        clinicalSignificance: "Indicates: Normal homeostasis, effective compensation."
      };
    } else {
      baseInterpretation = {
        state: "Hyper-synchronization",
        color: "#9b59b6",
        interpretation: "Excessive coupling. Reduced adaptability.",
        clinicalSignificance: "Concerning for: Autonomic dysfunction, anxiety states."
      };
    }

    return baseInterpretation;
  };

  const interpretation = getClinicalInterpretation();
  const diagnosisCount = oscillators.filter(osc => osc.type === 'diagnosis').length;

  if (!hasData || !d3Module || !aiResults || !aiResults.differential_diagnoses) {
    return (
      <div className="bg-white border-2 border-gray-300 p-4">
        <h3 className="text-sm font-bold mb-3">Kuramoto Synchronization Analysis</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          {!aiResults ? "Awaiting AI analysis..." : "No differential diagnoses available"}
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
          <span className="text-xs text-gray-500">({diagnosisCount} AI diagnoses)</span>
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
        {aiResults && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            AI-adjusted coupling based on {aiResults.urgency_level} urgency level
          </div>
        )}
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`w-full py-2 text-xs font-bold rounded ${
            isRunning ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}
        >
          {isRunning ? 'Stop Simulation' : 'Start Simulation'}
        </button>
      </div>

      <div className={`mt-4 p-4 border-2 rounded-lg`} 
           style={{ borderColor: interpretation.color, backgroundColor: `${interpretation.color}15` }}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: interpretation.color }}></div>
            {interpretation.state}
          </h4>
          <span className="text-xs text-gray-600">K = {coupling.toFixed(1)}</span>
        </div>
        <div className="space-y-2 text-xs">
          <p className="text-gray-700">{interpretation.interpretation}</p>
          <p className="text-gray-700">{interpretation.clinicalSignificance}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// BAYESIAN ANALYSIS COMPONENT - AI DATA ONLY
// ============================================================================

const BayesianAnalysis = ({ patientData, processedData, suspectedDiagnoses = [], aiResults }) => {
  const svgRef = useRef(null);
  const [d3Module, setD3Module] = useState(null);

  useEffect(() => {
    D3Module.load().then(d3 => {
      setD3Module(d3);
    });
  }, []);

  const hasData = patientData && processedData && Object.values(processedData).flat().length > 0;

  // Only use AI results - no mock data
  const posteriorProbabilities = useMemo(() => {
    if (!hasData || !aiResults || !aiResults.differential_diagnoses) return [];

    let results = aiResults.differential_diagnoses.map((diagnosis, idx) => {
      let probability = 0.1;
      let confidence = 0.5;
      
      if (typeof diagnosis === 'object') {
        probability = diagnosis.probability || diagnosis.confidence || (0.9 - idx * 0.15);
        confidence = diagnosis.confidence || diagnosis.probability || 0.5;
      } else {
        probability = 0.9 - idx * 0.15;
      }

      return {
        disease: typeof diagnosis === 'object' ? 
          (diagnosis.diagnosis || diagnosis.condition || diagnosis) : diagnosis,
        probability: Math.max(0.01, probability),
        likelihood: confidence * 10,
        prior: 0.05,
        isAIDerived: true
      };
    }).slice(0, 8);

    // Normalize probabilities
    const totalProb = results.reduce((sum, r) => sum + r.probability, 0);
    if (totalProb > 0) {
      results = results.map(r => ({
        ...r,
        probability: r.probability / totalProb
      }));
    }

    return results.sort((a, b) => b.probability - a.probability);
  }, [aiResults, hasData]);

  useEffect(() => {
    if (!svgRef.current || posteriorProbabilities.length === 0 || !hasData || !d3Module) return;

    const svg = d3Module.select(svgRef.current);
    svg.selectAll("*").remove();

    // FIX: Properly adjusted margins to prevent overflow
    const margin = { top: 40, right: 80, bottom: 120, left: 60 };
    const width = 400 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3Module.scaleBand()
      .range([0, width])
      .padding(0.1)
      .domain(posteriorProbabilities.map(d => d.disease));

    const y = d3Module.scaleLinear()
      .range([height, 0])
      .domain([0, Math.max(...posteriorProbabilities.map(d => d.probability)) * 1.1]);

    // Gradient for AI results
    const gradientAI = svg.append("defs")
      .append("linearGradient")
      .attr("id", "bar-gradient-ai")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");

    gradientAI.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#4a90e2");

    gradientAI.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#357abd");

    // Draw bars with animation
    g.selectAll(".bar")
      .data(posteriorProbabilities)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.disease))
      .attr("width", x.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .attr("fill", "url(#bar-gradient-ai)")
      .transition()
      .duration(750)
      .attr("y", d => y(d.probability))
      .attr("height", d => height - y(d.probability));

    // Probability labels
    g.selectAll(".text")
      .data(posteriorProbabilities)
      .enter().append("text")
      .attr("x", d => x(d.disease) + x.bandwidth() / 2)
      .attr("y", d => y(d.probability) - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .text(d => (d.probability * 100).toFixed(1) + '%');

    // X axis with rotated labels
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3Module.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .style("font-size", "9px");

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
      .text("AI Diagnostic Probability Analysis");

  }, [posteriorProbabilities, hasData, d3Module]);

  if (!hasData || !d3Module || !aiResults || posteriorProbabilities.length === 0) {
    return (
      <div className="bg-white border-2 border-gray-300 p-4">
        <h3 className="text-sm font-bold mb-3">AI Diagnostic Analysis</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          {!aiResults ? "Awaiting AI analysis..." : "No diagnostic data available"}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-300 p-4">
      <h3 className="text-sm font-bold mb-3">AI Diagnostic Analysis</h3>
      <svg ref={svgRef} width={400} height={350} />
      <div className="mt-4 space-y-2 text-xs">
        <div className="font-semibold">AI-Generated Differential Diagnoses:</div>
        {posteriorProbabilities.slice(0, 5).map((result, idx) => (
          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span className="font-medium text-blue-600">
              {idx + 1}. {result.disease}
            </span>
            <div className="text-right">
              <span className="font-bold">{(result.probability * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
        {aiResults.confidence && (
          <div className="mt-2 p-2 bg-blue-50 rounded">
            <span className="font-semibold text-blue-800">AI Confidence:</span>
            <span className="ml-2 text-blue-700">{(aiResults.confidence * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CLAUDE AI RESULTS DISPLAY COMPONENT
// ============================================================================

const ClaudeResultsDisplay = ({ results }) => {
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

        {results.differential_diagnoses && results.differential_diagnoses.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">
              Differential Diagnoses ({results.differential_diagnoses.length} identified):
            </h4>
            <ul className="list-disc list-inside space-y-1">
              {results.differential_diagnoses.map((diagnosis, idx) => (
                <li key={idx} className="text-sm text-gray-700">
                  {typeof diagnosis === 'object' ?
                    `${diagnosis.diagnosis || diagnosis.condition || diagnosis} ${
                      diagnosis.icd10_code ? `(${diagnosis.icd10_code})` : ''
                    } - ${(diagnosis.probability * 100 || diagnosis.confidence * 100 || 0).toFixed(0)}% probability` :
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

        {results.procedures_recommended && results.procedures_recommended.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Recommended Procedures:</h4>
            <ul className="list-disc list-inside space-y-1">
              {results.procedures_recommended.map((proc, idx) => (
                <li key={idx} className="text-sm text-gray-700">{proc}</li>
              ))}
            </ul>
          </div>
        )}

        {results.pathology_findings && results.pathology_findings.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Pathology Considerations:</h4>
            <ul className="list-disc list-inside space-y-1">
              {results.pathology_findings.map((finding, idx) => (
                <li key={idx} className="text-sm text-gray-700">{finding}</li>
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
                className="bg-blue-500 h-4 rounded-full transition-all"
                style={{ width: `${results.confidence * 100}%` }}
              />
            </div>
            <span className="text-sm">{(results.confidence * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>
    );
  };

  const renderJsonFormat = () => {
    return (
      <pre className="text-xs overflow-auto bg-gray-50 p-3 rounded max-h-96">
        {JSON.stringify(results, null, 2)}
      </pre>
    );
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 size={18} />
          Claude AI Analysis Results
          <span className="text-xs text-gray-500 font-normal" suppressHydrationWarning>
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
        {displayFormat === 'json' && renderJsonFormat()}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN DIAGNOVERA ENTERPRISE INTERFACE COMPONENT
// ============================================================================

const DiagnoVeraEnterpriseInterface = () => {
  // State Management
  const [hasMounted, setHasMounted] = useState(false);
  
  const [patientData, setPatientData] = useState({
    demographics: { mrn: '', age: '', sex: 'Male' },
    subjective: {
      chiefComplaint: '',
      symptoms: [],
      medications: [],
      allergyHistory: [],
      pastMedicalHistory: [],
      pastSurgicalHistory: [],
      familyHistory: [],
      socialHistory: []
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
      imaging: [],
      procedures: [],
      pathology: [],
      examFindings: []
    }
  });

  const [processedData, setProcessedData] = useState({});
  const [showConnections, setShowConnections] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedDomains, setSelectedDomains] = useState('all');
  const [suspectedDiagnoses, setSuspectedDiagnoses] = useState([]);
  const [claudeStatus, setClaudeStatus] = useState('disconnected');
  const [claudeResults, setClaudeResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Hydration protection
  useEffect(() => {
    setHasMounted(true);
    console.log('DiagnoVera Interface mounted');
  }, []);

  // Connect to WebSocket on mount
  useEffect(() => {
    if (!hasMounted) return;
    
    const connectTimer = setTimeout(() => {
      try {
        websocketService.connect();

        websocketService.onConnect(() => {
          setClaudeStatus('connected');
          console.log('Claude AI connected');
        });

        websocketService.onClaudeUpdate((data) => {
          console.log('Received Claude AI update:', data);
          setClaudeResults(data);
          setClaudeStatus('connected');

          if (data.differential_diagnoses) {
            setSuspectedDiagnoses(prev => [...new Set([...prev, ...data.differential_diagnoses.map(d => 
              typeof d === 'object' ? (d.diagnosis || d.condition || d) : d
            )])]);
          }
        });

        websocketService.onConnectionError((error) => {
          console.warn('WebSocket connection failed, continuing in offline mode');
          setClaudeStatus('offline');
        });

        websocketService.onDisconnect(() => {
          setClaudeStatus('disconnected');
        });
      } catch (error) {
        console.error('WebSocket setup error:', error);
        setClaudeStatus('offline');
      }
    }, 100);

    return () => {
      clearTimeout(connectTimer);
      websocketService.disconnect();
    };
  }, [hasMounted]);

  // Preload all data files
  useEffect(() => {
    if (!hasMounted) return;
    
    const allDataFiles = [
      'symptoms', 'medications', 'allergies', 'medicalhistory', 'surgicalhistory',
      'familyhistory', 'socialhistory', 'vitals', 'labwork', 'imaging',
      'chiefcomplaint', 'procedures', 'pathology', 'physicalexam', 'reviewofsystems'
    ];
    preloadDataFiles(allDataFiles);
  }, [hasMounted]);

  // Update functions
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

  const updateProcedures = useCallback((value) => {
    setPatientData(prev => ({
      ...prev,
      objective: { ...prev.objective, procedures: value }
    }));
  }, []);

  const updatePathology = useCallback((value) => {
    setPatientData(prev => ({
      ...prev,
      objective: { ...prev.objective, pathology: value }
    }));
  }, []);

  const updateExamFindings = useCallback((value) => {
    setPatientData(prev => ({
      ...prev,
      objective: { ...prev.objective, examFindings: value }
    }));
  }, []);

  // Process data into complex plane format
  const processDataToComplexPlane = useCallback(() => {
    const complexData = {
      symptoms: [],
      vitals: [],
      labs: [],
      medications: [],
      procedures: [],
      pathology: [],
      examFindings: []
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

    // Process procedures
    patientData.objective.procedures.forEach((proc, idx) => {
      const angle = 45 + (idx * 20);
      const magnitude = 0.6 + Math.random() * 0.4;
      complexData.procedures.push({
        name: proc,
        real: magnitude * Math.cos(angle * Math.PI / 180),
        imaginary: magnitude * Math.sin(angle * Math.PI / 180),
        magnitude,
        angle,
        color: '#9b59b6'
      });
    });

    // Process pathology
    patientData.objective.pathology.forEach((path, idx) => {
      const angle = 135 + (idx * 25);
      const magnitude = 0.5 + Math.random() * 0.5;
      complexData.pathology.push({
        name: path,
        real: magnitude * Math.cos(angle * Math.PI / 180),
        imaginary: magnitude * Math.sin(angle * Math.PI / 180),
        magnitude,
        angle,
        color: '#34495e'
      });
    });

    // Process exam findings
    patientData.objective.examFindings.forEach((finding, idx) => {
      const angle = 315 + (idx * 15);
      const magnitude = 0.4 + Math.random() * 0.6;
      complexData.examFindings.push({
        name: finding,
        real: magnitude * Math.cos(angle * Math.PI / 180),
        imaginary: magnitude * Math.sin(angle * Math.PI / 180),
        magnitude,
        angle,
        color: '#e67e22'
      });
    });

    setProcessedData(complexData);
  }, [patientData]);

  // Process data when patient data changes
  useEffect(() => {
    if (hasMounted) {
      processDataToComplexPlane();
    }
  }, [patientData, processDataToComplexPlane, hasMounted]);

  // Submit to Claude AI with comprehensive data
  const submitToClaudeAI = async () => {
    setIsProcessing(true);
    setError(null);
    setClaudeStatus('processing');

    try {
      // Build comprehensive clinical context
      const clinicalContext = `
        COMPREHENSIVE PATIENT ASSESSMENT:
        
        Demographics: ${patientData.demographics.age || 'Unknown'} year old ${patientData.demographics.sex || 'Unknown'} patient.
        MRN: ${patientData.demographics.mrn || 'Not provided'}
        
        CHIEF COMPLAINT: ${patientData.subjective.chiefComplaint || 'None specified'}
        
        SYMPTOMS (${patientData.subjective.symptoms.length}): 
        ${patientData.subjective.symptoms.join(', ') || 'None reported'}
        
        CURRENT MEDICATIONS (${patientData.subjective.medications.length}): 
        ${patientData.subjective.medications.join(', ') || 'None'}
        
        ALLERGIES: ${patientData.subjective.allergyHistory.join(', ') || 'NKDA'}
        
        PAST MEDICAL HISTORY: ${patientData.subjective.pastMedicalHistory.join(', ') || 'None significant'}
        
        PAST SURGICAL HISTORY: ${patientData.subjective.pastSurgicalHistory.join(', ') || 'None'}
        
        FAMILY HISTORY: ${patientData.subjective.familyHistory.join(', ') || 'Non-contributory'}
        
        SOCIAL HISTORY: ${patientData.subjective.socialHistory.join(', ') || 'Not documented'}
        
        VITAL SIGNS:
        - Temperature: ${patientData.objective.vitals.temperature || 'Not recorded'}
        - Heart Rate: ${patientData.objective.vitals.heartRate || 'Not recorded'}
        - Blood Pressure: ${patientData.objective.vitals.bloodPressure || 'Not recorded'}
        - Respiratory Rate: ${patientData.objective.vitals.respiratoryRate || 'Not recorded'}
        - O2 Saturation: ${patientData.objective.vitals.o2Saturation || 'Not recorded'}
        
        PHYSICAL EXAM FINDINGS: ${patientData.objective.examFindings.join(', ') || 'Not documented'}
        
        LABORATORY RESULTS (${patientData.objective.laboratory.length}):
        ${patientData.objective.laboratory.map(lab => 
          `${lab.name}: ${lab.value} ${lab.unit}`).join(', ') || 'No labs available'}
        
        IMAGING STUDIES (${patientData.objective.imaging.length}):
        ${patientData.objective.imaging.map(img => 
          `${img.study}: ${img.findings || 'Pending'}`).join('; ') || 'None performed'}
        
        PROCEDURES PERFORMED (${patientData.objective.procedures.length}):
        ${patientData.objective.procedures.join(', ') || 'None'}
        
        PATHOLOGY FINDINGS (${patientData.objective.pathology.length}):
        ${patientData.objective.pathology.join(', ') || 'None'}
        
        Please provide:
        1. Comprehensive differential diagnosis with probabilities
        2. Urgency assessment (EMERGENT/URGENT/SEMI-URGENT/ROUTINE)
        3. Specific recommendations based on all clinical data
        4. Required follow-up procedures
        5. Additional labs or imaging needed
        6. Pathology considerations if relevant
      `;

      const payload = {
        patient_id: patientData.demographics.mrn || `TEMP-${Date.now()}`,
        timestamp: new Date().toISOString(),
        demographics: patientData.demographics,
        chief_complaint: patientData.subjective.chiefComplaint,
        symptoms: patientData.subjective.symptoms,
        clinical_context: clinicalContext,
        vitals: patientData.objective.vitals,
        medications: patientData.subjective.medications,
        allergies: patientData.subjective.allergyHistory,
        medical_history: patientData.subjective.pastMedicalHistory,
        surgical_history: patientData.subjective.pastSurgicalHistory,
        family_history: patientData.subjective.familyHistory,
        social_history: patientData.subjective.socialHistory,
        laboratory: patientData.objective.laboratory,
        imaging: patientData.objective.imaging,
        procedures: patientData.objective.procedures,
        pathology: patientData.objective.pathology,
        exam_findings: patientData.objective.examFindings,
        complex_analysis: processedData,
        analysis_requested: {
          differential_diagnoses: true,
          urgency_assessment: true,
          recommendations: true,
          procedures_needed: true,
          pathology_considerations: true,
          labs_to_order: true,
          confidence_scoring: true,
          comprehensive_analysis: true
        }
      };

      console.log('Sending comprehensive data to Claude AI:', payload);

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
      console.log('Claude AI response:', result);

      // Process results
      const processedResults = {
        differential_diagnoses: result.differential_diagnoses || result.diagnoses || [],
        recommendations: result.recommendations || [],
        labs_to_order: result.labs_to_order || [],
        procedures_recommended: result.procedures_recommended || [],
        pathology_findings: result.pathology_findings || [],
        confidence: result.confidence || 0.5,
        summary: result.summary || 'Analysis complete',
        urgency_level: result.urgency_level || 'ROUTINE',
        critical_findings: result.critical_findings || {},
        diagnostic_report: result.diagnostic_report || {},
        clinical_reasoning: result.clinical_reasoning || '',
        timestamp: new Date().toISOString()
      };

      setClaudeResults(processedResults);
      setClaudeStatus('completed');

      // Update suspected diagnoses
      if (processedResults.differential_diagnoses.length > 0) {
        setSuspectedDiagnoses(prev => {
          const newDiagnoses = processedResults.differential_diagnoses
            .map(d => typeof d === 'object' ? (d.diagnosis || d.condition || d) : d)
            .filter(d => !prev.includes(d));
          return [...prev, ...newDiagnoses];
        });
      }

    } catch (err) {
      console.error('Error submitting to Claude AI:', err);
      setError(`Failed to analyze: ${err.message}`);
      setClaudeStatus('error');
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
        pastSurgicalHistory: [],
        familyHistory: [],
        socialHistory: []
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
        imaging: [],
        procedures: [],
        pathology: [],
        examFindings: []
      }
    });
    setProcessedData({});
    setSuspectedDiagnoses([]);
    setClaudeResults(null);
    setClaudeStatus('disconnected');
    setError(null);
  };

  const handleLogout = () => {
    resetForm();
    websocketService.disconnect();
    dataCache.clear();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const exportData = () => {
    const exportObj = {
      timestamp: new Date().toISOString(),
      patientData,
      processedData,
      suspectedDiagnoses,
      claudeResults
    };

    const dataStr = JSON.stringify(exportObj, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `diagnovera-patient-${patientData.demographics.mrn || 'unknown'}-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Prevent rendering until mounted
  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading DiagnoVera Enterprise Interface...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 shadow-lg mb-4 rounded-lg">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                    <div className="bg-white rounded-lg p-2 shadow-sm">
                      <div className="text-blue-600 font-black text-2xl tracking-tight">
                        DVERA™
                      </div>
                    </div>
                    <div className="ml-4 text-white">
                      <h1 className="text-xl font-semibold tracking-wide">DiagnoVera Enterprise</h1>
                      <p className="text-blue-100 text-sm font-medium">Claude AI Clinical Decision Support</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center bg-blue-500 rounded-lg px-3 py-1.5">
                    {claudeStatus === 'connected' ? (
                      <>
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                        <Wifi className="h-3 w-3 text-white mr-1" />
                        <span className="text-xs text-white font-medium">Claude AI Connected</span>
                      </>
                    ) : claudeStatus === 'offline' ? (
                      <>
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                        <WifiOff className="h-3 w-3 text-white mr-1" />
                        <span className="text-xs text-white font-medium">Offline Mode</span>
                      </>
                    ) : claudeStatus === 'processing' ? (
                      <>
                        <Loader2 className="h-3 w-3 text-white mr-1 animate-spin" />
                        <span className="text-xs text-white font-medium">Processing...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                        <WifiOff className="h-3 w-3 text-white mr-1" />
                        <span className="text-xs text-white font-medium">Disconnected</span>
                      </>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button onClick={resetForm} className="flex items-center space-x-1 bg-white bg-opacity-10 hover:bg-opacity-20 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-all">
                      <RotateCcw size={12} />
                      <span>Reset</span>
                    </button>
                    <button onClick={exportData} className="flex items-center space-x-1 bg-white bg-opacity-10 hover:bg-opacity-20 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-all">
                      <Download size={12} />
                      <span>Export</span>
                    </button>
                    <button onClick={handleLogout} className="flex items-center space-x-1 bg-red-600 bg-opacity-80 hover:bg-opacity-100 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-all">
                      <LogOut size={12} />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Patient Data Entry Column */}
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
                
                <ClientOnly>
                  <EpicAutocompleteField
                    label="Chief Complaint"
                    dataFile="chiefcomplaint"
                    value={patientData.subjective.chiefComplaint}
                    onChange={(value) => updateSubjective('chiefComplaint', value)}
                    placeholder="Select chief complaint..."
                    multiple={false}
                    color="#e74c3c"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Symptoms"
                    dataFile="symptoms"
                    value={patientData.subjective.symptoms}
                    onChange={(value) => updateSubjective('symptoms', value)}
                    placeholder="Search symptoms..."
                    multiple={true}
                    color="#e74c3c"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Current Medications"
                    dataFile="medications"
                    value={patientData.subjective.medications}
                    onChange={(value) => updateSubjective('medications', value)}
                    placeholder="Search medications..."
                    multiple={true}
                    color="#f39c12"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Allergies"
                    dataFile="allergies"
                    value={patientData.subjective.allergyHistory}
                    onChange={(value) => updateSubjective('allergyHistory', value)}
                    placeholder="Search allergies..."
                    multiple={true}
                    color="#e74c3c"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Past Medical History"
                    dataFile="medicalhistory"
                    value={patientData.subjective.pastMedicalHistory}
                    onChange={(value) => updateSubjective('pastMedicalHistory', value)}
                    placeholder="Search conditions..."
                    multiple={true}
                    color="#9b59b6"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Past Surgical History"
                    dataFile="surgicalhistory"
                    value={patientData.subjective.pastSurgicalHistory}
                    onChange={(value) => updateSubjective('pastSurgicalHistory', value)}
                    placeholder="Search procedures..."
                    multiple={true}
                    color="#34495e"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Family History"
                    dataFile="familyhistory"
                    value={patientData.subjective.familyHistory}
                    onChange={(value) => updateSubjective('familyHistory', value)}
                    placeholder="Search family history..."
                    multiple={true}
                    color="#16a085"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Social History"
                    dataFile="socialhistory"
                    value={patientData.subjective.socialHistory}
                    onChange={(value) => updateSubjective('socialHistory', value)}
                    placeholder="Search social history..."
                    multiple={true}
                    color="#8e44ad"
                  />
                </ClientOnly>
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

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Exam Findings"
                    dataFile="physicalexam"
                    value={patientData.objective.examFindings}
                    onChange={updateExamFindings}
                    placeholder="Search exam findings..."
                    multiple={true}
                    color="#e67e22"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicLabField
                    label="Laboratory Tests"
                    dataFile="labwork"
                    value={patientData.objective.laboratory}
                    onChange={updateLaboratory}
                    placeholder="Search lab tests..."
                    color="#70AD47"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicImagingField
                    label="Imaging Studies"
                    dataFile="imaging"
                    value={patientData.objective.imaging}
                    onChange={updateImaging}
                    placeholder="Search imaging..."
                    color="#FECA57"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Procedures"
                    dataFile="procedures"
                    value={patientData.objective.procedures}
                    onChange={updateProcedures}
                    placeholder="Search procedures..."
                    multiple={true}
                    color="#9b59b6"
                  />
                </ClientOnly>

                <ClientOnly>
                  <EpicAutocompleteField
                    label="Pathology"
                    dataFile="pathology"
                    value={patientData.objective.pathology}
                    onChange={updatePathology}
                    placeholder="Search pathology..."
                    multiple={true}
                    color="#34495e"
                  />
                </ClientOnly>
              </div>

              {/* Suspected Diagnoses */}
              <div className="bg-white shadow rounded-lg p-4">
                <h2 className="text-lg font-bold mb-3">Suspected Diagnoses</h2>
                <ClientOnly>
                  <EpicAutocompleteField
                    label="Add Diagnoses"
                    dataFile="chiefcomplaint"
                    value={suspectedDiagnoses}
                    onChange={setSuspectedDiagnoses}
                    placeholder="Search diagnoses..."
                    multiple={true}
                    color="#9b59b6"
                  />
                </ClientOnly>
              </div>

              {/* Submit Button */}
              <button
                onClick={submitToClaudeAI}
                disabled={isProcessing}
                className={`w-full py-3 rounded font-bold flex items-center justify-center gap-2 ${
                  isProcessing
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Processing with Claude AI...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Analyze with Claude AI
                  </>
                )}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Visualizations Column */}
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
                      <option value="procedures">Procedures</option>
                      <option value="pathology">Pathology</option>
                      <option value="examFindings">Exam Findings</option>
                    </select>
                  </div>
                </div>
                <ClientOnly>
                  <ComplexPlaneChart
                    data={processedData}
                    showConnections={showConnections}
                    showLabels={showLabels}
                    selectedDomains={selectedDomains}
                  />
                </ClientOnly>
              </div>

              {/* Analysis Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Kuramoto Analysis */}
                <ClientOnly>
                  <KuramotoAnalysis data={processedData} aiResults={claudeResults} />
                </ClientOnly>

                {/* Bayesian Analysis */}
                <ClientOnly>
                  <BayesianAnalysis
                    patientData={patientData}
                    processedData={processedData}
                    suspectedDiagnoses={suspectedDiagnoses}
                    aiResults={claudeResults}
                  />
                </ClientOnly>
              </div>

              {/* Claude AI Results */}
              {claudeResults && (
                <ClientOnly>
                  <ClaudeResultsDisplay results={claudeResults} />
                </ClientOnly>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Export the main component
export default DiagnoVeraEnterpriseInterface;