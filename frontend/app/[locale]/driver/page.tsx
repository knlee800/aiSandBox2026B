'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ErrorRemediation, { ErrorContext, createErrorContext } from '@/components/ErrorRemediation';

export default function DriverPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('http://localhost:4000/api/ai/execute');
  const [currentError, setCurrentError] = useState<ErrorContext | null>(null);

  // Phase 37B: Load API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('driver_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  const handleExecute = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    if (!apiKey.trim()) {
      alert('Please enter an API key. Create one in the API Keys tab.');
      return;
    }

    setLoading(true);
    setCurrentError(null);
    setOutput('');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          response: {
            status: response.status,
            data: errorData,
          },
        };
      }

      const data = await response.json();
      setOutput(data.output || JSON.stringify(data, null, 2));
      
      // Save API key to localStorage for convenience
      localStorage.setItem('driver_api_key', apiKey.trim());
    } catch (err: any) {
      console.error('Execution failed:', err);
      setCurrentError(createErrorContext(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSystemStatus = () => {
    // Scroll to top to show SystemReadiness panel
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>AI Driver (Phase 37C)</h1>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
          Execute AI prompts using your API key. Create an API key in the "API Keys" tab if you don't have one.
        </p>

        {/* Phase 37C: System Status Link */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px', 
          backgroundColor: '#f0f9ff', 
          border: '1px solid #bfdbfe', 
          borderRadius: '6px' 
        }}>
          <p style={{ fontSize: '13px', color: '#1e40af', marginBottom: '8px' }}>
            💡 <strong>Having connection issues?</strong> Check the System Readiness panel at the top of this page.
          </p>
          <button
            onClick={handleCheckSystemStatus}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            View System Status
          </button>
        </div>

        {/* Phase 37B: API Key Configuration */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="apiKey" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            API Key: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key (from API Keys tab)"
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              fontFamily: 'monospace',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            💡 Create an API key in the "API Keys" tab, then paste it here.
          </p>
        </div>

        {/* Phase 37B: API URL Configuration */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="apiUrl" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            API URL:
          </label>
          <input
            id="apiUrl"
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              fontFamily: 'monospace',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="prompt" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Prompt: <span style={{ color: 'red' }}>*</span>
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            rows={6}
            placeholder="Example: Write a hello world function in Python"
            style={{
              width: '100%',
              padding: '8px',
              fontFamily: 'monospace',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        <button
          onClick={handleExecute}
          disabled={loading || !prompt.trim() || !apiKey.trim()}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            cursor: loading || !prompt.trim() || !apiKey.trim() ? 'not-allowed' : 'pointer',
            backgroundColor: loading || !prompt.trim() || !apiKey.trim() ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {loading ? 'Executing...' : 'Execute'}
        </button>

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
              borderRadius: '4px',
            }}>
              {output}
            </pre>
          </div>
        )}
      </div>

      {/* Phase 37B: ErrorRemediation Integration */}
      <ErrorRemediation
        error={currentError}
        onDismiss={() => setCurrentError(null)}
        onRetry={handleExecute}
      />
    </>
  );
}
