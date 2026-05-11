'use client';

import React from 'react';
import type { WorkspacePublicProjectSummary } from './workspace-projects.logic';

interface WorkspaceTemplateCardProps {
  project: WorkspacePublicProjectSummary;
  onFork: (projectId: string) => void;
  isForking?: boolean;
  forkLabel?: string;
  forkingLabel?: string;
}

function formatProjectUpdatedAt(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString();
}

export default function WorkspaceTemplateCard(props: WorkspaceTemplateCardProps) {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      data-testid={`workspace-template-card-${props.project.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{props.project.name}</p>
            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {props.project.visibility}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">{formatProjectUpdatedAt(props.project.updatedAt)}</p>
        </div>
        <button
          type="button"
          onClick={() => props.onFork(props.project.id)}
          disabled={props.isForking}
          className="shrink-0 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          data-testid={`workspace-template-card-fork-${props.project.id}`}
        >
          {props.isForking ? props.forkingLabel ?? props.forkLabel ?? '' : props.forkLabel ?? ''}
        </button>
      </div>
    </div>
  );
}
