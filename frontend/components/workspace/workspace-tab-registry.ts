export interface TabDefinition {
  id: string;
  labelKey: string;
  defaultVisible: boolean;
  order: number;
}

export const TAB_REGISTRY: readonly TabDefinition[] = [
  { id: 'preview', labelKey: 'preview', defaultVisible: true, order: 0 },
  { id: 'codeFiles', labelKey: 'codeFiles', defaultVisible: true, order: 1 },
  { id: 'database', labelKey: 'database', defaultVisible: true, order: 2 },
  { id: 'auth', labelKey: 'auth', defaultVisible: true, order: 3 },
  { id: 'security', labelKey: 'security', defaultVisible: true, order: 4 },
  { id: 'analytics', labelKey: 'analytics', defaultVisible: true, order: 5 },
  { id: 'envVars', labelKey: 'envVars', defaultVisible: true, order: 6 },
  { id: 'publishing', labelKey: 'publishing', defaultVisible: true, order: 7 },
  { id: 'deploy', labelKey: 'deploy', defaultVisible: true, order: 8 },
  { id: 'payment', labelKey: 'payment', defaultVisible: true, order: 9 },
  { id: 'domain', labelKey: 'domain', defaultVisible: true, order: 10 },
  { id: 'appStorage', labelKey: 'appStorage', defaultVisible: true, order: 11 },
  { id: 'agentSkills', labelKey: 'agentSkills', defaultVisible: true, order: 12 },
] as const;

export const DEFAULT_ACTIVE_TAB_ID = 'preview';

export type TabOrientation = 'horizontal' | 'vertical';

export const DEFAULT_TAB_ORIENTATION: TabOrientation = 'horizontal';

export const TAB_ORIENTATION_STORAGE_KEY = 'workspace-tab-orientation';
export const AI_PANEL_COLLAPSED_STORAGE_KEY = 'workspace-ai-panel-collapsed';
