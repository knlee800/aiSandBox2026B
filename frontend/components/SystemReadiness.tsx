'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import ConfigurationControl from './ConfigurationControl';

/**
 * System Readiness Component
 * 
 * Phase 35B-1: System Readiness Surface
 * Phase 35B-3: Configuration Control Surface (Integration)
 * 
 * Purpose: Solve Problem 1 (Environment Setup Friction) and Problem 6 (No System State Visibility)
 * 
 * What It Enables:
 * - User knows if system is ready to use
 * - User knows what's wrong if system is not ready
 * - User can fix problems without reading logs
 * - User can view and understand runtime configuration (Phase 35B-3)
 * 
 * Interaction Model:
 * - Always visible when system is not ready
 * - Gets out of the way when system is ready
 * - Actionable — every error has remediation guidance
 * - Configuration panel accessible via button
 */

interface HealthCheck {
  status: 'ok' | 'error' | 'checking';
  message?: string;
  details?: any;
}

interface SystemStatus {
  apiGateway: HealthCheck;
  database: HealthCheck;
  environment: HealthCheck;
  overall: 'ready' | 'not_ready' | 'checking';
}

function shouldRenderSystemReadiness(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true'
  );
}

export default function SystemReadiness() {
  const shouldRenderControls = shouldRenderSystemReadiness();
  const [status, setStatus] = useState<SystemStatus>({
    apiGateway: { status: 'checking' },
    database: { status: 'checking' },
    environment: { status: 'checking' },
    overall: 'checking',
  });
  const [collapsed, setCollapsed] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [showConfiguration, setShowConfiguration] = useState(false);

  const checkSystemReadiness = async () => {
    try {
      // Check API Gateway health
      const healthResponse = await axios.get('/api/health', {
        timeout: 5000,
      });

      if (healthResponse.status === 200) {
        setStatus(prev => ({
          ...prev,
          apiGateway: {
            status: 'ok',
            message: 'API Gateway is running',
            details: healthResponse.data,
          },
        }));

        // Check readiness (includes database, environment, etc.)
        try {
          const readyResponse = await axios.get('/api/health/ready', {
            timeout: 5000,
          });

          if (readyResponse.status === 200 && readyResponse.data.status === 'ready') {
            setStatus({
              apiGateway: {
                status: 'ok',
                message: 'API Gateway is running',
                details: healthResponse.data,
              },
              database: {
                status: 'ok',
                message: 'Database connected',
                details: readyResponse.data.checks,
              },
              environment: {
                status: 'ok',
                message: 'Environment validated',
                details: readyResponse.data.environment,
              },
              overall: 'ready',
            });
            setLastCheck(new Date());
          } else {
            throw new Error('System not ready');
          }
        } catch (readyError: any) {
          // Readiness check failed
          const errorData = readyError.response?.data;
          setStatus({
            apiGateway: {
              status: 'ok',
              message: 'API Gateway is running',
              details: healthResponse.data,
            },
            database: {
              status: 'error',
              message: errorData?.error || 'Database connection failed',
              details: errorData,
            },
            environment: {
              status: 'error',
              message: 'Environment validation failed',
              details: errorData,
            },
            overall: 'not_ready',
          });
          setLastCheck(new Date());
        }
      }
    } catch (error: any) {
      // API Gateway is not reachable
      setStatus({
        apiGateway: {
          status: 'error',
          message: error.code === 'ECONNREFUSED' 
            ? 'API Gateway is not running'
            : 'Failed to connect to API Gateway',
          details: { error: error.message, code: error.code },
        },
        database: {
          status: 'error',
          message: 'Cannot check - API Gateway not reachable',
        },
        environment: {
          status: 'error',
          message: 'Cannot check - API Gateway not reachable',
        },
        overall: 'not_ready',
      });
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    if (!shouldRenderControls) {
      return;
    }

    // Initial check
    checkSystemReadiness();

    // Poll every 10 seconds when not ready, every 30 seconds when ready
    const interval = setInterval(
      checkSystemReadiness,
      status.overall === 'ready' ? 30000 : 10000
    );

    return () => clearInterval(interval);
  }, [status.overall, shouldRenderControls]);

  // Auto-collapse when system is ready (after 3 seconds)
  useEffect(() => {
    if (!shouldRenderControls) {
      return;
    }

    if (status.overall === 'ready' && !collapsed) {
      const timer = setTimeout(() => {
        setCollapsed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status.overall, collapsed, shouldRenderControls]);

  if (!shouldRenderControls) {
    return null;
  }

  // If system is ready and collapsed, show minimal indicator
  if (status.overall === 'ready' && collapsed) {
    return (
      <>
        <div className="fixed top-16 right-4 z-50 flex space-x-2">
          <button
            onClick={() => setShowConfiguration(true)}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 text-sm"
            title="View Configuration"
          >
            <span>⚙️</span>
            <span>Config</span>
          </button>
          <button
            onClick={() => setCollapsed(false)}
            className="bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-green-700 transition-colors flex items-center space-x-2 text-sm"
            title="System Ready - Click to expand"
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span>System Ready</span>
          </button>
        </div>

        {/* Configuration Modal */}
        {showConfiguration && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
            onClick={() => setShowConfiguration(false)}
          >
            <div onClick={(event) => event.stopPropagation()} className="w-full max-w-4xl">
              <ConfigurationControl onClose={() => setShowConfiguration(false)} />
            </div>
          </div>
        )}
      </>
    );
  }

  // Show full status panel
  return (
    <div className="fixed top-16 right-4 z-50 w-96 bg-white rounded-lg shadow-2xl border border-gray-200">
      {/* Header */}
      <div className={`p-4 rounded-t-lg ${
        status.overall === 'ready' 
          ? 'bg-green-600' 
          : status.overall === 'checking'
          ? 'bg-yellow-600'
          : 'bg-red-600'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              status.overall === 'ready'
                ? 'bg-white'
                : status.overall === 'checking'
                ? 'bg-white animate-pulse'
                : 'bg-white'
            }`}></div>
            <h3 className="text-white font-semibold">
              {status.overall === 'ready' 
                ? '✓ System Ready' 
                : status.overall === 'checking'
                ? '⏳ Checking System...'
                : '✗ System Not Ready'}
            </h3>
          </div>
          {status.overall === 'ready' && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-white hover:text-gray-200 transition-colors"
              title="Minimize"
            >
              ✕
            </button>
          )}
        </div>
        {lastCheck && (
          <p className="text-white text-xs mt-1 opacity-90">
            Last checked: {lastCheck.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Status Details */}
      <div className="p-4 space-y-3">
        {/* API Gateway Status */}
        <StatusItem
          name="API Gateway"
          status={status.apiGateway.status}
          message={status.apiGateway.message}
          remediation={
            status.apiGateway.status === 'error' ? (
              <div className="mt-2 p-3 bg-red-50 rounded text-xs">
                <p className="font-semibold text-red-900 mb-1">How to Fix:</p>
                <ol className="list-decimal list-inside space-y-1 text-red-800">
                  <li>Open a terminal in the project root</li>
                  <li>Navigate to services/api-gateway</li>
                  <li>Run: <code className="bg-red-100 px-1 py-0.5 rounded">npm run start:dev</code></li>
                  <li>Wait for "Application is running" message</li>
                </ol>
              </div>
            ) : null
          }
        />

        {/* Database Status */}
        <StatusItem
          name="Database"
          status={status.database.status}
          message={status.database.message}
          remediation={
            status.database.status === 'error' && status.apiGateway.status === 'ok' ? (
              <div className="mt-2 p-3 bg-red-50 rounded text-xs">
                <p className="font-semibold text-red-900 mb-1">How to Fix:</p>
                <ol className="list-decimal list-inside space-y-1 text-red-800">
                  <li>Ensure PostgreSQL is installed</li>
                  <li>Start PostgreSQL:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>macOS: <code className="bg-red-100 px-1 py-0.5 rounded">brew services start postgresql</code></li>
                      <li>Windows: Start PostgreSQL service</li>
                      <li>Linux: <code className="bg-red-100 px-1 py-0.5 rounded">sudo systemctl start postgresql</code></li>
                    </ul>
                  </li>
                  <li>Check DATABASE_URL in .env file</li>
                  <li>Restart API Gateway</li>
                </ol>
              </div>
            ) : null
          }
        />

        {/* Environment Status */}
        <StatusItem
          name="Environment"
          status={status.environment.status}
          message={status.environment.message}
          remediation={
            status.environment.status === 'error' && status.apiGateway.status === 'ok' ? (
              <div className="mt-2 p-3 bg-red-50 rounded text-xs">
                <p className="font-semibold text-red-900 mb-1">How to Fix:</p>
                <ol className="list-decimal list-inside space-y-1 text-red-800">
                  <li>Check .env file in services/api-gateway</li>
                  <li>Ensure required variables are set:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>NODE_ENV (development/staging/production)</li>
                      <li>DATABASE_URL</li>
                      <li>AI_PROVIDER (stub/anthropic/openai/xai/etc.)</li>
                      <li>LAUNCH_STATE</li>
                      <li>ABORT_MODE</li>
                    </ul>
                  </li>
                  <li>Restart API Gateway</li>
                </ol>
              </div>
            ) : null
          }
        />
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg space-y-2">
        <button
          onClick={() => setShowConfiguration(true)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center space-x-2"
        >
          <span>⚙️</span>
          <span>View Configuration</span>
        </button>
        <button
          onClick={checkSystemReadiness}
          disabled={status.overall === 'checking'}
          className="w-full bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 disabled:bg-gray-300 transition-colors text-sm font-medium"
        >
          {status.overall === 'checking' ? 'Checking...' : 'Recheck Now'}
        </button>
      </div>

      {/* Configuration Modal */}
      {showConfiguration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowConfiguration(false)}
        >
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-4xl">
            <ConfigurationControl onClose={() => setShowConfiguration(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

interface StatusItemProps {
  name: string;
  status: 'ok' | 'error' | 'checking';
  message?: string;
  remediation?: React.ReactNode;
}

function StatusItem({ name, status, message, remediation }: StatusItemProps) {
  return (
    <div className="border border-gray-200 rounded p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className={`text-lg ${
              status === 'ok' 
                ? '✓ text-green-600' 
                : status === 'checking'
                ? '⏳ text-yellow-600'
                : '✗ text-red-600'
            }`}>
              {status === 'ok' ? '✓' : status === 'checking' ? '⏳' : '✗'}
            </span>
            <span className="font-medium text-sm text-gray-900">{name}</span>
          </div>
          {message && (
            <p className={`text-xs mt-1 ml-6 ${
              status === 'ok' 
                ? 'text-green-700' 
                : status === 'checking'
                ? 'text-yellow-700'
                : 'text-red-700'
            }`}>
              {message}
            </p>
          )}
        </div>
      </div>
      {remediation}
    </div>
  );
}
