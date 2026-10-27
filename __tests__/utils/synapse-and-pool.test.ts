import { buildSynapseGraph, localizeCodeSubgraph } from '../../utils/synapse-graph';
import {
  parseYamlFrontmatter,
  discoverYamlSkills,
  isFileAllowedForSubAgent,
} from '../../utils/skill-loader';
import {
  estimateTokensBPE,
  extractActualTokenUsage,
  encodePoolSecret,
  decodePoolSecret,
  maskApiKey,
  selectActivePoolKeyForUser,
  SharedPoolKey,
} from '../../utils/free-ai-pool';
import { parseToolCallsFromText, repairAndParseJSON } from '../../utils/ai-service';
import { Project, MemoEntry } from '../../types';

describe('Synapse Memory Graph & Code Localization (RepoGraph / LocAgent)', () => {
  const mockProject: Project = {
    id: 'p_test',
    name: 'TestProject',
    projectType: 'react',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    files: [
      {
        id: 'f1',
        name: 'src',
        type: 'directory',
        children: [
          {
            id: 'f2',
            name: 'App.tsx',
            type: 'file',
            content:
              "import { formatScore } from './helpers';\nexport function AppMain() {\n  return formatScore(42);\n}\n",
          },
          {
            id: 'f3',
            name: 'helpers.ts',
            type: 'file',
            content: 'export const formatScore = (val: number) => `Score: ${val}`;\n',
          },
        ],
      },
    ],
  };

  const mockMemos: MemoEntry[] = [
    {
      id: 'm1',
      content: 'Make sure App.tsx formatScore handles negative numbers properly.',
      createdAt: Date.now(),
    },
  ];

  it('indexes files, exported symbols, imports, calls, and linked memories into a SynapseGraph', () => {
    const skills = discoverYamlSkills([]);
    const graph = buildSynapseGraph({
      project: mockProject,
      memos: mockMemos,
      skills,
    });

    expect(graph.stats.fileCount).toBe(2);
    expect(graph.stats.functionCount).toBeGreaterThanOrEqual(2);
    expect(graph.stats.memoCount).toBe(1);
    expect(graph.stats.skillCount).toBeGreaterThanOrEqual(1);
    expect(graph.edges.length).toBeGreaterThanOrEqual(3);
  });

  it('localizes relevant ego-subgraph nodes and code snippets for a query', () => {
    const graph = buildSynapseGraph({
      project: mockProject,
      memos: mockMemos,
      skills: [],
    });
    const result = localizeCodeSubgraph(graph, 'formatScore AppMain', 8);

    expect(result.matchedNodes.length).toBeGreaterThan(0);
    expect(result.summaryMarkdown).toContain('Synapse Graph Code Localization');
    expect(result.summaryMarkdown).toContain('formatScore');
  });
});

describe('YAML Frontmatter Skill Loader & Scoped Sub-Agents', () => {
  it('parses YAML frontmatter with trigger, alwaysApply, and array fields', () => {
    const raw = `---
name: Strict TypeScript Guard
description: Enforces zero-any and strict null checks
trigger: always_on
alwaysApply: true
allowedFiles: [src/**, utils/**]
---
# Body Rule
Always run tsc --noEmit before committing.`;

    const parsed = parseYamlFrontmatter(raw);
    expect(parsed.frontmatter.name).toBe('Strict TypeScript Guard');
    expect(parsed.frontmatter.trigger).toBe('always_on');
    expect(parsed.frontmatter.alwaysApply).toBe(true);
    expect(Array.isArray(parsed.frontmatter.allowedFiles)).toBe(true);
    expect(parsed.body).toContain('Always run tsc --noEmit');
  });

  it('discovers skills from project files and built-in .qoder/rules', () => {
    const skills = discoverYamlSkills([]);
    expect(skills.length).toBeGreaterThanOrEqual(2);
    expect(skills.some((s) => s.sourcePath.includes('.qoder/rules/lessons_learned.md'))).toBe(true);
  });

  it('enforces Sub-Agent glob file permissions via isFileAllowedForSubAgent', () => {
    expect(isFileAllowedForSubAgent('app/(tabs)/index.tsx', ['app/**', 'components/**'])).toBe(true);
    expect(isFileAllowedForSubAgent('utils/ai-service.ts', ['app/**', 'components/**'])).toBe(false);
    expect(isFileAllowedForSubAgent('any/file.ts', ['*'])).toBe(true);
  });
});

describe('Free AI Shared Key Pool, Token Reader & Secret Masking', () => {
  it('accurately estimates tokens via BPE subword tokenizer and extracts API usage', () => {
    const tokens = estimateTokensBPE('export function calculateTotal(items: number[]) { return items.length; }');
    expect(tokens).toBeGreaterThan(8);

    const openAiData = {
      usage: { prompt_tokens: 120, completion_tokens: 45, total_tokens: 165 },
    };
    const extracted = extractActualTokenUsage(openAiData, 'prompt', 'completion', 'groq', 'llama-3.3-70b');
    expect(extracted.totalTokens).toBe(165);
    expect(extracted.isExactFromAPI).toBe(true);
  });

  it('obfuscates and masks shared API keys so raw secrets are never exposed in UI', () => {
    const rawKey = 'gsk_1234567890abcdefghijklmnop9a1f';
    const masked = maskApiKey(rawKey);
    expect(masked).toContain('••••');
    expect(masked).not.toContain('1234567890abcdef');

    const encoded = encodePoolSecret(rawKey);
    expect(encoded).not.toBe(rawKey);
    expect(decodePoolSecret(encoded)).toBe(rawKey);
  });

  it('selects active pool keys respecting token quotas, expiry, and target User IDs', () => {
    const now = Date.now();
    const keys: SharedPoolKey[] = [
      {
        id: 'pk_exhausted',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        encodedSecret: encodePoolSecret('gsk_exhausted_key'),
        maskedKey: 'gsk_••••exhausted',
        ownerUserId: 'usr_admin',
        ownerLabel: 'Admin',
        targetUserId: '*',
        tokenLimit: 1000,
        tokensUsed: 1000,
        promptTokensUsed: 600,
        completionTokensUsed: 400,
        expiresAt: null,
        createdAt: now - 10000,
        isActive: true,
        status: 'exhausted',
      },
      {
        id: 'pk_valid',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        encodedSecret: encodePoolSecret('AIza_valid_shared_key_12345'),
        maskedKey: 'AIza••••2345',
        ownerUserId: 'usr_admin',
        ownerLabel: 'Admin',
        targetUserId: 'usr_target_1',
        tokenLimit: 50000,
        tokensUsed: 1200,
        promptTokensUsed: 800,
        completionTokensUsed: 400,
        expiresAt: now + 3600_000,
        createdAt: now - 5000,
        isActive: true,
        status: 'active',
      },
    ];

    const selectedForTarget = selectActivePoolKeyForUser(keys, 'usr_target_1');
    expect(selectedForTarget?.selectedKey.id).toBe('pk_valid');
    expect(selectedForTarget?.decodedSecret).toBe('AIza_valid_shared_key_12345');

    const selectedForOther = selectActivePoolKeyForUser(keys, 'usr_other_user');
    expect(selectedForOther).toBe(null);
  });
});

describe('3-Tier Hybrid ReAct / XML / JSON Tool Parser for Local & Open-Weight Models', () => {
  it('parses Tier 1 fenced ```tool JSON blocks with trailing commas', () => {
    const text = 'Let me read the file first.\n```tool\n{"name": "read_file", "arguments": {"path": "package.json",}}\n```';
    const parsed = parseToolCallsFromText(text);
    expect(parsed.toolCalls.length).toBe(1);
    expect(parsed.toolCalls[0].name).toBe('read_file');
    expect(parsed.toolCalls[0].arguments.path).toBe('package.json');
  });

  it('parses Tier 2 XML <tool> and <tool_call> tags emitted by Qwen / Hermes / DeepSeek', () => {
    const xmlText =
      'Checking project tree:\n<tool_call>{"name": "localize_code_graph", "arguments": {"query": "SynapseGraphView"}}</tool_call>';
    const parsed = parseToolCallsFromText(xmlText);
    expect(parsed.toolCalls.length).toBe(1);
    expect(parsed.toolCalls[0].name).toBe('localize_code_graph');
    expect(parsed.toolCalls[0].arguments.query).toBe('SynapseGraphView');
  });

  it('parses Tier 3 ReAct Action / Action Input blocks emitted by local Ollama models', () => {
    const reactText =
      'Thought: I need to search files.\nAction: search_files\nAction Input: {"query": "useRorkAgent"}';
    const parsed = parseToolCallsFromText(reactText);
    expect(parsed.toolCalls.length).toBe(1);
    expect(parsed.toolCalls[0].name).toBe('search_files');
    expect(parsed.toolCalls[0].arguments.query).toBe('useRorkAgent');
  });

  it('repairs malformed JSON strings via repairAndParseJSON', () => {
    const repaired = repairAndParseJSON('{"name": "list_directory", "arguments": {"path": "app",},}');
    expect(repaired).toBeDefined();
    expect(repaired?.name).toBe('list_directory');
    expect(repaired?.arguments?.path).toBe('app');
  });
});
