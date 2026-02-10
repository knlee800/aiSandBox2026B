'use client';

import { useState } from 'react';

export default function DriverPage() {
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExecute = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError('');
    setOutput('');

    try {
      const response = await fetch('http://localhost:4000/api/ai/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'valid-api-key', // Using existing test API key
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setOutput(data.output || JSON.stringify(data, null, 2));
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>AI Driver (Phase 34A)</h1>
      
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="prompt" style={{ display: 'block', marginBottom: '5px' }}>
          Prompt:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          rows={6}
          style={{
            width: '100%',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: '14px',
            border: '1px solid #ccc',
          }}
        />
      </div>

      <button
        onClick={handleExecute}
        disabled={loading || !prompt.trim()}
        style={{
          padding: '10px 20px',
          fontSize: '14px',
          cursor: loading ? 'wait' : 'pointer',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        {loading ? 'Executing...' : 'Execute'}
      </button>

      {error && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fee', border: '1px solid #fcc' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {output && (
        <div style={{ marginTop: '20px' }}>
          <strong>Output:</strong>
          <pre style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: '13px',
          }}>
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
