import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  GitBranch,
  FileCode,
  Cpu,
  Brain,
  ShieldCheck,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Plus,
  Sparkles,
  X,
  FolderPlus,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { MemoEntry, Project } from '@/types';
import {
  buildSynapseGraph,
  localizeCodeSubgraph,
  SynapseNode,
  SynapseNodeType,
} from '@/utils/synapse-graph';
import { ParsedYamlSkill } from '@/utils/skill-loader';

interface SynapseGraphViewProps {
  project: Project | null;
  projects: Project[];
  memos: MemoEntry[];
  skills: ParsedYamlSkill[];
  onSelectProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  onOpenFileInEditor: (filePath: string) => void;
  onAddLinkedMemo: (content: string) => void;
}

const NODE_COLORS: Record<SynapseNodeType, string> = {
  project: '#3B82F6',
  file: '#6366F1',
  function: '#F59E0B',
  memo: '#10B981',
  skill: '#06B6D4',
};

const NODE_LABELS: Record<SynapseNodeType, string> = {
  project: 'Project Root',
  file: 'Source File',
  function: 'Function / Symbol',
  memo: 'Memory Synapse',
  skill: 'YAML Skill / Rule',
};

export const SynapseGraphView: React.FC<SynapseGraphViewProps> = ({
  project,
  projects,
  memos,
  skills,
  onSelectProject,
  onOpenCreateProject,
  onOpenFileInEditor,
  onAddLinkedMemo,
}) => {
  const [filterType, setFilterType] = useState<'all' | SynapseNodeType>('all');
  const [localizeQuery, setLocalizeQuery] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [newMemoInput, setNewMemoInput] = useState<string>('');
  const [memoSavedToast, setMemoSavedToast] = useState<string | null>(null);

  const graph = useMemo(
    () => buildSynapseGraph({ project, memos, skills }),
    [project, memos, skills],
  );

  const localization = useMemo(
    () => localizeCodeSubgraph(graph, localizeQuery, 14),
    [graph, localizeQuery],
  );

  const highlightedIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of localization.matchedNodes) {
      set.add(n.id);
    }
    return set;
  }, [localization]);

  const visibleNodes = useMemo(() => {
    return graph.nodes.filter(n => {
      if (filterType !== 'all' && n.type !== filterType && n.type !== 'project') {
        return false;
      }
      if (localizeQuery.trim() && highlightedIds.size > 0) {
        return highlightedIds.has(n.id) || n.type === 'project';
      }
      return true;
    });
  }, [graph.nodes, filterType, localizeQuery, highlightedIds]);

  const visibleNodeIdSet = useMemo(
    () => new Set(visibleNodes.map(n => n.id)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        e => visibleNodeIdSet.has(e.source) && visibleNodeIdSet.has(e.target),
      ),
    [graph.edges, visibleNodeIdSet],
  );

  const selectedNode = useMemo(
    () => graph.nodes.find(n => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  );

  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode) return [];
    const list: { direction: 'in' | 'out'; relation: string; otherNode: SynapseNode }[] = [];
    for (const edge of graph.edges) {
      if (edge.source === selectedNode.id) {
        const target = graph.nodes.find(n => n.id === edge.target);
        if (target) list.push({ direction: 'out', relation: edge.relation, otherNode: target });
      } else if (edge.target === selectedNode.id) {
        const source = graph.nodes.find(n => n.id === edge.source);
        if (source) list.push({ direction: 'in', relation: edge.relation, otherNode: source });
      }
    }
    return list;
  }, [selectedNode, graph]);

  const handleAttachMemory = useCallback(() => {
    if (!newMemoInput.trim() || !selectedNode) return;
    const contextPrefix = selectedNode.filePath
      ? `[Synapse: ${selectedNode.filePath}${selectedNode.lineNumber ? `:${selectedNode.lineNumber}` : ''} (${selectedNode.label})] `
      : `[Synapse: ${selectedNode.label}] `;
    onAddLinkedMemo(contextPrefix + newMemoInput.trim());
    setNewMemoInput('');
    setMemoSavedToast(`Memory linked to ${selectedNode.label}`);
    setTimeout(() => setMemoSavedToast(null), 3000);
  }, [newMemoInput, selectedNode, onAddLinkedMemo]);

  if (!project || projects.length === 0) {
    return (
      <View style={styles.emptyGraphContainer}>
        <View style={styles.emptyOrbOuter}>
          <View style={styles.emptyOrbInner}>
            <Brain size={42} color={IDE.primary} />
          </View>
        </View>
        <Text style={styles.emptyTitle}>Synapse Memory Graph Ready</Text>
        <Text style={styles.emptySubtitle}>
          No projects found yet. Create your first project to index files, functions, imports, and linked AI memories as an interactive neural graph.
        </Text>
        <TouchableOpacity
          style={styles.genesisButton}
          onPress={onOpenCreateProject}
          activeOpacity={0.75}
        >
          <FolderPlus size={18} color="#fff" />
          <Text style={styles.genesisButtonText}>Create Project in Memory Graph</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Stats & Project Switcher Bar */}
      <View style={styles.topStatsRow}>
        <View style={styles.statGroup}>
          <Text style={styles.statText}>
            <Text style={styles.statNum}>{graph.stats.fileCount}</Text> Files ·{' '}
            <Text style={styles.statNum}>{graph.stats.functionCount}</Text> Functions ·{' '}
            <Text style={styles.statNum}>{graph.stats.memoCount}</Text> Memories ·{' '}
            <Text style={styles.statNum}>{graph.stats.skillCount}</Text> Skills ·{' '}
            <Text style={styles.statNum}>{graph.stats.edgeCount}</Text> Synapses
          </Text>
        </View>

        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom(z => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
          >
            <ZoomOut size={15} color={IDE.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom(z => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
          >
            <ZoomIn size={15} color={IDE.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => {
              setZoom(1);
              setFilterType('all');
              setLocalizeQuery('');
            }}
          >
            <RotateCcw size={14} color={IDE.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* RepoGraph Code Localization Search Bar */}
      <View style={styles.localizeBar}>
        <Search size={15} color={IDE.primary} />
        <TextInput
          style={styles.localizeInput}
          value={localizeQuery}
          onChangeText={setLocalizeQuery}
          placeholder="Localize function, file, import, or memory synapse..."
          placeholderTextColor={IDE.muted}
        />
        {localizeQuery.length > 0 && (
          <TouchableOpacity onPress={() => setLocalizeQuery('')}>
            <X size={15} color={IDE.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {(
          [
            { id: 'all', label: 'All Synapses' },
            { id: 'file', label: 'Files' },
            { id: 'function', label: 'Functions & Hooks' },
            { id: 'memo', label: 'Memories' },
            { id: 'skill', label: 'YAML Skills' },
          ] as const
        ).map(f => {
          const active = filterType === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
              onPress={() => setFilterType(f.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Interactive 2D Neural Synapse Canvas */}
      <ScrollView
        horizontal
        style={styles.canvasOuter}
        contentContainerStyle={{ minWidth: 960 * zoom }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ minHeight: 720 * zoom }}
        >
          <View
            style={[
              styles.canvasSurface,
              {
                width: 960 * zoom,
                height: 720 * zoom,
              },
            ]}
          >
            {/* Render Directed Synapse Edges as Geometric Vectors */}
            {visibleEdges.map(edge => {
              const src = visibleNodes.find(n => n.id === edge.source);
              const dst = visibleNodes.find(n => n.id === edge.target);
              if (!src || !dst) return null;

              const x1 = src.x * zoom;
              const y1 = src.y * zoom;
              const x2 = dst.x * zoom;
              const y2 = dst.y * zoom;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const length = Math.sqrt(dx * dx + dy * dy);
              if (length < 2) return null;

              const angleRad = Math.atan2(dy, dx);
              const angleDeg = (angleRad * 180) / Math.PI;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              const isSelectedEdge =
                selectedNodeId === edge.source || selectedNodeId === edge.target;
              const edgeColor =
                edge.relation === 'remembers'
                  ? '#10B981'
                  : edge.relation === 'calls'
                    ? '#F59E0B'
                    : edge.relation === 'imports'
                      ? '#6366F1'
                      : edge.relation === 'governs'
                        ? '#06B6D4'
                        : '#334155';

              return (
                <View
                  key={edge.id}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: midX - length / 2,
                    top: midY - (isSelectedEdge ? 1.5 : 0.75),
                    width: length,
                    height: isSelectedEdge ? 3 : 1.5,
                    backgroundColor: isSelectedEdge ? edgeColor : edgeColor + '65',
                    transform: [{ rotate: `${angleDeg}deg` }],
                  }}
                />
              );
            })}

            {/* Render Interactive Synapse Nodes */}
            {visibleNodes.map(node => {
              const color = NODE_COLORS[node.type];
              const isSelected = selectedNodeId === node.id;
              const isHighlighted = highlightedIds.has(node.id);
              const nx = node.x * zoom;
              const ny = node.y * zoom;

              return (
                <TouchableOpacity
                  key={node.id}
                  activeOpacity={0.8}
                  onPress={() => setSelectedNodeId(node.id)}
                  style={[
                    styles.synapseNode,
                    {
                      left: nx - 58,
                      top: ny - 22,
                      borderColor: isSelected
                        ? '#FFFFFF'
                        : isHighlighted
                          ? color
                          : color + '80',
                      backgroundColor: isSelected ? color + '35' : '#111827F2',
                    },
                    node.type === 'project' && styles.projectRootNode,
                  ]}
                >
                  <View style={styles.nodeHeaderRow}>
                    {node.type === 'project' && <Sparkles size={13} color={color} />}
                    {node.type === 'file' && <FileCode size={13} color={color} />}
                    {node.type === 'function' && <Cpu size={13} color={color} />}
                    {node.type === 'memo' && <Brain size={13} color={color} />}
                    {node.type === 'skill' && <ShieldCheck size={13} color={color} />}
                    <Text
                      style={[
                        styles.nodeLabel,
                        isSelected && { color: '#FFFFFF', fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {node.label}
                    </Text>
                  </View>
                  <Text style={styles.nodeSubtitle} numberOfLines={1}>
                    {node.type.toUpperCase()} · {node.degree} links
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Selected Synapse Node Inspector Drawer */}
      {selectedNode && (
        <View style={styles.inspectorDrawer}>
          <View style={styles.inspectorHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inspectorTypeKicker}>
                {NODE_LABELS[selectedNode.type]}
                {selectedNode.filePath ? ` · ${selectedNode.filePath}` : ''}
                {selectedNode.lineNumber ? `:${selectedNode.lineNumber}` : ''}
              </Text>
              <Text style={styles.inspectorTitle}>{selectedNode.label}</Text>
            </View>

            <View style={styles.inspectorActions}>
              {selectedNode.filePath && !selectedNode.filePath.startsWith('.qoder') && (
                <TouchableOpacity
                  style={styles.openEditorBtn}
                  onPress={() => onOpenFileInEditor(selectedNode.filePath!)}
                >
                  <ExternalLink size={14} color="#fff" />
                  <Text style={styles.openEditorBtnText}>Open in Editor</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeInspectorBtn}
                onPress={() => setSelectedNodeId(null)}
              >
                <X size={16} color={IDE.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {selectedNode.signature && (
            <Text style={styles.signatureCode}>{selectedNode.signature}</Text>
          )}

          {selectedNode.snippet && (
            <ScrollView style={styles.snippetBox} nestedScrollEnabled>
              <Text style={styles.snippetText}>{selectedNode.snippet}</Text>
            </ScrollView>
          )}

          {/* Connected Synapses List */}
          {selectedNodeConnections.length > 0 && (
            <View style={styles.connectionsSection}>
              <Text style={styles.connectionsHeading}>
                Connected Synapses ({selectedNodeConnections.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedNodeConnections.map((conn, idx) => (
                  <TouchableOpacity
                    key={`${conn.otherNode.id}_${idx}`}
                    style={styles.connectionChip}
                    onPress={() => setSelectedNodeId(conn.otherNode.id)}
                  >
                    <GitBranch size={12} color={NODE_COLORS[conn.otherNode.type]} />
                    <Text style={styles.connectionChipText}>
                      {conn.direction === 'out' ? `→ ${conn.relation}: ` : `← ${conn.relation} by: `}
                      {conn.otherNode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Link a New Memory Synapse directly to this File/Function */}
          <View style={styles.attachMemoRow}>
            <TextInput
              style={styles.attachMemoInput}
              value={newMemoInput}
              onChangeText={setNewMemoInput}
              placeholder={`Attach memory or rule to ${selectedNode.label}...`}
              placeholderTextColor={IDE.muted}
            />
            <TouchableOpacity
              style={styles.attachMemoBtn}
              onPress={handleAttachMemory}
            >
              <Plus size={15} color="#fff" />
              <Text style={styles.attachMemoBtnText}>Save Synapse</Text>
            </TouchableOpacity>
          </View>

          {memoSavedToast && (
            <Text style={styles.memoToastText}>{memoSavedToast}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IDE.bg,
  },
  emptyGraphContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: IDE.bg,
  },
  emptyOrbOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: IDE.primary + '15',
    borderWidth: 1,
    borderColor: IDE.primary + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyOrbInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: IDE.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: IDE.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: IDE.muted,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 19,
    marginBottom: 20,
  },
  genesisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IDE.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  genesisButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  topStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    backgroundColor: IDE.surface,
  },
  statGroup: {
    flex: 1,
  },
  statText: {
    fontSize: 12,
    color: IDE.muted,
  },
  statNum: {
    color: IDE.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomLabel: {
    fontSize: 11,
    color: IDE.textSecondary,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
  localizeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  localizeInput: {
    flex: 1,
    fontSize: 13,
    color: IDE.text,
    paddingVertical: 2,
  },
  filterScroll: {
    maxHeight: 40,
    marginTop: 6,
  },
  filterContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  filterBtnActive: {
    backgroundColor: IDE.primary + '22',
    borderColor: IDE.primary,
  },
  filterBtnText: {
    fontSize: 12,
    color: IDE.muted,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: IDE.primary,
  },
  canvasOuter: {
    flex: 1,
    backgroundColor: '#080C14',
    marginTop: 6,
  },
  canvasSurface: {
    position: 'relative',
    backgroundColor: '#080C14',
  },
  synapseNode: {
    position: 'absolute',
    width: 124,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  projectRootNode: {
    width: 146,
    borderWidth: 2,
  },
  nodeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nodeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IDE.text,
    flex: 1,
  },
  nodeSubtitle: {
    fontSize: 9,
    color: IDE.muted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  inspectorDrawer: {
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 14,
    maxHeight: 270,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  inspectorTypeKicker: {
    fontSize: 11,
    color: IDE.muted,
    marginBottom: 2,
  },
  inspectorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IDE.text,
  },
  inspectorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openEditorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: IDE.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  openEditorBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  closeInspectorBtn: {
    padding: 4,
  },
  signatureCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: IDE.warning,
    marginBottom: 6,
  },
  snippetBox: {
    backgroundColor: IDE.bg,
    borderRadius: 6,
    padding: 8,
    maxHeight: 68,
    borderWidth: 1,
    borderColor: IDE.border,
    marginBottom: 8,
  },
  snippetText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: IDE.textSecondary,
  },
  connectionsSection: {
    marginBottom: 8,
  },
  connectionsHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: IDE.muted,
    marginBottom: 4,
  },
  connectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  connectionChipText: {
    fontSize: 11,
    color: IDE.text,
  },
  attachMemoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachMemoInput: {
    flex: 1,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: IDE.text,
  },
  attachMemoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: IDE.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  attachMemoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  memoToastText: {
    fontSize: 11,
    color: IDE.accent,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default SynapseGraphView;
