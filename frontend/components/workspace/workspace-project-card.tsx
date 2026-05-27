'use client';

import React from 'react';
import type { WorkspaceProjectSummary } from './workspace-projects.logic';

export type WorkspaceProjectCardViewMode = 'grid' | 'list';

interface WorkspaceProjectCardProps {
  project: WorkspaceProjectSummary;
  viewMode: WorkspaceProjectCardViewMode;
  onOpen: (projectId: string) => void;
  onMoveToWorkspaceAction?: (project: WorkspaceProjectSummary) => void;
  onSharingVisibilityAction?: (project: WorkspaceProjectSummary) => void;
  actionsMenuLabel?: string;
  moveToWorkspaceLabel?: string;
  sharingVisibilityLabel?: string;
  visibilityLabel?: string;
  privateVisibilityLabel?: string;
  publicVisibilityLabel?: string;
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
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
  const currentVisibilityLabel =
    props.project.visibility === 'public'
      ? props.publicVisibilityLabel ?? ''
      : props.privateVisibilityLabel ?? '';

  return (
    <div
      className={`w-full rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:border-gray-300 hover:bg-gray-50 ${
        isListView ? 'px-4 py-3' : 'px-4 py-4'
      }`}
    >
      <div
        className={`flex gap-3 ${
          isListView ? 'items-center justify-between' : 'items-start'
        }`}
      >
        <button
          type="button"
          onClick={() => props.onOpen(props.project.id)}
          className={`min-w-0 flex-1 text-left ${
            isListView ? 'flex items-center justify-between gap-3' : ''
          }`}
          data-testid={`workspace-project-card-${props.project.id}`}
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
        </button>
        <div className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label={props.actionsMenuLabel ?? props.project.name}
            aria-haspopup="menu"
            aria-expanded={isActionsMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setIsActionsMenuOpen((previous) => !previous);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100"
            data-testid={`workspace-project-card-actions-button-${props.project.id}`}
          >
            ...
          </button>
          <div
            className={`absolute right-0 z-10 mt-2 w-52 rounded-lg border border-gray-200 bg-white p-1 shadow-lg ${
              isActionsMenuOpen ? 'block' : 'hidden'
            }`}
            role="menu"
            hidden={!isActionsMenuOpen}
            onClick={(event) => event.stopPropagation()}
            data-testid={`workspace-project-card-actions-menu-${props.project.id}`}
          >
            <button
              type="button"
              role="menuitem"
              className="w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={(event) => {
                event.stopPropagation();
                props.onMoveToWorkspaceAction?.(props.project);
                setIsActionsMenuOpen(false);
              }}
              data-testid={`workspace-project-card-actions-move-${props.project.id}`}
            >
              {props.moveToWorkspaceLabel}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={(event) => {
                event.stopPropagation();
                props.onSharingVisibilityAction?.(props.project);
                setIsActionsMenuOpen(false);
              }}
              data-testid={`workspace-project-card-actions-visibility-${props.project.id}`}
            >
              {props.sharingVisibilityLabel}
            </button>
            <p className="px-3 pb-2 pt-1 text-xs text-gray-500">
              {props.visibilityLabel}: {currentVisibilityLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
