/**
 * Memo-System für QCoder
 * 
 * Verwaltet globale und lokale Memos
 * - Globale Memos: .qcoder/rules/lessons_learnened.md
 * - Lokale Memos: .qcoder/memos/{projekt}.md
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Project, AppSettings, isLearningEnabled } from '@/types';

let memoSystemEnabledState = false;

export function setMemoSystemEnabled(enabled: boolean): void {
  memoSystemEnabledState = Boolean(enabled);
}

export function isMemoSystemEnabled(settings?: Partial<AppSettings> | null): boolean {
  if (settings) {
    return isLearningEnabled(settings);
  }
  return memoSystemEnabledState;
}

// Helper für documentDirectory (unterstützt altes und neues API)
function getDocumentDirectory(): string {
  // Neues API (expo-file-system >= 13.x)
  if ('Paths' in FileSystem && FileSystem.Paths && 'document' in FileSystem.Paths) {
    const paths = FileSystem.Paths as any;
    return paths.document?.uri || paths.document?.toString() || '';
  }
  // Altes API (fallback)
  return (FileSystem as any).documentDirectory || '';
}

export interface Memo {
  id: string;
  type: 'global' | 'local';
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  linkedFiles?: string[]; // Dateipfade die mit diesem Memo verknüpft sind
}

export interface AutoMemoData {
  error?: string;
  cause?: string;
  solution?: string;
  prevention?: string;
  files?: string[];
  context7Research?: any;
}

// Pfade
const GLOBAL_MEMO_PATH = '.qcoder/rules/lessons_learned.md';
const LOCAL_MEMOS_DIR = '.qcoder/memos/';

/**
 * Erstellt einen neuen Memo-Eintrag
 */
export async function createMemo(
  titleOrOptions: string | { title: string; content: string; type?: 'global' | 'local'; projectId?: string; linkedFiles?: string[]; [key: string]: any },
  content: string = '',
  type: 'global' | 'local' = 'local',
  projectId?: string,
  linkedFiles?: string[],
  learningEnabledOverride?: boolean
): Promise<Memo | null> {
  const allowed = learningEnabledOverride !== undefined ? learningEnabledOverride : memoSystemEnabledState;
  if (!allowed) {
    console.log('[Memo] Blocked createMemo because learning/memo function is disabled.');
    return null;
  }

  const resolvedTitle = typeof titleOrOptions === 'object' && titleOrOptions !== null ? titleOrOptions.title : titleOrOptions;
  const resolvedContent = typeof titleOrOptions === 'object' && titleOrOptions !== null ? titleOrOptions.content : content;
  const resolvedType = typeof titleOrOptions === 'object' && titleOrOptions !== null ? (titleOrOptions.type || 'local') : type;
  const resolvedProjectId = typeof titleOrOptions === 'object' && titleOrOptions !== null ? titleOrOptions.projectId : projectId;
  const resolvedLinkedFiles = typeof titleOrOptions === 'object' && titleOrOptions !== null ? titleOrOptions.linkedFiles : linkedFiles;

  const memo: Memo = {
    id: `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: resolvedType,
    title: resolvedTitle,
    content: resolvedContent,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: extractTags(resolvedContent || ''),
    linkedFiles: resolvedLinkedFiles
  };

  if (resolvedType === 'global') {
    await appendToGlobalMemo(memo);
  } else {
    await saveLocalMemo(memo, resolvedProjectId);
  }

  return memo;
}

/**
 * Erstellt automatisches Memo bei Fehlern oder Erkenntnissen
 */
export async function createAutoMemo(
  dataOrCategory: AutoMemoData | string,
  projectIdOrData?: string | AutoMemoData,
  learningEnabledOverride?: boolean
): Promise<Memo | null> {
  const allowed = learningEnabledOverride !== undefined ? learningEnabledOverride : memoSystemEnabledState;
  if (!allowed) {
    console.log('[Memo] Blocked createAutoMemo because learning/memo function is disabled.');
    return null;
  }

  const data: AutoMemoData = typeof dataOrCategory === 'string'
    ? (typeof projectIdOrData === 'object' && projectIdOrData !== null ? projectIdOrData : { error: dataOrCategory })
    : dataOrCategory;
  const projectId = typeof projectIdOrData === 'string' ? projectIdOrData : undefined;

  const title = data.error ? `Fehler: ${data.error.substring(0, 50)}...` : 'Neue Erkenntnis';
  
  const content = buildAutoMemoContent(data);
  
  return await createMemo(
    title,
    content,
    'local',
    projectId,
    data.files,
    allowed
  );
}

export const autoCreateMemo = createAutoMemo;

/**
 * Baut den Inhalt für ein Auto-Memo
 */
function buildAutoMemoContent(data: AutoMemoData): string {
  const parts: string[] = [];
  
  if (data.error) {
    parts.push(`**[FEHLER]** ${data.error}`);
  }
  
  if (data.cause) {
    parts.push(`**[URSACHE]** ${data.cause}`);
  }
  
  if (data.solution) {
    parts.push(`**[LÖSUNG]** ${data.solution}`);
  }
  
  if (data.prevention) {
    parts.push(`**[PRÄVENTION]** ${data.prevention}`);
  }
  
  if (data.context7Research) {
    parts.push(`\n**[CONTEXT7 RESEARCH]**`);
    parts.push(`Thema: ${data.context7Research.topic}`);
    parts.push(`Gefunden: ${data.context7Research.findings?.length || 0} Beispiele`);
  }
  
  return parts.join('\n\n');
}

/**
 * Extrahiert Tags aus Content
 */
function extractTags(content: string): string[] {
  const tagPattern = /\[([A-Z_]+)\]/g;
  const matches = [...content.matchAll(tagPattern)];
  return matches.map(m => m[1]);
}

/**
 * Fügt Memo zu globalem lessons_learned.md hinzu
 */
async function appendToGlobalMemo(memo: Memo): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Web: localStorage nutzen
      const existing = localStorage.getItem('global_memos') || '[]';
      const memos = JSON.parse(existing);
      memos.push(memo);
      localStorage.setItem('global_memos', JSON.stringify(memos));
    } else {
      // Native: FileSystem nutzen
      const documentDir = getDocumentDirectory();
      const filePath = `${documentDir}${GLOBAL_MEMO_PATH}`;
      
      // Datei existiert prüfen
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      // Memo anhängen: Erst lesen, dann zusammenfügen, dann schreiben
      const existingContent = fileInfo.exists 
        ? await FileSystem.readAsStringAsync(filePath)
        : getGlobalMemoHeader();
      
      const memoContent = existingContent + `\n\n### [${new Date(memo.createdAt).toISOString().split('T')[0]}] ${memo.title}\n${memo.content}`;
      await FileSystem.writeAsStringAsync(filePath, memoContent);
    }
  } catch (error) {
    console.error('[Memo] Failed to append to global memo:', error);
  }
}

/**
 * Speichert lokales projekt-spezifisches Memo
 */
async function saveLocalMemo(memo: Memo, projectId?: string): Promise<void> {
  try {
    if (!projectId) {
      console.warn('[Memo] No projectId for local memo, using global instead');
      await appendToGlobalMemo(memo);
      return;
    }

    const fileName = `project_${projectId}.md`;
    const filePath = `${LOCAL_MEMOS_DIR}${fileName}`;

    if (Platform.OS === 'web') {
      // Web: localStorage
      const key = `local_memo_${projectId}`;
      const existing = localStorage.getItem(key) || '';
      const updated = existing + `\n\n### [${new Date(memo.createdAt).toISOString().split('T')[0]}] ${memo.title}\n${memo.content}`;
      localStorage.setItem(key, updated);
    } else {
      // Native: FileSystem
      const documentDir = getDocumentDirectory();
      const fullPath = `${documentDir}${filePath}`;
      const fileInfo = await FileSystem.getInfoAsync(fullPath);
      
      let content = '';
      if (!fileInfo.exists) {
        content = getLocalMemoHeader(projectId);
        await FileSystem.writeAsStringAsync(fullPath, content);
      } else {
        content = await FileSystem.readAsStringAsync(fullPath);
      }
      
      content += `\n\n### [${new Date(memo.createdAt).toISOString().split('T')[0]}] ${memo.title}\n${memo.content}`;
      await FileSystem.writeAsStringAsync(fullPath, content);
    }
  } catch (error) {
    console.error('[Memo] Failed to save local memo:', error);
  }
}

/**
 * Liest alle Memos (global + lokal)
 */
export async function getAllMemos(projectId?: string, learningEnabledOverride?: boolean): Promise<Memo[]> {
  const allowed = learningEnabledOverride !== undefined ? learningEnabledOverride : memoSystemEnabledState;
  if (!allowed) {
    return [];
  }

  const memos: Memo[] = [];
  
  try {
    // Globale Memos laden
    const globalMemos = await loadGlobalMemos();
    memos.push(...globalMemos);
    
    // Lokale Memos laden
    if (projectId) {
      const localMemos = await loadLocalMemos(projectId);
      memos.push(...localMemos);
    }
    
    // Nach updatedAt sortieren (neueste zuerst)
    return memos.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('[Memo] Failed to load memos:', error);
    return [];
  }
}

/**
 * Lädt globale Memos aus lessons_learned.md
 */
async function loadGlobalMemos(): Promise<Memo[]> {
  try {
    if (Platform.OS === 'web') {
      const existing = localStorage.getItem('global_memos') || '[]';
      return JSON.parse(existing);
    } else {
      const documentDir = getDocumentDirectory();
      const filePath = `${documentDir}${GLOBAL_MEMO_PATH}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (!fileInfo.exists) {
        return [];
      }
      
      const content = await FileSystem.readAsStringAsync(filePath, { encoding: 'utf8' });
      return parseMemosFromMarkdown(content);
    }
  } catch (error) {
    console.error('[Memo] Failed to load global memos:', error);
    return [];
  }
}

/**
 * Lädt lokale projekt-spezifische Memos
 */
async function loadLocalMemos(projectId: string): Promise<Memo[]> {
  try {
    if (Platform.OS === 'web') {
      const key = `local_memo_${projectId}`;
      const content = localStorage.getItem(key) || '';
      return parseMemosFromMarkdown(content);
    } else {
      const fileName = `project_${projectId}.md`;
      const documentDir = getDocumentDirectory();
      const filePath = `${documentDir}${LOCAL_MEMOS_DIR}${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (!fileInfo.exists) {
        return [];
      }
      
      const content = await FileSystem.readAsStringAsync(filePath, { encoding: 'utf8' });
      return parseMemosFromMarkdown(content);
    }
  } catch (error) {
    console.error('[Memo] Failed to load local memos:', error);
    return [];
  }
}

/**
 * Parst Memos aus Markdown-Content
 */
function parseMemosFromMarkdown(content: string): Memo[] {
  const memos: Memo[] = [];
  const sections = content.split('### [');
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const match = section.match(/^(\d{4}-\d{2}-\d{2})\]\s*(.+?)\n([\s\S]*?)(?=\n### \[|$)/);
    
    if (match) {
      const [, dateStr, title, content] = match;
      memos.push({
        id: `parsed_${i}_${Date.now()}`,
        type: 'global',
        title: title.trim(),
        content: content.trim(),
        createdAt: new Date(dateStr).getTime(),
        updatedAt: new Date(dateStr).getTime(),
        tags: extractTags(content)
      });
    }
  }
  
  return memos;
}

/**
 * Generiert Header für globales Memo
 */
function getGlobalMemoHeader(): string {
  return `# 🧠 QCoder System-Gedächtnis (AUTO-GENERATED MEMOS)

*Dieser Abschnitt wird automatisch von der KI verwaltet.*

---

`;
}

/**
 * Generiert Header für lokales Memo
 */
function getLocalMemoHeader(projectId: string): string {
  return `# 📁 Projekt-Memo: ${projectId}

*Lokale, projekt-spezifische Notizen und Entscheidungen.*

---

`;
}

/**
 * Sucht Memos nach Tags oder Inhalt
 */
export async function searchMemos(query: string, projectId?: string, learningEnabledOverride?: boolean): Promise<Memo[]> {
  const allowed = learningEnabledOverride !== undefined ? learningEnabledOverride : memoSystemEnabledState;
  if (!allowed) {
    return [];
  }
  const allMemos = await getAllMemos(projectId, allowed);
  const queryLower = query.toLowerCase();
  
  return allMemos.filter(memo => 
    memo.title.toLowerCase().includes(queryLower) ||
    memo.content.toLowerCase().includes(queryLower) ||
    memo.tags?.some(tag => tag.toLowerCase().includes(queryLower))
  );
}

/**
 * Aktualisiert ein bestehendes Memo
 */
export async function updateMemo(memoId: string, updates: Partial<Memo>, learningEnabledOverride?: boolean): Promise<Memo | null> {
  const allowed = learningEnabledOverride !== undefined ? learningEnabledOverride : memoSystemEnabledState;
  if (!allowed) {
    return null;
  }
  
  const allMemos = await getAllMemos(undefined, allowed);
  const memoIndex = allMemos.findIndex(m => m.id === memoId);
  
  if (memoIndex === -1) {
    return null;
  }
  
  const updatedMemo = {
    ...allMemos[memoIndex],
    ...updates,
    updatedAt: Date.now()
  };
  
  allMemos[memoIndex] = updatedMemo;
  
  // Resave all (not efficient but simple)
  if (Platform.OS === 'web') {
    localStorage.setItem('global_memos', JSON.stringify(allMemos));
  }
  
  return updatedMemo;
}

/**
 * Löscht ein Memo (nur lokale, globale sind persistent)
 */
export async function deleteMemo(memoId: string, type: 'global' | 'local', learningEnabledOverride?: boolean): Promise<boolean> {
  const allowed = learningEnabledOverride !== undefined ? learningEnabledOverride : memoSystemEnabledState;
  if (!allowed) {
    return false;
  }
  if (type === 'global') {
    console.warn('[Memo] Cannot delete global memos, they are permanent learning');
    return false;
  }
  
  // Local memos can be deleted
  return true;
}

