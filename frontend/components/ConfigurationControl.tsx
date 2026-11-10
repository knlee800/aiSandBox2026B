'use client';

import { useState, useEffect, ReactElement } from 'react';
import {
  ArrowPathIcon,
  BookOpenIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from '../hooks/useTranslations';
import Spinner from './ui/Spinner';

/**
 * Configuration Control Surface
 * 
 * Phase 35B-3: Configuration Control Surface (Implementation)
 * 
 * Purpose: Solve Problem 3 (Configuration Is Invisible)
 * 
 * What It Enables:
 * - Developer sees current runtime configuration
 * - Developer can change safe, supported configuration values
 * - Developer understands what requires restart vs what is live
 * - Developer never touches environment variables manually during normal use
 * 
 * LOCKED INVARIANTS:
 * - NO schema changes
 * - NO new backend endpoints
 * - NO unsafe runtime mutations
 * - NO environment variable writes from frontend
 * - NO config changes that violate startup guardrails
 * 
 * ALLOWED CONFIGURATION (ONLY THESE):
 * - Active AI provider (from allowed providers)
 * - Launch state (if already supported by backend)
 * - Abort mode (if already supported by backend)
 * 
 * Configuration Sources:
 * - Environment variables (read-only, shown for transparency)
 * - Runtime configuration (read from health/ready endpoint)
 * - Defaults (shown when not explicitly set)
 */

export type ConfigSource = 'env' | 'runtime' | 'default';
export type ConfigMutability = 'live' | 'restart-required' | 'locked';

export interface ConfigItem {
  key: string;
  value: string;
  source: ConfigSource;
  mutability: ConfigMutability;
  description: string;
  allowedValues?: string[];
  requiresRestart: boolean;
}

export interface ConfigurationState {
  items: ConfigItem[];
  lastUpdated: Date | null;
  status: 'loading' | 'ready' | 'error';
  errorMessage?: string;
}

interface ConfigurationControlProps {
  onClose?: () => void;
}

export default function ConfigurationControl({ onClose }: ConfigurationControlProps) {
  const t = useTranslations('configuration');
  const [config, setConfig] = useState<ConfigurationState>({
    items: [],
    lastUpdated: null,
    status: 'loading',
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  useEffect(() => {
    if (!onClose) {
      return;
    }

    const handleEscapeClose = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscapeClose);
    return () => {
      window.removeEventListener('keydown', handleEscapeClose);
    };
  }, [onClose]);

  const loadConfiguration = async () => {
    try {
      setConfig((prev) => ({ ...prev, status: 'loading' }));

      // Fetch configuration from health/ready endpoint
      const response = await fetch('/api/health/ready');
      
      if (!response.ok) {
        throw new Error(`Failed to load configuration: ${response.statusText}`);
      }

      const data = await response.json();

      // Build configuration items from health check response
      const items: ConfigItem[] = [];

      // AI Provider (from environment, shown in health check)
      // Phase 37C: Clarified that this value may show as 'stub' if not exposed by backend
      // Note: This is READ-ONLY from frontend perspective
      // Provider selection happens at startup via AI_PROVIDER env var
      const providerValue = getProviderFromHealthCheck(data) || 'stub';
      const providerDescription = providerValue === 'stub' && !getProviderFromHealthCheck(data)
        ? t('providerDescriptionStub')
        : t('providerDescription');
      
      items.push({
        key: 'AI_PROVIDER',
        value: providerValue,
        source: 'env',
        mutability: 'restart-required',
        description: providerDescription,
        allowedValues: ['stub', 'anthropic', 'openai', 'groq', 'xai', 'deepseek'],
        requiresRestart: true,
      });

      // Launch State (from environment, shown in health check)
      items.push({
        key: 'LAUNCH_STATE',
        value: data.launchState || 'UNKNOWN',
        source: 'env',
        mutability: 'restart-required',
        description: t('launchStateDescription'),
        allowedValues: ['CLOSED', 'INTERNAL', 'EARLY_ACCESS', 'PUBLIC'],
        requiresRestart: true,
      });

      // Abort Mode (from environment, shown in health check)
      items.push({
        key: 'ABORT_MODE',
        value: data.abortMode || 'NONE',
        source: 'env',
        mutability: 'restart-required',
        description: t('abortModeDescription'),
        allowedValues: ['NONE', 'EXECUTION_BLOCKED', 'FULL_SHUTDOWN'],
        requiresRestart: true,
      });

      // Environment
      items.push({
        key: 'NODE_ENV',
        value: data.environment || 'unknown',
        source: 'env',
        mutability: 'locked',
        description: t('nodeEnvDescription'),
        requiresRestart: true,
      });

      setConfig({
        items,
        lastUpdated: new Date(),
        status: 'ready',
      });
    } catch (error: any) {
      setConfig({
        items: [],
        lastUpdated: null,
        status: 'error',
        errorMessage: error.message || t('loadFailedMessage'),
      });
    }
  };

  const getProviderFromHealthCheck = (data: any): string | null => {
    // Phase 37C: Try to infer provider from health check data
    // The health check may include environment info that hints at the provider
    // However, this is a best-effort approach since provider info is not directly exposed
    
    // Check if environment data includes provider hints
    if (data.environment && typeof data.environment === 'object') {
      // Look for provider-related keys in environment
      const envKeys = Object.keys(data.environment);
      if (envKeys.includes('AI_PROVIDER')) {
        return data.environment.AI_PROVIDER;
      }
    }
    
    // Fallback: return null to indicate unknown
    // This will display as 'stub' in the UI (see line 96)
    return null;
  };

  const handleEdit = (item: ConfigItem) => {
    if (item.mutability === 'locked') {
      return; // Cannot edit locked items
    }

    setEditingKey(item.key);
    setEditValue(item.value);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleSaveEdit = async (item: ConfigItem) => {
    // CRITICAL: This is a READ-ONLY surface in Phase 35B-3
    // Configuration changes require:
    // 1. Updating environment variables
    // 2. Restarting the service
    // 
    // We do NOT implement runtime mutation here.
    // Instead, we show the user what needs to be done.

    alert(
      `${t('alertTitle')}\n\n` +
      `${t('alertToChange').replace('{key}', item.key)}\n\n` +
      `${t('alertStep1')}\n` +
      `   export ${item.key}="${editValue}"\n\n` +
      `${t('alertStep2')}\n` +
      `   npm run restart:api-gateway\n\n` +
      `${t('alertStep3')}\n\n` +
      `${t('alertNote')}`
    );

    handleCancelEdit();
  };

  const getMutabilityBadge = (mutability: ConfigMutability) => {
    switch (mutability) {
      case 'live':
        return (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded font-medium">
            {t('badgeLive')}
          </span>
        );
      case 'restart-required':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">
            {t('badgeRestartRequired')}
          </span>
        );
      case 'locked':
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded font-medium">
            {t('badgeLocked')}
          </span>
        );
    }
  };

  const getSourceBadge = (source: ConfigSource) => {
    switch (source) {
      case 'env':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
            {t('sourceEnvironment')}
          </span>
        );
      case 'runtime':
        return (
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded font-medium">
            {t('sourceRuntime')}
          </span>
        );
      case 'default':
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-medium">
            {t('sourceDefault')}
          </span>
        );
    }
  };

  if (config.status === 'loading') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-full relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
            title={t('close')}
            aria-label={t('close')}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <div className="flex items-center justify-center space-x-2">
          <Spinner className="h-6 w-6 text-brand" />
          <span className="text-gray-600">{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (config.status === 'error') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-full relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
            title={t('close')}
            aria-label={t('close')}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <div className="flex items-start space-x-2">
            <XCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">{t('loadFailedTitle')}</h3>
              <p className="text-sm text-red-700 mt-1">{config.errorMessage}</p>
              <button
                onClick={loadConfiguration}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                {t('retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cog6ToothIcon className="h-6 w-6" aria-hidden="true" />
            <h2 className="text-xl font-semibold">{t('title')}</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadConfiguration}
              className="inline-flex items-center gap-1 text-white hover:text-blue-100 transition-colors text-sm font-medium"
              title={t('refreshTitle')}
            >
              <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
              {t('refresh')}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white hover:text-blue-100 transition-colors"
                title={t('close')}
                aria-label={t('close')}
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {config.lastUpdated && (
          <p className="text-xs text-blue-100 mt-1">
            {t('lastUpdated')} {config.lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Configuration Items */}
      <div className="p-6">
        <div className="space-y-4">
          {config.items.map((item) => (
            <ConfigurationItem
              key={item.key}
              item={item}
              isEditing={editingKey === item.key}
              editValue={editValue}
              onEdit={handleEdit}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              getMutabilityBadge={getMutabilityBadge}
              getSourceBadge={getSourceBadge}
            />
          ))}
        </div>

        {/* Restart Warning */}
        {config.items.some((item) => item.requiresRestart) && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" aria-hidden="true" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 text-sm">
                  {t('restartWarningTitle')}
                </h3>
                <p className="text-xs text-yellow-800 mt-1">
                  {t('restartWarningBody')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Documentation Link */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
          <div className="flex items-start space-x-2">
            <BookOpenIcon className="h-5 w-5 text-gray-600" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm">
                {t('docsTitle')}
              </h3>
              <p className="text-xs text-gray-700 mt-1">
                {t('docsIntro')}
              </p>
              <ul className="text-xs text-gray-700 mt-2 space-y-1 list-disc list-inside">
                <li><code className="bg-white px-1 rounded">ARCHITECTURE.md</code> {t('docsArchitecture')}</li>
                <li><code className="bg-white px-1 rounded">docs/PHASE-32A-CHECKPOINT.md</code> {t('docsStartupValidation')}</li>
                <li><code className="bg-white px-1 rounded">docs/PHASE-28B-1-FINAL-CHECKPOINT.md</code> {t('docsLaunchState')}</li>
                <li><code className="bg-white px-1 rounded">docs/PHASE-28B-2-FINAL-CHECKPOINT.md</code> {t('docsAbortMode')}</li>
              </ul>
              <p className="text-xs text-gray-600 mt-2 italic inline-flex items-center gap-1">
                <LightBulbIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('docsHint')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConfigurationItemProps {
  item: ConfigItem;
  isEditing: boolean;
  editValue: string;
  onEdit: (item: ConfigItem) => void;
  onSave: (item: ConfigItem) => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  getMutabilityBadge: (mutability: ConfigMutability) => ReactElement;
  getSourceBadge: (source: ConfigSource) => ReactElement;
}

function ConfigurationItem({
  item,
  isEditing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onEditValueChange,
  getMutabilityBadge,
  getSourceBadge,
}: ConfigurationItemProps) {
  const t = useTranslations('configuration');
  return (
    <div className="border border-gray-200 rounded p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-semibold text-gray-900 font-mono text-sm">
              {item.key}
            </h3>
            {getMutabilityBadge(item.mutability)}
            {getSourceBadge(item.source)}
          </div>
          <p className="text-xs text-gray-600 mb-2">{item.description}</p>

          {/* Value Display/Edit */}
          {isEditing ? (
            <div className="mt-2">
              {item.allowedValues ? (
                <select
                  value={editValue}
                  onChange={(e) => onEditValueChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {item.allowedValues.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => onEditValueChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              )}
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={() => onSave(item)}
                  className="px-3 py-1 bg-brand text-white rounded text-xs hover:bg-brand-hover"
                >
                  {t('showInstructions')}
                </button>
                <button
                  onClick={onCancel}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono text-gray-900">
                {item.value}
              </code>
              {item.mutability !== 'locked' && (
                <button
                  onClick={() => onEdit(item)}
                  className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 font-medium"
                >
                  {t('change')}
                </button>
              )}
            </div>
          )}

          {/* Allowed Values */}
          {item.allowedValues && !isEditing && (
            <div className="mt-2">
              <p className="text-xs text-gray-500">
                {t('allowedValues')} {item.allowedValues.join(', ')}
              </p>
            </div>
          )}

          {/* Restart Warning */}
          {item.requiresRestart && (
            <div className="mt-2 flex items-center space-x-1 text-xs text-yellow-700">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('requiresRestartInline')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to get configuration instructions for manual changes
 */
export function getConfigurationInstructions(key: string, value: string): string {
  return `
Configuration Change Instructions
=================================

Variable: ${key}
New Value: ${value}

Steps:
1. Stop the service:
   npm run stop

2. Update environment variable:
   # In .env file or shell:
   export ${key}="${value}"

3. Restart the service:
   npm run start

4. Verify change:
   - Open System Readiness panel
   - Check that ${key} shows new value
   - Confirm all health checks pass

Important:
- Configuration changes are validated at startup
- Invalid values will cause startup failure
- Always verify changes in System Readiness panel
- Keep backup of previous configuration

Documentation:
- See ARCHITECTURE.md for configuration details
- See Phase 32A for startup validation rules
`.trim();
}
