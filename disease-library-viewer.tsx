import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, BookOpen, Activity, Zap, Eye, X, Download, Info } from 'lucide-react';
import * as d3 from 'd3';

const DiseaseLibraryViewer = () => {
  const [diseases, setDiseases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  // Mock disease library data
  const mockDiseases = [
    {
      icd10_code: 'I21.9',
      description: 'Acute myocardial infarction, unspecified',
      category: 'Cardiovascular',
      confidence_score: 0.92,
      sources: ['PubMed:12345678', 'Harrison\'s Ch.45', 'UpToDate:MI'],
      domains: {
        subjective: [
          { name: 'chest_pain', angle: 0, value: 1, confidence: 0.95 },
          { name: 'dyspnea', angle: 30, value: 1, confidence: 0.85 },
          { name: 'diaphoresis', angle: 60, value: 1, confidence: 0.8 },
          { name: 'nausea', angle: 90, value: 0.7, confidence: 0.7 },
          { name: 'left_arm_pain', angle: 120, value: 0.8, confidence: 0.85 }
        ],
        vitals: [
          { name: 'temperature', angle: 0, value: 37.5, range: { min: 36.5, max: 38 } },
          { name: 'heart_rate', angle: 60, value: 105, range: { min: 90, max: 120 } },
          { name: 'bp_systolic', angle: 120, value: 160, range: { min: 140, max: 180 } },
          { name: 'bp_diastolic', angle: 180, value: 95, range: { min: 85, max: 105 } },
          { name: 'oxygen_saturation', angle: 240, value: 93, range: { min: 90, max: 95 } },
          { name: 'respiratory_rate', angle: 300, value: 22, range: { min: 18, max: 26 } }
        ],
        laboratory: [
          { name: 'troponin_i', angle: 0, value: 1, data: { elevated: true, range: '>0.04' } },
          { name: 'ck_mb', angle: 45, value: 1, data: { elevated: true } },
          { name: 'bnp', angle: 90, value: 0.8, data: { value: '>100' } },
          { name: 'white_blood_cells', angle: 135, value: 0.7, data: { range: '10-15' } }
        ],
        imaging: [
          { name: 'st_elevation', angle: 0, value: 0.9, confidence: 0.9 },
          { name: 'wall_motion_abnormality', angle: 90, value: 0.85, confidence: 0.85 },
          { name: 'pericardial_effusion', angle: 180, value: 0.2, confidence: 0.7 }
        ]
      },
      profile_data: {
        vital_ranges: {
          temperature: { min: 36.5, max: 38, typical: 37.2 },
          heart_rate: { min: 90, max: 120, typical: 105 }
        },
        laboratory_values: {
          troponin_i: { range: { min: 0.04, max: null }, unit: 'ng/mL' },
          ck_mb: { range: { min: 6.3, max: null }, unit: 'ng/mL' }
        }
      }
    },
    {
      icd10_code: 'J44.0',
      description: 'Chronic obstructive pulmonary disease with acute lower respiratory infection',
      category: 'Respiratory',
      confidence_score: 0.88,
      sources: ['PubMed:87654321', 'Cecil Medicine Ch.88'],
      domains: {
        subjective: [
          { name: 'dyspnea', angle: 0, value: 1, confidence: 0.95 },
          { name: 'cough', angle: 40, value: 1, confidence: 0.9 },
          { name: 'sputum_production', angle: 80, value: 0.9, confidence: 0.85 },
          { name: 'wheezing', angle: 120, value: 0.8, confidence: 0.8 },
          { name: 'chest_tightness', angle: 160, value: 0.7, confidence: 0.75 }
        ],
        vitals: [
          { name: 'temperature', angle: 0, value: 38.2, range: { min: 37.5, max: 39 } },
          { name: 'heart_rate', angle: 60, value: 95, range: { min: 85, max: 110 } },
          { name: 'bp_systolic', angle: 120, value: 130, range: { min: 120, max: 140 } },
          { name: 'bp_diastolic', angle: 180, value: 80, range: { min: 70, max: 90 } },
          { name: 'oxygen_saturation', angle: 240, value: 88, range: { min: 85, max: 92 } },
          { name: 'respiratory_rate', angle: 300, value: 26, range: { min: 22, max: 30 } }
        ],
        laboratory: [
          { name: 'white_blood_cells', angle: 0, value: 0.9, data: { range: '12-18' } },
          { name: 'arterial_ph', angle: 60, value: 0.8, data: { range: '7.35-7.40' } },
          { name: 'pco2', angle: 120, value: 0.9, data: { range: '45-55' } },
          { name: 'po2', angle: 180, value: 0.7, data: { range: '55-65' } }
        ],
        imaging: [
          { name: 'hyperinflation', angle: 0, value: 0.9, confidence: 0.85 },
          { name: 'flattened_diaphragm', angle: 90, value: 0.85, confidence: 0.8 },
          { name: 'infiltrates', angle: 180, value: 0.7, confidence: 0.75 }
        ]
      }
    }
  ];

  useEffect(() => {
    // In production, fetch from API
    setLoading(true);
    setTimeout(() => {
      setDiseases(mockDiseases);
      setLoading(false);
    }, 1000);
  }, []);

  const ComplexPlaneVisualization = ({ disease, domain = 'all', size = 300 }) => {
    const svgRef = useRef(null);

    useEffect(() => {
      if (!svgRef.current || !disease.domains) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const width = size;
      const height = size;
      const margin = 40;
      const radius = Math.min(width, height) / 2 - margin;
      const centerX = width / 2;
      const centerY = height / 2;

      // Create main group
      const g = svg.append("g")
        .attr("transform", `translate(${centerX},${centerY})`);

      // Create scales
      const angleScale = d3.scaleLinear()
        .domain([0, 360])
        .range([0, 2 * Math.PI]);

      // Draw grid circles
      const gridCircles = [0.2, 0.4, 0.6, 0.8, 1];
      g.selectAll(".grid-circle")
        .data(gridCircles)
        .enter().append("circle")
        .attr("class", "grid-circle")
        .attr("r", d => radius * d)
        .attr("fill", "none")
        .attr("stroke", "#e5e7eb")
        .attr("stroke-width", 1);

      // Draw radial lines
      const angles = d3.range(0, 360, 30);
      g.selectAll(".grid-line")
        .data(angles)
        .enter().append("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radius * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y2", d => radius * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", "#e5e7eb")
        .attr("stroke-width", 1);

      // Get data points
      let dataPoints = [];
      if (domain === 'all') {
        Object.entries(disease.domains).forEach(([key, values]) => {
          dataPoints = dataPoints.concat(values.map(v => ({ ...v, domain: key })));
        });
      } else {
        dataPoints = disease.domains[domain] || [];
        dataPoints = dataPoints.map(v => ({ ...v, domain }));
      }

      // Create color scale for domains
      const colorScale = d3.scaleOrdinal()
        .domain(['subjective', 'vitals', 'laboratory', 'imaging'])
        .range(['#3b82f6', '#10b981', '#f59e0b', '#ef4444']);

      // Draw data points
      const pointGroups = g.selectAll(".point-group")
        .data(dataPoints)
        .enter().append("g")
        .attr("class", "point-group");

      // Draw lines from center
      pointGroups.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => {
          const angle = angleScale(d.angle) - Math.PI / 2;
          const magnitude = d.value > 1 ? d.value / 100 : d.value; // Normalize if needed
          return radius * magnitude * Math.cos(angle);
        })
        .attr("y2", d => {
          const angle = angleScale(d.angle) - Math.PI / 2;
          const magnitude = d.value > 1 ? d.value / 100 : d.value;
          return radius * magnitude * Math.sin(angle);
        })
        .attr("stroke", d => colorScale(d.domain))
        .attr("stroke-width", 2)
        .attr("opacity", 0.7);

      // Draw points
      pointGroups.append("circle")
        .attr("cx", d => {
          const angle = angleScale(d.angle) - Math.PI / 2;
          const magnitude = d.value > 1 ? d.value / 100 : d.value;
          return radius * magnitude * Math.cos(angle);
        })
        .attr("cy", d => {
          const angle = angleScale(d.angle) - Math.PI / 2;
          const magnitude = d.value > 1 ? d.value / 100 : d.value;
          return radius * magnitude * Math.sin(angle);
        })
        .attr("r", 5)
        .attr("fill", d => colorScale(d.domain))
        .attr("stroke", "white")
        .attr("stroke-width", 2);

      // Add labels (only if space permits)
      if (size > 250) {
        pointGroups.append("text")
          .attr("x", d => {
            const angle = angleScale(d.angle) - Math.PI / 2;
            const magnitude = d.value > 1 ? d.value / 100 : d.value;
            return (radius * magnitude + 15) * Math.cos(angle);
          })
          .attr("y", d => {
            const angle = angleScale(d.angle) - Math.PI / 2;
            const magnitude = d.value > 1 ? d.value / 100 : d.value;
            return (radius * magnitude + 15) * Math.sin(angle);
          })
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("fill", "#374151")
          .text(d => d.name.replace(/_/g, ' ').substring(0, 10));
      }

      // Add center point
      g.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 3)
        .attr("fill", "#374151");

    }, [disease, domain, size]);

    return (
      <svg ref={svgRef} width={size} height={size} className="w-full h-full" />
    );
  };

  const DiseaseDetailModal = ({ disease, onClose }) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [activeTab, setActiveTab] = useState('visualization');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
          <div className="sticky top-0 bg-white border-b p-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{disease.icd10_code}: {disease.description}</h2>
                <p className="text-gray-600">Category: {disease.category} | Confidence: {(disease.confidence_score * 100).toFixed(0)}%</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="mb-6">
              <div className="flex space-x-2 mb-4 border-b">
                <button
                  onClick={() => setActiveTab('visualization')}
                  className={`px-4 py-2 ${activeTab === 'visualization' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                >
                  Complex Plane View
                </button>
                <button
                  onClick={() => setActiveTab('parameters')}
                  className={`px-4 py-2 ${activeTab === 'parameters' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                >
                  Clinical Parameters
                </button>
                <button
                  onClick={() => setActiveTab('sources')}
                  className={`px-4 py-2 ${activeTab === 'sources' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                >
                  Literature Sources
                </button>
              </div>

              {activeTab === 'visualization' && (
                <div>
                  <div className="mb-4 flex items-center space-x-4">
                    <label className="text-sm font-medium">Domain Filter:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      className="px-3 py-1 border rounded"
                    >
                      <option value="all">All Domains</option>
                      <option value="subjective">Subjective</option>
                      <option value="vitals">Vitals</option>
                      <option value="laboratory">Laboratory</option>
                      <option value="imaging">Imaging</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Complex Plane Representation</h3>
                      <div className="bg-gray-50 rounded-lg p-4 flex justify-center">
                        <ComplexPlaneVisualization disease={disease} domain={selectedDomain} size={400} />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Domain Distribution</h3>
                      <div className="space-y-3">
                        {Object.entries(disease.domains).map(([domain, variables]) => (
                          <div key={domain} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium capitalize">{domain}</span>
                              <span className="text-sm text-gray-600">{variables.length} variables</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(variables.length / 20) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <Info className="inline mr-2" size={16} />
                          Each variable is mapped to a specific angle (θ) in the complex plane. 
                          The magnitude represents the expected value or presence strength.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'parameters' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Vital Sign Ranges</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {disease.profile_data?.vital_ranges && Object.entries(disease.profile_data.vital_ranges).map(([vital, range]) => (
                        <div key={vital} className="bg-gray-50 rounded-lg p-3">
                          <h4 className="font-medium capitalize mb-2">{vital.replace(/_/g, ' ')}</h4>
                          <div className="text-sm space-y-1">
                            <div>Min: <span className="font-mono">{range.min}</span></div>
                            <div>Max: <span className="font-mono">{range.max}</span></div>
                            <div>Typical: <span className="font-mono text-blue-600">{range.typical}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Laboratory Values</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {disease.profile_data?.laboratory_values && Object.entries(disease.profile_data.laboratory_values).map(([lab, data]) => (
                        <div key={lab} className="bg-gray-50 rounded-lg p-3">
                          <h4 className="font-medium">{lab.replace(/_/g, ' ').toUpperCase()}</h4>
                          <div className="text-sm mt-1">
                            <span>Range: {data.range.min || '0'} - {data.range.max || '∞'} {data.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Key Clinical Features</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {disease.domains.subjective?.slice(0, 6).map((feature, idx) => (
                        <div key={idx} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <div className={`w-3 h-3 rounded-full ${feature.confidence > 0.8 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <span className="text-sm">{feature.name.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-500">({(feature.confidence * 100).toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sources' && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Literature Sources</h3>
                  <div className="space-y-2">
                    {disease.sources?.map((source, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                        <div className="flex items-center space-x-3">
                          <BookOpen size={20} className="text-gray-600" />
                          <span>{source}</span>
                        </div>
                        <button className="text-blue-600 hover:text-blue-700">
                          View →
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p>This disease profile was built by analyzing {disease.sources?.length || 0} medical sources using AI-powered literature extraction.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-50 p-4 border-t">
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  <Download className="inline mr-2" size={16} />
                  Export Data
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100">
                  Compare with Patient
                </button>
              </div>
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filteredDiseases = diseases.filter(disease => {
    const matchesSearch = disease.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         disease.icd10_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || disease.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(diseases.map(d => d.category))];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-6">ICD-10 Disease Reference Library</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search diseases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-3 text-gray-400" size={20} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Grid View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                List View
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <p className="text-gray-600">
              Showing {filteredDiseases.length} of {diseases.length} diseases
            </p>
            <div className="flex items-center space-x-2">
              <Zap className="text-yellow-500" size={20} />
              <span className="text-sm text-gray-600">AI-powered reference library</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDiseases.map((disease) => (
              <div key={disease.icd10_code} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{disease.icd10_code}</h3>
                      <p className="text-sm text-gray-600 mt-1">{disease.description}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {disease.category}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <ComplexPlaneVisualization disease={disease} domain="all" size={200} />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      <span className="text-gray-500">Confidence:</span>
                      <span className="ml-1 font-medium">{(disease.confidence_score * 100).toFixed(0)}%</span>
                    </div>
                    <button
                      onClick={() => setSelectedDisease(disease)}
                      className="flex items-center text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="mr-1" size={16} />
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ICD-10 Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variables
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDiseases.map((disease) => {
                  const totalVariables = Object.values(disease.domains).reduce((sum, domain) => sum + domain.length, 0);
                  return (
                    <tr key={disease.icd10_code} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {disease.icd10_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {disease.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {disease.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${disease.confidence_score * 100}%` }}
                            />
                          </div>
                          <span>{(disease.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {totalVariables} variables
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSelectedDisease(disease)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedDisease && (
          <DiseaseDetailModal 
            disease={selectedDisease} 
            onClose={() => setSelectedDisease(null)} 
          />
        )}

        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center">
            <Info className="mr-2" size={24} />
            About the Reference Library
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
            <div>
              <h3 className="font-medium mb-2">AI-Powered Construction</h3>
              <p>
                This reference library is built using advanced AI that searches and analyzes medical literature
                from PubMed, medical textbooks, clinical guidelines, and peer-reviewed journals. Each disease
                profile represents the expected clinical presentation extracted from authoritative sources.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Complex Plane Representation</h3>
              <p>
                Every clinical variable is mapped to a specific angle (θ) in the complex plane, with magnitudes
                representing expected values or presence strength. This enables sophisticated mathematical
                analysis using Bayesian inference, Kuramoto synchronization, and Markov chains for diagnosis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiseaseLibraryViewer;