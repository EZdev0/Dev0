import { ChatMessage, ToolDefinition, AIProviderType, MemoEntry, TodoItem, AI_PROVIDERS, isLearningTool, isProjectFilesystemOrAgentOnlyTool } from '@/types';
import { MAX_TOOL_RESULT_LENGTH, truncateToolResult, compressAndSanitizeMessagesForAPI } from '@/utils/chat-compression';
import { runSubAISearchAgent } from '@/utils/web-tools';
import { extractActualTokenUsage, TokenUsageRecord } from '@/utils/free-ai-pool';

export const DEFAULT_RORK_MODEL = 'gpt-4o-mini';

export function resolveDefaultModel(provider: AIProviderType, model?: string | null): string {
  if (typeof model === 'string' && model.trim().length > 0) {
    return model.trim();
  }
  const providerConfig = AI_PROVIDERS.find(p => p.id === provider);
  if (providerConfig && providerConfig.models.length > 0 && providerConfig.models[0]?.id) {
    return providerConfig.models[0].id;
  }
  if (provider === 'rork') return 'rork-default';
  return 'openai';
}

export async function runSearchSubAgent(query: string): Promise<string> {
  return await runSubAISearchAgent(query);
}

export function buildPlannerPrompt(options: {
  projectTree: string;
  memos: MemoEntry[];
  todos: TodoItem[];
  learningEnabled?: boolean;
}): string {
  let prompt = 'You are the main agent (Planner) of a mobile IDE called "Dev0".\n';
  prompt += 'Your task is to break down the user request into distinct, clearly defined steps.\n';
  prompt += '\n';
  prompt += '## IMPORTANT NOTICE\n';
  prompt += '- Sub-agents ALREADY EXIST and do NOT need to be created anew!\n';
  prompt += '- If the user says "test sub-agents", you should use the EXISTING sub-agents.\n';
  prompt += '- Do NOT create new agent architectures, folders, or structures.\n';
  prompt += '- Use the existing sub-agents for sub-tasks (Analyst, Developer, Tester).\n\n';
  prompt += '## RULES\n';
  prompt += '- ALWAYS reply in English.\n';
  prompt += '- Return the steps as a list with the appropriate type prefix.\n';
  prompt += '- IMPORTANT: The FIRST step must ALWAYS be a THINK step, where you analyze the request.\n';
  prompt += '- You can insert as many THINK steps (thoughts/analysis) and BRAINSTORM steps as you like.\n';
  prompt += '- THINK steps: Analyze the problem, consider which tools are needed, check if the approach works.\n';
  prompt += '- BRAINSTORM steps: Investigate ALTERNATIVES, gather AT LEAST 3 ideas, validate the plan critically.\n';
  prompt += '- TASK steps: Concrete tasks that a sub-agent should perform.\n';
  prompt += '- WEB_SEARCH steps: Web research for information, documentation, or current data.\n';
  prompt += '- Keep tasks atomic and clearly delineated.\n';
  prompt += '- Maximum of 25 steps per plan (including any number of THINK/BRAINSTORM).\n';
  prompt += '- For very complex requests (>15 Tasks), automatically schedule more THINK/BRAINSTORM steps.\n';
  prompt += '- The steps should be in the correct order.\n';
  prompt += '- Describe exactly which files are affected and which tools are needed.\n';
  prompt += '- IMPORTANT: Write COMPLETE sentences. No incomplete sentences!\n';
  prompt += '- If a task depends on another, mention it.\n';
  prompt += '- Mention in THINK steps which tools (read_file, write_file, etc.) should be used.\n\n';
  prompt += '## BRAINSTORMING RULES\n';
  prompt += '- Brainstorming must be THOROUGH, not superficial!\n';
  prompt += '- Generate AT LEAST 3 different solution approaches.\n';
  prompt += '- You MUST evaluate all your available tools (like get_active_tools) during the brainstorm to see what capabilities you actually have.\n';
  prompt += '- Take your time to think longer and evaluate everything carefully.\n';
  prompt += '- Compare pros and cons of each approach.\n';
  prompt += '- Evaluate complexity, maintainability, performance.\n';
  prompt += '- Also think of unconventional solutions.\n';
  prompt += '- Brainstorming is only complete when ALL options have been reviewed.\n\n';

  prompt += '## Project Structure\n```\n' + (options.projectTree || '(Empty Project)') + '\n```\n';

  if (options.learningEnabled && options.memos && options.memos.length > 0) {
    prompt += '\n## Project Memos\n';
    options.memos.forEach(m => { prompt += '- ' + m.content + '\n'; });
  }

  if (options.todos && options.todos.length > 0) {
    prompt += '\n## Current Todos\n';
    options.todos.forEach(t => {
      prompt += '- [' + (t.completed ? 'x' : ' ') + '] ' + t.text + '\n';
    });
  }

  prompt += '\n## Response Format\nReturn ONLY the step list, no further explanations.\n';
  prompt += 'Use these formats per line:\n';
  prompt += '- THINK: Title | Detailed thought process and analysis\n';
  prompt += '- BRAINSTORM: Title | What exactly needs to be investigated or checked\n';
  prompt += '- TASK: Title | Complete description of the concrete task\n';
  prompt += '- WEB_SEARCH: Title | What exactly to search for on the web and how many queries\n';
  prompt += '\nExample:\n';
  prompt += 'THINK: Analyze request | I need to understand what the user wants. I will analyze the project structure using read_file and get_project_tree.\n';
  prompt += 'BRAINSTORM: Check architecture | Which files need to be created or changed? Are there dependencies?\n';
  prompt += 'TASK: Create main file | Create the file src/main.kt with the basic app structure.\n';
  prompt += 'WEB_SEARCH: Research documentation | Perform 2 search queries on Kotlin Compose Patterns and best practices.\n';

  return prompt;
}


export function parsePlanFromAI(content: string): { title: string; description: string; taskType: 'task' | 'thinking' | 'brainstorm' | 'web_search' }[] {
  const tasks: { title: string; description: string; taskType: 'task' | 'thinking' | 'brainstorm' | 'web_search' }[] = [];
  if (!content) return tasks;
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const thinkMatch = trimmed.match(/^(?:\d+\.?\s*)?THINK:\s*(.+?)\s*\|\s*(.+)$/i);
    if (thinkMatch) {
      tasks.push({ title: thinkMatch[1].trim(), description: thinkMatch[2].trim(), taskType: 'thinking' });
      continue;
    }

    const brainstormMatch = trimmed.match(/^(?:\d+\.?\s*)?BRAINSTORM:\s*(.+?)\s*\|\s*(.+)$/i);
    if (brainstormMatch) {
      tasks.push({ title: brainstormMatch[1].trim(), description: brainstormMatch[2].trim(), taskType: 'brainstorm' });
      continue;
    }

    const webSearchMatch = trimmed.match(/^(?:\d+\.?\s*)?WEB_SEARCH:\s*(.+?)\s*\|\s*(.+)$/i);
    if (webSearchMatch) {
      tasks.push({ title: webSearchMatch[1].trim(), description: webSearchMatch[2].trim(), taskType: 'web_search' });
      continue;
    }

    const taskMatch = trimmed.match(/^(?:\d+\.?\s*)?TASK:\s*(.+?)\s*\|\s*(.+)$/i);
    if (taskMatch) {
      tasks.push({ title: taskMatch[1].trim(), description: taskMatch[2].trim(), taskType: 'task' });
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[-–:]\s*(.+)$/);
    if (numberedMatch && !trimmed.startsWith('```')) {
      tasks.push({ title: numberedMatch[1].trim().replace(/\*+/g, ''), description: numberedMatch[2].trim(), taskType: 'task' });
    }
  }

  if (tasks.length === 0) {
    const fallbackLines = lines.filter(l => l.trim().length > 5 && !l.trim().startsWith('#') && !l.trim().startsWith('```'));
    for (const fl of fallbackLines.slice(0, 5)) {
      tasks.push({ title: fl.trim().slice(0, 80), description: fl.trim(), taskType: 'task' });
    }
  }

  if (tasks.length > 0 && tasks[0].taskType !== 'thinking') {
    tasks.unshift({ title: 'Analyze Request', description: 'Analyze the user request and plan the next steps.', taskType: 'thinking' });
  }

  // Limit auf 25 Tasks, aber mit Warnung wenn mehr vorhanden
  if (tasks.length > 25) {
    console.log('[Planner] Plan exceeds 25 tasks, truncating from', tasks.length, 'to 25');
  }
  
  return tasks.slice(0, 25);
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Reads the complete content of a file. MUST be called before any editing.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path relative to project root' } }, required: ['path'] },
  },
  {
    name: 'read_lines',
    description: 'Reads specific lines from a file.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, start_line: { type: 'number', description: 'Start line (1-based)' }, end_line: { type: 'number', description: 'End line (1-based)' } }, required: ['path', 'start_line', 'end_line'] },
  },
  {
    name: 'write_file',
    description: 'Writes content to a file (overwrites completely). File must be read with read_file first.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'New file content' } }, required: ['path', 'content'] },
  },
  {
    name: 'create_file',
    description: 'Creates a new file. Missing folders will be created automatically.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'File content' } }, required: ['path', 'content'] },
  },
  {
    name: 'edit_file',
    description: 'Edits a file by replacing text. File MUST be read with read_file first. old_text must match exactly.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string', description: 'Exact text to be replaced' }, new_text: { type: 'string', description: 'New text' } }, required: ['path', 'old_text', 'new_text'] },
  },
  {
    name: 'delete_file',
    description: 'Deletes a file or an empty directory.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'rename_file',
    description: 'Renames a file or directory.',
    parameters: { type: 'object', properties: { old_path: { type: 'string' }, new_path: { type: 'string' } }, required: ['old_path', 'new_path'] },
  },
  {
    name: 'list_directory',
    description: 'Lists all files and directories in a directory.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Path (empty for root directory)' } }, required: ['path'] },
  },
  {
    name: 'search_files',
    description: 'Searches all files for a text (grep-like). Returns filename, line, and context. Supports regular expressions.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search term or regular expression' }, path: { type: 'string', description: 'Optional path to restrict search' } }, required: ['query'] },
  },
  {
    name: 'find_replace',
    description: 'Finds and replaces text in a file.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, find: { type: 'string' }, replace: { type: 'string' }, all: { type: 'boolean', description: 'Replace all occurrences (default: false)' } }, required: ['path', 'find', 'replace'] },
  },
  {
    name: 'create_directory',
    description: 'Creates a new directory (including subdirectories).',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'get_project_tree',
    description: 'Returns the entire project structure as a tree representation.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_file_info',
    description: 'Returns information about a file (line count, character count, language).',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'create_todo',
    description: 'Creates a new todo entry in the project plan.',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'update_todo',
    description: 'Updates a todo entry (status or text).',
    parameters: { type: 'object', properties: { id: { type: 'string' }, completed: { type: 'boolean' }, text: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'add_memo',
    description: 'Saves an important finding or note in the project memory. Use this for things you should remember.',
    parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
  },
  {
    name: 'think',
    description: 'Use this tool to think about a complex problem. Your thought process will be shown to the user as a collapsible block. Use this for difficult tasks.',
    parameters: { type: 'object', properties: { thought: { type: 'string', description: 'Your detailed thought process' } }, required: ['thought'] },
  },
  {
    name: 'web_search',
    description: 'Searches the web for information. Use this for research, current information, or documentation.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search term' } }, required: ['query'] },
  },
  {
    name: 'web_fetch',
    description: 'Downloads the content of a webpage and returns the text (without HTML tags).',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL of the webpage' }, max_length: { type: 'number', description: 'Maximum number of characters (default: 5000)' } }, required: ['url'] },
  },
  {
    name: 'propose_agent_mode',
    description: 'Proposes to the user to switch to agent mode because the task is too complex for direct chat.',
    parameters: { type: 'object', properties: { reason: { type: 'string', description: 'Reason why agent mode would be better' } }, required: ['reason'] },
  },
  {
    name: 'read_identity_files',
    description: 'Reads all identity files (SOUL.md, AGENTS.md, IDENTITY.md, USER.md, MEMORY.md) and returns their content.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'update_soul_md',
    description: 'Updates SOUL.md — the personality, values, and behavioral philosophy of the agent. Use this to refine your personality.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'New complete content for SOUL.md' } }, required: ['content'] },
  },
  {
    name: 'update_agents_md',
    description: 'Updates AGENTS.md — behavioral rules, reasoning protocol, and tool usage guidelines. Use this to optimize workflow.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'New complete content for AGENTS.md' } }, required: ['content'] },
  },
  {
    name: 'update_identity_md',
    description: 'Updates IDENTITY.md — name, role, and outward presentation of the agent.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'New complete content for IDENTITY.md' } }, required: ['content'] },
  },
  {
    name: 'update_user_md',
    description: 'Updates USER.md — user profile, preferences, communication style, and known projects. Use this to better understand the user.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'New complete content for USER.md' } }, required: ['content'] },
  },
  {
    name: 'update_memory_md',
    description: 'Updates MEMORY.md — long-term memory with decisions, learned preferences, and past errors. Persistent across sessions.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'New complete content for MEMORY.md' } }, required: ['content'] },
  },
  {
    name: 'get_active_tools',
    description: 'Fetches the list of currently active and available tools. Use this to check which tools you can actually use. Hidden from user.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'localize_code_graph',
    description: 'Queries the RepoGraph Synapse Memory Graph to localize files, exported functions, callers/callees, and linked memories with minimal token cost.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Symbol, function name, file, or concept to localize' } }, required: ['query'] },
  },
  {
    name: 'sub_agent',
    description: 'Delegates a focused sub-task to a specialized or custom user-defined sub-agent template (e.g. analyst, developer, tester, researcher, critic, localizer, or custom template name).',
    parameters: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Sub-agent role or custom template name' },
        task: { type: 'string', description: 'Detailed task instruction for the sub-agent' },
      },
      required: ['role', 'task'],
    },
  },
  {
    name: 'ask_user_question',
    description: 'Asks the user clarifying questions or Sub-Agent configuration questions via an interactive floating window and relays the answers back to the Main Creator Agent. MUST be called whenever you or a sub-agent need user input or when the user asks to start a sub-agent without specifying role/task.',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of clear questions for the user',
        },
        is_sub_agent: {
          type: 'boolean',
          description: 'Set to true when the question is from a sub-agent or about configuring/starting a sub-agent',
        },
        sub_agent_role: {
          type: 'string',
          description: 'Suggested sub-agent role (developer, localizer, analyst, researcher, tester, critic)',
        },
        sub_agent_name: {
          type: 'string',
          description: 'Suggested name for saving the sub-agent in the user Sub-Agent list',
        },
        task: {
          type: 'string',
          description: 'Optional initial task description',
        },
      },
      required: ['questions'],
    },
  },
  {
    name: 'finish_task',
    description: 'Mandatory completion tool for Dev0 and Sub-Agents. Marks the current task as finished, writes the English status report to .agents/<slug>/STATUS.md and LOG.md, and triggers any dependent Cron jobs or downstream Sub-Agents.',
    parameters: {
      type: 'object',
      properties: {
        agent_slug: {
          type: 'string',
          description: 'Sub-Agent slug (e.g., developer, auditor, teamworker, localizer, critic)',
        },
        summary: {
          type: 'string',
          description: 'Concise English summary of completed work and verified files',
        },
        files_modified: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of created or modified file paths',
        },
        next_recommended_agent: {
          type: 'string',
          description: 'Optional recommended next Sub-Agent slug (e.g., auditor or tester)',
        },
      },
      required: ['agent_slug', 'summary'],
    },
  },
  {
    name: 'create_cron_job',
    description: 'Creates an automated Cron job or event-driven trigger for a Sub-Agent (e.g., run Auditor after Developer finishes, or run periodic code health checks). Explain why and when the Cron job runs.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Short English name for the Cron job (e.g., Post-Commit Security Audit)',
        },
        target_sub_agent: {
          type: 'string',
          description: 'Target Sub-Agent slug or role (e.g., auditor, teamworker, developer, localizer)',
        },
        schedule: {
          type: 'string',
          description: 'Cron expression (e.g., */15 * * * *) or event trigger (e.g., on_finish:developer)',
        },
        trigger_on_finish_of: {
          type: 'string',
          description: 'Optional Sub-Agent slug whose finish_task call automatically triggers this job',
        },
        task: {
          type: 'string',
          description: 'English task instruction executed when the Cron job triggers',
        },
      },
      required: ['name', 'target_sub_agent', 'schedule', 'task'],
    },
  },
  {
    name: 'sleep_agent',
    description: 'Places a Sub-Agent into pause/sleep mode or wakes it up to conserve tokens and coordinate multi-agent execution.',
    parameters: {
      type: 'object',
      properties: {
        agent_slug: {
          type: 'string',
          description: 'Target Sub-Agent slug (e.g., developer, auditor, teamworker)',
        },
        action: {
          type: 'string',
          description: '"sleep" to pause the Sub-Agent or "wake" to resume it',
        },
        reason: {
          type: 'string',
          description: 'English explanation for why the Sub-Agent is being paused or woken',
        },
      },
      required: ['agent_slug', 'action'],
    },
  },
  {
    name: 'inspect_subagent_workspace',
    description: 'Reads the hidden .agents/<slug>/ workspace documentation (README.md, RULES.md, STATUS.md, LOG.md) and active Cron jobs so Dev0 and Sub-Agents can coordinate seamlessly.',
    parameters: {
      type: 'object',
      properties: {
        agent_slug: {
          type: 'string',
          description: 'Optional Sub-Agent slug (e.g., teamworker, auditor, developer). Omit to inspect all active .agents/ workspaces.',
        },
      },
      required: [],
    },
  },
  {
    name: 'zip_create',
    description: 'Packages one or more generated files into a real downloadable .zip archive rendered as an interactive ZIP Download Card in the chat. Use this in Normal Chat Mode whenever the user asks for files, snippets, or downloadable code bundles.',
    parameters: {
      type: 'object',
      properties: {
        archive_name: {
          type: 'string',
          description: 'Archive filename (e.g., "ui-components.zip")',
        },
        description: {
          type: 'string',
          description: 'Brief summary of what is inside the ZIP archive',
        },
        files: {
          type: 'array',
          description: 'Array of files to include ({ path, content })',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path inside the ZIP archive' },
              content: { type: 'string', description: 'Full text content of the file' },
            },
            required: ['path', 'content'],
          },
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'zip_read',
    description: 'Lists files or reads a specific file slice from a ZIP archive previously created in the current chat session.',
    parameters: {
      type: 'object',
      properties: {
        zip_id: {
          type: 'string',
          description: 'Optional ZIP artifact ID (defaults to latest ZIP in chat)',
        },
        file_path: {
          type: 'string',
          description: 'Optional relative path inside the ZIP archive to read',
        },
      },
      required: [],
    },
  },
  {
    name: 'draft_agent_plan',
    description: 'Creates an interactive Execution Plan Graphic Card in the chat with "Proceed in Agent Mode" and "Edit / Refine Plan" buttons so the user can review, customize, and launch an Agent Mode workflow.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Concise title for the execution plan',
        },
        summary: {
          type: 'string',
          description: 'Overview of the architectural approach and goals',
        },
        steps: {
          type: 'array',
          description: 'Ordered execution steps ({ title, description, agent_role })',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              agent_role: { type: 'string' },
            },
            required: ['title'],
          },
        },
        target_files: {
          type: 'array',
          description: 'Optional list of target file paths',
          items: { type: 'string' },
        },
      },
      required: ['title', 'steps'],
    },
  },
  {
    name: 'read_other_chat_messages',
    description: 'Token-efficient BM25 keyword search across other stored chat sessions. Returns concise matching snippets (capped under 1,750 chars) without bloating the context window.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords to search across other chat sessions (leave empty for a compact overview of recent sessions)',
        },
        max_snippets: {
          type: 'number',
          description: 'Maximum number of matching snippets to return (1-10, default 5)',
        },
      },
      required: [],
    },
  },
  {
    name: 'memory_search',
    description: 'Searches persistent Memory Graph nodes by keyword or topic (works with or without an active project).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query or keyword to match in the Memory Graph',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_update',
    description: 'Updates an existing Memory Graph node by ID or creates a new persistent memory synapse.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Optional existing memory ID to update (omit to create a new memory node)',
        },
        content: {
          type: 'string',
          description: 'Memory content to store in the Synapse Memory Graph',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'memory_delete',
    description: 'Deletes a persistent memory node from the Synapse Memory Graph by ID or matching text.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Memory ID (or substring) to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'memory_graph_query',
    description: 'Queries the standalone Synapse Memory Graph and returns connected memory nodes and semantic edges (works without an active project).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional topic or keyword to localize within the Memory Graph',
        },
      },
      required: [],
    },
  },
  {
    name: 'git_status',
    description: 'Returns the current Built-in Git & Restore Point status (working tree changes since HEAD and active backend).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_create_restore_point',
    description: 'Creates a Built-in Git Restore Point snapshot in Browser storage and mirrors the commit to the Docker sandbox Git repository when active.',
    parameters: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Commit message / restore point label describing the snapshot',
        },
      },
      required: ['label'],
    },
  },
  {
    name: 'git_list_restore_points',
    description: 'Lists all saved Git Restore Points for the active project with commit hashes, timestamps, and diff summaries.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_restore_point',
    description: 'Rolls the active project files back to a specific Git Restore Point by ID or commit hash (automatically creating a safety pre-rollback snapshot first).',
    parameters: {
      type: 'object',
      properties: {
        id_or_hash: {
          type: 'string',
          description: 'Restore point ID or short commit hash (or "latest")',
        },
      },
      required: ['id_or_hash'],
    },
  },
];

export function getAvailableTools(options?: {
  learningEnabled?: boolean;
  betaAgentLearning?: boolean;
  yoloMode?: boolean;
  betaWebSearch?: boolean;
  betaWebFetch?: boolean;
  toolPermissions?: Record<string, string>;
  chatModeOnly?: boolean;
  agentMode?: boolean;
}): (ToolDefinition & { function: { name: string; description: string; parameters: ToolDefinition['parameters'] } })[] {
  const learningActive = Boolean(options?.learningEnabled ?? options?.betaAgentLearning ?? false);
  const perms = options?.toolPermissions || {};
  const isNormalChat = options?.chatModeOnly === true || options?.agentMode === false;

  return TOOL_DEFINITIONS.filter(tool => {
    if (!learningActive && isLearningTool(tool.name)) {
      return false;
    }
    if (isNormalChat && isProjectFilesystemOrAgentOnlyTool(tool.name)) {
      return false;
    }
    const perm = perms[tool.name];
    if (perm === 'removed' || perm === 'blocked') {
      return false;
    }
    return true;
  }).map(tool => ({
    ...tool,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function buildSystemPrompt(options: {
  persona?: string;
  projectTree?: string;
  memos?: MemoEntry[];
  todos?: TodoItem[];
  mentionedFiles?: { path: string; content: string }[];
  yoloMode?: boolean;
  agentMd?: string;
  soulMd?: string;
  identityMd?: string;
  userMd?: string;
  memoryMd?: string;
  betaAgentLearning?: boolean;
  learningEnabled?: boolean;
  toolPermissions?: Record<string, string>;
  activeSkillsBlock?: string;
  synapseLocalizationBlock?: string;
  isNormalChatMode?: boolean;
  agentMode?: boolean;
}): string {
  const learningActive = Boolean(options.learningEnabled ?? options.betaAgentLearning ?? false);
  const isNormalChat = options.isNormalChatMode === true || options.agentMode === false;

  const personaPrompts: Record<string, string> = {
    standard: 'You are "Dev0", the flagship autonomous AI Coding & Multi-Agent Orchestrator in the Dev0 IDE.',
    android: 'You are "Dev0" (Android Specialist), a Senior Android Developer Assistant specialized in Kotlin, Java, Jetpack Compose, Android SDK, and Gradle.',
    web: 'You are "Dev0" (Web Specialist), a Senior Web Developer Assistant specialized in TypeScript, React, Next.js, HTML, CSS, Node.js, and modern web technologies.',
    python: 'You are "Dev0" (Python Specialist), a Senior Python Developer Assistant specialized in Python, Django, Flask, FastAPI, Data Science, and Machine Learning.',
    fullstack: 'You are "Dev0" (Fullstack Architect), an experienced Fullstack Developer Assistant with expertise in frontend, backend, databases, Docker sandboxes, DevOps, and cloud architectures.',
  };

  let prompt = personaPrompts[options.persona || 'standard'] || personaPrompts.standard;
  if (isNormalChat) {
    prompt += `\n\n# NORMAL CHAT MODE (NO DIRECT PROJECT FILESYSTEM ACCESS)\n` +
      `- You are currently in **NORMAL CHAT MODE** (not Agent Mode).\n` +
      `- You do NOT have direct access to project filesystem tools (\`read_file\`, \`write_file\`, \`edit_file\`, \`delete_file\`, \`sub_agent\`, etc.).\n` +
      `- To provide code or files for the user to download, call \`zip_create\` to package one or more files into a downloadable \`.zip\` bundle card in the chat, and use \`zip_read\` to inspect any ZIP archive stored in this chat.\n` +
      `- To design a structured multi-step implementation plan that the user can launch in Agent Mode with one click ("Proceed in Agent Mode") or refine in a floating editor, call \`draft_agent_plan\`.\n` +
      `- You can also read snippets from other chat sessions via \`read_other_chat_messages\` and manage the standalone Synapse Memory Graph via \`memory_search\`, \`memory_update\`, \`memory_delete\`, and \`memory_graph_query\`.`;
  }
  prompt += `\n\n
# ROLE & IDENTITY: Dev0
You are **Dev0**, a Coding & Multi-Agent Orchestration Agent running inside an isolated user sandbox in the Dev0 IDE. You have EXCLUSIVE access to tools provided explicitly to you in this request via the "tools" schema.

# STRICT RULE: GENUINE TOOL CALLS ONLY, NO TEXT SIMULATIONS
- A tool MUST ALWAYS be called via the native Function Calling mechanism, NEVER via
  text like "I am calling X now" or Markdown code blocks that resemble a tool call.
- If you do NOT make a native tool call, by definition NOTHING has happened — even if
  you write in text that you have "created", "written", or "completed" something.
  Never describe an action as completed if you did not execute it via a real tool call.
- If a tool you need is missing: state this explicitly ("I do not have a tool for X"),
  do NOT guess, and do NOT pretend you did it anyway.

# SUB-AGENT WORKSPACES (.agents/<slug>/), CRON JOBS, SLEEP MODE & MANDATORY finish_task
- Every Sub-Agent (e.g., \`teamworker\`, \`auditor\`, \`developer\`, \`localizer\`, \`critic\`) has its own hidden workspace folder under \`.agents/<slug>/\` containing English documentation: \`README.md\`, \`RULES.md\`, \`STATUS.md\`, and \`LOG.md\`.
- These \`.agents/<slug>/\` folders are hidden from the user's normal project tree (like \`.gitignore\`d metadata) so they never clutter the user's codebase, but you and all Sub-Agents can inspect and update them using \`inspect_subagent_workspace\`, \`read_file\`, and \`finish_task\`.
- **Mandatory \`finish_task\` Call**: Whenever a Sub-Agent finishes its task (or when you complete a delegated multi-step workflow), it MUST invoke \`finish_task({ agent_slug, summary, files_modified, next_recommended_agent })\`. Calling \`finish_task\` updates \`.agents/<slug>/STATUS.md\` and automatically triggers any dependent Cron jobs (such as \`on_finish:developer\` -> \`auditor\`).
- **Cron Jobs & Sleep/Pause Mode**: Both you (\`Dev0\`) and Sub-Agents can create recurring or event-driven Cron jobs via \`create_cron_job\` when continuous verification, auditing, or follow-up tasks are beneficial, and can pause/wake Sub-Agents via \`sleep_agent\`.

# WORKFLOW
1. UNDERSTAND: Summarize in one sentence what the task requires.
2. MINIMAL TOOL USAGE: Use only the tools necessary for THIS specific step.
   Do not call multiple tools "in advance".
3. READ BEFORE WRITE: Before you edit a file with edit_file/write_file, read it
   first with read_file — unless it demonstrably does not exist yet (then use create_file).
4. VERIFY AFTER EVERY CHANGE: After create_file/write_file/edit_file, verify the
   result (e.g., with verify_file or another read_file) before considering the step
   complete. A tool call that returns an error is NOT complete —
   correct the parameters and try again, or report the error.
5. CALL finish_task / task_complete when all necessary changes have been confirmed by successful
   tool calls. Flow text that sounds like "done" never replaces a genuine finish_task call.

# ERROR HANDLING
- Tool error → try again once with corrected parameters. If it fails again,
  briefly explain WHAT failed and WHY, instead of ignoring it or claiming
  it worked anyway.
- If a tool is missing from the list but is described as available (e.g.,
  sub_agent), and the call returns "Unknown Tool": report this to the user as a
  technical issue, do not invent a workaround.

# ANTI-HALLUCINATION
- Mark your confidence for statements about external facts (library versions, APIs,
  syntax) that you have not checked with a tool: [SURE] / [PROBABLE] / [UNSURE].
- Do not invent file paths, function names, or libraries. If unsure if something
  exists: verify with list_directory/search_files/read_file, do not guess.
- "I do not know" or "I cannot verify this with my tools" is always
  better than a fabricated answer.

# WEB RESEARCH (if web_search/web_fetch are available)
- Use web_search only for questions about current/external information, not for questions about
  your own project code (use read_file, search_files for that).
- If web_search returns empty results: say so directly ("No results found"),
  do not invent content to fill an answer.

# TOKEN EFFICIENCY
- Do not quote file contents completely if an excerpt is sufficient.
- Summarize completed steps in a maximum of 1–2 sentences before proceeding to the next step.

# RESPONSE FORMAT
- Short, direct, no filler phrases ("With pleasure!", "Sure, no problem!").
- Structure: What was done (with reference to actual tool results) → what is pending
  → confidence/uncertainty if applicable.
`;

  prompt += '\n\n## Core Rules\n';
  prompt += '- ALWAYS reply in English in technical files/logs, and match the user language in chat.\n';
  prompt += '- Your name is **Dev0**. Never expose internal IDE host source files; operate strictly within the user sandbox.\n';
  prompt += '- You have access to the tools defined below. Use ONLY these tools. Use get_active_tools to see which ones are available.\n';
  prompt += '- IMPORTANT: You MUST ALWAYS read a file with read_file BEFORE you edit it with write_file or edit_file.\n';
  prompt += '- If edit_file fails (text not found), read the file again with read_file.\n';
  prompt += '- DO NOT invent tools that do not exist. You only have the defined tools.\n';
  prompt += '- ACT IMMEDIATELY. DO NOT ask in plain text if you should do something. Use tools DIRECTLY.\n';
  prompt += '- QUESTION & SUB-AGENT FLOATING WINDOW RULE: If you genuinely need to ask clarifying questions, OR if the user asks to start/configure a sub-agent without specifying role and task, you MUST call the `ask_user_question` tool (with `is_sub_agent: true` for sub-agent questions) instead of writing plain-text questions.\n';
  prompt += '- For complex tasks: Use "think" tool to reason, then act immediately.\n';
  prompt += '- Format responses with Markdown: **bold**, `code`, lists etc.\n';
  prompt += '- If you need to change multiple files, use "think" first to create a plan, then execute EVERYTHING immediately.\n';
  prompt += '- Be efficient: Explain briefly what you are doing, but act above all.\n';
  prompt += '- For complex tasks: ALWAYS use the "think" tool FIRST to analyze the approach.\n';
  prompt += '- Mention in your thought process which tools you will use (e.g., "I need to work with read_file").\n';
  prompt += '- ALWAYS write complete sentences. No incomplete sentences!\n';

  if (learningActive) {
    prompt += '\n## Learning Capability (Active)\n';
    prompt += 'You have access to 5 persistent identity files. These files survive sessions and define who you are and what you know about the user.\n';
    prompt += 'You MUST actively update these files when you gain new insights.\n\n';
    prompt += '### Identity Files\n';
    prompt += '- **SOUL.md** — Your personality, values, and behavioral philosophy. Update with `update_soul_md`.\n';
    prompt += '- **AGENTS.md** — Your behavioral rules, reasoning protocol, and tool usage. Update with `update_agents_md`.\n';
    prompt += '- **IDENTITY.md** — Your name, role, and outward presentation. Update with `update_identity_md`.\n';
    prompt += '- **USER.md** — User profile: preferences, style, context, projects. Update with `update_user_md`.\n';
    prompt += '- **MEMORY.md** — Long-term memory: decisions, errors, learned patterns. Update with `update_memory_md`.\n\n';
    prompt += '### Learning Rules\n';
    prompt += '- Only use `read_identity_files` at the very beginning of a completely new user session if you need full context. Do not read them repeatedly for sub-tasks.\n';
    prompt += '- Update USER.md when you discover new user preferences.\n';
    prompt += '- Update MEMORY.md at the end of important tasks with a summary.\n';
    prompt += '- Update AGENTS.md when you find new effective workflows.\n';
    prompt += '- Update SOUL.md only if fundamental values/style should change.\n';
    prompt += '- NEVER DELETE these files. You may only update them.\n';
    prompt += '- Always write the FULL new content, not just changes.\n';

    if (options.soulMd && options.soulMd.trim()) {
      prompt += '\n## SOUL.md\n' + options.soulMd.slice(0, 500) + (options.soulMd.length > 500 ? '... (use read_identity_files to read more)' : '') + '\n';
    }

    if (options.agentMd && options.agentMd.trim()) {
      prompt += '\n## AGENTS.md\n' + options.agentMd.slice(0, 500) + (options.agentMd.length > 500 ? '... (use read_identity_files to read more)' : '') + '\n';
    }

    if (options.identityMd && options.identityMd.trim()) {
      prompt += '\n## IDENTITY.md\n' + options.identityMd.slice(0, 500) + (options.identityMd.length > 500 ? '... (use read_identity_files to read more)' : '') + '\n';
    }

    if (options.userMd && options.userMd.trim()) {
      prompt += '\n## USER.md\n' + options.userMd.slice(0, 500) + (options.userMd.length > 500 ? '... (use read_identity_files to read more)' : '') + '\n';
    }

    if (options.memoryMd && options.memoryMd.trim()) {
      prompt += '\n## MEMORY.md\n' + options.memoryMd.slice(0, 500) + (options.memoryMd.length > 500 ? '... (use read_identity_files to read more)' : '') + '\n';
    }
  }

  if (options.toolPermissions) {
    const blocked = Object.entries(options.toolPermissions)
      .filter(([k, v]) => v === 'blocked' && (learningActive || !isLearningTool(k)))
      .map(([k]) => k);
    const removed = Object.entries(options.toolPermissions).filter(([_, v]) => v === 'removed').map(([k]) => k);
    if (blocked.length > 0) {
      prompt += '\n## Blocked Tools\n';
      prompt += 'The following tools are blocked by the user. DO NOT use them. If you absolutely need them, ask the user to enable them in settings:\n';
      blocked.forEach(t => { prompt += '- ' + t + ' (blocked - please ask user for permission)\n'; });
    }
    if (removed.length > 0) {
      prompt += '\n(Note: Some tools are not available.)\n';
    }
  }

  if (!options.yoloMode) {
    prompt += '\n## Confirmation Mode\n';
    prompt += '- For destructive actions (deleting, complete overwrite): Ask for confirmation.\n';
    prompt += '- For creating and editing: Act DIRECTLY without asking.\n';
  } else {
    prompt += '\n## YOLO Mode Active\n';
    prompt += '- You may create, edit, and delete files without asking for confirmation.\n';
    prompt += '- Act quickly and efficiently, but inform the user about changes.\n';
  }

  prompt += '\n## Project Structure\n```\n' + (options.projectTree || '(Empty Project)') + '\n```\n';

  if (learningActive && options.memos && options.memos.length > 0) {
    prompt += '\n## Project Memos\n';
    options.memos.forEach(m => { prompt += '- ' + m.content + '\n'; });
  }

  if (options.todos && options.todos.length > 0) {
    prompt += '\n## Current Todos\n';
    options.todos.forEach(t => {
      prompt += '- [' + (t.completed ? 'x' : ' ') + '] (ID: ' + t.id + ') ' + t.text + '\n';
    });
  }

  if (options.mentionedFiles && options.mentionedFiles.length > 0) {
    prompt += '\n## Referenced Files\n';
    options.mentionedFiles.forEach(f => {
      prompt += '\n### ' + f.path + '\n```\n' + truncateToolResult(f.content || '', MAX_TOOL_RESULT_LENGTH) + '\n```\n';
    });
  }

  if (options.synapseLocalizationBlock && options.synapseLocalizationBlock.trim()) {
    prompt += '\n' + options.synapseLocalizationBlock.trim() + '\n';
  }

  if (options.activeSkillsBlock && options.activeSkillsBlock.trim()) {
    prompt += '\n' + options.activeSkillsBlock.trim() + '\n';
  }

  return prompt;
}

export function formatMessagesForOpenAI(
  messages: ChatMessage[],
  systemPrompt: string,
  flattenToolsAsText: boolean = false,
) {
  const formatted: any[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of messages) {
    if (msg.role === 'tool') {
      if (flattenToolsAsText) {
        const toolName = msg.toolName || 'tool';
        formatted.push({
          role: 'user',
          content: '[Tool-Result from ' + toolName + ']:\n' + truncateToolResult(msg.content || '', MAX_TOOL_RESULT_LENGTH),
        });
      } else {
        formatted.push({
          role: 'tool',
          tool_call_id: msg.toolCallId || '',
          content: truncateToolResult(msg.content || '', MAX_TOOL_RESULT_LENGTH),
        });
      }
    } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      if (flattenToolsAsText) {
        let assistantContent = msg.content || '';
        for (const tc of msg.toolCalls) {
          assistantContent += '\n```tool\n' + JSON.stringify({ name: tc.name, arguments: tc.arguments || {} }) + '\n```';
        }
        formatted.push({
          role: 'assistant',
          content: assistantContent.trim() || '(Tool executed)',
        });
      } else {
        formatted.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map(tc => {
            const sig = tc.thoughtSignature || tc.extra_content?.google?.thought_signature;
            const extraContent = tc.extra_content || (sig ? { google: { thought_signature: sig } } : undefined);
            return {
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments || {}) },
              ...(sig ? { thought_signature: sig } : {}),
              ...(extraContent ? { extra_content: extraContent } : {}),
            };
          }),
        });
      }
    } else {
      formatted.push({ role: msg.role, content: msg.content || '' });
    }
  }

  return formatted;
}

function formatMessagesForAnthropic(messages: ChatMessage[]) {
  const formatted: any[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'user') {
      formatted.push({ role: 'user', content: [{ type: 'text', text: msg.content || '' }] });
      i++;
    } else if (msg.role === 'assistant') {
      const content: any[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments || {} });
        }
      }
      if (content.length === 0) content.push({ type: 'text', text: '' });
      formatted.push({ role: 'assistant', content });
      i++;

      const toolResults: any[] = [];
      while (i < messages.length && messages[i].role === 'tool') {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: messages[i].toolCallId || '',
          content: truncateToolResult(messages[i].content || '', MAX_TOOL_RESULT_LENGTH),
        });
        i++;
      }
      if (toolResults.length > 0) {
        formatted.push({ role: 'user', content: toolResults });
      }
    } else if (msg.role === 'tool') {
      formatted.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: msg.toolCallId || '', content: truncateToolResult(msg.content || '', MAX_TOOL_RESULT_LENGTH) }],
      });
      i++;
    } else {
      i++;
    }
  }

  return formatted;
}

export function formatMessagesForGemini(messages: ChatMessage[], forceFlattenTools: boolean = false) {
  const contents: any[] = [];
  // Check if any historical assistant toolCall is missing a thoughtSignature.
  // Gemini 2.5/3 thinking models reject Turn 2+ with HTTP 400 if any functionCall part lacks thoughtSignature.
  const hasUnsignedToolCalls = forceFlattenTools || messages.some(
    m => m.role === 'assistant' && Array.isArray(m.toolCalls) && m.toolCalls.some(tc => !tc.thoughtSignature && !tc.extra_content?.google?.thought_signature)
  );

  for (const msg of messages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content || '' }] });
    } else if (msg.role === 'assistant') {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        if (hasUnsignedToolCalls) {
          let toolText = '';
          for (const tc of msg.toolCalls) {
            toolText += '\n```tool\n' + JSON.stringify({ name: tc.name, arguments: tc.arguments || {} }) + '\n```';
          }
          parts.push({ text: toolText.trim() });
        } else {
          for (const tc of msg.toolCalls) {
            const sig = tc.thoughtSignature || tc.extra_content?.google?.thought_signature;
            parts.push({
              functionCall: { name: tc.name, args: tc.arguments || {} },
              ...(sig ? { thoughtSignature: sig } : {}),
            });
          }
        }
      }
      if (parts.length === 0) parts.push({ text: '' });
      contents.push({ role: 'model', parts });
    } else if (msg.role === 'tool') {
      if (hasUnsignedToolCalls) {
        contents.push({
          role: 'user',
          parts: [{ text: '[Tool-Result from ' + (msg.toolName || 'tool') + ']:\n' + truncateToolResult(msg.content || '', MAX_TOOL_RESULT_LENGTH) }],
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name: msg.toolName || 'unknown', response: { result: truncateToolResult(msg.content || '', MAX_TOOL_RESULT_LENGTH) } } }],
        });
      }
    }
  }

  return contents;
}

export function isThoughtSignatureError(_status: number, errorText: string): boolean {
  const lower = (errorText || '').toLowerCase();
  return (
    lower.includes('thoughtsignature') ||
    lower.includes('thought_signature') ||
    (lower.includes('functioncall') && lower.includes('signature'))
  );
}

async function callOpenAI(apiKey: string, model: string, messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string, signal: AbortSignal, endpoint?: string) {
  let url = 'https://api.openai.com/v1/chat/completions';
  if (endpoint) {
    let cleanEndpoint = endpoint.trim();
    if (cleanEndpoint.startsWith('ttps://')) cleanEndpoint = 'https://' + cleanEndpoint.substring(7);
    else if (cleanEndpoint.startsWith('ttp://')) cleanEndpoint = 'http://' + cleanEndpoint.substring(6);

    if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
      if (cleanEndpoint.startsWith('/')) {
        // Relative URL
      } else {
        cleanEndpoint = 'https://' + cleanEndpoint;
      }
    }
    if (cleanEndpoint.endsWith('/v1/chat/completions')) {
      url = cleanEndpoint;
    } else {
      url = cleanEndpoint.replace(/\/$/, '') + '/v1/chat/completions';
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = 'Bearer ' + apiKey;
  }

  const executeRequest = async (flattenTools: boolean) => {
    const effectiveSystemPrompt = flattenTools && tools.length > 0
      ? systemPrompt + buildToolCallInstructions(tools)
      : systemPrompt;
    const formattedMessages = formatMessagesForOpenAI(messages, effectiveSystemPrompt, flattenTools);

    const body: any = {
      model,
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    if (tools.length > 0 && !flattenTools) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    console.log('[AI] Calling OpenAI-compatible:', model, 'endpoint:', endpoint || 'openai', 'messages:', formattedMessages.length, 'flattenTools:', flattenTools);

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
  };

  let usedFlattenedTools = false;
  let response = await executeRequest(false);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    if (isThoughtSignatureError(response.status, errorText)) {
      console.log('[AI] Detected HTTP 400 thoughtSignature error on OpenAI-compatible endpoint; retrying with flattened tool turns...');
      usedFlattenedTools = true;
      response = await executeRequest(true);
      if (!response.ok) {
        const retryErrorText = await response.text().catch(() => 'Unknown error');
        throw new AIError(response.status, 'Error (' + response.status + '): ' + retryErrorText.slice(0, 300));
      }
    } else {
      console.log('[AI] OpenAI-compatible error:', response.status, errorText);
      throw new AIError(response.status, 'Error (' + response.status + '): ' + errorText.slice(0, 300));
    }
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) throw new Error('No response received from model.');

  const rawContent = choice.message?.content || '';
  const nativeCalls = (choice.message?.tool_calls || []).map((tc: any) => {
    const sig = tc.thought_signature || tc.thoughtSignature || tc.extra_content?.google?.thought_signature || tc.function?.thought_signature;
    return {
      id: tc.id || 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: tc.function?.name || '',
      arguments: safeParseJSON(tc.function?.arguments || '{}'),
      ...(sig ? { thoughtSignature: sig } : {}),
      ...(tc.extra_content ? { extra_content: tc.extra_content } : {}),
    };
  });

  const promptTextForTokens = messages.map(m => m.content || '').join('\n') + '\n' + systemPrompt;
  const tokenUsage = extractActualTokenUsage(data, promptTextForTokens, rawContent, endpoint || 'openai', model);

  if (tools.length > 0 && nativeCalls.length === 0 && rawContent) {
    const { toolCalls: textCalls, cleanContent } = parseToolCallsFromText(rawContent);
    if (textCalls.length > 0) {
      return {
        content: cleanContent,
        toolCalls: textCalls,
        tokenUsage,
      };
    }
  }

  return {
    content: rawContent,
    toolCalls: nativeCalls,
    tokenUsage,
  };
}

async function callOpenRouter(apiKey: string, model: string, messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string, signal: AbortSignal) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const executeRequest = async (flattenTools: boolean) => {
    const effectiveSystemPrompt = flattenTools && tools.length > 0
      ? systemPrompt + buildToolCallInstructions(tools)
      : systemPrompt;
    const formattedMessages = formatMessagesForOpenAI(messages, effectiveSystemPrompt, flattenTools);

    const body: any = {
      model,
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    if (tools.length > 0 && !flattenTools) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    console.log('[AI] Calling OpenRouter:', model, 'messages:', formattedMessages.length, 'flattenTools:', flattenTools);

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://studio-ide.app',
        'X-Title': 'Studio Mobile IDE',
      },
      body: JSON.stringify(body),
      signal,
    });
  };

  let usedFlattenedTools = false;
  let response = await executeRequest(false);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    if (isThoughtSignatureError(response.status, errorText)) {
      console.log('[AI] Detected HTTP 400 thoughtSignature error on OpenRouter; retrying with flattened tool turns...');
      usedFlattenedTools = true;
      response = await executeRequest(true);
      if (!response.ok) {
        const retryErrorText = await response.text().catch(() => 'Unknown error');
        throw new AIError(response.status, 'OpenRouter error (' + response.status + '): ' + retryErrorText.slice(0, 300));
      }
    } else {
      console.log('[AI] OpenRouter error:', response.status, errorText);
      throw new AIError(response.status, 'OpenRouter error (' + response.status + '): ' + errorText.slice(0, 300));
    }
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) throw new Error('No response received from OpenRouter.');

  const rawContent = choice.message?.content || '';
  const nativeCalls = (choice.message?.tool_calls || []).map((tc: any) => {
    const sig = tc.thought_signature || tc.thoughtSignature || tc.extra_content?.google?.thought_signature || tc.function?.thought_signature;
    return {
      id: tc.id || 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: tc.function?.name || '',
      arguments: safeParseJSON(tc.function?.arguments || '{}'),
      ...(sig ? { thoughtSignature: sig } : {}),
      ...(tc.extra_content ? { extra_content: tc.extra_content } : {}),
    };
  });

  const promptTextForTokens = messages.map(m => m.content || '').join('\n') + '\n' + systemPrompt;
  const tokenUsage = extractActualTokenUsage(data, promptTextForTokens, rawContent, 'openrouter', model);

  if (tools.length > 0 && nativeCalls.length === 0 && rawContent) {
    const { toolCalls: textCalls, cleanContent } = parseToolCallsFromText(rawContent);
    if (textCalls.length > 0) {
      return {
        content: cleanContent,
        toolCalls: textCalls,
        tokenUsage,
      };
    }
  }

  return {
    content: rawContent,
    toolCalls: nativeCalls,
    tokenUsage,
  };
}

async function callAnthropic(apiKey: string, model: string, messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string, signal: AbortSignal) {
  const formattedMessages = formatMessagesForAnthropic(messages);

  const body: any = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: formattedMessages,
  };

  if (tools.length > 0) {
    body.tools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  console.log('[AI] Calling Anthropic:', model, 'messages:', formattedMessages.length);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.log('[AI] Anthropic error:', response.status, errorText);
    throw new AIError(response.status, 'Anthropic error (' + response.status + '): ' + errorText.slice(0, 300));
  }

  const data = await response.json();
  let content = '';
  const toolCalls: any[] = [];

  for (const block of data.content || []) {
    if (block.type === 'text') {
      content += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id || 'tc_' + Date.now(),
        name: block.name,
        arguments: block.input || {},
      });
    }
  }

  return { content, toolCalls };
}

async function callGemini(apiKey: string, model: string, messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string, signal: AbortSignal) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  const executeRequest = async (forceFlattenTools: boolean) => {
    const contents = formatMessagesForGemini(messages, forceFlattenTools);
    const effectiveSystemPrompt = forceFlattenTools && tools.length > 0
      ? systemPrompt + buildToolCallInstructions(tools)
      : systemPrompt;

    const body: any = {
      contents,
      systemInstruction: { parts: [{ text: effectiveSystemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    };

    if (tools.length > 0 && !forceFlattenTools) {
      body.tools = [{
        functionDeclarations: tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }];
    }

    console.log('[AI] Calling Gemini:', model, 'contents:', contents.length, 'forceFlattenTools:', forceFlattenTools);

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  };

  let usedFlattenedTools = false;
  let response = await executeRequest(false);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    if (isThoughtSignatureError(response.status, errorText)) {
      console.log('[AI] Detected HTTP 400 thoughtSignature error on Gemini; retrying with flattened tool turns...');
      usedFlattenedTools = true;
      response = await executeRequest(true);
      if (!response.ok) {
        const retryErrorText = await response.text().catch(() => 'Unknown error');
        throw new AIError(response.status, 'Gemini error (' + response.status + '): ' + retryErrorText.slice(0, 300));
      }
    } else {
      console.log('[AI] Gemini error:', response.status, errorText);
      throw new AIError(response.status, 'Gemini error (' + response.status + '): ' + errorText.slice(0, 300));
    }
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  let content = '';
  const toolCalls: any[] = [];

  for (const part of parts) {
    if (part.text) {
      content += part.text;
    } else if (part.functionCall) {
      const sig = part.thoughtSignature || part.thought_signature || part.functionCall.thoughtSignature || part.functionCall.thought_signature;
      toolCalls.push({
        id: 'gem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
        ...(sig ? { thoughtSignature: sig } : {}),
      });
    }
  }

  const promptTextForTokens = messages.map(m => m.content || '').join('\n') + '\n' + systemPrompt;
  const tokenUsage = extractActualTokenUsage(data, promptTextForTokens, content, 'gemini', model);

  if (tools.length > 0 && toolCalls.length === 0 && content) {
    const { toolCalls: textCalls, cleanContent } = parseToolCallsFromText(content);
    if (textCalls.length > 0) {
      return { content: cleanContent, toolCalls: textCalls, tokenUsage };
    }
  }

  return { content, toolCalls, tokenUsage };
}

export function repairAndParseJSON(str: string): Record<string, any> | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      // Repair common local LLM JSON quirks: trailing commas, unescaped newlines
      const repaired = trimmed
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

function safeParseJSON(str: string): Record<string, any> {
  const parsed = repairAndParseJSON(str);
  if (parsed && typeof parsed === 'object') return parsed;
  console.log('[AI] Failed to parse JSON:', (str || '').slice(0, 100));
  return {};
}

class AIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AIError';
  }
}

function isRateLimitError(error: any): boolean {
  if (error instanceof AIError && error.status === 429) return true;
  if (error?.message?.includes('429')) return true;
  if (error?.message?.toLowerCase()?.includes('rate') && error?.message?.toLowerCase()?.includes('limit')) return true;
  return false;
}

function isAuthError(error: any): boolean {
  if (error?.message?.includes('Access restricted. Deposit required')) return false;
  if (error instanceof AIError && (error.status === 401 || error.status === 403)) return true;
  if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) return true;
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getProviderForFallback(currentProvider: AIProviderType, settings: Record<string, string>): { provider: AIProviderType; key: string; model: string } | null {
  if (currentProvider !== 'rork') {
    return { provider: 'rork', key: 'rork_builtin', model: 'rork-default' };
  }

  const fallbackOrder: { provider: AIProviderType; keyName: string; model: string }[] = [
    { provider: 'groq', keyName: 'groqKey', model: 'llama-3.3-70b-versatile' },
    { provider: 'gemini', keyName: 'geminiKey', model: 'gemini-2.0-flash' },
    { provider: 'openrouter', keyName: 'openrouterKey', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    { provider: 'openai', keyName: 'openaiKey', model: 'gpt-4o-mini' },
    { provider: 'anthropic', keyName: 'anthropicKey', model: 'claude-3-5-haiku-20241022' },
  ];

  for (const fb of fallbackOrder) {
    if (fb.provider === currentProvider) continue;
    const key = settings[fb.keyName];
    if (key && key.length > 5) {
      return { provider: fb.provider, key, model: fb.model };
    }
  }

  return null;
}

function buildToolCallInstructions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';
  let instructions = '\n## Tool-Calling Instructions\n';
  instructions += 'You can call tools by outputting them in a special format.\n';
  instructions += 'Write tool calls EXACTLY in this format (JSON in a tool block):\n';
  instructions += '```tool\n{"name": "tool_name", "arguments": {"param1": "value1"}}\n```\n\n';
  instructions += 'IMPORTANT:\n';
  instructions += '- Write ONLY ONE tool block per message.\n';
  instructions += '- Write the tool block at the BEGINNING of your response, BEFORE writing text.\n';
  instructions += '- After calling the tool, the result will be returned to you and you can call more tools.\n';
  instructions += '- When you are FINISHED, call the "task_complete" tool.\n';
  instructions += '- Use tools ACTIVELY and IMMEDIATELY. DO NOT ask if you should do something.\n';
  instructions += '- DO NOT hallucinate or claim you have executed a tool if you did not output the exact ```tool block.\n';
  instructions += '- DO NOT describe that you are calling a tool unless you actually output the ```tool block.\n\n';
  instructions += '## Available Tools\n';
  for (const t of tools) {
    const params = t.parameters?.properties
      ? Object.entries(t.parameters.properties).map(([k, v]: [string, any]) => k + ' (' + (v?.type || 'string') + '): ' + (v?.description || '')).join(', ')
      : '';
    const required = t.parameters?.required?.join(', ') || '';
    instructions += '- **' + t.name + '**: ' + t.description + '\n';
    if (params) instructions += '  Parameters: ' + params + '\n';
    if (required) instructions += '  Required: ' + required + '\n';
  }
  return instructions;
}

export function parseToolCallsFromText(text: string): { toolCalls: { id: string; name: string; arguments: Record<string, any> }[]; cleanContent: string } {
  const toolCalls: { id: string; name: string; arguments: Record<string, any> }[] = [];
  if (!text || typeof text !== 'string') return { toolCalls, cleanContent: '' };
  let cleanContent = text;

  const makeId = () => 'rk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

  // Tier 2A: Fenced ```tool or ```json blocks containing {"name"|"tool": "...", "arguments"|"params": {...}}
  const fencedRegex = /```(?:tool|json)?\s*\n([\s\S]*?)\n```/gi;
  let match: RegExpExecArray | null;
  while ((match = fencedRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    const parsed = repairAndParseJSON(candidate);
    const toolName = parsed?.name || parsed?.tool || parsed?.function;
    if (parsed && typeof toolName === 'string') {
      toolCalls.push({
        id: makeId(),
        name: toolName.trim(),
        arguments: parsed.arguments || parsed.params || parsed.args || parsed.input || {},
      });
      cleanContent = cleanContent.replace(match[0], '').trim();
    }
  }

  // Tier 3A: ReAct XML Hybrid Tags: <tool>tool_name</tool><args>{...}</args>
  const reactXmlRegex = /<tool>\s*([a-zA-Z0-9_]+)\s*<\/tool>\s*<args>([\s\S]*?)<\/args>/gi;
  while ((match = reactXmlRegex.exec(cleanContent)) !== null) {
    const toolName = match[1].trim();
    const argsObj = repairAndParseJSON(match[2].trim()) || {};
    toolCalls.push({
      id: makeId(),
      name: toolName,
      arguments: argsObj,
    });
    cleanContent = cleanContent.replace(match[0], '').trim();
  }

  // Tier 3B: Qwen / Hermes / Llama <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  const hermesXmlRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  while ((match = hermesXmlRegex.exec(cleanContent)) !== null) {
    const parsed = repairAndParseJSON(match[1].trim());
    const toolName = parsed?.name || parsed?.tool;
    if (parsed && typeof toolName === 'string') {
      toolCalls.push({
        id: makeId(),
        name: toolName.trim(),
        arguments: parsed.arguments || parsed.params || parsed.args || {},
      });
      cleanContent = cleanContent.replace(match[0], '').trim();
    }
  }

  // Tier 3C: Classic ReAct Action / Action Input format
  if (toolCalls.length === 0) {
    const actionRegex = /Action\s*:\s*([a-zA-Z0-9_]+)\s*\r?\nAction\s+Input\s*:\s*(\{[\s\S]*?\})(?=\r?\n|$)/gi;
    while ((match = actionRegex.exec(cleanContent)) !== null) {
      const toolName = match[1].trim();
      const argsObj = repairAndParseJSON(match[2].trim()) || {};
      toolCalls.push({
        id: makeId(),
        name: toolName,
        arguments: argsObj,
      });
      cleanContent = cleanContent.replace(match[0], '').trim();
    }
  }

  // Tier 2B: Inline JSON tool call fallback
  const inlineRegex = /\{\s*"(?:name|tool)"\s*:\s*"(\w+)"\s*,\s*"(?:arguments|params|args)"\s*:\s*(\{[^}]*\})\s*\}/g;
  if (toolCalls.length === 0) {
    while ((match = inlineRegex.exec(cleanContent)) !== null) {
      const args = repairAndParseJSON(match[2]);
      if (args) {
        toolCalls.push({
          id: makeId(),
          name: match[1],
          arguments: args,
        });
        cleanContent = cleanContent.replace(match[0], '').trim();
      }
    }
  }

  return { toolCalls, cleanContent };
}

function extractNativeToolCalls(data: any): { id: string; name: string; arguments: Record<string, any>; thoughtSignature?: string; extra_content?: Record<string, any> }[] {
  const rawCalls = data?.choices?.[0]?.message?.tool_calls || data?.toolCalls;
  if (!Array.isArray(rawCalls)) return [];
  const extracted: { id: string; name: string; arguments: Record<string, any>; thoughtSignature?: string; extra_content?: Record<string, any> }[] = [];
  for (const tc of rawCalls) {
    const name = tc?.function?.name || tc?.name;
    if (!name || typeof name !== 'string') continue;
    let args: Record<string, any> = {};
    const rawArgs = tc?.function?.arguments ?? tc?.arguments;
    if (typeof rawArgs === 'string') {
      try {
        args = JSON.parse(rawArgs);
      } catch {
        args = {};
      }
    } else if (rawArgs && typeof rawArgs === 'object') {
      args = rawArgs;
    }
    const sig = tc?.thought_signature || tc?.thoughtSignature || tc?.extra_content?.google?.thought_signature || tc?.function?.thought_signature;
    extracted.push({
      id: tc?.id || 'tc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      name,
      arguments: args,
      ...(sig ? { thoughtSignature: sig } : {}),
      ...(tc?.extra_content ? { extra_content: tc.extra_content } : {}),
    });
  }
  return extracted;
}

export async function callPollinationsFallback(
  formattedMessages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  tools?: ToolDefinition[],
  _signal?: AbortSignal,
): Promise<{ content: string; toolCalls: { id: string; name: string; arguments: Record<string, any> }[]; usedFallback: boolean; fallbackProvider: string }> {
  const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
  console.log('[AI] Falling back to keyless Pollinations AI (model: openai), messages:', formattedMessages.length);

  // Always use a fresh timeout controller so a timed-out primary Rork signal does not abort the fallback
  const fbController = new AbortController();
  const fbTimeout = setTimeout(() => fbController.abort(), 45000);

  let res: Response;
  try {
    res = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: formattedMessages.length > 0 ? formattedMessages : [{ role: 'user', content: 'Hello' }],
      }),
      signal: fbController.signal,
    });
  } finally {
    clearTimeout(fbTimeout);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error('Pollinations Fallback Error: ' + res.status + ' ' + errText);
  }

  let text = '';
  let parsedData: any = null;
  if (typeof res.text === 'function') {
    const rawText = await res.text();
    try {
      parsedData = JSON.parse(rawText);
      text =
        parsedData?.choices?.[0]?.message?.content ||
        parsedData?.completion ||
        (typeof parsedData === 'string' ? parsedData : '');
    } catch {
      text = rawText;
    }
  } else if (typeof res.json === 'function') {
    parsedData = await res.json();
    text =
      parsedData?.choices?.[0]?.message?.content ||
      parsedData?.completion ||
      (typeof parsedData === 'string' ? parsedData : '');
  }

  const nativeToolCalls = extractNativeToolCalls(parsedData);

  if ((!text || !text.trim()) && nativeToolCalls.length === 0) {
    throw new Error('Empty response received from Pollinations fallback model.');
  }

  if (tools && tools.length > 0) {
    const { toolCalls: textToolCalls, cleanContent } = parseToolCallsFromText(text || '');
    const combinedCalls = [...nativeToolCalls, ...textToolCalls];
    const allowLearning = tools.some(t => isLearningTool(t.name));
    const filteredCalls = allowLearning ? combinedCalls : combinedCalls.filter(tc => !isLearningTool(tc.name));
    return {
      content: cleanContent,
      toolCalls: filteredCalls,
      usedFallback: true,
      fallbackProvider: 'pollinations',
    };
  }

  return {
    content: text,
    toolCalls: [],
    usedFallback: true,
    fallbackProvider: 'pollinations',
  };
}

async function callRork(
  messages: ChatMessage[],
  systemPrompt: string,
  tools?: ToolDefinition[],
  model?: string,
  signal?: AbortSignal,
): Promise<{ content: string; toolCalls: { id: string; name: string; arguments: Record<string, any>; thoughtSignature?: string; extra_content?: Record<string, any> }[]; usedFallback?: boolean; fallbackProvider?: string }> {
  const safeModel = resolveDefaultModel('rork', model) || DEFAULT_RORK_MODEL;
  const sanitizedMessages = compressAndSanitizeMessagesForAPI(messages, { maxToolLength: MAX_TOOL_RESULT_LENGTH });
  console.log('[AI] Calling Rork free model:', safeModel, 'messages:', sanitizedMessages.length, 'tools:', tools?.length ?? 0);

  type UserMessage = { role: 'user'; content: string };
  type AssistantMessage = { role: 'assistant'; content: string };

  const formatted: (UserMessage | AssistantMessage)[] = [];

  let fullSystemPrompt = systemPrompt;
  if (tools && tools.length > 0) {
    fullSystemPrompt += buildToolCallInstructions(tools);
  }

  for (const msg of sanitizedMessages) {
    if (msg.role === 'tool') {
      const toolName = msg.toolName || 'tool';
      const truncatedToolContent = truncateToolResult(msg.content || '(leer)', MAX_TOOL_RESULT_LENGTH);
      formatted.push({
        role: 'user',
        content: '[Tool-Result from ' + toolName + ']:\n' + truncatedToolContent,
      });
      continue;
    }
    if (msg.role === 'user') {
      formatted.push({ role: 'user', content: msg.content || '' });
    } else if (msg.role === 'assistant') {
      let assistantContent = msg.content || '';
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          assistantContent += '\n```tool\n' + JSON.stringify({ name: tc.name, arguments: tc.arguments }) + '\n```';
        }
      }
      formatted.push({ role: 'assistant', content: assistantContent });
    }
  }

  if (formatted.length > 0 && formatted[0].role === 'user') {
    formatted[0] = {
      role: 'user',
      content: '[System Instruction: ' + fullSystemPrompt.slice(0, 30000) + ']\n\n' + (formatted[0].content || ''),
    };
  } else {
    formatted.unshift({ role: 'user', content: '[System Instruction: ' + fullSystemPrompt.slice(0, 30000) + ']' });
  }

  // Ensure strict alternating pattern if required by SDK, or clean empty content
  const cleanedFormatted: (UserMessage | AssistantMessage)[] = [];
  for (const msg of formatted) {
    if (typeof msg.content === 'string' && msg.content.trim() === '') {
      msg.content = '(empty message)';
    }
    cleanedFormatted.push(msg);
  }

  const isWeb = typeof window !== 'undefined';
  const RORK_URL = 'https://toolkit.rork.com/llm/text';
  const fetchUrl = isWeb ? '/api/chat' : RORK_URL;

  const bodyPayload = isWeb
    ? JSON.stringify({ endpoint: RORK_URL, model: safeModel, messages: cleanedFormatted })
    : JSON.stringify({ model: safeModel, messages: cleanedFormatted });

  const rorkMaxRetries = 2; // Initial attempt + up to 2 retries with exponential backoff
  let lastRorkError: any = null;

  for (let retry = 0; retry <= rorkMaxRetries; retry++) {
    const attemptController = new AbortController();
    const attemptTimeout = setTimeout(() => attemptController.abort(), 25000);
    const onParentAbort = () => attemptController.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(attemptTimeout);
        break;
      }
      signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      if (retry > 0) {
        const backoffMs = Math.min(500 * Math.pow(2, retry - 1), 2500);
        console.log(`[AI] Rork retry ${retry}/${rorkMaxRetries} after ${backoffMs}ms backoff...`);
        await sleep(backoffMs);
      }

      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyPayload,
        signal: attemptController.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error('Rork API Error: ' + res.status + ' ' + errText);
      }

      const data = await res.json();
      const text = data?.completion || data?.choices?.[0]?.message?.content || '';
      const nativeToolCalls = extractNativeToolCalls(data);

      if (!text && nativeToolCalls.length === 0) {
        throw new Error('Empty response received from model.');
      }

      if (tools && tools.length > 0) {
        const { toolCalls: textToolCalls, cleanContent } = parseToolCallsFromText(text || '');
        const combinedCalls = [...nativeToolCalls, ...textToolCalls];
        const allowLearning = tools.some(t => isLearningTool(t.name));
        const filteredCalls = allowLearning ? combinedCalls : combinedCalls.filter(tc => !isLearningTool(tc.name));
        console.log('[AI] Rork parsed tool calls:', filteredCalls.length, filteredCalls.map(tc => tc.name));
        return {
          content: cleanContent,
          toolCalls: filteredCalls,
          usedFallback: Boolean(data?.usedFallback),
          fallbackProvider: data?.fallbackProvider,
        };
      }

      return {
        content: text,
        toolCalls: [],
        usedFallback: Boolean(data?.usedFallback),
        fallbackProvider: data?.fallbackProvider,
      };
    } catch (e: any) {
      lastRorkError = e;
      console.log(`[AI] Rork attempt ${retry + 1}/${rorkMaxRetries + 1} failed:`, e?.message || e);
    } finally {
      clearTimeout(attemptTimeout);
      if (signal) {
        signal.removeEventListener('abort', onParentAbort);
      }
    }
  }

  // Seamless keyless fallback to Pollinations AI within the same call
  try {
    return await callPollinationsFallback(cleanedFormatted, tools);
  } catch (fallbackErr: any) {
    console.log('[AI] Pollinations fallback after Rork error also failed:', fallbackErr?.message);
    throw new Error('Studio AI error: ' + (lastRorkError?.message || fallbackErr?.message || 'Unknown error'));
  }
}

async function callProviderDirect(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  systemPrompt: string,
  signal: AbortSignal,
  customEndpoint?: string,
): Promise<{ content: string; toolCalls: { id: string; name: string; arguments: Record<string, any>; thoughtSignature?: string; extra_content?: Record<string, any> }[]; usedFallback?: boolean; fallbackProvider?: string }> {
  const safeModel = resolveDefaultModel(provider, model);
  switch (provider) {
    case 'rork':
      return await callRork(messages, systemPrompt, tools, safeModel, signal);
    case 'openai':
      return await callOpenAI(apiKey, safeModel, messages, tools, systemPrompt, signal);
    case 'anthropic':
      return await callAnthropic(apiKey, safeModel, messages, tools, systemPrompt, signal);
    case 'gemini':
      return await callGemini(apiKey, safeModel, messages, tools, systemPrompt, signal);
    case 'groq':
      return await callOpenAI(apiKey, safeModel, messages, tools, systemPrompt, signal, 'https://api.groq.com/openai');
    case 'openrouter':
      return await callOpenRouter(apiKey, safeModel, messages, tools, systemPrompt, signal);
    case 'nvidia': {
      const isWeb = typeof window !== 'undefined';
      return await callOpenAI(apiKey, safeModel, messages, tools, systemPrompt, signal, isWeb ? '/api/nvidia' : 'https://integrate.api.nvidia.com');
    }
    case 'custom':
      return await callOpenAI(apiKey, safeModel, messages, tools, systemPrompt, signal, customEndpoint);
    default:
      throw new Error('Unknown provider: ' + provider);
  }
}

export async function callAI(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  systemPrompt: string,
  customEndpoint?: string,
  fallbackSettings?: Record<string, string>,
): Promise<{ content: string; toolCalls: { id: string; name: string; arguments: Record<string, any>; thoughtSignature?: string; extra_content?: Record<string, any> }[]; usedFallback?: boolean; fallbackProvider?: string; tokenUsage?: TokenUsageRecord }> {
  if (!apiKey && provider !== 'rork' && provider !== 'custom') {
    throw new Error('API key missing. Please configure in settings.\n\nTip: Choose "AI for Free" or "Studio KI" as provider for free usage!');
  }

  const safeModel = resolveDefaultModel(provider, model);
  const compressedMessages = compressAndSanitizeMessagesForAPI(messages, { maxToolLength: MAX_TOOL_RESULT_LENGTH });
  const allowLearningTools = Array.isArray(tools) && tools.some(t => isLearningTool(t.name));
  const promptTextForAccounting = compressedMessages.map(m => m.content || '').join('\n') + '\n' + systemPrompt;

  const filterResultTools = (res: { content: string; toolCalls: { id: string; name: string; arguments: Record<string, any>; thoughtSignature?: string; extra_content?: Record<string, any> }[]; usedFallback?: boolean; fallbackProvider?: string; tokenUsage?: TokenUsageRecord }) => {
    const tokenUsage = res.tokenUsage || extractActualTokenUsage(null, promptTextForAccounting, res.content || '', provider, safeModel);
    if (!allowLearningTools && Array.isArray(res.toolCalls) && res.toolCalls.length > 0) {
      return {
        ...res,
        tokenUsage,
        toolCalls: res.toolCalls.filter(tc => !isLearningTool(tc.name)),
      };
    }
    return { ...res, tokenUsage };
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    let lastError: any = null;
    const maxRetries = provider === 'rork' ? 1 : 3; // callRork already performs 2 exponential backoff retries + Pollinations fallback internally

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await callProviderDirect(provider, apiKey, safeModel, compressedMessages, tools, systemPrompt, controller.signal, customEndpoint);
        if (!result.content && (!result.toolCalls || result.toolCalls.length === 0)) {
          throw new Error('Empty response received from model (No text, no tools).');
        }
        return filterResultTools(result);
      } catch (error: any) {
        lastError = error;
        console.log('[AI] Attempt', attempt + 1, 'failed:', error?.message?.slice(0, 100));

        if (isAuthError(error)) {
          throw new Error('Invalid API key for ' + provider + '. Please check your key in settings.');
        }

        if (error.name === 'AbortError') {
          throw new Error('Request timeout: The AI request took too long (120s).');
        }

        if (isRateLimitError(error)) {
          if (attempt < maxRetries - 1) {
            const waitTime = (attempt + 1) * 3000;
            console.log('[AI] Rate limit hit, waiting', waitTime, 'ms before retry...');
            await sleep(waitTime);
            continue;
          }

          if (fallbackSettings) {
            const fallback = getProviderForFallback(provider, fallbackSettings);
            if (fallback) {
              console.log('[AI] Rate limit persists, falling back to:', fallback.provider, fallback.model);
              try {
                const result = await callProviderDirect(fallback.provider, fallback.key, fallback.model, compressedMessages, tools, systemPrompt, controller.signal);
                return filterResultTools({ ...result, usedFallback: true, fallbackProvider: fallback.provider });
              } catch (fbError: any) {
                console.log('[AI] Fallback also failed:', fbError?.message?.slice(0, 100));
              }
            }
          }

          // Final keyless fallback to Pollinations AI on rate limit
          try {
            const fallbackResult = await callRork(compressedMessages, systemPrompt, tools, 'rork-default', controller.signal);
            return filterResultTools({ ...fallbackResult, usedFallback: true, fallbackProvider: fallbackResult.fallbackProvider || 'pollinations' });
          } catch {
            // Fall through to rate limit error message
          }

          throw new Error(
            'Rate limit reached on ' + provider + '.\n\n'
            + '💡 Tips:\n'
            + '• Wait 30–60 seconds and try again\n'
            + '• Switch to another provider (Groq, Gemini, or OpenRouter have free tiers)\n'
            + '• Configure a secondary API key or use the AI for Free shared pool'
          );
        }

        if (error?.message?.includes('Failed to fetch') || error?.message?.includes('Network')) {
          if (attempt < maxRetries - 1) {
            await sleep(2000);
            continue;
          }
          throw new Error('Network error. Please check your internet connection.');
        }

        if (attempt < maxRetries - 1) {
          await sleep(1500);
          continue;
        }
      }
    }

    throw lastError || new Error('AI request failed after ' + maxRetries + ' attempts.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateFinalResponse(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  summaryContext: string,
  customEndpoint?: string,
  fallbackSettings?: Record<string, string>,
): Promise<string> {
  const systemPrompt = 'You are an AI assistant. Summarize the result of a completed task. Reply in English. Use Markdown formatting (**bold**, lists, etc). Write a clear, helpful summary of what was done. No tool calls. Write complete sentences.';

  const messages: ChatMessage[] = [{
    id: 'final_' + Date.now().toString(36),
    role: 'user',
    content: summaryContext,
    timestamp: Date.now(),
  }];

  try {
    const response = await callAI(provider, apiKey, model, messages, [], systemPrompt, customEndpoint, fallbackSettings);
    return response.content || '';
  } catch (e: any) {
    console.log('[AI] generateFinalResponse error:', e?.message);
    return '';
  }
}

export function parseThinkingFromContent(content: string): { thinking: string; cleanContent: string } {
  if (!content) return { thinking: '', cleanContent: '' };

  let thinking = '';
  let cleanContent = content;

  // Handle closed tags
  const thinkRegexClosed = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
  let match;
  while ((match = thinkRegexClosed.exec(cleanContent)) !== null) {
    thinking += (thinking ? '\n\n' : '') + match[1].trim();
  }
  cleanContent = cleanContent.replace(thinkRegexClosed, '').trim();

  // Handle unclosed tag at the end (during streaming)
  const unclosedRegex = /<think(?:ing)?>([\s\S]*)$/i;
  const unclosedMatch = unclosedRegex.exec(cleanContent);
  if (unclosedMatch) {
    thinking += (thinking ? '\n\n' : '') + unclosedMatch[1].trim();
    cleanContent = cleanContent.replace(unclosedRegex, '').trim();
  }

  return { thinking, cleanContent };
}
