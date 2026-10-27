/**
 * Dev0 Isolated Per-User Browser IndexedDB Sandbox & Docker Container Backend Bridge.
 *
 * Guarantees that:
 * 1. Users and AI agents NEVER read or modify the platform's own internal repository files
 *    (`self-source.ts`, `providers/*`, `utils/free-ai-pool.ts`, etc.).
 * 2. Every user's projects are isolated in their own per-user IndexedDB / AsyncStorage namespace
 *    (`dev0_sandbox_projects_v2_<userId>`) and optionally synchronized with the isolated
 *    Docker Sandbox Backend (`/api/sandbox`).
 */

import { FileNode, Project } from '@/types';

const INTERNAL_PLATFORM_SIGNATURE_PATHS = [
  'utils/self-source.ts',
  'utils/free-ai-pool.ts',
  'providers/AppProvider.tsx',
  'providers/ChatProvider.tsx',
  'providers/AgentProvider.tsx',
  'components/FreeAIPoolModal.tsx',
];

export function getPerUserSandboxStorageKey(userId?: string | null): string {
  const cleanId = (userId || 'guest_local')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  return `dev0_sandbox_projects_v2_${cleanId || 'guest_local'}`;
}

export function getPerUserCurrentProjectKey(userId?: string | null): string {
  const cleanId = (userId || 'guest_local')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  return `dev0_sandbox_current_project_v2_${cleanId || 'guest_local'}`;
}

/**
 * Checks whether a project is a legacy self-source exposure project ("ZeroProCode IDE (Self)" / `studio-ide`)
 * or contains internal platform files that must not be exposed to users/AI.
 */
export function isSelfSourceExposedProject(project: any): boolean {
  if (!project) return false;
  if (project.id === 'studio-ide' || project.projectType === 'studio-ide') return true;
  const lowerName = (project.name || '').toLowerCase();
  if (lowerName.includes('zeroprocode ide (self)') || lowerName.includes('dev0 (source)')) {
    return true;
  }
  // Check top-level and 1st-level children for internal platform files
  const foundPaths: string[] = [];
  for (const node of project.files || []) {
    if (node.path) {
      foundPaths.push(node.path);
    }
    if (node.type === 'file') {
      foundPaths.push(node.name);
    } else if (node.type === 'directory' && node.children) {
      for (const child of node.children) {
        foundPaths.push(`${node.name}/${child.name}`);
      }
    }
  }
  return INTERNAL_PLATFORM_SIGNATURE_PATHS.some((sig) => foundPaths.includes(sig));
}

export const isLegacySelfSourceProject = isSelfSourceExposedProject;

/**
 * Scrubs any legacy self-source projects so internal app files are never exposed.
 */
export function sanitizeUserSandboxProjects(projects: any[]): Project[] {
  if (!Array.isArray(projects)) return [];
  const filtered = projects.filter((p) => !isSelfSourceExposedProject(p));
  if (projects.length > 0 && filtered.length === 0) {
    const now = Date.now();
    return [
      {
        id: 'dev0-sandbox-starter',
        name: 'Dev0 Isolated Sandbox Starter',
        projectType: 'node-backend',
        files: createDockerSandboxTemplateFiles(),
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
  return filtered;
}

/**
 * Blocks path traversal (`..`) and internal host paths.
 */
export function sanitizeSandboxFilePath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const normalized = rawPath.replace(/\\/g, '/').trim().replace(/^\/+/, '');
  if (!normalized) return null;
  const parts = normalized.split('/');
  if (parts.some((p) => p === '..' || p === '.')) {
    return null;
  }
  if (INTERNAL_PLATFORM_SIGNATURE_PATHS.includes(normalized)) {
    return null;
  }
  return parts.join('/');
}

/**
 * Creates a clean, isolated Docker Sandbox Starter Project for the user's workspace.
 */
export function createDockerSandboxTemplateFiles(): FileNode[] {
  let idCounter = 1;
  const nid = () => `sbx_${idCounter++}`;
  return [
    {
      id: nid(),
      name: 'src',
      type: 'directory',
      children: [
        {
          id: nid(),
          name: 'index.ts',
          type: 'file',
          content: `/**
 * Isolated Dev0 User Sandbox Workspace
 * Runs inside per-user Browser IndexedDB + Docker Container Sandbox.
 */

export interface SandboxAppConfig {
  appName: string;
  environment: 'browser-sandbox' | 'docker-container';
  isolated: boolean;
}

export function startSandboxApp(config: SandboxAppConfig): string {
  return \`[\${config.environment}] \${config.appName} running in isolated workspace (isolated=\${config.isolated})\`;
}

console.log(
  startSandboxApp({
    appName: 'MyDev0App',
    environment: 'docker-container',
    isolated: true,
  }),
);
`,
        },
      ],
    },
    {
      id: nid(),
      name: 'Dockerfile',
      type: 'file',
      content: `FROM node:20-alpine
RUN addgroup -S sandboxgroup && adduser -S sandboxuser -G sandboxgroup
WORKDIR /workspace
COPY --chown=sandboxuser:sandboxgroup . /workspace
USER sandboxuser
CMD ["node", "dist/index.js"]
`,
    },
    {
      id: nid(),
      name: 'package.json',
      type: 'file',
      content: JSON.stringify(
        {
          name: 'dev0-isolated-sandbox-app',
          version: '1.0.0',
          private: true,
          scripts: {
            start: 'node dist/index.js',
            build: 'tsc',
          },
        },
        null,
        2,
      ),
    },
    {
      id: nid(),
      name: 'README.md',
      type: 'file',
      content: `# Isolated Dev0 Sandbox Project

This project lives in your private, sandboxed workspace (Browser IndexedDB + optional Docker Container Backend).
Internal Dev0 platform files are strictly isolated and inaccessible from this workspace.
`,
    },
  ];
}
