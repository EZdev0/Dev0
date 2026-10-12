/**
 * Multi-Agenten UI Komponenten
 * 
 * - AgentDashboard: Hauptübersicht für Super-Agent Modus
 * - SubAgentCard: Karte für einzelnen Subagents
 * - ToolPermissionDialog: Berechtigungs-Dialog
 * - MemoSection: Überarbeitete Memo-Anzeige
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IDE } from '@/constants/colors';
import { SubAgent, SubAgentType } from '@/utils/multi-agent-system';
import { Memo } from '@/utils/memo-system';

// ==================== Agent Dashboard ====================

interface AgentDashboardProps {
  mainAgentStatus: 'idle' | 'planning' | 'executing' | 'completed';
  subAgents: SubAgent[];
  onDeploySubAgent: (type: SubAgentType) => void;
  onViewSubAgentResult: (agentId: string) => void;
  currentTask?: string;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({
  mainAgentStatus,
  subAgents,
  onDeploySubAgent,
  onViewSubAgentResult,
  currentTask
}) => {
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SubAgent | null>(null);

  const AGENT_OPTIONS: { type: SubAgentType; label: string; desc: string; icon: any; color: string }[] = [
    { type: 'analyst', label: 'Analyst Agent', desc: 'Read-only code inspection and deep codebase analysis', icon: 'search', color: '#3B82F6' },
    { type: 'developer', label: 'Developer Agent', desc: 'Feature implementation and code edits (Read-Before-Write)', icon: 'code-slash', color: '#10B981' },
    { type: 'tester', label: 'Tester Agent', desc: 'Compiles code, runs tests, and finds edge cases', icon: 'flask', color: '#F59E0B' },
    { type: 'researcher', label: 'Researcher Agent', desc: 'Researches framework documentation and best practices', icon: 'book', color: '#8B5CF6' },
    { type: 'critic', label: 'Critic Agent', desc: 'Strict AAA quality checks, bug hunting, and code review', icon: 'shield-checkmark', color: '#EF4444' },
  ];

  return (
    <View style={styles.dashboard}>
      {/* Main Agent Status */}
      <View style={styles.mainAgentSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="pulse" size={24} color={IDE.primary} />
          <Text style={styles.sectionTitle}>Main Agent</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(mainAgentStatus) }]}>
            <Text style={styles.statusText}>{getStatusText(mainAgentStatus)}</Text>
          </View>
        </View>
        
        {currentTask ? (
          <View style={styles.currentTask}>
            <Text style={styles.taskLabel}>Current Task:</Text>
            <Text style={styles.taskContent}>{currentTask}</Text>
          </View>
        ) : (
          <Text style={{ color: IDE.muted, fontSize: 13, marginTop: 4 }}>
            System ready. The Main Agent plans tasks and delegates to sub-agents.
          </Text>
        )}
      </View>

      {/* Subagents Section */}
      <View style={styles.subAgentsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={24} color={IDE.text} />
          <Text style={styles.sectionTitle}>Sub-Agents</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{subAgents.length}</Text>
          </View>
        </View>

        {subAgents.length === 0 ? (
          <View style={{ backgroundColor: IDE.surface, borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: IDE.border }}>
            <Ionicons name="cube-outline" size={32} color={IDE.muted} style={{ marginBottom: 8 }} />
            <Text style={{ color: IDE.text, fontWeight: '600', marginBottom: 4 }}>No sub-agents active</Text>
            <Text style={{ color: IDE.muted, fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
              Deploy specialized agents to analyze code, run tests, or implement features.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: IDE.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={() => setDeployModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Deploy First Agent</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.agentsScroll}>
            {subAgents.map(agent => (
              <SubAgentCard
                key={agent.id}
                agent={agent}
                onPress={() => {
                  setSelectedAgent(agent);
                  onViewSubAgentResult(agent.id);
                }}
              />
            ))}
            
            <TouchableOpacity
              style={styles.deployButton}
              onPress={() => setDeployModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={32} color={IDE.primary} />
              <Text style={styles.deployText}>Deploy Agent</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Agent Coordination Section */}
      <View style={styles.coordinationSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="chatbubbles" size={24} color={IDE.text} />
          <Text style={styles.sectionTitle}>Agent Coordination</Text>
        </View>
        <View style={styles.coordinationContent}>
          <Text style={styles.coordinationPlaceholder}>
            Live communication between main agent and sub-agents is coordinated here.
          </Text>
        </View>
      </View>

      {/* Deploy Agent Modal */}
      <Modal visible={deployModalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: IDE.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: IDE.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: IDE.text }}>Deploy Sub-Agent</Text>
              <TouchableOpacity onPress={() => setDeployModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={IDE.muted} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: IDE.muted, fontSize: 13, marginBottom: 16 }}>
              Select a specialized AI sub-agent to execute targeted tasks:
            </Text>

            {AGENT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.type}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: IDE.bg,
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: IDE.border,
                }}
                onPress={() => {
                  onDeploySubAgent(opt.type);
                  setDeployModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: opt.color + '25', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name={opt.icon} size={20} color={opt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: IDE.text, fontWeight: 'bold', fontSize: 14 }}>{opt.label}</Text>
                  <Text style={{ color: IDE.muted, fontSize: 12, marginTop: 2 }}>{opt.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={IDE.muted} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: IDE.surface, borderWidth: 1, borderColor: IDE.border, alignItems: 'center' }}
              onPress={() => setDeployModalVisible(false)}
            >
              <Text style={{ color: IDE.muted, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Selected Agent Detail Modal */}
      {selectedAgent && (
        <Modal visible={!!selectedAgent} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: IDE.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: IDE.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={getAgentTypeIcon(selectedAgent.type) as any} size={22} color={getAgentStatusColor(selectedAgent.status)} />
                  <Text style={{ fontSize: 17, fontWeight: 'bold', color: IDE.text }}>{selectedAgent.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedAgent(null)}>
                  <Ionicons name="close" size={22} color={IDE.muted} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Ionicons name={getAgentStatusIcon(selectedAgent.status) as any} size={14} color={getAgentStatusColor(selectedAgent.status)} />
                <Text style={{ color: getAgentStatusColor(selectedAgent.status), fontSize: 12, fontWeight: '600' }}>
                  Status: {getAgentStatusText(selectedAgent.status)}
                </Text>
              </View>

              {selectedAgent.currentTask && (
                <View style={{ backgroundColor: IDE.bg, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                  <Text style={{ color: IDE.muted, fontSize: 11, fontWeight: 'bold' }}>TASK</Text>
                  <Text style={{ color: IDE.text, fontSize: 13, marginTop: 2 }}>{selectedAgent.currentTask.title}</Text>
                  <Text style={{ color: IDE.muted, fontSize: 12, marginTop: 2 }}>{selectedAgent.currentTask.description}</Text>
                </View>
              )}

              {selectedAgent.result && (
                <View style={{ backgroundColor: IDE.bg, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                  <Text style={{ color: IDE.accent, fontSize: 11, fontWeight: 'bold' }}>RESULT</Text>
                  <Text style={{ color: IDE.text, fontSize: 13, marginTop: 2 }}>{selectedAgent.result.summary}</Text>
                </View>
              )}

              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: IDE.muted, fontSize: 11, fontWeight: 'bold', marginBottom: 6 }}>PERMISSIONS</Text>
                <Text style={{ color: IDE.textSecondary, fontSize: 12 }}>
                  {selectedAgent.permissions.join(', ')}
                </Text>
              </View>

              <TouchableOpacity
                style={{ padding: 12, borderRadius: 8, backgroundColor: IDE.primary, alignItems: 'center' }}
                onPress={() => setSelectedAgent(null)}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

// ==================== Sub Agent Card ====================

interface SubAgentCardProps {
  agent: SubAgent;
  onPress: () => void;
}

export const SubAgentCard: React.FC<SubAgentCardProps> = ({ agent, onPress }) => {
  const statusIcon = getAgentStatusIcon(agent.status);
  const statusColor = getAgentStatusColor(agent.status);

  return (
    <TouchableOpacity
      style={[styles.agentCard, { borderLeftColor: statusColor }]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Ionicons name={getAgentTypeIcon(agent.type) as any} size={28} color={statusColor} />
        <Text style={styles.agentName}>{agent.name}</Text>
      </View>

      <View style={styles.cardStatus}>
        <Ionicons name={statusIcon as any} size={16} color={statusColor} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {getAgentStatusText(agent.status)}
        </Text>
      </View>

      {agent.currentTask && (
        <View style={styles.cardTask}>
          <Text style={styles.taskLabel}>Task:</Text>
          <Text style={styles.cardTaskText} numberOfLines={2}>
            {agent.currentTask.title}
          </Text>
        </View>
      )}

      {agent.result && (
        <View style={styles.cardResult}>
          <Ionicons name="checkmark-circle" size={16} color={IDE.primary} />
          <Text style={styles.resultText}>Completed</Text>
        </View>
      )}

      {agent.error && (
        <View style={styles.cardError}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.errorText}>Error occurred</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ==================== Tool Permission Dialog ====================

interface ToolPermissionDialogProps {
  toolName: string;
  toolDisplayName: string;
  arguments: Record<string, any>;
  agentName?: string;
  riskLevel: 'low' | 'medium' | 'high';
  onApprove: () => void;
  onReject: () => void;
  onAlwaysAllow: () => void;
  onLater: () => void;
}

export const ToolPermissionDialog: React.FC<ToolPermissionDialogProps> = ({
  toolName,
  toolDisplayName,
  arguments: args,
  agentName,
  riskLevel,
  onApprove,
  onReject,
  onAlwaysAllow,
  onLater
}) => {
  return (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialog}>
        <View style={styles.dialogHeader}>
          <Ionicons name="lock-closed" size={24} color={IDE.text} />
          <Text style={styles.dialogTitle}>Tool-Berechtigung erforderlich</Text>
        </View>

        <View style={styles.dialogContent}>
          {agentName && (
            <View style={styles.infoRow}>
              <Ionicons name="person" size={16} color={IDE.muted} />
              <Text style={styles.infoText}>Agent: {agentName}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="hammer" size={16} color={IDE.muted} />
            <Text style={styles.infoText}>Tool: {toolDisplayName}</Text>
          </View>

          <View style={styles.argsContainer}>
            <Text style={styles.argsLabel}>Arguments:</Text>
            <ScrollView style={styles.argsScroll}>
              {Object.entries(args).map(([key, value]) => (
                <View key={key} style={styles.argItem}>
                  <Text style={styles.argKey}>{key}:</Text>
                  <Text style={styles.argValue}>{JSON.stringify(value)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.riskBadge, { backgroundColor: getRiskColor(riskLevel) }]}>
            <Ionicons name="warning" size={16} color="#fff" />
            <Text style={styles.riskText}>Risk: {getRiskText(riskLevel)}</Text>
          </View>
        </View>

        <View style={styles.dialogActions}>
          <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={onApprove}>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Execute</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={onReject}>
            <Ionicons name="close" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dialogSecondaryActions}>
          <TouchableOpacity onPress={onAlwaysAllow} style={styles.secondaryButton}>
            <Ionicons name="time" size={16} color={IDE.primary} />
            <Text style={styles.secondaryButtonText}>Always Allow</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onLater} style={styles.secondaryButton}>
            <Ionicons name="pause" size={16} color={IDE.muted} />
            <Text style={styles.secondaryButtonText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ==================== Memo Section (Überarbeitet) ====================

interface MemoSectionProps {
  memos: Memo[];
  onCreateMemo: () => void;
  onViewMemo: (memoId: string) => void;
  onSearchMemo: (query: string) => void;
}

export const MemoSection: React.FC<MemoSectionProps> = ({
  memos,
  onCreateMemo,
  onViewMemo,
  onSearchMemo
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const globalMemos = memos.filter(m => m.type === 'global');
  const localMemos = memos.filter(m => m.type === 'local');

  return (
    <View style={styles.memoSection}>
      <View style={styles.memoHeader}>
        <View style={styles.memoTitleRow}>
          <Ionicons name="book" size={24} color={IDE.primary} />
          <Text style={styles.memoTitle}>Memos</Text>
        </View>
        
        <TouchableOpacity style={styles.createButton} onPress={onCreateMemo}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={IDE.muted} />
        <input
          type="text"
          placeholder="Search memos..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onSearchMemo(e.target.value);
          }}
          style={styles.searchInput}
        />
      </View>

      {/* Global Memos */}
      {globalMemos.length > 0 && (
        <View style={styles.memoGroup}>
          <View style={styles.memoGroupHeader}>
            <Ionicons name="globe" size={16} color={IDE.primary} />
            <Text style={styles.memoGroupTitle}>Global ({globalMemos.length})</Text>
          </View>
          {globalMemos.slice(0, 5).map(memo => (
            <TouchableOpacity
              key={memo.id}
              style={styles.memoItem}
              onPress={() => onViewMemo(memo.id)}
            >
              <Ionicons name="document-text" size={16} color={IDE.muted} />
              <Text style={styles.memoItemTitle} numberOfLines={1}>{memo.title}</Text>
              <Text style={styles.memoItemDate}>
                {new Date(memo.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Local Memos */}
      {localMemos.length > 0 && (
        <View style={styles.memoGroup}>
          <View style={styles.memoGroupHeader}>
            <Ionicons name="folder" size={16} color={IDE.text} />
            <Text style={styles.memoGroupTitle}>Project-specific ({localMemos.length})</Text>
          </View>
          {localMemos.slice(0, 5).map(memo => (
            <TouchableOpacity
              key={memo.id}
              style={styles.memoItem}
              onPress={() => onViewMemo(memo.id)}
            >
              <Ionicons name="file-tray-full" size={16} color={IDE.primary} />
              <Text style={styles.memoItemTitle} numberOfLines={1}>{memo.title}</Text>
              <Text style={styles.memoItemDate}>
                {new Date(memo.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {memos.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={48} color={IDE.muted} />
          <Text style={styles.emptyText}>No memos found</Text>
          <Text style={styles.emptySubtext}>
            Die KI erstellt automatisch Memos bei wichtigen Erkenntnissen
          </Text>
        </View>
      )}
    </View>
  );
};

// ==================== Helper Functions ====================

function getStatusColor(status: string): string {
  switch (status) {
    case 'planning': return '#F59E0B';
    case 'executing': return '#3B82F6';
    case 'completed': return '#10B981';
    default: return '#6B7280';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'planning': return 'Planning...';
    case 'executing': return 'Working';
    case 'completed': return 'Done';
    default: return 'Idle';
  }
}

function getAgentTypeIcon(type: SubAgentType): string {
  switch (type) {
    case 'analyst': return 'search';
    case 'developer': return 'code-slash';
    case 'tester': return 'flask';
    case 'researcher': return 'library';
    case 'critic': return 'shield-checkmark';
    default: return 'help-circle';
  }
}

function getAgentStatusIcon(status: SubAgent['status']): string {
  switch (status) {
    case 'working': return 'hourglass';
    case 'completed': return 'checkmark-circle';
    case 'error': return 'alert-circle';
    case 'waiting': return 'time';
    default: return 'ellipse';
  }
}

function getAgentStatusColor(status: SubAgent['status']): string {
  switch (status) {
    case 'working': return '#F59E0B';
    case 'completed': return '#10B981';
    case 'error': return '#EF4444';
    case 'waiting': return '#6B7280';
    default: return '#9CA3AF';
  }
}

function getAgentStatusText(status: SubAgent['status']): string {
  switch (status) {
    case 'working': return 'Working...';
    case 'completed': return 'Completed';
    case 'error': return 'Error';
    case 'waiting': return 'Waiting';
    default: return 'Idle';
  }
}

function getRiskColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low': return '#10B981';
    case 'medium': return '#F59E0B';
    case 'high': return '#EF4444';
  }
}

function getRiskText(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low': return 'Niedrig';
    case 'medium': return 'Mittel';
    case 'high': return 'Hoch';
  }
}

// showDeployMenu replaced by interactive modal in AgentDashboard

// ==================== Styles ====================

const styles = StyleSheet.create({
  dashboard: {
    backgroundColor: IDE.bg,
    padding: 16,
    gap: 20
  },
  mainAgentSection: {
    backgroundColor: IDE.surface,
    borderRadius: 12,
    padding: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: IDE.text
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto'
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  countBadge: {
    backgroundColor: IDE.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto'
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  currentTask: {
    marginTop: 8
  },
  taskLabel: {
    fontSize: 12,
    color: IDE.muted,
    marginBottom: 4
  },
  taskContent: {
    fontSize: 14,
    color: IDE.text,
    lineHeight: 20
  },
  subAgentsSection: {
    backgroundColor: IDE.surface,
    borderRadius: 12,
    padding: 16
  },
  agentsScroll: {
    flexDirection: 'row'
  },
  agentCard: {
    width: 200,
    backgroundColor: IDE.bg,
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    borderLeftWidth: 3
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  agentName: {
    fontSize: 14,
    fontWeight: '600',
    color: IDE.text
  },
  cardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  cardTask: {
    marginTop: 4
  },
  cardTaskText: {
    fontSize: 12,
    color: IDE.text,
    lineHeight: 16
  },
  cardResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8
  },
  resultText: {
    fontSize: 12,
    color: IDE.primary
  },
  cardError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444'
  },
  deployButton: {
    width: 150,
    height: 120,
    backgroundColor: IDE.surface,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: IDE.primary,
    borderStyle: 'dashed'
  },
  deployText: {
    color: IDE.primary,
    fontSize: 13,
    fontWeight: '600'
  },
  coordinationSection: {
    backgroundColor: IDE.surface,
    borderRadius: 12,
    padding: 16
  },
  coordinationContent: {
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center'
  },
  coordinationPlaceholder: {
    color: IDE.muted,
    fontSize: 14,
    textAlign: 'center'
  },
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  },
  dialog: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: IDE.surface,
    borderRadius: 16,
    overflow: 'hidden'
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: IDE.text
  },
  dialogContent: {
    padding: 16,
    gap: 12
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  infoText: {
    fontSize: 14,
    color: IDE.text
  },
  argsContainer: {
    gap: 8
  },
  argsLabel: {
    fontSize: 12,
    color: IDE.muted,
    fontWeight: '600'
  },
  argsScroll: {
    maxHeight: 150,
    backgroundColor: IDE.bg,
    borderRadius: 8,
    padding: 8
  },
  argItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4
  },
  argKey: {
    fontSize: 12,
    color: IDE.primary,
    fontWeight: '600',
    width: 100
  },
  argValue: {
    fontSize: 12,
    color: IDE.text,
    flex: 1
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8
  },
  riskText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  dialogActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: IDE.border
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8
  },
  approveButton: {
    backgroundColor: '#10B981'
  },
  rejectButton: {
    backgroundColor: '#EF4444'
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  dialogSecondaryActions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
    justifyContent: 'center'
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  secondaryButtonText: {
    color: IDE.primary,
    fontSize: 13,
    fontWeight: '500'
  },
  memoSection: {
    backgroundColor: IDE.surface,
    borderRadius: 12,
    padding: 16
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  memoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  memoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: IDE.text
  },
  createButton: {
    width: 36,
    height: 36,
    backgroundColor: IDE.primary,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IDE.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: IDE.text,
    paddingVertical: 8
  },
  memoGroup: {
    marginBottom: 16
  },
  memoGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  memoGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IDE.text
  },
  memoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: IDE.bg,
    borderRadius: 8,
    marginBottom: 6
  },
  memoItemTitle: {
    flex: 1,
    fontSize: 13,
    color: IDE.text
  },
  memoItemDate: {
    fontSize: 11,
    color: IDE.muted
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: IDE.text
  },
  emptySubtext: {
    fontSize: 13,
    color: IDE.muted,
    textAlign: 'center'
  }
});
