import React, { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import {
  AppSettings,
  TodoItem,
  MemoEntry,
  DEFAULT_SETTINGS,
  ToolPermission,
  TOOL_REGISTRY,
  AIProviderType,
  isLearningTool,
  isLearningEnabled,
  syncLearningSettings,
} from '@/types';
import { setMemoSystemEnabled } from '@/utils/memo-system';
import {
  FreePoolState,
  SharedPoolKey,
  TokenUsageRecord,
  ChatDebugLogEntry,
  PoolUserRole,
  createDefaultFreePoolState,
  loadFreePoolState,
  saveFreePoolState,
  encodePoolSecret,
  maskApiKey,
  maskEmailAddress,
  evaluatePoolKeyStatus,
  selectActivePoolKeyForUser,
  verifyOwnerClaimPassphrase,
} from '@/utils/free-ai-pool';
import {
  CustomSubAgentTemplate,
  DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES,
  loadCustomSubAgentTemplates,
  saveCustomSubAgentTemplates,
  loadSkillEnabledOverrides,
  saveSkillEnabledOverrides,
} from '@/utils/skill-loader';
import {
  SubAgentWorkflowGraphState,
  SubAgentCronJob,
  createDefaultWorkflowGraphState,
  loadSubAgentWorkflowState,
  saveSubAgentWorkflowState,
  createSubAgentCronJob,
  normalizeSubAgentSlug,
} from '@/utils/subagent-workspace';

function uniqueId(prefix: string = ''): string {
  return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export interface ChatTurnDebugMeta {
  provider: AIProviderType;
  model: string;
  latencyMs: number;
  toolCalls?: string[];
  usedFallback?: boolean;
  fallbackProvider?: string;
  chatTurnId?: string;
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [memos, setMemos] = useState<MemoEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [showSponsorModal, setShowSponsorModal] = useState<boolean>(false);
  const [showFreePoolModal, setShowFreePoolModal] = useState<boolean>(false);
  const [showSubAgentStudioModal, setShowSubAgentStudioModal] = useState<boolean>(false);
  const sponsorInteractionCountRef = useRef<number>(0);

  // "AI for Free" Pool & Zero-PII 3-Tier RBAC Governance State
  const [freePoolState, setFreePoolState] = useState<FreePoolState>(() => createDefaultFreePoolState());
  const freePoolStateRef = useRef<FreePoolState>(freePoolState);
  freePoolStateRef.current = freePoolState;

  // Custom Sub-Agent Templates & YAML Skill Overrides
  const [customSubAgents, setCustomSubAgents] = useState<CustomSubAgentTemplate[]>(
    DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES,
  );
  const [skillEnabledOverrides, setSkillEnabledOverrides] = useState<Record<string, boolean>>({});

  // Dev0 Sub-Agent Workflow & Cron State (.agents/<slug>/)
  const [subAgentWorkflow, setSubAgentWorkflow] = useState<SubAgentWorkflowGraphState>(() =>
    createDefaultWorkflowGraphState(),
  );
  const subAgentWorkflowRef = useRef<SubAgentWorkflowGraphState>(subAgentWorkflow);
  subAgentWorkflowRef.current = subAgentWorkflow;

  const learningActive = isLearningEnabled(settings);

  useEffect(() => {
    setMemoSystemEnabled(learningActive);
  }, [learningActive]);

  useEffect(() => {
    const load = async () => {
      try {
        const [
          settingsStr,
          todosStr,
          memosStr,
          loadedPool,
          loadedTemplates,
          loadedSkillOverrides,
          loadedWorkflow,
        ] = await Promise.all([
          AsyncStorage.getItem('ide_settings'),
          AsyncStorage.getItem('ide_todos'),
          AsyncStorage.getItem('ide_memos'),
          loadFreePoolState(),
          loadCustomSubAgentTemplates(),
          loadSkillEnabledOverrides(),
          loadSubAgentWorkflowState(),
        ]);
        if (settingsStr) {
          const parsed = JSON.parse(settingsStr);
          setSettings(prev => {
            const merged = syncLearningSettings(prev, parsed);
            setMemoSystemEnabled(isLearningEnabled(merged));
            return merged;
          });
        }
        if (todosStr) setTodos(JSON.parse(todosStr));
        if (memosStr) setMemos(JSON.parse(memosStr));
        if (loadedPool) {
          setFreePoolState(loadedPool);
          freePoolStateRef.current = loadedPool;
        }
        if (loadedTemplates) setCustomSubAgents(loadedTemplates);
        if (loadedSkillOverrides) setSkillEnabledOverrides(loadedSkillOverrides);
        if (loadedWorkflow) {
          setSubAgentWorkflow(loadedWorkflow);
          subAgentWorkflowRef.current = loadedWorkflow;
        }
      } catch (e) {
        console.log('[App] Error loading settings:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  const updateSubAgentWorkflow = useCallback(
    (updater: (prev: SubAgentWorkflowGraphState) => SubAgentWorkflowGraphState) => {
      setSubAgentWorkflow(prev => {
        const next = updater(prev);
        subAgentWorkflowRef.current = next;
        saveSubAgentWorkflowState(next).catch(console.log);
        return next;
      });
    },
    [],
  );

  const togglePauseSubAgent = useCallback(
    (slugOrRole: string, reason?: string) => {
      const slug = normalizeSubAgentSlug(slugOrRole);
      const now = Date.now();
      updateSubAgentWorkflow(prev => ({
        ...prev,
        updatedAt: now,
        nodes: prev.nodes.map(n => {
          if (n.slug !== slug && normalizeSubAgentSlug(n.role) !== slug) return n;
          const isSleeping = n.status === 'sleeping';
          return {
            ...n,
            status: isSleeping ? 'idle' : 'sleeping',
            sleepReason: isSleeping ? undefined : reason || 'Paused by user/Dev0',
            updatedAt: now,
          };
        }),
      }));
    },
    [updateSubAgentWorkflow],
  );

  const addSubAgentCronJob = useCallback(
    (params: {
      name: string;
      targetSubAgentSlug: string;
      targetRole: string;
      scheduleExpression: string;
      intervalMinutes?: number;
      triggerOnFinishOf?: string;
      taskInstruction: string;
      createdBy: 'dev0' | 'sub_agent' | 'user';
    }): SubAgentCronJob => {
      const job = createSubAgentCronJob(params);
      const now = Date.now();
      updateSubAgentWorkflow(prev => ({
        ...prev,
        updatedAt: now,
        cronJobs: [job, ...prev.cronJobs],
        nodes: prev.nodes.map(n =>
          n.slug === job.targetSubAgentSlug
            ? { ...n, cronJobIds: [...new Set([...n.cronJobIds, job.id])], updatedAt: now }
            : n,
        ),
      }));
      return job;
    },
    [updateSubAgentWorkflow],
  );

  const toggleSubAgentCronJob = useCallback(
    (cronId: string) => {
      updateSubAgentWorkflow(prev => ({
        ...prev,
        updatedAt: Date.now(),
        cronJobs: prev.cronJobs.map(c => (c.id === cronId ? { ...c, enabled: !c.enabled } : c)),
      }));
    },
    [updateSubAgentWorkflow],
  );

  const deleteSubAgentCronJob = useCallback(
    (cronId: string) => {
      updateSubAgentWorkflow(prev => ({
        ...prev,
        updatedAt: Date.now(),
        cronJobs: prev.cronJobs.filter(c => c.id !== cronId),
      }));
    },
    [updateSubAgentWorkflow],
  );

  const updateFreePoolState = useCallback((updater: (prev: FreePoolState) => FreePoolState) => {
    setFreePoolState(prev => {
      const next = updater(prev);
      freePoolStateRef.current = next;
      saveFreePoolState(next).catch(console.log);
      return next;
    });
  }, []);

  const togglePoolEnabled = useCallback((enabled: boolean) => {
    updateFreePoolState(prev => ({
      ...prev,
      poolEnabled: enabled,
    }));
  }, [updateFreePoolState]);

  const shareKeyToPool = useCallback((params: {
    provider: AIProviderType;
    model: string;
    rawKey: string;
    tokenLimit: number;
    durationMinutes: number | null;
    targetUserId: string;
  }) => {
    const now = Date.now();
    const expiresAt = params.durationMinutes ? now + params.durationMinutes * 60 * 1000 : null;
    const newKey: SharedPoolKey = {
      id: uniqueId('pool_'),
      provider: params.provider,
      model: params.model,
      maskedKey: maskApiKey(params.rawKey),
      encodedSecret: encodePoolSecret(params.rawKey),
      ownerUserId: freePoolStateRef.current.currentUserId,
      ownerLabel: maskEmailAddress(freePoolStateRef.current.currentUserEmail),
      targetUserId: params.targetUserId || '*',
      tokenLimit: Math.max(0, params.tokenLimit),
      tokensUsed: 0,
      promptTokensUsed: 0,
      completionTokensUsed: 0,
      createdAt: now,
      expiresAt,
      isActive: true,
      status: 'active',
    };

    updateFreePoolState(prev => ({
      ...prev,
      poolEnabled: true,
      sharedKeys: [newKey, ...prev.sharedKeys],
      notifications: [
        {
          id: uniqueId('notif_'),
          level: 'success',
          title: 'New Key Added to Free Pool',
          message: `Masked key (${newKey.maskedKey}) for ${params.provider.toUpperCase()} (${params.model}) is now active for ${newKey.targetUserId === '*' ? 'all users' : newKey.targetUserId}.`,
          timestamp: now,
          read: false,
        },
        ...prev.notifications.slice(0, 29),
      ],
    }));
  }, [updateFreePoolState]);

  const removePoolKey = useCallback((keyId: string) => {
    updateFreePoolState(prev => ({
      ...prev,
      sharedKeys: prev.sharedKeys.filter(k => k.id !== keyId),
    }));
  }, [updateFreePoolState]);

  const togglePoolKeyActive = useCallback((keyId: string) => {
    updateFreePoolState(prev => ({
      ...prev,
      sharedKeys: prev.sharedKeys.map(k => {
        if (k.id !== keyId) return k;
        const nextActive = !k.isActive;
        const updated = { ...k, isActive: nextActive };
        updated.status = evaluatePoolKeyStatus(updated);
        return updated;
      }),
    }));
  }, [updateFreePoolState]);

  const switchUserIdentity = useCallback(
    (
      email: string,
      displayName: string,
      authProviderOrOptions?:
        | 'google'
        | 'local'
        | 'guest'
        | { authProvider?: 'google' | 'local' | 'guest'; ownerPassphrase?: string },
      ownerPassphraseArg?: string,
    ) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) return;
      const now = Date.now();
      const authProvider: 'google' | 'local' | 'guest' =
        typeof authProviderOrOptions === 'string'
          ? authProviderOrOptions
          : authProviderOrOptions?.authProvider || 'google';
      const passphrase =
        typeof authProviderOrOptions === 'object' && authProviderOrOptions !== null
          ? authProviderOrOptions.ownerPassphrase
          : ownerPassphraseArg;
      const claimsOwner = verifyOwnerClaimPassphrase(passphrase);

      updateFreePoolState(prev => {
        const existing = prev.users.find(u => u.email.toLowerCase() === cleanEmail);
        if (existing) {
          const nextRole: PoolUserRole = claimsOwner ? 'owner' : existing.role;
          return {
            ...prev,
            currentUserId: existing.id,
            currentUserEmail: existing.email,
            isAuthenticated: authProvider !== 'guest',
            isAuthenticatedGoogle: authProvider === 'google',
            authProvider,
            ownerClaimedByUserId: claimsOwner ? existing.id : prev.ownerClaimedByUserId,
            users: prev.users.map(u =>
              u.id === existing.id
                ? {
                    ...u,
                    maskedEmail: maskEmailAddress(existing.email),
                    displayName: displayName || u.displayName,
                    role: nextRole,
                    authProvider,
                    lastActiveAt: now,
                  }
                : u,
            ),
          };
        }

        // First real Google-authenticated user or valid Owner Passphrase claim becomes Owner (zero hardcoded email)
        const nonGuestUsers = prev.users.filter(u => u.authProvider === 'google');
        const isFirstOwner = claimsOwner || (!prev.ownerClaimedByUserId && nonGuestUsers.length === 0);
        const assignedRole: PoolUserRole = isFirstOwner ? 'owner' : 'user';
        const newUserId = 'usr_' + cleanEmail.replace(/[^a-z0-9]/g, '_').slice(0, 16);
        const newUser = {
          id: newUserId,
          email: cleanEmail,
          maskedEmail: maskEmailAddress(cleanEmail),
          displayName: displayName || cleanEmail.split('@')[0],
          role: assignedRole,
          authProvider,
          status: 'active' as const,
          timeoutUntil: null,
          tokenQuota: 0,
          tokensConsumed: 0,
          createdAt: now,
          lastActiveAt: now,
          recentChatExcerpts: [],
        };
        return {
          ...prev,
          currentUserId: newUserId,
          currentUserEmail: cleanEmail,
          isAuthenticated: authProvider !== 'guest',
          isAuthenticatedGoogle: authProvider === 'google',
          authProvider,
          ownerClaimedByUserId: isFirstOwner ? newUserId : prev.ownerClaimedByUserId,
          users: [...prev.users, newUser],
        };
      });
    },
    [updateFreePoolState],
  );

  const claimOwnerRole = useCallback(
    (passphrase: string): boolean => {
      if (!verifyOwnerClaimPassphrase(passphrase)) {
        return false;
      }
      updateFreePoolState(prev => ({
        ...prev,
        ownerClaimedByUserId: prev.currentUserId,
        users: prev.users.map(u =>
          u.id === prev.currentUserId ? { ...u, role: 'owner' } : u,
        ),
        notifications: [
          {
            id: uniqueId('notif_'),
            level: 'success',
            title: 'Owner Privileges Activated',
            message: 'Current account is now verified as System Owner with full governance and chat audit permissions.',
            timestamp: Date.now(),
            read: false,
          },
          ...prev.notifications.slice(0, 29),
        ],
      }));
      return true;
    },
    [updateFreePoolState],
  );

  const setUserRole = useCallback(
    (userId: string, role: PoolUserRole) => {
      updateFreePoolState(prev => {
        const caller = prev.users.find(u => u.id === prev.currentUserId);
        if (caller?.role !== 'owner') return prev;
        return {
          ...prev,
          users: prev.users.map(u => (u.id === userId ? { ...u, role } : u)),
        };
      });
    },
    [updateFreePoolState],
  );

  const timeoutUser = useCallback((userId: string, minutes: number | null) => {
    const now = Date.now();
    updateFreePoolState(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          status: minutes ? 'timeout' : 'active',
          timeoutUntil: minutes ? now + minutes * 60 * 1000 : null,
        };
      }),
    }));
  }, [updateFreePoolState]);

  const toggleSuspendUser = useCallback((userId: string, reason?: string) => {
    updateFreePoolState(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u;
        const nextStatus = u.status === 'suspended' ? 'active' : 'suspended';
        return {
          ...u,
          status: nextStatus,
          suspendReason: nextStatus === 'suspended' ? reason : undefined,
        };
      }),
    }));
  }, [updateFreePoolState]);

  const updateUserTokenQuota = useCallback((userId: string, quota: number) => {
    updateFreePoolState(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === userId ? { ...u, tokenQuota: quota } : u)),
    }));
  }, [updateFreePoolState]);

  const clearPoolNotifications = useCallback(() => {
    updateFreePoolState(prev => ({
      ...prev,
      notifications: [],
    }));
  }, [updateFreePoolState]);

  const recordPoolTokenUsage = useCallback(
    (
      usage: TokenUsageRecord,
      poolKeyId?: string,
      userMessageExcerpt?: string,
      debugMeta?: ChatTurnDebugMeta,
    ) => {
      updateFreePoolState(prev => {
        const now = Date.now();
        const newAlerts = [...prev.notifications];
        let matchedKeyMask: string | undefined;

        const updatedKeys = prev.sharedKeys.map(k => {
          if (k.id !== poolKeyId) {
            return { ...k, status: evaluatePoolKeyStatus(k, now) };
          }
          matchedKeyMask = k.maskedKey;
          const prevStatus = evaluatePoolKeyStatus(k, now);
          const nextUsed = k.tokensUsed + usage.totalTokens;
          const updated: SharedPoolKey = {
            ...k,
            tokensUsed: nextUsed,
            promptTokensUsed: k.promptTokensUsed + usage.promptTokens,
            completionTokensUsed: k.completionTokensUsed + usage.completionTokens,
          };
          updated.status = evaluatePoolKeyStatus(updated, now);

          if (prevStatus === 'active' && updated.status === 'warning') {
            newAlerts.unshift({
              id: uniqueId('notif_'),
              level: 'warning',
              title: 'Free Pool Key Approaching Limit (80%)',
              message: `Key ${k.maskedKey} (${k.provider.toUpperCase()}) has used ${updated.tokensUsed.toLocaleString()} / ${k.tokenLimit.toLocaleString()} tokens.`,
              timestamp: now,
              read: false,
            });
          } else if (prevStatus !== 'exhausted' && updated.status === 'exhausted') {
            newAlerts.unshift({
              id: uniqueId('notif_'),
              level: 'critical',
              title: 'Pool Key Quota Reached — Auto-Switched to Next Key',
              message: `Key ${k.maskedKey} reached its ${k.tokenLimit.toLocaleString()} token limit. Automatically rotating to the next available Free Pool key.`,
              timestamp: now,
              read: false,
            });
          }
          return updated;
        });

        const updatedUsers = prev.users.map(u => {
          if (u.id !== prev.currentUserId) return u;
          const excerpts = userMessageExcerpt
            ? [
                {
                  id: uniqueId('ex_'),
                  text: userMessageExcerpt.slice(0, 200),
                  timestamp: now,
                  tokens: usage.totalTokens,
                  model: debugMeta?.model,
                  provider: debugMeta?.provider,
                },
                ...u.recentChatExcerpts.slice(0, 19),
              ]
            : u.recentChatExcerpts;
          return {
            ...u,
            tokensConsumed: u.tokensConsumed + usage.totalTokens,
            lastActiveAt: now,
            recentChatExcerpts: excerpts,
          };
        });

        const debugEntry: ChatDebugLogEntry = {
          id: uniqueId('dbg_'),
          chatTurnId: debugMeta?.chatTurnId || uniqueId('turn_'),
          userId: prev.currentUserId,
          provider: debugMeta?.provider || (settings.selectedProvider as AIProviderType) || 'rork',
          model: debugMeta?.model || settings.selectedModel || 'default',
          poolKeyId,
          maskedPoolKey: matchedKeyMask,
          maskedKeyUsed: matchedKeyMask,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          isExactFromAPI: Boolean(usage.isExactFromAPI ?? usage.isExactFromProvider),
          isExactFromProvider: Boolean(usage.isExactFromProvider ?? usage.isExactFromAPI),
          latencyMs: debugMeta?.latencyMs ?? 0,
          toolCalls: debugMeta?.toolCalls ?? [],
          usedFallback: Boolean(debugMeta?.usedFallback),
          fallbackProvider: debugMeta?.fallbackProvider,
          timestamp: now,
          promptPreview: (userMessageExcerpt || '').slice(0, 140),
          responsePreview: '',
        };

        const nextLogs = [debugEntry, ...(prev.chatDebugLogs || prev.debugLogs || []).slice(0, 49)];

        return {
          ...prev,
          sharedKeys: updatedKeys,
          users: updatedUsers,
          notifications: newAlerts.slice(0, 30),
          chatDebugLogs: nextLogs,
          debugLogs: nextLogs,
          sessionTokens: {
            prompt: prev.sessionTokens.prompt + usage.promptTokens,
            completion: prev.sessionTokens.completion + usage.completionTokens,
            total: prev.sessionTokens.total + usage.totalTokens,
            savedByCompression:
              prev.sessionTokens.savedByCompression + Math.round(usage.promptTokens * 0.35),
          },
        };
      });
    },
    [updateFreePoolState, settings.selectedProvider, settings.selectedModel],
  );

  const saveSubAgentTemplate = useCallback((template: CustomSubAgentTemplate) => {
    setCustomSubAgents(prev => {
      const exists = prev.some(t => t.id === template.id);
      const updated = exists
        ? prev.map(t => (t.id === template.id ? template : t))
        : [template, ...prev];
      saveCustomSubAgentTemplates(updated).catch(console.log);
      return updated;
    });
  }, []);

  const deleteSubAgentTemplate = useCallback((templateId: string) => {
    setCustomSubAgents(prev => {
      const updated = prev.filter(t => t.id !== templateId);
      saveCustomSubAgentTemplates(updated).catch(console.log);
      return updated;
    });
  }, []);

  const toggleYamlSkill = useCallback((skillId: string, enabled: boolean) => {
    setSkillEnabledOverrides(prev => {
      const updated = { ...prev, [skillId]: enabled };
      saveSkillEnabledOverrides(updated).catch(console.log);
      return updated;
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = syncLearningSettings(prev, partial);
      setMemoSystemEnabled(isLearningEnabled(updated));
      AsyncStorage.setItem('ide_settings', JSON.stringify(updated)).catch(e =>
        console.log('[App] Error saving settings:', e),
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
    if (!isLearningEnabled(settings)) {
      console.log('[App] Blocked addMemo because learning/memo function is disabled.');
      return '';
    }
    const item: MemoEntry = { id: uniqueId('mm_'), content, createdAt: Date.now() };
    setMemos(prev => {
      const updated = [...prev, item];
      AsyncStorage.setItem('ide_memos', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
    return item.id;
  }, [settings]);

  const updateMemo = useCallback((id: string, content: string) => {
    if (!isLearningEnabled(settings)) {
      return false;
    }
    setMemos(prev => {
      const updated = prev.map(m => (m.id === id ? { ...m, content } : m));
      AsyncStorage.setItem('ide_memos', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
    return true;
  }, [settings]);

  const deleteMemo = useCallback((id: string) => {
    setMemos(prev => {
      const updated = prev.filter(m => m.id !== id);
      AsyncStorage.setItem('ide_memos', JSON.stringify(updated)).catch(console.log);
      return updated;
    });
  }, []);

  /**
   * Resolves the active API key and provider/model, seamlessly rotating through the
   * "AI for Free" Shared Pool when the user has no personal key or when Pool Mode is enabled!
   */
  const resolveEffectiveProviderAndKey = useCallback((): {
    provider: AIProviderType;
    apiKey: string;
    model: string;
    poolKeyId?: string;
    maskedPoolKey?: string;
  } => {
    const prov = settings.selectedProvider as AIProviderType;
    let directKey = '';
    switch (prov) {
      case 'rork': directKey = 'rork_builtin'; break;
      case 'openai': directKey = settings.openaiKey || ''; break;
      case 'anthropic': directKey = settings.anthropicKey || ''; break;
      case 'gemini': directKey = settings.geminiKey || ''; break;
      case 'groq': directKey = settings.groqKey || ''; break;
      case 'openrouter': directKey = settings.openrouterKey || ''; break;
      case 'nvidia': directKey = settings.nvidiaKey || ''; break;
      case 'custom': directKey = settings.customKey || ''; break;
    }

    const pool = freePoolStateRef.current;
    // Check if user has a dedicated or shared Free Pool key available
    if (pool.poolEnabled && (!directKey || prov === 'rork')) {
      const match = selectActivePoolKeyForUser(pool.sharedKeys, pool.currentUserId, prov);
      if (match) {
        return {
          provider: match.selectedKey.provider,
          apiKey: match.decodedSecret,
          model: match.selectedKey.model || settings.selectedModel,
          poolKeyId: match.selectedKey.id,
          maskedPoolKey: match.selectedKey.maskedKey,
        };
      }
    }

    if (directKey) {
      return { provider: prov, apiKey: directKey, model: settings.selectedModel };
    }

    // Fallback to any active pool key if direct key is missing
    const anyPoolMatch = selectActivePoolKeyForUser(pool.sharedKeys, pool.currentUserId);
    if (anyPoolMatch) {
      return {
        provider: anyPoolMatch.selectedKey.provider,
        apiKey: anyPoolMatch.decodedSecret,
        model: anyPoolMatch.selectedKey.model,
        poolKeyId: anyPoolMatch.selectedKey.id,
        maskedPoolKey: anyPoolMatch.selectedKey.maskedKey,
      };
    }

    return { provider: prov, apiKey: '', model: settings.selectedModel };
  }, [settings]);

  const getApiKey = useCallback((): string => {
    return resolveEffectiveProviderAndKey().apiKey;
  }, [resolveEffectiveProviderAndKey]);

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
    if (isLearningTool(toolName) && !isLearningEnabled(settings)) {
      return 'removed';
    }
    const reg = TOOL_REGISTRY.find(t => t.name === toolName);
    if (reg?.isBeta) {
      if (toolName === 'web_search' && !settings.betaWebSearch) return 'removed';
      if (toolName === 'web_fetch' && !settings.betaWebFetch) return 'removed';
    }
    const custom = settings.toolPermissions?.[toolName];
    if (custom === 'removed' || custom === 'blocked') return custom;
    if (settings.yoloMode) return 'always';
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
    settings, updateSettings, isLoaded, learningEnabled: learningActive,
    todos, addTodo, updateTodoItem, deleteTodo, clearAllTodos,
    memos: learningActive ? memos : [], addMemo, updateMemo, deleteMemo, clearAllMemos,
    getApiKey, getFallbackSettings, resolveEffectiveProviderAndKey,
    getToolPermission, setToolPermission,
    agentMd, setAgentMd, soulMd, setSoulMd,
    identityMd, setIdentityMd, userMd, setUserMd, memoryMd, setMemoryMd,
    showSponsorModal, triggerSponsorInteraction, closeSponsorModal,
    // "AI for Free" Pool & Governance
    freePoolState,
    togglePoolEnabled,
    shareKeyToPool,
    removePoolKey,
    togglePoolKeyActive,
    switchUserIdentity,
    claimOwnerRole,
    setUserRole,
    timeoutUser,
    toggleSuspendUser,
    updateUserTokenQuota,
    clearPoolNotifications,
    recordPoolTokenUsage,
    showFreePoolModal,
    setShowFreePoolModal,
    // Custom Sub-Agents, YAML Skills & Dev0 Sub-Agent Workflow
    customSubAgents,
    saveSubAgentTemplate,
    deleteSubAgentTemplate,
    skillEnabledOverrides,
    toggleYamlSkill,
    showSubAgentStudioModal,
    setShowSubAgentStudioModal,
    subAgentWorkflow,
    updateSubAgentWorkflow,
    togglePauseSubAgent,
    addSubAgentCronJob,
    toggleSubAgentCronJob,
    deleteSubAgentCronJob,
  };
});
