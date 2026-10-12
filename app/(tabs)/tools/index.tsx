import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, Modal,
  Animated,
} from 'react-native';
import {
  CheckSquare, Square, Plus, Trash2, BookOpen, X,
  Search, FolderTree, Zap, Wrench, ChevronRight, ChevronDown,
  Shield, ShieldCheck, ShieldOff, ShieldX, Info, CircleCheck,
  Clock, AlertCircle, Play, RefreshCw, Brain, Globe, FileText,
  Folder, ClipboardList, Database, Settings2, Eye, LayoutDashboard,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import { useProject } from '@/providers/ProjectProvider';
import { useChat } from '@/providers/ChatProvider';
import { useAgent } from '@/providers/AgentProvider';
import { useLocalSearchParams } from 'expo-router';
import { AgentDashboard } from '@/components/MultiAgentUI';
import { SubAgent, SubAgentType, createSubAgent } from '@/utils/multi-agent-system';
import {
  ToolPermission, TOOL_REGISTRY, TOOL_CATEGORIES, ToolRegistryItem,
  AgentPlan, AgentTask,
} from '@/types';

const PERMISSION_OPTIONS: { value: ToolPermission; label: string; desc: string; color: string }[] = [
  { value: 'always', label: 'Always allow', desc: 'Run automatically without asking', color: IDE.accent },
  { value: 'ask', label: 'Ask first', desc: 'Ask for permission before execution', color: IDE.warning },
  { value: 'blocked', label: 'Blocked', desc: 'Blocked, AI will be informed', color: IDE.danger },
  { value: 'removed', label: 'Removed', desc: 'Completely hidden from AI', color: IDE.muted },
];

function getPermissionIcon(perm: ToolPermission) {
  switch (perm) {
    case 'always': return ShieldCheck;
    case 'ask': return Shield;
    case 'blocked': return ShieldOff;
    case 'removed': return ShieldX;
    default: return Shield;
  }
}

function getPermissionColor(perm: ToolPermission): string {
  switch (perm) {
    case 'always': return IDE.accent;
    case 'ask': return IDE.warning;
    case 'blocked': return IDE.danger;
    case 'removed': return IDE.muted;
    default: return IDE.muted;
  }
}

function getCategoryIcon(catId: string) {
  switch (catId) {
    case 'filesystem': return Folder;
    case 'analysis': return Search;
    case 'planning': return ClipboardList;
    case 'memory': return Database;
    case 'web': return Globe;
    case 'system': return Settings2;
    default: return Wrench;
  }
}

export default function ToolsScreen() {
  const { todos, addTodo, updateTodoItem, deleteTodo, memos, addMemo, deleteMemo, settings, getToolPermission, setToolPermission } = useApp();
  const { getProjectTree, searchFilesInProject, currentProject } = useProject();
  const { clearChat, startNewChat, compressChat, applyChatCompression, messages } = useChat();
  const { plans, activePlan } = useAgent();

  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tools' | 'plans' | 'memos' | 'search' | 'chat'>('dashboard');
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);

  useEffect(() => {
    if (tab === 'dashboard' || tab === 'tools' || tab === 'plans' || tab === 'memos' || tab === 'search' || tab === 'chat') {
      setActiveTab(tab as any);
    }
  }, [tab]);

  const [newMemoText, setNewMemoText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<string>('');
  const [compressSummary, setCompressSummary] = useState<string>('');
  const [showCompress, setShowCompress] = useState<boolean>(false);
  const [selectedTool, setSelectedTool] = useState<ToolRegistryItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['filesystem', 'planning', 'analysis']));


  const handleAddMemo = useCallback(() => {
    if (!newMemoText.trim()) return;
    addMemo(newMemoText.trim());
    setNewMemoText('');
  }, [newMemoText, addMemo]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    const results = searchFilesInProject(searchQuery.trim());
    setSearchResults(results);
  }, [searchQuery, searchFilesInProject]);

  const handleCompress = useCallback(async () => {
    const summary = await compressChat();
    if (summary) {
      setCompressSummary(summary);
      setShowCompress(true);
    } else {
      Alert.alert('Notice', 'Not enough messages to compress (min. 4).');
    }
  }, [compressChat]);

  const handleApplyCompress = useCallback(() => {
    const success = applyChatCompression(compressSummary);
    if (success === false) {
      Alert.alert('Notice', 'Compression aborted: The summary is not smaller than the current chat.');
    } else {
      setShowCompress(false);
      setCompressSummary('');
      Alert.alert('Success', 'Chat has been compressed.');
    }
  }, [compressSummary, applyChatCompression]);

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const groupedTools = useMemo(() => {
    const groups: Record<string, ToolRegistryItem[]> = {};
    for (const tool of TOOL_REGISTRY) {
      if (tool.isBeta && !settings.yoloMode) {
        if (tool.name === 'web_search' && !settings.betaWebSearch) continue;
        if (tool.name === 'web_fetch' && !settings.betaWebFetch) continue;
      }
      if (!groups[tool.category]) groups[tool.category] = [];
      groups[tool.category].push(tool);
    }
    return groups;
  }, [settings.betaWebSearch, settings.betaWebFetch, settings.yoloMode]);

  const activeToolCount = useMemo(() => {
    let count = 0;
    for (const tool of TOOL_REGISTRY) {
      const perm = getToolPermission(tool.name);
      if (perm !== 'removed') count++;
    }
    return count;
  }, [getToolPermission]);


  const activePlans = useMemo(() =>
    (plans ?? []).filter(p => p && (p.status === 'executing' || p.status === 'review')),
    [plans]
  );
  const completedPlans = useMemo(() =>
    (plans ?? []).filter(p => p && (p.status === 'completed' || p.status === 'error')),
    [plans]
  );

  const tabs = [
    { id: 'tools' as const, label: 'Tools', icon: Wrench, badge: activeToolCount },
    { id: 'plans' as const, label: 'Plans', icon: Brain, badge: activePlans.length || undefined },
    { id: 'memos' as const, label: 'Memos', icon: BookOpen, badge: undefined },
    { id: 'search' as const, label: 'Search', icon: Search, badge: undefined },
    { id: 'chat' as const, label: 'Chat', icon: Zap, badge: undefined },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Icon size={14} color={isActive ? IDE.primary : IDE.muted} />
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab.label}</Text>
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {tab.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {activeTab === 'dashboard' && (
          <AgentDashboard
            mainAgentStatus={activePlan?.status === 'executing' ? 'executing' : activePlan?.status === 'review' ? 'planning' : 'idle'}
            subAgents={subAgents}
            onDeploySubAgent={(type) => {
              const newAgent = createSubAgent(type);
              setSubAgents(prev => [...prev, newAgent]);
              Alert.alert('Agent Deployed', `${newAgent.name} is now active and ready for tasks.`);
            }}
            onViewSubAgentResult={(agentId) => {
              const ag = subAgents.find(a => a.id === agentId);
              if (ag?.result) {
                Alert.alert(ag.name + ' Result', ag.result.summary);
              } else {
                Alert.alert(ag?.name || 'Agent', 'Status: ' + (ag?.status || 'idle'));
              }
            }}
            currentTask={activePlan?.userRequest}
          />
        )}

        {activeTab === 'tools' && (
          <>
            <View style={styles.toolsHeader}>
              <Text style={styles.toolsTitle}>Active Agents</Text>
            </View>
            <Text style={styles.toolsSubtitle}>Available specialized AI sub-agents in the system.</Text>
            <View style={styles.categorySection}>
              {['analyst', 'developer', 'tester', 'researcher', 'critic'].map(agentName => (
                <View key={agentName} style={styles.toolCard}>
                  <View style={[styles.toolPermIcon, { backgroundColor: IDE.primary + '20' }]}>
                    <Brain size={12} color={IDE.primary} />
                  </View>
                  <View style={styles.toolCardContent}>
                    <Text style={styles.toolCardName}>{agentName.toUpperCase()} Agent</Text>
                    <Text style={styles.toolCardDesc} numberOfLines={1}>Executes specific tasks with its own tools.</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.toolsHeader, { marginTop: 20 }]}>
              <Text style={styles.toolsTitle}>Tool Registry</Text>
              <View style={styles.toolsCountBadge}>
                <Text style={styles.toolsCountText}>{activeToolCount} active</Text>
              </View>
            </View>
            <Text style={styles.toolsSubtitle}>
              Tap on a tool for details and permissions.
              {settings.yoloMode && ' YOLO mode overrides all permissions.'}
            </Text>

            {TOOL_CATEGORIES.map(cat => {
              const catTools = groupedTools[cat.id];
              if (!catTools || catTools.length === 0) return null;
              const isExpanded = expandedCategories.has(cat.id);
              const CatIcon = getCategoryIcon(cat.id);

              return (
                <View key={cat.id} style={styles.categorySection}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <CatIcon size={14} color={IDE.textSecondary} />
                    <Text style={styles.categoryTitle}>{cat.label}</Text>
                    <View style={styles.categoryCountBadge}>
                      <Text style={styles.categoryCountText}>{catTools.length}</Text>
                    </View>
                    {isExpanded ? (
                      <ChevronDown size={14} color={IDE.muted} />
                    ) : (
                      <ChevronRight size={14} color={IDE.muted} />
                    )}
                  </TouchableOpacity>

                  {isExpanded && catTools.map(tool => {
                    const rawPerm = settings.toolPermissions?.[tool.name];
                    const perm = getToolPermission(tool.name);
                    const isYoloOverride = settings.yoloMode && rawPerm !== 'always' && rawPerm !== undefined;
                    const PermIcon = settings.yoloMode ? Zap : getPermissionIcon(perm);
                    const permColor = settings.yoloMode ? IDE.warning : getPermissionColor(perm);

                    return (
                      <TouchableOpacity
                        key={tool.name}
                        style={styles.toolCard}
                        onPress={() => setSelectedTool(tool)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.toolPermIcon, { backgroundColor: permColor + '20' }]}>
                          <PermIcon size={12} color={permColor} />
                        </View>
                        <View style={styles.toolCardContent}>
                          <View style={styles.toolNameRow}>
                            <Text style={styles.toolCardName}>{tool.displayName}</Text>
                            {tool.isBeta && (
                              <View style={styles.betaPill}>
                                <Text style={styles.betaPillText}>BETA</Text>
                              </View>
                            )}
                            {isYoloOverride && (
                              <View style={styles.yoloOverridePill}>
                                <Text style={styles.yoloOverridePillText}>YOLO</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.toolCardDesc} numberOfLines={1}>{tool.description}</Text>
                        </View>
                        <ChevronRight size={14} color={IDE.muted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </>
        )}

        {activeTab === 'plans' && (
          <>
            {activePlans.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <Play size={12} color={IDE.primary} />
                  <Text style={styles.planSectionTitle}>Active Plans</Text>
                </View>
                {activePlans.map(plan => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </View>
            )}

            {completedPlans.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <CircleCheck size={12} color={IDE.accent} />
                  <Text style={styles.planSectionTitle}>Completed Plans ({completedPlans.length})</Text>
                </View>
                {completedPlans.map(plan => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </View>
            )}

            {(plans ?? []).length === 0 && (
              <View style={styles.emptyBox}>
                <Brain size={32} color={IDE.muted} />
                <Text style={styles.emptyText}>No Agent Plans</Text>
                <Text style={styles.emptyHint}>Use Agent Mode in chat to create plans.</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'memos' && (
          <>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.textInput, { minHeight: 60 }]}
                placeholder="New note..."
                placeholderTextColor={IDE.muted}
                value={newMemoText}
                onChangeText={setNewMemoText}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddMemo} activeOpacity={0.7}>
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {memos.length === 0 ? (
              <View style={styles.emptyBox}>
                <BookOpen size={32} color={IDE.muted} />
                <Text style={styles.emptyText}>No memos.</Text>
                <Text style={styles.emptyHint}>The AI saves important findings here.</Text>
              </View>
            ) : (
              memos.map(memo => (
                <View key={memo.id} style={styles.memoItem}>
                  <Text style={styles.memoText}>{memo.content}</Text>
                  <View style={styles.memoFooter}>
                    <Text style={styles.memoDate}>
                      {new Date(memo.createdAt).toLocaleString('en-US')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => deleteMemo(memo.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={12} color={IDE.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'search' && (
          <>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder="Search text in files (grep)..."
                placeholderTextColor={IDE.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleSearch} activeOpacity={0.7}>
                <Search size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {!currentProject && (
              <Text style={styles.emptyText}>Please open a project first.</Text>
            )}

            {searchResults ? (
              <View style={styles.searchResultsBox}>
                <ScrollView horizontal={false} nestedScrollEnabled>
                  <Text style={styles.searchResultsText} selectable>{searchResults}</Text>
                </ScrollView>
              </View>
            ) : null}

            {currentProject && (
              <View style={styles.treeSection}>
                <View style={styles.sectionHeader}>
                  <FolderTree size={14} color={IDE.muted} />
                  <Text style={styles.sectionTitle}>Project Structure</Text>
                </View>
                <View style={styles.treeBox}>
                  <ScrollView horizontal={false} nestedScrollEnabled>
                    <Text style={styles.treeText} selectable>{getProjectTree()}</Text>
                  </ScrollView>
                </View>
              </View>
            )}
          </>
        )}

        {activeTab === 'chat' && (
          <>
            <View style={styles.chatSection}>
              <Text style={styles.sectionTitle}>Chat History</Text>
              <Text style={styles.chatInfo}>
                {messages.length} messages in current chat
              </Text>

              <TouchableOpacity
                style={[styles.actionBtn, messages.length < 4 && styles.actionBtnDisabled]}
                onPress={handleCompress}
                disabled={messages.length < 4}
                activeOpacity={0.7}
              >
                <Zap size={16} color={messages.length >= 4 ? IDE.warning : IDE.muted} />
                <Text style={[styles.actionBtnText, messages.length < 4 && styles.actionBtnTextDisabled]}>
                  Compress chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={startNewChat}
                activeOpacity={0.7}
              >
                <Zap size={16} color={IDE.primary} />
                <Text style={styles.actionBtnText}>New Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn]}
                onPress={() => {
                  Alert.alert('Clear Chat', 'Do you want to delete the entire chat history?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: clearChat },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color={IDE.danger} />
                <Text style={[styles.actionBtnText, { color: IDE.danger }]}>Clear Chat</Text>
              </TouchableOpacity>
            </View>

            {showCompress && (
              <View style={styles.compressBox}>
                <Text style={styles.compressTitle}>Edit Summary</Text>
                <Text style={styles.compressHint}>
                  Edit the summary and confirm. All old messages will be replaced by this.
                </Text>
                <TextInput
                  style={styles.compressInput}
                  value={compressSummary}
                  onChangeText={setCompressSummary}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.compressActions}>
                  <TouchableOpacity
                    style={styles.compressCancelBtn}
                    onPress={() => setShowCompress(false)}
                  >
                    <Text style={styles.compressCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.compressApplyBtn} onPress={handleApplyCompress}>
                    <Text style={styles.compressApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ToolDetailModal
        tool={selectedTool}
        permission={selectedTool ? getToolPermission(selectedTool.name) : 'ask'}
        onChangePermission={(perm) => {
          if (selectedTool) setToolPermission(selectedTool.name, perm);
        }}
        onClose={() => setSelectedTool(null)}
        yoloMode={settings.yoloMode}
      />
    </KeyboardAvoidingView>
  );
}

function PlanCard({ plan }: { plan: AgentPlan }) {
  const [expanded, setExpanded] = useState<boolean>(false);

  const tasks = plan?.tasks ?? [];
  const completed = tasks.filter(t => t?.status === 'completed').length;
  const errors = tasks.filter(t => t?.status === 'error').length;
  const running = tasks.filter(t => t?.status === 'running').length;
  const pending = tasks.filter(t => t?.status === 'pending' || t?.status === 'draft').length;
  const total = tasks.length;

  const statusColor = plan.status === 'completed' ? IDE.accent
    : plan.status === 'error' ? IDE.danger
    : plan.status === 'executing' ? IDE.primary
    : IDE.warning;

  const statusLabel = plan.status === 'completed' ? 'Completed'
    : plan.status === 'error' ? 'Error'
    : plan.status === 'executing' ? 'Executing'
    : plan.status === 'review' ? 'Review'
    : 'Planning';

  return (
    <View style={planStyles.card}>
      <TouchableOpacity
        style={planStyles.header}
        onPress={() => setExpanded(p => !p)}
        activeOpacity={0.7}
      >
        <View style={[planStyles.statusDot, { backgroundColor: statusColor }]} />
        <View style={planStyles.headerContent}>
          <Text style={planStyles.title} numberOfLines={1}>{plan.userRequest || 'Agent Plan'}</Text>
          <View style={planStyles.metaRow}>
            <View style={[planStyles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[planStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <Text style={planStyles.taskCount}>{completed}/{total} Tasks</Text>
            {errors > 0 && <Text style={planStyles.errorCount}>{errors} Errors</Text>}
          </View>
        </View>
        {expanded ? <ChevronDown size={14} color={IDE.muted} /> : <ChevronRight size={14} color={IDE.muted} />}
      </TouchableOpacity>

      {total > 0 && (
        <View style={planStyles.progressBarOuter}>
          <View style={[planStyles.progressBarFill, { flex: total > 0 ? completed / total : 0, backgroundColor: IDE.accent }]} />
          {errors > 0 && <View style={[planStyles.progressBarFill, { flex: errors / total, backgroundColor: IDE.danger }]} />}
          {running > 0 && <View style={[planStyles.progressBarFill, { flex: running / total, backgroundColor: IDE.primary }]} />}
        </View>
      )}

      {expanded && (
        <View style={planStyles.body}>
          {tasks.map((task, i) => task ? (
            <PlanTaskRow key={task.id} task={task} index={i} />
          ) : null)}

          {plan.summary && (
            <View style={planStyles.summaryBox}>
              <Text style={planStyles.summaryLabel}>Summary</Text>
              <Text style={planStyles.summaryText}>{plan.summary}</Text>
            </View>
          )}

          <Text style={planStyles.dateText}>
            Created: {new Date(plan.createdAt).toLocaleString('en-US')}
            {plan.completedAt ? ' · Finished: ' + new Date(plan.completedAt).toLocaleString('en-US') : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

function PlanTaskRow({ task, index }: { task: AgentTask; index: number }) {
  const [expanded, setExpanded] = useState<boolean>(false);

  const statusColor = task.status === 'completed' ? IDE.accent
    : task.status === 'error' ? IDE.danger
    : task.status === 'running' ? IDE.primary
    : task.status === 'pending' ? IDE.warning
    : IDE.muted;

  const StatusIcon = task.status === 'completed' ? CircleCheck
    : task.status === 'error' ? AlertCircle
    : task.status === 'running' ? RefreshCw
    : task.status === 'pending' ? Clock
    : Eye;

  const fileCount = (task.filesCreated?.length ?? 0) + (task.filesModified?.length ?? 0) + (task.filesDeleted?.length ?? 0);

  return (
    <View style={planStyles.taskRow}>
      <TouchableOpacity
        style={planStyles.taskHeader}
        onPress={() => setExpanded(p => !p)}
        activeOpacity={0.7}
      >
        <View style={[planStyles.taskIndex, { backgroundColor: statusColor + '20' }]}>
          <Text style={[planStyles.taskIndexText, { color: statusColor }]}>{index + 1}</Text>
        </View>
        <View style={planStyles.taskContent}>
          <Text style={planStyles.taskTitle} numberOfLines={1}>{task.title}</Text>
          <View style={planStyles.taskMeta}>
            <StatusIcon size={10} color={statusColor} />
            <Text style={[planStyles.taskStatus, { color: statusColor }]}>
              {task.status === 'completed' ? 'Done' : task.status === 'error' ? 'Error' : task.status === 'running' ? 'Running' : task.status === 'pending' ? 'Pending' : 'Draft'}
            </Text>
            {fileCount > 0 && <Text style={planStyles.taskFileMeta}>{fileCount} files</Text>}
          </View>
        </View>
        {expanded ? <ChevronDown size={12} color={IDE.muted} /> : <ChevronRight size={12} color={IDE.muted} />}
      </TouchableOpacity>

      {expanded && (
        <View style={planStyles.taskDetails}>
          <Text style={planStyles.taskDesc}>{task.description}</Text>
          {task.error && (
            <View style={planStyles.taskErrorBox}>
              <AlertCircle size={10} color={IDE.danger} />
              <Text style={planStyles.taskErrorText}>{task.error}</Text>
            </View>
          )}
          {task.filesCreated?.length > 0 && (
            <View style={planStyles.fileList}>
              <Text style={[planStyles.fileLabel, { color: IDE.accent }]}>Created:</Text>
              {task.filesCreated.map(f => <Text key={f} style={planStyles.filePath}>{f}</Text>)}
            </View>
          )}
          {task.filesModified?.length > 0 && (
            <View style={planStyles.fileList}>
              <Text style={[planStyles.fileLabel, { color: IDE.primary }]}>Modified:</Text>
              {task.filesModified.map(f => <Text key={f} style={planStyles.filePath}>{f}</Text>)}
            </View>
          )}
          {task.result && task.status === 'completed' && (
            <View style={planStyles.resultBox}>
              <Text style={planStyles.resultText} numberOfLines={4}>{task.result}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ToolDetailModal({ tool, permission, onChangePermission, onClose, yoloMode }: {
  tool: ToolRegistryItem | null;
  permission: ToolPermission;
  onChangePermission: (perm: ToolPermission) => void;
  onClose: () => void;
  yoloMode: boolean;
}) {
  if (!tool) return null;

  return (
    <Modal visible={!!tool} transparent animationType="slide">
      <View style={tdStyles.overlay}>
        <TouchableOpacity style={tdStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={tdStyles.container}>
          <View style={tdStyles.handle} />
          <View style={tdStyles.header}>
            <Text style={tdStyles.toolName}>{tool.displayName}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={tdStyles.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={tdStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={tdStyles.infoRow}>
              <Text style={tdStyles.infoLabel}>Name</Text>
              <Text style={tdStyles.infoValue}>{tool.name}</Text>
            </View>
            <View style={tdStyles.infoRow}>
              <Text style={tdStyles.infoLabel}>Category</Text>
              <Text style={tdStyles.infoValue}>
                {TOOL_CATEGORIES.find(c => c.id === tool.category)?.label ?? tool.category}
              </Text>
            </View>

            <View style={tdStyles.descSection}>
              <Text style={tdStyles.descLabel}>Description</Text>
              <View style={tdStyles.descBox}>
                <Text style={tdStyles.descText}>{tool.description}</Text>
              </View>
            </View>

            {tool.parameters.length > 0 && (
              <View style={tdStyles.paramSection}>
                <Text style={tdStyles.descLabel}>Parameters</Text>
                {tool.parameters.map((p, i) => (
                  <View key={i} style={tdStyles.paramRow}>
                    <View style={tdStyles.paramIcon}>
                      <Text style={tdStyles.paramIconText}>{'</>'}</Text>
                    </View>
                    <View style={tdStyles.paramInfo}>
                      <Text style={tdStyles.paramName}>{p.name}</Text>
                      <Text style={tdStyles.paramDesc}>{p.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={tdStyles.permSection}>
              <View style={tdStyles.permHeaderRow}>
                <Text style={tdStyles.descLabel}>Permission</Text>
                {yoloMode && (
                  <View style={tdStyles.yoloBadge}>
                    <Zap size={10} color={IDE.warning} />
                    <Text style={tdStyles.yoloBadgeText}>YOLO overrides</Text>
                  </View>
                )}
              </View>
              {yoloMode && (
                <View style={tdStyles.yoloNotice}>
                  <Text style={tdStyles.yoloNoticeText}>
                    YOLO mode is active. All tools are executed automatically without asking. Disable YOLO in settings to use individual permissions.
                  </Text>
                </View>
              )}
              {PERMISSION_OPTIONS.map(opt => {
                const isSelected = !yoloMode && permission === opt.value;
                const isYoloAlways = yoloMode && opt.value === 'always';
                const isDisabled = yoloMode;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      tdStyles.permOption,
                      isSelected && { borderColor: opt.color + '60', backgroundColor: opt.color + '08' },
                      isYoloAlways && { borderColor: IDE.warning + '60', backgroundColor: IDE.warning + '08' },
                      isDisabled && !isYoloAlways && tdStyles.permOptionDisabled,
                    ]}
                    onPress={() => { if (!isDisabled) onChangePermission(opt.value); }}
                    activeOpacity={isDisabled ? 1 : 0.7}
                    disabled={isDisabled}
                  >
                    <View style={[
                      tdStyles.permDot,
                      { backgroundColor: isSelected ? opt.color : isYoloAlways ? IDE.warning : IDE.border },
                      isDisabled && !isYoloAlways && { opacity: 0.3 },
                    ]}>
                      {(isSelected || isYoloAlways) && <View style={tdStyles.permDotInner} />}
                    </View>
                    <View style={tdStyles.permContent}>
                      <Text style={[
                        tdStyles.permLabel,
                        isSelected && { color: opt.color },
                        isYoloAlways && { color: IDE.warning },
                        isDisabled && !isYoloAlways && { color: IDE.muted, opacity: 0.5 },
                      ]}>{opt.label}</Text>
                      <Text style={[
                        tdStyles.permDesc,
                        isDisabled && !isYoloAlways && { opacity: 0.4 },
                      ]}>{opt.desc}</Text>
                    </View>
                    {isSelected && <CircleCheck size={16} color={opt.color} />}
                    {isYoloAlways && <Zap size={16} color={IDE.warning} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const planStyles = StyleSheet.create({
  card: {
    backgroundColor: IDE.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IDE.border,
    marginBottom: 10,
    overflow: 'hidden' as const,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    gap: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  headerContent: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600' as const, color: IDE.text },
  metaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 4 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '600' as const },
  taskCount: { fontSize: 10, color: IDE.muted },
  errorCount: { fontSize: 10, color: IDE.danger },
  progressBarOuter: {
    height: 2,
    backgroundColor: IDE.border,
    flexDirection: 'row' as const,
  },
  progressBarFill: { height: 2 },
  body: { padding: 12, borderTopWidth: 1, borderTopColor: IDE.border },
  taskRow: {
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden' as const,
  },
  taskHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 10,
    gap: 8,
  },
  taskIndex: { width: 24, height: 24, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  taskIndexText: { fontSize: 10, fontWeight: '700' as const },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 12, fontWeight: '600' as const, color: IDE.text },
  taskMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginTop: 2 },
  taskStatus: { fontSize: 10, fontWeight: '600' as const },
  taskFileMeta: { fontSize: 10, color: IDE.muted, marginLeft: 4 },
  taskDetails: { padding: 10, borderTopWidth: 1, borderTopColor: IDE.border, backgroundColor: IDE.bg + 'CC' },
  taskDesc: { fontSize: 11, color: IDE.textSecondary, lineHeight: 16 },
  taskErrorBox: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: IDE.danger + '12', borderRadius: 4, padding: 6, marginTop: 6 },
  taskErrorText: { fontSize: 10, color: IDE.danger, flex: 1 },
  fileList: { marginTop: 6 },
  fileLabel: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.3 },
  filePath: { fontSize: 10, color: IDE.textSecondary, fontFamily: 'monospace', paddingLeft: 8, lineHeight: 16 },
  resultBox: { backgroundColor: IDE.accent + '10', borderRadius: 4, padding: 6, marginTop: 6 },
  resultText: { fontSize: 10, color: IDE.textSecondary, lineHeight: 16 },
  summaryBox: { backgroundColor: IDE.surface, borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: IDE.border },
  summaryLabel: { fontSize: 10, fontWeight: '700' as const, color: IDE.accent, letterSpacing: 0.5, marginBottom: 4 },
  summaryText: { fontSize: 11, color: IDE.textSecondary, lineHeight: 16 },
  dateText: { fontSize: 10, color: IDE.muted, marginTop: 8 },
});

const tdStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' as const },
  backdrop: { flex: 1 },
  container: {
    backgroundColor: IDE.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: IDE.border,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: IDE.border, alignSelf: 'center' as const, marginTop: 8, marginBottom: 4 },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  toolName: { fontSize: 17, fontWeight: '700' as const, color: IDE.text, fontFamily: 'monospace' },
  doneBtn: { fontSize: 15, color: IDE.primary, fontWeight: '600' as const },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  infoRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IDE.border,
  },
  infoLabel: { fontSize: 14, color: IDE.muted },
  infoValue: { fontSize: 14, color: IDE.text, fontWeight: '500' as const },
  descSection: { marginTop: 16 },
  descLabel: { fontSize: 11, fontWeight: '700' as const, color: IDE.muted, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 8 },
  descBox: { backgroundColor: IDE.bg, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: IDE.border },
  descText: { fontSize: 13, color: IDE.textSecondary, lineHeight: 20 },
  paramSection: { marginTop: 16 },
  paramRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IDE.border,
  },
  paramIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: IDE.primary + '15',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  paramIconText: { fontSize: 11, color: IDE.primary, fontWeight: '700' as const, fontFamily: 'monospace' },
  paramInfo: { flex: 1 },
  paramName: { fontSize: 14, fontWeight: '600' as const, color: IDE.text },
  paramDesc: { fontSize: 12, color: IDE.muted, marginTop: 1 },
  permSection: { marginTop: 20, marginBottom: 40 },
  permHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 8 },
  yoloBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.warning + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: IDE.warning + '40',
  },
  yoloBadgeText: { fontSize: 10, fontWeight: '700' as const, color: IDE.warning, letterSpacing: 0.3 },
  yoloNotice: {
    backgroundColor: IDE.warning + '10',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: IDE.warning + '20',
  },
  yoloNoticeText: { fontSize: 11, color: IDE.warning, lineHeight: 16 },
  permOptionDisabled: { opacity: 0.4 },
  permOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    backgroundColor: IDE.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: IDE.border,
    marginBottom: 6,
  },
  permDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  permDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  permContent: { flex: 1 },
  permLabel: { fontSize: 14, fontWeight: '600' as const, color: IDE.text },
  permDesc: { fontSize: 11, color: IDE.muted, marginTop: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IDE.bg },
  tabBar: {
    backgroundColor: IDE.surface,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    maxHeight: 42,
  },
  tabBarContent: {
    paddingHorizontal: 4,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: IDE.primary },
  tabText: { fontSize: 11, color: IDE.muted, fontWeight: '500' as const },
  activeTabText: { color: IDE.primary },
  tabBadge: {
    backgroundColor: IDE.muted + '30',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center' as const,
  },
  tabBadgeActive: { backgroundColor: IDE.primary + '25' },
  tabBadgeText: { fontSize: 9, fontWeight: '700' as const, color: IDE.muted },
  tabBadgeTextActive: { color: IDE.primary },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  toolsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  toolsTitle: { fontSize: 18, fontWeight: '700' as const, color: IDE.text },
  toolsCountBadge: {
    backgroundColor: IDE.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  toolsCountText: { fontSize: 11, fontWeight: '600' as const, color: IDE.primary },
  toolsSubtitle: { fontSize: 12, color: IDE.muted, marginBottom: 16, lineHeight: 18 },
  categorySection: { marginBottom: 12 },
  categoryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  categoryTitle: { fontSize: 13, fontWeight: '600' as const, color: IDE.textSecondary, flex: 1 },
  categoryCountBadge: {
    backgroundColor: IDE.surface,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  categoryCountText: { fontSize: 10, color: IDE.muted, fontWeight: '600' as const },
  toolCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: IDE.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  toolPermIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  toolCardContent: { flex: 1 },
  toolNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  toolCardName: { fontSize: 13, fontWeight: '600' as const, color: IDE.text, fontFamily: 'monospace' },
  toolCardDesc: { fontSize: 11, color: IDE.muted, marginTop: 2 },
  betaPill: {
    backgroundColor: IDE.warning + '20',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  betaPillText: { fontSize: 8, fontWeight: '700' as const, color: IDE.warning, letterSpacing: 0.5 },
  yoloOverridePill: {
    backgroundColor: IDE.warning + '20',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  yoloOverridePillText: { fontSize: 8, fontWeight: '700' as const, color: IDE.warning, letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 16 },
  textInput: {
    flex: 1,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: IDE.text,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: IDE.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyBox: {
    alignItems: 'center' as const,
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: { fontSize: 14, color: IDE.muted, textAlign: 'center' as const },
  emptyHint: { fontSize: 12, color: IDE.muted, textAlign: 'center' as const, opacity: 0.7 },
  todoSection: { marginBottom: 16 },
  todoSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  todoSectionTitle: { fontSize: 12, fontWeight: '600' as const, color: IDE.textSecondary },
  todoItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    marginBottom: 4,
  },
  todoItemCompleted: { opacity: 0.6 },
  todoCheck: { padding: 2 },
  todoText: { flex: 1, fontSize: 14, color: IDE.text, lineHeight: 20 },
  todoCompleted: { textDecorationLine: 'line-through' as const, color: IDE.muted },
  deleteBtn: { padding: 6 },
  planSection: { marginBottom: 16 },
  planSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  planSectionTitle: { fontSize: 12, fontWeight: '600' as const, color: IDE.textSecondary },
  memoItem: {
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 12,
    marginBottom: 8,
  },
  memoText: { fontSize: 13, color: IDE.text, lineHeight: 20 },
  memoFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  memoDate: { fontSize: 11, color: IDE.muted },
  searchResultsBox: {
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 12,
    marginBottom: 16,
    maxHeight: 300,
  },
  searchResultsText: { fontSize: 12, color: IDE.textSecondary, fontFamily: 'monospace', lineHeight: 18 },
  treeSection: { marginTop: 8 },
  sectionHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '600' as const, color: IDE.text },
  treeBox: {
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 12,
    maxHeight: 400,
  },
  treeText: { fontSize: 12, color: IDE.textSecondary, fontFamily: 'monospace', lineHeight: 18 },
  chatSection: { gap: 12 },
  chatInfo: { fontSize: 13, color: IDE.muted },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    padding: 14,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 14, color: IDE.text, fontWeight: '500' as const },
  actionBtnTextDisabled: { color: IDE.muted },
  dangerBtn: { borderColor: IDE.danger + '40' },
  compressBox: {
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.warning + '40',
    padding: 16,
    marginTop: 16,
  },
  compressTitle: { fontSize: 15, fontWeight: '600' as const, color: IDE.text, marginBottom: 4 },
  compressHint: { fontSize: 12, color: IDE.muted, marginBottom: 12, lineHeight: 18 },
  compressInput: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 6,
    padding: 12,
    fontSize: 12,
    color: IDE.text,
    fontFamily: 'monospace',
    minHeight: 150,
    maxHeight: 300,
  },
  compressActions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10, marginTop: 12 },
  compressCancelBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  compressCancelText: { fontSize: 14, color: IDE.muted },
  compressApplyBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: IDE.warning, borderRadius: 6 },
  compressApplyText: { fontSize: 14, color: '#fff', fontWeight: '600' as const },
});
