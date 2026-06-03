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
  const [pairwiseSequenceInput, setPairwiseSequenceInput] = useState('');
  const [pairwiseSequenceType, setPairwiseSequenceType] = useState('dna');
  const [alignmentMode, setAlignmentMode] = useState('global');
  const [pairwiseResults, setPairwiseResults] = useState(null);
  const [pairwiseJobStatus, setPairwiseJobStatus] = useState('');
  const [pairwiseMessage, setPairwiseMessage] = useState('');
  const [combinedFile, setCombinedFile] = useState(null);
  const [combinedSequenceInput, setCombinedSequenceInput] = useState('');
  const [combinedSequenceType, setCombinedSequenceType] = useState('dna');
  const [combinedTargetType, setCombinedTargetType] = useState('dna');
  const [combinedDatabase, setCombinedDatabase] = useState('nt');
  const [combinedAlignmentMode, setCombinedAlignmentMode] = useState('global');
  const [combinedMinIdentity, setCombinedMinIdentity] = useState(30);
  const [combinedMaxIdentity, setCombinedMaxIdentity] = useState(100);
  const [combinedResultCount, setCombinedResultCount] = useState(50);
  const [combinedExpectValue, setCombinedExpectValue] = useState(10);
  const [combinedMegablast, setCombinedMegablast] = useState(true);
  const [combinedEmail, setCombinedEmail] = useState('');
  const [combinedJobId, setCombinedJobId] = useState('');
  const [combinedJobStatus, setCombinedJobStatus] = useState('');
  const [combinedMessage, setCombinedMessage] = useState('');
  const [combinedProgress, setCombinedProgress] = useState('');
  const [combinedResults, setCombinedResults] = useState(null);

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

  const combinedFilteredDatabases = useMemo(() => {
    const targetKind = combinedTargetType === 'protein' ? 'protein' : 'nucleotide';
    return Object.entries(availableDatabases).filter(([key]) => {
      const metadata = databaseMetadata[key];
      return !metadata || metadata.target_type === targetKind;
    });
  }, [availableDatabases, databaseMetadata, combinedTargetType]);

  useEffect(() => {
    if (filteredDatabases.length && !filteredDatabases.some(([key]) => key === database)) {
      setDatabase(filteredDatabases[0][0]);
    }
  }, [database, filteredDatabases]);

  useEffect(() => {
    if (combinedFilteredDatabases.length && !combinedFilteredDatabases.some(([key]) => key === combinedDatabase)) {
      setCombinedDatabase(combinedFilteredDatabases[0][0]);
    }
  }, [combinedDatabase, combinedFilteredDatabases]);

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
    const hasText = pairwiseSequenceInput.trim();
    if (!pairwiseFile && !hasText) {
      setPairwiseMessage('Please paste sequences in FASTA format or upload a file');
      return;
    }

    setPairwiseMessage('');
    setPairwiseJobStatus('processing');
    setPairwiseResults(null);

    const formData = new FormData();
    if (hasText) formData.append('sequence', pairwiseSequenceInput);
    if (pairwiseFile) formData.append('file', pairwiseFile);
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

  const handleCombinedFileChange = (event) => {
    setCombinedFile(event.target.files[0]);
    setCombinedResults(null);
    setCombinedMessage('');
  };

  const submitCombinedAnalysis = async (event) => {
    event.preventDefault();
    const hasText = combinedSequenceInput.trim();
    if (!combinedFile && !hasText) {
      setCombinedMessage('Please paste sequences in FASTA format or upload a file');
      return;
    }

    setCombinedMessage('');
    setCombinedResults(null);
    setCombinedProgress('');
    setCombinedJobStatus('processing');

    const formData = new FormData();
    if (hasText) formData.append('sequence', combinedSequenceInput);
    if (combinedFile) formData.append('file', combinedFile);
    formData.append('sequence_type', combinedSequenceType);
    formData.append('target_type', combinedTargetType);
    formData.append('database', combinedDatabase);
    formData.append('alignment_mode', combinedAlignmentMode);
    formData.append('min_identity', combinedMinIdentity);
    formData.append('max_identity', combinedMaxIdentity);
    formData.append('result_count', combinedResultCount);
    formData.append('expect_value', combinedExpectValue);
    formData.append('megablast', combinedMegablast);
    if (combinedEmail) formData.append('email', combinedEmail);

    try {
      const response = await axios.post('/pairwise-blast-alignment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCombinedJobId(response.data.job_id);
      setCombinedJobStatus(response.data.status);
      setCombinedMessage(response.data.message);
    } catch (error) {
      setCombinedJobStatus('failed');
      setCombinedMessage('Error: ' + (error.response?.data?.detail || error.message));
    }
  };

  const checkCombinedJobStatus = async () => {
    if (!combinedJobId) return;
    try {
      const response = await axios.get(`/job-status/${combinedJobId}`);
      setCombinedJobStatus(response.data.status);
      setCombinedMessage(response.data.message || '');
      setCombinedProgress(response.data.progress || '');
      if (response.data.status === 'completed') {
        setCombinedResults(response.data);
        fetchJobs();
      }
    } catch (error) {
      console.error('Error checking combined job status:', error);
    }
  };

  useEffect(() => {
    if (combinedJobId && combinedJobStatus !== 'completed' && combinedJobStatus !== 'failed') {
      const interval = setInterval(checkCombinedJobStatus, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [combinedJobId, combinedJobStatus]);

  const downloadFromJob = async (jobId, endpointSuffix, defaultFilename) => {
    try {
      const response = await axios.get(`/results/${jobId}/${endpointSuffix}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = defaultFilename;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) filename = match[1];
      }
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setCombinedMessage('Error downloading: ' + (error.response?.data?.detail || error.message));
    }
  };

  const downloadCombinedExcel = async () => {
    if (!combinedResults) return;
    await downloadFromJob(combinedResults.job_id, 'excel', `${combinedResults.job_id}_identity_matrix.xlsx`);
  };

  const downloadCombinedFasta = async () => {
    if (!combinedResults) return;
    await downloadFromJob(combinedResults.job_id, 'fasta', 'combined_sequences.fasta');
  };

  const downloadCombinedBlastExcel = async () => {
    if (!combinedResults) return;
    await downloadFromJob(combinedResults.job_id, 'blast-excel', 'blast_results.xlsx');
  };

  const downloadCombinedHeatmap = async () => {
    if (!combinedResults) return;
    await downloadFromJob(combinedResults.job_id, 'heatmap', 'identity_heatmap.png');
  };

  const downloadFilterLog = async () => {
    if (!combinedResults) return;
    await downloadFromJob(combinedResults.job_id, 'filter-log', 'filtered_sequences.txt');
  };

  const renderHeatmapFromData = (data) => {
    if (!data) return null;
    const { heatmap_data, sequence_names } = data;
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
                <button type="button" onClick={() => downloadFromJob(jobId, 'blast-excel', 'blast_results.xlsx')}>Download Excel</button>
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
      <p className="tab-description">
        Compare multiple sequences pairwise to compute identity matrix and heatmap.
      </p>

      <form onSubmit={submitPairwiseAlignment} className="pairwise-form">
        <div className="input-section">
          <h3>Input Sequences (FASTA format, ≥2 sequences)</h3>
          <textarea
            value={pairwiseSequenceInput}
            onChange={(event) => setPairwiseSequenceInput(event.target.value)}
            placeholder={`>seq1\nATCGATCG...\n>seq2\nGCTAGCTA...`}
            rows={8}
          />
          <div className="file-row">
            <span>Or upload a file</span>
            <input type="file" onChange={handlePairwiseFileChange} accept=".fasta,.fa,.faa,.fna,.txt" />
          </div>
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

        <button type="submit" disabled={(!pairwiseFile && !pairwiseSequenceInput.trim()) || pairwiseJobStatus === 'processing'}>
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
              {pairwiseResults.has_excel && (
                <button type="button" onClick={() => downloadFromJob(pairwiseResults.job_id, 'excel', 'identity_matrix.xlsx')}>
                  Download Excel
                </button>
              )}
              {pairwiseResults.has_heatmap && (
                <button type="button" onClick={() => downloadFromJob(pairwiseResults.job_id, 'heatmap', 'heatmap.png')}>
                  Download Heatmap
                </button>
              )}
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

  const renderCombinedTab = () => (
    <div className="pairwise-tab">
      <h2>Combined BLAST + Pairwise Analysis</h2>
      <p className="tab-description">
        Upload multiple sequences (or paste FASTA text). Each will be BLASTed against NCBI,
        hit sequences will be fetched and combined for pairwise identity comparison,
        generating an identity matrix and heatmap.
      </p>

      <form onSubmit={submitCombinedAnalysis} className="pairwise-form">
        <div className="input-section">
          <h3>Input Sequences (FASTA format, ≥1 sequence)</h3>
          <textarea
            value={combinedSequenceInput}
            onChange={(event) => setCombinedSequenceInput(event.target.value)}
            placeholder={`>seq1\nATCGATCG...\n>seq2\nGCTAGCTA...`}
            rows={6}
          />
          <div className="file-row">
            <span>Or upload a file</span>
            <input type="file" onChange={handleCombinedFileChange} accept=".fasta,.fa,.faa,.fna,.txt" />
          </div>
          {combinedFile && <p className="file-info">Selected: {combinedFile.name}</p>}
        </div>

        <div className="config-section">
          <h3>BLAST Configuration</h3>

          <div className="form-grid">
            <div className="form-group">
              <label>Input sequence type</label>
              <select value={combinedSequenceType} onChange={(event) => setCombinedSequenceType(event.target.value)}>
                <option value="dna">DNA</option>
                <option value="rna">RNA</option>
                <option value="protein">Protein</option>
              </select>
            </div>

            <div className="form-group">
              <label>Target sequence type</label>
              <select value={combinedTargetType} onChange={(event) => setCombinedTargetType(event.target.value)}>
                <option value="dna">DNA</option>
                <option value="rna">RNA</option>
                <option value="protein">Protein</option>
              </select>
            </div>

            <div className="form-group">
              <label>BLAST database</label>
              <select value={combinedDatabase} onChange={(event) => setCombinedDatabase(event.target.value)}>
                {combinedFilteredDatabases.map(([key, value]) => (
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
                value={combinedExpectValue}
                onChange={(event) => setCombinedExpectValue(Number(event.target.value))}
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
                value={combinedMinIdentity}
                onChange={(event) => setCombinedMinIdentity(Math.max(0, Math.min(100, Number(event.target.value))))}
              />
            </div>

            <div className="form-group">
              <label>Max identity (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={combinedMaxIdentity}
                onChange={(event) => setCombinedMaxIdentity(Math.max(0, Math.min(100, Number(event.target.value))))}
              />
            </div>

            <div className="form-group">
              <label>BLAST results per query</label>
              <input
                type="number"
                min="1"
                max={maxNcbiResults}
                value={combinedResultCount}
                onChange={(event) => setCombinedResultCount(Math.max(1, Math.min(maxNcbiResults, Number(event.target.value))))}
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={combinedMegablast}
                  disabled={combinedSequenceType === 'protein' || combinedTargetType === 'protein'}
                  onChange={(event) => setCombinedMegablast(event.target.checked)}
                />
                Megablast
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Email for NCBI requests (recommended)</label>
            <input
              type="email"
              value={combinedEmail}
              onChange={(event) => setCombinedEmail(event.target.value)}
              placeholder="your.email@example.com"
            />
            <small>Required for fetching full sequences from NCBI. Without email, only BLAST alignment regions will be used.</small>
          </div>

          <h3>Alignment Configuration</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Alignment mode</label>
              <select value={combinedAlignmentMode} onChange={(event) => setCombinedAlignmentMode(event.target.value)}>
                <option value="global">Global</option>
                <option value="local">Local</option>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" disabled={(!combinedFile && !combinedSequenceInput.trim()) || combinedJobStatus === 'processing'}>
          {combinedJobStatus === 'processing' ? 'Processing...' : 'Start Combined Analysis'}
        </button>
      </form>

      {combinedMessage && (
        <div className={`message ${combinedMessage.startsWith('Error') ? 'error' : 'success'}`}>
          {combinedMessage}
        </div>
      )}

      {combinedJobId && combinedJobStatus && (
        <div className="status-section">
          <h3>Job Status</h3>
          <p><strong>Job ID:</strong> {combinedJobId}</p>
          <p><strong>Status:</strong> {combinedJobStatus}</p>
          {combinedProgress && <p><strong>Progress:</strong> {combinedProgress}</p>}

          {combinedJobStatus === 'processing' && (
            <div className="processing-info">
              {combinedProgress && (
                <div className="progress-steps">
                  <p><strong>Current step:</strong> {combinedProgress}</p>
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{
                      width: combinedProgress === 'running_blast' ? '25%' :
                             combinedProgress === 'generating_files' ? '75%' :
                             combinedProgress === 'completed' ? '100%' : '10%'
                    }} />
                  </div>
                </div>
              )}
              <p>Combined analysis in progress. BLAST queries and pairwise alignment may take several minutes.</p>
              <div className="loading-spinner" />
            </div>
          )}

          {combinedJobStatus === 'completed' && combinedResults && (
            <div className="pairwise-results">
              <div className="results-header">
                <h3>Combined Analysis Results</h3>
                <div className="button-row">
                  <button type="button" onClick={() => downloadFromApi(combinedResults.job_id, 'json')}>Download JSON</button>
                  <button type="button" onClick={() => downloadFromApi(combinedResults.job_id, 'csv')}>Download CSV</button>
                  {combinedResults.has_fasta && (
                    <button type="button" onClick={downloadCombinedFasta}>Download FASTA</button>
                  )}
                  {combinedResults.has_blast_excel && (
                    <button type="button" onClick={downloadCombinedBlastExcel}>BLAST Excel</button>
                  )}
                  {combinedResults.has_excel && (
                    <button type="button" onClick={downloadCombinedExcel}>Identity Excel</button>
                  )}
                  {combinedResults.has_heatmap && (
                    <button type="button" onClick={downloadCombinedHeatmap}>Heatmap PNG</button>
                  )}
                  {combinedResults.has_filter_log && (
                    <button type="button" onClick={downloadFilterLog}>Filter Log</button>
                  )}
                </div>
              </div>

              <div className="analysis-summary">
                <p>
                  <strong>{combinedResults.user_sequence_count}</strong> user sequences
                  + <strong>{combinedResults.ncbi_sequence_count}</strong> NCBI sequences
                  = <strong>{combinedResults.total_sequences}</strong> total sequences
                  in pairwise comparison
                </p>
                {combinedResults.filtered_count > 0 && (
                  <p className="filtered-info">
                    <strong>{combinedResults.filtered_count}</strong> sequences were filtered
                    {combinedResults.has_filter_log && ' (see filter log for details)'}
                  </p>
                )}
                <p>BLAST program: <strong>{combinedResults.blast_program}</strong> | Database: <strong>{combinedResults.database}</strong></p>
              </div>

              {/* Filtered Sequences Details */}
              {combinedResults.filtered_sequences && combinedResults.filtered_sequences.length > 0 && (
                <div className="filtered-sequences">
                  <h4>Filtered Sequences ({combinedResults.filtered_sequences.length})</h4>
                  <div className="results-table">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Accession</th>
                          <th>Reason</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combinedResults.filtered_sequences.map((entry, idx) => (
                          <tr key={idx} className="filtered-row">
                            <td>{idx + 1}</td>
                            <td>{entry.accession}</td>
                            <td>{entry.reason}</td>
                            <td>{entry.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="identity-matrix">
                <h4>Identity Matrix (%)</h4>
                <div className="matrix-table-container">
                  <table className="matrix-table">
                    <thead>
                      <tr>
                        <th>Sequences</th>
                        {combinedResults.sequence_names.map((name, idx) => (
                          <th key={name}>
                            {name}
                            <span className="source-tag">
                              {combinedResults.sequence_sources[idx] === 'user' ? ' [user]' : ' [ncbi]'}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {combinedResults.sequence_names.map((rowName, rowIndex) => {
                        // Compute identity from pairwise_details
                        const rowValues = [];
                        for (let colIndex = 0; colIndex < combinedResults.sequence_names.length; colIndex++) {
                          if (rowIndex === colIndex) {
                            rowValues.push(100.0);
                          } else {
                            const detail = combinedResults.pairwise_details.find(
                              d => (d.sequence_a === rowName && d.sequence_b === combinedResults.sequence_names[colIndex]) ||
                                   (d.sequence_b === rowName && d.sequence_a === combinedResults.sequence_names[colIndex])
                            );
                            rowValues.push(detail ? detail.identity : '-');
                          }
                        }
                        return (
                          <tr key={rowName}>
                            <td><strong>{rowName}</strong></td>
                            {rowValues.map((value, colIndex) => (
                              <td key={`${rowName}-${colIndex}`} className={rowIndex === colIndex ? 'diagonal' : ''}>
                                {typeof value === 'number' ? value.toFixed(2) : value}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="results-table">
                <h4>Pairwise Details</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Sequence A</th>
                      <th>Source A</th>
                      <th>Sequence B</th>
                      <th>Source B</th>
                      <th>Identity</th>
                      <th>Matches</th>
                      <th>Aligned length</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedResults.pairwise_details.map((row) => (
                      <tr key={`${row.sequence_a}-${row.sequence_b}`}>
                        <td>{row.sequence_a}</td>
                        <td className="source-cell">{row.source_a}</td>
                        <td>{row.sequence_b}</td>
                        <td className="source-cell">{row.source_b}</td>
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

          {combinedJobStatus === 'failed' && (
            <div className="error-info">
              <p>{combinedMessage || 'Combined analysis failed.'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderHeatmap = () => renderHeatmapFromData(pairwiseResults);

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
          <button type="button" className={activeTab === 'combined' ? 'active' : ''} onClick={() => setActiveTab('combined')}>
            Combined Analysis
          </button>
        </nav>
      </header>

      <main>
        {activeTab === 'blast' && renderBlastTab()}
        {activeTab === 'pairwise' && renderPairwiseTab()}
        {activeTab === 'combined' && renderCombinedTab()}
      </main>

      <footer>
        <p>Sequence Alignment Tool v1.1 - Bioinformatics Analysis Platform</p>
      </footer>
    </div>
  );
}

export default App;
