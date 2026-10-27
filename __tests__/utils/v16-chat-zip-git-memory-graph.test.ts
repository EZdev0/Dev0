import {
  createChatZipArchive,
  readChatZipArchive,
} from '../../utils/chat-zip';
import {
  saveCrossChatSessionSnapshot,
  readOtherChatMessages,
  clearCrossChatStoreForTests,
} from '../../utils/cross-chat-reader';
import {
  createRestorePoint,
  listRestorePoints,
  findRestorePoint,
  deleteRestorePoint,
  computeDiffSummary,
  formatGitStatusReport,
} from '../../utils/git-restore';
import { buildMemoryOnlySynapseGraph } from '../../utils/synapse-graph';
import {
  getAvailableTools,
  buildSystemPrompt,
} from '../../utils/ai-service';
import {
  DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES,
  discoverYamlSkills,
} from '../../utils/skill-loader';
import { generateSmartSubAgentConfig } from '../../utils/subagent-question-relay';
import { isProjectFilesystemOrAgentOnlyTool } from '../../types';

describe('Dev0 v1.6 Architecture: Chat ZIP, Cross-Chat Reader, Dual Git Restore, Standalone Memory Graph & Zero Hardcoded Templates', () => {
  describe('Chat ZIP Archive Engine (zip_create & zip_read)', () => {
    it('creates a valid downloadable PKZIP archive and reads file list & contents back', () => {
      const artifact = createChatZipArchive('landing-page-demo', [
        {
          path: 'index.html',
          content: '<!doctype html><html><body><h1>Hello Dev0 ZIP</h1></body></html>',
        },
        {
          path: 'styles.css',
          content: 'body { background: #0f172a; color: #f8fafc; }',
        },
      ]);

      expect(artifact.name).toBe('landing-page-demo.zip');
      expect(artifact.fileCount).toBe(2);
      expect(artifact.base64Data.length).toBeGreaterThan(20);
      expect(artifact.totalBytes).toBeGreaterThan(50);

      const listSummary = readChatZipArchive(artifact);
      expect(listSummary).toContain('ZIP Bundle: landing-page-demo.zip');
      expect(listSummary).toContain('index.html');
      expect(listSummary).toContain('styles.css');

      const htmlContent = readChatZipArchive(artifact, 'index.html');
      expect(htmlContent).toContain('<h1>Hello Dev0 ZIP</h1>');
    });
  });

  describe('Cross-Chat Session Snapshot & Token-Efficient Reader (read_other_chat_messages)', () => {
    beforeEach(async () => {
      await clearCrossChatStoreForTests();
    });

    it('stores chat snapshots and performs BM25 keyword search across other chat sessions', async () => {
      await saveCrossChatSessionSnapshot('chat_alpha', 'Docker & Redis Architecture', [
        {
          id: 'm1',
          role: 'user',
          content: 'How should we configure Redis caching inside our Docker container?',
          timestamp: 1000,
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'Use redis:7-alpine with maxmemory-policy allkeys-lru on port 6379.',
          timestamp: 2000,
        },
      ]);

      await saveCrossChatSessionSnapshot('chat_beta', 'Current Session', [
        {
          id: 'm3',
          role: 'user',
          content: 'Check what we decided about Redis earlier.',
          timestamp: 3000,
        },
      ]);

      const report = await readOtherChatMessages({
        currentChatId: 'chat_beta',
        query: 'redis maxmemory alpine',
        maxMessages: 4,
      });

      expect(report).toContain('Docker & Redis Architecture');
      expect(report).toContain('allkeys-lru');
      expect(report.length).toBeLessThanOrEqual(1850);
    });
  });

  describe('Built-in Dual Git & Restore Point System', () => {
    const baseFiles = [
      { id: '1', name: 'App.tsx', path: 'App.tsx', content: 'export default function App() { return null; }', language: 'typescript' },
      { id: '2', name: 'utils.ts', path: 'utils.ts', content: 'export const VERSION = 1;', language: 'typescript' },
    ];

    const updatedFiles = [
      { id: '1', name: 'App.tsx', path: 'App.tsx', content: 'export default function App() { return <main />; }', language: 'typescript' },
      { id: '3', name: 'newFile.ts', path: 'newFile.ts', content: 'export const NEW = true;', language: 'typescript' },
    ];

    it('computes accurate file diffs between snapshots', () => {
      const diff = computeDiffSummary(baseFiles, updatedFiles);
      expect(diff.added).toEqual(['newFile.ts']);
      expect(diff.modified).toEqual(['App.tsx']);
      expect(diff.deleted).toEqual(['utils.ts']);
      expect(diff.unchangedCount).toBe(0);
    });

    it('creates, lists, finds, formats status, and deletes restore points', async () => {
      const rp1 = await createRestorePoint({
        projectId: 'proj_test_git',
        projectName: 'Git Test Project',
        label: 'Initial baseline snapshot',
        source: 'manual',
        files: baseFiles,
      });

      expect(rp1.commitHash).toHaveLength(7);
      expect(rp1.fileCount).toBe(2);

      const rp2 = await createRestorePoint({
        projectId: 'proj_test_git',
        projectName: 'Git Test Project',
        label: 'Updated UI and added newFile',
        source: 'ai-tool',
        files: updatedFiles,
      });

      const list = await listRestorePoints('proj_test_git');
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0].id).toBe(rp2.id);

      const foundByHash = await findRestorePoint('proj_test_git', rp1.commitHash);
      expect(foundByHash?.id).toBe(rp1.id);
      expect(foundByHash?.files.length).toBe(2);

      const statusText = formatGitStatusReport('proj_test_git', updatedFiles);
      expect(statusText).toContain('Git & Restore Status');
      expect(statusText).toContain(rp2.commitHash);

      const deleted = await deleteRestorePoint('proj_test_git', rp1.id);
      expect(deleted).toBe(true);
    });
  });

  describe('Standalone Memory Graph (Works Without Active Project)', () => {
    it('builds an interactive Memory Graph from memos alone without project files', () => {
      const memos = [
        {
          id: 'memo_1',
          content: 'Always use TypeScript strict mode and English documentation across the repository.',
          createdAt: Date.now() - 10000,
        },
        {
          id: 'memo_2',
          content: 'TypeScript interfaces should remain clean and modular for documentation.',
          createdAt: Date.now(),
        },
      ];

      const graph = buildMemoryOnlySynapseGraph({
        memos,
        projectName: 'Standalone Memory Graph',
      });

      expect(graph.stats.totalMemories).toBe(2);
      expect(graph.stats.totalFiles).toBe(0);
      expect(graph.nodes.some((n) => n.type === 'memo')).toBe(true);
      expect(graph.edges.length).toBeGreaterThan(0);
    });
  });

  describe('Normal Chat Mode vs. Agent Mode Tool Isolation', () => {
    it('strips project filesystem and sub_agent tools in Normal Chat Mode while keeping ZIP, Plan, Cross-Chat, and Memory tools', () => {
      expect(isProjectFilesystemOrAgentOnlyTool('read_file')).toBe(true);
      expect(isProjectFilesystemOrAgentOnlyTool('write_file')).toBe(true);
      expect(isProjectFilesystemOrAgentOnlyTool('sub_agent')).toBe(true);
      expect(isProjectFilesystemOrAgentOnlyTool('zip_create')).toBe(false);
      expect(isProjectFilesystemOrAgentOnlyTool('draft_agent_plan')).toBe(false);

      const normalChatTools = getAvailableTools({
        chatModeOnly: true,
        agentMode: false,
        learningEnabled: true,
      });

      const normalNames = normalChatTools.map((t) => t.name);
      expect(normalNames).toContain('zip_create');
      expect(normalNames).toContain('zip_read');
      expect(normalNames).toContain('draft_agent_plan');
      expect(normalNames).toContain('read_other_chat_messages');
      expect(normalNames).toContain('memory_search');
      expect(normalNames).toContain('memory_update');
      expect(normalNames).toContain('memory_delete');
      expect(normalNames).toContain('memory_graph_query');

      expect(normalNames).not.toContain('read_file');
      expect(normalNames).not.toContain('write_file');
      expect(normalNames).not.toContain('edit_file');
      expect(normalNames).not.toContain('delete_file');
      expect(normalNames).not.toContain('sub_agent');

      const prompt = buildSystemPrompt({
        isNormalChatMode: true,
        agentMode: false,
      });
      expect(prompt).toContain('NORMAL CHAT MODE');
      expect(prompt).toContain('zip_create');
    });
  });

  describe('Zero Hardcoded Sub-Agents / Skills & AI Generate All Sub-Agent Helper', () => {
    it('contains zero hardcoded sub-agent templates or workspace skills when project is empty', () => {
      expect(DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES).toEqual([]);
      expect(discoverYamlSkills([])).toEqual([]);
    });

    it('generates a complete English Sub-Agent configuration for the AI Generate All lock button', () => {
      const generated = generateSmartSubAgentConfig({
        id: 'req_1',
        source: 'sub_agent',
        subAgentRole: 'developer',
        subAgentName: 'UI Polish Specialist',
        suggestedTask: 'Refactor the modal header and add keyboard accessibility.',
        allowedFiles: ['components/*'],
        questions: [
          { id: 'q1', question: 'Which components should be prioritized?', answer: '' },
          { id: 'q2', question: 'Should dark mode contrast be checked?', answer: '' },
        ],
        saveToSubAgentList: true,
        createdAt: Date.now(),
      });

      expect(generated.subAgentRole).toBe('developer');
      expect(generated.subAgentName).toBeTruthy();
      expect(generated.taskInstruction.length).toBeGreaterThan(10);
      expect(Object.keys(generated.answers).length).toBe(2);
    });
  });
});
