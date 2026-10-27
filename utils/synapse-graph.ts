/**
 * RepoGraph & LocAgent-Inspired Synapse Memory Graph Engine
 *
 * Parses project FileNodes, exported functions/components/hooks/classes,
 * import relationships, function call invocations, persistent memories,
 * and YAML skills into an interactive directed heterogeneous graph.
 */

import { FileNode, MemoEntry, Project } from '@/types';
import { ParsedYamlSkill } from '@/utils/skill-loader';

export type SynapseNodeType = 'project' | 'file' | 'function' | 'memo' | 'skill';

export type SynapseEdgeRelation =
  | 'contains'
  | 'imports'
  | 'calls'
  | 'remembers'
  | 'governs';

export interface SynapseNode {
  id: string;
  type: SynapseNodeType;
  label: string;
  subtitle?: string;
  filePath?: string;
  lineNumber?: number;
  endLineNumber?: number;
  signature?: string;
  snippet?: string;
  language?: string;
  x: number;
  y: number;
  degree: number;
  metadata?: Record<string, any>;
}

export interface SynapseEdge {
  id: string;
  source: string;
  target: string;
  relation: SynapseEdgeRelation;
  label?: string;
}

export interface SynapseGraph {
  projectId: string;
  projectName: string;
  nodes: SynapseNode[];
  edges: SynapseEdge[];
  stats: {
    fileCount: number;
    functionCount: number;
    memoCount: number;
    skillCount: number;
    edgeCount: number;
  };
}

interface ExtractedSymbol {
  name: string;
  kind: 'function' | 'component' | 'hook' | 'class' | 'interface';
  lineNumber: number;
  signature: string;
  snippet: string;
}

function flattenProjectFiles(
  nodes: FileNode[],
  basePath: string = '',
): { path: string; content: string; name: string }[] {
  const result: { path: string; content: string; name: string }[] = [];
  if (!Array.isArray(nodes)) return result;

  for (const node of nodes) {
    const currentPath = basePath ? `${basePath}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({
        path: currentPath,
        name: node.name,
        content: node.content || '',
      });
    } else if (node.type === 'directory' && Array.isArray(node.children)) {
      result.push(...flattenProjectFiles(node.children, currentPath));
    }
  }
  return result;
}

/**
 * Extracts functions, hooks, classes, and components from source code
 */
export function extractSymbolsFromCode(content: string, filePath: string): ExtractedSymbol[] {
  if (!content) return [];
  const symbols: ExtractedSymbol[] = [];
  const seen = new Set<string>();
  const lines = content.split('\n');

  const isCodeFile = /\.(tsx?|jsx?|py|kt|java|rs|go|swift|c|cpp)$/i.test(filePath);
  if (!isCodeFile) return symbols;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      continue;
    }

    // 1. JS/TS function or export function
    const fnMatch = trimmed.match(
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)/,
    );
    if (fnMatch) {
      const name = fnMatch[1];
      if (!seen.has(name)) {
        seen.add(name);
        const kind = name.startsWith('use')
          ? 'hook'
          : /^[A-Z]/.test(name)
            ? 'component'
            : 'function';
        symbols.push({
          name,
          kind,
          lineNumber: i + 1,
          signature: `${name}(${fnMatch[2].slice(0, 40)})`,
          snippet: lines.slice(i, Math.min(lines.length, i + 8)).join('\n'),
        });
      }
      continue;
    }

    // 2. Arrow function / React.memo / const hook or function
    const arrowMatch = trimmed.match(
      /^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::\s*[^=]+)?=\s*(?:React\.memo\s*\(\s*)?(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/,
    );
    if (arrowMatch) {
      const name = arrowMatch[1];
      if (!seen.has(name) && name.length > 2) {
        seen.add(name);
        const kind = name.startsWith('use')
          ? 'hook'
          : /^[A-Z]/.test(name)
            ? 'component'
            : 'function';
        symbols.push({
          name,
          kind,
          lineNumber: i + 1,
          signature: `const ${name} = (...) =>`,
          snippet: lines.slice(i, Math.min(lines.length, i + 8)).join('\n'),
        });
      }
      continue;
    }

    // 3. Class or Interface
    const classMatch = trimmed.match(
      /^(?:export\s+)?(?:default\s+)?(class|interface)\s+([A-Za-z0-9_$]+)/,
    );
    if (classMatch) {
      const kind = classMatch[1] === 'interface' ? 'interface' : 'class';
      const name = classMatch[2];
      if (!seen.has(name)) {
        seen.add(name);
        symbols.push({
          name,
          kind,
          lineNumber: i + 1,
          signature: `${classMatch[1]} ${name}`,
          snippet: lines.slice(i, Math.min(lines.length, i + 6)).join('\n'),
        });
      }
      continue;
    }

    // 4. Python def / Kotlin fun
    const pyKtMatch = trimmed.match(/^(?:suspend\s+|private\s+|public\s+)?(?:def|fun)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
    if (pyKtMatch) {
      const name = pyKtMatch[1];
      if (!seen.has(name)) {
        seen.add(name);
        symbols.push({
          name,
          kind: 'function',
          lineNumber: i + 1,
          signature: `${name}(${pyKtMatch[2].slice(0, 40)})`,
          snippet: lines.slice(i, Math.min(lines.length, i + 8)).join('\n'),
        });
      }
    }
  }

  return symbols.slice(0, 14);
}

/**
 * Extracts relative or alias import specifiers from a source file
 */
export function extractImportsFromCode(content: string): string[] {
  if (!content) return [];
  const imports: string[] = [];
  const importRegex = /(?:import\s+[\s\S]*?from\s+|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const spec = match[1]?.trim();
    if (spec) imports.push(spec);
  }
  return imports;
}

function resolveImportToFilePath(
  importSpec: string,
  importerPath: string,
  allFilePaths: string[],
): string | null {
  let cleanSpec = importSpec;
  if (cleanSpec.startsWith('@/')) {
    cleanSpec = cleanSpec.slice(2);
  } else if (cleanSpec.startsWith('./') || cleanSpec.startsWith('../')) {
    const importerParts = importerPath.split('/');
    importerParts.pop();
    const specParts = cleanSpec.split('/');
    for (const part of specParts) {
      if (part === '.') continue;
      if (part === '..') importerParts.pop();
      else importerParts.push(part);
    }
    cleanSpec = importerParts.join('/');
  } else {
    // Check if it matches any file basename directly
    const byName = allFilePaths.find(p => p.endsWith(`/${cleanSpec}`) || p === cleanSpec);
    if (byName) return byName;
    return null;
  }

  const candidates = [
    cleanSpec,
    `${cleanSpec}.ts`,
    `${cleanSpec}.tsx`,
    `${cleanSpec}.js`,
    `${cleanSpec}.jsx`,
    `${cleanSpec}.py`,
    `${cleanSpec}.kt`,
    `${cleanSpec}/index.ts`,
    `${cleanSpec}/index.tsx`,
  ];

  for (const cand of candidates) {
    const found = allFilePaths.find(p => p === cand || p.endsWith(`/${cand}`));
    if (found) return found;
  }
  return null;
}

/**
 * Builds the complete Synapse Memory Graph for a Project
 */
export function buildSynapseGraph(options: {
  project: Project | null;
  memos: MemoEntry[];
  skills?: ParsedYamlSkill[];
}): SynapseGraph {
  const { project, memos, skills = [] } = options;
  const nodes: SynapseNode[] = [];
  const edges: SynapseEdge[] = [];

  if (!project) {
    return {
      projectId: 'none',
      projectName: 'No Project',
      nodes: [],
      edges: [],
      stats: { fileCount: 0, functionCount: 0, memoCount: 0, skillCount: 0, edgeCount: 0 },
    };
  }

  const flatFiles = flattenProjectFiles(project.files);
  const allFilePaths = flatFiles.map(f => f.path);

  // Center coordinates for radial synapse layout
  const centerX = 480;
  const centerY = 360;

  const projectNodeId = `proj_${project.id}`;
  nodes.push({
    id: projectNodeId,
    type: 'project',
    label: project.name,
    subtitle: `${flatFiles.length} files · ${project.projectType}`,
    x: centerX,
    y: centerY,
    degree: 0,
    metadata: { projectType: project.projectType, createdAt: project.createdAt },
  });

  const fileNodeMap = new Map<string, SynapseNode>();
  const symbolNodeMap = new Map<string, { node: SynapseNode; filePath: string; content: string }>();

  // Ring 1: File Nodes
  const fileCount = flatFiles.length;
  flatFiles.forEach((f, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(1, fileCount);
    const radius = fileCount <= 6 ? 150 : 185 + (idx % 2) * 35;
    const x = Math.round(centerX + Math.cos(angle) * radius);
    const y = Math.round(centerY + Math.sin(angle) * radius);
    const lineCount = f.content ? f.content.split('\n').length : 0;

    const fileNode: SynapseNode = {
      id: `file_${f.path}`,
      type: 'file',
      label: f.name,
      subtitle: `${f.path} (${lineCount} lines)`,
      filePath: f.path,
      lineNumber: 1,
      snippet: f.content.slice(0, 400),
      x,
      y,
      degree: 1,
      metadata: { lineCount, size: f.content.length },
    };
    nodes.push(fileNode);
    fileNodeMap.set(f.path, fileNode);

    edges.push({
      id: `e_proj_${f.path}`,
      source: projectNodeId,
      target: fileNode.id,
      relation: 'contains',
    });

    // Ring 2: Extracted Function / Component / Hook / Class Nodes
    const symbols = extractSymbolsFromCode(f.content, f.path);
    symbols.forEach((sym, sIdx) => {
      const spread = ((sIdx - (symbols.length - 1) / 2) * 0.22);
      const symAngle = angle + spread;
      const symRadius = radius + 115 + (sIdx % 2) * 28;
      const sx = Math.round(centerX + Math.cos(symAngle) * symRadius);
      const sy = Math.round(centerY + Math.sin(symAngle) * symRadius);

      const symId = `fn_${f.path}_${sym.name}`;
      const fnNode: SynapseNode = {
        id: symId,
        type: 'function',
        label: sym.name,
        subtitle: `${sym.kind} · ${f.name}:${sym.lineNumber}`,
        filePath: f.path,
        lineNumber: sym.lineNumber,
        signature: sym.signature,
        snippet: sym.snippet,
        x: sx,
        y: sy,
        degree: 1,
        metadata: { kind: sym.kind },
      };
      nodes.push(fnNode);
      symbolNodeMap.set(`${f.path}::${sym.name}`, { node: fnNode, filePath: f.path, content: sym.snippet });

      edges.push({
        id: `e_contains_${f.path}_${sym.name}`,
        source: fileNode.id,
        target: symId,
        relation: 'contains',
        label: sym.kind,
      });
    });
  });

  // File-to-File Import Edges
  for (const f of flatFiles) {
    const sourceNode = fileNodeMap.get(f.path);
    if (!sourceNode) continue;
    const specs = extractImportsFromCode(f.content);
    for (const spec of specs) {
      const resolved = resolveImportToFilePath(spec, f.path, allFilePaths);
      if (resolved && resolved !== f.path) {
        const targetNode = fileNodeMap.get(resolved);
        if (targetNode) {
          edges.push({
            id: `e_imp_${f.path}_${resolved}`,
            source: sourceNode.id,
            target: targetNode.id,
            relation: 'imports',
            label: 'imports',
          });
        }
      }
    }
  }

  // Function-to-Function Call Edges
  const allSymbols = Array.from(symbolNodeMap.values());
  for (const caller of allSymbols) {
    for (const callee of allSymbols) {
      if (caller.node.id === callee.node.id) continue;
      const callRegex = new RegExp(`\\b${callee.node.label}\\s*(?:\\(|<)`, 'g');
      if (callRegex.test(caller.content)) {
        edges.push({
          id: `e_call_${caller.node.id}_${callee.node.id}`,
          source: caller.node.id,
          target: callee.node.id,
          relation: 'calls',
          label: 'calls',
        });
      }
    }
  }

  // Memory Synapse Nodes (linked to matching files/functions or project root)
  memos.forEach((memo, mIdx) => {
    const angle = Math.PI * 0.25 + (2 * Math.PI * mIdx) / Math.max(1, memos.length);
    const radius = 340;
    const mx = Math.round(centerX + Math.cos(angle) * radius);
    const my = Math.round(centerY + Math.sin(angle) * radius);
    const shortTitle = memo.content.split('\n')[0]?.replace(/^[#*\-\s]+/, '').slice(0, 38) || `Memory #${mIdx + 1}`;

    const memoNode: SynapseNode = {
      id: `memo_${memo.id}`,
      type: 'memo',
      label: shortTitle,
      subtitle: new Date(memo.createdAt).toLocaleDateString(),
      snippet: memo.content,
      x: mx,
      y: my,
      degree: 0,
      metadata: { createdAt: memo.createdAt, memoId: memo.id },
    };
    nodes.push(memoNode);

    let linkedCount = 0;
    const lowerMemo = memo.content.toLowerCase();

    for (const f of flatFiles) {
      if (lowerMemo.includes(f.path.toLowerCase()) || lowerMemo.includes(f.name.toLowerCase())) {
        edges.push({
          id: `e_mem_file_${memo.id}_${f.path}`,
          source: memoNode.id,
          target: `file_${f.path}`,
          relation: 'remembers',
          label: 'context',
        });
        linkedCount++;
      }
    }

    for (const sym of allSymbols) {
      if (sym.node.label.length >= 4 && lowerMemo.includes(sym.node.label.toLowerCase())) {
        edges.push({
          id: `e_mem_fn_${memo.id}_${sym.node.id}`,
          source: memoNode.id,
          target: sym.node.id,
          relation: 'remembers',
          label: 'function memo',
        });
        linkedCount++;
      }
    }

    if (linkedCount === 0) {
      edges.push({
        id: `e_mem_proj_${memo.id}`,
        source: memoNode.id,
        target: projectNodeId,
        relation: 'remembers',
        label: 'project memory',
      });
    }
  });

  // Active YAML Skill Nodes
  const activeSkills = skills.filter(s => s.enabled);
  activeSkills.forEach((skill, sIdx) => {
    const angle = -Math.PI * 0.4 + (2 * Math.PI * sIdx) / Math.max(1, activeSkills.length);
    const radius = 370;
    const kx = Math.round(centerX + Math.cos(angle) * radius);
    const ky = Math.round(centerY + Math.sin(angle) * radius);

    const skillNode: SynapseNode = {
      id: `skill_${skill.id}`,
      type: 'skill',
      label: skill.name,
      subtitle: `${skill.trigger} · ${skill.sourcePath}`,
      filePath: skill.sourcePath,
      snippet: skill.body.slice(0, 400),
      x: kx,
      y: ky,
      degree: 1,
      metadata: { trigger: skill.trigger, alwaysApply: skill.alwaysApply },
    };
    nodes.push(skillNode);

    edges.push({
      id: `e_skill_proj_${skill.id}`,
      source: skillNode.id,
      target: projectNodeId,
      relation: 'governs',
      label: skill.trigger,
    });
  });

  // Compute node degree counts
  const degreeMap = new Map<string, number>();
  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
  }
  for (const node of nodes) {
    node.degree = degreeMap.get(node.id) || 0;
  }

  return {
    projectId: project.id,
    projectName: project.name,
    nodes,
    edges,
    stats: {
      fileCount: flatFiles.length,
      functionCount: allSymbols.length,
      memoCount: memos.length,
      skillCount: activeSkills.length,
      edgeCount: edges.length,
    },
  };
}

/**
 * Multi-hop Code & Memory Localization (RepoGraph / LocAgent ego-graph retrieval).
 * Given a user prompt or search query, finds the top matching synapse nodes and their
 * immediate callers/callees/memories to inject into the LLM prompt with minimal token usage.
 */
export function localizeCodeSubgraph(
  graph: SynapseGraph,
  query: string,
  maxNodes: number = 12,
): { matchedNodes: SynapseNode[]; summaryMarkdown: string } {
  if (!graph || graph.nodes.length === 0 || !query.trim()) {
    return { matchedNodes: [], summaryMarkdown: '' };
  }

  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_$./-]+/)
    .filter(t => t.length >= 2);

  if (terms.length === 0) {
    return { matchedNodes: [], summaryMarkdown: '' };
  }

  const scored: { node: SynapseNode; score: number }[] = [];
  for (const node of graph.nodes) {
    if (node.type === 'project') continue;
    let score = 0;
    const labelLower = node.label.toLowerCase();
    const pathLower = (node.filePath || '').toLowerCase();
    const snippetLower = (node.snippet || '').toLowerCase();

    for (const term of terms) {
      if (labelLower === term) score += 15;
      else if (labelLower.includes(term)) score += 8;
      if (pathLower.includes(term)) score += 6;
      if (snippetLower.includes(term)) score += 3;
    }

    if (score > 0) {
      scored.push({ node, score: score + Math.min(node.degree, 5) * 0.5 });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const primary = scored.slice(0, maxNodes).map(s => s.node);
  const selectedIds = new Set(primary.map(n => n.id));

  // 1-hop neighborhood expansion (callers, callees, linked memories)
  for (const edge of graph.edges) {
    if (selectedIds.size >= maxNodes + 6) break;
    if (selectedIds.has(edge.source) && !selectedIds.has(edge.target)) {
      const targetNode = graph.nodes.find(n => n.id === edge.target);
      if (targetNode && targetNode.type !== 'project') {
        selectedIds.add(targetNode.id);
        primary.push(targetNode);
      }
    } else if (selectedIds.has(edge.target) && !selectedIds.has(edge.source)) {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      if (sourceNode && sourceNode.type !== 'project') {
        selectedIds.add(sourceNode.id);
        primary.push(sourceNode);
      }
    }
  }

  if (primary.length === 0) {
    return { matchedNodes: [], summaryMarkdown: '' };
  }

  let md = '## Synapse Graph Code Localization (RepoGraph Index)\n';
  for (const node of primary) {
    if (node.type === 'file') {
      md += `- [FILE] \`${node.filePath}\` (${node.subtitle})\n`;
    } else if (node.type === 'function') {
      md += `- [SYMBOL] \`${node.signature || node.label}\` in \`${node.filePath}:${node.lineNumber}\`\n`;
    } else if (node.type === 'memo') {
      md += `- [MEMORY SYNAPSE] ${node.label}: ${(node.snippet || '').slice(0, 140)}\n`;
    } else if (node.type === 'skill') {
      md += `- [ACTIVE SKILL] ${node.label} (${node.filePath})\n`;
    }
  }

  return { matchedNodes: primary, summaryMarkdown: md };
}
