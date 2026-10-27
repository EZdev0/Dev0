import {
  hasExplicitQuestionToolCall,
  buildSubAgentQuestionRequestFromTool,
  detectSubAgentQuestionFromTurn,
  createSavedSubAgentFromQuestionResponse,
  buildMainCreatorRelayPrompt,
} from '@/utils/subagent-question-relay';
import {
  saveCustomSubAgentTemplates,
  loadCustomSubAgentTemplates,
  DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES,
} from '@/utils/skill-loader';
import {
  createDefaultFreePoolState,
  encodePoolSecret,
  decodePoolSecret,
  maskApiKey,
  maskEmailAddress,
  evaluatePoolKeyStatus,
  selectActivePoolKeyForUser,
  canViewUserChats,
  canManageUsers,
  verifyOwnerClaimPassphrase,
} from '@/utils/free-ai-pool';
import {
  buildSubAgentWorkspaceFiles,
  isHiddenAgentWorkspacePath,
  filterVisibleUserFiles,
  evaluateCronJobsOnFinishTask,
  createDefaultSubAgentWorkflowState,
} from '@/utils/subagent-workspace';
import {
  sanitizeUserSandboxProjects,
  isLegacySelfSourceProject,
} from '@/utils/sandbox-workspace';
import { ChatMessage, TOOL_REGISTRY } from '@/types';
import { TOOL_DEFINITIONS } from '@/utils/ai-service';

describe('Strict Question Tool Detection & Sub-Agent Floating Window Relay', () => {
  it('registers ask_user_question, finish_task, create_cron_job, sleep_agent, and inspect_subagent_workspace in both TOOL_DEFINITIONS and TOOL_REGISTRY', () => {
    const requiredTools = [
      'ask_user_question',
      'finish_task',
      'create_cron_job',
      'sleep_agent',
      'inspect_subagent_workspace',
    ];
    for (const toolName of requiredTools) {
      expect(TOOL_DEFINITIONS.some((t) => t.name === toolName)).toBe(true);
      expect(TOOL_REGISTRY.some((t) => t.name === toolName)).toBe(true);
    }
  });

  it('does NOT trigger hasExplicitQuestionToolCall for plain-text assistant replies containing question marks or non-tool pending requests', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'hallo', timestamp: 1000 },
      { id: '2', role: 'assistant', content: 'Hello! How can I help you today?', timestamp: 1001 },
      { id: '3', role: 'user', content: 'starte einen subagent', timestamp: 1002 },
      {
        id: '4',
        role: 'assistant',
        content:
          'I can start a sub-agent for you. What role should the sub-agent have (e.g., localizer, developer, critic), and what task should I assign to it?',
        timestamp: 1003,
      },
    ];

    expect(hasExplicitQuestionToolCall(messages, null)).toBe(false);

    // Even if a heuristic request without toolCallId was constructed, hasExplicitQuestionToolCall must remain false
    const nonToolRequest = detectSubAgentQuestionFromTurn(
      'starte einen subagent',
      'I can start a sub-agent for you. What role should the sub-agent have?',
    );
    expect(nonToolRequest?.toolCallId).toBeUndefined();
    expect(hasExplicitQuestionToolCall(messages, nonToolRequest || null)).toBe(false);
  });

  it('triggers hasExplicitQuestionToolCall ONLY when ask_user_question tool is explicitly called with toolCallId', () => {
    const messagesWithTool: ChatMessage[] = [
      { id: '1', role: 'user', content: 'starte einen subagent', timestamp: 1000 },
      {
        id: '2',
        role: 'assistant',
        content: 'Asking sub-agent configuration questions...',
        toolCalls: [
          {
            id: 'tc_q1',
            name: 'ask_user_question',
            arguments: {
              is_sub_agent: true,
              sub_agent_role: 'developer',
              questions: ['What role should the sub-agent have?', 'What task should I assign to it?'],
            },
            status: 'completed',
          },
        ],
        timestamp: 1001,
      },
    ];

    expect(hasExplicitQuestionToolCall(messagesWithTool, null)).toBe(true);

    // After user responds, hasExplicitQuestionToolCall becomes false
    const afterUserReply: ChatMessage[] = [
      ...messagesWithTool,
      { id: '3', role: 'user', content: 'Developer role, fix navbar', timestamp: 1002 },
    ];
    expect(hasExplicitQuestionToolCall(afterUserReply, null)).toBe(false);
  });

  it('saves configured Sub-Agent to the Saved Sub-Agent List and relays answers to Main Creator Agent', async () => {
    const req = buildSubAgentQuestionRequestFromTool(
      {
        is_sub_agent: true,
        sub_agent_name: 'UI Audit Specialist',
        sub_agent_role: 'critic',
        allowed_files: ['components/**', 'app/**'],
        questions: [
          'Which components should be audited?',
          'Should strict accessibility checks be enforced?',
        ],
      },
      'tc_explicit_1',
    );
    expect(req.toolCallId).toBe('tc_explicit_1');

    const userResponse = {
      requestId: req.id,
      subAgentName: 'UI Audit Specialist',
      subAgentRole: 'critic',
      taskInstruction: 'Audit all modal touch targets and navigation bars',
      allowedFiles: ['components/**', 'app/**'],
      answers: [
        { question: 'Which components should be audited?', answer: 'ChatScreen and MultiAgentUI' },
        { question: 'Should strict accessibility checks be enforced?', answer: 'Yes, >= 44px touch targets' },
      ],
      saveToSubAgentList: true,
      skipped: false,
    };

    const savedTemplate = createSavedSubAgentFromQuestionResponse(req, userResponse);
    expect(savedTemplate.name).toBe('UI Audit Specialist');
    expect(savedTemplate.role).toBe('critic');
    expect(savedTemplate.allowedFiles).toEqual(['components/**', 'app/**']);
    expect(savedTemplate.systemPrompt).toContain('ChatScreen and MultiAgentUI');

    // Persist into saved Sub-Agent list and verify retrieval
    const updatedList = [savedTemplate, ...DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES];
    await saveCustomSubAgentTemplates(updatedList);
    const loadedList = await loadCustomSubAgentTemplates();
    expect(loadedList?.some((t) => t.id === savedTemplate.id && t.name === 'UI Audit Specialist')).toBe(true);

    // Verify relay prompt to Main Creator Agent
    const relayPrompt = buildMainCreatorRelayPrompt(req, userResponse, savedTemplate);
    expect(relayPrompt).toContain('Main Creator Agent');
    expect(relayPrompt).toContain('UI Audit Specialist');
    expect(relayPrompt).toContain('ChatScreen and MultiAgentUI');
    expect(relayPrompt).toContain('role="critic"');
  });
});

describe('Free AI Key Pool Multi-Key Rotation, 3-Tier RBAC & Zero-PII Governance', () => {
  it('masks email addresses and enforces 3-Tier RBAC (Owner vs Admin vs User)', () => {
    expect(maskEmailAddress('developer@example.com')).toBe('de•••r@example.com');
    expect(verifyOwnerClaimPassphrase('DEV0-OWNER-CLAIM')).toBe(true);
    expect(verifyOwnerClaimPassphrase('wrong-code')).toBe(false);

    // Owner can manage users AND view user chat transcripts
    expect(canManageUsers('owner')).toBe(true);
    expect(canViewUserChats('owner')).toBe(true);

    // Admin can manage users/quotas/timeouts, but CANNOT view private user chat transcripts
    expect(canManageUsers('admin')).toBe(true);
    expect(canViewUserChats('admin')).toBe(false);

    // Standard user can do neither
    expect(canManageUsers('user')).toBe(false);
    expect(canViewUserChats('user')).toBe(false);
  });

  it('automatically rotates to the next active key when primary key reaches 100% token limit', () => {
    const state = createDefaultFreePoolState();
    const now = Date.now();

    const key1 = {
      id: 'pool_k1',
      provider: 'gemini' as const,
      model: 'gemini-2.5-flash',
      maskedKey: maskApiKey('AIzaSyKeyOne123456789'),
      encodedSecret: encodePoolSecret('AIzaSyKeyOne123456789'),
      ownerUserId: 'usr_owner_1',
      ownerLabel: 'Workspace Owner',
      targetUserId: '*',
      tokenLimit: 1000,
      tokensUsed: 1000, // Exhausted!
      promptTokensUsed: 600,
      completionTokensUsed: 400,
      createdAt: now - 5000,
      expiresAt: null,
      isActive: true,
      status: 'exhausted' as const,
    };

    const key2 = {
      id: 'pool_k2',
      provider: 'groq' as const,
      model: 'llama-3.3-70b-versatile',
      maskedKey: maskApiKey('gsk_SecondKey987654321'),
      encodedSecret: encodePoolSecret('gsk_SecondKey987654321'),
      ownerUserId: 'usr_owner_1',
      ownerLabel: 'Workspace Owner',
      targetUserId: '*',
      tokenLimit: 5000,
      tokensUsed: 200,
      promptTokensUsed: 100,
      completionTokensUsed: 100,
      createdAt: now - 3000,
      expiresAt: null,
      isActive: true,
      status: 'active' as const,
    };

    state.sharedKeys = [key1, key2];
    expect(evaluatePoolKeyStatus(key1, now)).toBe('exhausted');
    expect(evaluatePoolKeyStatus(key2, now)).toBe('active');

    const selected = selectActivePoolKeyForUser(state.sharedKeys, 'usr_owner_1', undefined, now);
    expect(selected?.selectedKey.id).toBe('pool_k2');
    expect(selected?.decodedSecret).toBe('gsk_SecondKey987654321');
    expect(decodePoolSecret(selected!.selectedKey.encodedSecret)).toBe('gsk_SecondKey987654321');
  });

  it('enforces targetUserId scoping across pool keys', () => {
    const state = createDefaultFreePoolState();
    const now = Date.now();

    const aliceOnlyKey = {
      id: 'pool_alice',
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      maskedKey: maskApiKey('sk-AlicePrivateSharedKey1234'),
      encodedSecret: encodePoolSecret('sk-AlicePrivateSharedKey1234'),
      ownerUserId: 'usr_owner_1',
      ownerLabel: 'Workspace Owner',
      targetUserId: 'usr_alice',
      tokenLimit: 10000,
      tokensUsed: 0,
      promptTokensUsed: 0,
      completionTokensUsed: 0,
      createdAt: now,
      expiresAt: null,
      isActive: true,
      status: 'active' as const,
    };

    state.sharedKeys = [aliceOnlyKey];

    expect(selectActivePoolKeyForUser(state.sharedKeys, 'usr_alice', undefined, now)?.selectedKey.id).toBe('pool_alice');
    expect(selectActivePoolKeyForUser(state.sharedKeys, 'usr_owner_1', undefined, now)).toBe(null);
  });
});

describe('Hidden .agents/<slug>/ Sub-Agent Workspaces, finish_task Cron Jobs & Sandbox Isolation', () => {
  it('generates English .agents/<slug>/ markdown files and hides them from visible user files', () => {
    const files = buildSubAgentWorkspaceFiles({
      name: 'UI Architect',
      role: 'developer',
      currentTask: 'Refactor responsive header layout',
      status: 'running',
      summary: 'Completed header component audit',
      allowedFiles: ['components/Header.tsx'],
    });
    expect(files.length).toBe(4);
    expect(files.map((f) => f.path)).toEqual([
      '.agents/ui-architect/README.md',
      '.agents/ui-architect/RULES.md',
      '.agents/ui-architect/STATUS.md',
      '.agents/ui-architect/LOG.md',
    ]);
    expect(isHiddenAgentWorkspacePath('.agents/ui-architect/STATUS.md')).toBe(true);
    expect(isHiddenAgentWorkspacePath('src/App.tsx')).toBe(false);

    const visible = filterVisibleUserFiles([
      ...files.map((f, i) => ({ id: `h_${i}`, name: f.path.split('/').pop() || '', path: f.path })),
      { id: 'u1', name: 'App.tsx', path: 'src/App.tsx' },
    ]);
    expect(visible.length).toBe(1);
    expect(visible[0].path).toBe('src/App.tsx');
  });

  it('triggers on_finish_task Cron Jobs when finish_task completes', () => {
    const wf = createDefaultSubAgentWorkflowState();
    wf.cronJobs.push({
      id: 'cron_test_1',
      name: 'Post-Developer Critic Audit',
      targetSubAgentSlug: 'security-auditor',
      targetRole: 'critic',
      scheduleExpression: 'on_finish:ui-architect',
      triggerOnFinishOf: 'ui-architect',
      taskInstruction: 'Audit modified UI files after finish_task',
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
      createdBy: 'dev0',
    });

    const evalRes = evaluateCronJobsOnFinishTask(wf.cronJobs, 'ui-architect');
    expect(evalRes.triggeredJobs.length).toBe(1);
    expect(evalRes.triggeredJobs[0].id).toBe('cron_test_1');
  });

  it('strips legacy self-source (studio-ide) projects and enforces isolated user sandboxes', () => {
    const legacySelfProject = {
      id: 'studio-ide',
      name: 'ZeroProCode IDE (Self)',
      description: 'Self source',
      projectType: 'studio-ide' as const,
      createdAt: 1,
      updatedAt: 1,
      files: [
        { id: '1', name: 'AppProvider.tsx', path: 'providers/AppProvider.tsx', content: '', language: 'typescript', updatedAt: 1 },
        { id: '2', name: 'ai-service.ts', path: 'utils/ai-service.ts', content: '', language: 'typescript', updatedAt: 1 },
      ],
    };
    expect(isLegacySelfSourceProject(legacySelfProject)).toBe(true);

    const sanitized = sanitizeUserSandboxProjects([legacySelfProject]);
    expect(sanitized.length).toBeGreaterThanOrEqual(1);
    expect(sanitized.some((p) => p.id === 'studio-ide')).toBe(false);
    expect(sanitized[0].id).toBe('dev0-sandbox-starter');
  });
});
