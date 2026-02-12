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
            >
              Driver
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'keys'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              API Keys
            </button>
            <button
              onClick={() => setActiveTab('configuration')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'configuration'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configuration
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
