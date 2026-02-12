'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ErrorRemediation, { ErrorContext, createErrorContext } from '@/components/ErrorRemediation';

/**
 * API Key Management Page
 * 
 * Phase 35B-4: API Key Management Surface
 * 
 * Features:
 * - List API keys (masked)
 * - Create new API keys (show plaintext once)
 * - Revoke API keys
 * 
 * Uses existing backend endpoints:
 * - GET /api/keys
 * - POST /api/keys
 * - DELETE /api/keys/:id
 */

interface ApiKey {
  id: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
  isActive: boolean;
}

interface NewKeyResponse {
  apiKey: string;
  id: string;
  keyPrefix: string;
  createdAt: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResponse | null>(null);
  const [currentError, setCurrentError] = useState<ErrorContext | null>(null);
  const [scopesInput, setScopesInput] = useState('ai:execute,sessions:read');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    loadKeys();
  }, [router, locale]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/keys', {
        method: 'GET',
        headers: {
          'x-api-key': token || '',
        },
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
      setKeys(data);
    } catch (error) {
      console.error('Failed to load API keys:', error);
      setCurrentError(createErrorContext(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!scopesInput.trim()) {
      alert('Please enter at least one scope');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const scopes = scopesInput.split(',').map(s => s.trim()).filter(s => s);

      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': token || '',
        },
        body: JSON.stringify({ scopes }),
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
      setNewKey(data);
      loadKeys(); // Refresh the list
    } catch (error) {
      console.error('Failed to create API key:', error);
      setCurrentError(createErrorContext(error));
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': token || '',
        },
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

      loadKeys(); // Refresh the list
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      setCurrentError(createErrorContext(error));
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    alert('API key copied to clipboard!');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">API Key Management</h1>
          <p className="text-sm text-gray-600">
            Manage your API keys for programmatic access to the platform.
          </p>
        </div>

        {/* Create Key Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h2>
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scopes (comma-separated)
              </label>
              <input
                type="text"
                value={scopesInput}
                onChange={(e) => setScopesInput(e.target.value)}
                placeholder="ai:execute,sessions:read"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating}
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: ai:execute, sessions:read, sessions:write
              </p>
            </div>
            <button
              onClick={handleCreateKey}
              disabled={creating}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {creating ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </div>

        {/* Keys List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your API Keys</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading keys...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No API keys found. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className={`border rounded-lg p-4 ${
                    key.isActive ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <code className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
                          {key.keyPrefix}...
                        </code>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded ${
                            key.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {key.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Scopes:</span>{' '}
                          {key.scopes.join(', ')}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {formatDate(key.createdAt)}
                        </div>
                        {key.revokedAt && (
                          <div>
                            <span className="font-medium">Revoked:</span>{' '}
                            {formatDate(key.revokedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                    {key.isActive && (
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back to Sandbox */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push(`/${locale}/sandbox`)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Sandbox
          </button>
        </div>
      </div>

      {/* New Key Modal */}
      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4">
            <div className="bg-green-600 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-semibold">✓ API Key Created</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="text-sm font-semibold text-yellow-900 mb-2">
                  ⚠️ IMPORTANT: Save this key now!
                </p>
                <p className="text-sm text-yellow-800">
                  This is the ONLY time you will see the full API key.
                  Copy it now and store it securely.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your API Key
                </label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-gray-800 text-white px-4 py-3 rounded font-mono text-sm break-all">
                    {newKey.apiKey}
                  </code>
                  <button
                    onClick={() => handleCopyKey(newKey.apiKey)}
                    className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <div>
                  <span className="font-medium">Key ID:</span> {newKey.id}
                </div>
                <div>
                  <span className="font-medium">Prefix:</span> {newKey.keyPrefix}
                </div>
                <div>
                  <span className="font-medium">Created:</span> {formatDate(newKey.createdAt)}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setNewKey(null)}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 transition-colors font-medium"
              >
                I've Saved My Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Remediation */}
      <ErrorRemediation
        error={currentError}
        onDismiss={() => setCurrentError(null)}
        onRetry={loadKeys}
      />
    </div>
  );
}
