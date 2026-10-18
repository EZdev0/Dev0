import { createSubAgent, SUB_AGENT_PERMISSIONS, SubAgentType } from '../../utils/multi-agent-system';
import { LEARNING_TOOL_NAMES, isLearningTool, isLearningEnabled } from '../../types';
import {
  resolveDefaultModel,
  getAvailableTools,
  buildSystemPrompt,
  buildPlannerPrompt,
  callAI,
} from '../../utils/ai-service';
import {
  setMemoSystemEnabled,
  isMemoSystemEnabled,
  createMemo,
  autoCreateMemo,
} from '../../utils/memo-system';

describe('multi-agent system & AI resilience utils', () => {
  describe('createSubAgent', () => {
    const agentTypes: SubAgentType[] = ['analyst', 'developer', 'tester', 'researcher', 'critic'];

    agentTypes.forEach(type => {
      it(`should correctly initialize ${type} sub-agent`, () => {
        const agent = createSubAgent(type);
        expect(agent.id).toContain(`sub_${type}_`);
        expect(agent.type).toBe(type);
        expect(agent.status).toBe('idle');
        expect(agent.name).toBe(`${type.charAt(0).toUpperCase() + type.slice(1)}-Agent`);
        expect(agent.permissions).toEqual(SUB_AGENT_PERMISSIONS[type]);
      });
    });

    it('should set status to working when task is provided', () => {
      const task = {
        id: 't-1',
        title: 'Analyze bundle size',
        description: 'Check dist output',
        goal: 'Optimization',
        outputFormat: 'json',
        priority: 'high' as const,
      };
      const agent = createSubAgent('analyst', task);
      expect(agent.status).toBe('working');
      expect(agent.currentTask).toBe(task);
    });

    it('should enforce read-only tools on analyst sub-agent', () => {
      const perms = SUB_AGENT_PERMISSIONS.analyst;
      expect(perms).toContain('read_file');
      expect(perms).not.toContain('write_file');
      expect(perms).not.toContain('delete_file');
    });

    it('should grant write permissions to developer sub-agent', () => {
      const perms = SUB_AGENT_PERMISSIONS.developer;
      expect(perms).toContain('write_file');
      expect(perms).toContain('create_file');
    });
  });

  describe('Learn / Memo 3-Layer Guard (Task 4)', () => {
    it('should identify all 7 learning/memo tools accurately', () => {
      expect(LEARNING_TOOL_NAMES).toHaveLength(7);
      for (const name of ['add_memo', 'read_identity_files', 'update_soul_md', 'update_agents_md', 'update_identity_md', 'update_user_md', 'update_memory_md']) {
        expect(isLearningTool(name)).toBe(true);
      }
      expect(isLearningTool('read_file')).toBe(false);
    });

    it('should evaluate isLearningEnabled correctly across flag combinations', () => {
      expect(isLearningEnabled({ betaAgentLearning: false, learningEnabled: false, memoEnabled: false })).toBe(false);
      expect(isLearningEnabled({ betaAgentLearning: true, learningEnabled: false, memoEnabled: true })).toBe(false);
      expect(isLearningEnabled({ betaAgentLearning: true, learningEnabled: true, memoEnabled: false })).toBe(false);
      expect(isLearningEnabled({ betaAgentLearning: true, learningEnabled: true, memoEnabled: true })).toBe(true);
    });

    it('should strip all 7 Learn/Memo tools from getAvailableTools when learning is disabled', () => {
      const disabledTools = getAvailableTools({
        betaAgentLearning: false,
        learningEnabled: false,
      });
      const disabledNames = disabledTools.map(t => t.name);
      for (const learnTool of LEARNING_TOOL_NAMES) {
        expect(disabledNames).not.toContain(learnTool);
      }

      const enabledTools = getAvailableTools({
        betaAgentLearning: true,
        learningEnabled: true,
      });
      const enabledNames = enabledTools.map(t => t.name);
      for (const learnTool of LEARNING_TOOL_NAMES) {
        expect(enabledNames).toContain(learnTool);
      }
    });

    it('should exclude memos and identity sections from buildSystemPrompt and buildPlannerPrompt when learning is disabled', () => {
      const sysPrompt = buildSystemPrompt({
        persona: 'default',
        projectTree: 'index.ts',
        memos: [{ id: 'm1', content: 'SECRET_MEMO_CONTENT', createdAt: 1 }],
        todos: [],
        mentionedFiles: [],
        yoloMode: true,
        soulMd: 'SECRET_SOUL_MD',
        userMd: 'SECRET_USER_MD',
        memoryMd: 'SECRET_MEMORY_MD',
        betaAgentLearning: false,
        learningEnabled: false,
      });
      expect(sysPrompt).not.toContain('SECRET_MEMO_CONTENT');
      expect(sysPrompt).not.toContain('SECRET_SOUL_MD');
      expect(sysPrompt).not.toContain('SECRET_USER_MD');
      expect(sysPrompt).not.toContain('SECRET_MEMORY_MD');
      expect(sysPrompt).not.toContain('add_memo');

      const plannerPrompt = buildPlannerPrompt({
        projectTree: 'index.ts',
        memos: [{ id: 'm1', content: 'SECRET_PLANNER_MEMO', createdAt: 1 }],
        todos: [],
        learningEnabled: false,
      });
      expect(plannerPrompt).not.toContain('SECRET_PLANNER_MEMO');
    });

    it('should block memo creation in memo-system when setMemoSystemEnabled(false)', async () => {
      setMemoSystemEnabled(false);
      expect(isMemoSystemEnabled()).toBe(false);
      const m1 = await createMemo({ type: 'global', category: 'knowledge', title: 'title', content: 'content', source: 'user', tags: [] });
      const m2 = await autoCreateMemo('project_structure', { files: ['a.ts'] });
      expect(m1).toBe(null);
      expect(m2).toBe(null);
      setMemoSystemEnabled(true);
    });
  });

  describe('resolveDefaultModel & Rork -> Pollinations Keyless Fallback (Task 1)', () => {
    it('should never return empty or undefined model in resolveDefaultModel', () => {
      expect(resolveDefaultModel('rork', '')).toBe('rork-default');
      expect(resolveDefaultModel('rork', undefined)).toBe('rork-default');
      expect(resolveDefaultModel('openai', '   ')).toBe('gpt-4o');
      expect(resolveDefaultModel('gemini', '')).toBe('gemini-2.0-flash');
      expect(resolveDefaultModel('openai', 'gpt-4o-mini')).toBe('gpt-4o-mini');
    });

    it('should retry Rork on failure and seamlessly succeed via keyless Pollinations fallback in the same call', async () => {
      const origFetch = global.fetch;
      const calledUrls: string[] = [];
      global.fetch = (async (url: any) => {
        const urlStr = String(url);
        calledUrls.push(urlStr);
        if (urlStr.includes('toolkit.rork.com')) {
          return {
            ok: false,
            status: 502,
            text: async () => 'Bad Gateway',
          } as any;
        }
        if (urlStr.includes('text.pollinations.ai/openai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'Antwort vom kostenlosen Pollinations-Fallback!' } }],
            }),
          } as any;
        }
        return { ok: false, status: 500, text: async () => 'Error' } as any;
      }) as any;

      try {
        const res = await callAI(
          'rork',
          'rork-free',
          '',
          [{ id: '1', role: 'user', content: 'Hallo', timestamp: Date.now() }],
          [],
          'System prompt',
          undefined,
          undefined,
        );
        expect(res.content).toContain('Antwort vom kostenlosen Pollinations-Fallback!');
        expect(res.usedFallback).toBe(true);
        const rorkAttempts = calledUrls.filter(u => u.includes('toolkit.rork.com')).length;
        expect(rorkAttempts).toBe(3); // 1 initial + 2 retries
      } finally {
        global.fetch = origFetch;
      }
    });
  });
});
