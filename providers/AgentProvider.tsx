import React, { useState, useCallback, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import {
  AgentPlan,
  AgentTask,
  AgentTaskStatus,
  AgentTaskType,
  AgentToolUsage,
  ChatMessage,
  ToolCall,
  AIProviderType,
  PendingToolApproval,
  TOOL_REGISTRY,
  isLearningTool,
  isLearningEnabled,
} from '@/types';
import {
  callAI,
  TOOL_DEFINITIONS,
  buildSystemPrompt,
  buildPlannerPrompt,
  parsePlanFromAI,
  generateFinalResponse,
  resolveDefaultModel,
} from '@/utils/ai-service';
import {
  MAX_TOOL_RESULT_LENGTH,
  truncateToolResult,
  compressAndSanitizeMessagesForAPI,
} from '@/utils/chat-compression';
import { performWebSearch, performWebFetch } from '@/utils/web-tools';
import { useApp } from '@/providers/AppProvider';
import { useProject } from '@/providers/ProjectProvider';

export const SKIP_QUESTIONS_INSTRUCTION =
  'Fragen wurden vom Nutzer übersprungen. Triff eigenständig die sinnvollsten Best-Practice-Annahmen und führe die Aufgabe direkt vollständig aus.';

function genId(): string {
  return 'ag_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function buildFinalSummaryContext(
  userRequest: string,
  tasks: AgentTask[],
  filesCreated: string[],
  filesModified: string[],
  filesDeleted: string[],
  hasErrors: boolean,
): string {
  let ctx = 'Summarize the result of this job and explain to the user what was done.\n\n';
  ctx += '## Original request\n' + userRequest + '\n\n';
  ctx += '## Executed steps\n';
  for (const t of tasks) {
    const status = t.status === 'completed' ? '✅' : t.status === 'error' ? '❌' : '⏭️';
    ctx += status + ' **' + t.title + '**';
    if (t.result) ctx += ': ' + t.result.slice(0, 200);
    if (t.error) ctx += ' (Error: ' + t.error + ')';
    ctx += '\n';
  }
  if (filesCreated.length > 0) ctx += '\n**Created files:** ' + [...new Set(filesCreated)].join(', ') + '\n';
  if (filesModified.length > 0) ctx += '**Modified files:** ' + [...new Set(filesModified)].join(', ') + '\n';
  if (filesDeleted.length > 0) ctx += '**Deleted files:** ' + [...new Set(filesDeleted)].join(', ') + '\n';
  if (hasErrors) ctx += '\nThere were errors with some tasks. Explain what worked and what did not.\n';
  ctx += '\nWrite a helpful summary. Mention which files were created/modified and what the next step could be.';
  return ctx;
}

export const [AgentProvider, useAgent] = createContextHook(() => {
  const [plans, setPlans] = useState<AgentPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [pendingToolApproval, setPendingToolApproval] = useState<PendingToolApproval | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<{question: string; answer: string}[]>([]);
  const abortRef = useRef<boolean>(false);
  const plansRef = useRef<AgentPlan[]>([]);
  plansRef.current = plans;
  const activePlanIdRef = useRef<string | null>(null);
  activePlanIdRef.current = activePlanId;
  const lastUserRequestRef = useRef<string>('');

  const { settings, getApiKey, getFallbackSettings, todos, memos, addTodo, updateTodoItem, addMemo, agentMd, setAgentMd, soulMd, setSoulMd, identityMd, setIdentityMd, userMd, setUserMd, memoryMd, setMemoryMd, getToolPermission } = useApp();
  const {
    getFileContent, updateFileContent, createFile, deleteFile, renameFile,
    createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
  } = useProject();

  const activePlan = plans.find(p => p.id === activePlanId) ?? null;

  const updatePlan = useCallback((planId: string, updater: (plan: AgentPlan) => AgentPlan) => {
    setPlans(prev => {
      const next = prev.map(p => p.id === planId ? updater({ ...p }) : p);
      plansRef.current = next;
      return next;
    });
  }, []);

  const updateTaskInPlan = useCallback((planId: string, taskId: string, updater: (task: AgentTask) => AgentTask) => {
    setPlans(prev => {
      const next = prev.map(p => {
        if (p.id !== planId) return p;
        return {
          ...p,
          tasks: p.tasks.map(t => t.id === taskId ? updater({ ...t }) : t),
        };
      });
      plansRef.current = next;
      return next;
    });
  }, []);

  const checkAgentToolPermission = useCallback(async (toolName: string, args: Record<string, any>): Promise<{ allowed: boolean; reason?: string }> => {
    if (isLearningTool(toolName) && !isLearningEnabled(settings)) {
      return { allowed: false, reason: 'TOOL_HIDDEN' };
    }
    const perm = getToolPermission(toolName);
    console.log('[Agent] Checking permission for', toolName, ':', perm);

    if (perm === 'always') return { allowed: true };
    if (perm === 'removed') return { allowed: false, reason: 'TOOL_HIDDEN' };
    if (perm === 'blocked') return { allowed: false, reason: 'TOOL_BLOCKED: Tool "' + toolName + '" is blocked by the user. Inform the user that this tool needs to be enabled.' };

    if (perm === 'ask') {
      return new Promise<{ allowed: boolean; reason?: string }>((resolve) => {
        const reg = TOOL_REGISTRY.find(t => t.name === toolName);
        const approval: PendingToolApproval = {
          id: 'agap_' + Date.now().toString(36),
          toolName,
          toolDisplayName: reg?.displayName || toolName,
          arguments: args,
          resolve: (approved: boolean) => {
            setPendingToolApproval(null);
            resolve(approved
              ? { allowed: true }
              : { allowed: false, reason: 'TOOL_REJECTED: User rejected "' + toolName + '".' }
            );
          },
          timestamp: Date.now(),
        };
        setPendingToolApproval(approval);
      });
    }

    return { allowed: true };
  }, [getToolPermission, settings]);

  const approveAgentTool = useCallback((approved: boolean) => {
    if (pendingToolApproval) {
      pendingToolApproval.resolve(approved);
    }
  }, [pendingToolApproval]);

  const executeTool = useCallback(async (name: string, args: Record<string, any>): Promise<{ result: string; fileAction?: { type: 'created' | 'modified' | 'deleted'; path: string } }> => {
    console.log('[Agent] Executing tool:', name, JSON.stringify(args || {}).slice(0, 200));

    // Layer 3 Guard: Strictly block execution of any Learn/Memo tools when disabled
    if (isLearningTool(name) && !isLearningEnabled(settings)) {
      console.log('[Agent] Blocked disabled learning tool execution:', name);
      return { result: 'ERROR: Unknown tool "' + name + '". Learning and memory tools are disabled in settings.' };
    }

    if (name !== 'think' && name !== 'task_complete' && name !== 'verify_file' && name !== 'get_active_tools') {
      const permCheck = await checkAgentToolPermission(name, args);
      if (!permCheck.allowed) {
        if (permCheck.reason === 'TOOL_HIDDEN') {
          return { result: 'ERROR: Unknown tool "' + name + '".' };
        }
        return { result: permCheck.reason || 'Tool not allowed.' };
      }
    }

    const wrapResult = (res: { result: string; fileAction?: { type: 'created' | 'modified' | 'deleted'; path: string } }) => ({
      ...res,
      result: truncateToolResult(res.result || '', MAX_TOOL_RESULT_LENGTH),
    });

    try {
      switch (name) {
        case 'read_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File "' + args.path + '" not found.' };
          return wrapResult({ result: content });
        }
        case 'read_lines': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File "' + args.path + '" not found.' };
          const lines = content.split('\n');
          const start = Math.max(0, (args.start_line || 1) - 1);
          const end = Math.min(lines.length, args.end_line || lines.length);
          return wrapResult({ result: lines.slice(start, end).map((l: string, i: number) => (start + i + 1) + ': ' + l).join('\n') });
        }
        case 'write_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          const existed = getFileContent(args.path) !== null;
          updateFileContent(args.path, args.content ?? '');
          const lineCount = (args.content || '').split('\n').length;
          return {
            result: 'File "' + args.path + '" written (' + lineCount + ' lines).',
            fileAction: { type: existed ? 'modified' : 'created', path: args.path },
          };
        }
        case 'create_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          createFile(args.path, args.content || '');
          return { result: 'File "' + args.path + '" created.', fileAction: { type: 'created', path: args.path } };
        }
        case 'edit_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          if (!args?.old_text) return { result: 'ERROR: old_text is empty.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File "' + args.path + '" not found. Please read with read_file first.' };
          if (!content.includes(args.old_text)) return { result: 'ERROR: Text not found in "' + args.path + '". Please read the file again.' };
          const newContent = content.replace(args.old_text, args.new_text ?? '');
          updateFileContent(args.path, newContent);
          return { result: 'File "' + args.path + '" edited.', fileAction: { type: 'modified', path: args.path } };
        }
        case 'delete_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          deleteFile(args.path);
          return { result: 'File "' + args.path + '" deleted.', fileAction: { type: 'deleted', path: args.path } };
        }
        case 'rename_file': {
          if (!args?.old_path || !args?.new_path) return { result: 'ERROR: old_path and new_path are required.' };
          renameFile(args.old_path, args.new_path);
          return { result: 'File renamed to "' + args.new_path + '".', fileAction: { type: 'modified', path: args.new_path } };
        }
        case 'list_directory': {
          return wrapResult({ result: listDirectory(args?.path || '') });
        }
        case 'search_files': {
          if (!args?.query) return { result: 'ERROR: No search query provided.' };
          return wrapResult({ result: searchFilesInProject(args.query, args.path) });
        }
        case 'find_replace': {
          if (args?.find === undefined || args?.find === null || args.find === '') return { result: 'ERROR: Search text (find) is missing.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File "' + args.path + '" not found.' };
          let newContent: string;
          let count: number;
          if (args.all) {
            count = content.split(args.find).length - 1;
            newContent = content.split(args.find).join(args.replace ?? '');
          } else {
            count = content.includes(args.find) ? 1 : 0;
            newContent = content.replace(args.find, args.replace ?? '');
          }
          updateFileContent(args.path, newContent);
          return { result: count + ' occurrences replaced in "' + args.path + '".', fileAction: { type: 'modified', path: args.path } };
        }
        case 'create_directory': {
          if (!args?.path) return { result: 'ERROR: No path provided.' };
          createDirectory(args.path);
          return { result: 'Directory "' + args.path + '" created.' };
        }
        case 'get_project_tree': {
          return wrapResult({ result: getProjectTree() });
        }
        case 'get_file_info': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          return wrapResult({ result: getFileInfo(args.path) });
        }
        case 'create_todo': {
          if (!args?.text) return { result: 'ERROR: Todo text is missing.' };
          const id = addTodo(args.text);
          return { result: 'Todo created (ID: ' + id + '): "' + args.text + '"' };
        }
        case 'update_todo': {
          if (!args?.id) return { result: 'ERROR: Todo ID is missing.' };
          updateTodoItem(args.id, args.completed, args.text);
          return { result: 'Todo "' + args.id + '" updated.' };
        }
        case 'add_memo': {
          if (!isLearningEnabled(settings)) return { result: 'ERROR: Learning and memo tools are disabled.' };
          if (!args?.content) return { result: 'ERROR: Memo content is missing.' };
          addMemo(args.content);
          return { result: 'Memo saved: "' + args.content + '"' };
        }
        case 'think': {
          return { result: 'Thought process recorded.' };
        }
        case 'read_identity_files': {
          if (!isLearningEnabled(settings)) return { result: 'ERROR: Learning and identity tools are disabled.' };
          let output = '';
          output += '## SOUL.md\n' + (soulMd || '(empty)') + '\n\n';
          output += '## AGENTS.md\n' + (agentMd || '(empty)') + '\n\n';
          output += '## IDENTITY.md\n' + (identityMd || '(empty)') + '\n\n';
          output += '## USER.md\n' + (userMd || '(empty)') + '\n\n';
          output += '## MEMORY.md\n' + (memoryMd || '(empty)');
          return wrapResult({ result: output });
        }
        case 'get_active_tools': {
          const activeLearning = isLearningEnabled(settings);
          const activeTools = TOOL_DEFINITIONS.filter(t => {
            if (!activeLearning && isLearningTool(t.name)) return false;
            return getToolPermission(t.name) !== 'removed';
          }).map(t => t.name);
          return wrapResult({ result: 'Available active tools: ' + activeTools.join(', ') });
        }
        case 'update_soul_md': {
          if (!isLearningEnabled(settings)) return { result: 'ERROR: Learning and identity tools are disabled.' };
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setSoulMd(args.content);
          return { result: 'SOUL.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'update_agents_md': {
          if (!isLearningEnabled(settings)) return { result: 'ERROR: Learning and identity tools are disabled.' };
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setAgentMd(args.content);
          return { result: 'AGENTS.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'update_identity_md': {
          if (!isLearningEnabled(settings)) return { result: 'ERROR: Learning and identity tools are disabled.' };
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setIdentityMd(args.content);
          return { result: 'IDENTITY.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'update_user_md': {
          if (!isLearningEnabled(settings)) return { result: 'ERROR: Learning and identity tools are disabled.' };
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setUserMd(args.content);
          return { result: 'USER.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'update_memory_md': {
          if (!isLearningEnabled(settings)) return { result: 'ERROR: Learning and identity tools are disabled.' };
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setMemoryMd(args.content);
          return { result: 'MEMORY.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'web_search': {
          if (!args?.query) return { result: 'ERROR: Search term is missing.' };
          try {
            const result = await performWebSearch(args.query);
            return wrapResult({ result });
          } catch (e: any) {
            return { result: 'ERROR during web search: ' + (e?.message || 'Network error') };
          }
        }
        case 'web_fetch': {
          if (!args?.url) return { result: 'ERROR: URL is missing.' };
          try {
            const result = await performWebFetch(args.url, Math.min(args.max_length || MAX_TOOL_RESULT_LENGTH, MAX_TOOL_RESULT_LENGTH));
            return wrapResult({ result });
          } catch (e: any) {
            return { result: 'ERROR during web fetch: ' + (e?.message || 'Network error') };
          }
        }
        case 'task_complete': {
          return { result: 'TASK_COMPLETED: ' + (args?.summary || 'Done') };
        }
        case 'verify_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File "' + args.path + '" does not exist.' };
          const lines = content.split('\n').length;
          const isEmpty = content.trim().length === 0;
          return { result: 'File "' + args.path + '" exists. Lines: ' + lines + '. Empty: ' + (isEmpty ? 'Yes' : 'No') + '.' };
        }
        default:
          return { result: 'ERROR: Unknown tool "' + name + '".' };
      }
    } catch (e: any) {
      console.log('[Agent] Tool error:', name, e);
      return { result: 'ERROR in ' + name + ': ' + (e?.message || 'Unknown error') };
    }
  }, [settings, getFileContent, updateFileContent, createFile, deleteFile, renameFile, createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo, addTodo, updateTodoItem, addMemo, checkAgentToolPermission, getToolPermission, agentMd, soulMd, identityMd, userMd, memoryMd, setAgentMd, setSoulMd, setIdentityMd, setUserMd, setMemoryMd]);

  const createPlan = useCallback(async (
    userRequest: string,
    options?: { skipQuestions?: boolean }
  ): Promise<string | null> => {
    setIsPlanning(true);
    try {
      const apiKey = getApiKey();
      const effectiveProvider = settings.selectedProvider as AIProviderType;
      if (!apiKey && effectiveProvider !== 'rork' && effectiveProvider !== 'custom') {
        throw new Error('No API key configured.');
      }

      const safeModel = resolveDefaultModel(effectiveProvider, settings.selectedModel);
      const cleanRequest = typeof userRequest === 'string' && userRequest.trim()
        ? userRequest.trim()
        : lastUserRequestRef.current || 'Execute user task';

      if (
        !options?.skipQuestions &&
        !cleanRequest.includes(SKIP_QUESTIONS_INSTRUCTION) &&
        !cleanRequest.includes('Zusätzlicher Kontext (Antworten):')
      ) {
        lastUserRequestRef.current = cleanRequest;
      }

      const shouldAskQuestions =
        Boolean(settings.betaSuperAgent && settings.agentMode) &&
        !options?.skipQuestions &&
        !cleanRequest.includes(SKIP_QUESTIONS_INSTRUCTION) &&
        !cleanRequest.includes('Zusätzlicher Kontext (Antworten):');

      // CHECK: SuperAgent + AgentMode -> Questions phase (with Null Safety & Skip Support)
      if (shouldAskQuestions) {
        console.log('[Agent] SuperAgent + AgentMode: Starting clarification phase');
        const questionPrompt = 'You are an experienced project planner. Before creating a plan, ask CLARIFICATION QUESTIONS to fully understand the requirements.\n\n' +
          'User request: ' + cleanRequest + '\n\n' +
          'Ask 2-5 precise questions that will help you create the best plan.\n' +
          'Think about:\n' +
          '- Which files are affected?\n' +
          '- What is the exact goal?\n' +
          '- Are there special requirements?\n' +
          '- Technology decisions?\n\n' +
          'Always reply in English.';
        
        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
        const questionMessages: ChatMessage[] = [{
          id: genId(), role: 'user', content: questionPrompt, timestamp: Date.now(),
        }];
        
        try {
          const questionsResponse = await callAI(
            effectiveProvider,
            apiKey || 'rork_builtin',
            safeModel,
            questionMessages,
            [],
            'Always reply in English. Ask clear, precise questions.',
            settings.customEndpoint || undefined,
            fallbackSettings,
          );
          
          const questionsText = typeof questionsResponse.content === 'string' ? questionsResponse.content : '';
          if (!questionsText.trim()) throw new Error('No questions received');
          
          const extractedQuestions = questionsText
            .split(/\n|\d+\.|[-*•]/)
            .map((q: string) => q.trim())
            .filter((q: string) => typeof q === 'string' && q.length > 5 && q.includes('?'))
            .slice(0, 5);
          
          if (extractedQuestions.length > 0) {
            const validQuestions = extractedQuestions
              .filter((q: string) => q && q.length > 0 && q.length < 500)
              .map((q: string) => ({ question: q, answer: '' }));
            
            if (validQuestions.length > 0) {
              setClarificationQuestions(validQuestions);
              console.log('[Agent] Clarification questions:', validQuestions.map(q => q.question));
            }
          }
        } catch (e) {
          console.log('[Agent] Error generating questions:', e);
        }
      }

      const activeLearning = isLearningEnabled(settings);
      const plannerPrompt = buildPlannerPrompt({
        projectTree: getProjectTree(),
        memos: activeLearning ? memos : [],
        todos,
        learningEnabled: activeLearning,
      });

      const planMsg: ChatMessage[] = [{
        id: genId(),
        role: 'user',
        content: cleanRequest,
        timestamp: Date.now(),
      }];

      const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;

      const response = await callAI(
        effectiveProvider,
        apiKey || 'rork_builtin',
        safeModel,
        planMsg,
        [],
        plannerPrompt,
        settings.customEndpoint || undefined,
        fallbackSettings,
      );

      const parsedTasks = parsePlanFromAI(response.content);
      if (!parsedTasks || !Array.isArray(parsedTasks) || parsedTasks.length === 0) {
        throw new Error('Ungültige Plan-Antwort von KI erhalten');
      }

      const hasThinkingTask = parsedTasks.some(t => t && (t.taskType === 'thinking' || t.taskType === 'brainstorm'));
      if (!hasThinkingTask && parsedTasks.length > 2) {
        parsedTasks.unshift({
          title: '🧠 Request Analysis',
          description: 'Understand the requirements, analyze the project structure, and plan the implementation systematically. Which files need to be read/created/modified?',
          taskType: 'thinking' as any,
        });
        console.log('[Agent] Auto-inserted thinking task for complex plan');
      }

      const plan: AgentPlan = {
        id: genId(),
        userRequest: cleanRequest,
        tasks: parsedTasks
          .filter((t) => t !== null && t !== undefined && typeof t.title === 'string' && t.title.trim().length > 0)
          .map((t, i) => ({
            id: genId() + '_t' + i,
            title: t.title.trim().slice(0, 200),
            description: typeof t.description === 'string' ? t.description.trim().slice(0, 1000) : '',
            taskType: ((t.taskType as AgentTaskType) || 'task'),
            status: 'draft' as AgentTaskStatus,
            subAgentMessages: [],
            filesCreated: [],
            filesModified: [],
            filesDeleted: [],
          })),
        status: 'review',
        createdAt: Date.now(),
      };

      setPlans(prev => {
        const cleaned = prev.filter(p => !(p.status === 'clarifying' && (!p.tasks || p.tasks.length === 0)));
        const next = [...cleaned, plan];
        plansRef.current = next;
        return next;
      });
      activePlanIdRef.current = plan.id;
      setActivePlanId(plan.id);
      return plan.id;
    } catch (e: any) {
      console.log('[Agent] Planning error:', e);
      return null;
    } finally {
      setIsPlanning(false);
    }
  }, [settings, getApiKey, getFallbackSettings, getProjectTree, memos, todos]);

  const updateTaskDetails = useCallback((planId: string, taskId: string, title: string, description: string) => {
    updateTaskInPlan(planId, taskId, task => ({
      ...task,
      title,
      description,
    }));
  }, [updateTaskInPlan]);

  const addTaskToPlan = useCallback((planId: string, title: string, description: string, taskType: AgentTaskType = 'task') => {
    setPlans(prev => {
      const next = prev.map(p => {
        if (p.id !== planId) return p;
        const newTask: AgentTask = {
          id: genId(),
          title,
          description,
          taskType,
          status: 'draft',
          subAgentMessages: [],
          filesCreated: [],
          filesModified: [],
          filesDeleted: [],
        };
        return { ...p, tasks: [...p.tasks, newTask] };
      });
      plansRef.current = next;
      return next;
    });
  }, []);

  const removeTaskFromPlan = useCallback((planId: string, taskId: string) => {
    setPlans(prev => {
      const next = prev.map(p => {
        if (p.id !== planId) return p;
        return { ...p, tasks: p.tasks.filter(t => t.id !== taskId) };
      });
      plansRef.current = next;
      return next;
    });
  }, []);

  const reorderTasksInPlan = useCallback((planId: string, fromIndex: number, toIndex: number) => {
    setPlans(prev => {
      const next = prev.map(p => {
        if (p.id !== planId) return p;
        const newTasks = [...p.tasks];
        if (fromIndex < 0 || fromIndex >= newTasks.length || toIndex < 0 || toIndex >= newTasks.length) return p;
        const [moved] = newTasks.splice(fromIndex, 1);
        newTasks.splice(toIndex, 0, moved);
        return { ...p, tasks: newTasks };
      });
      plansRef.current = next;
      return next;
    });
  }, []);

  const executeSubAgent = useCallback(async (planId: string, task: AgentTask): Promise<void> => {
    const activeLearning = isLearningEnabled(settings);
    const effectiveProvider: AIProviderType = (settings.selectedProvider as AIProviderType) || 'rork';
    const safeModel = resolveDefaultModel(effectiveProvider, settings.selectedModel);

    if (task.taskType === 'web_search') {
      updateTaskInPlan(planId, task.id, t => ({ ...t, status: 'running', startedAt: Date.now() }));

      const apiKey = getApiKey() || 'rork_builtin';

      try {
        const allowedWebToolNames = activeLearning
          ? ['web_search', 'web_fetch', 'think', 'add_memo']
          : ['web_search', 'web_fetch', 'think'];
        const webTools = TOOL_DEFINITIONS.filter(t => allowedWebToolNames.includes(t.name));
        webTools.push({
          name: 'task_complete',
          description: 'Rufe dieses Tool auf wenn die Web-Recherche abgeschlossen ist.',
          parameters: { type: 'object', properties: { summary: { type: 'string', description: 'Zusammenfassung der Recherche-Ergebnisse' } }, required: ['summary'] },
        });

        const searchPrompt = 'You are a Web Research Agent. Always answer in English.\n'
          + 'Your task: ' + task.title + '\n'
          + 'Details: ' + task.description + '\n\n'
          + 'Use web_search to find information and web_fetch to load web pages.\n'
          + 'Summarize the results and call task_complete when you are done.';

        let messages: ChatMessage[] = [{
          id: genId(), role: 'user',
          content: 'Research: ' + task.title + '\n' + task.description,
          timestamp: Date.now(),
        }];

        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
        let iterations = 0;
        let taskDone = false;

        while (iterations < 10 && !abortRef.current && !taskDone) {
          iterations++;
          const compressedMsgs = compressAndSanitizeMessagesForAPI(messages, { maxToolLength: MAX_TOOL_RESULT_LENGTH });
          const response = await callAI(
            effectiveProvider, apiKey, safeModel,
            compressedMsgs, webTools, searchPrompt,
            settings.customEndpoint || undefined, fallbackSettings,
          );

          if (!response.toolCalls || response.toolCalls.length === 0) {
            messages = [...messages, { id: genId(), role: 'assistant', content: response.content || '', timestamp: Date.now() }];
            taskDone = true;
            break;
          }

          const toolCalls: ToolCall[] = response.toolCalls
            .filter(tc => activeLearning || !isLearningTool(tc.name))
            .map(tc => ({
              id: tc.id, name: tc.name, arguments: tc.arguments ?? {}, status: 'running' as const,
            }));

          messages = [...messages, { id: genId(), role: 'assistant', content: response.content || '', toolCalls, timestamp: Date.now() }];

          for (const tc of toolCalls) {
            if (tc.name === 'task_complete') {
              tc.status = 'completed';
              tc.result = 'Recherche abgeschlossen: ' + (tc.arguments?.summary || '');
              taskDone = true;
              messages = [...messages, { id: genId(), role: 'tool', content: tc.result, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now() }];
              break;
            }
            const { result: rawResult } = await executeTool(tc.name, tc.arguments);
            const result = truncateToolResult(rawResult, MAX_TOOL_RESULT_LENGTH);
            tc.result = result;
            tc.status = result.startsWith('FEHLER') ? 'error' : 'completed';
            messages = [...messages, { id: genId(), role: 'tool', content: result, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now() }];
          }

          updateTaskInPlan(planId, task.id, t => ({ ...t, subAgentMessages: [...messages] }));
        }

        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'completed', completedAt: Date.now(),
          thinkingContent: lastAssistant?.content || task.description,
          result: 'Web-Recherche abgeschlossen: ' + task.title,
          subAgentMessages: [...messages],
        }));
      } catch (e: any) {
        console.log('[Agent] Web search task error:', e);
        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'error', completedAt: Date.now(),
          error: 'Web-Suche fehlgeschlagen: ' + (e?.message || 'Unknown error'),
        }));
      }
      return;
    }

    if (task.taskType === 'thinking' || task.taskType === 'brainstorm') {
      updateTaskInPlan(planId, task.id, t => ({ ...t, status: 'running', startedAt: Date.now() }));

      const apiKey = getApiKey() || 'rork_builtin';

      try {
        const baseThinkPrompt = task.taskType === 'thinking'
          ? `Analyze the following problem EXTREMELY THOROUGHLY and DEEPLY. Take your time for a detailed analysis.

Topic: ${task.title}

Description: ${task.description}

Project Structure:\n${getProjectTree()}

IMPORTANT:
- Analyze the problem in multiple layers (Surface → Deep)
- Consider ALL relevant aspects
- Think about edge cases, error handling, performance
- Consider which files might be affected
- Plan the implementation step-by-step
- Critically validate your approach

Return a very detailed thought process.`
          : `Brainstorm about the following topic. Investigate MULTIPLE alternatives and approaches.

Topic: ${task.title}

Description: ${task.description}

Project Structure:\n${getProjectTree()}

IMPORTANT:
- Generate AT LEAST 3 different solution approaches
- Compare pros and cons of each approach
- Evaluate complexity, maintainability, performance
- Also think about unconventional solutions
- Collect creative ideas
- Critically validate each alternative

Investigate all options thoroughly.`;

        const thinkMsgs: ChatMessage[] = [{ id: genId(), role: 'user', content: baseThinkPrompt, timestamp: Date.now() }];
        const readOnlyTools = TOOL_DEFINITIONS.filter(t => ['read_file', 'read_lines', 'list_directory', 'search_files', 'get_project_tree', 'get_file_info', 'think', 'get_active_tools'].includes(t.name));
        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;

        const response = await callAI(
          effectiveProvider, apiKey, safeModel,
          thinkMsgs, readOnlyTools, 'Always answer in English. Be VERY analytical, thorough, and deep. Think slowly and systematically. Use only read-only tools for analysis.',
          settings.customEndpoint || undefined, fallbackSettings,
        );

        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'completed', completedAt: Date.now(),
          thinkingContent: response.content || task.description,
          result: task.taskType === 'thinking' ? 'Analyse abgeschlossen.' : 'Brainstorming abgeschlossen.',
        }));
      } catch (e: any) {
        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'completed', completedAt: Date.now(),
          thinkingContent: task.description,
          result: 'Gedankengang abgeschlossen (offline).',
        }));
      }
      return;
    }

    const apiKey = getApiKey() || 'rork_builtin';

    updateTaskInPlan(planId, task.id, t => ({ ...t, status: 'running', startedAt: Date.now() }));

    const filteredBaseTools = TOOL_DEFINITIONS.filter(t => {
      if (isLearningTool(t.name) && !activeLearning) return false;
      if (!settings.yoloMode) {
        if (t.name === 'web_search' && !settings.betaWebSearch) return false;
        if (t.name === 'web_fetch' && !settings.betaWebFetch) return false;
      }
      const perm = getToolPermission(t.name);
      if (perm === 'removed') return false;
      return true;
    });

    const subAgentTools = [...filteredBaseTools, {
      name: 'task_complete',
      description: 'Call this tool when the task is completed. Provide a summary.',
      parameters: { type: 'object', properties: { summary: { type: 'string', description: 'Summary of what was done' } }, required: ['summary'] },
    }, {
      name: 'verify_file',
      description: 'Check if a file exists and was created correctly.',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path' } }, required: ['path'] },
    }];

    const systemPrompt = buildSystemPrompt({
      persona: settings.persona,
      projectTree: getProjectTree(),
      memos: activeLearning ? memos : [],
      todos,
      mentionedFiles: [],
      yoloMode: settings.yoloMode,
      agentMd: activeLearning ? (getFileContent('.agents/AGENT.md') || agentMd) : undefined,
      soulMd: activeLearning ? (getFileContent('.agents/SOUL.md') || soulMd) : undefined,
      identityMd: activeLearning ? (getFileContent('.agents/IDENTITY.md') || identityMd) : undefined,
      userMd: activeLearning ? (getFileContent('.agents/USER.md') || userMd) : undefined,
      memoryMd: activeLearning ? (getFileContent('.agents/MEMORY.md') || memoryMd) : undefined,
      betaAgentLearning: activeLearning,
      learningEnabled: activeLearning,
      toolPermissions: settings.yoloMode ? undefined : settings.toolPermissions,
    });

    const taskPrompt = systemPrompt + '\n\n## Current Subtask\n'
      + 'Title: ' + task.title + '\n'
      + 'Description: ' + task.description + '\n\n'
      + 'IMPORTANT: You are a sub-agent. ONLY execute this specific task.\n'
      + 'When you are done, call the "task_complete" tool with a summary.\n'
      + 'ALWAYS read files before editing them.\n'
      + 'After creating a file, use verify_file to ensure it was created correctly.\n'
      + 'If a tool fails, try to fix it and run it again.\n';

    let messages: ChatMessage[] = [{
      id: genId(),
      role: 'user',
      content: 'Execute the following task:\n\nTitle: ' + task.title + '\nDescription: ' + task.description,
      timestamp: Date.now(),
    }];

    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const filesDeleted: string[] = [];
    let iterations = 0;
    const maxIterations = 20;
    let taskDone = false;

    const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;

    while (iterations < maxIterations && !abortRef.current && !taskDone) {
      iterations++;
      console.log('[Agent] Sub-agent iteration', iterations, 'for task:', task.title);

      try {
        const compressedMsgs = compressAndSanitizeMessagesForAPI(messages, { maxToolLength: MAX_TOOL_RESULT_LENGTH });
        const response = await callAI(
          effectiveProvider,
          apiKey,
          safeModel,
          compressedMsgs,
          subAgentTools,
          taskPrompt,
          settings.customEndpoint || undefined,
          fallbackSettings,
        );

        if (!response.toolCalls || response.toolCalls.length === 0) {
          const assistantMsg: ChatMessage = {
            id: genId(), role: 'assistant', content: response.content || '', timestamp: Date.now(),
          };
          messages = [...messages, assistantMsg];
          updateTaskInPlan(planId, task.id, t => ({ ...t, subAgentMessages: [...messages] }));

          if (iterations >= 3) {
            break;
          }

          const nudgeMsg: ChatMessage = {
            id: genId(), role: 'user', timestamp: Date.now(),
            content: 'You have not called any tools yet. Please use the available tools NOW to execute the task. '
              + 'Create files with create_file, read them with read_file, etc. '
              + 'When you are done, call task_complete. '
              + 'Write tool calls in the format: ```tool\n{"name": "tool_name", "arguments": {...}}\n```',
          };
          messages = [...messages, nudgeMsg];
          continue;
        }

        const toolCalls: ToolCall[] = response.toolCalls
          .filter(tc => activeLearning || !isLearningTool(tc.name))
          .map(tc => ({
            id: tc.id, name: tc.name, arguments: tc.arguments ?? {}, status: 'running' as const,
          }));

        const assistantMsg: ChatMessage = {
          id: genId(), role: 'assistant', content: response.content || '', toolCalls, timestamp: Date.now(),
        };
        messages = [...messages, assistantMsg];

        const toolResultMessages: ChatMessage[] = [];
        for (const tc of toolCalls) {
          if (abortRef.current) break;

          if (tc.name === 'task_complete') {
            tc.status = 'completed';
            tc.result = 'Task completed: ' + (tc.arguments?.summary || '');
            taskDone = true;
            toolResultMessages.push({
              id: genId(), role: 'tool', content: tc.result, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now(),
            });
            break;
          }

          const { result: rawResult, fileAction } = await executeTool(tc.name, tc.arguments);
          const result = truncateToolResult(rawResult, MAX_TOOL_RESULT_LENGTH);
          tc.result = result;
          const isError = result.startsWith('ERROR') || result.startsWith('FEHLER');
          tc.status = isError ? 'error' : 'completed';

          if (fileAction) {
            if (fileAction.type === 'created' && !filesCreated.includes(fileAction.path)) filesCreated.push(fileAction.path);
            if (fileAction.type === 'modified' && !filesModified.includes(fileAction.path)) filesModified.push(fileAction.path);
            if (fileAction.type === 'deleted' && !filesDeleted.includes(fileAction.path)) filesDeleted.push(fileAction.path);
          }

          let toolContent = result;
          if (isError) {
            toolContent = result + '\n\nNOTE: The tool failed. You can:\n'
              + '1. First check the file with read_file or list_directory\n'
              + '2. Try the command again with corrected parameters\n'
              + '3. Use verify_file to check if the file exists\n'
              + 'Continue within this step without aborting.';
          }

          toolResultMessages.push({
            id: genId(), role: 'tool', content: toolContent, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now(),
          });
        }

        messages = [...messages, ...toolResultMessages];
        updateTaskInPlan(planId, task.id, t => ({
          ...t,
          subAgentMessages: [...messages],
          filesCreated: [...filesCreated],
          filesModified: [...filesModified],
          filesDeleted: [...filesDeleted],
        }));
      } catch (e: any) {
        console.log('[Agent] Sub-agent iteration error:', e);
        const errorMsg: ChatMessage = {
          id: genId(), role: 'assistant', content: 'Error: ' + (e?.message || 'Unknown'), timestamp: Date.now(),
        };
        messages = [...messages, errorMsg];
        updateTaskInPlan(planId, task.id, t => ({ ...t, subAgentMessages: [...messages] }));
        if (iterations >= 3) break;
      }
    }

    const hasToolErrors = messages.some(m => m.role === 'tool' && m.content?.startsWith('FEHLER'));
    const hasFileOutputs = filesCreated.length > 0 || filesModified.length > 0;
    const finalStatus: AgentTaskStatus = abortRef.current ? 'cancelled'
      : taskDone ? 'completed'
      : iterations >= maxIterations ? (hasFileOutputs ? 'completed' : 'error')
      : 'completed';
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');

    let errorDetail: string | undefined;
    if (finalStatus === 'error') {
      errorDetail = 'Maximum iterations reached.';
      if (hasToolErrors) {
        const failedTools = messages.filter(m => m.role === 'tool' && m.content?.startsWith('FEHLER')).map(m => m.toolName).filter(Boolean);
        errorDetail += ' Fehlgeschlagene Tools: ' + [...new Set(failedTools)].join(', ');
      }
    }

    updateTaskInPlan(planId, task.id, t => ({
      ...t,
      status: finalStatus,
      completedAt: Date.now(),
      result: lastAssistant?.content || 'Task completed.',
      subAgentMessages: [...messages],
      filesCreated: [...filesCreated],
      filesModified: [...filesModified],
      filesDeleted: [...filesDeleted],
      error: errorDetail,
    }));
  }, [settings, getApiKey, getFallbackSettings, getProjectTree, memos, todos, executeTool, updateTaskInPlan, getFileContent, agentMd, soulMd, identityMd, userMd, memoryMd, getToolPermission]);

  const executePlan = useCallback(async (planId: string) => {
    abortRef.current = false;
    setIsExecuting(true);

    updatePlan(planId, p => ({ ...p, status: 'executing' }));

    const currentPlan = plansRef.current.find(p => p.id === planId);
    if (!currentPlan) {
      setIsExecuting(false);
      return;
    }

    try {
      for (const task of currentPlan.tasks) {
        if (task.status === 'completed' || task.status === 'cancelled') continue;
        updateTaskInPlan(planId, task.id, t => ({ ...t, status: 'pending' }));
      }

      const latestPlan = plansRef.current.find(p => p.id === planId);
      const tasksToRun = latestPlan?.tasks ?? currentPlan.tasks;

      let hadFatalError = false;
      for (const task of tasksToRun) {
        if (abortRef.current || hadFatalError) break;
        if (task.status === 'completed' || task.status === 'cancelled') continue;

        try {
          await executeSubAgent(planId, task);

          const updatedPlan = plansRef.current.find(p => p.id === planId);
          const updatedTask = updatedPlan?.tasks.find(t => t.id === task.id);
          if (updatedTask?.status === 'error') {
            if (settings.autoRetry) {
              console.log('[Agent] Task failed, retrying once:', task.title);
              const retryTask: AgentTask = {
                ...task,
                status: 'pending',
                subAgentMessages: [],
                filesCreated: [],
                filesModified: [],
                filesDeleted: [],
                error: undefined,
                result: undefined,
              };
              try {
                await executeSubAgent(planId, retryTask);
              } catch (retryErr: any) {
                console.log('[Agent] Retry also failed:', retryErr);
              }
            }

            const retryPlan = plansRef.current.find(p => p.id === planId);
            const retryTaskResult = retryPlan?.tasks.find(t => t.id === task.id);
            if (retryTaskResult?.status === 'error') {
              hadFatalError = true;
              for (const remainingTask of tasksToRun) {
                if (remainingTask.status === 'draft' || remainingTask.status === 'pending') {
                  updateTaskInPlan(planId, remainingTask.id, t => ({
                    ...t, status: 'cancelled', error: 'Abgebrochen: Vorheriger Schritt fehlgeschlagen.',
                  }));
                }
              }
            }
          }
        } catch (e: any) {
          console.log('[Agent] Task execution error:', e);
          updateTaskInPlan(planId, task.id, t => ({
            ...t, status: 'error', error: e?.message || 'Unknown error', completedAt: Date.now(),
          }));
          hadFatalError = true;
          for (const remainingTask of tasksToRun) {
            if (remainingTask.id !== task.id && (remainingTask.status === 'draft' || remainingTask.status === 'pending')) {
              updateTaskInPlan(planId, remainingTask.id, t => ({
                ...t, status: 'cancelled', error: 'Abgebrochen: Vorheriger Schritt fehlgeschlagen.',
              }));
            }
          }
        }
      }

      // --- CRITIC LOOP ---
      let criticRounds = 0;
      let criticPassed = false;
      while (criticRounds < 4 && !abortRef.current && !hadFatalError && !criticPassed) {
        criticRounds++;

        const criticTaskId = genId();
        const criticTask: AgentTask = {
          id: criticTaskId,
          title: 'Critic Review - Round ' + criticRounds,
          description: 'You are the CRITIC agent. Review all changes. You must enforce AAA quality! Evaluate functionality, logic, missing requirements, and edge cases. Score the implementation on a scale of 0 to 10. Format MUST contain exactly: "Score: X/10" where X is a number. If score is less than 8.5, you MUST explain what needs to be fixed. If score is 8.5 or higher, explain why it passes.',
          taskType: 'thinking',
          status: 'draft',
          subAgentMessages: [], filesCreated: [], filesModified: [], filesDeleted: []
        };

        addTaskToPlan(planId, criticTask.title, criticTask.description, criticTask.taskType);

        const latestPlanWithCritic = plansRef.current.find(p => p.id === planId);
        const actualCriticTask = latestPlanWithCritic?.tasks.find(t => t.title === criticTask.title);

        if (actualCriticTask) {
          await executeSubAgent(planId, actualCriticTask);

          const postCriticPlan = plansRef.current.find(p => p.id === planId);
          const finishedCriticTask = postCriticPlan?.tasks.find(t => t.id === actualCriticTask.id);

          const criticResult = finishedCriticTask?.thinkingContent || finishedCriticTask?.result || '';
          const scoreMatch = criticResult.match(/(?:(?:Score|Rating):?\s*)?(10|10\.0|[0-9](?:\.[0-9]+)?)\s*(?:\/|out of)\s*10/i);
          let score = 0;
          if (scoreMatch && scoreMatch[1]) {
            score = parseFloat(scoreMatch[1]);
          }

          if (score >= 8.5) {
            criticPassed = true;
          } else {
            const fixTask: AgentTask = {
              id: genId(),
              title: 'Fix issues from Critic Round ' + criticRounds,
              description: 'The Critic rejected the implementation with a score of ' + score + '/10. Review the critic feedback and fix ALL issues immediately:\n\n' + criticResult.slice(0, 1000),
              taskType: 'task',
              status: 'draft',
              subAgentMessages: [], filesCreated: [], filesModified: [], filesDeleted: []
            };
            addTaskToPlan(planId, fixTask.title, fixTask.description, fixTask.taskType);

            const planWithFix = plansRef.current.find(p => p.id === planId);
            const actualFixTask = planWithFix?.tasks.find(t => t.title === fixTask.title);
            if (actualFixTask) {
              await executeSubAgent(planId, actualFixTask);
            }
          }
        }
      }
      // --- END CRITIC LOOP ---

      await new Promise(resolve => setTimeout(resolve, 100));

      const finishedPlan = plansRef.current.find(p => p.id === planId);
      const pTasks = finishedPlan?.tasks ?? currentPlan.tasks;

      const completedCount = pTasks.filter(t => t.status === 'completed').length;
      const errorCount = pTasks.filter(t => t.status === 'error').length;
      const cancelledCount = pTasks.filter(t => t.status === 'cancelled').length;
      const totalTaskCount = pTasks.length;
      const allDone = pTasks.every(t => t.status === 'completed' || t.status === 'error' || t.status === 'cancelled');
      const hasRealErrors = errorCount > 0;
      const allSucceeded = completedCount === totalTaskCount;

      const allCreated = pTasks.flatMap(t => t.filesCreated || []);
      const allModified = pTasks.flatMap(t => t.filesModified || []);
      const allDeleted = pTasks.flatMap(t => t.filesDeleted || []);

      const toolMap: Record<string, { completed: number; error: number }> = {};
      for (const task of pTasks) {
        for (const msg of (task.subAgentMessages || [])) {
          if (msg.role === 'assistant' && msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              if (!tc || tc.name === 'task_complete') continue;
              if (!toolMap[tc.name]) toolMap[tc.name] = { completed: 0, error: 0 };
              if (tc.status === 'error') toolMap[tc.name].error++;
              else if (tc.status === 'completed') toolMap[tc.name].completed++;
            }
          }
        }
      }
      const totalToolsUsed: AgentToolUsage[] = Object.entries(toolMap).map(([name, counts]) => ({
        name,
        count: counts.completed + counts.error,
        status: counts.error > 0 && counts.completed > 0 ? 'mixed' : counts.error > 0 ? 'error' : 'completed',
      }));

      let finalResponse = '';
      try {
        const apiKey = getApiKey() || 'rork_builtin';
        const effectiveProvider: AIProviderType = (settings.selectedProvider as AIProviderType) || 'rork';
        const safeModel = resolveDefaultModel(effectiveProvider, settings.selectedModel);
        const summaryContext = buildFinalSummaryContext(currentPlan.userRequest, pTasks, allCreated, allModified, allDeleted, hasRealErrors);
        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
        const aiResponse = await generateFinalResponse(
          effectiveProvider,
          apiKey,
          safeModel,
          summaryContext,
          settings.customEndpoint || undefined,
          fallbackSettings,
        );
        finalResponse = aiResponse || '';
      } catch (e: any) {
        console.log('[Agent] AI final response failed, using fallback:', e?.message);
      }

      if (!finalResponse.trim()) {
        if (allSucceeded) {
          finalResponse = 'Alle **' + totalTaskCount + ' Aufgaben** wurden erfolgreich abgeschlossen.';
        } else if (hasRealErrors) {
          finalResponse = completedCount + ' von ' + totalTaskCount + ' Aufgaben abgeschlossen. ' + errorCount + ' Aufgabe(n) sind fehlgeschlagen.';
        } else {
          finalResponse = 'Auftrag beendet. ' + completedCount + '/' + totalTaskCount + ' Aufgaben erledigt.';
        }
        if (allCreated.length > 0) finalResponse += '\n\n**Erstellte Dateien:** ' + [...new Set(allCreated)].join(', ');
        if (allModified.length > 0) finalResponse += '\n\n**Geänderte Dateien:** ' + [...new Set(allModified)].join(', ');
        if (allDeleted.length > 0) finalResponse += '\n\n**Gelöschte Dateien:** ' + [...new Set(allDeleted)].join(', ');
      }

      let summary = '## Zusammenfassung\n\n';
      summary += '**Auftrag:** ' + currentPlan.userRequest + '\n\n';
      summary += '**Tasks:** ' + completedCount + '/' + totalTaskCount + ' abgeschlossen\n';
      if (hasRealErrors) {
        summary += '**Fehlgeschlagen:** ' + errorCount + ' Aufgaben\n';
      }

      const finalStatus = allSucceeded ? 'completed' : (allDone && hasRealErrors) ? 'error' : allDone ? 'completed' : 'error';
      console.log('[Agent] Plan final status:', finalStatus, 'completed:', completedCount, 'errors:', errorCount, 'cancelled:', cancelledCount, 'total:', totalTaskCount);

      updatePlan(planId, p => {
        const latestCompletedCount = p.tasks.filter(t => t.status === 'completed').length;
        const latestErrorCount = p.tasks.filter(t => t.status === 'error').length;
        const latestAllSucceeded = latestCompletedCount === p.tasks.length;
        const latestHasErrors = latestErrorCount > 0;
        const computedStatus = latestAllSucceeded ? 'completed' : latestHasErrors ? 'error' : 'completed';

        return {
          ...p,
          status: computedStatus as AgentPlan['status'],
          summary,
          finalResponse,
          totalToolsUsed,
          completedAt: Date.now(),
        };
      });

      // User-Info Extraction nach Job-Abschluss (nur wenn Lernmodus aktiv)
      if (isLearningEnabled(settings)) {
        const allMessages = pTasks.flatMap(t => t.subAgentMessages || []);
        await extractUserInfoIfEnabled(allMessages);
      }
    } catch (e: any) {
      console.log('[Agent] Plan execution error:', e);
      updatePlan(planId, p => ({ ...p, status: 'error' }));
    } finally {
      setIsExecuting(false);
    }
  }, [updatePlan, updateTaskInPlan, executeSubAgent, addTaskToPlan, getApiKey, settings, getFallbackSettings]);

  const stopExecution = useCallback(() => {
    abortRef.current = true;
    setIsExecuting(false);
    if (pendingToolApproval) {
      pendingToolApproval.resolve(false);
      setPendingToolApproval(null);
    }
  }, [pendingToolApproval]);

  const dismissPlan = useCallback((planId: string) => {
    updatePlan(planId, p => ({ ...p, dismissed: true }));
    if (activePlanId === planId) setActivePlanId(null);
  }, [activePlanId, updatePlan]);

  const skipClarificationQuestions = useCallback(async (planId?: string, autoExecute = true): Promise<string | null> => {
    setClarificationQuestions([]);
    const targetPlan = planId
      ? plansRef.current.find(p => p.id === planId)
      : (plansRef.current.find(p => p.id === activePlanIdRef.current) || plansRef.current.find(p => p.status === 'clarifying'));

    const baseRequest = targetPlan?.userRequest || lastUserRequestRef.current;
    if (!baseRequest) {
      return null;
    }

    if (targetPlan && targetPlan.tasks && targetPlan.tasks.length > 0) {
      updatePlan(targetPlan.id, p => ({
        ...p,
        userRequest: `${p.userRequest}\n\n[Hinweis zur Ausführung]: ${SKIP_QUESTIONS_INSTRUCTION}`,
        status: autoExecute ? 'executing' : 'review',
      }));
      if (autoExecute) {
        await executePlan(targetPlan.id);
      }
      return targetPlan.id;
    }

    if (targetPlan) {
      updatePlan(targetPlan.id, p => ({ ...p, dismissed: true }));
    }

    const newPlanId = await createPlan(
      `${baseRequest}\n\n[System-Anweisung]: ${SKIP_QUESTIONS_INSTRUCTION}`,
      { skipQuestions: true },
    );

    if (newPlanId && autoExecute) {
      await executePlan(newPlanId);
    }
    return newPlanId;
  }, [createPlan, executePlan, updatePlan]);

  const submitClarificationAnswers = useCallback(async (answersText: string, planId?: string, autoExecute = false): Promise<string | null> => {
    setClarificationQuestions([]);
    const targetPlan = planId
      ? plansRef.current.find(p => p.id === planId)
      : (plansRef.current.find(p => p.id === activePlanIdRef.current) || plansRef.current.find(p => p.status === 'clarifying'));

    const baseRequest = targetPlan?.userRequest || lastUserRequestRef.current;
    if (!baseRequest) return null;

    if (targetPlan) {
      updatePlan(targetPlan.id, p => ({ ...p, dismissed: true }));
    }

    const effectiveAnswers = answersText.trim() || SKIP_QUESTIONS_INSTRUCTION;
    const newPlanId = await createPlan(
      `${baseRequest}\n\nZusätzlicher Kontext (Antworten):\n${effectiveAnswers}`,
      { skipQuestions: true },
    );
    if (newPlanId && autoExecute) {
      await executePlan(newPlanId);
    }
    return newPlanId;
  }, [createPlan, executePlan, updatePlan]);

  const retryTask = useCallback(async (planId: string, taskId: string) => {
    const plan = plansRef.current.find(p => p.id === planId);
    const task = plan?.tasks.find(t => t.id === taskId);
    if (!plan || !task) return;

    setIsExecuting(true);
    updatePlan(planId, p => ({ ...p, status: 'executing' }));

    const cleanTask: AgentTask = {
      ...task,
      status: 'pending',
      taskType: task.taskType || 'task',
      subAgentMessages: [],
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
      error: undefined,
      result: undefined,
      thinkingContent: undefined,
      completedAt: undefined,
    };

    try {
      await executeSubAgent(planId, cleanTask);
    } catch (e: any) {
      updateTaskInPlan(planId, taskId, t => ({ ...t, status: 'error', error: e?.message || 'Fehler' }));
    } finally {
      setIsExecuting(false);
      const updatedPlan = plansRef.current.find(p => p.id === planId);
      if (updatedPlan) {
        const allDone = updatedPlan.tasks.every(t => t.status === 'completed' || t.status === 'error' || t.status === 'cancelled');
        const hasErrors = updatedPlan.tasks.some(t => t.status === 'error');
        if (allDone) {
          updatePlan(planId, p => ({ ...p, status: hasErrors ? 'error' : 'completed', completedAt: Date.now() }));
        }
      }
    }
  }, [updatePlan, updateTaskInPlan, executeSubAgent]);

  // User-Info Auto-Extraction im Lernmodus (mit Null Safety & striktem Guard)
  const extractUserInfoIfEnabled = useCallback(async (messages: ChatMessage[]) => {
    if (!isLearningEnabled(settings)) return;

    const lastUserMessages = messages
      .filter((m): m is ChatMessage => m !== null && m !== undefined)
      .filter(m => m.role === 'user')
      .slice(-5);

    const userContent = lastUserMessages.map(m => typeof m.content === 'string' ? m.content : '').join('\n');
    if (!userContent.trim()) return;

    const nameMatch = userContent.match(/\bich (?:heiße|bin)\s+(?:der |die )?([A-Z][a-zäöüß]+)/i);
    const roleMatch = userContent.match(/\b(?:ich bin|als|beruf(?:lich)?|entwickler|programmierer)\s+([^.,\n!]+)/i);
    const companyMatch = userContent.match(/\b(?:arbeite bei|firma|unternehmen|in\s+firma)\s+([A-Z][a-zA-Zäöüß\s]+)/i);

    let userInfoUpdated = false;
    let newUserInfo = typeof userMd === 'string' ? userMd : '';

    if (nameMatch && nameMatch[1] && !newUserInfo.toLowerCase().includes('name')) {
      const extractedName = nameMatch[1].trim();
      if (extractedName.length > 0 && extractedName.length < 50) {
        newUserInfo += '\n\n## Name\nDer Nutzer heißt **' + extractedName + '**.';
        userInfoUpdated = true;
        console.log('[Agent] Extracted name:', extractedName);
      }
    }

    if (roleMatch && roleMatch[0] && !newUserInfo.toLowerCase().includes('rolle') && !newUserInfo.toLowerCase().includes('beruf')) {
      const roleText = roleMatch[0].trim();
      if (roleText.length > 5 && roleText.length < 200) {
        const capitalizedRole = roleText.charAt(0).toUpperCase() + roleText.slice(1);
        newUserInfo += '\n\n## Rolle\n' + capitalizedRole + '.';
        userInfoUpdated = true;
        console.log('[Agent] Extracted role:', roleText);
      }
    }

    if (companyMatch && companyMatch[1] && !newUserInfo.toLowerCase().includes('firma') && !newUserInfo.toLowerCase().includes('unternehmen')) {
      const extractedCompany = companyMatch[1].trim();
      if (extractedCompany.length > 2 && extractedCompany.length < 100) {
        newUserInfo += '\n\n## Firma\nNutzer arbeitet bei **' + extractedCompany + '**.';
        userInfoUpdated = true;
        console.log('[Agent] Extracted company:', extractedCompany);
      }
    }

    if (userInfoUpdated && newUserInfo.trim().length > 0) {
      setUserMd(newUserInfo);
      const memoParts = [];
      if (nameMatch && nameMatch[1]) memoParts.push('Name=' + nameMatch[1]);
      if (roleMatch && roleMatch[0]) memoParts.push('Rolle=' + roleMatch[0].slice(0, 30));
      if (companyMatch && companyMatch[1]) memoParts.push('Firma=' + companyMatch[1]);
      addMemo('User-Info aktualisiert: ' + memoParts.join(', '));
      console.log('[Agent] USER.MD updated successfully');
    }
  }, [settings, userMd, setUserMd, addMemo]);

  const visiblePlans = plans.filter(p => !p.dismissed);

  return {
    plans: visiblePlans, activePlan, activePlanId, isPlanning, isExecuting,
    createPlan, executePlan, stopExecution, dismissPlan,
    updateTaskDetails, addTaskToPlan, removeTaskFromPlan, reorderTasksInPlan, retryTask,
    setActivePlanId,
    pendingToolApproval, approveAgentTool,
    clarificationQuestions, setClarificationQuestions,
    skipClarificationQuestions, submitClarificationAnswers,
  };
});
