import React, { useState, useCallback, useRef, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import {
  ChatMessage,
  ToolCall,
  AIProviderType,
  InlineTodo,
  PendingToolApproval,
  TOOL_REGISTRY,
  isLearningTool,
  isLearningEnabled,
} from '@/types';
import {
  callAI,
  TOOL_DEFINITIONS,
  buildSystemPrompt,
  parseThinkingFromContent,
  resolveDefaultModel,
} from '@/utils/ai-service';
import {
  MAX_TOOL_RESULT_LENGTH,
  truncateToolResult,
  compressAndSanitizeMessagesForAPI,
} from '@/utils/chat-compression';
import { performWebSearch, performWebFetch } from '@/utils/web-tools';
import { buildSynapseGraph, localizeCodeSubgraph } from '@/utils/synapse-graph';
import {
  discoverYamlSkills,
  buildActiveSkillsPromptBlock,
  isFileAllowedForSubAgent,
} from '@/utils/skill-loader';
import {
  SubAgentQuestionRequest,
  SubAgentQuestionResponse,
  hasExplicitQuestionToolCall,
  buildSubAgentQuestionRequestFromTool,
  detectSubAgentQuestionFromTurn,
  createSavedSubAgentFromQuestionResponse,
  buildMainCreatorRelayPrompt,
} from '@/utils/subagent-question-relay';
import { useApp } from '@/providers/AppProvider';
import { useProject } from '@/providers/ProjectProvider';

export const SKIP_QUESTIONS_INSTRUCTION =
  'Überspringe alle Rückfragen. Triff sinnvolle Standard-Annahmen und beginne SOFORT mit der Umsetzung.';

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
  const [pendingApproval, setPendingApproval] = useState<PendingToolApproval | null>(null);
  const [pendingSubAgentQuestion, setPendingSubAgentQuestion] = useState<SubAgentQuestionRequest | null>(null);
  const pendingQuestionResolverRef = useRef<((relayText: string) => void) | null>(null);
  const abortRef = useRef<boolean>(false);
  const manualMessagesRef = useRef<ChatMessage[]>([]);
  manualMessagesRef.current = manualMessages;

  const {
    triggerSponsorInteraction,
    settings,
    getApiKey,
    resolveEffectiveProviderAndKey,
    recordPoolTokenUsage,
    getFallbackSettings,
    todos,
    memos,
    addTodo,
    updateTodoItem,
    addMemo,
    agentMd,
    setAgentMd,
    soulMd,
    setSoulMd,
    identityMd,
    setIdentityMd,
    userMd,
    setUserMd,
    memoryMd,
    setMemoryMd,
    getToolPermission,
    customSubAgents,
    saveSubAgentTemplate,
    skillEnabledOverrides,
  } = useApp();

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const {
    currentProject,
    getFileContent,
    updateFileContent,
    createFile,
    deleteFile,
    renameFile,
    createDirectory,
    searchFilesInProject,
    getProjectTree,
    listDirectory,
    getFileInfo,
  } = useProject();

  const discoveredSkills = useMemo(() => {
    return discoverYamlSkills(currentProject?.files || [], skillEnabledOverrides);
  }, [currentProject?.files, skillEnabledOverrides]);

  const checkToolPermission = useCallback(
    async (
      toolName: string,
      args: Record<string, any>,
    ): Promise<{ allowed: boolean; reason?: string }> => {
      if (isLearningTool(toolName) && !isLearningEnabled(settingsRef.current)) {
        return { allowed: false, reason: 'TOOL_HIDDEN' };
      }
      const perm = getToolPermission(toolName);
      console.log('[Chat] Checking permission for', toolName, ':', perm);

      if (perm === 'always') return { allowed: true };

      if (perm === 'removed') {
        return { allowed: false, reason: 'TOOL_HIDDEN' };
      }

      if (perm === 'blocked') {
        return {
          allowed: false,
          reason:
            'TOOL_BLOCKED: Tool "' +
            toolName +
            '" ist vom Nutzer blockiert. Bitte informiere den Nutzer, dass dieses Tool freigeschaltet werden muss.',
        };
      }

      if (perm === 'ask') {
        return new Promise<{ allowed: boolean; reason?: string }>((resolve) => {
          const reg = TOOL_REGISTRY.find((t) => t.name === toolName);
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
                resolve({
                  allowed: false,
                  reason: 'TOOL_REJECTED: Nutzer hat Ausführung von "' + toolName + '" abgelehnt.',
                });
              }
            },
            timestamp: Date.now(),
          };
          setPendingApproval(approval);
        });
      }

      return { allowed: true };
    },
    [getToolPermission],
  );

  const approvePendingTool = useCallback(
    (approved: boolean) => {
      if (pendingApproval) {
        pendingApproval.resolve(approved);
      }
    },
    [pendingApproval],
  );

  const executeManualTool = useCallback(
    async (
      name: string,
      args: Record<string, any>,
      allowedFilePatterns?: string[],
    ): Promise<{ result: string; inlineTodos?: InlineTodo[] }> => {
      console.log('[Chat] Executing tool:', name, JSON.stringify(args || {}).slice(0, 200));

      // Layer 3 Guard: Strictly block execution of any Learn/Memo tools when disabled
      if (isLearningTool(name) && !isLearningEnabled(settingsRef.current)) {
        console.log('[Chat] Blocked disabled learning tool execution:', name);
        return {
          result:
            'ERROR: Unknown tool "' +
            name +
            '". Learning and memory tools are disabled in settings.',
        };
      }

      // Enforce Sub-Agent file scope guard when running inside a scoped Sub-Agent template
      if (
        allowedFilePatterns &&
        allowedFilePatterns.length > 0 &&
        ['write_file', 'create_file', 'edit_file', 'delete_file', 'rename_file', 'find_replace'].includes(name)
      ) {
        const targetPath = args?.path || args?.new_path || args?.old_path || '';
        if (targetPath && !isFileAllowedForSubAgent(targetPath, allowedFilePatterns)) {
          return {
            result: `ERROR: Sub-agent file scope violation. Path "${targetPath}" is not permitted by allowed patterns: ${allowedFilePatterns.join(', ')}`,
          };
        }
      }

      if (
        name !== 'think' &&
        name !== 'get_active_tools' &&
        name !== 'localize_code_graph' &&
        name !== 'ask_user_question' &&
        name !== 'ask_question' &&
        name !== 'ask_clarification'
      ) {
        const permCheck = await checkToolPermission(name, args);
        if (!permCheck.allowed) {
          if (permCheck.reason === 'TOOL_HIDDEN') {
            const activeLearning = isLearningEnabled(settingsRef.current);
            return {
              result:
                'ERROR: Unknown tool "' +
                name +
                '". Verfügbare Tools: ' +
                TOOL_REGISTRY.filter((t) => {
                  if (!activeLearning && isLearningTool(t.name)) return false;
                  const p = settingsRef.current.toolPermissions?.[t.name];
                  return p !== 'removed';
                })
                  .map((t) => t.name)
                  .join(', '),
            };
          }
          return { result: permCheck.reason || 'Tool nicht erlaubt.' };
        }
      }

      const wrapResult = (res: { result: string; inlineTodos?: InlineTodo[] }) => ({
        ...res,
        result: truncateToolResult(res.result || '', MAX_TOOL_RESULT_LENGTH),
      });

      try {
        switch (name) {
          case 'ask_user_question':
          case 'ask_question':
          case 'ask_clarification': {
            const req = buildSubAgentQuestionRequestFromTool(args);
            setPendingSubAgentQuestion(req);
            const relayResult = await new Promise<string>((resolve) => {
              pendingQuestionResolverRef.current = resolve;
            });
            return wrapResult({ result: relayResult });
          }
          case 'get_active_tools': {
            const activeLearning = isLearningEnabled(settingsRef.current);
            const available = TOOL_DEFINITIONS.filter((t) => {
              if (!activeLearning && isLearningTool(t.name)) return false;
              const p = getToolPermission(t.name);
              return p !== 'removed' && p !== 'blocked';
            }).map((t) => t.name);
            return wrapResult({ result: 'Active tools: ' + available.join(', ') });
          }
          case 'localize_code_graph': {
            if (!args?.query) return { result: 'ERROR: query parameter is required.' };
            const activeLearning = isLearningEnabled(settingsRef.current);
            const graph = buildSynapseGraph({
              project: currentProject,
              memos: activeLearning ? memos : [],
              skills: discoveredSkills,
            });
            const loc = localizeCodeSubgraph(graph, String(args.query), Number(args.max_nodes) || 12);
            return wrapResult({ result: loc.summaryMarkdown });
          }
          case 'sub_agent': {
            const roleOrId = String(args?.role || 'developer').trim();
            const taskDesc = String(args?.task || '').trim();
            if (!taskDesc) {
              const req = buildSubAgentQuestionRequestFromTool(
                {
                  is_sub_agent: true,
                  sub_agent_role: roleOrId,
                  questions: [
                    'Which role should the Sub-Agent take (developer, localizer, analyst, researcher, tester, critic)?',
                    'What concrete task should be assigned to this Sub-Agent?',
                  ],
                },
                undefined,
                'sub_agent',
              );
              setPendingSubAgentQuestion(req);
              const relayResult = await new Promise<string>((resolve) => {
                pendingQuestionResolverRef.current = resolve;
              });
              return wrapResult({ result: relayResult });
            }
            let matchedTemplate =
              customSubAgents.find(
                (t) =>
                  t.id.toLowerCase() === roleOrId.toLowerCase() ||
                  t.name.toLowerCase() === roleOrId.toLowerCase() ||
                  t.role.toLowerCase() === roleOrId.toLowerCase(),
              );

            if (!matchedTemplate) {
              // Persist newly invoked Sub-Agent role into the saved Sub-Agent list automatically
              const autoSaved: any = {
                id: 'tpl_saved_' + roleOrId.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now().toString(36).slice(-4),
                name: `${roleOrId.charAt(0).toUpperCase() + roleOrId.slice(1)} Sub-Agent`,
                role: roleOrId.toLowerCase(),
                description: taskDesc.slice(0, 140),
                systemPrompt: `You are a specialized ${roleOrId} Sub-Agent. Complete the delegated task accurately.`,
                rules: ['Always read files before modifying them.', 'Stay within allowed file scope.'],
                allowedTools: ['read_file', 'read_lines', 'list_directory', 'search_files', 'get_project_tree', 'localize_code_graph', 'write_file', 'edit_file', 'think'],
                allowedFiles: ['*'],
                canBeCalledByAI: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              saveSubAgentTemplate(autoSaved);
              matchedTemplate = autoSaved;
            }

            const resolvedAuth = resolveEffectiveProviderAndKey();

            const allowedToolNames = matchedTemplate?.allowedTools || [
              'read_file',
              'read_lines',
              'list_directory',
              'search_files',
              'get_project_tree',
              'localize_code_graph',
              'think',
            ];
            const subTools = TOOL_DEFINITIONS.filter(
              (t) => t.name !== 'sub_agent' && allowedToolNames.includes(t.name),
            );

            const subSystemPrompt =
              `You are a specialized Sub-Agent: ${matchedTemplate?.name || roleOrId}.\n` +
              `${matchedTemplate?.systemPrompt || 'Complete the delegated task accurately.'}\n` +
              (matchedTemplate?.rules?.length
                ? `Rules:\n${matchedTemplate.rules.map((r) => `- ${r}`).join('\n')}\n`
                : '') +
              `Allowed file patterns: ${(matchedTemplate?.allowedFiles || ['*']).join(', ')}\n` +
              `Project tree:\n${truncateToolResult(getProjectTree(), 2500)}`;

            let subMsgs: ChatMessage[] = [
              { id: genId(), role: 'user', content: taskDesc, timestamp: Date.now() },
            ];
            const fallbackSettings = settingsRef.current.autoFallback
              ? getFallbackSettings()
              : undefined;

            for (let step = 0; step < 4; step++) {
              const subResp = await callAI(
                resolvedAuth.provider,
                resolvedAuth.apiKey || 'rork_builtin',
                resolvedAuth.model,
                compressAndSanitizeMessagesForAPI(subMsgs, { maxToolLength: 4000 }),
                subTools,
                subSystemPrompt,
                settingsRef.current.customEndpoint || undefined,
                fallbackSettings,
              );
              if (subResp.tokenUsage) {
                recordPoolTokenUsage(subResp.tokenUsage, resolvedAuth.poolKeyId, taskDesc);
              }
              if (!subResp.toolCalls || subResp.toolCalls.length === 0) {
                return wrapResult({
                  result: `[Sub-Agent ${matchedTemplate?.name || roleOrId} Output]:\n${subResp.content || 'Completed.'}`,
                });
              }
              const subTcList: ToolCall[] = subResp.toolCalls.map((tc) => ({
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments || {},
                status: 'running',
                ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
                ...(tc.extra_content ? { extra_content: tc.extra_content } : {}),
              }));
              subMsgs.push({
                id: genId(),
                role: 'assistant',
                content: subResp.content || '',
                toolCalls: subTcList,
                timestamp: Date.now(),
              });
              for (const stc of subTcList) {
                const subExec = await executeManualTool(
                  stc.name,
                  stc.arguments,
                  matchedTemplate?.allowedFiles,
                );
                stc.result = subExec.result;
                stc.status = subExec.result.startsWith('ERROR') ? 'error' : 'completed';
                subMsgs.push({
                  id: genId(),
                  role: 'tool',
                  content: subExec.result,
                  toolCallId: stc.id,
                  toolName: stc.name,
                  timestamp: Date.now(),
                });
              }
            }
            const lastSubAssistant = [...subMsgs].reverse().find((m) => m.role === 'assistant');
            return wrapResult({
              result: `[Sub-Agent ${matchedTemplate?.name || roleOrId} Summary]:\n${lastSubAssistant?.content || 'Task finished.'}`,
            });
          }
          case 'propose_agent_mode': {
            return {
              result:
                'Tip: Click the "Create!" button or switch to Agent Mode for this complex task: ' +
                (args?.reason || ''),
            };
          }
          case 'read_file': {
            if (!args?.path) return { result: 'ERROR: No file path provided.' };
            const content = getFileContent(args.path);
            if (content === null)
              return { result: 'ERROR: File "' + args.path + '" nicht gefunden.' };
            return wrapResult({ result: content });
          }
          case 'read_lines': {
            if (!args?.path) return { result: 'ERROR: No file path provided.' };
            const content = getFileContent(args.path);
            if (content === null)
              return { result: 'ERROR: File "' + args.path + '" nicht gefunden.' };
            const lines = content.split('\n');
            const start = Math.max(0, (args.start_line || 1) - 1);
            const end = Math.min(lines.length, args.end_line || lines.length);
            return wrapResult({
              result: lines
                .slice(start, end)
                .map((l: string, i: number) => start + i + 1 + ': ' + l)
                .join('\n'),
            });
          }
          case 'write_file': {
            if (!args?.path) return { result: 'ERROR: No file path provided.' };
            updateFileContent(args.path, args.content ?? '');
            return {
              result:
                'Datei "' +
                args.path +
                '" geschrieben (' +
                (args.content || '').split('\n').length +
                ' Zeilen).',
            };
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
            if (content === null)
              return {
                result: 'ERROR: File "' + args.path + '" not found. Please read with read_file first.',
              };
            if (!content.includes(args.old_text))
              return {
                result:
                  'ERROR: Text not found in "' + args.path + '". Please read the file again.',
              };
            updateFileContent(args.path, content.replace(args.old_text, args.new_text ?? ''));
            return { result: 'File "' + args.path + '" edited.' };
          }
          case 'delete_file': {
            if (!args?.path) return { result: 'ERROR: No file path provided.' };
            deleteFile(args.path);
            return { result: 'File "' + args.path + '" deleted.' };
          }
          case 'rename_file': {
            if (!args?.old_path || !args?.new_path)
              return { result: 'ERROR: old_path and new_path are required.' };
            renameFile(args.old_path, args.new_path);
            return { result: 'Renamed: "' + args.old_path + '" -> "' + args.new_path + '".' };
          }
          case 'list_directory':
            return wrapResult({ result: listDirectory(args?.path || '') });
          case 'search_files': {
            if (!args?.query) return { result: 'ERROR: No search term provided.' };
            return wrapResult({ result: searchFilesInProject(args.query, args.path) });
          }
          case 'find_replace': {
            if (!args?.path) return { result: 'ERROR: No file path provided.' };
            if (!args?.find) return { result: 'ERROR: Search text is missing.' };
            const content = getFileContent(args.path);
            if (content === null) return { result: 'ERROR: File not found.' };
            const count = content.split(args.find).length - 1;
            updateFileContent(
              args.path,
              args.all
                ? content.split(args.find).join(args.replace ?? '')
                : content.replace(args.find, args.replace ?? ''),
            );
            return { result: count + ' occurrences replaced in "' + args.path + '".' };
          }
          case 'create_directory': {
            if (!args?.path) return { result: 'ERROR: No path provided.' };
            createDirectory(args.path);
            return { result: 'Directory "' + args.path + '" created.' };
          }
          case 'get_project_tree':
            return wrapResult({ result: getProjectTree() });
          case 'get_file_info': {
            if (!args?.path) return { result: 'ERROR: No file path provided.' };
            return wrapResult({ result: getFileInfo(args.path) });
          }
          case 'create_todo': {
            if (!args?.text) return { result: 'ERROR: Todo text is missing.' };
            const id = addTodo(args.text);
            return {
              result: 'Todo created (ID: ' + id + ')',
              inlineTodos: [{ id, text: args.text, completed: false }],
            };
          }
          case 'update_todo': {
            if (!args?.id) return { result: 'ERROR: Todo ID is missing.' };
            updateTodoItem(args.id, args.completed, args.text);
            return { result: 'Todo "' + args.id + '" updated.' };
          }
          case 'add_memo': {
            if (!isLearningEnabled(settingsRef.current))
              return { result: 'ERROR: Learning and memo tools are disabled.' };
            if (!args?.content) return { result: 'ERROR: Memo content is missing.' };
            addMemo(args.content);
            return { result: 'Memo saved.' };
          }
          case 'think':
            return { result: 'Thought process recorded.' };
          case 'read_identity_files': {
            if (!isLearningEnabled(settingsRef.current))
              return { result: 'ERROR: Learning and identity tools are disabled.' };
            let output = '';
            output += '## SOUL.md\n' + (soulMd || '(empty)') + '\n\n';
            output += '## AGENTS.md\n' + (agentMd || '(empty)') + '\n\n';
            output += '## IDENTITY.md\n' + (identityMd || '(empty)') + '\n\n';
            output += '## USER.md\n' + (userMd || '(empty)') + '\n\n';
            output += '## MEMORY.md\n' + (memoryMd || '(empty)');
            return wrapResult({ result: output });
          }
          case 'update_soul_md': {
            if (!isLearningEnabled(settingsRef.current))
              return { result: 'ERROR: Learning and identity tools are disabled.' };
            if (!args?.content) return { result: 'ERROR: No content provided.' };
            setSoulMd(args.content);
            return { result: 'SOUL.md updated (' + args.content.split('\n').length + ' lines).' };
          }
          case 'update_agents_md': {
            if (!isLearningEnabled(settingsRef.current))
              return { result: 'ERROR: Learning and identity tools are disabled.' };
            if (!args?.content) return { result: 'ERROR: No content provided.' };
            setAgentMd(args.content);
            return { result: 'AGENTS.md updated (' + args.content.split('\n').length + ' lines).' };
          }
          case 'update_identity_md': {
            if (!isLearningEnabled(settingsRef.current))
              return { result: 'ERROR: Learning and identity tools are disabled.' };
            if (!args?.content) return { result: 'ERROR: No content provided.' };
            setIdentityMd(args.content);
            return {
              result: 'IDENTITY.md updated (' + args.content.split('\n').length + ' lines).',
            };
          }
          case 'update_user_md': {
            if (!isLearningEnabled(settingsRef.current))
              return { result: 'ERROR: Learning and identity tools are disabled.' };
            if (!args?.content) return { result: 'ERROR: No content provided.' };
            setUserMd(args.content);
            return { result: 'USER.md updated (' + args.content.split('\n').length + ' lines).' };
          }
          case 'update_memory_md': {
            if (!isLearningEnabled(settingsRef.current))
              return { result: 'ERROR: Learning and identity tools are disabled.' };
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
              return { result: 'ERROR: ' + (e?.message || 'Network error') };
            }
          }
          case 'web_fetch': {
            if (!args?.url) return { result: 'ERROR: URL is missing.' };
            try {
              const result = await performWebFetch(
                args.url,
                Math.min(args.max_length || MAX_TOOL_RESULT_LENGTH, MAX_TOOL_RESULT_LENGTH),
              );
              return wrapResult({ result });
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
    },
    [
      currentProject,
      discoveredSkills,
      customSubAgents,
      saveSubAgentTemplate,
      resolveEffectiveProviderAndKey,
      recordPoolTokenUsage,
      getFallbackSettings,
      getFileContent,
      updateFileContent,
      createFile,
      deleteFile,
      renameFile,
      createDirectory,
      searchFilesInProject,
      getProjectTree,
      listDirectory,
      getFileInfo,
      addTodo,
      updateTodoItem,
      addMemo,
      memos,
      checkToolPermission,
      getToolPermission,
      agentMd,
      soulMd,
      identityMd,
      userMd,
      memoryMd,
      setAgentMd,
      setSoulMd,
      setIdentityMd,
      setUserMd,
      setMemoryMd,
    ],
  );

  const runManualLoop = useCallback(
    async (userText: string, attachedFiles: string[] = [], baseMessages?: ChatMessage[]) => {
      abortRef.current = false;
      const currentMessages = baseMessages ?? manualMessagesRef.current;
      const userMsg: ChatMessage = {
        id: genId(),
        role: 'user',
        content: userText,
        timestamp: Date.now(),
      };
      const hasTrailingUserMsg =
        currentMessages.length > 0 &&
        currentMessages[currentMessages.length - 1].role === 'user' &&
        currentMessages[currentMessages.length - 1].content === userText;
      const newMessages = hasTrailingUserMsg
        ? [...currentMessages]
        : [...currentMessages, userMsg];
      manualMessagesRef.current = newMessages;
      setManualMessages(newMessages);
      setManualLoading(true);
      setIsThinking(true);
      setThinkingPhase('Analyzing request...');

      try {
        const resolvedAuth = resolveEffectiveProviderAndKey();

        const effectiveProvider = resolvedAuth.provider;
        const apiKey = resolvedAuth.apiKey;
        const safeModel = resolveDefaultModel(effectiveProvider, resolvedAuth.model);

        if (!apiKey && effectiveProvider !== 'rork' && effectiveProvider !== 'custom') {
          throw new Error(
            'No API key configured. Open "AI for Free" in Settings or select "Studio AI ★ Free".',
          );
        }

        const mentionedFiles = attachedFiles.map((path) => ({
          path,
          content: truncateToolResult(
            getFileContent(path) || '(not found)',
            MAX_TOOL_RESULT_LENGTH,
          ),
        }));

        const activeLearning = isLearningEnabled(settings);
        const yamlSkillsBlock = buildActiveSkillsPromptBlock(discoveredSkills);
        const customAgentsBlock =
          customSubAgents.length > 0
            ? '\n## Available Custom Sub-Agent Templates (callable via sub_agent tool)\n' +
              customSubAgents
                .map(
                  (ag) =>
                    `- **${ag.name}** (role: \`${ag.role}\`): ${ag.description} [Allowed files: ${ag.allowedFiles.join(', ')}]`,
                )
                .join('\n') +
              '\n'
            : '';

        const systemPrompt =
          buildSystemPrompt({
            persona: settings.persona,
            projectTree: getProjectTree(),
            memos: activeLearning ? memos : [],
            todos,
            mentionedFiles,
            yoloMode: settings.yoloMode,
            agentMd: activeLearning ? getFileContent('.agents/AGENT.md') || agentMd : undefined,
            soulMd: activeLearning ? getFileContent('.agents/SOUL.md') || soulMd : undefined,
            identityMd: activeLearning
              ? getFileContent('.agents/IDENTITY.md') || identityMd
              : undefined,
            userMd: activeLearning ? getFileContent('.agents/USER.md') || userMd : undefined,
            memoryMd: activeLearning ? getFileContent('.agents/MEMORY.md') || memoryMd : undefined,
            betaAgentLearning: activeLearning,
            learningEnabled: activeLearning,
            toolPermissions: settings.toolPermissions,
          }) +
          yamlSkillsBlock +
          customAgentsBlock;

        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
        let conversationHistory = compressAndSanitizeMessagesForAPI(newMessages, {
          maxToolLength: MAX_TOOL_RESULT_LENGTH,
        });
        let iterations = 0;
        const maxIterations = 15;
        let collectedTodos: InlineTodo[] = [];

        const filteredTools = TOOL_DEFINITIONS.filter((t) => {
          if (!activeLearning && isLearningTool(t.name)) return false;
          if (!settings.yoloMode) {
            if (t.name === 'web_search' && !settings.betaWebSearch) return false;
            if (t.name === 'web_fetch' && !settings.betaWebFetch) return false;
          }
          const perm = getToolPermission(t.name);
          if (perm === 'removed') return false;
          return true;
        });

        while (iterations < maxIterations && !abortRef.current) {
          iterations++;
          setThinkingPhase(
            iterations === 1 ? 'AI is thinking...' : 'Processing tool results...',
          );

          const response = await callAI(
            effectiveProvider,
            apiKey || 'rork_builtin',
            safeModel,
            conversationHistory,
            filteredTools,
            systemPrompt,
            settings.customEndpoint || undefined,
            fallbackSettings,
          );

          if (response.tokenUsage) {
            recordPoolTokenUsage(
              response.tokenUsage,
              resolvedAuth.poolKeyId,
              userText,
            );
          }

          if (response.usedFallback) {
            setLastFallbackInfo(
              'Automatically switched to ' + (response.fallbackProvider || 'Fallback'),
            );
          } else if (resolvedAuth.poolKeyId) {
            setLastFallbackInfo(`Using Shared Free Pool Key (${effectiveProvider.toUpperCase()})`);
          }

          setIsThinking(false);
          const { thinking, cleanContent } = parseThinkingFromContent(response.content || '');

          const validToolCalls = (response.toolCalls || []).filter(
            (tc) => activeLearning || !isLearningTool(tc.name),
          );

          if (validToolCalls.length === 0) {
            const assistantMsg: ChatMessage = {
              id: genId(),
              role: 'assistant',
              content: cleanContent,
              timestamp: Date.now(),
              thinking: thinking || undefined,
              todos: collectedTodos.length > 0 ? [...collectedTodos] : undefined,
            };
            conversationHistory = [...conversationHistory, assistantMsg];
            manualMessagesRef.current = conversationHistory;
            setManualMessages([...conversationHistory]);

            // If the user asked to start/configure a Sub-Agent and the AI replied with Sub-Agent questions,
            // launch the Floating Sub-Agent Window automatically so answers relay back to the Main Creator AI.
            const detectedSubAgentQuestion = detectSubAgentQuestionFromTurn(userText, cleanContent);
            if (detectedSubAgentQuestion) {
              setPendingSubAgentQuestion(detectedSubAgentQuestion);
            }
            break;
          }

          const toolCalls: ToolCall[] = validToolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments ?? {},
            status: 'running' as const,
            ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
            ...(tc.extra_content ? { extra_content: tc.extra_content } : {}),
          }));

          const thinkToolCalls = toolCalls.filter((tc) => tc.name === 'think');
          let thinkingContent = thinking;
          for (const ttc of thinkToolCalls) {
            if (ttc.arguments?.thought) {
              thinkingContent += (thinkingContent ? '\n\n' : '') + ttc.arguments.thought;
            }
          }

          const assistantMsg: ChatMessage = {
            id: genId(),
            role: 'assistant',
            content: cleanContent,
            toolCalls,
            timestamp: Date.now(),
            thinking: thinkingContent || undefined,
          };
          conversationHistory = [...conversationHistory, assistantMsg];
          manualMessagesRef.current = conversationHistory;
          setManualMessages([...conversationHistory]);

          setThinkingPhase('Executing tools...');

          const toolResultMessages: ChatMessage[] = [];
          for (const tc of toolCalls) {
            if (abortRef.current) break;
            tc.status = 'running';
            setManualMessages([...conversationHistory, ...toolResultMessages]);

            const { result, inlineTodos } = await executeManualTool(tc.name, tc.arguments);
            const safeResult = truncateToolResult(result, MAX_TOOL_RESULT_LENGTH);
            tc.result = safeResult;
            tc.status = safeResult.startsWith('ERROR') ? 'error' : 'completed';
            if (inlineTodos) collectedTodos = [...collectedTodos, ...inlineTodos];

            toolResultMessages.push({
              id: genId(),
              role: 'tool',
              content: safeResult,
              toolCallId: tc.id,
              toolName: tc.name,
              timestamp: Date.now(),
            });
          }

          conversationHistory = compressAndSanitizeMessagesForAPI(
            [...conversationHistory, ...toolResultMessages],
            { maxToolLength: MAX_TOOL_RESULT_LENGTH },
          );
          manualMessagesRef.current = conversationHistory;
          setManualMessages([...conversationHistory]);
        }

        if (iterations >= maxIterations) {
          setManualMessages((prev) => {
            const next = [
              ...prev,
              {
                id: genId(),
                role: 'assistant' as const,
                content: 'Maximum iterations reached.',
                timestamp: Date.now(),
              },
            ];
            manualMessagesRef.current = next;
            return next;
          });
        }
      } catch (e: any) {
        console.log('[Chat] Error:', e);
        setManualMessages((prev) => {
          const next = [
            ...prev,
            {
              id: genId(),
              role: 'assistant' as const,
              content: '❌ ' + (e?.message || 'Unknown error'),
              timestamp: Date.now(),
            },
          ];
          manualMessagesRef.current = next;
          return next;
        });
        setError(e?.message || 'Error');
      } finally {
        setManualLoading(false);
        setIsThinking(false);
        setThinkingPhase('');
      }
    },
    [
      settings,
      resolveEffectiveProviderAndKey,
      recordPoolTokenUsage,
      discoveredSkills,
      customSubAgents,
      getFallbackSettings,
      getFileContent,
      getProjectTree,
      memos,
      todos,
      executeManualTool,
      getToolPermission,
      agentMd,
      soulMd,
      identityMd,
      userMd,
      memoryMd,
    ],
  );

  const sendMessage = useCallback(
    async (userText: string, attachedFiles: string[] = []) => {
      if (!userText.trim() && attachedFiles.length === 0) return;

      triggerSponsorInteraction();
      setError(null);
      setLastFallbackInfo(null);

      await runManualLoop(userText, attachedFiles);
    },
    [triggerSponsorInteraction, runManualLoop],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    if (pendingApproval) {
      pendingApproval.resolve(false);
    }
    setManualLoading(false);
    setIsThinking(false);
  }, [pendingApproval]);

  const clearChat = useCallback(() => {
    manualMessagesRef.current = [];
    setManualMessages([]);
    setError(null);
    setLastFallbackInfo(null);
  }, []);

  const startNewChat = useCallback(() => {
    const currentMsgs = manualMessagesRef.current;
    if (currentMsgs.length > 0) {
      const next: ChatMessage[] = [
        {
          id: genId(),
          role: 'assistant',
          content: '---\n\n**New chat started.**\n\n---',
          timestamp: Date.now(),
        },
      ];
      manualMessagesRef.current = next;
      setManualMessages(next);
    }
    setError(null);
    setLastFallbackInfo(null);
  }, []);

  const compressChat = useCallback(async (): Promise<string | null> => {
    const currentMsgs = manualMessagesRef.current;
    if (currentMsgs.length < 4) return null;

    const transcript = currentMsgs
      .filter((m) => m.role !== 'tool')
      .map((m) => {
        const prefix = m.role === 'user' ? 'User' : 'AI';
        const toolInfo = m.toolCalls?.length
          ? ' [Tools: ' +
            m.toolCalls.map((t) => t.name + (t.status === 'error' ? '(ERROR)' : '')).join(', ') +
            ']'
          : '';
        return prefix + ': ' + (m.content || '').slice(0, 300) + toolInfo;
      })
      .join('\n');

    try {
      const resolvedAuth = resolveEffectiveProviderAndKey();
      const apiKey = resolvedAuth.apiKey || getApiKey();
      if (apiKey || resolvedAuth.provider === 'rork') {
        const compressPrompt =
          'Summarize the following conversation in max. 500 words. ' +
          'Keep: All important decisions, created/changed files, open tasks, user preferences. ' +
          'Remove: Repetitions, tool details, intermediate steps. ' +
          'Reply ONLY with the summary, no other text.\n\n' +
          transcript.slice(0, 8000);

        const compressMsg: ChatMessage[] = [
          {
            id: genId(),
            role: 'user',
            content: compressPrompt,
            timestamp: Date.now(),
          },
        ];

        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
        const response = await callAI(
          resolvedAuth.provider as AIProviderType,
          apiKey || 'rork_builtin',
          resolvedAuth.model || settings.selectedModel,
          compressMsg,
          [],
          'You are a summarization assistant. Summarize conversations precisely. Reply in English.',
          settings.customEndpoint || undefined,
          fallbackSettings,
        );

        if (response.tokenUsage) {
          recordPoolTokenUsage(response.tokenUsage, resolvedAuth.poolKeyId);
        }

        if (response.content && response.content.trim().length > 50) {
          return response.content.trim();
        }
      }
    } catch (e: any) {
      console.log('[Chat] AI compression failed, using fallback:', e?.message);
    }

    return transcript.slice(0, 3000);
  }, [settings, resolveEffectiveProviderAndKey, recordPoolTokenUsage, getApiKey, getFallbackSettings]);

  const applyChatCompression = useCallback((summary: string) => {
    const currentSize = JSON.stringify(manualMessagesRef.current).length;
    const newSize = summary.length + 100;

    if (newSize >= currentSize) {
      console.log('[Chat] Compression aborted: new size >= old size');
      return false;
    }

    const summaryMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: '[Summary of the conversation so far]\n\n' + summary,
      timestamp: Date.now(),
    };

    manualMessagesRef.current = [summaryMsg];
    setManualMessages([summaryMsg]);
    return true;
  }, []);

  const messages = manualMessages;
  const isLoading = manualLoading;

  // Strictly true ONLY when the AI explicitly invoked the question tool (`ask_user_question`),
  // NEVER from a normal plain-text message ending in `?`.
  const hasPendingChatQuestions = useMemo(() => {
    if (isLoading) return false;
    return hasExplicitQuestionToolCall(messages, pendingSubAgentQuestion);
  }, [isLoading, messages, pendingSubAgentQuestion]);

  const openSubAgentFloatingLauncher = useCallback(
    (preset?: { role?: string; name?: string; task?: string; questions?: string[] }) => {
      const req = buildSubAgentQuestionRequestFromTool(
        {
          is_sub_agent: true,
          sub_agent_role: preset?.role || 'developer',
          sub_agent_name: preset?.name || '',
          task: preset?.task || '',
          questions: preset?.questions || [
            'What role should the Sub-Agent have (e.g., localizer, developer, analyst, critic)?',
            'What concrete task should be assigned to this Sub-Agent?',
          ],
        },
        undefined,
        'sub_agent',
      );
      setPendingSubAgentQuestion(req);
    },
    [],
  );

  const submitSubAgentQuestionResponse = useCallback(
    (response: SubAgentQuestionResponse) => {
      const currentReq = pendingSubAgentQuestion;
      if (!currentReq) return;

      let savedTemplate = null;
      if (response.saveToSubAgentList) {
        savedTemplate = createSavedSubAgentFromQuestionResponse(currentReq, response);
        saveSubAgentTemplate(savedTemplate);
      }

      const relayPrompt = buildMainCreatorRelayPrompt(currentReq, response, savedTemplate);
      setPendingSubAgentQuestion(null);

      if (pendingQuestionResolverRef.current) {
        const resolver = pendingQuestionResolverRef.current;
        pendingQuestionResolverRef.current = null;
        resolver(relayPrompt);
      } else {
        sendMessage(relayPrompt);
      }
    },
    [pendingSubAgentQuestion, saveSubAgentTemplate, sendMessage],
  );

  const closeSubAgentQuestionModal = useCallback(() => {
    setPendingSubAgentQuestion(null);
    if (pendingQuestionResolverRef.current) {
      const resolver = pendingQuestionResolverRef.current;
      pendingQuestionResolverRef.current = null;
      resolver('User closed the question window. Proceed with best-practice assumptions.');
    }
  }, []);

  const skipClarificationQuestions = useCallback(() => {
    if (pendingSubAgentQuestion) {
      submitSubAgentQuestionResponse({
        requestId: pendingSubAgentQuestion.id,
        subAgentName: pendingSubAgentQuestion.subAgentName,
        subAgentRole: pendingSubAgentQuestion.subAgentRole,
        taskInstruction: pendingSubAgentQuestion.suggestedTask,
        allowedFiles: pendingSubAgentQuestion.allowedFiles,
        answers: [],
        saveToSubAgentList: pendingSubAgentQuestion.saveToSubAgentList,
        skipped: true,
      });
      return;
    }
    sendMessage(SKIP_QUESTIONS_INSTRUCTION);
  }, [pendingSubAgentQuestion, submitSubAgentQuestionResponse, sendMessage]);

  return {
    messages,
    isLoading,
    isThinking,
    thinkingPhase,
    error,
    lastFallbackInfo,
    sendMessage,
    stopGeneration,
    clearChat,
    startNewChat,
    compressChat,
    applyChatCompression,
    pendingApproval,
    approvePendingTool,
    hasPendingChatQuestions,
    skipClarificationQuestions,
    pendingSubAgentQuestion,
    openSubAgentFloatingLauncher,
    submitSubAgentQuestionResponse,
    closeSubAgentQuestionModal,
  };
});
