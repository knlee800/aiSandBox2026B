'use client';

import { useState } from 'react';

/**
 * Error Remediation Component
 * 
 * Phase 35B-1: Error Remediation Surface
 * 
 * Purpose: Solve Problem 2 (Error Messages Are Cryptic)
 * 
 * What It Enables:
 * - User understands what went wrong
 * - User knows exactly what to do next
 * - User can fix problems without external help
 * - User can retry after fixing
 * 
 * Interaction Model:
 * - Shown on error — appears when something fails
 * - Actionable — provides clear remediation steps
 * - Dismissible — user can close after reading
 * - Persistent — recent errors accessible for review
 */

export interface ErrorContext {
  id: string;
  timestamp: Date;
  title: string;
  problem: string;
  cause: string;
  remediation: RemediationStep[];
  requestId?: string;
  technicalDetails?: any;
}

export interface RemediationStep {
  type: 'action' | 'command' | 'info' | 'alternative';
  description: string;
  command?: string;
  action?: () => void;
}

interface ErrorRemediationProps {
  error: ErrorContext | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function ErrorRemediation({ error, onDismiss, onRetry }: ErrorRemediationProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!error) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-red-600 text-white p-4 rounded-t-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">❌</span>
              <h2 className="text-xl font-semibold">{error.title}</h2>
            </div>
            <button
              onClick={onDismiss}
              className="text-white hover:text-gray-200 transition-colors text-xl"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
          {error.requestId && (
            <p className="text-xs mt-2 opacity-90">Request ID: {error.requestId}</p>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Problem Description */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What Happened</h3>
            <p className="text-sm text-gray-700">{error.problem}</p>
          </div>

          {/* Root Cause */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Why It Happened</h3>
            <p className="text-sm text-gray-700">{error.cause}</p>
          </div>

          {/* Remediation Steps */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">How to Fix</h3>
            <div className="space-y-3">
              {error.remediation.map((step, index) => (
                <RemediationStepItem
                  key={index}
                  step={step}
                  index={index}
                />
              ))}
            </div>
          </div>

          {/* Technical Details (Collapsible) */}
          {error.technicalDetails && (
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
              >
                <span>{showTechnicalDetails ? '▼' : '▶'}</span>
                <span>Technical Details</span>
              </button>
              {showTechnicalDetails && (
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                  {JSON.stringify(error.technicalDetails, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            onClick={onDismiss}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Dismiss
          </button>
          {onRetry && (
            <button
              onClick={() => {
                onDismiss();
                onRetry();
              }}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface RemediationStepItemProps {
  step: RemediationStep;
  index: number;
}

function RemediationStepItem({ step, index }: RemediationStepItemProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStepIcon = () => {
    switch (step.type) {
      case 'action':
        return '👉';
      case 'command':
        return '💻';
      case 'info':
        return 'ℹ️';
      case 'alternative':
        return '🔄';
      default:
        return '•';
    }
  };

  const getStepColor = () => {
    switch (step.type) {
      case 'action':
        return 'bg-blue-50 border-blue-200';
      case 'command':
        return 'bg-gray-50 border-gray-200';
      case 'info':
        return 'bg-yellow-50 border-yellow-200';
      case 'alternative':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`p-3 rounded border ${getStepColor()}`}>
      <div className="flex items-start space-x-2">
        <span className="text-lg flex-shrink-0">{getStepIcon()}</span>
        <div className="flex-1">
          <p className="text-sm text-gray-900">
            <span className="font-semibold">Step {index + 1}:</span> {step.description}
          </p>
          {step.command && (
            <div className="mt-2 flex items-center space-x-2">
              <code className="flex-1 bg-gray-800 text-white px-3 py-2 rounded text-xs font-mono">
                {step.command}
              </code>
              <button
                onClick={() => handleCopy(step.command!)}
                className="px-3 py-2 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? '✓' : '📋'}
              </button>
            </div>
          )}
          {step.action && (
            <button
              onClick={step.action}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors font-medium"
            >
              Execute Action
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to create error context from API errors
 */
export function createErrorContext(error: any): ErrorContext {
  const timestamp = new Date();
  const id = `error-${timestamp.getTime()}`;

  // Handle Axios errors
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    // Map HTTP status codes to user-friendly errors
    switch (status) {
      case 404:
        return {
          id,
          timestamp,
          title: 'Resource Not Found',
          problem: data.message || 'The requested resource could not be found.',
          cause: 'The session may have expired, been deleted, or never existed.',
          remediation: [
            {
              type: 'action',
              description: 'Create a new session to continue working',
            },
            {
              type: 'info',
              description: 'Sessions are automatically cleaned up after inactivity',
            },
          ],
          requestId: data.requestId,
          technicalDetails: data,
        };

      case 410:
        return {
          id,
          timestamp,
          title: 'Session Terminated',
          problem: 'This session has been permanently terminated.',
          cause: data.message || 'The session exceeded its idle timeout or maximum lifetime.',
          remediation: [
            {
              type: 'action',
              description: 'Create a new session to continue working',
            },
            {
              type: 'info',
              description: 'Terminated sessions cannot be recovered',
            },
          ],
          requestId: data.requestId,
          technicalDetails: data,
        };

      case 429:
        return {
          id,
          timestamp,
          title: 'Rate Limit Exceeded',
          problem: 'Too many requests have been made.',
          cause: data.message || 'You have exceeded the request limit for this session.',
          remediation: [
            {
              type: 'action',
              description: 'Wait 60 seconds before trying again',
            },
            {
              type: 'info',
              description: 'Rate limits protect system stability',
            },
          ],
          requestId: data.requestId,
          technicalDetails: data,
        };

      case 503:
        return {
          id,
          timestamp,
          title: 'Service Unavailable',
          problem: 'The AI service is temporarily unavailable.',
          cause: data.message || 'The AI provider may be unreachable or the API key may be invalid.',
          remediation: [
            {
              type: 'command',
              description: 'Check if AI_PROVIDER is set correctly in .env',
              command: 'echo $AI_PROVIDER',
            },
            {
              type: 'command',
              description: 'Verify the API key is set (e.g., XAI_API_KEY for xai provider)',
              command: 'echo $XAI_API_KEY',
            },
            {
              type: 'alternative',
              description: 'Switch to stub provider (no API key required) by setting AI_PROVIDER=stub',
            },
          ],
          requestId: data.requestId,
          technicalDetails: data,
        };

      default:
        return {
          id,
          timestamp,
          title: `Error ${status}`,
          problem: data.message || 'An unexpected error occurred.',
          cause: 'The server returned an error response.',
          remediation: [
            {
              type: 'action',
              description: 'Try the operation again',
            },
            {
              type: 'info',
              description: 'If the problem persists, check the system status',
            },
          ],
          requestId: data.requestId,
          technicalDetails: data,
        };
    }
  }

  // Handle network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
    return {
      id,
      timestamp,
      title: 'Connection Failed',
      problem: 'Could not connect to the backend service.',
      cause: 'The API Gateway or required services may not be running.',
      remediation: [
        {
          type: 'command',
          description: 'Start the API Gateway',
          command: 'cd services/api-gateway && npm run start:dev',
        },
        {
          type: 'command',
          description: 'Check if services are running',
          command: 'curl http://localhost:4000/health',
        },
        {
          type: 'info',
          description: 'Ensure PostgreSQL is running before starting services',
        },
      ],
      technicalDetails: { code: error.code, message: error.message },
    };
  }

  // Generic error
  return {
    id,
    timestamp,
    title: 'Unexpected Error',
    problem: error.message || 'An unexpected error occurred.',
    cause: 'The system encountered an unexpected condition.',
    remediation: [
      {
        type: 'action',
        description: 'Try the operation again',
      },
      {
        type: 'info',
        description: 'If the problem persists, check the system readiness status',
      },
    ],
    technicalDetails: error,
  };
}
