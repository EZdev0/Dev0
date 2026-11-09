import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import {
  Plus, Trash2, BookOpen,
  Search, FolderTree, Zap, Wrench, ChevronRight, ChevronDown,
  Shield, ShieldCheck, ShieldOff, ShieldX, CircleCheck,
  Clock, AlertCircle, Play, RefreshCw, Brain, Globe,
  Folder, ClipboardList, Database, Settings2, Eye, LayoutDashboard,
  Network, FileCode, Cpu, ExternalLink, Sparkles,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import { useProject } from '@/providers/ProjectProvider';
import { useChat } from '@/providers/ChatProvider';
import { useAgent } from '@/providers/AgentProvider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AgentDashboard } from '@/components/MultiAgentUI';
import { SynapseGraphView } from '@/components/SynapseGraphView';
import { SubAgent, createSubAgent } from '@/utils/multi-agent-system';
import {
  ToolPermission, TOOL_REGISTRY, TOOL_CATEGORIES, ToolRegistryItem,
  AgentPlan, AgentTask, isLearningTool, isLearningEnabled,
  isProjectFilesystemOrAgentOnlyTool, isChatModeOnlyTool,
} from '@/types';
import { canManageUsers } from '@/utils/free-ai-pool';
import { discoverYamlSkills } from '@/utils/skill-loader';
import {
  buildSynapseGraph,
  buildMemoryOnlySynapseGraph,
  cleanStaleMemoryGraphLinks,
  SynapseNode,
} from '@/utils/synapse-graph';

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

type SubTabId = 'dashboard' | 'tools' | 'plans' | 'graph' | 'search' | 'chat';

export default function ToolsScreen() {
  const router = useRouter();
  const {
    memos,
    addMemo,
    deleteMemo,
    settings,
    getToolPermission,
    setToolPermission,
    customSubAgents,
    deleteSubAgentTemplate,
    setShowSubAgentStudioModal,
    setShowFreePoolModal,
    setShowTutorialModal,
    freePoolState,
    skillEnabledOverrides,
    skillTriggerOverrides,
    uploadedSkillFiles,
  } = useApp();
  const {
    getProjectTree,
    searchFilesInProject,
    currentProject,
    projects,
    selectProject,
  } = useProject();
  const { clearChat, startNewChat, compressChat, applyChatCompression, messages, openSubAgentFloatingLauncher } = useChat();
  const { plans, activePlan, clarificationQuestions, skipClarificationQuestions } = useAgent();

  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const learningActive = isLearningEnabled(settings);

  // Dashboard is in Slot 1 and is the default tab unless a specific tab param is provided
  const normalizeTabParam = (raw?: string): SubTabId => {
    if (raw === 'memos' || raw === 'graph') return 'graph';
    if (
      raw === 'dashboard' ||
      raw === 'tools' ||
      raw === 'plans' ||
      raw === 'search' ||
      raw === 'chat'
    ) {
      return raw;
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<SubTabId>(normalizeTabParam(tab));
  const lastAppliedTabParamRef = useRef<string | undefined>(tab);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string } | null>(null);
  const [confirmClearChatModal, setConfirmClearChatModal] = useState<boolean>(false);

  // Sync incoming URL parameter `tab` ONLY when the route parameter itself changes
  useEffect(() => {
    if (tab !== lastAppliedTabParamRef.current) {
      lastAppliedTabParamRef.current = tab;
      if (tab) {
        setActiveTab(normalizeTabParam(tab));
      }
    }
  }, [tab]);

  const handleSelectTab = useCallback((nextTab: SubTabId) => {
    lastAppliedTabParamRef.current = nextTab;
    setActiveTab(nextTab);
    try {
      router.setParams({ tab: nextTab });
    } catch {
      // Ignore router param update errors if unmounted
    }
  }, [router]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<string>('');
  const [compressSummary, setCompressSummary] = useState<string>('');
  const [showCompress, setShowCompress] = useState<boolean>(false);
  const [selectedTool, setSelectedTool] = useState<ToolRegistryItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['filesystem', 'planning', 'analysis']));
  const [showHiddenModeTools, setShowHiddenModeTools] = useState<boolean>(false);

  const discoveredSkills = useMemo(
    () =>
      discoverYamlSkills(
        currentProject?.files || [],
        skillEnabledOverrides,
        uploadedSkillFiles,
        skillTriggerOverrides,
      ),
    [currentProject?.files, uploadedSkillFiles, skillEnabledOverrides, skillTriggerOverrides],
  );

  const combinedGraphForSearch = useMemo(() => {
    const cleaned = cleanStaleMemoryGraphLinks(memos, currentProject);
    if (currentProject) {
      return buildSynapseGraph({
        project: currentProject,
        memos: cleaned.cleanedMemos,
        skills: discoveredSkills,
      });
    }
    return buildMemoryOnlySynapseGraph({
      memos: cleaned.cleanedMemos,
    });
  }, [memos, currentProject, discoveredSkills]);

  const matchingGraphNodes = useMemo((): SynapseNode[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return combinedGraphForSearch.nodes.slice(0, 24);
    return combinedGraphForSearch.nodes.filter(
      n =>
        n.label.toLowerCase().includes(q) ||
        (n.filePath && n.filePath.toLowerCase().includes(q)) ||
        (n.snippet && n.snippet.toLowerCase().includes(q)) ||
        (n.signature && n.signature.toLowerCase().includes(q)),
    );
  }, [combinedGraphForSearch.nodes, searchQuery]);

  const currentUserRole = useMemo(() => {
    const u = freePoolState?.users?.find(usr => usr.id === freePoolState.currentUserId);
    return u?.role || 'user';
  }, [freePoolState]);
  const isAdminOrOwner = canManageUsers(currentUserRole);
  const isNormalChat = !settings.agentMode || !currentProject;

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults('');
      return;
    }
    if (currentProject) {
      const results = searchFilesInProject(searchQuery.trim());
      setSearchResults(results);
    } else {
      setSearchResults('');
    }
  }, [searchQuery, searchFilesInProject, currentProject]);

  const handleCompress = useCallback(async () => {
    const summary = await compressChat();
    if (summary) {
      setCompressSummary(summary);
      setShowCompress(true);
    } else {
      setNoticeModal({ title: 'Notice', message: 'Not enough messages to compress (min. 4).' });
    }
  }, [compressChat]);

  const handleApplyCompress = useCallback(() => {
    const success = applyChatCompression(compressSummary);
    if (success === false) {
      setNoticeModal({ title: 'Notice', message: 'Compression aborted: The summary is not smaller than the current chat.' });
    } else {
      setShowCompress(false);
      setCompressSummary('');
      setNoticeModal({ title: 'Success', message: 'Chat has been compressed.' });
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

  const isToolHiddenInCurrentMode = useCallback(
    (toolName: string): boolean => {
      if (isNormalChat && isProjectFilesystemOrAgentOnlyTool(toolName)) return true;
      if (!isNormalChat && isChatModeOnlyTool(toolName)) return true;
      const perm = getToolPermission(toolName);
      if (perm === 'removed' || perm === 'blocked') return true;
      return false;
    },
    [isNormalChat, getToolPermission],
  );

  const groupedTools = useMemo(() => {
    const groups: Record<string, ToolRegistryItem[]> = {};
    for (const tool of TOOL_REGISTRY) {
      if (isLearningTool(tool.name) && !learningActive) continue;
      if (tool.isBeta && !settings.yoloMode) {
        if (tool.name === 'web_search' && !settings.betaWebSearch) continue;
        if (tool.name === 'web_fetch' && !settings.betaWebFetch) continue;
      }
      if (!showHiddenModeTools && isToolHiddenInCurrentMode(tool.name)) {
        continue;
      }
      if (!groups[tool.category]) groups[tool.category] = [];
      groups[tool.category].push(tool);
    }
    return groups;
  }, [
    settings.betaWebSearch,
    settings.betaWebFetch,
    settings.yoloMode,
    learningActive,
    showHiddenModeTools,
    isToolHiddenInCurrentMode,
  ]);

  const activeToolCount = useMemo(() => {
    let count = 0;
    for (const tool of TOOL_REGISTRY) {
      if (isLearningTool(tool.name) && !learningActive) continue;
      if (tool.isBeta && !settings.yoloMode) {
        if (tool.name === 'web_search' && !settings.betaWebSearch) continue;
        if (tool.name === 'web_fetch' && !settings.betaWebFetch) continue;
      }
      if (isToolHiddenInCurrentMode(tool.name)) continue;
      count++;
    }
    return count;
  }, [learningActive, settings.betaWebSearch, settings.betaWebFetch, settings.yoloMode, isToolHiddenInCurrentMode]);

  const activePlans = useMemo(() =>
    (plans ?? []).filter(p => p && (p.status === 'executing' || p.status === 'review')),
    [plans]
  );
  const completedPlans = useMemo(() =>
    (plans ?? []).filter(p => p && (p.status === 'completed' || p.status === 'error')),
    [plans]
  );

  // Dashboard in Slot 1! Memos replaced by Graph!
  const tabs: { id: SubTabId; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: subAgents.length || undefined },
    { id: 'tools', label: 'Tools', icon: Wrench, badge: activeToolCount },
    { id: 'plans', label: 'Plans', icon: Brain, badge: activePlans.length || undefined },
    { id: 'graph', label: 'Graph', icon: Network, badge: combinedGraphForSearch.nodes.length || undefined },
    { id: 'search', label: 'Search', icon: Search, badge: undefined },
    { id: 'chat', label: 'Chat', icon: Zap, badge: undefined },
  ];

  const handleOpenFilePathInEditor = useCallback(
    (filePath: string) => {
      router.push({ pathname: '/editor' as any, params: { path: filePath } });
    },
    [router],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map(tabItem => {
            const Icon = tabItem.icon;
            const isActive = activeTab === tabItem.id;
            return (
              <TouchableOpacity
                key={tabItem.id}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => handleSelectTab(tabItem.id)}
                activeOpacity={0.7}
              >
                <Icon size={15} color={isActive ? IDE.primary : IDE.muted} />
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tabItem.label}</Text>
                {tabItem.badge !== undefined && tabItem.badge > 0 ? (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {tabItem.badge}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.tutorialHeaderBtn}
            onPress={() => setShowTutorialModal(true)}
            activeOpacity={0.75}
          >
            <BookOpen size={14} color={IDE.accent} />
            <Text style={styles.tutorialHeaderBtnText}>Tutorial</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {activeTab === 'graph' ? (
        <View style={{ flex: 1 }}>
          <SynapseGraphView
            project={currentProject}
            projects={projects}
            memos={memos}
            skills={discoveredSkills}
            onSelectProject={selectProject}
            onOpenCreateProject={() => router.push('/(tabs)/(home)' as any)}
            onOpenFileInEditor={handleOpenFilePathInEditor}
            onAddLinkedMemo={content => addMemo(content)}
            onDeleteMemo={memoId => deleteMemo(memoId)}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {activeTab === 'dashboard' ? (
            <AgentDashboard
              mainAgentStatus={activePlan?.status === 'executing' ? 'executing' : (activePlan?.status === 'review' || activePlan?.status === 'clarifying') ? 'planning' : 'idle'}
              subAgents={subAgents}
              savedSubAgentTemplates={customSubAgents}
              onDeploySubAgent={(type) => {
                const newAgent = createSubAgent(type);
                setSubAgents(prev => [...prev, newAgent]);
                setNoticeModal({ title: 'Agent Deployed', message: `${newAgent.name} is now active and ready for tasks.` });
              }}
              onLaunchSavedSubAgent={(tpl) => {
                router.push('/(tabs)/chat' as any);
                setTimeout(() => {
                  openSubAgentFloatingLauncher({
                    role: tpl.role,
                    name: tpl.name,
                    task: tpl.description,
                    questions: [
                      `What task should the saved Sub-Agent "${tpl.name}" (${tpl.role}) execute for the Main Creator?`,
                    ],
                  });
                }, 100);
              }}
              onDeleteSavedSubAgent={(tplId) => deleteSubAgentTemplate(tplId)}
              onViewSubAgentResult={(agentId) => {
                const ag = subAgents.find(a => a.id === agentId);
                if (ag?.result) {
                  setNoticeModal({ title: ag.name + ' Result', message: ag.result.summary });
                }
              }}
              currentTask={activePlan?.userRequest}
              hasClarificationQuestions={Boolean(activePlan?.status === 'clarifying' || (clarificationQuestions && clarificationQuestions.length > 0))}
              onSkipClarificationQuestions={() => skipClarificationQuestions(activePlan?.id, true)}
              onNavigateToTools={() => handleSelectTab('tools')}
              onNavigateToPlans={() => handleSelectTab('plans')}
              onNavigateToChat={() => router.push('/(tabs)/chat' as any)}
              onNavigateToProjects={() => router.push('/(tabs)/(home)' as any)}
            />
          ) : null}

          {activeTab === 'tools' ? (
            <>
              <View style={styles.toolsHeader}>
                <Text style={styles.toolsTitle}>Sub-Agents & YAML Skills</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.openDashboardHeaderBtn, { backgroundColor: IDE.accent + '18', borderColor: IDE.accent + '45' }]}
                    onPress={() => setShowFreePoolModal(true)}
                    activeOpacity={0.7}
                  >
                    <Zap size={13} color={IDE.accent} />
                    <Text style={[styles.openDashboardHeaderText, { color: IDE.accent }]}>AI for Free</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.openDashboardHeaderBtn}
                    onPress={() => setShowSubAgentStudioModal(true)}
                    activeOpacity={0.7}
                  >
                    <Brain size={14} color={IDE.primary} />
                    <Text style={styles.openDashboardHeaderText}>Sub-Agent & Skill Studio</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.toolsSubtitle}>
                Custom Sub-Agent templates with scoped file permissions and Extra YAML skills (.md/.yml/.zip). Tap Sub-Agent & Skill Studio to upload skills, repair corrupted YAML with AI, or set custom trigger words.
              </Text>
              <View style={styles.categorySection}>
                {customSubAgents.map(tpl => (
                  <View key={tpl.id} style={styles.toolCard}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => setShowSubAgentStudioModal(true)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.toolPermIcon, { backgroundColor: IDE.primary + '20' }]}>
                        <Brain size={12} color={IDE.primary} />
                      </View>
                      <View style={styles.toolCardContent}>
                        <View style={styles.toolNameRow}>
                          <Text style={styles.toolCardName}>{tpl.name}</Text>
                          <View style={styles.betaPill}>
                            <Text style={styles.betaPillText}>{tpl.role.toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={styles.toolCardDesc} numberOfLines={1}>
                          {tpl.description} • Files: {tpl.allowedFiles.join(', ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteSubAgentTemplate(tpl.id)}
                      style={{ padding: 6 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={14} color={IDE.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={[styles.toolsHeader, { marginTop: 20 }]}>
                <Text style={styles.toolsTitle}>
                  Tool Registry ({isNormalChat ? 'Normal Chat Mode' : 'Agent Mode'})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  {isAdminOrOwner ? (
                    <TouchableOpacity
                      style={[
                        styles.openDashboardHeaderBtn,
                        showHiddenModeTools && {
                          backgroundColor: IDE.warning + '20',
                          borderColor: IDE.warning,
                        },
                      ]}
                      onPress={() => setShowHiddenModeTools(v => !v)}
                      activeOpacity={0.7}
                    >
                      <Eye size={13} color={showHiddenModeTools ? IDE.warning : IDE.muted} />
                      <Text
                        style={[
                          styles.openDashboardHeaderText,
                          { color: showHiddenModeTools ? IDE.warning : IDE.muted },
                        ]}
                      >
                        {showHiddenModeTools ? 'Hide Disabled Tools' : 'Owner: Show Disabled'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.toolsCountBadge}>
                    <Text style={styles.toolsCountText}>{activeToolCount} active</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.toolsSubtitle}>
                {isNormalChat
                  ? 'Normal Chat Mode active: Project filesystem & Sub-Agent tools are automatically disabled and hidden. Only ZIP bundle, Draft Plan, Memory Graph & Cross-Chat tools are active.'
                  : 'Agent Mode active: ZIP bundle & Chat-only tools (zip_create, zip_read, draft_agent_plan) are automatically disabled and hidden so Dev0 writes directly to your project files.'}
                {settings.yoloMode ? ' YOLO mode overrides all permissions.' : ''}
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

                    {isExpanded
                      ? catTools.map(tool => {
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
                                  {tool.isBeta ? (
                                    <View style={styles.betaPill}>
                                      <Text style={styles.betaPillText}>BETA</Text>
                                    </View>
                                  ) : null}
                                  {isYoloOverride ? (
                                    <View style={styles.yoloOverridePill}>
                                      <Text style={styles.yoloOverridePillText}>YOLO</Text>
                                    </View>
                                  ) : null}
                                </View>
                                <Text style={styles.toolCardDesc} numberOfLines={1}>{tool.description}</Text>
                              </View>
                              <ChevronRight size={14} color={IDE.muted} />
                            </TouchableOpacity>
                          );
                        })
                      : null}
                  </View>
                );
              })}
            </>
          ) : null}

          {activeTab === 'plans' ? (
            <>
              {activePlans.length > 0 ? (
                <View style={styles.planSection}>
                  <View style={styles.planSectionHeader}>
                    <Play size={12} color={IDE.primary} />
                    <Text style={styles.planSectionTitle}>Active Plans</Text>
                  </View>
                  {activePlans.map(plan => (
                    <PlanCard key={plan.id} plan={plan} />
                  ))}
                </View>
              ) : null}

              {completedPlans.length > 0 ? (
                <View style={styles.planSection}>
                  <View style={styles.planSectionHeader}>
                    <CircleCheck size={12} color={IDE.accent} />
                    <Text style={styles.planSectionTitle}>Completed Plans ({completedPlans.length})</Text>
                  </View>
                  {completedPlans.map(plan => (
                    <PlanCard key={plan.id} plan={plan} />
                  ))}
                </View>
              ) : null}

              {(plans ?? []).length === 0 ? (
                <View style={styles.emptyBox}>
                  <Brain size={32} color={IDE.muted} />
                  <Text style={styles.emptyText}>No Agent Plans</Text>
                  <Text style={styles.emptyHint}>Use Agent Mode in chat to create plans.</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {activeTab === 'search' ? (
            <>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Search codebase files, functions, YAML skills & Synapse Graph nodes..."
                  placeholderTextColor={IDE.muted}
                  value={searchQuery}
                  onChangeText={txt => {
                    setSearchQuery(txt);
                    if (currentProject && txt.trim()) {
                      setSearchResults(searchFilesInProject(txt.trim()));
                    } else {
                      setSearchResults('');
                    }
                  }}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.addBtn} onPress={handleSearch} activeOpacity={0.7}>
                  <Search size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Interactive Synapse Graph & Codebase Nodes Matching Search */}
              <View style={styles.treeSection}>
                <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Network size={14} color={IDE.primary} />
                    <Text style={styles.sectionTitle}>
                      Codebase & Synapse Graph Nodes ({matchingGraphNodes.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openDashboardHeaderBtn}
                    onPress={() => handleSelectTab('graph')}
                  >
                    <Sparkles size={12} color={IDE.primary} />
                    <Text style={styles.openDashboardHeaderText}>Open Full 2D Graph</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 6, marginBottom: 14 }}>
                  {matchingGraphNodes.slice(0, 18).map(node => (
                    <TouchableOpacity
                      key={node.id}
                      style={styles.toolCard}
                      onPress={() => {
                        if (node.filePath && !node.filePath.startsWith('.qoder')) {
                          handleOpenFilePathInEditor(node.filePath);
                        } else {
                          handleSelectTab('graph');
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.toolPermIcon, { backgroundColor: IDE.primary + '18' }]}>
                        {node.type === 'file' ? <FileCode size={13} color={IDE.primary} /> : null}
                        {node.type === 'function' ? <Cpu size={13} color={IDE.warning} /> : null}
                        {node.type === 'memo' ? <Brain size={13} color={IDE.accent} /> : null}
                        {node.type === 'skill' ? <ShieldCheck size={13} color={IDE.primary} /> : null}
                        {node.type === 'project' ? <Folder size={13} color={IDE.primary} /> : null}
                      </View>
                      <View style={styles.toolCardContent}>
                        <View style={styles.toolNameRow}>
                          <Text style={styles.toolCardName}>{node.label}</Text>
                          <View style={styles.betaPill}>
                            <Text style={styles.betaPillText}>{node.type.toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={styles.toolCardDesc} numberOfLines={1}>
                          {node.filePath ? `${node.filePath} · ` : ''}
                          {node.signature || node.snippet || `${node.degree} connected synapses`}
                        </Text>
                      </View>
                      {Boolean(node.filePath && !node.filePath.startsWith('.qoder')) ? (
                        <ExternalLink size={14} color={IDE.primary} />
                      ) : (
                        <ChevronRight size={14} color={IDE.muted} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {Boolean(searchResults) ? (
                <View style={styles.searchResultsBox}>
                  <ScrollView horizontal={false} nestedScrollEnabled>
                    <Text style={styles.searchResultsText} selectable>{searchResults}</Text>
                  </ScrollView>
                </View>
              ) : null}

              {Boolean(currentProject) ? (
                <View style={styles.treeSection}>
                  <View style={styles.sectionHeader}>
                    <FolderTree size={14} color={IDE.muted} />
                    <Text style={styles.sectionTitle}>Codebase Structure ({currentProject?.name})</Text>
                  </View>
                  <View style={styles.treeBox}>
                    <ScrollView horizontal={false} nestedScrollEnabled>
                      <Text style={styles.treeText} selectable>{getProjectTree()}</Text>
                    </ScrollView>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  Open a project in the Projects tab to inspect its full file tree structure.
                </Text>
              )}
            </>
          ) : null}

          {activeTab === 'chat' ? (
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
                  onPress={() => setConfirmClearChatModal(true)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color={IDE.danger} />
                  <Text style={[styles.actionBtnText, { color: IDE.danger }]}>Clear Chat</Text>
                </TouchableOpacity>
              </View>

              {showCompress ? (
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
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}

      <ToolDetailModal
        tool={selectedTool}
        permission={selectedTool ? getToolPermission(selectedTool.name) : 'ask'}
        onChangePermission={(perm) => {
          if (selectedTool) setToolPermission(selectedTool.name, perm);
        }}
        onClose={() => setSelectedTool(null)}
        yoloMode={settings.yoloMode}
      />

      {/* Cross-Platform Clear Chat Confirmation Modal */}
      <Modal visible={confirmClearChatModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>Clear Chat</Text>
            <Text style={styles.dialogText}>Do you want to delete the entire chat history?</Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setConfirmClearChatModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogDangerBtn}
                onPress={() => {
                  clearChat();
                  setConfirmClearChatModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.dialogDangerText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cross-Platform Notice Modal */}
      <Modal visible={!!noticeModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>{noticeModal?.title}</Text>
            <Text style={styles.dialogText}>{noticeModal?.message}</Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogPrimaryBtn}
                onPress={() => setNoticeModal(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.dialogPrimaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PlanCard({ plan }: { plan: AgentPlan }) {
  const [expanded, setExpanded] = useState<boolean>(false);

  const tasks = plan?.tasks ?? [];
  const completed = tasks.filter(t => t?.status === 'completed').length;
  const errors = tasks.filter(t => t?.status === 'error').length;
  const running = tasks.filter(t => t?.status === 'running').length;
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
            {errors > 0 ? <Text style={planStyles.errorCount}>{errors} Errors</Text> : null}
          </View>
        </View>
        {expanded ? <ChevronDown size={14} color={IDE.muted} /> : <ChevronRight size={14} color={IDE.muted} />}
      </TouchableOpacity>

      {total > 0 ? (
        <View style={planStyles.progressBarOuter}>
          <View style={[planStyles.progressBarFill, { flex: total > 0 ? completed / total : 0, backgroundColor: IDE.accent }]} />
          {errors > 0 ? <View style={[planStyles.progressBarFill, { flex: errors / total, backgroundColor: IDE.danger }]} /> : null}
          {running > 0 ? <View style={[planStyles.progressBarFill, { flex: running / total, backgroundColor: IDE.primary }]} /> : null}
        </View>
      ) : null}

      {expanded ? (
        <View style={planStyles.body}>
          {tasks.map((task, i) => task ? (
            <PlanTaskRow key={task.id} task={task} index={i} />
          ) : null)}

          {Boolean(plan.summary) ? (
            <View style={planStyles.summaryBox}>
              <Text style={planStyles.summaryLabel}>Summary</Text>
              <Text style={planStyles.summaryText}>{plan.summary}</Text>
            </View>
          ) : null}

          <Text style={planStyles.dateText}>
            Created: {new Date(plan.createdAt).toLocaleString('en-US')}
            {plan.completedAt ? ' · Finished: ' + new Date(plan.completedAt).toLocaleString('en-US') : ''}
          </Text>
        </View>
      ) : null}
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
            {fileCount > 0 ? <Text style={planStyles.taskFileMeta}>{fileCount} files</Text> : null}
          </View>
        </View>
        {expanded ? <ChevronDown size={12} color={IDE.muted} /> : <ChevronRight size={12} color={IDE.muted} />}
      </TouchableOpacity>

      {expanded ? (
        <View style={planStyles.taskDetails}>
          <Text style={planStyles.taskDesc}>{task.description}</Text>
          {Boolean(task.error) ? (
            <View style={planStyles.taskErrorBox}>
              <AlertCircle size={10} color={IDE.danger} />
              <Text style={planStyles.taskErrorText}>{task.error}</Text>
            </View>
          ) : null}
          {task.filesCreated?.length > 0 ? (
            <View style={planStyles.fileList}>
              <Text style={[planStyles.fileLabel, { color: IDE.accent }]}>Created:</Text>
              {task.filesCreated.map(f => <Text key={f} style={planStyles.filePath}>{f}</Text>)}
            </View>
          ) : null}
          {task.filesModified?.length > 0 ? (
            <View style={planStyles.fileList}>
              <Text style={[planStyles.fileLabel, { color: IDE.primary }]}>Modified:</Text>
              {task.filesModified.map(f => <Text key={f} style={planStyles.filePath}>{f}</Text>)}
            </View>
          ) : null}
          {Boolean(task.result && task.status === 'completed') ? (
            <View style={planStyles.resultBox}>
              <Text style={planStyles.resultText} numberOfLines={4}>{task.result}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
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

            {tool.parameters.length > 0 ? (
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
            ) : null}

            <View style={tdStyles.permSection}>
              <View style={tdStyles.permHeaderRow}>
                <Text style={tdStyles.descLabel}>Permission</Text>
                {yoloMode ? (
                  <View style={tdStyles.yoloBadge}>
                    <Zap size={10} color={IDE.warning} />
                    <Text style={tdStyles.yoloBadgeText}>YOLO overrides</Text>
                  </View>
                ) : null}
              </View>
              {yoloMode ? (
                <View style={tdStyles.yoloNotice}>
                  <Text style={tdStyles.yoloNoticeText}>
                    YOLO mode is active. All tools are executed automatically without asking. Disable YOLO in settings to use individual permissions.
                  </Text>
                </View>
              ) : null}
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
                      {(isSelected || isYoloAlways) ? <View style={tdStyles.permDotInner} /> : null}
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
                    {isSelected ? <CircleCheck size={16} color={opt.color} /> : null}
                    {isYoloAlways ? <Zap size={16} color={IDE.warning} /> : null}
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
  tabBarWrapper: {
    backgroundColor: IDE.surface,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  tabBar: {
    backgroundColor: IDE.surface,
    minHeight: 48,
    maxHeight: 48,
  },
  tabBarContent: {
    paddingHorizontal: 8,
    alignItems: 'center' as const,
    gap: 4,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: IDE.primary,
    backgroundColor: IDE.primary + '12',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tabText: { fontSize: 12, color: IDE.muted, fontWeight: '600' as const },
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
  tutorialHeaderBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginLeft: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: IDE.accent + '18',
    borderWidth: 1,
    borderColor: IDE.accent + '50',
  },
  tutorialHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: IDE.accent,
  },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  toolsHeader: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
    marginBottom: 4,
  },
  toolsTitle: { fontSize: 18, fontWeight: '700' as const, color: IDE.text },
  openDashboardHeaderBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: IDE.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.primary + '30',
  },
  openDashboardHeaderText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: IDE.primary,
  },
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
  planSection: { marginBottom: 16 },
  planSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  planSectionTitle: { fontSize: 12, fontWeight: '600' as const, color: IDE.textSecondary },
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
  compressCancelBtn: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, justifyContent: 'center' as const },
  compressCancelText: { fontSize: 14, color: IDE.muted },
  compressApplyBtn: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 40, justifyContent: 'center' as const, backgroundColor: IDE.warning, borderRadius: 6 },
  compressApplyText: { fontSize: 14, color: '#fff', fontWeight: '600' as const },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: IDE.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: IDE.text,
    marginBottom: 8,
  },
  dialogText: {
    fontSize: 14,
    color: IDE.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  dialogActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 10,
  },
  dialogCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 42,
    justifyContent: 'center' as const,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  dialogCancelText: {
    fontSize: 14,
    color: IDE.muted,
    fontWeight: '600' as const,
  },
  dialogDangerBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 42,
    justifyContent: 'center' as const,
    borderRadius: 8,
    backgroundColor: IDE.danger,
  },
  dialogDangerText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600' as const,
  },
  dialogPrimaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 42,
    justifyContent: 'center' as const,
    borderRadius: 8,
    backgroundColor: IDE.primary,
  },
  dialogPrimaryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600' as const,
  },
});
