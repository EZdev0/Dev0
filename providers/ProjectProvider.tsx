import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { FileNode, Project } from '@/types';
import { createSampleProject } from '@/utils/sample-project';
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
  const sorted = [...nodes].sort((a, b) => {
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
  return target
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
  const { triggerSponsorInteraction } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentProjectIdRef = useRef<string | null>(null);
  currentProjectIdRef.current = currentProjectId;

  const plansProjectsRef = useRef<Project[]>([]);
  plansProjectsRef.current = projects;

  const currentProject = useMemo(() =>
    projects.find(p => p.id === currentProjectId) ?? null
  , [projects, currentProjectId]);

  const files = useMemo(() => currentProject?.files ?? [], [currentProject]);

  useEffect(() => {
    const load = async () => {
      try {
        const [projStr, idStr] = await Promise.all([
          AsyncStorage.getItem('ide_projects'),
          AsyncStorage.getItem('ide_current_project'),
        ]);
        if (projStr) {
          const loaded: Project[] = JSON.parse(projStr);
          setProjects(loaded);
          if (idStr && loaded.some(p => p.id === idStr)) {
            setCurrentProjectId(idStr);
          } else if (loaded.length > 0) {
            setCurrentProjectId(loaded[0].id);
          }
        }
      } catch (e) {
        console.log('[Project] Fehler beim Laden:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  const persist = useCallback((updated: Project[]) => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      try {
        const serialized = JSON.stringify(updated);
        if (serialized.length > 4 * 1024 * 1024) {
          console.log('[Project] Warnung: Projektdaten sehr groß (' + Math.round(serialized.length / 1024) + 'KB)');
        }
        AsyncStorage.setItem('ide_projects', serialized).catch(e =>
          console.log('[Project] Fehler beim Speichern:', e)
        );
      } catch (e) {
        console.log('[Project] Serialisierungsfehler:', e);
      }
    }, 300);
  }, []);

  const createProject = useCallback((name: string, projectType: string) => {
    triggerSponsorInteraction();
    const project: Project = {
      id: Date.now().toString(),
      name,
      projectType,
      files: createSampleProject(projectType),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects(prev => {
      const updated = [...prev, project];
      persist(updated);
      return updated;
    });
    setCurrentProjectId(project.id);
    AsyncStorage.setItem('ide_current_project', project.id).catch(console.log);
    return project.id;
  }, [persist]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      persist(updated);
      if (currentProjectId === id) {
        const nextId = updated.length > 0 ? updated[0].id : null;
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
    updateFiles(f => {
      const parts = splitPath(path);
      const node = findNode(f, parts);
      if (node && node.type === 'file') {
        node.content = content;
      } else {
        const fileName = parts.pop()!;
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
    updateFiles(f => {
      const parts = splitPath(path);
      const fileName = parts.pop()!;
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
    updateFiles(f => {
      const parts = splitPath(path);
      const fileName = parts.pop()!;
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
          node.name = newParts[newParts.length - 1];
        }
        return f;
      });
    }
  }, [getFileContent, deleteFile, createFile, updateFiles]);

  const createDirectory = useCallback((path: string) => {
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
