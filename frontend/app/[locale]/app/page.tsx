'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DriverPage from '../driver/page';
import ApiKeysPage from '../keys/page';
import ConfigurationControl from '@/components/ConfigurationControl';

/**
 * Unified Product Surface Integration
 * 
 * Phase 35C: Unified Product Surface Integration
 * 
 * Purpose: Single coherent entry point for all Phase 35 surfaces
 * 
 * Surfaces Integrated:
 * - Driver UI (Phase 34A)
 * - API Key Management (Phase 35B-4)
 * - Configuration Control (Phase 35B-3)
 * 
 * SystemReadiness (Phase 35B-1) is mounted globally in layout.tsx
 * 
 * Navigation: Minimal tab-based navigation
 * No backend changes, no new endpoints, no schema changes
 */

type Tab = 'driver' | 'keys' | 'configuration';

export default function AppPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const [activeTab, setActiveTab] = useState<Tab>('driver');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Phase 37C: Help Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-start space-x-3">
            <span className="text-xl">💡</span>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-gray-900 mb-1">Welcome to the AI Sandbox Platform</p>
              <p className="text-gray-700">
                <strong>Getting Started:</strong> First, check the System Readiness panel above to ensure all services are running. 
                Then create an API key in the "API Keys" tab, and use it in the "Driver" tab to execute AI prompts. 
                View and understand your configuration in the "Configuration" tab.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('driver')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'driver'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              title="Execute AI prompts using your API key"
            >
              🚀 Driver
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'keys'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              title="Create and manage API keys for authentication"
            >
              🔑 API Keys
            </button>
            <button
              onClick={() => setActiveTab('configuration')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'configuration'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              title="View system configuration and environment settings"
            >
              ⚙️ Configuration
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'driver' && <DriverPage />}
        {activeTab === 'keys' && <ApiKeysPage />}
        {activeTab === 'configuration' && (
          <div className="p-8">
            <ConfigurationControl />
          </div>
        )}
      </div>
    </div>
  );
}
