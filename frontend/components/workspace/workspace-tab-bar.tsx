import React from 'react';
import {
  EyeIcon,
  CodeBracketIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  KeyIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  CloudArrowUpIcon,
  RocketLaunchIcon,
  CreditCardIcon,
  GlobeAltIcon,
  ArchiveBoxIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import type { TabOrientation } from './workspace-tab-registry';

export interface WorkspaceTabBarTab {
  id: string;
  label: string;
}

export interface WorkspaceTabBarProps {
  tabs: WorkspaceTabBarTab[];
  activeTabId: string;
  orientation: TabOrientation;
  onTabChange: (tabId: string) => void;
  onOrientationToggle: () => void;
}

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  preview: EyeIcon,
  codeFiles: CodeBracketIcon,
  buildTargets: WrenchScrewdriverIcon,
  database: CircleStackIcon,
  auth: KeyIcon,
  security: ShieldExclamationIcon,
  analytics: ChartBarIcon,
  envVars: AdjustmentsHorizontalIcon,
  publishing: CloudArrowUpIcon,
  deploy: RocketLaunchIcon,
  payment: CreditCardIcon,
  domain: GlobeAltIcon,
  appStorage: ArchiveBoxIcon,
  agentSkills: CpuChipIcon,
};

export default function WorkspaceTabBar(props: WorkspaceTabBarProps) {
  const isVertical = props.orientation === 'vertical';

  return (
    <div
      className={`flex items-center gap-1 border-b border-gray-200 bg-gray-50 ${
        isVertical ? 'flex-col items-stretch border-b-0 border-r' : ''
      }`}
      data-testid="workspace-tab-bar"
    >
      <div
        className={`flex gap-1 overflow-x-auto px-2 py-1 ${
          isVertical ? 'flex-col overflow-x-visible overflow-y-auto px-1 py-2' : 'flex-1'
        }`}
      >
        {props.tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => props.onTabChange(tab.id)}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                props.activeTabId === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
              data-testid={`workspace-tab-${tab.id}`}
              aria-selected={props.activeTabId === tab.id}
              title={tab.label}
            >
              {isVertical ? (Icon ? <Icon className="h-5 w-5" /> : <span>{tab.label}</span>) : tab.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={props.onOrientationToggle}
        className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 mx-1"
        data-testid="workspace-tab-orientation-toggle"
        title={isVertical ? 'Horizontal tabs' : 'Vertical tabs'}
      >
        {isVertical ? '⇔' : '⇕'}
      </button>
    </div>
  );
}
