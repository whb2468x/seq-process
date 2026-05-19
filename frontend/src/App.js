import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [sequenceInput, setSequenceInput] = useState('');
  const [fileInput, setFileInput] = useState(null);
  const [sequenceType, setSequenceType] = useState('dna');
  const [targetType, setTargetType] = useState('dna');
  const [database, setDatabase] = useState('nt');
  const [minIdentity, setMinIdentity] = useState(30);
  const [maxIdentity, setMaxIdentity] = useState(100);
  const [resultCount, setResultCount] = useState(100);
  const [expectValue, setExpectValue] = useState(10);
  const [megablast, setMegablast] = useState(true);
  const [email, setEmail] = useState('');
  const [jobId, setJobId] = useState('');
  const [jobStatus, setJobStatus] = useState('');
  const [jobMessage, setJobMessage] = useState('');
  const [blastResults, setBlastResults] = useState([]);
  const [message, setMessage] = useState('');
  const [availableDatabases, setAvailableDatabases] = useState({});
  const [databaseMetadata, setDatabaseMetadata] = useState({});
  const [maxNcbiResults, setMaxNcbiResults] = useState(500);
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('blast');
  const [pairwiseFile, setPairwiseFile] = useState(null);
  const [pairwiseSequenceType, setPairwiseSequenceType] = useState('dna');
  const [alignmentMode, setAlignmentMode] = useState('global');
  const [pairwiseResults, setPairwiseResults] = useState(null);
  const [pairwiseJobStatus, setPairwiseJobStatus] = useState('');
  const [pairwiseMessage, setPairwiseMessage] = useState('');

  useEffect(() => {
    fetchDatabases();
    fetchJobs();
  }, []);

  const filteredDatabases = useMemo(() => {
    const targetKind = targetType === 'protein' ? 'protein' : 'nucleotide';
    return Object.entries(availableDatabases).filter(([key]) => {
      const metadata = databaseMetadata[key];
      return !metadata || metadata.target_type === targetKind;
    });
  }, [availableDatabases, databaseMetadata, targetType]);

  useEffect(() => {
    if (filteredDatabases.length && !filteredDatabases.some(([key]) => key === database)) {
      setDatabase(filteredDatabases[0][0]);
    }
  }, [database, filteredDatabases]);

  const fetchDatabases = async () => {
    try {
      const response = await axios.get('/databases');
      setAvailableDatabases(response.data.databases || {});
      setDatabaseMetadata(response.data.metadata || {});
      setMaxNcbiResults(response.data.max_ncbi_results || 500);
      setResultCount((value) => Math.min(value, response.data.max_ncbi_results || 500));
    } catch (error) {
      console.error('Error fetching databases:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await axios.get('/jobs?limit=10');
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleFileChange = (event) => {
    setFileInput(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setBlastResults([]);

    const formData = new FormData();
    if (sequenceInput.trim()) formData.append('sequence', sequenceInput);
    if (fileInput) formData.append('file', fileInput);
    formData.append('sequence_type', sequenceType);
    formData.append('target_type', targetType);
    formData.append('database', database);
    formData.append('min_identity', minIdentity);
    formData.append('max_identity', maxIdentity);
    formData.append('result_count', resultCount);
    formData.append('expect_value', expectValue);
    formData.append('megablast', megablast);
    if (email) formData.append('email', email);

    try {
      const response = await axios.post('/submit-sequence', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setJobId(response.data.job_id);
      setJobStatus(response.data.status);
      setJobMessage(response.data.message);
      setMessage(`BLAST ${response.data.program} started. Job ID: ${response.data.job_id}`);
    } catch (error) {
      setMessage('Error: ' + (error.response?.data?.detail || error.message));
    }
  };

  const checkJobStatus = async () => {
    if (!jobId) return;

    try {
      const response = await axios.get(`/job-status/${jobId}`);
      setJobStatus(response.data.status);
      setJobMessage(response.data.message || '');

      if (response.data.status === 'completed') {
        setBlastResults(response.data.results || []);
        fetchJobs();
      }
    } catch (error) {
      console.error('Error checking job status:', error);
    }
  };

  useEffect(() => {
    if (jobId && jobStatus !== 'completed' && jobStatus !== 'failed') {
      const interval = setInterval(checkJobStatus, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [jobId, jobStatus]);

  const downloadFromApi = async (id, format) => {
    const response = await axios.get(`/results/${id}?format=${format}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${id}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePairwiseFileChange = (event) => {
    setPairwiseFile(event.target.files[0]);
    setPairwiseResults(null);
    setPairwiseMessage('');
  };

  const submitPairwiseAlignment = async (event) => {
    event.preventDefault();
    if (!pairwiseFile) {
      setPairwiseMessage('Please select a FASTA file with multiple sequences');
      return;
    }

    setPairwiseMessage('');
    setPairwiseJobStatus('processing');

    const formData = new FormData();
    formData.append('file', pairwiseFile);
    formData.append('sequence_type', pairwiseSequenceType);
    formData.append('alignment_mode', alignmentMode);

    try {
      const response = await axios.post('/pairwise-alignment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPairwiseResults(response.data);
      setPairwiseJobStatus('completed');
      setPairwiseMessage('Pairwise alignment completed successfully');
      fetchJobs();
    } catch (error) {
      setPairwiseJobStatus('failed');
      setPairwiseMessage('Error: ' + (error.response?.data?.detail || error.message));
    }
  };

  const renderBlastTab = () => (
    <div className="blast-tab">
      <h2>NCBI BLAST Sequence Alignment</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-section">
          <h3>Input Sequence</h3>
          <textarea
            value={sequenceInput}
            onChange={(event) => setSequenceInput(event.target.value)}
            placeholder="Paste FASTA or raw sequence"
            rows={6}
          />
          <div className="file-row">
            <span>Or upload a file</span>
            <input type="file" onChange={handleFileChange} accept=".fasta,.fa,.faa,.fna,.txt,.seq" />
          </div>
        </div>

        <div className="config-section">
          <h3>Configuration</h3>

          <div className="form-grid">
            <div className="form-group">
              <label>Input sequence type</label>
              <select value={sequenceType} onChange={(event) => setSequenceType(event.target.value)}>
                <option value="dna">DNA</option>
                <option value="rna">RNA</option>
                <option value="protein">Protein</option>
              </select>
            </div>

            <div className="form-group">
              <label>Target sequence type</label>
              <select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                <option value="dna">DNA</option>
                <option value="rna">RNA</option>
                <option value="protein">Protein</option>
              </select>
            </div>

            <div className="form-group">
              <label>BLAST database</label>
              <select value={database} onChange={(event) => setDatabase(event.target.value)}>
                {filteredDatabases.map(([key, value]) => (
                  <option key={key} value={key}>{value} ({key})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>E-value</label>
              <input
                type="number"
                min="0.000001"
                step="0.1"
                value={expectValue}
                onChange={(event) => setExpectValue(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Min identity (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={minIdentity}
                onChange={(event) => setMinIdentity(Math.max(0, Math.min(100, Number(event.target.value))))}
              />
            </div>

            <div className="form-group">
              <label>Max identity (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={maxIdentity}
                onChange={(event) => setMaxIdentity(Math.max(0, Math.min(100, Number(event.target.value))))}
              />
            </div>

            <div className="form-group">
              <label>Result count</label>
              <input
                type="number"
                min="1"
                max={maxNcbiResults}
                value={resultCount}
                onChange={(event) => setResultCount(Math.max(1, Math.min(maxNcbiResults, Number(event.target.value))))}
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={megablast}
                  disabled={sequenceType === 'protein' || targetType === 'protein'}
                  onChange={(event) => setMegablast(event.target.checked)}
                />
                Megablast
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Email for NCBI requests (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your.email@example.com"
            />
          </div>

          <button type="submit">Start BLAST Analysis</button>
        </div>
      </form>

      {message && (
        <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {jobId && (
        <div className="status-section">
          <h3>Job Status</h3>
          <p><strong>Job ID:</strong> {jobId}</p>
          <p><strong>Status:</strong> {jobStatus}</p>
          {jobMessage && <p>{jobMessage}</p>}

          {jobStatus === 'processing' && (
            <div className="processing-info">
              <p>BLAST analysis is in progress. NCBI jobs can take several minutes.</p>
              <div className="loading-spinner" />
            </div>
          )}

          {jobStatus === 'completed' && (
            <div>
              <p>Found {blastResults.length} matching HSPs</p>
              <div className="button-row">
                <button type="button" onClick={() => downloadFromApi(jobId, 'json')}>Download JSON</button>
                <button type="button" onClick={() => downloadFromApi(jobId, 'csv')}>Download CSV</button>
              </div>

              <div className="results-table">
                <h4>BLAST Results</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Accession</th>
                      <th>Identity</th>
                      <th>Query cover</th>
                      <th>Align length</th>
                      <th>E-value</th>
                      <th>Bits</th>
                      <th>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blastResults.map((result, index) => (
                      <tr key={`${result.accession}-${index}`}>
                        <td>{result.accession}</td>
                        <td>{result.identity.toFixed(2)}%</td>
                        <td>{result.query_cover?.toFixed ? result.query_cover.toFixed(2) : result.query_cover}%</td>
                        <td>{result.align_length}</td>
                        <td>{Number(result.e_value).toExponential(2)}</td>
                        <td>{result.bits}</td>
                        <td className="title-cell">{result.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {jobStatus === 'failed' && (
            <div className="error-info">
              <p>{jobMessage || 'BLAST analysis failed.'}</p>
            </div>
          )}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="history-section">
          <h3>Recent Jobs</h3>
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Type</th>
                <th>Status</th>
                <th>Time</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id}>
                  <td>{job.job_id}</td>
                  <td>{job.analysis_type || 'blast'}</td>
                  <td>{job.status}</td>
                  <td>{job.timestamp || job.created_at}</td>
                  <td>
                    {job.status === 'completed' && (
                      <button type="button" onClick={() => downloadFromApi(job.job_id, 'json')}>JSON</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPairwiseTab = () => (
    <div className="pairwise-tab">
      <h2>Pairwise Sequence Alignment</h2>

      <form onSubmit={submitPairwiseAlignment} className="pairwise-form">
        <div className="input-section">
          <h3>Upload Multiple Sequences</h3>
          <input type="file" onChange={handlePairwiseFileChange} accept=".fasta,.fa,.faa,.fna,.txt" required />
        </div>

        <div className="form-grid config-section">
          <div className="form-group">
            <label>Sequence type</label>
            <select value={pairwiseSequenceType} onChange={(event) => setPairwiseSequenceType(event.target.value)}>
              <option value="dna">DNA</option>
              <option value="rna">RNA</option>
              <option value="protein">Protein</option>
            </select>
          </div>

          <div className="form-group">
            <label>Alignment mode</label>
            <select value={alignmentMode} onChange={(event) => setAlignmentMode(event.target.value)}>
              <option value="global">Global</option>
              <option value="local">Local</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={!pairwiseFile || pairwiseJobStatus === 'processing'}>
          {pairwiseJobStatus === 'processing' ? 'Processing...' : 'Start Pairwise Alignment'}
        </button>
      </form>

      {pairwiseMessage && (
        <div className={`message ${pairwiseMessage.startsWith('Error') ? 'error' : 'success'}`}>
          {pairwiseMessage}
        </div>
      )}

      {pairwiseResults && pairwiseJobStatus === 'completed' && (
        <div className="pairwise-results">
          <div className="results-header">
            <h3>Pairwise Alignment Results</h3>
            <div className="button-row">
              <button type="button" onClick={() => downloadFromApi(pairwiseResults.job_id, 'json')}>Download JSON</button>
              <button type="button" onClick={() => downloadFromApi(pairwiseResults.job_id, 'csv')}>Download CSV</button>
            </div>
          </div>

          <div className="identity-matrix">
            <h4>Identity Matrix (%)</h4>
            <div className="matrix-table-container">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Sequences</th>
                    {pairwiseResults.sequence_names.map((name) => <th key={name}>{name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pairwiseResults.sequence_names.map((rowName, rowIndex) => (
                    <tr key={rowName}>
                      <td><strong>{rowName}</strong></td>
                      {pairwiseResults.identity_matrix[rowIndex].map((value, colIndex) => (
                        <td key={`${rowName}-${colIndex}`} className={rowIndex === colIndex ? 'diagonal' : ''}>
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="heatmap-section">
            <h4>Identity Heatmap</h4>
            <div className="heatmap-container">{renderHeatmap()}</div>
          </div>

          <div className="results-table">
            <h4>Pair Details</h4>
            <table>
              <thead>
                <tr>
                  <th>Sequence A</th>
                  <th>Sequence B</th>
                  <th>Identity</th>
                  <th>Matches</th>
                  <th>Aligned length</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {pairwiseResults.pairwise_details.map((row) => (
                  <tr key={`${row.sequence_a}-${row.sequence_b}`}>
                    <td>{row.sequence_a}</td>
                    <td>{row.sequence_b}</td>
                    <td>{row.identity}%</td>
                    <td>{row.matches}</td>
                    <td>{row.aligned_length}</td>
                    <td>{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderHeatmap = () => {
    if (!pairwiseResults) return null;

    const { heatmap_data, sequence_names } = pairwiseResults;
    const cellSize = Math.max(48, Math.min(80, 520 / sequence_names.length));
    const gridSize = sequence_names.length * cellSize;

    const getColor = (value) => {
      if (value >= 90) return '#d73027';
      if (value >= 70) return '#fc8d59';
      if (value >= 50) return '#fee08b';
      if (value >= 30) return '#91cf60';
      return '#1a9850';
    };

    return (
      <svg width={gridSize + 120} height={gridSize + 120} className="heatmap">
        {sequence_names.map((name, index) => (
          <text key={`x-${name}`} x={95 + index * cellSize + cellSize / 2} y={28} textAnchor="middle" fontSize="12">
            {name}
          </text>
        ))}
        {sequence_names.map((name, index) => (
          <text key={`y-${name}`} x={20} y={60 + index * cellSize + cellSize / 2} fontSize="12">
            {name}
          </text>
        ))}
        {heatmap_data.map((cell, index) => {
          const row = sequence_names.indexOf(cell.y);
          const column = sequence_names.indexOf(cell.x);
          return (
            <g key={`${cell.x}-${cell.y}-${index}`}>
              <rect
                x={90 + column * cellSize}
                y={45 + row * cellSize}
                width={cellSize}
                height={cellSize}
                fill={getColor(cell.value)}
                stroke="#fff"
              />
              <text
                x={90 + column * cellSize + cellSize / 2}
                y={45 + row * cellSize + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fill={cell.value >= 70 ? '#fff' : '#111827'}
              >
                {cell.value}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sequence Alignment Tool</h1>
        <nav>
          <button type="button" className={activeTab === 'blast' ? 'active' : ''} onClick={() => setActiveTab('blast')}>
            NCBI BLAST
          </button>
          <button type="button" className={activeTab === 'pairwise' ? 'active' : ''} onClick={() => setActiveTab('pairwise')}>
            Pairwise Alignment
          </button>
        </nav>
      </header>

      <main>{activeTab === 'blast' ? renderBlastTab() : renderPairwiseTab()}</main>

      <footer>
        <p>Sequence Alignment Tool v1.1 - Bioinformatics Analysis Platform</p>
      </footer>
    </div>
  );
}

export default App;
