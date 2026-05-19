export type AuthTemplateFramework = 'nextjs';
export type AuthTemplateRouter = 'app-router';
export type AuthTemplatePackageKind = 'dependency' | 'devDependency';

export interface AuthTemplateMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface AuthTemplateSupportedFramework {
  framework: AuthTemplateFramework;
  router: AuthTemplateRouter;
  packageName: 'next';
  supportedMajorVersions: readonly string[];
}

export interface AuthTemplateDependency {
  name: string;
  version: string;
  kind: AuthTemplatePackageKind;
  reason: string;
}

export interface AuthTemplateEnvVar {
  name: string;
  required: boolean;
  description: string;
  example: string;
}

export interface AuthTemplateFile {
  path: string;
  description: string;
  content: string;
}

export interface AuthTemplateManifest {
  dependencies: readonly AuthTemplateDependency[];
  env: readonly AuthTemplateEnvVar[];
  filePaths: readonly string[];
}

export interface AuthTemplate {
  metadata: AuthTemplateMetadata;
  supportedFramework: AuthTemplateSupportedFramework;
  manifest: AuthTemplateManifest;
  files: readonly AuthTemplateFile[];
}
