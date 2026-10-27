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
  evaluatePoolKeyStatus,
  selectActivePoolKeyForUser,
} from '@/utils/free-ai-pool';
import { ChatMessage, TOOL_REGISTRY } from '@/types';
import { TOOL_DEFINITIONS } from '@/utils/ai-service';

describe('Strict Question Tool Detection & Sub-Agent Floating Window Relay', () => {
  it('registers ask_user_question in both TOOL_DEFINITIONS and TOOL_REGISTRY', () => {
    const inDefs = TOOL_DEFINITIONS.some((t) => t.name === 'ask_user_question');
    const inReg = TOOL_REGISTRY.some((t) => t.name === 'ask_user_question');
    expect(inDefs).toBe(true);
    expect(inReg).toBe(true);
  });

  it('does NOT trigger hasExplicitQuestionToolCall for plain-text assistant replies containing question marks', () => {
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
  });

  it('triggers hasExplicitQuestionToolCall ONLY when ask_user_question tool is explicitly called or pendingSubAgentQuestion is active', () => {
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

  it('detects Sub-Agent question turns and builds a Floating Window request', () => {
    const detected = detectSubAgentQuestionFromTurn(
      'starte einen subagent',
      'I can start a sub-agent for you. What role should the sub-agent have (e.g., localizer, developer, critic), and what task should I assign to it?',
    );
    expect(detected).toBeDefined();
    expect(detected?.source).toBe('sub_agent');
    expect(detected?.questions.length).toBeGreaterThanOrEqual(1);
    expect(detected?.saveToSubAgentList).toBe(true);
  });

  it('saves configured Sub-Agent to the Saved Sub-Agent List and relays answers to Main Creator Agent', async () => {
    const req = buildSubAgentQuestionRequestFromTool({
      is_sub_agent: true,
      sub_agent_name: 'UI Audit Specialist',
      sub_agent_role: 'critic',
      allowed_files: ['components/**', 'app/**'],
      questions: [
        'Which components should be audited?',
        'Should strict accessibility checks be enforced?',
      ],
    });

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

describe('Free AI Key Pool Multi-Key Rotation, User Scoping & Governance', () => {
  it('automatically rotates to the next active key when primary key reaches 100% token limit', () => {
    const state = createDefaultFreePoolState();
    const now = Date.now();

    const key1 = {
      id: 'pool_k1',
      provider: 'gemini' as const,
      model: 'gemini-2.5-flash',
      maskedKey: maskApiKey('AIzaSyKeyOne123456789'),
      encodedSecret: encodePoolSecret('AIzaSyKeyOne123456789'),
      ownerUserId: 'usr_super_admin',
      ownerLabel: 'ggjonasgameryt@gmail.com',
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
      ownerUserId: 'usr_super_admin',
      ownerLabel: 'ggjonasgameryt@gmail.com',
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

    const selected = selectActivePoolKeyForUser(state.sharedKeys, 'usr_super_admin', undefined, now);
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
      ownerUserId: 'usr_super_admin',
      ownerLabel: 'ggjonasgameryt@gmail.com',
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

    // Alice can use the key targeted to usr_alice
    expect(selectActivePoolKeyForUser(state.sharedKeys, 'usr_alice', undefined, now)?.selectedKey.id).toBe('pool_alice');
    // Super admin is not usr_alice, so targetUserId='usr_alice' does not match
    expect(selectActivePoolKeyForUser(state.sharedKeys, 'usr_super_admin', undefined, now)).toBe(null);
  });
});
