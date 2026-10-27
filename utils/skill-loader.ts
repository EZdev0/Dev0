/**
 * YAML Frontmatter Skill & Learning File Auto-Loader + Custom Sub-Agent Templates
 *
 * Automatically detects and parses YAML frontmatter (--- ... ---) in Markdown/YAML
 * rule and skill files (.qoder/rules/*, .agents/*, project SKILL.md files) and manages
 * user-defined and AI-callable Sub-Agent templates with strict file and tool scopes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileNode } from '@/types';

export interface ParsedYamlSkill {
  id: string;
  name: string;
  description: string;
  trigger: 'always_on' | 'manual' | 'keyword' | string;
  alwaysApply: boolean;
  sourcePath: string;
  frontmatter: Record<string, any>;
  body: string;
  enabled: boolean;
}

export interface CustomSubAgentTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  rules: string[];
  allowedTools: string[];
  allowedFiles: string[]; // Glob or path prefixes e.g. ["app/**", "utils/**", "*.ts"]
  canBeCalledByAI: boolean;
  createdAt: number;
  updatedAt: number;
}

const CUSTOM_SUB_AGENTS_STORAGE_KEY = 'ide_custom_sub_agent_templates_v1';
const SKILL_OVERRIDES_STORAGE_KEY = 'ide_yaml_skill_overrides_v1';

/**
 * Built-in workspace YAML rule & skill files from .qoder/rules and .agents/teamwork
 */
const BUILTIN_WORKSPACE_SKILL_FILES: { path: string; rawContent: string }[] = [
  {
    path: '.qoder/rules/Agent.md',
    rawContent: `---
name: "QCoder Master Architecture & Logic"
description: "Autonomous QCoder agent workflow: load rules, analyze RepoGraph, plan, validate against lessons_learned.md, and verify 0 errors."
trigger: always_on
alwaysApply: true
---
# QCoder Master Agent Directive
1. Always load rules (lessons_learned.md + user.md) before modifying files.
2. Read files with read_file before editing with edit_file or write_file.
3. Verify changes and never repeat documented errors.`,
  },
  {
    path: '.qoder/rules/lessons_learned.md',
    rawContent: `---
name: "QCoder System Memory (Lessons Learned)"
description: "Long-term engineering memory preventing regressions on Gemini thoughtSignature, sub-tab navigation, and cross-platform modals."
trigger: always_on
alwaysApply: true
---
# QCoder System Memory (Lessons Learned)
- Preserve thoughtSignature and extra_content.google.thought_signature across all tool calls.
- Never lock local activeTab state inside route parameter synchronization effects.
- Use cross-platform Modal dialogs and sandboxed iframe/WebAssembly previews on Web.`,
  },
  {
    path: '.qoder/rules/user.md',
    rawContent: `---
name: "User Preferences (Master Config)"
description: "Analytical, concise communication, high-performance TypeScript patterns, and proactive autonomy."
trigger: always_on
alwaysApply: true
---
# User Preferences
- Communication: Concise, analytical, zero fluff.
- Code Style: Strict TypeScript, async resilience, high performance, RepoGraph indexable.
- Autonomy: Proactive problem solving and automatic fallback recovery.`,
  },
  {
    path: '.agents/teamwork/SKILL.md',
    rawContent: `---
name: "Multi-Agent Teamwork & Victory Audit"
description: "Coordinates specialized Analyst, Developer, Tester, Researcher, and Critic sub-agents with strict token-saving isolation."
trigger: always_on
alwaysApply: true
---
# Multi-Agent Teamwork Protocol
- Delegate specialized analysis, coding, and verification tasks to focused sub-agents.
- Enforce file-scope boundaries and verify outputs with Critic/Auditor review.`,
  },
];

export const DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES: CustomSubAgentTemplate[] = [
  {
    id: 'tpl_repograph_localizer',
    name: 'RepoGraph Localizer',
    role: 'localizer',
    description: 'Traverses the Synapse Memory Graph to pinpoint exact files, functions, and dependencies with minimal token usage.',
    systemPrompt:
      'You are the RepoGraph Code Localizer sub-agent. Your mission is to locate exact file paths, function signatures, and callers/callees relevant to the task without reading unnecessary files.',
    rules: [
      'Use search_files, get_project_tree, and read_lines before reading entire large files.',
      'Return exact file paths and line numbers for every finding.',
      'Never modify files directly; provide a precise localization map.',
    ],
    allowedTools: ['read_file', 'read_lines', 'list_directory', 'search_files', 'get_project_tree', 'get_file_info', 'think'],
    allowedFiles: ['*'],
    canBeCalledByAI: true,
    createdAt: 1730000000000,
    updatedAt: 1730000000000,
  },
  {
    id: 'tpl_ui_ux_architect',
    name: 'UI/UX Component Architect',
    role: 'developer',
    description: 'Implements and refines React Native & Web components with strict TypeScript and clean layout rules.',
    systemPrompt:
      'You are the UI/UX Component Architect sub-agent. Build responsive, accessible components with working handlers and zero placeholder stubs.',
    rules: [
      'Always read the target component with read_file before calling edit_file or write_file.',
      'Ensure touch targets are at least 44px and work on both Web and Mobile.',
      'Do not modify backend API routes outside your allowed file scope.',
    ],
    allowedTools: ['read_file', 'read_lines', 'write_file', 'create_file', 'edit_file', 'find_replace', 'verify_file', 'think'],
    allowedFiles: ['components/**', 'app/**', 'constants/**'],
    canBeCalledByAI: true,
    createdAt: 1730000001000,
    updatedAt: 1730000001000,
  },
  {
    id: 'tpl_security_bug_auditor',
    name: 'Security & Bug Auditor',
    role: 'critic',
    description: 'Audits code changes for edge cases, credential leaks, error handling gaps, and regressions.',
    systemPrompt:
      'You are the Security & Bug Auditor sub-agent. Inspect modified files for runtime crashes, unhandled promises, and rule compliance.',
    rules: [
      'Verify that no API keys or tokens are exposed in plaintext.',
      'Check against lessons_learned.md and document any new bug patterns.',
    ],
    allowedTools: ['read_file', 'read_lines', 'search_files', 'get_project_tree', 'verify_file', 'add_memo', 'think'],
    allowedFiles: ['*'],
    canBeCalledByAI: true,
    createdAt: 1730000002000,
    updatedAt: 1730000002000,
  },
];

/**
 * Parses YAML frontmatter block (`--- ... ---`) from Markdown or YAML files
 */
export function parseYamlFrontmatter(rawContent: string): {
  hasFrontmatter: boolean;
  frontmatter: Record<string, any>;
  body: string;
} {
  if (!rawContent || typeof rawContent !== 'string') {
    return { hasFrontmatter: false, frontmatter: {}, body: '' };
  }

  const trimmed = rawContent.trimStart();
  if (!trimmed.startsWith('---')) {
    return { hasFrontmatter: false, frontmatter: {}, body: rawContent };
  }

  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { hasFrontmatter: false, frontmatter: {}, body: rawContent };
  }

  const yamlBlock = match[1];
  const body = match[2] || '';
  const frontmatter: Record<string, any> = {};

  const lines = yamlBlock.split(/\r?\n/);
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;
    const colonIdx = clean.indexOf(':');
    if (colonIdx === -1) continue;

    const key = clean.slice(0, colonIdx).trim();
    let valStr = clean.slice(colonIdx + 1).trim();

    if (
      (valStr.startsWith('"') && valStr.endsWith('"')) ||
      (valStr.startsWith("'") && valStr.endsWith("'"))
    ) {
      valStr = valStr.slice(1, -1);
    }

    if (valStr === 'true') {
      frontmatter[key] = true;
    } else if (valStr === 'false') {
      frontmatter[key] = false;
    } else if (valStr.startsWith('[') && valStr.endsWith(']')) {
      frontmatter[key] = valStr
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (!Number.isNaN(Number(valStr)) && valStr !== '') {
      frontmatter[key] = Number(valStr);
    } else {
      frontmatter[key] = valStr;
    }
  }

  return {
    hasFrontmatter: Object.keys(frontmatter).length > 0,
    frontmatter,
    body: body.trim(),
  };
}

function collectMarkdownAndYamlFiles(
  nodes: FileNode[],
  basePath: string = '',
): { path: string; content: string; name: string }[] {
  const results: { path: string; content: string; name: string }[] = [];
  if (!Array.isArray(nodes)) return results;

  for (const node of nodes) {
    const currentPath = basePath ? `${basePath}/${node.name}` : node.name;
    if (node.type === 'file') {
      if (/\.(md|yml|yaml)$/i.test(node.name) && node.content) {
        results.push({ path: currentPath, content: node.content, name: node.name });
      }
    } else if (node.type === 'directory' && Array.isArray(node.children)) {
      results.push(...collectMarkdownAndYamlFiles(node.children, currentPath));
    }
  }
  return results;
}

/**
 * Discovers all YAML-headed skills and learning files from built-in workspace rules
 * AND the active project's file tree.
 */
export function discoverYamlSkills(
  projectFiles: FileNode[] = [],
  enabledOverrides: Record<string, boolean> = {},
): ParsedYamlSkill[] {
  const discovered: ParsedYamlSkill[] = [];
  const seenPaths = new Set<string>();

  const candidates = [
    ...BUILTIN_WORKSPACE_SKILL_FILES,
    ...collectMarkdownAndYamlFiles(projectFiles).map(f => ({
      path: f.path,
      rawContent: f.content,
    })),
  ];

  for (const item of candidates) {
    if (seenPaths.has(item.path)) continue;
    const { hasFrontmatter, frontmatter, body } = parseYamlFrontmatter(item.rawContent);

    const isRuleOrSkillPath =
      item.path.includes('.qoder/') ||
      item.path.includes('.qcoder/') ||
      item.path.includes('.agents/') ||
      item.path.includes('.claude/') ||
      /skill\.md$/i.test(item.path) ||
      /rules\.md$/i.test(item.path) ||
      /agent\.md$/i.test(item.path) ||
      /\.(yml|yaml)$/i.test(item.path);

    if (!hasFrontmatter && !isRuleOrSkillPath) continue;

    seenPaths.add(item.path);
    const id = `skill_${item.path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const headingMatch = body.match(/^#\s+(.+)$/m);
    const name =
      typeof frontmatter.name === 'string' && frontmatter.name.trim()
        ? frontmatter.name.trim()
        : headingMatch
          ? headingMatch[1].trim()
          : item.path.split('/').pop() || item.path;

    const description =
      typeof frontmatter.description === 'string' && frontmatter.description.trim()
        ? frontmatter.description.trim()
        : body.split('\n').find(l => l.trim() && !l.trim().startsWith('#'))?.slice(0, 140) ||
          `Loaded rule/skill from ${item.path}`;

    const trigger = String(frontmatter.trigger || (frontmatter.alwaysApply ? 'always_on' : 'manual'));
    const alwaysApply = Boolean(frontmatter.alwaysApply || trigger === 'always_on');
    const enabled = enabledOverrides[id] !== undefined ? enabledOverrides[id] : true;

    discovered.push({
      id,
      name,
      description,
      trigger,
      alwaysApply,
      sourcePath: item.path,
      frontmatter,
      body: body || item.rawContent,
      enabled,
    });
  }

  return discovered;
}

/**
 * Formats active YAML skills into a concise prompt block for the AI system prompt
 */
export function buildActiveSkillsPromptBlock(
  skills: ParsedYamlSkill[],
  userQuery?: string,
): string {
  const active = skills.filter(s => {
    if (!s.enabled) return false;
    if (s.alwaysApply || s.trigger === 'always_on') return true;
    if (userQuery) {
      const q = userQuery.toLowerCase();
      return (
        q.includes(s.name.toLowerCase()) ||
        s.description.toLowerCase().split(/\s+/).some(w => w.length > 4 && q.includes(w))
      );
    }
    return true;
  });

  if (active.length === 0) return '';

  let block = '\n## Loaded YAML Skills & Project Rules\n';
  for (const s of active) {
    block += `### [${s.name}] (Source: \`${s.sourcePath}\`, Trigger: \`${s.trigger}\`)\n`;
    block += s.body.slice(0, 600) + (s.body.length > 600 ? '\n...(truncated)' : '') + '\n\n';
  }
  return block;
}

/**
 * Checks whether a target file path is permitted by a Sub-Agent's allowedFiles patterns.
 * Supports `*`, `dir/**`, `*.ext`, and exact paths.
 */
export function isFileAllowedForSubAgent(filePath: string, allowedPatterns: string[]): boolean {
  if (!allowedPatterns || allowedPatterns.length === 0) return true;
  const cleanPath = filePath.replace(/^\/+/, '').trim();
  for (const rawPattern of allowedPatterns) {
    const pattern = rawPattern.replace(/^\/+/, '').trim();
    if (!pattern || pattern === '*' || pattern === '**' || pattern === '**/*') return true;
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      if (cleanPath === prefix || cleanPath.startsWith(prefix + '/')) return true;
    } else if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (cleanPath.endsWith(ext)) return true;
    } else if (cleanPath === pattern || cleanPath.startsWith(pattern + '/') || cleanPath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

export async function loadCustomSubAgentTemplates(): Promise<CustomSubAgentTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_SUB_AGENTS_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.log('[SkillLoader] Failed to load custom sub-agent templates:', e);
  }
  return DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES;
}

export async function saveCustomSubAgentTemplates(templates: CustomSubAgentTemplate[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOM_SUB_AGENTS_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.log('[SkillLoader] Failed to save custom sub-agent templates:', e);
  }
}

export async function loadSkillEnabledOverrides(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(SKILL_OVERRIDES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

export async function saveSkillEnabledOverrides(overrides: Record<string, boolean>): Promise<void> {
  try {
    await AsyncStorage.setItem(SKILL_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}
