import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { FileNode, Project } from '@/types';
import { createSampleProject } from '@/utils/sample-project';
import {
  sanitizeUserSandboxProjects,
  getPerUserSandboxStorageKey,
  getPerUserCurrentProjectKey,
} from '@/utils/sandbox-workspace';
import {
  filterVisibleUserFiles,
  isHiddenAgentWorkspacePath,
} from '@/utils/subagent-workspace';
import { useApp } from '@/providers/AppProvider';

function generateId(): string {
  return 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function findNode(nodes: FileNode[], pathParts: string[]): FileNode | null {
  if (pathParts.length === 0) return null;
  const current = nodes.find(n => n.name === pathParts[0]);
  if (!current) return null;
  if (pathParts.length === 1) return current;
  if (current.type !== 'directory' || !current.children) return null;
  return findNode(current.children, pathParts.slice(1));
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function cloneFiles(files: FileNode[]): FileNode[] {
  return JSON.parse(JSON.stringify(files));
}

function buildTreeString(nodes: FileNode[], indent: string = ''): string {
  let result = '';
  const visibleNodes = filterVisibleUserFiles(nodes);
  const sorted = [...visibleNodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of sorted) {
    if (node.type === 'directory') {
      result += indent + node.name + '/\n';
      if (node.children) {
        result += buildTreeString(node.children, indent + '  ');
      }
    } else {
      result += indent + node.name + '\n';
    }
  }
  return result;
}

function ensureDirectories(files: FileNode[], dirParts: string[]): FileNode[] {
  if (dirParts.length === 0) return files;
  const dirName = dirParts[0];
  let dir = files.find(n => n.name === dirName && n.type === 'directory');
  if (!dir) {
    dir = { id: generateId(), name: dirName, type: 'directory', children: [] };
    files.push(dir);
  }
  if (!dir.children) dir.children = [];
  if (dirParts.length > 1) {
    ensureDirectories(dir.children, dirParts.slice(1));
  }
  return files;
}

function searchInFiles(nodes: FileNode[], query: string, basePath: string, results: string[]): void {
  for (const node of nodes) {
    const path = basePath ? basePath + '/' + node.name : node.name;
    if (isHiddenAgentWorkspacePath(path)) continue;
    if (node.type === 'file' && node.content) {
      const lines = node.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(query.toLowerCase())) {
          results.push(path + ':' + (i + 1) + ': ' + lines[i].trim());
        }
      }
    }
    if (node.type === 'directory' && node.children) {
      searchInFiles(node.children, query, path, results);
    }
  }
}

function listDir(nodes: FileNode[], pathParts: string[]): string {
  let target = nodes;
  if (pathParts.length > 0) {
    const node = findNode(nodes, pathParts);
    if (!node || node.type !== 'directory' || !node.children) return 'Verzeichnis nicht gefunden.';
    target = node.children;
  }
  const visibleTarget = pathParts.length === 0 ? filterVisibleUserFiles(target) : target;
  return visibleTarget
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map(n => (n.type === 'directory' ? '📁 ' : '📄 ') + n.name)
    .join('\n') || '(Leer)';
}

function getAllFilePaths(nodes: FileNode[], basePath: string = ''): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    const path = basePath ? basePath + '/' + node.name : node.name;
    if (isHiddenAgentWorkspacePath(path)) continue;
    if (node.type === 'file') {
      paths.push(path);
    }
    if (node.type === 'directory' && node.children) {
      paths.push(...getAllFilePaths(node.children, path));
    }
  }
  return paths;
}

export const [ProjectProvider, useProject] = createContextHook(() => {
  const { triggerSponsorInteraction, freePoolState } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentProjectIdRef = useRef<string | null>(null);
  currentProjectIdRef.current = currentProjectId;

  const userSandboxKey = useMemo(
    () => getPerUserSandboxStorageKey(freePoolState?.currentUserId),
    [freePoolState?.currentUserId],
  );
  const userCurrentProjKey = useMemo(
    () => getPerUserCurrentProjectKey(freePoolState?.currentUserId),
    [freePoolState?.currentUserId],
  );
  const userSandboxKeyRef = useRef(userSandboxKey);
  userSandboxKeyRef.current = userSandboxKey;
  const userCurrentProjKeyRef = useRef(userCurrentProjKey);
  userCurrentProjKeyRef.current = userCurrentProjKey;

  const plansProjectsRef = useRef<Project[]>([]);
  plansProjectsRef.current = projects;

  const currentProject = useMemo(() =>
    projects.find(p => p.id === currentProjectId) ?? null
  , [projects, currentProjectId]);

  // Hide .agents/ and .agent/ from standard user-facing file trees
  const files = useMemo(
    () => filterVisibleUserFiles(currentProject?.files ?? []),
    [currentProject],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [userProjStr, userIdStr, legacyProjStr, legacyIdStr] = await Promise.all([
          AsyncStorage.getItem(userSandboxKey),
          AsyncStorage.getItem(userCurrentProjKey),
          AsyncStorage.getItem('ide_projects'),
          AsyncStorage.getItem('ide_current_project'),
        ]);
        const rawStr = userProjStr || legacyProjStr;
        const idStr = userIdStr || legacyIdStr;
        if (rawStr) {
          const parsed: Project[] = JSON.parse(rawStr);
          // Strictly strip any legacy self-source (studio-ide) exposure so the app's own code is never leaked
          const loaded = sanitizeUserSandboxProjects(parsed);
          setProjects(loaded);
          plansProjectsRef.current = loaded;
          if (idStr && loaded.some(p => p.id === idStr)) {
            setCurrentProjectId(idStr);
            currentProjectIdRef.current = idStr;
          } else if (loaded.length > 0) {
            setCurrentProjectId(loaded[0].id);
            currentProjectIdRef.current = loaded[0].id;
          } else {
            setCurrentProjectId(null);
            currentProjectIdRef.current = null;
          }
          if (loaded.length !== parsed.length || !userProjStr) {
            AsyncStorage.setItem(userSandboxKey, JSON.stringify(loaded)).catch(console.log);
          }
        } else {
          setProjects([]);
          plansProjectsRef.current = [];
          setCurrentProjectId(null);
          currentProjectIdRef.current = null;
        }
      } catch (e) {
        console.log('[Project] Fehler beim Laden:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [userSandboxKey, userCurrentProjKey]);

  const persist = useCallback((updated: Project[]) => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      try {
        const sanitized = sanitizeUserSandboxProjects(updated);
        const serialized = JSON.stringify(sanitized);
        if (serialized.length > 4 * 1024 * 1024) {
          console.log('[Project] Warnung: Projektdaten sehr groß (' + Math.round(serialized.length / 1024) + 'KB)');
        }
        AsyncStorage.setItem(userSandboxKeyRef.current, serialized).catch(e =>
          console.log('[Project] Fehler beim Speichern:', e)
        );
        AsyncStorage.setItem('ide_projects', serialized).catch(console.log);
      } catch (e) {
        console.log('[Project] Serialisierungsfehler:', e);
      }
    }, 300);
  }, []);

  const createProject = useCallback((name: string, projectType: string) => {
    triggerSponsorInteraction();
    const safeType = projectType === 'studio-ide' ? 'docker-sandbox' : projectType;
    const project: Project = {
      id: Date.now().toString(),
      name,
      projectType: safeType,
      files: createSampleProject(safeType),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects(prev => {
      const updated = [...prev, project];
      plansProjectsRef.current = updated;
      persist(updated);
      return updated;
    });
    currentProjectIdRef.current = project.id;
    setCurrentProjectId(project.id);
    AsyncStorage.setItem(userCurrentProjKeyRef.current, project.id).catch(console.log);
    AsyncStorage.setItem('ide_current_project', project.id).catch(console.log);
    return project.id;
  }, [persist, triggerSponsorInteraction]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      plansProjectsRef.current = updated;
      persist(updated);
      if (currentProjectId === id) {
        const nextId = updated.length > 0 ? updated[0].id : null;
        currentProjectIdRef.current = nextId;
        setCurrentProjectId(nextId);
        if (nextId) {
          AsyncStorage.setItem('ide_current_project', nextId).catch(console.log);
        } else {
          AsyncStorage.removeItem('ide_current_project').catch(console.log);
        }
      }
      return updated;
    });
  }, [persist, currentProjectId]);

  const selectProject = useCallback((id: string) => {
    currentProjectIdRef.current = id;
    setCurrentProjectId(id);
    AsyncStorage.setItem('ide_current_project', id).catch(console.log);
  }, []);

  const updateFiles = useCallback((updater: (files: FileNode[]) => FileNode[]) => {
    setProjects(prev => {
      const projId = currentProjectIdRef.current;
      if (!projId) return prev;
      const updated = prev.map(p => {
        if (p.id !== projId) return p;
        try {
          const newFiles = updater(cloneFiles(p.files));
          return { ...p, files: newFiles, updatedAt: Date.now() };
        } catch (e) {
          console.log('[Project] Error updating files:', e);
          return p;
        }
      });
      plansProjectsRef.current = updated;
      persist(updated);
      return updated;
    });
  }, [persist]);

  const getFileContent = useCallback((path: string): string | null => {
    if (!path) return null;
    const projId = currentProjectIdRef.current;
    if (!projId) return null;
    const proj = plansProjectsRef.current.find(p => p.id === projId);
    if (!proj) return null;
    const parts = splitPath(path);
    const node = findNode(proj.files, parts);
    if (!node || node.type !== 'file') return null;
    return node.content ?? '';
  }, []);

  const updateFileContent = useCallback((path: string, content: string) => {
    if (!path || !path.trim()) return;
    updateFiles(f => {
      const parts = splitPath(path);
      if (parts.length === 0) return f;
      const node = findNode(f, parts);
      if (node && node.type === 'file') {
        node.content = content;
      } else {
        const fileName = parts.pop();
        if (!fileName) return f;
        if (parts.length > 0) {
          ensureDirectories(f, parts);
        }
        let target = f;
        for (const dir of parts) {
          const found = target.find(n => n.name === dir && n.type === 'directory');
          if (found && found.children) target = found.children;
        }
        const existing = target.find(n => n.name === fileName);
        if (existing && existing.type === 'file') {
          existing.content = content;
        } else {
          target.push({ id: generateId(), name: fileName, type: 'file', content });
        }
      }
      return f;
    });
  }, [updateFiles]);

  const createFile = useCallback((path: string, content: string) => {
    if (!path || !path.trim()) return;
    updateFiles(f => {
      const parts = splitPath(path);
      const fileName = parts.pop();
      if (!fileName) return f;
      ensureDirectories(f, parts);

      let target = f;
      for (const dir of parts) {
        const found = target.find(n => n.name === dir && n.type === 'directory');
        if (found && found.children) target = found.children;
      }

      const existing = target.find(n => n.name === fileName);
      if (existing) {
        existing.content = content;
      } else {
        target.push({ id: generateId(), name: fileName, type: 'file', content });
      }
      return f;
    });
  }, [updateFiles]);

  const deleteFile = useCallback((path: string) => {
    if (!path || !path.trim()) return;
    updateFiles(f => {
      const parts = splitPath(path);
      const fileName = parts.pop();
      if (!fileName) return f;
      let target = f;
      for (const dir of parts) {
        const found = target.find(n => n.name === dir && n.type === 'directory');
        if (found && found.children) target = found.children;
        else return f;
      }
      const idx = target.findIndex(n => n.name === fileName);
      if (idx >= 0) target.splice(idx, 1);
      return f;
    });
  }, [updateFiles]);

  const renameFile = useCallback((oldPath: string, newPath: string) => {
    if (!oldPath || !newPath) return;
    const content = getFileContent(oldPath);
    if (content !== null) {
      deleteFile(oldPath);
      createFile(newPath, content);
    } else {
      updateFiles(f => {
        const parts = splitPath(oldPath);
        const node = findNode(f, parts);
        if (node) {
          const newParts = splitPath(newPath);
          if (newParts.length > 0) {
            node.name = newParts[newParts.length - 1];
          }
        }
        return f;
      });
    }
  }, [getFileContent, deleteFile, createFile, updateFiles]);

  const createDirectory = useCallback((path: string) => {
    if (!path || !path.trim()) return;
    updateFiles(f => {
      ensureDirectories(f, splitPath(path));
      return f;
    });
  }, [updateFiles]);

  const searchFilesInProject = useCallback((query: string, basePath?: string): string => {
    const projId = currentProjectIdRef.current;
    const proj = plansProjectsRef.current.find(p => p.id === projId);
    if (!proj) return 'Kein Projekt geöffnet.';
    const results: string[] = [];
    let target = proj.files;
    if (basePath) {
      const node = findNode(proj.files, splitPath(basePath));
      if (node?.type === 'directory' && node.children) target = node.children;
    }
    searchInFiles(target, query, basePath || '', results);
    if (results.length === 0) return 'Keine Treffer gefunden.';
    if (results.length > 50) return results.slice(0, 50).join('\n') + '\n... (' + results.length + ' Treffer insgesamt)';
    return results.join('\n');
  }, []);

  const getProjectTree = useCallback((): string => {
    const projId = currentProjectIdRef.current;
    const proj = plansProjectsRef.current.find(p => p.id === projId);
    if (!proj) return '(Kein Projekt)';
    return buildTreeString(proj.files);
  }, []);

  const listDirectory = useCallback((path: string): string => {
    const projId = currentProjectIdRef.current;
    const proj = plansProjectsRef.current.find(p => p.id === projId);
    if (!proj) return 'Kein Projekt geöffnet.';
    return listDir(proj.files, splitPath(path));
  }, []);

  const getFileInfo = useCallback((path: string): string => {
    if (!path) return 'Kein Dateipfad angegeben.';
    const projId = currentProjectIdRef.current;
    const proj = plansProjectsRef.current.find(p => p.id === projId);
    if (!proj) return 'Kein Projekt geöffnet.';
    const parts = splitPath(path);
    const node = findNode(proj.files, parts);
    if (!node || node.type !== 'file') return 'Datei nicht gefunden: ' + path;
    const content = node.content ?? '';
    const lines = content.split('\n').length;
    const chars = content.length;
    const ext = path.split('.').pop() || 'unbekannt';
    return 'Datei: ' + path + '\nZeilen: ' + lines + '\nZeichen: ' + chars + '\nTyp: ' + ext;
  }, []);

  const allFilePaths = useMemo(() => {
    if (!currentProject) return [];
    return getAllFilePaths(currentProject.files);
  }, [currentProject]);

  return {
    projects, currentProject, currentProjectId, files, isLoaded, allFilePaths,
    createProject, deleteProject, selectProject,
    getFileContent, updateFileContent, createFile, deleteFile, renameFile, createDirectory,
    searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
  };
});
