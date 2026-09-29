import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { z } from 'zod';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { ChatMessage, ToolCall, AIProviderType, InlineTodo, PendingToolApproval, TOOL_REGISTRY } from '@/types';
import { callAI, TOOL_DEFINITIONS, buildSystemPrompt, parseThinkingFromContent } from '@/utils/ai-service';
import { compressChat } from '@/utils/chat-compression';
import { useApp } from '@/providers/AppProvider';
import { useProject } from '@/providers/ProjectProvider';


function genId(): string {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export const [ChatProvider, useChat] = createContextHook(() => {
  const [manualMessages, setManualMessages] = useState<ChatMessage[]>([]);
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [thinkingPhase, setThinkingPhase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [lastFallbackInfo, setLastFallbackInfo] = useState<string | null>(null);
  const [rorkLoading, setRorkLoading] = useState<boolean>(false);
  const [pendingApproval, setPendingApproval] = useState<PendingToolApproval | null>(null);
  const abortRef = useRef<boolean>(false);
  const manualMessagesRef = useRef<ChatMessage[]>([]);
  manualMessagesRef.current = manualMessages;
  const rorkContextSentRef = useRef<boolean>(false);

  const { triggerSponsorInteraction, settings, getApiKey, getFallbackSettings, todos, memos, addTodo, updateTodoItem, addMemo, agentMd, setAgentMd, soulMd, setSoulMd, identityMd, setIdentityMd, userMd, setUserMd, memoryMd, setMemoryMd, getToolPermission } = useApp();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const {
    getFileContent, updateFileContent, createFile, deleteFile, renameFile,
    createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
  } = useProject();

  const opsRef = useRef({
    getFileContent, updateFileContent, createFile, deleteFile, renameFile,
    createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
    addTodo, updateTodoItem, addMemo, settings,
  });
  opsRef.current = {
    getFileContent, updateFileContent, createFile, deleteFile, renameFile,
    createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
    addTodo, updateTodoItem, addMemo, settings,
  };

  const isRorkProvider = settings.selectedProvider === 'rork';

  const rorkTools = useMemo(() => ({
    read_file: createRorkTool({
      description: 'Reads the content of a file. MUST be called before any editing.',
      zodSchema: z.object({ path: z.string().describe('File path relative to project root') }),
      execute: (input: { path: string }) => {
        console.log('[Rork] read_file:', input.path);
        const content = opsRef.current.getFileContent(input.path);
        if (content === null) return 'ERROR: File "' + input.path + '" not found.';
        return content;
      },
    }),
    write_file: createRorkTool({
      description: 'Writes content to a file (overwrites). File must be read first.',
      zodSchema: z.object({ path: z.string(), content: z.string().describe('New file content') }),
      execute: (input: { path: string; content: string }) => {
        console.log('[Rork] write_file:', input.path);
        opsRef.current.updateFileContent(input.path, input.content);
        return 'File "' + input.path + '" written (' + input.content.split('\n').length + ' lines).';
      },
    }),
    create_file: createRorkTool({
      description: 'Creates a new file. Directories are created automatically.',
      zodSchema: z.object({ path: z.string(), content: z.string().describe('File content') }),
      execute: (input: { path: string; content: string }) => {
        console.log('[Rork] create_file:', input.path);
        opsRef.current.createFile(input.path, input.content);
        return 'File "' + input.path + '" created.';
      },
    }),
    edit_file: createRorkTool({
      description: 'Edits a file by replacing text. File MUST be read with read_file first. old_text must match exactly.',
      zodSchema: z.object({ path: z.string(), old_text: z.string().describe('Exact text to be replaced'), new_text: z.string().describe('New text') }),
      execute: (input: { path: string; old_text: string; new_text: string }) => {
        console.log('[Rork] edit_file:', input.path);
        const content = opsRef.current.getFileContent(input.path);
        if (content === null) return 'ERROR: File not found. Please read with read_file first.';
        if (!content.includes(input.old_text)) return 'ERROR: Text not found in "' + input.path + '". Please read the file again.';
        opsRef.current.updateFileContent(input.path, content.replace(input.old_text, input.new_text));
        return 'File "' + input.path + '" edited.';
      },
    }),
    delete_file: createRorkTool({
      description: 'Deletes a file or an empty directory.',
      zodSchema: z.object({ path: z.string() }),
      execute: (input: { path: string }) => {
        console.log('[Rork] delete_file:', input.path);
        opsRef.current.deleteFile(input.path);
        return 'File "' + input.path + '" deleted.';
      },
    }),
    rename_file: createRorkTool({
      description: 'Renames a file or directory.',
      zodSchema: z.object({ old_path: z.string(), new_path: z.string() }),
      execute: (input: { old_path: string; new_path: string }) => {
        console.log('[Rork] rename_file:', input.old_path, '->', input.new_path);
        opsRef.current.renameFile(input.old_path, input.new_path);
        return 'Renamed: "' + input.old_path + '" -> "' + input.new_path + '".';
      },
    }),
    list_directory: createRorkTool({
      description: 'Lists all files and directories in a directory.',
      zodSchema: z.object({ path: z.string().describe('Path (empty for root directory)') }),
      execute: (input: { path: string }) => {
        console.log('[Rork] list_directory:', input.path);
        return opsRef.current.listDirectory(input.path || '');
      },
    }),
    search_files: createRorkTool({
      description: 'Searches all files for text (grep). Returns filename, line, and context.',
      zodSchema: z.object({ query: z.string().describe('Search term or Regex'), path: z.string().optional().describe('Optional path') }),
      execute: (input: { query: string; path?: string }) => {
        console.log('[Rork] search_files:', input.query);
        return opsRef.current.searchFilesInProject(input.query, input.path);
      },
    }),
    find_replace: createRorkTool({
      description: 'Finds and replaces text in a file.',
      zodSchema: z.object({ path: z.string(), find: z.string(), replace: z.string() }),
      execute: (input: { path: string; find: string; replace: string }) => {
        console.log('[Rork] find_replace:', input.path);
        const content = opsRef.current.getFileContent(input.path);
        if (content === null) return 'ERROR: File not found.';
        const count = content.split(input.find).length - 1;
        opsRef.current.updateFileContent(input.path, content.split(input.find).join(input.replace));
        return count + ' occurrences replaced in "' + input.path + '".';
      },
    }),
    create_directory: createRorkTool({
      description: 'Creates a new directory.',
      zodSchema: z.object({ path: z.string() }),
      execute: (input: { path: string }) => {
        console.log('[Rork] create_directory:', input.path);
        opsRef.current.createDirectory(input.path);
        return 'Directory "' + input.path + '" created.';
      },
    }),
    get_project_tree: createRorkTool({
      description: 'Returns the entire project structure as a tree representation.',
      zodSchema: z.object({}),
      execute: () => {
        console.log('[Rork] get_project_tree');
        return opsRef.current.getProjectTree();
      },
    }),
    get_file_info: createRorkTool({
      description: 'Returns information about a file (lines, chars, language).',
      zodSchema: z.object({ path: z.string() }),
      execute: (input: { path: string }) => {
        console.log('[Rork] get_file_info:', input.path);
        return opsRef.current.getFileInfo(input.path);
      },
    }),
    create_todo: createRorkTool({
      description: 'Creates a new todo entry in the project plan.',
      zodSchema: z.object({ text: z.string().describe('Todo text') }),
      execute: (input: { text: string }) => {
        console.log('[Rork] create_todo:', input.text);
        const id = opsRef.current.addTodo(input.text);
        return JSON.stringify({ id, text: input.text, completed: false });
      },
    }),
    update_todo: createRorkTool({
      description: 'Updates a todo entry.',
      zodSchema: z.object({ id: z.string(), completed: z.boolean().optional(), text: z.string().optional() }),
      execute: (input: { id: string; completed?: boolean; text?: string }) => {
        console.log('[Rork] update_todo:', input.id);
        opsRef.current.updateTodoItem(input.id, input.completed, input.text);
        return 'Todo "' + input.id + '" updated.';
      },
    }),
    add_memo: createRorkTool({
      description: 'Saves an important note in the project memory.',
      zodSchema: z.object({ content: z.string() }),
      execute: (input: { content: string }) => {
        console.log('[Rork] add_memo:', input.content);
        opsRef.current.addMemo(input.content);
        return 'Memo saved.';
      },
    }),
    think: createRorkTool({
      description: 'Use this tool to think about a complex problem. Your thought process will be shown to the user.',
      zodSchema: z.object({ thought: z.string().describe('Your detailed thought process') }),
      execute: (input: { thought: string }) => {
        console.log('[Rork] think:', input.thought.slice(0, 80));
        return 'Thought process recorded.';
      },
    }),
    web_search: createRorkTool({
      description: 'Performs a DuckDuckGo Instant Answer search (usually only returns short abstracts for Wikipedia-known terms, not a full web search).',
      zodSchema: z.object({ query: z.string().describe('Search term') }),
      execute: async (input: { query: string }) => {
        console.log('[Rork] web_search:', input.query);
        const s = settingsRef.current;
        if (!s.yoloMode && !s.betaWebSearch) return 'ERROR: Web search is not enabled. Please enable it in the Beta settings.';
        const perm = s.yoloMode ? 'always' : (s.toolPermissions?.['web_search'] || 'ask');
        if (perm === 'blocked') return 'ERROR: Web search is blocked by the user.';
        if (perm === 'removed') return 'ERROR: Unknown Tool.';
        try {
          const resp = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(input.query) + '&format=json&no_redirect=1&no_html=1');
          if (!resp.ok) return 'Web search failed (Status ' + resp.status + ').';
          const data = await resp.json();
          let results = '';
          if (data?.Abstract) results += 'Summary: ' + data.Abstract + '\n\n';
          if (data?.RelatedTopics) {
            for (const t of (data.RelatedTopics || []).slice(0, 8)) {
              if (t?.Text) results += '• ' + t.Text + '\n';
              if (t?.FirstURL) results += '  URL: ' + t.FirstURL + '\n';
            }
          }
          return results || 'No results found for: ' + input.query;
        } catch (e: any) {
          return 'ERROR during web search: ' + (e?.message || 'Network error');
        }
      },
    }),

      sub_agent: createRorkTool({
        description: 'Delegates task to a specialized sub-agent (Analyst, Developer, Tester, Researcher).',
        zodSchema: z.object({ role: z.string().describe('Role of the sub-agent'), task: z.string().describe('Task description') }),
        execute: async (input: { role: string, task: string }) => {
          return 'ERROR: Sub-agents cannot be started in direct chat. Please use the planner.';
        }
      }),

      propose_agent_mode: createRorkTool({
        description: 'Proposes to the user to switch to agent mode because the task is too complex for direct chat.',
        zodSchema: z.object({ reason: z.string().describe('Reason') }),
        execute: async (input: { reason: string }) => {
          return 'Tip: Click the "Create!" button to use the planner for this complex task: ' + input.reason;
        }
      }),
      web_fetch: createRorkTool({
      description: 'Downloads the content of a webpage and returns the text (without HTML tags).',
      zodSchema: z.object({ url: z.string().describe('URL of the webpage'), max_length: z.number().optional().describe('Maximum characters (default: 5000)') }),
      execute: async (input: { url: string; max_length?: number }) => {
        console.log('[Rork] web_fetch:', input.url);
        const s = settingsRef.current;
        if (!s.yoloMode && !s.betaWebFetch) return 'ERROR: Web fetch is not enabled. Please enable it in the Beta settings.';
        const perm = s.yoloMode ? 'always' : (s.toolPermissions?.['web_fetch'] || 'ask');
        if (perm === 'blocked') return 'ERROR: Web fetch is blocked by the user.';
        if (perm === 'removed') return 'ERROR: Unknown Tool.';
        try {
          const resp = await fetch(input.url, { headers: { 'Accept': 'text/html,text/plain,application/json' } });
          if (!resp.ok) return 'Fetch failed (Status ' + resp.status + ').';
          const text = await resp.text();
          const maxLen = input.max_length || 5000;
          const cleaned = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '... (truncated)' : cleaned;
        } catch (e: any) {
          return 'ERROR during web fetch: ' + (e?.message || 'Network error');
        }
      },
    }),
  }), []);

  const rorkAgent = useRorkAgent({
    tools: rorkTools,
    // Workaround for CORS if SDK supports custom fetch or endpoint
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      if (Platform.OS === 'web') {
        const url = typeof input === 'string' ? input : (input as Request).url || input.toString();
        // Skip proxy if it's already a relative URL or not toolkit
        if (url.includes('toolkit.rork.com') || url.includes('/agent/chat')) {
          try {
            const bodyObj = init && init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
            bodyObj.endpoint = url;
            return fetch('/api/chat', { ...init, body: JSON.stringify(bodyObj) });
          } catch (e) {
            return fetch('/api/chat', init);
          }
        }
      }
      return fetch(input, init);
    }
  });

  useEffect(() => {
    if (!isRorkProvider || !rorkLoading) return;
    const msgs = rorkAgent.messages ?? [];
    if (msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.parts || !Array.isArray(lastMsg.parts)) return;

    const hasUnresolved = lastMsg.parts.some((p: any) =>
      p && p.type === 'tool' && p.state !== 'output-available' && p.state !== 'output-error'
    );

    if (!hasUnresolved) {
      const timer = setTimeout(() => setRorkLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [rorkAgent.messages, rorkLoading, isRorkProvider]);

  useEffect(() => {
    if (rorkAgent.error) {
      console.log('[Chat] Rork agent error:', rorkAgent.error);
      const errMsg = typeof rorkAgent.error === 'string' ? rorkAgent.error : (rorkAgent.error as any)?.message || 'Studio KI Fehler';
      if (errMsg.toLowerCase().includes('network error') || errMsg.toLowerCase().includes('fetch')) {
        setError('CORS/Network error: The browser is blocking the connection to Studio AI. Using internal proxy route.');
      } else {
        setError(errMsg);
      }
      setRorkLoading(false);
    }
  }, [rorkAgent.error]);

  const convertRorkMessages = useMemo((): ChatMessage[] => {
    if (!isRorkProvider) return [];
    const msgs = rorkAgent.messages ?? [];
    if (!Array.isArray(msgs)) return [];
    const result: ChatMessage[] = [];

    for (const msg of msgs) {
      if (!msg || !msg.parts || !Array.isArray(msg.parts)) continue;

      const textParts = (msg.parts ?? []).filter((p: any) => p && p.type === 'text');
      const toolParts = (msg.parts ?? []).filter((p: any) => p && p.type === 'tool');

      let textContent = textParts.map((p: any) => (p && typeof p.text === 'string' ? p.text : '')).join('');

      if (msg.role === 'user') {
        const contextEnd = textContent.indexOf('\n---\n');
        if (contextEnd > 0 && contextEnd < 3000) {
          textContent = textContent.slice(contextEnd + 5).trim();
        }
      }

      const { thinking, cleanContent } = parseThinkingFromContent(textContent);

      let thinkingContent = thinking || '';
      for (const tp of toolParts) {
        if (tp && (tp as any).toolName === 'think') {
          const thought = (tp as any).input?.thought;
          if (typeof thought === 'string') {
            thinkingContent += (thinkingContent ? '\n\n' : '') + thought;
          }
        }
      }

      const nonThinkTools = toolParts.filter((p: any) => p && (p as any).toolName !== 'think');
      const toolCalls: ToolCall[] = nonThinkTools
        .map((p: any) => {
          if (!p) return null;
          const toolName = typeof (p as any).toolName === 'string' ? (p as any).toolName : '';
          if (!toolName) return null;
          
          const toolCallId = typeof (p as any).toolCallId === 'string' ? (p as any).toolCallId : genId();
          const input = (p as any).input && typeof (p as any).input === 'object' ? (p as any).input : {};
          const state = (p as any).state;
          const output = (p as any).output;
          const errorText = (p as any).errorText;

          let result: string | undefined = undefined;
          let status: ToolCall['status'] = 'running';

          if (state === 'output-available') {
            result = typeof output === 'string' ? output : JSON.stringify(output ?? '');
            status = 'completed';
          } else if (state === 'output-error') {
            result = 'ERROR: ' + (typeof errorText === 'string' ? errorText : 'Unbekannt');
            status = 'error';
          }

          return {
            id: toolCallId,
            name: toolName,
            arguments: input,
            result,
            status,
          } as ToolCall;
        })
        .filter((tc): tc is ToolCall => tc !== null);

      const inlineTodos: InlineTodo[] = [];
      for (const tp of toolParts) {
        if (tp && (tp as any).toolName === 'create_todo' && (tp as any).state === 'output-available') {
          try {
            const out = typeof (tp as any).output === 'string' ? JSON.parse((tp as any).output) : (tp as any).output;
            if (out && typeof out === 'object' && out.id) {
              const todoText = typeof out.text === 'string' ? out.text : (typeof (tp as any).input?.text === 'string' ? (tp as any).input.text : '');
              if (todoText) {
                inlineTodos.push({ id: out.id, text: todoText, completed: false });
              }
            }
          } catch {
            const text = typeof (tp as any).input?.text === 'string' ? (tp as any).input.text : '';
            if (text) inlineTodos.push({ id: genId(), text, completed: false });
          }
        }
      }

      if (msg.role === 'user' && !cleanContent.trim() && toolParts.length === 0) continue;

      result.push({
        id: typeof msg.id === 'string' ? msg.id : genId(),
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: cleanContent || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        thinking: thinkingContent || undefined,
        todos: inlineTodos.length > 0 ? inlineTodos : undefined,
        timestamp: Date.now(),
      });
    }

    return result;
  }, [isRorkProvider, rorkAgent.messages]);

  const messages = isRorkProvider ? convertRorkMessages : manualMessages;
  const isLoading = isRorkProvider ? rorkLoading : manualLoading;

  const checkToolPermission = useCallback(async (toolName: string, args: Record<string, any>): Promise<{ allowed: boolean; reason?: string }> => {
    const perm = getToolPermission(toolName);
    console.log('[Chat] Checking permission for', toolName, ':', perm);

    if (perm === 'always') return { allowed: true };

    if (perm === 'removed') {
      return { allowed: false, reason: 'TOOL_HIDDEN' };
    }

    if (perm === 'blocked') {
      return { allowed: false, reason: 'TOOL_BLOCKED: Tool "' + toolName + '" ist vom Nutzer blockiert. Bitte informiere den Nutzer, dass dieses Tool freigeschaltet werden muss.' };
    }

    if (perm === 'ask') {
      return new Promise<{ allowed: boolean; reason?: string }>((resolve) => {
        const reg = TOOL_REGISTRY.find(t => t.name === toolName);
        const approval: PendingToolApproval = {
          id: 'ap_' + Date.now().toString(36),
          toolName,
          toolDisplayName: reg?.displayName || toolName,
          arguments: args,
          resolve: (approved: boolean) => {
            setPendingApproval(null);
            if (approved) {
              resolve({ allowed: true });
            } else {
              resolve({ allowed: false, reason: 'TOOL_REJECTED: Nutzer hat Ausführung von "' + toolName + '" abgelehnt.' });
            }
          },
          timestamp: Date.now(),
        };
        setPendingApproval(approval);
      });
    }

    return { allowed: true };
  }, [getToolPermission]);

  const approvePendingTool = useCallback((approved: boolean) => {
    if (pendingApproval) {
      pendingApproval.resolve(approved);
    }
  }, [pendingApproval]);

  const executeManualTool = useCallback(async (name: string, args: Record<string, any>): Promise<{ result: string; inlineTodos?: InlineTodo[] }> => {
    console.log('[Chat] Executing tool:', name, JSON.stringify(args).slice(0, 200));

    if (name !== 'think') {
      const permCheck = await checkToolPermission(name, args);
      if (!permCheck.allowed) {
        if (permCheck.reason === 'TOOL_HIDDEN') {
          return { result: 'ERROR: Unknown tool "' + name + '". Verfügbare Tools: ' + TOOL_REGISTRY.filter(t => {
            const p = settingsRef.current.toolPermissions?.[t.name];
            return p !== 'removed';
          }).map(t => t.name).join(', ') };
        }
        return { result: permCheck.reason || 'Tool nicht erlaubt.' };
      }
    }

    try {
      switch (name) {
        case 'read_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File "' + args.path + '" nicht gefunden.' };
          return { result: content };
        }
        case 'read_lines': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File "' + args.path + '" nicht gefunden.' };
          const lines = content.split('\n');
          const start = Math.max(0, (args.start_line || 1) - 1);
          const end = Math.min(lines.length, args.end_line || lines.length);
          return { result: lines.slice(start, end).map((l: string, i: number) => (start + i + 1) + ': ' + l).join('\n') };
        }
        case 'write_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          updateFileContent(args.path, args.content ?? '');
          return { result: 'Datei "' + args.path + '" geschrieben (' + (args.content || '').split('\n').length + ' Zeilen).' };
        }
        case 'create_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          createFile(args.path, args.content || '');
          return { result: 'File "' + args.path + '" created.' };
        }
        case 'edit_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          if (!args?.old_text) return { result: 'ERROR: old_text is empty.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File "' + args.path + '" not found. Please read with read_file first.' };
          if (!content.includes(args.old_text)) return { result: 'ERROR: Text not found in "' + args.path + '". Please read the file again.' };
          updateFileContent(args.path, content.replace(args.old_text, args.new_text ?? ''));
          return { result: 'File "' + args.path + '" edited.' };
        }
        case 'delete_file': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          deleteFile(args.path);
          return { result: 'File "' + args.path + '" deleted.' };
        }
        case 'rename_file': {
          if (!args?.old_path || !args?.new_path) return { result: 'ERROR: old_path and new_path are required.' };
          renameFile(args.old_path, args.new_path);
          return { result: 'Renamed: "' + args.old_path + '" -> "' + args.new_path + '".' };
        }
        case 'list_directory':
          return { result: listDirectory(args?.path || '') };
        case 'search_files': {
          if (!args?.query) return { result: 'ERROR: No search term provided.' };
          return { result: searchFilesInProject(args.query, args.path) };
        }
        case 'find_replace': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          if (!args?.find) return { result: 'ERROR: Search text is missing.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'ERROR: File not found.' };
          const count = content.split(args.find).length - 1;
          updateFileContent(args.path, args.all ? content.split(args.find).join(args.replace ?? '') : content.replace(args.find, args.replace ?? ''));
          return { result: count + ' occurrences replaced in "' + args.path + '".' };
        }
        case 'create_directory': {
          if (!args?.path) return { result: 'ERROR: No path provided.' };
          createDirectory(args.path);
          return { result: 'Directory "' + args.path + '" created.' };
        }
        case 'get_project_tree':
          return { result: getProjectTree() };
        case 'get_file_info': {
          if (!args?.path) return { result: 'ERROR: No file path provided.' };
          return { result: getFileInfo(args.path) };
        }
        case 'create_todo': {
          if (!args?.text) return { result: 'ERROR: Todo text is missing.' };
          const id = addTodo(args.text);
          return { result: 'Todo created (ID: ' + id + ')', inlineTodos: [{ id, text: args.text, completed: false }] };
        }
        case 'update_todo': {
          if (!args?.id) return { result: 'ERROR: Todo ID is missing.' };
          updateTodoItem(args.id, args.completed, args.text);
          return { result: 'Todo "' + args.id + '" updated.' };
        }
        case 'add_memo': {
          if (!args?.content) return { result: 'ERROR: Memo content is missing.' };
          addMemo(args.content);
          return { result: 'Memo saved.' };
        }
        case 'think':
          return { result: 'Thought process recorded.' };
        case 'read_identity_files': {
          let output = '';
          output += '## SOUL.md\n' + (soulMd || '(empty)') + '\n\n';
          output += '## AGENTS.md\n' + (agentMd || '(empty)') + '\n\n';
          output += '## IDENTITY.md\n' + (identityMd || '(empty)') + '\n\n';
          output += '## USER.md\n' + (userMd || '(empty)') + '\n\n';
          output += '## MEMORY.md\n' + (memoryMd || '(empty)');
          return { result: output };
        }
        case 'update_soul_md': {
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setSoulMd(args.content);
          return { result: 'SOUL.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'update_agents_md': {
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setAgentMd(args.content);
          return { result: 'AGENTS.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'update_identity_md': {
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setIdentityMd(args.content);
          return { result: 'IDENTITY.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'update_user_md': {
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setUserMd(args.content);
          return { result: 'USER.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'update_memory_md': {
          if (!args?.content) return { result: 'ERROR: No content provided.' };
          setMemoryMd(args.content);
          return { result: 'MEMORY.md updated (' + args.content.split('\n').length + ' lines).' };
        }
        case 'web_search': {
          if (!args?.query) return { result: 'ERROR: Search term is missing.' };
          try {
            const resp = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(args.query) + '&format=json&no_redirect=1&no_html=1');
            if (!resp.ok) return { result: 'Web search failed.' };
            const data = await resp.json();
            let results = '';
            if (data?.Abstract) results += data.Abstract + '\n\n';
            if (data?.RelatedTopics) {
              for (const t of (data.RelatedTopics || []).slice(0, 8)) {
                if (t?.Text) results += '• ' + t.Text + '\n';
              }
            }
            return { result: results || 'No results for: ' + args.query };
          } catch (e: any) {
            return { result: 'ERROR: ' + (e?.message || 'Network error') };
          }
        }
        case 'web_fetch': {
          if (!args?.url) return { result: 'ERROR: URL is missing.' };
          try {
            const resp = await fetch(args.url);
            if (!resp.ok) return { result: 'Fetch failed (' + resp.status + ').' };
            const text = await resp.text();
            const maxLen = args.max_length || 5000;
            const cleaned = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return { result: cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '...' : cleaned };
          } catch (e: any) {
            return { result: 'ERROR: ' + (e?.message || 'Network error') };
          }
        }
        default:
          return { result: 'ERROR: Unknown tool "' + name + '".' };
      }
    } catch (e: any) {
      console.log('[Chat] Tool error:', name, e);
      return { result: 'ERROR in ' + name + ': ' + (e?.message || 'Unknown') };
    }
  }, [getFileContent, updateFileContent, createFile, deleteFile, renameFile, createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo, addTodo, updateTodoItem, addMemo, checkToolPermission, agentMd, soulMd, identityMd, userMd, memoryMd, setAgentMd, setSoulMd, setIdentityMd, setUserMd, setMemoryMd]);

  const sendMessage = useCallback(async (userText: string, attachedFiles: string[] = []) => {
    if (!userText.trim() && attachedFiles.length === 0) return;

    triggerSponsorInteraction();
    setError(null);
    setLastFallbackInfo(null);

    if (isRorkProvider) {
      setRorkLoading(true);

      let fullMsg = '';
      if (!rorkContextSentRef.current || (rorkAgent.messages ?? []).length === 0) {
        fullMsg += 'You are an AI coding assistant in "Dev0". ALWAYS reply in English.\n';
        fullMsg += 'Use your tools ACTIVELY and IMMEDIATELY. DO NOT ask if you should do something - JUST DO IT.\n';
        fullMsg += 'ALWAYS read files with read_file BEFORE editing them.\n';
        fullMsg += 'Format responses with Markdown: **bold**, `code`, lists.\n';
        fullMsg += 'Use "think" tool for complex tasks to reason.\n';
        fullMsg += 'For complex tasks: First use "think", then create a plan, then execute all steps. If it is too complex for chat, use the "propose_agent_mode" tool.\n';
                fullMsg += 'CRITICAL: DO NOT claim to have used a tool if you did not explicitly call it. If a tool fails or is unavailable, you MUST report that it failed.\n';
        if (settings.betaWebSearch || settings.yoloMode) {
          fullMsg += 'You have the "web_search" tool available! Use it for web research and current information.\n';
        }
        if (settings.betaWebFetch || settings.yoloMode) {
          fullMsg += 'You have the "web_fetch" tool available! Use it to fetch webpage content.\n';
        }
        if (settings.yoloMode) {
          fullMsg += 'YOLO-Mode: Create/edit files WITHOUT asking.\n';
        }
        fullMsg += '\nProject tree:\n' + getProjectTree() + '\n';
        fullMsg += '---\n';
        rorkContextSentRef.current = true;
      }

      if (attachedFiles.length > 0) {
        fullMsg += '\nReferenced files:\n';
        for (const path of attachedFiles) {
          const content = getFileContent(path);
          fullMsg += '### ' + path + '\n```\n' + (content || '(not found)') + '\n```\n';
        }
      }

      fullMsg += userText;

      try {
        rorkAgent.sendMessage(fullMsg);
      } catch (e: any) {
        console.log('[Chat] Rork send error:', e);
        setError(e?.message?.includes('Network Error') ? 'Network/CORS error: The Rork API endpoint denied access in the web browser.' : e?.message || 'Send error');
        setRorkLoading(false);
      }
      return;
    }

    abortRef.current = false;
    const currentMessages = manualMessagesRef.current;
    const userMsg: ChatMessage = {
      id: genId(), role: 'user', content: userText, timestamp: Date.now(),
    };
    const newMessages = [...currentMessages, userMsg];
    setManualMessages(newMessages);
    setManualLoading(true);
    setIsThinking(true);
    setThinkingPhase('Analyzing request...');

    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('No API key. Go to Settings or select "Studio KI" (free).');
      }

      const mentionedFiles = attachedFiles.map(path => ({
        path, content: getFileContent(path) || '(not found)',
      }));

      const systemPrompt = buildSystemPrompt({
        persona: settings.persona, projectTree: getProjectTree(), memos, todos,
        mentionedFiles, yoloMode: settings.yoloMode,
        agentMd: settings.betaAgentLearning ? (getFileContent('.agents/AGENT.md') || agentMd) : undefined,
        soulMd: settings.betaAgentLearning ? (getFileContent('.agents/SOUL.md') || soulMd) : undefined,
        identityMd: settings.betaAgentLearning ? (getFileContent('.agents/IDENTITY.md') || identityMd) : undefined,
        userMd: settings.betaAgentLearning ? (getFileContent('.agents/USER.md') || userMd) : undefined,
        memoryMd: settings.betaAgentLearning ? (getFileContent('.agents/MEMORY.md') || memoryMd) : undefined,
        betaAgentLearning: settings.betaAgentLearning,
        toolPermissions: settings.toolPermissions,
      });

      const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
      let conversationHistory = [...newMessages];
      let iterations = 0;
      const maxIterations = 15;
      let collectedTodos: InlineTodo[] = [];

      const filteredTools = TOOL_DEFINITIONS.filter(t => {
        if (!settings.yoloMode) {
          if (t.name === 'web_search' && !settings.betaWebSearch) return false;
          if (t.name === 'web_fetch' && !settings.betaWebFetch) return false;
        }
        const learningTools = ['read_identity_files', 'update_soul_md', 'update_agents_md', 'update_identity_md', 'update_user_md', 'update_memory_md'];
        if (learningTools.includes(t.name) && !settings.betaAgentLearning) return false;
        const perm = getToolPermission(t.name);
        if (perm === 'removed') return false;
        return true;
      });

      // Add sub_agent explicitly if yoloMode is active or permission allows
      if (!filteredTools.find(t => t.name === 'sub_agent') && (settings.yoloMode || getToolPermission('sub_agent') !== 'removed')) {
        const subAgentTool = TOOL_DEFINITIONS.find(t => t.name === 'sub_agent');
        if (subAgentTool) filteredTools.push(subAgentTool);
      }

      while (iterations < maxIterations && !abortRef.current) {
        iterations++;
        setThinkingPhase(iterations === 1 ? 'AI is thinking...' : 'Processing tool results...');

        const response = await callAI(
          settings.selectedProvider as AIProviderType, apiKey, settings.selectedModel,
          conversationHistory, filteredTools, systemPrompt,
          settings.customEndpoint || undefined, fallbackSettings,
        );

        if (response.usedFallback) {
          setLastFallbackInfo('Automatically switched to ' + (response.fallbackProvider || 'Fallback'));
        }

        setIsThinking(false);
        const { thinking, cleanContent } = parseThinkingFromContent(response.content || '');

        if (!response.toolCalls || response.toolCalls.length === 0) {
          const assistantMsg: ChatMessage = {
            id: genId(), role: 'assistant', content: cleanContent, timestamp: Date.now(),
            thinking: thinking || undefined,
            todos: collectedTodos.length > 0 ? [...collectedTodos] : undefined,
          };
          conversationHistory = [...conversationHistory, assistantMsg];
          setManualMessages([...conversationHistory]);
          break;
        }

        const toolCalls: ToolCall[] = response.toolCalls.map(tc => ({
          id: tc.id, name: tc.name, arguments: tc.arguments ?? {}, status: 'running' as const,
        }));

        const thinkToolCalls = toolCalls.filter(tc => tc.name === 'think');
        let thinkingContent = thinking;
        for (const ttc of thinkToolCalls) {
          if (ttc.arguments?.thought) {
            thinkingContent += (thinkingContent ? '\n\n' : '') + ttc.arguments.thought;
          }
        }

        const assistantMsg: ChatMessage = {
          id: genId(), role: 'assistant', content: cleanContent, toolCalls, timestamp: Date.now(),
          thinking: thinkingContent || undefined,
        };
        conversationHistory = [...conversationHistory, assistantMsg];
        setManualMessages([...conversationHistory]);

        setThinkingPhase('Executing tools...');

        const toolResultMessages: ChatMessage[] = [];
        for (const tc of toolCalls) {
          if (abortRef.current) break;
          tc.status = 'running';
          setManualMessages([...conversationHistory, ...toolResultMessages]);

          const { result, inlineTodos } = await executeManualTool(tc.name, tc.arguments);
          tc.result = result;
          tc.status = result.startsWith('ERROR') ? 'error' : 'completed';
          if (inlineTodos) collectedTodos = [...collectedTodos, ...inlineTodos];

          toolResultMessages.push({
            id: genId(), role: 'tool', content: result, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now(),
          });
        }

        conversationHistory = [...conversationHistory, ...toolResultMessages];
        setManualMessages([...conversationHistory]);
      }

      if (iterations >= maxIterations) {
        setManualMessages(prev => [...prev, {
          id: genId(), role: 'assistant', content: 'Maximum iterations reached.', timestamp: Date.now(),
        }]);
      }
    } catch (e: any) {
      console.log('[Chat] Error:', e);
      setManualMessages(prev => [...prev, {
        id: genId(), role: 'assistant', content: '❌ ' + (e?.message || 'Unknown error'), timestamp: Date.now(),
      }]);
      setError(e?.message || 'Error');
    } finally {
      setManualLoading(false);
      setIsThinking(false);
      setThinkingPhase('');
    }
  }, [isRorkProvider, settings, getApiKey, getFallbackSettings, getFileContent, getProjectTree, memos, todos, executeManualTool, rorkAgent, agentMd, soulMd, identityMd, userMd, memoryMd]);

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    setManualLoading(false);
    setRorkLoading(false);
    setIsThinking(false);
  }, []);

  const clearChat = useCallback(() => {
    if (isRorkProvider) {
      rorkAgent.setMessages([]);
      rorkContextSentRef.current = false;
    }
    setManualMessages([]);
    setError(null);
    setLastFallbackInfo(null);
  }, [isRorkProvider, rorkAgent]);

  const startNewChat = useCallback(() => {
    if (isRorkProvider) {
      rorkAgent.setMessages([]);
      rorkContextSentRef.current = false;
    } else {
      const currentMsgs = manualMessagesRef.current;
      if (currentMsgs.length > 0) {
        setManualMessages([{
          id: genId(), role: 'assistant',
          content: '---\n\n**New chat started.**\n\n---',
          timestamp: Date.now(),
        }]);
      }
    }
    setError(null);
    setLastFallbackInfo(null);
  }, [isRorkProvider, rorkAgent]);

  const compressChat = useCallback(async (): Promise<string | null> => {
    const currentMsgs = isRorkProvider ? convertRorkMessages : manualMessagesRef.current;
    if (currentMsgs.length < 4) return null;

    // Build raw transcript for AI summarization
    const transcript = currentMsgs
      .filter(m => m.role !== 'tool')
      .map(m => {
        const prefix = m.role === 'user' ? 'User' : 'AI';
        const toolInfo = m.toolCalls?.length
          ? ' [Tools: ' + m.toolCalls.map(t => t.name + (t.status === 'error' ? '(ERROR)' : '')).join(', ') + ']' : '';
        return prefix + ': ' + (m.content || '').slice(0, 300) + toolInfo;
      })
      .join('\n');

    // Try AI-powered compression
    try {
      const apiKey = getApiKey();
      if (apiKey || settings.selectedProvider === 'rork') {
        const compressPrompt = 'Summarize the following conversation in max. 500 words. '
          + 'Keep: All important decisions, created/changed files, open tasks, user preferences. '
          + 'Remove: Repetitions, tool details, intermediate steps. '
          + 'Reply ONLY with the summary, no other text.\n\n'
          + transcript.slice(0, 8000);

        const compressMsg: ChatMessage[] = [{
          id: genId(), role: 'user', content: compressPrompt, timestamp: Date.now(),
        }];

        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
        const response = await callAI(
          settings.selectedProvider as AIProviderType,
          apiKey,
          settings.selectedModel,
          compressMsg,
          [],
          'You are a summarization assistant. Summarize conversations precisely. Reply in English.',
          settings.customEndpoint || undefined,
          fallbackSettings,
        );

        if (response.content && response.content.trim().length > 50) {
          return response.content.trim();
        }
      }
    } catch (e: any) {
      console.log('[Chat] AI compression failed, using fallback:', e?.message);
    }

    // Fallback: structured concatenation
    return transcript.slice(0, 3000);
  }, [isRorkProvider, convertRorkMessages, settings, getApiKey, getFallbackSettings]);

  const applyChatCompression = useCallback((summary: string) => {
    if (isRorkProvider) {
      rorkAgent.setMessages([]);
      rorkContextSentRef.current = false;
    }

    const currentSize = isRorkProvider
      ? JSON.stringify(convertRorkMessages).length
      : JSON.stringify(manualMessagesRef.current).length;
    const newSize = summary.length + 100;

    if (newSize >= currentSize) {
      console.log('[Chat] Compression aborted: new size >= old size');
      return false;
    }

    const summaryMsg: ChatMessage = {
      id: genId(), role: 'user',
      content: '[Summary of the conversation so far]\n\n' + summary,
      timestamp: Date.now(),
    };

    if (isRorkProvider) {
      rorkAgent.sendMessage('[Summary of the conversation so far]\n\n' + summary);
    } else {
      setManualMessages([summaryMsg]);
    }
    return true;
  }, [isRorkProvider, rorkAgent, convertRorkMessages]);

  return {
    messages, isLoading, isThinking, thinkingPhase, error, lastFallbackInfo,
    sendMessage, stopGeneration, clearChat, startNewChat,
    compressChat, applyChatCompression,
    pendingApproval, approvePendingTool,
  };
});
