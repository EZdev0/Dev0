export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileNode[];
}

export interface Project {
  id: string;
  name: string;
  projectType: string;
  files: FileNode[];
  createdAt: number;
  updatedAt: number;
}

import { ChatZipArtifact } from '@/utils/chat-zip';
export type { ChatZipArtifact };

export interface DraftedPlanStep {
  id: string;
  title: string;
  description: string;
  role?: string;
  agentRole?: string;
}

export interface DraftedAgentPlan {
  id: string;
  title: string;
  summary: string;
  steps: DraftedPlanStep[];
  targetFiles?: string[];
  createdAt: number;
  status?: 'draft' | 'approved' | 'launched';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  timestamp: number;
  thinking?: string;
  isThinking?: boolean;
  todos?: InlineTodo[];
  zipArtifact?: ChatZipArtifact;
  draftPlan?: DraftedAgentPlan;
}

export interface InlineTodo {
  id: string;
  text: string;
  completed: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  thoughtSignature?: string;
  extra_content?: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export type ToolPermission = 'always' | 'ask' | 'blocked' | 'removed';

export interface ToolPermissionEntry {
  name: string;
  permission: ToolPermission;
}

export interface AppSettings {
  openaiKey: string;
  anthropicKey: string;
  geminiKey: string;
  groqKey: string;
  openrouterKey: string;
  nvidiaKey: string;
  customEndpoint: string;
  customKey: string;
  selectedProvider: string;
  selectedModel: string;
  fontSize: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
  yoloMode: boolean;
  persona: string;
  autoRetry: boolean;
  autoFallback: boolean;
  betaHtmlPreview: boolean;
  betaWebSearch: boolean;
  betaWebFetch: boolean;
  betaAgentLearning: boolean;
  learningEnabled?: boolean;
  memoEnabled?: boolean;
  betaSuperAgent: boolean;
  agentMode: boolean;
  hideSponsor: boolean;
  toolPermissions: Record<string, ToolPermission>;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface MemoEntry {
  id: string;
  content: string;
  createdAt: number;
  tags?: string[];
  relatedFiles?: string[];
}

export type AgentTaskStatus = 'draft' | 'pending' | 'running' | 'completed' | 'error' | 'cancelled';

export type AgentTaskType = 'task' | 'thinking' | 'brainstorm' | 'question' | 'web_search' | 'sub_agent';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: AgentTaskStatus;
  taskType: AgentTaskType;
  subAgentMessages: ChatMessage[];
  result?: string;
  thinkingContent?: string;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
  isSubAgentTask?: boolean;
  parentTaskId?: string;
  agentRole?: 'analyst' | 'developer' | 'tester' | 'researcher' | 'localizer' | 'critic';
}

export interface AgentToolUsage {
  name: string;
  count: number;
  status: 'completed' | 'error' | 'mixed';
}

export interface PendingToolApproval {
  id: string;
  toolName: string;
  toolDisplayName: string;
  arguments: Record<string, any>;
  resolve: (approved: boolean) => void;
  timestamp: number;
}

export interface AgentPlan {
  id: string;
  userRequest: string;
  tasks: AgentTask[];
  status: 'planning' | 'clarifying' | 'review' | 'executing' | 'completed' | 'error';
  summary?: string;
  finalResponse?: string;
  totalToolsUsed?: AgentToolUsage[];
  createdAt: number;
  completedAt?: number;
  dismissed?: boolean;
}

export type AIProviderType = 'rork' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'nvidia' | 'custom';

export interface AIProviderConfig {
  id: AIProviderType;
  name: string;
  models: { id: string; name: string }[];
  free?: boolean;
  keyHint?: string;
}

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'rork',
    name: 'Studio AI (Dev0 Free)',
    free: true,
    keyHint: 'No API key required – ready to use immediately!',
    models: [
      { id: 'rork-default', name: 'Dev0 Studio AI (Free)' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq ★ Free Tier',
    free: true,
    keyHint: 'console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (llama-3.3-70b-versatile)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (llama-3.1-8b-instant)' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B (deepseek-r1-distill-llama-70b)' },
      { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B Reasoning (qwen-qwq-32b)' },
      { id: 'gemma2-9b-it', name: 'Google Gemma 2 9B IT (gemma2-9b-it)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B 32k (mixtral-8x7b-32768)' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini ★ Free Tier',
    free: true,
    keyHint: 'aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (gemini-2.5-flash)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro Deep Reasoning (gemini-2.5-pro)' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (gemini-2.5-flash-lite)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (gemini-2.0-flash)' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (gemini-2.0-flash-lite)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (gemini-1.5-pro)' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (gemini-1.5-flash)' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o Omni (gpt-4o)' },
      { id: 'gpt-4.1', name: 'GPT-4.1 Flagship (gpt-4.1)' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (gpt-4.1-mini)' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (gpt-4.1-nano)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (gpt-4o-mini)' },
      { id: 'o3-mini', name: 'OpenAI o3-mini Reasoning (o3-mini)' },
      { id: 'o4-mini', name: 'OpenAI o4-mini Reasoning (o4-mini)' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (claude-sonnet-4-20250514)' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (claude-3-7-sonnet-20250219)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (claude-3-5-haiku-20241022)' },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    keyHint: 'build.nvidia.com',
    models: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (meta/llama-3.3-70b-instruct)' },
      { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct (meta/llama-3.1-405b-instruct)' },
      { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct (meta/llama-3.1-70b-instruct)' },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 NIM (deepseek-ai/deepseek-r1)' },
      { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B (qwen/qwen2.5-coder-32b-instruct)' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter ★ Free Tier',
    free: true,
    keyHint: 'openrouter.ai/keys',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Free (meta-llama/llama-3.3-70b-instruct:free)' },
      { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B Free (qwen/qwen-2.5-coder-32b-instruct:free)' },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 Reasoning Free (deepseek/deepseek-r1:free)' },
      { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 Chat Free (deepseek/deepseek-chat-v3-0324:free)' },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp Free (google/gemini-2.0-flash-exp:free)' },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct Free (mistralai/mistral-7b-instruct:free)' },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B IT Free (google/gemma-2-9b-it:free)' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom (Local Model / LM Studio / Ollama)',
    models: [
      { id: 'lmstudio-local', name: 'LM Studio Local Model (lmstudio-local)' },
      { id: 'qwen2.5-coder:7b', name: 'Ollama Qwen 2.5 Coder 7B (qwen2.5-coder:7b)' },
      { id: 'llama3.2:latest', name: 'Ollama Llama 3.2 Local (llama3.2:latest)' },
      { id: 'deepseek-r1:8b', name: 'Ollama DeepSeek R1 8B Local (deepseek-r1:8b)' },
      { id: 'codellama:7b', name: 'Ollama CodeLlama 7B (codellama:7b)' },
      { id: 'custom', name: 'Custom OpenAI-Compatible Endpoint Model (custom)' },
    ],
  },
];

export const PERSONAS: { id: string; name: string; description: string }[] = [
  { id: 'standard', name: 'Standard', description: 'General Coding Assistant' },
  { id: 'android', name: 'Android Expert', description: 'Kotlin, Java, Jetpack Compose' },
  { id: 'web', name: 'Web Developer', description: 'TypeScript, React, HTML/CSS' },
  { id: 'python', name: 'Python Expert', description: 'Python, Django, Data Science' },
  { id: 'fullstack', name: 'Fullstack', description: 'Frontend + Backend + DevOps' },
];

export interface ToolRegistryItem {
  name: string;
  displayName: string;
  description: string;
  category: 'filesystem' | 'planning' | 'analysis' | 'web' | 'memory' | 'system' | 'learning';
  parameters: { name: string; type: string; description: string }[];
  isBeta: boolean;
  defaultPermission: ToolPermission;
}

export const TOOL_REGISTRY: ToolRegistryItem[] = [
  { name: 'zip_create', displayName: 'zip_create', description: 'Creates a downloadable ZIP archive card in Chat Mode containing one or more generated files.', category: 'planning', parameters: [{ name: 'archive_name', type: 'string', description: 'ZIP file name (e.g. solution-bundle.zip)' }, { name: 'description', type: 'string', description: 'Short summary of the bundle' }, { name: 'files', type: 'array', description: 'Array of { path, content } files to package' }], isBeta: false, defaultPermission: 'always' },
  { name: 'zip_read', displayName: 'zip_read', description: 'Lists files or reads specific file contents from a ZIP archive stored in the chat conversation.', category: 'analysis', parameters: [{ name: 'archive_name', type: 'string', description: 'Optional ZIP archive name or ID' }, { name: 'file_path', type: 'string', description: 'Optional file path inside the ZIP archive to read' }], isBeta: false, defaultPermission: 'always' },
  { name: 'draft_agent_plan', displayName: 'draft_agent_plan', description: 'Drafts an interactive execution plan graphic card in Chat Mode with Proceed (Launch in Agent Mode) and Edit Plan actions.', category: 'planning', parameters: [{ name: 'title', type: 'string', description: 'Plan title' }, { name: 'summary', type: 'string', description: 'High-level architecture summary' }, { name: 'steps', type: 'array', description: 'Ordered list of { title, description, role } steps' }], isBeta: false, defaultPermission: 'always' },
  { name: 'read_other_chat_messages', displayName: 'read_other_chat_messages', description: 'Reads or searches messages from other chat sessions using token-efficient BM25 keyword snippets.', category: 'memory', parameters: [{ name: 'query', type: 'string', description: 'Optional keyword search query across other chats' }, { name: 'limit', type: 'number', description: 'Max results (default 5)' }], isBeta: false, defaultPermission: 'always' },
  { name: 'memory_search', displayName: 'memory_search', description: 'Searches persistent AI memories in the Memory Graph by keyword or tag.', category: 'memory', parameters: [{ name: 'query', type: 'string', description: 'Search keyword' }], isBeta: false, defaultPermission: 'always' },
  { name: 'memory_update', displayName: 'memory_update', description: 'Updates an existing memory node in the Memory Graph.', category: 'memory', parameters: [{ name: 'id', type: 'string', description: 'Memory ID' }, { name: 'content', type: 'string', description: 'Updated memory content' }], isBeta: false, defaultPermission: 'always' },
  { name: 'memory_delete', displayName: 'memory_delete', description: 'Deletes a memory node from the Memory Graph by ID.', category: 'memory', parameters: [{ name: 'id', type: 'string', description: 'Memory ID' }], isBeta: false, defaultPermission: 'always' },
  { name: 'memory_graph_query', displayName: 'memory_graph_query', description: 'Queries the standalone Memory Synapse Graph for memory nodes, clusters, and connections.', category: 'memory', parameters: [{ name: 'query', type: 'string', description: 'Topic or cluster query' }], isBeta: false, defaultPermission: 'always' },
  { name: 'git_status', displayName: 'git_status', description: 'Returns built-in Git working tree status and diff summary against the latest Restore Point.', category: 'system', parameters: [], isBeta: false, defaultPermission: 'always' },
  { name: 'git_create_restore_point', displayName: 'git_create_restore_point', description: 'Creates a built-in Git commit / Restore Point snapshot (Browser IndexedDB + Docker Git when active).', category: 'system', parameters: [{ name: 'message', type: 'string', description: 'Commit / restore point message' }], isBeta: false, defaultPermission: 'always' },
  { name: 'git_list_restore_points', displayName: 'git_list_restore_points', description: 'Lists all available Git Restore Points (commits) for the active project.', category: 'system', parameters: [], isBeta: false, defaultPermission: 'always' },
  { name: 'git_restore_point', displayName: 'git_restore_point', description: 'Rolls the project files back to a specific Git Restore Point (commit hash or ID).', category: 'system', parameters: [{ name: 'commit_or_id', type: 'string', description: 'Commit hash, restore point ID, or "latest"' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'read_file', displayName: 'read_file', description: 'Reads the complete content of a file.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'File path' }], isBeta: false, defaultPermission: 'always' },
  { name: 'read_lines', displayName: 'read_lines', description: 'Reads specific lines from a file.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'File path' }, { name: 'start_line', type: 'number', description: 'Start line' }, { name: 'end_line', type: 'number', description: 'End line' }], isBeta: false, defaultPermission: 'always' },
  { name: 'write_file', displayName: 'write_file', description: 'Writes content to a file (overwrites completely).', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'File path' }, { name: 'content', type: 'string', description: 'New content' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'create_file', displayName: 'create_file', description: 'Creates a new file. Directories are created automatically.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'File path' }, { name: 'content', type: 'string', description: 'File content' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'edit_file', displayName: 'edit_file', description: 'Edits a file by replacing text.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'File path' }, { name: 'old_text', type: 'string', description: 'Old text' }, { name: 'new_text', type: 'string', description: 'New text' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'delete_file', displayName: 'delete_file', description: 'Deletes a file or an empty directory.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'File path' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'rename_file', displayName: 'rename_file', description: 'Renames a file or a directory.', category: 'filesystem', parameters: [{ name: 'old_path', type: 'string', description: 'Old path' }, { name: 'new_path', type: 'string', description: 'New path' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'find_replace', displayName: 'find_replace', description: 'Finds and replaces text in a file.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'File path' }, { name: 'find', type: 'string', description: 'Search text' }, { name: 'replace', type: 'string', description: 'Replacement text' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'list_directory', displayName: 'list_directory', description: 'Lists all files in a directory.', category: 'analysis', parameters: [{ name: 'path', type: 'string', description: 'Directory path' }], isBeta: false, defaultPermission: 'always' },
  { name: 'search_files', displayName: 'search_files', description: 'Searches files for text (grep).', category: 'analysis', parameters: [{ name: 'query', type: 'string', description: 'Search term' }, { name: 'path', type: 'string', description: 'Optional path' }], isBeta: false, defaultPermission: 'always' },
  { name: 'localize_code_graph', displayName: 'localize_code_graph', description: 'Queries the RepoGraph Synapse Code Graph to localize project files, functions, imports, and call edges.', category: 'analysis', parameters: [{ name: 'query', type: 'string', description: 'Symbol, function, or feature query' }], isBeta: false, defaultPermission: 'always' },
  { name: 'create_directory', displayName: 'create_directory', description: 'Creates a new directory.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Directory path' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'get_project_tree', displayName: 'get_project_tree', description: 'Returns the entire project structure.', category: 'analysis', parameters: [], isBeta: false, defaultPermission: 'always' },
  { name: 'get_file_info', displayName: 'get_file_info', description: 'Returns information about a file.', category: 'analysis', parameters: [{ name: 'path', type: 'string', description: 'File path' }], isBeta: false, defaultPermission: 'always' },
  { name: 'create_todo', displayName: 'create_todo', description: 'Creates a new todo entry.', category: 'planning', parameters: [{ name: 'text', type: 'string', description: 'Todo text' }], isBeta: false, defaultPermission: 'always' },
  { name: 'update_todo', displayName: 'update_todo', description: 'Updates a todo entry.', category: 'planning', parameters: [{ name: 'id', type: 'string', description: 'Todo ID' }, { name: 'completed', type: 'boolean', description: 'Status' }], isBeta: false, defaultPermission: 'always' },
  { name: 'add_memo', displayName: 'add_memo', description: 'Saves a persistent memory node into the AI Memory Graph.', category: 'memory', parameters: [{ name: 'content', type: 'string', description: 'Memory content' }], isBeta: false, defaultPermission: 'always' },
  { name: 'think', displayName: 'think', description: 'Advanced reasoning for complex problems.', category: 'system', parameters: [{ name: 'thought', type: 'string', description: 'Thought process' }], isBeta: false, defaultPermission: 'always' },
  { name: 'web_search', displayName: 'web_search', description: 'Web search for information and documentation.', category: 'web', parameters: [{ name: 'query', type: 'string', description: 'Search term' }], isBeta: true, defaultPermission: 'ask' },
  { name: 'web_fetch', displayName: 'web_fetch', description: 'Downloads the content of a webpage.', category: 'web', parameters: [{ name: 'url', type: 'string', description: 'Webpage URL' }, { name: 'max_length', type: 'number', description: 'Max chars' }], isBeta: true, defaultPermission: 'ask' },
  { name: 'read_identity_files', displayName: 'read_identity_files', description: 'Reads all identity files (SOUL.md, AGENTS.md, IDENTITY.md, USER.md, MEMORY.md).', category: 'learning', parameters: [], isBeta: true, defaultPermission: 'always' },
  { name: 'update_soul_md', displayName: 'update_soul_md', description: 'Updates SOUL.md (agent personality, values, philosophy).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'New content for SOUL.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'update_agents_md', displayName: 'update_agents_md', description: 'Updates AGENTS.md (rules, reasoning protocol, tool usage).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'New content for AGENTS.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'update_identity_md', displayName: 'update_identity_md', description: 'Updates IDENTITY.md (name, role, presentation).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'New content for IDENTITY.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'update_user_md', displayName: 'update_user_md', description: 'Updates USER.md (user profile, preferences, projects).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'New content for USER.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'update_memory_md', displayName: 'update_memory_md', description: 'Updates MEMORY.md (long-term memory, decisions, learned preferences).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'New content for MEMORY.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'verify_file', displayName: 'verify_file', description: 'Verifies if a file exists and is correct.', category: 'analysis', parameters: [{ name: 'path', type: 'string', description: 'File path' }], isBeta: false, defaultPermission: 'always' },
  { name: 'task_complete', displayName: 'task_complete', description: 'Marks an agent task as completed.', category: 'planning', parameters: [{ name: 'summary', type: 'string', description: 'Summary' }], isBeta: false, defaultPermission: 'always' },
  { name: 'finish_task', displayName: 'finish_task', description: 'Mandatory Sub-Agent completion tool. Updates .agents/<name>/STATUS.md & LOG.md in English and triggers immediate Cron wakeup to the Main Creator AI.', category: 'system', parameters: [{ name: 'agent_name', type: 'string', description: 'Sub-Agent name or role' }, { name: 'summary', type: 'string', description: 'English completion summary' }], isBeta: false, defaultPermission: 'always' },
  { name: 'create_cron_job', displayName: 'create_cron_job', description: 'Schedules a recurring or event-triggered Sub-Agent Cron job (e.g., wake Main AI or run auditor when finish_task is called).', category: 'system', parameters: [{ name: 'name', type: 'string', description: 'Cron job name' }, { name: 'target_role', type: 'string', description: 'Target Sub-Agent role' }, { name: 'task', type: 'string', description: 'Task instruction' }, { name: 'trigger_type', type: 'string', description: 'on_finish_task, interval, or after_delay' }, { name: 'depends_on_agent', type: 'string', description: 'Agent slug that triggers this job upon finish_task' }, { name: 'reason', type: 'string', description: 'Why this Cron job is needed' }], isBeta: false, defaultPermission: 'always' },
  { name: 'sleep_agent', displayName: 'sleep_agent', description: 'Pauses (sleeps) or wakes up a Sub-Agent and records its state in .agents/<name>/STATUS.md.', category: 'system', parameters: [{ name: 'agent_name', type: 'string', description: 'Sub-Agent name or role' }, { name: 'reason', type: 'string', description: 'Why the Sub-Agent is sleeping or waking' }, { name: 'wake', type: 'boolean', description: 'True to wake up, false to put to sleep' }], isBeta: false, defaultPermission: 'always' },
  { name: 'inspect_subagent_workspace', displayName: 'inspect_subagent_workspace', description: 'Inspects the hidden .agents/<name>/ English documentation folders, Sub-Agent statuses, and active Cron jobs.', category: 'system', parameters: [{ name: 'agent_name', type: 'string', description: 'Optional Sub-Agent name filter' }], isBeta: false, defaultPermission: 'always' },
  { name: 'sub_agent', displayName: 'sub_agent', description: 'Delegates task to a specialized or user-created Sub-Agent template.', category: 'system', parameters: [{ name: 'role', type: 'string', description: 'Sub-Agent role or template name' }, { name: 'task', type: 'string', description: 'Task description' }], isBeta: false, defaultPermission: 'always' },
  { name: 'ask_user_question', displayName: 'ask_user_question', description: 'Opens a floating question window to ask the user clarifying questions (including Sub-Agent configuration questions) and relays answers back to Dev0.', category: 'planning', parameters: [{ name: 'questions', type: 'array', description: 'List of questions to ask the user' }, { name: 'is_sub_agent', type: 'boolean', description: 'Whether the question is for/from a Sub-Agent' }, { name: 'sub_agent_role', type: 'string', description: 'Sub-Agent role (developer, localizer, analyst, tester, researcher, critic)' }, { name: 'sub_agent_name', type: 'string', description: 'Suggested Sub-Agent name' }], isBeta: false, defaultPermission: 'always' },
];

export const TOOL_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'filesystem', label: 'Filesystem', icon: '📁' },
  { id: 'analysis', label: 'Analysis', icon: '🔍' },
  { id: 'planning', label: 'Planning & ZIP', icon: '📋' },
  { id: 'memory', label: 'Memory & Cross-Chat', icon: '💾' },
  { id: 'learning', label: 'Learning (Beta)', icon: '🧠' },
  { id: 'web', label: 'Web (Beta)', icon: '🌐' },
  { id: 'system', label: 'System & Git', icon: '⚙️' },
];

export const PROJECT_FILESYSTEM_TOOL_NAMES = [
  'read_file',
  'read_lines',
  'write_file',
  'create_file',
  'edit_file',
  'delete_file',
  'rename_file',
  'find_replace',
  'create_directory',
  'list_directory',
  'search_files',
  'get_project_tree',
  'get_file_info',
  'verify_file',
  'localize_code_graph',
  'git_status',
  'git_create_restore_point',
  'git_list_restore_points',
  'git_restore_point',
  'sub_agent',
  'finish_task',
  'create_cron_job',
  'sleep_agent',
  'inspect_subagent_workspace',
] as const;

export function isProjectFilesystemOrAgentOnlyTool(toolName?: string | null): boolean {
  if (!toolName) return false;
  return (PROJECT_FILESYSTEM_TOOL_NAMES as readonly string[]).includes(toolName.trim());
}

export const LEARNING_TOOL_NAMES = [
  'add_memo',
  'read_identity_files',
  'update_soul_md',
  'update_agents_md',
  'update_identity_md',
  'update_user_md',
  'update_memory_md',
] as const;

export function isLearningTool(toolName?: string | null): boolean {
  if (!toolName || typeof toolName !== 'string') return false;
  if ((LEARNING_TOOL_NAMES as readonly string[]).includes(toolName)) return true;
  const reg = TOOL_REGISTRY.find(t => t.name === toolName);
  return reg?.category === 'learning';
}

export function isLearningEnabled(settings?: Partial<AppSettings> | null): boolean {
  if (!settings) return false;
  if (settings.learningEnabled === false || settings.memoEnabled === false) return false;
  if (settings.betaAgentLearning === false && settings.learningEnabled === undefined && settings.memoEnabled === undefined) return false;
  return Boolean(settings.betaAgentLearning || settings.learningEnabled || settings.memoEnabled);
}

export function syncLearningSettings(prev: AppSettings, partial: Partial<AppSettings>): AppSettings {
  const updated: AppSettings = { ...prev, ...partial };
  if ('betaAgentLearning' in partial) {
    const val = Boolean(partial.betaAgentLearning);
    if (partial.learningEnabled === undefined) updated.learningEnabled = val;
    if (partial.memoEnabled === undefined) updated.memoEnabled = val;
  } else if ('learningEnabled' in partial) {
    const val = Boolean(partial.learningEnabled);
    if (partial.betaAgentLearning === undefined) updated.betaAgentLearning = val;
    if (partial.memoEnabled === undefined) updated.memoEnabled = val;
  } else if ('memoEnabled' in partial) {
    const val = Boolean(partial.memoEnabled);
    if (partial.betaAgentLearning === undefined) updated.betaAgentLearning = val;
    if (partial.learningEnabled === undefined) updated.learningEnabled = val;
  }
  return updated;
}

export const DEFAULT_SETTINGS: AppSettings = {
  openaiKey: '',
  anthropicKey: '',
  geminiKey: '',
  groqKey: '',
  openrouterKey: '',
  nvidiaKey: '',
  customEndpoint: '',
  customKey: '',
  selectedProvider: 'rork',
  selectedModel: 'rork-default',
  fontSize: 14,
  showLineNumbers: true,
  wordWrap: false,
  yoloMode: false,
  persona: 'standard',
  autoRetry: true,
  autoFallback: true,
  betaHtmlPreview: false,
  betaWebSearch: false,
  betaWebFetch: false,
  betaAgentLearning: false,
  learningEnabled: false,
  memoEnabled: false,
  betaSuperAgent: false,
  agentMode: false,
  hideSponsor: false,
  toolPermissions: {},
};

export const PROJECT_TYPES = [
  { id: 'android', name: 'Android (Kotlin)', icon: '📱' },
  { id: 'web', name: 'Web (TypeScript)', icon: '🌐' },
  { id: 'python', name: 'Python', icon: '🐍' },
  { id: 'docker-sandbox', name: 'Docker Sandbox (Isolated)', icon: '🐳' },
  { id: 'empty', name: 'Empty Project', icon: '📁' },
];

