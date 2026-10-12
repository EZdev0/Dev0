import React, { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { AppSettings, TodoItem, MemoEntry, DEFAULT_SETTINGS, ToolPermission, TOOL_REGISTRY } from '@/types';

function uniqueId(prefix: string = ''): string {
  return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [memos, setMemos] = useState<MemoEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [showSponsorModal, setShowSponsorModal] = useState<boolean>(false);
  const sponsorInteractionCountRef = useRef<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsStr, todosStr, memosStr] = await Promise.all([
          AsyncStorage.getItem('ide_settings'),
          AsyncStorage.getItem('ide_todos'),
          AsyncStorage.getItem('ide_memos'),
        ]);
        if (settingsStr) {
          const parsed = JSON.parse(settingsStr);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
        if (todosStr) setTodos(JSON.parse(todosStr));
        if (memosStr) setMemos(JSON.parse(memosStr));
      } catch (e) {
        console.log('[App] Fehler beim Laden der Einstellungen:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...partial };
      AsyncStorage.setItem('ide_settings', JSON.stringify(updated)).catch(e =>
        console.log('[App] Fehler beim Speichern:', e)
      );
      return updated;
    });
  }, []);

  const triggerSponsorInteraction = useCallback(() => {
    if (settings.hideSponsor) return;
    sponsorInteractionCountRef.current += 1;
    if (sponsorInteractionCountRef.current % 3 === 0) {
      setShowSponsorModal(true);
    }
  }, [settings.hideSponsor]);

  const closeSponsorModal = useCallback(() => {
    setShowSponsorModal(false);
  }, []);

  const addTodo = useCallback((text: string) => {
    const item: TodoItem = { id: uniqueId('td_'), text, completed: false, createdAt: Date.now() };
    setTodos(prev => {
      const updated = [...prev, item];
      AsyncStorage.setItem('ide_todos', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
    return item.id;
  }, []);

  const updateTodoItem = useCallback((id: string, completed?: boolean, text?: string) => {
    setTodos(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) return t;
        return {
          ...t,
          ...(completed !== undefined ? { completed } : {}),
          ...(text !== undefined ? { text } : {}),
        };
      });
      AsyncStorage.setItem('ide_todos', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => {
      const updated = prev.filter(t => t.id !== id);
      AsyncStorage.setItem('ide_todos', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
  }, []);

  const addMemo = useCallback((content: string) => {
    const item: MemoEntry = { id: uniqueId('mm_'), content, createdAt: Date.now() };
    setMemos(prev => {
      const updated = [...prev, item];
      AsyncStorage.setItem('ide_memos', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
    return item.id;
  }, []);

  const deleteMemo = useCallback((id: string) => {
    setMemos(prev => {
      const updated = prev.filter(m => m.id !== id);
      AsyncStorage.setItem('ide_memos', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
  }, []);

  const getApiKey = useCallback((): string => {
    switch (settings.selectedProvider) {
      case 'rork': return 'rork_builtin';
      case 'openai': return settings.openaiKey || '';
      case 'anthropic': return settings.anthropicKey || '';
      case 'gemini': return settings.geminiKey || '';
      case 'groq': return settings.groqKey || '';
      case 'openrouter': return settings.openrouterKey || '';
      case 'custom': return settings.customKey || '';
      default: return '';
    }
  }, [settings]);

  const getFallbackSettings = useCallback((): Record<string, string> => {
    return {
      openaiKey: settings.openaiKey || '',
      anthropicKey: settings.anthropicKey || '',
      geminiKey: settings.geminiKey || '',
      groqKey: settings.groqKey || '',
      openrouterKey: settings.openrouterKey || '',
      nvidiaKey: settings.nvidiaKey || '',
      customKey: settings.customKey || '',
    };
  }, [settings]);

  const clearAllTodos = useCallback(() => {
    setTodos([]);
    AsyncStorage.removeItem('ide_todos').catch(console.log);
  }, []);

  const clearAllMemos = useCallback(() => {
    setMemos([]);
    AsyncStorage.removeItem('ide_memos').catch(console.log);
  }, []);

  const getToolPermission = useCallback((toolName: string): ToolPermission => {
    if (settings.yoloMode) return 'always';
    const reg = TOOL_REGISTRY.find(t => t.name === toolName);
    if (reg?.isBeta) {
      if (toolName === 'web_search' && !settings.betaWebSearch) return 'removed';
      if (toolName === 'web_fetch' && !settings.betaWebFetch) return 'removed';
    }
    const custom = settings.toolPermissions?.[toolName];
    if (custom) return custom;
    return reg?.defaultPermission ?? 'ask';
  }, [settings]);

  const setToolPermission = useCallback((toolName: string, permission: ToolPermission) => {
    setSettings(prev => {
      const updated = {
        ...prev,
        toolPermissions: { ...prev.toolPermissions, [toolName]: permission },
      };
      AsyncStorage.setItem('ide_settings', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
  }, []);

  const [agentMd, setAgentMdState] = useState<string>('');
  const [soulMd, setSoulMdState] = useState<string>('');
  const [identityMd, setIdentityMdState] = useState<string>('');
  const [userMd, setUserMdState] = useState<string>('');
  const [memoryMd, setMemoryMdState] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('ide_agent_md').then(v => { if (v) setAgentMdState(v); }).catch(console.log);
    AsyncStorage.getItem('ide_soul_md').then(v => { if (v) setSoulMdState(v); }).catch(console.log);
    AsyncStorage.getItem('ide_identity_md').then(v => { if (v) setIdentityMdState(v); }).catch(console.log);
    AsyncStorage.getItem('ide_user_md').then(v => { if (v) setUserMdState(v); }).catch(console.log);
    AsyncStorage.getItem('ide_memory_md').then(v => { if (v) setMemoryMdState(v); }).catch(console.log);
  }, []);

  const setAgentMd = useCallback((content: string) => {
    setAgentMdState(content);
    AsyncStorage.setItem('ide_agent_md', content).catch(console.log);
  }, []);

  const setSoulMd = useCallback((content: string) => {
    setSoulMdState(content);
    AsyncStorage.setItem('ide_soul_md', content).catch(console.log);
  }, []);

  const setIdentityMd = useCallback((content: string) => {
    setIdentityMdState(content);
    AsyncStorage.setItem('ide_identity_md', content).catch(console.log);
  }, []);

  const setUserMd = useCallback((content: string) => {
    setUserMdState(content);
    AsyncStorage.setItem('ide_user_md', content).catch(console.log);
  }, []);

  const setMemoryMd = useCallback((content: string) => {
    setMemoryMdState(content);
    AsyncStorage.setItem('ide_memory_md', content).catch(console.log);
  }, []);

  return {
    settings, updateSettings, isLoaded,
    todos, addTodo, updateTodoItem, deleteTodo, clearAllTodos,
    memos, addMemo, deleteMemo, clearAllMemos,
    getApiKey, getFallbackSettings,
    getToolPermission, setToolPermission,
    agentMd, setAgentMd, soulMd, setSoulMd,
    identityMd, setIdentityMd, userMd, setUserMd, memoryMd, setMemoryMd,
    showSponsorModal, triggerSponsorInteraction, closeSponsorModal,
  };
});
