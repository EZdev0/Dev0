/**
 * YAML Frontmatter Skill & AGENTS.md Learning Engine + ZIP Importer + AI Repair + Custom Sub-Agent Templates
 *
 * Automatically detects and validates YAML frontmatter (--- ... ---) in Markdown/YAML
 * rule and skill files (AGENTS.md, SKILL.md, .agents/skills/*, .qoder/rules/*),
 * flags corrupted/non-YAML skill files with an exclamation warning (`!`) for 1-click AI repair,
 * extracts multi-skill `.zip` packs on-site, and evaluates custom keyword/phrase triggers per chat turn.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import JSZip from 'jszip';
import { FileNode, SkillTriggerOverrideConfig } from '@/types';

export interface ParsedYamlSkill {
  id: string;
  name: string;
  description: string;
  trigger: 'always_on' | 'manual' | 'keyword' | string;
  alwaysApply: boolean;
  sourcePath: string;
  displaySource: string;
  frontmatter: Record<string, any>;
  body: string;
  enabled: boolean;
  triggerKeywords: string[];
  isCorrupted?: boolean;
  corruptionReason?: string;
  rawContent?: string;
}

export interface UploadedSkillFileEntry {
  path: string;
  content: string;
  uploadedAt: number;
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

const CUSTOM_SUB_AGENTS_STORAGE_KEY = 'ide_custom_sub_agent_templates_v2';
const SKILL_OVERRIDES_STORAGE_KEY = 'ide_yaml_skill_overrides_v2';
const SKILL_TRIGGERS_STORAGE_KEY = 'ide_yaml_skill_triggers_v1';
const UPLOADED_SKILLS_STORAGE_KEY = 'ide_uploaded_yaml_skills_v1';

const LEGACY_HARDCODED_TEMPLATE_IDS = new Set([
  'tpl_repograph_localizer',
  'tpl_ui_ux_architect',
  'tpl_security_bug_auditor',
]);

/**
 * Zero hardcoded workspace YAML skill files by default — only real YAML frontmatter files
 * inside the active project or uploaded by the user are discovered and loaded.
 */
export const BUILTIN_WORKSPACE_SKILL_FILES: { path: string; rawContent: string }[] = [];

/**
 * Zero hardcoded Sub-Agent templates by default — Sub-Agents are created dynamically by the user
 * or by the AI via Sub-Agent Studio / Floating Question Relay.
 */
export const DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES: CustomSubAgentTemplate[] = [];

/**
 * Strips internal `.qoder/` or `.qcoder/` folder prefixes from visible UI display
 * while preserving clean readable source paths.
 */
export function formatSkillSourceForDisplay(sourcePath: string): string {
  if (!sourcePath) return 'skills/rule.md';
  return sourcePath
    .replace(/^\/+/, '')
    .replace(/^\.qc?oder\/rules\//i, 'rules/')
    .replace(/^\.qc?oder\/skills\//i, 'skills/')
    .replace(/^\.qc?oder\//i, 'skills/')
    .replace(/^\.agents\//i, '')
    .replace(/\/\.qc?oder\//gi, '/skills/');
}

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

function extractKeywordsFromFrontmatter(frontmatter: Record<string, any>): string[] {
  const raw = frontmatter.keywords ?? frontmatter.triggers ?? frontmatter.triggerWords ?? frontmatter.tags;
  if (Array.isArray(raw)) {
    return raw.map(k => String(k).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
  }
  return [];
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
      if (/\.(md|yml|yaml)$/i.test(node.name) && typeof node.content === 'string') {
        results.push({ path: currentPath, content: node.content, name: node.name });
      }
    } else if (node.type === 'directory' && Array.isArray(node.children)) {
      results.push(...collectMarkdownAndYamlFiles(node.children, currentPath));
    }
  }
  return results;
}

/**
 * Discovers all YAML-headed skills and `AGENTS.md` learning files from the project's file tree
 * AND any user-uploaded skill files. Marks non-YAML or malformed `AGENTS.md` / rule files as
 * `isCorrupted: true` so the UI displays an exclamation icon (`!`) and a 1-click "Fix with AI" button.
 */
export function discoverYamlSkills(
  projectFiles: FileNode[] = [],
  enabledOverrides: Record<string, boolean> = {},
  uploadedFiles: UploadedSkillFileEntry[] = [],
  triggerOverrides: Record<string, SkillTriggerOverrideConfig> = {},
): ParsedYamlSkill[] {
  const discovered: ParsedYamlSkill[] = [];
  const seenPaths = new Set<string>();

  const candidates = [
    ...BUILTIN_WORKSPACE_SKILL_FILES,
    ...uploadedFiles.map(u => ({
      path: u.path,
      rawContent: u.content,
      isUploaded: true,
    })),
    ...collectMarkdownAndYamlFiles(projectFiles).map(f => ({
      path: f.path,
      rawContent: f.content,
      isUploaded: false,
    })),
  ];

  for (const item of candidates) {
    if (seenPaths.has(item.path)) continue;
    // Skip hidden .agents/<slug>/README.md|STATUS.md|LOG.md subagent runtime logs unless inside .agents/skills or .agents/rules
    if (
      /^\.agents\/[^/]+\/(README|STATUS|LOG)\.md$/i.test(item.path) &&
      !item.path.includes('.agents/skills/') &&
      !item.path.includes('.agents/rules/')
    ) {
      continue;
    }

    const { hasFrontmatter, frontmatter, body } = parseYamlFrontmatter(item.rawContent);

    const isAgentsMd = /(^|\/)agents\.md$/i.test(item.path);
    const isRuleOrSkillPath =
      Boolean((item as any).isUploaded) ||
      isAgentsMd ||
      item.path.includes('.qoder/') ||
      item.path.includes('.qcoder/') ||
      item.path.includes('.agents/skills/') ||
      item.path.includes('.agents/rules/') ||
      item.path.includes('skills/') ||
      item.path.includes('.claude/') ||
      /skill\.md$/i.test(item.path) ||
      /rules\.md$/i.test(item.path) ||
      /agent\.md$/i.test(item.path);

    if (!hasFrontmatter && !isRuleOrSkillPath) continue;

    seenPaths.add(item.path);
    const id = `skill_${item.path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const headingMatch = (body || item.rawContent || '').match(/^#\s+(.+)$/m);

    // Check if YAML frontmatter is valid for a skill / AGENTS.md file
    const hasValidNameOrDesc =
      hasFrontmatter &&
      (typeof frontmatter.name === 'string' ||
        typeof frontmatter.description === 'string' ||
        typeof frontmatter.trigger === 'string' ||
        typeof frontmatter.alwaysApply === 'boolean');

    const isCorrupted = !hasFrontmatter || !hasValidNameOrDesc || !(body || '').trim();
    const corruptionReason = !hasFrontmatter
      ? isAgentsMd
        ? 'AGENTS.md is missing required YAML frontmatter (--- name / description / trigger ---).'
        : 'Skill/Rule file is missing YAML frontmatter header (--- ... ---).'
      : !hasValidNameOrDesc
        ? 'YAML frontmatter is incomplete (requires name, description, or trigger fields).'
        : !(body || '').trim()
          ? 'Skill markdown body is empty.'
          : undefined;

    const name =
      typeof frontmatter.name === 'string' && frontmatter.name.trim()
        ? frontmatter.name.trim()
        : headingMatch
          ? headingMatch[1].trim()
          : item.path.split('/').pop() || item.path;

    const description =
      typeof frontmatter.description === 'string' && frontmatter.description.trim()
        ? frontmatter.description.trim()
        : (body || item.rawContent || '')
            .split('\n')
            .find(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('---'))
            ?.slice(0, 140) || `Loaded rule/skill from ${formatSkillSourceForDisplay(item.path)}`;

    const override = triggerOverrides[id];
    const fmKeywords = extractKeywordsFromFrontmatter(frontmatter);
    const triggerKeywords =
      override && Array.isArray(override.keywords) && override.keywords.length > 0
        ? override.keywords
        : fmKeywords;

    let trigger: string = String(
      frontmatter.trigger ||
        (frontmatter.alwaysApply ? 'always_on' : fmKeywords.length > 0 ? 'keyword' : 'always_on'),
    );
    let alwaysApply = Boolean(
      frontmatter.alwaysApply || trigger === 'always_on' || trigger === 'always',
    );

    if (override) {
      if (override.mode === 'always') {
        trigger = 'always_on';
        alwaysApply = true;
      } else if (override.mode === 'keywords') {
        trigger = 'keyword';
        alwaysApply = false;
      } else if (override.mode === 'manual') {
        trigger = 'manual';
        alwaysApply = false;
      }
    }

    const enabled = enabledOverrides[id] !== undefined ? enabledOverrides[id] : !isCorrupted;

    discovered.push({
      id,
      name,
      description,
      trigger,
      alwaysApply,
      sourcePath: item.path,
      displaySource: formatSkillSourceForDisplay(item.path),
      frontmatter,
      body: body || item.rawContent,
      enabled,
      triggerKeywords,
      isCorrupted,
      corruptionReason,
      rawContent: item.rawContent,
    });
  }

  return discovered;
}

/**
 * Matches active YAML skills and `AGENTS.md` files for a specific chat turn based on:
 * - `always_on` / `always` / `alwaysApply` (Background Always Load)
 * - Custom trigger keywords, phrases, or letters (`triggerKeywords`)
 * - Name/description keyword match when in `keyword` / `keywords` mode
 * Returns the matched skills, the formatted system prompt block, and the list of loaded skill names
 * to display at the bottom-right of the chat bubble.
 */
export function matchActiveSkillsForTurn(
  skills: ParsedYamlSkill[],
  userQuery?: string,
  triggerOverrides: Record<string, SkillTriggerOverrideConfig> = {},
): {
  matchedSkills: ParsedYamlSkill[];
  promptBlock: string;
  loadedSkillNames: string[];
} {
  const q = (userQuery || '').toLowerCase().trim();

  const matchedSkills = skills.filter(s => {
    if (!s.enabled || s.isCorrupted) return false;
    const override = triggerOverrides[s.id];
    const mode = override?.mode
      ? override.mode
      : s.alwaysApply || s.trigger === 'always_on' || s.trigger === 'always'
        ? 'always'
        : s.trigger === 'keyword' ||
            s.trigger === 'keywords' ||
            (s.triggerKeywords && s.triggerKeywords.length > 0)
          ? 'keywords'
          : 'manual';

    if (mode === 'always') {
      return true;
    }

    if (mode === 'keywords') {
      if (!q) return false;
      const keywords =
        override?.keywords && override.keywords.length > 0
          ? override.keywords
          : s.triggerKeywords || [];
      if (keywords.length > 0) {
        return keywords.some(kw => {
          const cleanKw = kw.toLowerCase().trim();
          return cleanKw.length > 0 && q.includes(cleanKw);
        });
      }
      return (
        q.includes(s.name.toLowerCase()) ||
        s.description
          .toLowerCase()
          .split(/\s+/)
          .some(w => w.length > 3 && q.includes(w))
      );
    }

    // Manual mode: only trigger if the user explicitly mentions the skill name
    if (q && s.name && q.includes(s.name.toLowerCase())) {
      return true;
    }
    return false;
  });

  if (matchedSkills.length === 0) {
    return { matchedSkills: [], promptBlock: '', loadedSkillNames: [] };
  }

  let promptBlock = '\n## Loaded YAML Skills & AGENTS.md Directives\n';
  for (const s of matchedSkills) {
    const kwNote =
      s.triggerKeywords && s.triggerKeywords.length > 0
        ? `, Keywords: [${s.triggerKeywords.join(', ')}]`
        : '';
    promptBlock += `### [${s.name}] (Source: \`${s.displaySource}\`, Trigger: \`${s.trigger}\`${kwNote})\n`;
    promptBlock += s.body.slice(0, 900) + (s.body.length > 900 ? '\n...(truncated)' : '') + '\n\n';
  }

  return {
    matchedSkills,
    promptBlock,
    loadedSkillNames: matchedSkills.map(s => s.name),
  };
}

/**
 * Formats active YAML skills into a concise prompt block for the AI system prompt
 */
export function buildActiveSkillsPromptBlock(
  skills: ParsedYamlSkill[],
  userQuery?: string,
  triggerOverrides: Record<string, SkillTriggerOverrideConfig> = {},
): string {
  return matchActiveSkillsForTurn(skills, userQuery, triggerOverrides).promptBlock;
}

/**
 * Repairs a corrupted or non-YAML `AGENTS.md` or Skill file into a valid YAML-frontmatter
 * skill/rule document so 1-click "Fix with AI" works deterministically offline and online.
 */
export function repairCorruptedSkillContent(
  rawPath: string,
  rawContent: string,
  customOptions?: {
    name?: string;
    description?: string;
    trigger?: 'always_on' | 'keyword' | 'manual';
    keywords?: string[];
  },
): {
  valid: boolean;
  path: string;
  content: string;
  skill: ParsedYamlSkill;
} {
  const cleanPath = (rawPath || 'AGENTS.md').replace(/^\/+/, '');
  const isAgentsMd = /(^|\/)agents\.md$/i.test(cleanPath);
  const existing = parseYamlFrontmatter(rawContent || '');
  const rawBody = (existing.body || rawContent || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();

  const headingMatch = rawBody.match(/^#\s+(.+)$/m);
  const fileBaseName = cleanPath.split('/').pop()?.replace(/\.(md|yml|yaml)$/i, '') || 'Skill';

  const resolvedName =
    customOptions?.name?.trim() ||
    (typeof existing.frontmatter.name === 'string' && existing.frontmatter.name.trim()) ||
    (headingMatch ? headingMatch[1].replace(/[^\w\s().-]/g, '').trim() : '') ||
    (isAgentsMd ? 'AGENTS.md Workspace Rules' : fileBaseName);

  const firstParagraph = rawBody
    .split(/\r?\n/)
    .map(l => l.trim())
    .find(l => l.length > 10 && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('>'));

  const resolvedDescription =
    customOptions?.description?.trim() ||
    (typeof existing.frontmatter.description === 'string' && existing.frontmatter.description.trim()) ||
    (firstParagraph ? firstParagraph.replace(/[:"]/g, '').slice(0, 120) : '') ||
    (isAgentsMd
      ? 'Mandatory workspace architecture, tool execution, and verification rules from AGENTS.md'
      : `Reusable YAML skill and rule set for ${resolvedName}`);

  const resolvedTrigger =
    customOptions?.trigger ||
    (typeof existing.frontmatter.trigger === 'string' ? existing.frontmatter.trigger : 'always_on');
  const alwaysApply = resolvedTrigger === 'always_on';
  const keywords =
    customOptions?.keywords ||
    extractKeywordsFromFrontmatter(existing.frontmatter);

  const bodyContent =
    rawBody.length > 0
      ? rawBody.startsWith('#')
        ? rawBody
        : `# ${resolvedName}\n\n${rawBody}`
      : `# ${resolvedName}\n\n- Follow systematic read-before-write execution.\n- Verify all changes before completing tasks.`;

  const yamlLines = [
    '---',
    `name: "${resolvedName.replace(/"/g, "'")}"`,
    `description: "${resolvedDescription.replace(/"/g, "'")}"`,
    `trigger: ${resolvedTrigger}`,
    `alwaysApply: ${alwaysApply ? 'true' : 'false'}`,
  ];
  if (keywords.length > 0) {
    yamlLines.push(`keywords: [${keywords.map(k => `"${k.replace(/"/g, "'")}"`).join(', ')}]`);
  }
  yamlLines.push('---', '', bodyContent, '');

  const repairedContent = yamlLines.join('\n');
  const parsed = parseYamlFrontmatter(repairedContent);
  const id = `skill_${cleanPath.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const skill: ParsedYamlSkill = {
    id,
    name: resolvedName,
    description: resolvedDescription,
    trigger: resolvedTrigger,
    alwaysApply,
    sourcePath: cleanPath,
    displaySource: formatSkillSourceForDisplay(cleanPath),
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    enabled: true,
    triggerKeywords: keywords,
    isCorrupted: false,
    rawContent: repairedContent,
  };

  return {
    valid: true,
    path: cleanPath,
    content: repairedContent,
    skill,
  };
}

/**
 * Extracts all `.md`, `.yml`, `.yaml`, and `AGENTS.md` files from an uploaded `.zip` archive
 * (or individual file uploads) and returns both the extracted file entries and discovered skills
 * (including any corrupted/non-YAML files flagged with `isCorrupted: true` for 1-click AI Fix).
 */
export async function importSkillsFromZipOrFiles(
  inputs: {
    fileName: string;
    textContent?: string;
    base64Content?: string;
    arrayBuffer?: ArrayBuffer | Uint8Array;
  }[],
): Promise<{
  importedFiles: UploadedSkillFileEntry[];
  skills: ParsedYamlSkill[];
  corruptedCount: number;
}> {
  const importedFiles: UploadedSkillFileEntry[] = [];
  const now = Date.now();

  for (const item of inputs) {
    const cleanName = (item.fileName || 'skill.md').trim();
    if (/\.zip$/i.test(cleanName)) {
      try {
        const zip = new JSZip();
        let loadedZip: JSZip | null = null;
        if (item.arrayBuffer) {
          loadedZip = await zip.loadAsync(item.arrayBuffer);
        } else if (item.base64Content) {
          const cleanBase64 = item.base64Content.replace(/^data:[^;]+;base64,/, '');
          loadedZip = await zip.loadAsync(cleanBase64, { base64: true });
        }
        if (loadedZip) {
          const fileNames = Object.keys(loadedZip.files);
          for (const entryName of fileNames) {
            const zipEntry = loadedZip.files[entryName];
            if (!zipEntry || zipEntry.dir) continue;
            if (entryName.includes('__MACOSX') || entryName.startsWith('.DS_Store')) continue;
            if (!/\.(md|yml|yaml)$/i.test(entryName)) continue;
            const content = await zipEntry.async('string');
            const normalizedPath = entryName.replace(/^\/+/, '');
            importedFiles.push({
              path: normalizedPath.includes('/') ? normalizedPath : `skills/${normalizedPath}`,
              content,
              uploadedAt: now,
            });
          }
        }
      } catch (e) {
        console.log('[SkillLoader] Failed to extract ZIP archive:', e);
      }
    } else if (/\.(md|yml|yaml)$/i.test(cleanName) && typeof item.textContent === 'string') {
      const normalizedPath = cleanName.replace(/^\/+/, '');
      const isAgents = /(^|\/)agents\.md$/i.test(normalizedPath);
      importedFiles.push({
        path: isAgents || normalizedPath.includes('/') ? normalizedPath : `skills/${normalizedPath}`,
        content: item.textContent,
        uploadedAt: now,
      });
    }
  }

  const skills = discoverYamlSkills([], {}, importedFiles, {});
  const corruptedCount = skills.filter(s => s.isCorrupted).length;

  return {
    importedFiles,
    skills,
    corruptedCount,
  };
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
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t: any) => t && t.id && !LEGACY_HARDCODED_TEMPLATE_IDS.has(t.id));
    }
  } catch (e) {
    console.log('[SkillLoader] Failed to load custom sub-agent templates:', e);
  }
  return [];
}

export async function saveCustomSubAgentTemplates(templates: CustomSubAgentTemplate[]): Promise<void> {
  try {
    const cleaned = (templates || []).filter(
      t => t && t.id && !LEGACY_HARDCODED_TEMPLATE_IDS.has(t.id),
    );
    await AsyncStorage.setItem(CUSTOM_SUB_AGENTS_STORAGE_KEY, JSON.stringify(cleaned));
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

export async function loadSkillTriggerOverrides(): Promise<Record<string, SkillTriggerOverrideConfig>> {
  try {
    const raw = await AsyncStorage.getItem(SKILL_TRIGGERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

export async function saveSkillTriggerOverrides(
  overrides: Record<string, SkillTriggerOverrideConfig>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SKILL_TRIGGERS_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

export async function loadUploadedSkillFiles(): Promise<UploadedSkillFileEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(UPLOADED_SKILLS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveUploadedSkillFiles(files: UploadedSkillFileEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(UPLOADED_SKILLS_STORAGE_KEY, JSON.stringify(files || []));
  } catch {
    // ignore
  }
}

/**
 * Generates and validates a YAML-frontmatter Skill/Rule markdown file for `create_yaml_skill`.
 */
export function createAndValidateYamlSkillFile(params: {
  name: string;
  description: string;
  trigger?: string;
  alwaysApply?: boolean;
  keywords?: string[];
  instructions: string;
  targetPath?: string;
}): {
  valid: boolean;
  path: string;
  content: string;
  skill?: ParsedYamlSkill;
  error?: string;
} {
  const cleanName = (params.name || '').trim();
  const cleanDesc = (params.description || '').trim();
  const cleanInstructions = (params.instructions || '').trim();

  if (!cleanName) {
    return { valid: false, path: '', content: '', error: 'Skill name is required.' };
  }
  if (!cleanInstructions) {
    return { valid: false, path: '', content: '', error: 'Skill instructions are required.' };
  }

  const slug =
    cleanName
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-skill';

  const resolvedPath = (params.targetPath || `.agents/skills/${slug}.md`).replace(/^\/+/, '');
  const trigger = (params.trigger || 'always_on').trim();
  const alwaysApply = params.alwaysApply ?? trigger === 'always_on';
  const keywords = Array.isArray(params.keywords)
    ? params.keywords.map(k => k.trim()).filter(Boolean)
    : [];

  const headerLines = [
    '---',
    `name: ${cleanName}`,
    `description: ${cleanDesc || `Reusable skill rule for ${cleanName}`}`,
    `trigger: ${trigger}`,
    `alwaysApply: ${alwaysApply ? 'true' : 'false'}`,
  ];
  if (keywords.length > 0) {
    headerLines.push(`keywords: [${keywords.map(k => `"${k.replace(/"/g, "'")}"`).join(', ')}]`);
  }
  headerLines.push(
    '---',
    '',
    cleanInstructions.startsWith('#') ? cleanInstructions : `# ${cleanName}\n\n${cleanInstructions}`,
    '',
  );

  const content = headerLines.join('\n');

  const parsed = parseYamlFrontmatter(content);
  if (!parsed.hasFrontmatter) {
    return { valid: false, path: resolvedPath, content, error: 'Failed to validate YAML frontmatter.' };
  }

  const skill: ParsedYamlSkill = {
    id: `skill_${resolvedPath.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    name: cleanName,
    description: cleanDesc || `Reusable skill rule for ${cleanName}`,
    trigger,
    alwaysApply,
    sourcePath: resolvedPath,
    displaySource: formatSkillSourceForDisplay(resolvedPath),
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    enabled: true,
    triggerKeywords: keywords,
    isCorrupted: false,
    rawContent: content,
  };

  return {
    valid: true,
    path: resolvedPath,
    content,
    skill,
  };
}
