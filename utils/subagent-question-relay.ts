import { ChatMessage, ToolCall } from '@/types';
import { CustomSubAgentTemplate } from '@/utils/skill-loader';

export const QUESTION_TOOL_NAMES = [
  'ask_user_question',
  'ask_question',
  'ask_clarification',
] as const;

export interface SubAgentQuestionItem {
  id: string;
  question: string;
  answer: string;
  placeholder?: string;
}

export interface SubAgentQuestionRequest {
  id: string;
  source: 'sub_agent' | 'main_agent';
  toolCallId?: string;
  subAgentName: string;
  subAgentRole: string;
  suggestedTask: string;
  allowedFiles: string[];
  questions: SubAgentQuestionItem[];
  saveToSubAgentList: boolean;
  createdAt: number;
}

export interface SubAgentQuestionResponse {
  requestId: string;
  subAgentName: string;
  subAgentRole: string;
  taskInstruction: string;
  allowedFiles: string[];
  answers: { question: string; answer: string }[];
  saveToSubAgentList: boolean;
  skipped: boolean;
}

export function isQuestionToolName(toolName?: string | null): boolean {
  if (!toolName) return false;
  const normalized = toolName.trim().toLowerCase();
  return (QUESTION_TOOL_NAMES as readonly string[]).includes(normalized);
}

/**
 * Strictly checks whether the AI explicitly invoked the dedicated question tool
 * (`ask_user_question` / `ask_question` / `ask_clarification`) in the latest assistant turn.
 *
 * CRITICAL: Plain-text assistant messages that happen to contain a `?` character
 * MUST NEVER trigger the "KI-Rückfragen offen / Überspringen & Direkt starten (Skip)" banner.
 */
export function hasExplicitQuestionToolCall(
  messages: ChatMessage[],
  activePendingQuestion?: SubAgentQuestionRequest | null,
): boolean {
  if (
    activePendingQuestion &&
    Boolean(activePendingQuestion.toolCallId) &&
    activePendingQuestion.questions.length > 0
  ) {
    return true;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;
    if (msg.role === 'tool') continue;
    if (msg.role === 'user') {
      return false;
    }
    if (msg.role === 'assistant') {
      if (!Array.isArray(msg.toolCalls) || msg.toolCalls.length === 0) {
        return false;
      }
      return msg.toolCalls.some((tc: ToolCall) => isQuestionToolName(tc?.name));
    }
  }

  return false;
}

/**
 * Extracts structured questions from an `ask_user_question` tool call arguments object.
 */
export function extractQuestionsFromToolArgs(args: Record<string, any> | undefined | null): string[] {
  if (!args || typeof args !== 'object') return [];

  const extracted: string[] = [];

  if (Array.isArray(args.questions)) {
    for (const q of args.questions) {
      if (typeof q === 'string' && q.trim().length > 0) {
        extracted.push(q.trim());
      } else if (q && typeof q === 'object' && typeof q.question === 'string' && q.question.trim().length > 0) {
        extracted.push(q.question.trim());
      }
    }
  }

  if (typeof args.question === 'string' && args.question.trim().length > 0) {
    extracted.push(args.question.trim());
  }

  if (extracted.length === 0 && typeof args.prompt === 'string' && args.prompt.trim().length > 0) {
    extracted.push(args.prompt.trim());
  }

  return extracted;
}

/**
 * Builds a `SubAgentQuestionRequest` whenever the AI calls `ask_user_question`
 * or when a Sub-Agent needs clarification / configuration before running.
 */
export function buildSubAgentQuestionRequestFromTool(
  args: Record<string, any>,
  toolCallId?: string,
  forcedSource?: 'sub_agent' | 'main_agent',
): SubAgentQuestionRequest {
  const rawQuestions = extractQuestionsFromToolArgs(args);
  const role = String(args?.sub_agent_role || args?.role || 'developer').trim().toLowerCase();
  const isSubAgentContext =
    forcedSource === 'sub_agent' ||
    Boolean(args?.is_sub_agent) ||
    Boolean(args?.sub_agent_name) ||
    Boolean(args?.sub_agent_role) ||
    Boolean(args?.role);

  const defaultName =
    String(args?.sub_agent_name || args?.name || '').trim() ||
    `${role.charAt(0).toUpperCase() + role.slice(1)} Sub-Agent`;

  const questions: SubAgentQuestionItem[] =
    rawQuestions.length > 0
      ? rawQuestions.map((q, idx) => ({
          id: `q_${idx}_${Date.now().toString(36)}`,
          question: q,
          answer: '',
        }))
      : [
          {
            id: `q_0_${Date.now().toString(36)}`,
            question: 'What specific task and goal should this Sub-Agent execute?',
            answer: '',
          },
        ];

  const allowedFilesRaw = args?.allowed_files || args?.allowedFiles;
  const allowedFiles: string[] = Array.isArray(allowedFilesRaw)
    ? allowedFilesRaw.map((f: any) => String(f).trim()).filter(Boolean)
    : typeof allowedFilesRaw === 'string' && allowedFilesRaw.trim()
      ? allowedFilesRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['*'];

  return {
    id: 'saq_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
    source: isSubAgentContext ? 'sub_agent' : 'main_agent',
    toolCallId,
    subAgentName: defaultName,
    subAgentRole: role || 'developer',
    suggestedTask: String(args?.task || args?.suggested_task || '').trim(),
    allowedFiles,
    questions,
    saveToSubAgentList: true,
    createdAt: Date.now(),
  };
}

/**
 * Detects if a user asked to start/configure a Sub-Agent and the assistant responded
 * with clarifying questions about the Sub-Agent (even if the model forgot to invoke the tool).
 * Returns a `SubAgentQuestionRequest` to launch the Floating Sub-Agent Window, or `null`.
 */
export function detectSubAgentQuestionFromTurn(
  userText: string,
  assistantContent: string,
): SubAgentQuestionRequest | null {
  const cleanUser = (userText || '').trim().toLowerCase();
  const cleanAssistant = (assistantContent || '').trim();
  if (!cleanUser || !cleanAssistant) return null;

  const mentionsSubAgentInUser =
    cleanUser.includes('subagent') ||
    cleanUser.includes('sub-agent') ||
    cleanUser.includes('sub agent') ||
    cleanUser.includes('unteragent');

  const mentionsSubAgentInAssistant =
    cleanAssistant.toLowerCase().includes('sub-agent') ||
    cleanAssistant.toLowerCase().includes('subagent') ||
    cleanAssistant.toLowerCase().includes('unteragent');

  if (!mentionsSubAgentInUser && !mentionsSubAgentInAssistant) {
    return null;
  }

  if (!cleanAssistant.includes('?')) {
    return null;
  }

  const lines = cleanAssistant
    .split(/\n|(?<=\?)\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 6 && l.includes('?'));

  if (lines.length === 0) return null;

  return {
    id: 'saq_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
    source: 'sub_agent',
    subAgentName: 'Custom Specialist Sub-Agent',
    subAgentRole: 'developer',
    suggestedTask: '',
    allowedFiles: ['*'],
    questions: lines.slice(0, 4).map((q, idx) => ({
      id: `q_${idx}_${Date.now().toString(36)}`,
      question: q.replace(/^[-*•\d.)\s]+/, '').trim(),
      answer: '',
    })),
    saveToSubAgentList: true,
    createdAt: Date.now(),
  };
}

/**
 * Converts the user's Floating Window response into a persistent `CustomSubAgentTemplate`
 * so the Sub-Agent is saved and displayed in the user's Sub-Agent list.
 */
export function createSavedSubAgentFromQuestionResponse(
  request: SubAgentQuestionRequest,
  response: SubAgentQuestionResponse,
): CustomSubAgentTemplate {
  const now = Date.now();
  const cleanRole = (response.subAgentRole || request.subAgentRole || 'developer').trim().toLowerCase();
  const cleanName =
    (response.subAgentName || request.subAgentName || '').trim() ||
    `${cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1)} Sub-Agent`;

  const answeredContext = response.answers
    .filter((a) => a.answer && a.answer.trim().length > 0)
    .map((a) => `Q: ${a.question} -> A: ${a.answer.trim()}`)
    .join('\n');

  const effectiveTask =
    response.taskInstruction.trim() ||
    request.suggestedTask.trim() ||
    (answeredContext ? `Execute according to user specifications:\n${answeredContext}` : `Specialized ${cleanRole} task execution`);

  const roleToolMap: Record<string, string[]> = {
    analyst: ['read_file', 'read_lines', 'list_directory', 'search_files', 'get_project_tree', 'localize_code_graph', 'think'],
    localizer: ['read_file', 'read_lines', 'list_directory', 'search_files', 'get_project_tree', 'localize_code_graph', 'think'],
    researcher: ['web_search', 'web_fetch', 'read_file', 'search_files', 'localize_code_graph', 'think'],
    tester: ['read_file', 'read_lines', 'search_files', 'verify_file', 'edit_file', 'write_file', 'think'],
    critic: ['read_file', 'read_lines', 'search_files', 'localize_code_graph', 'verify_file', 'think'],
    developer: ['read_file', 'read_lines', 'write_file', 'create_file', 'edit_file', 'search_files', 'localize_code_graph', 'verify_file', 'think'],
  };

  const allowedTools = roleToolMap[cleanRole] || roleToolMap.developer;

  return {
    id: 'tpl_saved_' + cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + now.toString(36).slice(-4),
    name: cleanName,
    role: cleanRole,
    description: effectiveTask.slice(0, 160),
    systemPrompt:
      `You are the "${cleanName}" (${cleanRole.toUpperCase()}) Sub-Agent.\n` +
      `Primary Mission: ${effectiveTask}\n` +
      (answeredContext ? `\nClarified User Context:\n${answeredContext}\n` : '') +
      `Follow all project rules and stay strictly within your allowed file patterns.`,
    rules: [
      'Always read files with read_file before modifying them.',
      'Stay strictly within allowed file patterns.',
      'Provide a concise summary back to the Main Creator Agent upon completion.',
    ],
    allowedTools,
    allowedFiles: response.allowedFiles.length > 0 ? response.allowedFiles : ['*'],
    canBeCalledByAI: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Formats the information collected in the Sub-Agent Floating Window so it is
 * relayed directly back to the Main Creator AI (`Main-Ersteller`).
 */
export function buildMainCreatorRelayPrompt(
  request: SubAgentQuestionRequest,
  response: SubAgentQuestionResponse,
  savedTemplate?: CustomSubAgentTemplate | null,
): string {
  const role = (response.subAgentRole || request.subAgentRole || 'developer').trim();
  const name = savedTemplate?.name || response.subAgentName || request.subAgentName || 'Sub-Agent';
  const files = (response.allowedFiles.length > 0 ? response.allowedFiles : ['*']).join(', ');

  if (response.skipped) {
    return (
      `[Sub-Agent Floating Window Relay -> Main Creator Agent]\n` +
      `Sub-Agent: "${name}" (role: ${role}, saved in Sub-Agent List: ${savedTemplate ? 'Yes' : 'No'})\n` +
      `Allowed Files: ${files}\n` +
      `Task: ${response.taskInstruction || request.suggestedTask || 'Execute with best-practice defaults'}\n` +
      `Note: Clarification questions were skipped by user. Assume sensible best-practice defaults and immediately delegate/execute via the sub_agent tool.`
    );
  }

  const formattedAnswers = response.answers
    .map((qa, i) => `${i + 1}. Question: ${qa.question}\n   User Answer: ${qa.answer?.trim() || 'Use best-practice default'}`)
    .join('\n');

  return (
    `[Sub-Agent Floating Window Relay -> Main Creator Agent]\n` +
    `Configured & Saved Sub-Agent: "${name}" (ID: ${savedTemplate?.id || 'custom'}, Role: ${role})\n` +
    `Allowed File Scope: ${files}\n` +
    (response.taskInstruction.trim() ? `Assigned Task: ${response.taskInstruction.trim()}\n` : '') +
    `User Answers from Sub-Agent Floating Window:\n${formattedAnswers}\n\n` +
    `Instruction for Main Creator Agent: Use this information immediately and invoke the "sub_agent" tool with role="${role}" to execute the task.`
  );
}
