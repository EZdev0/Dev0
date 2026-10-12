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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  timestamp: number;
  thinking?: string;
  todos?: InlineTodo[];
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
  // NEU: Für Unteragenten-Kommunikation
  isSubAgentTask?: boolean;
  parentTaskId?: string;
  agentRole?: 'analyst' | 'developer' | 'tester' | 'researcher';
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
  status: 'planning' | 'review' | 'executing' | 'completed' | 'error';
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
    name: 'Studio KI',
    free: true,
    keyHint: 'Kein Schlüssel nötig – sofort nutzbar!',
    models: [
      { id: 'rork-default', name: 'Studio KI (Gratis)' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq ★ Kostenlos',
    free: true,
    keyHint: 'console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Schnell)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini ★ Kostenlos',
    free: true,
    keyHint: 'aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    keyHint: 'build.nvidia.com',
    models: [
      { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
      { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter ★ Kostenlos',
    free: true,
    keyHint: 'openrouter.ai/keys',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Gratis)' },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Gratis)' },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Gratis)' },
    ],
  },
  {
    id: 'custom',
    name: 'Benutzerdefiniert',
    models: [
      { id: 'custom', name: 'Eigenes Modell' },
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
  { name: 'create_directory', displayName: 'create_directory', description: 'Creates a new directory.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Directory path' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'get_project_tree', displayName: 'get_project_tree', description: 'Returns the entire project structure.', category: 'analysis', parameters: [], isBeta: false, defaultPermission: 'always' },
  { name: 'get_file_info', displayName: 'get_file_info', description: 'Returns information about a file.', category: 'analysis', parameters: [{ name: 'path', type: 'string', description: 'File path' }], isBeta: false, defaultPermission: 'always' },
  { name: 'create_todo', displayName: 'create_todo', description: 'Creates a new todo entry.', category: 'planning', parameters: [{ name: 'text', type: 'string', description: 'Todo text' }], isBeta: false, defaultPermission: 'always' },
  { name: 'update_todo', displayName: 'update_todo', description: 'Updates a todo entry.', category: 'planning', parameters: [{ name: 'id', type: 'string', description: 'Todo ID' }, { name: 'completed', type: 'boolean', description: 'Status' }], isBeta: false, defaultPermission: 'always' },
  { name: 'add_memo', displayName: 'add_memo', description: 'Saves a note in the project memory.', category: 'memory', parameters: [{ name: 'content', type: 'string', description: 'Memo content' }], isBeta: false, defaultPermission: 'always' },
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
  { name: 'sub_agent', displayName: 'sub_agent', description: 'Delegates task to a specialized sub-agent.', category: 'system', parameters: [{ name: 'role', type: 'string', description: 'Sub-agent role' }, { name: 'task', type: 'string', description: 'Task description' }], isBeta: true, defaultPermission: 'ask' },
];

export const TOOL_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'filesystem', label: 'Filesystem', icon: '📁' },
  { id: 'analysis', label: 'Analysis', icon: '🔍' },
  { id: 'planning', label: 'Planning', icon: '📋' },
  { id: 'memory', label: 'Memory', icon: '💾' },
  { id: 'learning', label: 'Learning (Beta)', icon: '🧠' },
  { id: 'web', label: 'Web (Beta)', icon: '🌐' },
  { id: 'system', label: 'System', icon: '⚙️' },
];

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
  betaSuperAgent: false,
  agentMode: false,
  hideSponsor: false,
  toolPermissions: {},
};

export const PROJECT_TYPES = [
  { id: 'android', name: 'Android (Kotlin)', icon: '📱' },
  { id: 'web', name: 'Web (TypeScript)', icon: '🌐' },
  { id: 'python', name: 'Python', icon: '🐍' },
  { id: 'studio-ide', name: 'Dev0 (Source)', icon: '🛠️' },
  { id: 'empty', name: 'Leeres Projekt', icon: '📁' },
];
