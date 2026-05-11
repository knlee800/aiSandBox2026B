'use client';

import React from 'react';
import type { WorkspaceProjectSummary } from './workspace-projects.logic';

export type WorkspaceProjectCardViewMode = 'grid' | 'list';

interface WorkspaceProjectCardProps {
  project: WorkspaceProjectSummary;
  viewMode: WorkspaceProjectCardViewMode;
  onOpen: (projectId: string) => void;
  openLabel?: string;
}

function formatProjectUpdatedAt(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString();
}

function getVisibilityBadgeClassName(visibility?: WorkspaceProjectSummary['visibility']): string {
  if (visibility === 'public') {
    return 'bg-emerald-100 text-emerald-700';
  }

  return 'bg-gray-100 text-gray-700';
}

export default function WorkspaceProjectCard(props: WorkspaceProjectCardProps) {
  const isListView = props.viewMode === 'list';

  return (
    <button
      type="button"
      onClick={() => props.onOpen(props.project.id)}
      className={`w-full rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:border-gray-300 hover:bg-gray-50 ${
        isListView ? 'px-4 py-3' : 'px-4 py-4'
      }`}
      data-testid={`workspace-project-card-${props.project.id}`}
    >
      <div
        className={`flex gap-3 ${
          isListView ? 'items-center justify-between' : 'flex-col'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{props.project.name}</p>
            {props.project.visibility ? (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getVisibilityBadgeClassName(
                  props.project.visibility,
                )}`}
              >
                {props.project.visibility}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-gray-500">{formatProjectUpdatedAt(props.project.updatedAt)}</p>
        </div>
        {props.openLabel ? (
          <span className="shrink-0 text-sm font-medium text-gray-700">{props.openLabel}</span>
        ) : null}
      </div>
    </button>
  );
}
