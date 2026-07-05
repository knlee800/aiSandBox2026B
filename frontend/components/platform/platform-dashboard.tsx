'use client';

import React from 'react';
import { BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { listAgents } from '@/lib/agent-platform/agent-registry';
import type { AgentStatus } from '@/lib/agent-platform/agent-registry';
import AgentStationCard from './agent-station-card';

import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

type LocaleMessages = Record<string, unknown>;

function getLocaleMessages(locale?: string): LocaleMessages {
  if (locale === 'zh-TW') return zhTwMessages as LocaleMessages;
  if (locale === 'zh-CN') return zhCnMessages as LocaleMessages;
  return enMessages as LocaleMessages;
}

function resolveNestedMessage(
  source: LocaleMessages,
  fullKey: string,
): string {
  const keys = fullKey.split('.');
  let value: unknown = source;

  for (const keyPart of keys) {
    if (value && typeof value === 'object' && keyPart in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[keyPart];
    } else {
      return fullKey;
    }
  }

  return typeof value === 'string' ? value : fullKey;
}

function getStatusLabel(
  status: AgentStatus,
  messages: LocaleMessages,
): string {
  if (status === 'active') return resolveNestedMessage(messages, 'platform.agentStationActive');
  if (status === 'coming_soon') return resolveNestedMessage(messages, 'platform.agentStationComingSoon');
  return resolveNestedMessage(messages, 'platform.agentStationDisabled');
}

export interface PlatformDashboardProps {
  locale?: string;
}

export default function PlatformDashboard({ locale }: PlatformDashboardProps) {
  const messages = getLocaleMessages(locale);
  const agents = listAgents();

  const title = resolveNestedMessage(messages, 'platform.title');
  const subtitle = resolveNestedMessage(messages, 'platform.subtitle');

  return (
    <div
      className="flex min-h-screen flex-col bg-gray-50"
      data-testid="platform-dashboard"
    >
      <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <BuildingOffice2Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            {agents.map((agent) => (
              <AgentStationCard
                key={agent.id}
                id={agent.id}
                name={resolveNestedMessage(messages, agent.nameKey)}
                role={resolveNestedMessage(messages, agent.roleKey)}
                description={resolveNestedMessage(messages, agent.descriptionKey)}
                status={agent.status}
                enabled={agent.enabled}
                statusLabel={getStatusLabel(agent.status, messages)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
