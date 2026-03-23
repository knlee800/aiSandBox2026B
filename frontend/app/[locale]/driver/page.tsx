'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ErrorRemediation, { ErrorContext, createErrorContext } from '@/components/ErrorRemediation';

const DRIVER_LAST_EXECUTION_STATE_KEY = 'driver_last_execution_state';

interface DriverExecutionStatusResponse {
  executionId?: string;
  status?: string;
  tokensUsed?: number;
  output?: string;
}

interface DriverStoredExecutionState {
  prompt: string;
  output: string;
  executionId: string | null;
  status: string | null;
  statusDetail: string;
  lastStatusCheckAt: string | null;
}

export default function DriverPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('/api/ai/execute');
  const [currentError, setCurrentError] = useState<ErrorContext | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState('');
  const [lastStatusCheckAt, setLastStatusCheckAt] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Phase 37B: Load API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('driver_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    const savedExecutionStateRaw = localStorage.getItem(DRIVER_LAST_EXECUTION_STATE_KEY);
    if (!savedExecutionStateRaw) {
      return;
    }

    try {
      const savedExecutionState = JSON.parse(savedExecutionStateRaw) as Partial<DriverStoredExecutionState>;
      if (typeof savedExecutionState.prompt === 'string') {
        setPrompt(savedExecutionState.prompt);
      }
      if (typeof savedExecutionState.output === 'string') {
        setOutput(savedExecutionState.output);
      }
      if (typeof savedExecutionState.executionId === 'string') {
        setExecutionId(savedExecutionState.executionId);
      }
      if (typeof savedExecutionState.status === 'string') {
        setExecutionStatus(savedExecutionState.status);
      }
      if (typeof savedExecutionState.statusDetail === 'string') {
        setStatusDetail(savedExecutionState.statusDetail);
      }
      if (typeof savedExecutionState.lastStatusCheckAt === 'string') {
        setLastStatusCheckAt(savedExecutionState.lastStatusCheckAt);
      }
    } catch {
      localStorage.removeItem(DRIVER_LAST_EXECUTION_STATE_KEY);
    }
  }, []);

  const persistExecutionState = useCallback(
    (next: {
      nextPrompt?: string;
      nextOutput?: string;
      nextExecutionId?: string | null;
      nextExecutionStatus?: string | null;
      nextStatusDetail?: string;
      nextLastStatusCheckAt?: string | null;
    }) => {
      const stateToPersist: DriverStoredExecutionState = {
        prompt: next.nextPrompt ?? prompt,
        output: next.nextOutput ?? output,
        executionId: next.nextExecutionId === undefined ? executionId : next.nextExecutionId,
        status: next.nextExecutionStatus === undefined ? executionStatus : next.nextExecutionStatus,
        statusDetail: next.nextStatusDetail ?? statusDetail,
        lastStatusCheckAt:
          next.nextLastStatusCheckAt === undefined ? lastStatusCheckAt : next.nextLastStatusCheckAt,
      };

      localStorage.setItem(DRIVER_LAST_EXECUTION_STATE_KEY, JSON.stringify(stateToPersist));
    },
    [executionId, executionStatus, lastStatusCheckAt, output, prompt, statusDetail],
  );

  const handleRefreshExecutionStatus = useCallback(async () => {
    if (!executionId || !apiKey.trim()) {
      return;
    }

    setStatusLoading(true);
    try {
      const response = await fetch(`/api/ai/executions/${encodeURIComponent(executionId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed (${response.status})`);
      }

      const data = (await response.json()) as DriverExecutionStatusResponse;
      const refreshedStatus = typeof data.status === 'string' ? data.status : 'queued';
      const refreshedExecutionId = typeof data.executionId === 'string' ? data.executionId : executionId;
      const checkedAt = new Date().toLocaleTimeString();

      let nextStatusDetail = '';
      if (refreshedStatus === 'queued' || refreshedStatus === 'running') {
        nextStatusDetail = 'Execution is still processing. Status will keep refreshing automatically.';
      } else if (refreshedStatus === 'completed') {
        nextStatusDetail =
          typeof data.tokensUsed === 'number'
            ? `Execution completed. Tokens used: ${data.tokensUsed}.`
            : 'Execution completed.';
      } else if (refreshedStatus === 'failed') {
        nextStatusDetail = 'Execution finished with failed status.';
      } else if (refreshedStatus === 'cancelled') {
        nextStatusDetail = 'Execution was cancelled.';
      } else if (refreshedStatus === 'timeout') {
        nextStatusDetail = 'Execution timed out.';
      }

      setExecutionId(refreshedExecutionId);
      setExecutionStatus(refreshedStatus);
      setStatusDetail(nextStatusDetail);
      setLastStatusCheckAt(checkedAt);
      setOutput((previousOutput) => previousOutput || JSON.stringify(data, null, 2));

      persistExecutionState({
        nextExecutionId: refreshedExecutionId,
        nextExecutionStatus: refreshedStatus,
        nextStatusDetail,
        nextLastStatusCheckAt: checkedAt,
        nextOutput: output || JSON.stringify(data, null, 2),
      });
    } catch (error) {
      console.error('Status refresh failed:', error);
    } finally {
      setStatusLoading(false);
    }
  }, [apiKey, executionId, output, persistExecutionState]);

  useEffect(() => {
    if ((executionStatus !== 'queued' && executionStatus !== 'running') || !executionId || !apiKey.trim()) {
      return;
    }

    const pollInterval = setInterval(() => {
      void handleRefreshExecutionStatus();
    }, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [apiKey, executionId, executionStatus, handleRefreshExecutionStatus]);

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
    setExecutionId(null);
    setExecutionStatus(null);
    setStatusDetail('');
    setLastStatusCheckAt(null);
    persistExecutionState({
      nextPrompt: prompt,
      nextOutput: '',
      nextExecutionId: null,
      nextExecutionStatus: null,
      nextStatusDetail: '',
      nextLastStatusCheckAt: null,
    });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          provider: 'xai',
          sessionId: crypto.randomUUID(),
          conversationId: crypto.randomUUID(),
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

      const data = (await response.json()) as DriverExecutionStatusResponse;
      const nextOutput = data.output || JSON.stringify(data, null, 2);
      const nextExecutionId = typeof data.executionId === 'string' ? data.executionId : null;
      const nextExecutionStatus = typeof data.status === 'string' ? data.status : null;
      const checkedAt = new Date().toLocaleTimeString();
      const nextStatusDetail =
        nextExecutionStatus === 'queued'
          ? 'Execution accepted and queued. Status will refresh automatically below.'
          : '';

      setOutput(nextOutput);
      setExecutionId(nextExecutionId);
      setExecutionStatus(nextExecutionStatus);
      setStatusDetail(nextStatusDetail);
      setLastStatusCheckAt(nextExecutionStatus ? checkedAt : null);
      
      // Save API key to localStorage for convenience
      localStorage.setItem('driver_api_key', apiKey.trim());
      persistExecutionState({
        nextPrompt: prompt.trim(),
        nextOutput,
        nextExecutionId,
        nextExecutionStatus,
        nextStatusDetail,
        nextLastStatusCheckAt: nextExecutionStatus ? checkedAt : null,
      });
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
            placeholder="Try asking: 'Write a hello world function in Python' or 'Create a simple REST API endpoint' or 'Explain how async/await works'"
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
            💡 Ask the AI to write code, explain concepts, or help with debugging.
          </p>
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

        {executionId && (
          <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#fafafa' }}>
            <p style={{ margin: 0, fontSize: '13px' }}>
              <strong>Execution ID:</strong> <code>{executionId}</code>
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>
              <strong>Status:</strong> {executionStatus || 'queued'}
            </p>
            {lastStatusCheckAt && (
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#666' }}>
                Last status check: {lastStatusCheckAt}
              </p>
            )}
            {statusDetail && (
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#1f2937' }}>
                {statusDetail}
              </p>
            )}
            <button
              onClick={() => void handleRefreshExecutionStatus()}
              disabled={loading || statusLoading || !apiKey.trim()}
              style={{
                marginTop: '10px',
                padding: '6px 10px',
                fontSize: '12px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || statusLoading || !apiKey.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || statusLoading || !apiKey.trim() ? 0.6 : 1,
              }}
            >
              {statusLoading ? 'Refreshing status...' : 'Refresh Execution Status'}
            </button>
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
