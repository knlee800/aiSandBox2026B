// PROJ-03-A0: Centralized project-first and recovery vocabulary for later
// Phase A slices. Nothing consumes these strings yet.
export const recoveryCopy = {
  actions: {
    startNewProject: 'Start a new project',
    openExistingProject: 'Open existing project',
    reopenProject: 'Reopen project',
    tryAgain: 'Try again',
    openOlderVersion: 'Open older version',
  },
  status: {
    workspaceDisconnected: 'Workspace disconnected',
    workspaceStoppedDueToInactivity: 'Workspace stopped due to inactivity',
    workspaceFailedToStart: 'Workspace failed to start',
    workspaceWasRestarted: 'Workspace was restarted',
    saving: 'Saving...',
    allChangesSaved: 'All changes saved',
    yourWorkIsSaved: 'Your work is saved',
    saveFailedRetry: 'Save failed - retry',
  },
  detail: {
    workspaceExpired: 'Your workspace expired, but your project can be reopened.',
    reconnectByReopening: 'Reconnect by reopening your project.',
    inactivityRecovery: 'Your project is safe. Reopen it to keep working.',
    failedToStartRecovery: 'Try reopening your project or open an older version.',
  },
} as const;

export type RecoveryCopy = typeof recoveryCopy;
