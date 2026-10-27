/**
 * Dev0 Sub-Agent `.agents/` Workspace Manager, Mandatory `finish_task` Protocol,
 * Pause/Sleep State Controller & Event/Interval Cron Job Scheduler.
 *
 * Every Sub-Agent (e.g., `teamworker`, `auditor`, `developer`, `localizer`, `critic`)
 * maintains its own isolated subfolder under `.agents/<agent-slug>/` documented strictly
 * in English (`README.md`, `RULES.md`, `STATUS.md`, `LOG.md`).
 *
 * `.agents/` is hidden from standard user file trees (and gitignored) so it never
 * clutters the user's project view, while remaining accessible to Dev0 and Sub-Agents.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileNode } from '@/types';

export interface SubAgentNode {
  id: string;
  slug: string;
  name: string;
  role: string;
  status: 'idle' | 'running' | 'sleeping' | 'completed';
  sleepReason?: string;
  currentTask?: string;
  lastSummary?: string;
  workspaceDir: string;
  allowedFiles: string[];
  updatedAt: number;
  cronJobIds: string[];
}

export interface SubAgentCronJob {
  id: string;
  name: string;
  targetSubAgentSlug: string;
  targetRole: string;
  scheduleExpression: string;
  intervalMinutes?: number;
  triggerOnFinishOf?: string;
  taskInstruction: string;
  enabled: boolean;
  createdBy: 'dev0' | 'sub_agent' | 'user' | string;
  createdAt: number;
  lastRunAt: number | null;
  nextRunAt: number | null;
  runCount: number;
}

export interface SubAgentWorkflowGraphState {
  orchestratorName: string; // Always "Dev0"
  activeSubAgentSlug?: string | null;
  lastFinishedSubAgentSlug?: string | null;
  nodes: SubAgentNode[];
  cronJobs: SubAgentCronJob[];
  updatedAt: number;
}

const STORAGE_KEY_SUBAGENT_WORKFLOW = 'dev0_subagent_workflow_state_v1';

export function normalizeSubAgentSlug(nameOrRole: string): string {
  const clean = (nameOrRole || 'teamworker')
    .trim()
    .toLowerCase()
    .replace(/sub-?agent/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'teamworker';
}

export const sanitizeAgentFolderSlug = normalizeSubAgentSlug;

/**
 * Checks whether a path belongs to the hidden `.agents/` or `.agent/` coordination directory.
 */
export function isHiddenAgentWorkspacePath(filePath: string): boolean {
  const normalized = (filePath || '').trim().replace(/^\/+/, '');
  return (
    normalized === '.agents' ||
    normalized.startsWith('.agents/') ||
    normalized === '.agent' ||
    normalized.startsWith('.agent/')
  );
}

/**
 * Filters out `.agents` and `.agent` directories from a FileNode tree for standard user views.
 */
export function filterVisibleUserFiles<T extends { name?: string; path?: string }>(
  nodes: T[],
  showHiddenAgents: boolean = false,
): T[] {
  if (showHiddenAgents) return nodes;
  return (nodes || []).filter((n) => {
    if (n.path && isHiddenAgentWorkspacePath(n.path)) return false;
    if (n.name === '.agents' || n.name === '.agent') return false;
    return true;
  });
}

export function buildSubAgentStatusMarkdown(params: {
  name: string;
  slug: string;
  role: string;
  status: 'idle' | 'running' | 'sleeping' | 'completed';
  currentTask?: string;
  lastSummary?: string;
  nextRecommendedSubAgent?: string;
  sleepReason?: string;
}): string {
  const isoNow = new Date().toISOString();
  return `# Live Status: ${params.name} (\`.agents/${params.slug}/\`)

- **Orchestrator:** Dev0
- **Role:** \`${params.role}\`
- **Current State:** \`${params.status.toUpperCase()}\`
- **Active Mission:** ${params.currentTask || 'Ready'}
${params.sleepReason ? `- **Sleep / Pause Reason:** ${params.sleepReason}\n` : ''}${params.lastSummary ? `- **Latest Completion Summary:** ${params.lastSummary}\n` : ''}${params.nextRecommendedSubAgent ? `- **Recommended Next Sub-Agent:** \`${params.nextRecommendedSubAgent}\`\n` : ''}- **Timestamp:** ${isoNow}
`;
}

export function appendSubAgentLogMarkdown(existingLog: string, entryText: string): string {
  const isoNow = new Date().toISOString();
  const base = (existingLog || '# Execution Log\n').trimEnd();
  return `${base}\n\n## [${isoNow}]\n- ${entryText}\n`;
}

/**
 * Builds the 4 mandatory English documentation files for `.agents/<slug>/`:
 * - README.md
 * - RULES.md
 * - STATUS.md
 * - LOG.md
 */
export function buildSubAgentWorkspaceFiles(params: {
  name?: string;
  agentName?: string;
  role: string;
  description?: string;
  mission?: string;
  systemPrompt?: string;
  rules?: string[];
  allowedTools?: string[];
  allowedFiles?: string[];
  currentTask?: string;
  status?: 'idle' | 'running' | 'sleeping' | 'completed';
  summary?: string;
  sleepReason?: string;
  createdBy?: string;
}): { path: string; content: string }[] {
  const displayName = params.name || params.agentName || `${params.role} Sub-Agent`;
  const slug = normalizeSubAgentSlug(displayName || params.role);
  const folderPath = `.agents/${slug}`;
  const isoNow = new Date().toISOString();
  const status = params.status || 'running';
  const missionText =
    params.currentTask ||
    params.mission ||
    params.description ||
    'Execute assigned engineering tasks and report structured results back to Dev0.';
  const scopeStr = (
    params.allowedFiles && params.allowedFiles.length > 0 ? params.allowedFiles : ['*']
  ).join(', ');

  const readmeMd = `# Sub-Agent Workspace: ${displayName} (\`${params.role}\`)

- **Orchestrator:** Dev0 (Main Creator Agent)
- **Workspace Path:** \`${folderPath}/\`
- **Role:** \`${params.role}\`
- **Created By:** ${params.createdBy || 'Dev0'}
- **Allowed File Patterns:** \`${scopeStr}\`
- **Last Updated:** ${isoNow}

## Primary Mission
${missionText}

## Coordination Architecture
This directory is managed automatically by **Dev0** and the **${displayName}** Sub-Agent.
- \`README.md\`: Role definition, mission scope, and file boundaries.
- \`RULES.md\`: Mandatory operating rules, tool constraints, Cron scheduling rules, and completion protocol.
- \`STATUS.md\`: Live state (\`idle\`, \`running\`, \`sleeping\`, \`completed\`), active task, and completion verification.
- \`LOG.md\`: Chronological English audit trail of actions, findings, and handoffs.
`;

  const customRulesList =
    params.rules && params.rules.length > 0
      ? params.rules.map((r, idx) => `${idx + 6}. ${r}`).join('\n')
      : '';

  const rulesMd = `# Operating Rules for ${displayName} (\`${params.role}\`)

1. **English Documentation Mandate:** All files inside \`${folderPath}/\` MUST strictly be written in English.
2. **Sandbox & Scope Isolation:** Only modify files matching \`${scopeStr}\`. Never access host or platform internal source files.
3. **Read-Before-Write:** Always call \`read_file\` before \`edit_file\` or \`write_file\`.
4. **Mandatory Completion Tool (\`finish_task\`):**
   - When your assigned task is finished, you MUST invoke the \`finish_task\` tool with \`agent_slug="${slug}"\` and a concise English \`summary\`.
   - Calling \`finish_task\` marks your workspace status as \`completed\` and automatically triggers any dependent Cron jobs (such as \`auditor\` or \`critic\` verification).
5. **Cron Job & Sleep/Pause Protocol (\`create_cron_job\`, \`sleep_agent\`):**
   - Use \`create_cron_job\` when a follow-up audit, test run, or periodic check must run after \`finish_task\` or on a timer.
   - Use \`sleep_agent\` when waiting for external user input, another Sub-Agent's completion, or rate-limit cooldown.
${customRulesList ? `\n${customRulesList}\n` : ''}`;

  const statusMd = buildSubAgentStatusMarkdown({
    name: displayName,
    slug,
    role: params.role,
    status,
    currentTask: missionText,
    lastSummary: params.summary,
    sleepReason: params.sleepReason,
  });

  const logMd = appendSubAgentLogMarkdown(
    `# Execution Log — ${displayName}`,
    `Initialized workspace (${folderPath}/) with status=${status.toUpperCase()} and mission: ${missionText}`,
  );

  return [
    { path: `${folderPath}/README.md`, content: readmeMd },
    { path: `${folderPath}/RULES.md`, content: rulesMd },
    { path: `${folderPath}/STATUS.md`, content: statusMd },
    { path: `${folderPath}/LOG.md`, content: logMd },
  ];
}

/**
 * Creates a new Sub-Agent Cron Job (callable by Dev0, any Sub-Agent, or the user).
 */
export function createSubAgentCronJob(params: {
  name: string;
  targetSubAgentSlug?: string;
  targetRole?: string;
  targetAgentRole?: string;
  scheduleExpression?: string;
  intervalMinutes?: number;
  triggerOnFinishOf?: string;
  taskInstruction: string;
  createdBy?: 'dev0' | 'sub_agent' | 'user' | string;
}): SubAgentCronJob {
  const now = Date.now();
  const role = (params.targetRole || params.targetAgentRole || 'critic').trim().toLowerCase();
  const slug = normalizeSubAgentSlug(params.targetSubAgentSlug || role);
  const scheduleExpression = (params.scheduleExpression || `on_finish:teamworker`).trim();
  const triggerOnFinishOf =
    params.triggerOnFinishOf ||
    (scheduleExpression.startsWith('on_finish:')
      ? normalizeSubAgentSlug(scheduleExpression.replace('on_finish:', ''))
      : undefined);

  return {
    id: 'cron_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 7),
    name: (params.name || `${slug} Cron Job`).trim(),
    targetSubAgentSlug: slug,
    targetRole: role,
    scheduleExpression,
    intervalMinutes: params.intervalMinutes,
    triggerOnFinishOf,
    taskInstruction: (
      params.taskInstruction || 'Verify recent changes and update .agents status'
    ).trim(),
    enabled: true,
    createdBy: params.createdBy || 'dev0',
    createdAt: now,
    lastRunAt: null,
    nextRunAt: params.intervalMinutes ? now + params.intervalMinutes * 60 * 1000 : null,
    runCount: 0,
  };
}

/**
 * Evaluates which scheduled Cron jobs should be triggered when a Sub-Agent calls `finish_task`.
 */
export function evaluateCronJobsOnFinishTask(
  cronJobs: SubAgentCronJob[],
  completedAgentSlugOrRole: string,
  now: number = Date.now(),
): {
  triggeredJobs: SubAgentCronJob[];
  updatedCronJobs: SubAgentCronJob[];
  updatedJobs: SubAgentCronJob[];
} {
  const completedSlug = normalizeSubAgentSlug(completedAgentSlugOrRole);
  const triggeredJobs: SubAgentCronJob[] = [];

  const updatedCronJobs = (cronJobs || []).map((job) => {
    if (!job.enabled) return job;
    const triggerTarget = job.triggerOnFinishOf
      ? normalizeSubAgentSlug(job.triggerOnFinishOf)
      : job.scheduleExpression.startsWith('on_finish:')
        ? normalizeSubAgentSlug(job.scheduleExpression.replace('on_finish:', ''))
        : '';

    const matches =
      triggerTarget === '*' ||
      triggerTarget === completedSlug ||
      job.scheduleExpression === 'on_finish_task';

    if (matches) {
      const triggered: SubAgentCronJob = {
        ...job,
        lastRunAt: now,
        runCount: (job.runCount || 0) + 1,
      };
      triggeredJobs.push(triggered);
      return triggered;
    }
    return job;
  });

  return {
    triggeredJobs,
    updatedCronJobs,
    updatedJobs: updatedCronJobs,
  };
}

const LEGACY_DEFAULT_NODE_IDS = new Set(['node_teamworker', 'node_auditor', 'node_localizer']);
const LEGACY_DEFAULT_CRON_IDS = new Set(['cron_default_audit_on_finish']);

export function createDefaultWorkflowGraphState(): SubAgentWorkflowGraphState {
  const now = Date.now();
  return {
    orchestratorName: 'Dev0',
    activeSubAgentSlug: null,
    lastFinishedSubAgentSlug: null,
    nodes: [],
    cronJobs: [],
    updatedAt: now,
  };
}

export const createDefaultSubAgentWorkflowState = createDefaultWorkflowGraphState;

export async function loadSubAgentWorkflowState(): Promise<SubAgentWorkflowGraphState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SUBAGENT_WORKFLOW);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        orchestratorName: 'Dev0',
        activeSubAgentSlug: parsed.activeSubAgentSlug ?? null,
        lastFinishedSubAgentSlug: parsed.lastFinishedSubAgentSlug ?? null,
        nodes: Array.isArray(parsed.nodes)
          ? parsed.nodes.filter((n: any) => n && !LEGACY_DEFAULT_NODE_IDS.has(n.id))
          : [],
        cronJobs: Array.isArray(parsed.cronJobs)
          ? parsed.cronJobs.filter((c: any) => c && !LEGACY_DEFAULT_CRON_IDS.has(c.id))
          : [],
        updatedAt: parsed.updatedAt || Date.now(),
      };
    }
  } catch (e) {
    console.log('[SubAgentWorkspace] Failed to load workflow state:', e);
  }
  return createDefaultWorkflowGraphState();
}

export async function saveSubAgentWorkflowState(state: SubAgentWorkflowGraphState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_SUBAGENT_WORKFLOW, JSON.stringify(state));
  } catch (e) {
    console.log('[SubAgentWorkspace] Failed to save workflow state:', e);
  }
}
