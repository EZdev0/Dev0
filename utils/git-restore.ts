import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileNode } from '@/types';

export interface GitRestoreFileEntry {
  path: string;
  name: string;
  content: string;
}

export interface GitDiffSummary {
  added: string[];
  modified: string[];
  deleted: string[];
  changedPaths: string[];
  unchangedCount: number;
}

export interface GitRestorePoint {
  id: string;
  commitHash: string;
  projectId: string;
  projectName: string;
  message: string;
  label: string;
  author: 'user' | 'ai' | 'auto-guard' | 'auto' | 'manual' | 'ai-tool';
  source: string;
  backend: 'browser-git' | 'docker-git';
  createdAt: number;
  timestamp: number;
  fileCount: number;
  totalBytes: number;
  changedPaths: string[];
  diffSummary: GitDiffSummary;
  files: FileNode[];
  filesTree: FileNode[];
  flatFiles: GitRestoreFileEntry[];
}

const GIT_RESTORE_STORAGE_PREFIX = 'dev0_git_restore_points_v1_';
const MAX_RESTORE_POINTS_PER_PROJECT = 25;

const memoryRestorePointsMap = new Map<string, GitRestorePoint[]>();

function computeShortCommitHash(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(7, '0');
  const extra = Math.abs(seed.length * 2654435761)
    .toString(16)
    .slice(0, 3);
  return `${hex}${extra}`.slice(0, 7);
}

function getStorageKey(projectId: string): string {
  const safeId = (projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${GIT_RESTORE_STORAGE_PREFIX}${safeId}`;
}

export function flattenFileNodes(
  nodes: (FileNode | { id?: string; name: string; path?: string; type?: string; content?: string; children?: any[] })[],
  prefix: string = ''
): GitRestoreFileEntry[] {
  const out: GitRestoreFileEntry[] = [];
  for (const node of nodes || []) {
    const fullPath = (node as any).path || (prefix ? `${prefix}/${node.name}` : node.name);
    if (node.type === 'directory' && Array.isArray(node.children)) {
      out.push(...flattenFileNodes(node.children, fullPath));
    } else {
      out.push({
        path: fullPath,
        name: node.name || fullPath.split('/').pop() || 'file',
        content: node.content || '',
      });
    }
  }
  return out;
}

function normalizeToFileNodes(
  nodes: (FileNode | { id?: string; name: string; path?: string; type?: string; content?: string; children?: any[] })[]
): FileNode[] {
  return (nodes || []).map((n, idx) => ({
    id: n.id || `fn_${idx}_${n.name}`,
    name: n.name,
    type: n.type === 'directory' ? 'directory' : 'file',
    content: n.content,
    children: Array.isArray(n.children) ? normalizeToFileNodes(n.children) : undefined,
  }));
}

function cloneFileTree(nodes: FileNode[]): FileNode[] {
  return JSON.parse(JSON.stringify(nodes || []));
}

export async function listRestorePoints(projectId: string): Promise<GitRestorePoint[]> {
  if (!projectId) return [];
  const key = getStorageKey(projectId);
  if (memoryRestorePointsMap.has(key)) {
    return memoryRestorePointsMap.get(key) || [];
  }
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryRestorePointsMap.set(key, parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

export function computeDiffSummary(
  previousNodesOrFlat: (FileNode | GitRestoreFileEntry | { name: string; path?: string; content?: string })[],
  currentNodesOrFlat: (FileNode | GitRestoreFileEntry | { name: string; path?: string; content?: string })[]
): GitDiffSummary {
  const prevFlat = flattenFileNodes(previousNodesOrFlat as any);
  const prevMap = new Map<string, string>();
  for (const f of prevFlat) {
    prevMap.set(f.path, f.content || '');
  }

  const currentFlat = flattenFileNodes(currentNodesOrFlat as any);
  const currMap = new Map<string, string>();
  for (const f of currentFlat) {
    currMap.set(f.path, f.content || '');
  }

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  let unchangedCount = 0;

  for (const [path, content] of currMap.entries()) {
    if (!prevMap.has(path)) {
      added.push(path);
    } else if (prevMap.get(path) !== content) {
      modified.push(path);
    } else {
      unchangedCount++;
    }
  }

  for (const path of prevMap.keys()) {
    if (!currMap.has(path)) {
      deleted.push(path);
    }
  }

  return {
    added,
    modified,
    deleted,
    changedPaths: [...added, ...modified, ...deleted],
    unchangedCount,
  };
}

/**
 * Creates a built-in Git restore point in Browser IndexedDB/AsyncStorage and optionally
 * mirrors the commit to the Docker /api/sandbox real Git backend when available.
 */
export async function createRestorePoint(params: {
  projectId: string;
  projectName?: string;
  files?: (FileNode | { id?: string; name: string; path?: string; content?: string; language?: string })[];
  filesTree?: FileNode[];
  message?: string;
  label?: string;
  author?: 'user' | 'ai' | 'auto-guard' | 'auto' | 'manual' | 'ai-tool';
  source?: string;
  userId?: string;
}): Promise<GitRestorePoint> {
  const existing = await listRestorePoints(params.projectId);
  const latest = existing[0];

  const inputFiles = params.files || params.filesTree || [];
  const normalizedTree = normalizeToFileNodes(inputFiles);
  const clonedTree = cloneFileTree(normalizedTree);
  const flatFiles = flattenFileNodes(clonedTree);

  const diff: GitDiffSummary = latest
    ? computeDiffSummary(latest.flatFiles, clonedTree)
    : {
        added: flatFiles.map((f) => f.path),
        modified: [],
        deleted: [],
        changedPaths: flatFiles.map((f) => f.path),
        unchangedCount: 0,
      };

  const now = Date.now();
  const commitMsg = params.message || params.label || 'Restore point snapshot';
  const seed = `${params.projectId}:${now}:${commitMsg}:${flatFiles.length}`;
  let commitHash = computeShortCommitHash(seed);
  let backend: 'browser-git' | 'docker-git' = 'browser-git';

  // Best-effort sync with Docker /api/sandbox real Git backend if running
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'git_commit',
          userId: params.userId || 'anonymous_local_user',
          projectId: params.projectId,
          message: commitMsg,
          files: flatFiles,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.commitHash) {
          commitHash = String(data.commitHash).slice(0, 7);
          backend = 'docker-git';
        }
      }
    } catch {
      // Fallback cleanly to built-in browser git snapshot engine
    }
  }

  const totalBytes = flatFiles.reduce((sum, f) => sum + (f.content || '').length, 0);
  const effectiveAuthor = params.author || (params.source as any) || 'user';

  const point: GitRestorePoint = {
    id: `rp_${now}_${commitHash}`,
    commitHash,
    projectId: params.projectId,
    projectName: params.projectName || 'Project',
    message: commitMsg,
    label: commitMsg,
    author: effectiveAuthor,
    source: params.source || effectiveAuthor,
    backend,
    createdAt: now,
    timestamp: now,
    fileCount: flatFiles.length,
    totalBytes,
    changedPaths: diff.changedPaths.slice(0, 30),
    diffSummary: diff,
    files: clonedTree,
    filesTree: clonedTree,
    flatFiles,
  };

  const key = getStorageKey(params.projectId);
  const next = [point, ...existing.filter((p) => p.id !== point.id)].slice(
    0,
    MAX_RESTORE_POINTS_PER_PROJECT
  );
  memoryRestorePointsMap.set(key, next);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }

  return point;
}

export async function findRestorePoint(
  projectId: string,
  idOrHash: string
): Promise<GitRestorePoint | null> {
  const points = await listRestorePoints(projectId);
  if (points.length === 0) return null;
  const needle = (idOrHash || '').trim().toLowerCase();
  if (!needle || needle === 'latest' || needle === 'head') {
    return points[0];
  }
  return (
    points.find(
      (p) =>
        p.id.toLowerCase() === needle ||
        p.commitHash.toLowerCase() === needle ||
        p.commitHash.toLowerCase().startsWith(needle)
    ) || null
  );
}

export async function deleteRestorePoint(
  projectId: string,
  restorePointId: string
): Promise<boolean> {
  if (!projectId || !restorePointId) return false;
  const existing = await listRestorePoints(projectId);
  const next = existing.filter(
    (p) => p.id !== restorePointId && p.commitHash !== restorePointId
  );
  if (next.length === existing.length) return false;
  const key = getStorageKey(projectId);
  memoryRestorePointsMap.set(key, next);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return true;
}

export function formatGitStatusReport(
  projectIdOrFiles:
    | string
    | (FileNode | { name: string; path?: string; content?: string })[],
  secondArg?:
    | string
    | GitRestorePoint
    | null
    | (FileNode | { name: string; path?: string; content?: string })[],
  maybeCurrentFiles?: (FileNode | { name: string; path?: string; content?: string })[]
): string {
  if (Array.isArray(projectIdOrFiles)) {
    const currentFiles = projectIdOrFiles;
    const latestPoint = (secondArg && !Array.isArray(secondArg) && typeof secondArg === 'object')
      ? (secondArg as GitRestorePoint)
      : null;
    const flat = flattenFileNodes(currentFiles as any);
    if (!latestPoint) {
      return `Git & Restore Status (${flat.length} files): Working tree has no restore points yet. Create a snapshot before major changes.`;
    }
    const diff = computeDiffSummary(latestPoint.flatFiles, currentFiles as any);
    return [
      `Git & Restore Status (HEAD: ${latestPoint.commitHash} "${latestPoint.message}", backend: ${latestPoint.backend}):`,
      `- Added since HEAD (${diff.added.length}): ${diff.added.slice(0, 10).join(', ') || 'none'}`,
      `- Modified since HEAD (${diff.modified.length}): ${diff.modified.slice(0, 10).join(', ') || 'none'}`,
      `- Deleted since HEAD (${diff.deleted.length}): ${diff.deleted.slice(0, 10).join(', ') || 'none'}`,
    ].join('\n');
  }

  const projectId = projectIdOrFiles;
  const projectName = typeof secondArg === 'string' ? secondArg : projectId;
  const currentFiles = Array.isArray(secondArg)
    ? secondArg
    : maybeCurrentFiles || [];

  const points = memoryRestorePointsMap.get(getStorageKey(projectId)) || [];
  const flat = flattenFileNodes(currentFiles as any);

  if (points.length === 0) {
    return `Git & Restore Status for "${projectName}" (${flat.length} files):\n- Working tree has no restore points yet.\n- Tip: Call git_create_restore_point to save a snapshot before major changes.`;
  }

  const head = points[0];
  const diff = computeDiffSummary(head.flatFiles, currentFiles as any);
  return [
    `Git & Restore Status for "${projectName}" (HEAD: ${head.commitHash} "${head.message}", backend: ${head.backend}):`,
    `- Restore points available: ${points.length}`,
    `- Added since HEAD (${diff.added.length}): ${diff.added.slice(0, 10).join(', ') || 'none'}`,
    `- Modified since HEAD (${diff.modified.length}): ${diff.modified.slice(0, 10).join(', ') || 'none'}`,
    `- Deleted since HEAD (${diff.deleted.length}): ${diff.deleted.slice(0, 10).join(', ') || 'none'}`,
  ].join('\n');
}
