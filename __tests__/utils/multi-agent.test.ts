import { createSubAgent, SUB_AGENT_PERMISSIONS, SubAgentType } from '../../utils/multi-agent-system';

describe('multi-agent system utils', () => {
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
});
