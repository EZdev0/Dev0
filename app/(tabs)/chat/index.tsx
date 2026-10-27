import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, ScrollView,
  Keyboard, Animated, Dimensions,
} from 'react-native';
import {
  Send, Square, Paperclip, X, FileText, Sparkles, Brain, MessageSquare,
  Zap, Info, Trash2, ChevronRight, ShieldAlert, Check, Ban,
  FolderOpen, Code, Search, Lightbulb, PenTool, Heart, LayoutDashboard
} from 'lucide-react-native';
import WebView from 'react-native-webview';
import { useRouter } from 'expo-router';
import { IDE } from '@/constants/colors';
import { useChat } from '@/providers/ChatProvider';
import { useAgent } from '@/providers/AgentProvider';
import { useProject } from '@/providers/ProjectProvider';
import { useApp } from '@/providers/AppProvider';
import { ChatMessage } from '@/types';
import SponsorBanner from '@/components/SponsorBanner';
import ChatBubble from '@/components/ChatBubble';
import AgentPlanView from '@/components/AgentPlanView';
import ThinkingBlock from '@/components/ThinkingBlock';
import SubAgentFloatingQuestionModal from '@/components/SubAgentFloatingQuestionModal';

export default function ChatScreen() {
  const router = useRouter();
  const {
    messages, isLoading, isThinking, thinkingPhase,
    sendMessage, stopGeneration, clearChat, lastFallbackInfo,
    pendingApproval, approvePendingTool,
    hasPendingChatQuestions, skipClarificationQuestions: skipChatClarification,
    pendingSubAgentQuestion,
    openSubAgentFloatingLauncher,
    submitSubAgentQuestionResponse,
    closeSubAgentQuestionModal,
  } = useChat();
  const {
    activePlan, isPlanning, isExecuting,
    createPlan, executePlan, stopExecution, dismissPlan,
    updateTaskDetails, addTaskToPlan, removeTaskFromPlan, reorderTasksInPlan, retryTask,
    plans, pendingToolApproval, approveAgentTool,
    clarificationQuestions, setClarificationQuestions,
    skipClarificationQuestions, submitClarificationAnswers,
  } = useAgent();
  const { allFilePaths, currentProject } = useProject();
  const {
    settings,
    updateSettings,
    customSubAgents,
    setShowSubAgentStudioModal,
    freePoolState,
    setShowFreePoolModal,
    subAgentWorkflow,
    togglePauseSubAgent,
    addSubAgentCronJob,
    toggleSubAgentCronJob,
  } = useApp();

  const [input, setInput] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState<boolean>(false);
  const [fileSearch, setFileSearch] = useState<string>('');
  const [showAtSuggestions, setShowAtSuggestions] = useState<boolean>(false);
  const [atQuery, setAtQuery] = useState<string>('');
  const [agentMode, setAgentModeState] = useState<boolean>(Boolean(settings?.agentMode));
  const [showWorkflowGraphCard, setShowWorkflowGraphCard] = useState<boolean>(false);
  const [workflowChangeRequest, setWorkflowChangeRequest] = useState<string>('');
  const [cronNameInput, setCronNameInput] = useState<string>('');
  const [cronTargetSlug, setCronTargetSlug] = useState<string>('auditor');
  const [cronScheduleInput, setCronScheduleInput] = useState<string>('on_finish:developer');
  const [cronTaskInput, setCronTaskInput] = useState<string>('Audit modified files and verify rules in .agents/auditor/STATUS.md');

  const setAgentMode = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setAgentModeState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      updateSettings({ agentMode: next });
      return next;
    });
  }, [updateSettings]);

  useEffect(() => {
    setAgentModeState(Boolean(settings?.agentMode));
  }, [settings?.agentMode]);

  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const breatheAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const agentBadgeAnim = useRef(new Animated.Value(1)).current;
  const breatheAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);

  const visibleMessages = useMemo(
    () => (messages ?? []).filter(m => m && m.role !== 'tool'),
    [messages]
  );

  const completedPlans = useMemo(
    () => (plans ?? []).filter(p => (p.status === 'completed' || p.status === 'error') && p.id !== activePlan?.id),
    [plans, activePlan]
  );

  const filteredPaths = useMemo(() => {
    const paths = allFilePaths ?? [];
    if (!fileSearch.trim()) return paths.slice(0, 50);
    const q = fileSearch.toLowerCase();
    return paths.filter(p => p?.toLowerCase()?.includes(q)).slice(0, 50);
  }, [allFilePaths, fileSearch]);

  const atFilteredPaths = useMemo(() => {
    const paths = allFilePaths ?? [];
    if (!atQuery) return paths.slice(0, 8);
    const q = atQuery.toLowerCase();
    return paths.filter(p => p?.toLowerCase()?.includes(q)).slice(0, 8);
  }, [allFilePaths, atQuery]);

  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    const atMatch = text.match(/@(\S*)$/);
    if (atMatch) {
      setShowAtSuggestions(true);
      setAtQuery(atMatch[1]);
    } else {
      setShowAtSuggestions(false);
      setAtQuery('');
    }
  }, []);

  const handleAtSelect = useCallback((path: string) => {
    setInput(prev => prev.replace(/@\S*$/, ''));
    setAttachedFiles(prev => {
      if (prev.includes(path)) return prev;
      return [...prev, path];
    });
    setShowAtSuggestions(false);
    setAtQuery('');
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    const textToSend = input.trim();
    const filesToSend = [...attachedFiles];
    setInput('');
    setAttachedFiles([]);
    setShowAtSuggestions(false);
    setShowAttachMenu(false);
    Keyboard.dismiss();

    if (agentMode) {
      await createPlan(textToSend);
    } else {
      sendMessage(textToSend, filesToSend);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [input, attachedFiles, sendMessage, agentMode, createPlan]);

  const handleAttachFile = useCallback((path: string) => {
    setAttachedFiles(prev => {
      if (prev.includes(path)) return prev;
      return [...prev, path];
    });
    setShowFilePicker(false);
    setFileSearch('');
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachedFiles(prev => prev.filter(p => p !== path));
  }, []);

  const handleExecutePlan = useCallback(() => {
    if (activePlan) executePlan(activePlan.id);
  }, [activePlan, executePlan]);

  const handleDismissPlan = useCallback(() => {
    if (activePlan) dismissPlan(activePlan.id);
  }, [activePlan, dismissPlan]);

  const handleUpdateTask = useCallback((taskId: string, title: string, desc: string) => {
    if (activePlan) updateTaskDetails(activePlan.id, taskId, title, desc);
  }, [activePlan, updateTaskDetails]);

  const handleRemoveTask = useCallback((taskId: string) => {
    if (activePlan) removeTaskFromPlan(activePlan.id, taskId);
  }, [activePlan, removeTaskFromPlan]);

  const handleAddTask = useCallback((title: string, desc: string, taskType?: any) => {
    if (activePlan) addTaskToPlan(activePlan.id, title, desc, taskType);
  }, [activePlan, addTaskToPlan]);

  const handleRetryTask = useCallback((taskId: string) => {
    if (activePlan) retryTask(activePlan.id, taskId);
  }, [activePlan, retryTask]);

  const handleReorderTasks = useCallback((fromIndex: number, toIndex: number) => {
    if (activePlan) reorderTasksInPlan(activePlan.id, fromIndex, toIndex);
  }, [activePlan, reorderTasksInPlan]);

  const handleSkipQuestions = useCallback(async () => {
    console.log('[Chat] Skipping clarification questions -> executing directly with best-practice assumptions');
    if ((clarificationQuestions && clarificationQuestions.length > 0) || activePlan?.status === 'clarifying') {
      await skipClarificationQuestions(activePlan?.id, true);
    } else if (hasPendingChatQuestions) {
      skipChatClarification();
    } else {
      await skipClarificationQuestions(activePlan?.id, true);
    }
  }, [activePlan?.id, activePlan?.status, clarificationQuestions, hasPendingChatQuestions, skipChatClarification, skipClarificationQuestions]);

  const handleAnswerQuestions = useCallback(async (answers: {question: string; answer: string}[]) => {
    console.log('[Chat] Questions answered:', answers);
    if (!answers || answers.length === 0 || answers.every(a => !a.answer || !a.answer.trim())) {
      await skipClarificationQuestions(activePlan?.id, true);
      return;
    }
    const formattedAnswers = answers
      .map((qa, i) => `${i + 1}. ${qa.question}\n   Antwort: ${qa.answer?.trim() || 'Übersprungen – bitte sinnvollste Best-Practice-Annahme treffen.'}`)
      .join('\n');
    await submitClarificationAnswers(formattedAnswers, activePlan?.id, false);
  }, [activePlan?.id, skipClarificationQuestions, submitClarificationAnswers]);

  const handleOpenFilePicker = useCallback(() => {
    setShowAttachMenu(false);
    setShowFilePicker(true);
  }, []);

  const handleToggleAgentMode = useCallback(() => {
    setAgentMode(p => !p);
    setShowAttachMenu(false);
  }, []);

  const handlePaperclipPress = useCallback(() => {
    setShowAttachMenu(p => !p);
  }, []);


  const renderMessage = useCallback(({ item, index }: { item: ChatMessage, index: number }) => {
    if (!item) return null;
    return (
      <View>
        {index > 0 && index % 5 === 0 && <SponsorBanner />}
        <ChatBubble message={item} />
      </View>
    );
  }, [settings?.hideSponsor]);


  const hasApiKey = useMemo(() => {
    switch (settings?.selectedProvider) {
      case 'rork': return true;
      case 'openai': return !!settings.openaiKey;
      case 'anthropic': return !!settings.anthropicKey;
      case 'gemini': return !!settings.geminiKey;
      case 'groq': return !!settings.groqKey;
      case 'openrouter': return !!settings.openrouterKey;
      case 'nvidia': return !!settings.nvidiaKey;
      case 'custom': return !!settings.customKey;
      default: return false;
    }
  }, [settings]);

  useEffect(() => {
    if (visibleMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [visibleMessages.length]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const isBusy = isLoading || isPlanning || isExecuting;
  const hasAttachments = attachedFiles.length > 0;

  useEffect(() => {
    const shouldHide = isBusy || hasAttachments || keyboardVisible;
    Animated.timing(agentBadgeAnim, {
      toValue: shouldHide ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isBusy, hasAttachments, keyboardVisible, agentBadgeAnim]);

  const handlePaperclipPressFixed = useCallback(() => {
    if (keyboardVisible) {
      Keyboard.dismiss();
      setTimeout(() => setShowAttachMenu(p => !p), 150);
    } else {
      setShowAttachMenu(p => !p);
    }
  }, [keyboardVisible]);

  useEffect(() => {
    if (isBusy) {
      breatheAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
          Animated.timing(breatheAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
        ])
      );
      breatheAnimRef.current.start();
    } else {
      breatheAnimRef.current?.stop();
      Animated.timing(breatheAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
    return () => { breatheAnimRef.current?.stop(); };
  }, [isBusy, breatheAnim]);

  useEffect(() => {
    if (hasAttachments && !isBusy) {
      glowAnimRef.current = Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 400, useNativeDriver: false }),
      ]);
      glowAnimRef.current.start();
    } else if (!hasAttachments) {
      glowAnimRef.current?.stop();
      Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
    return () => { glowAnimRef.current?.stop(); };
  }, [hasAttachments, isBusy, glowAnim]);

  const borderColor = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [IDE.border, isPlanning ? IDE.accent : IDE.primary],
  });

  const glowBorderColor = glowAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [IDE.border, IDE.primary + '60', IDE.primary],
  });

  const activeBorderColor = isBusy ? borderColor : (hasAttachments ? glowBorderColor : IDE.border);
  const showAgentBadge = agentMode;

  const showEmptyState = visibleMessages.length === 0 && !activePlan && completedPlans.length === 0;
  const showPlanOnly = activePlan && visibleMessages.length === 0 && completedPlans.length === 0;

  const contextSuggestions = useMemo(() => {
    if (!currentProject) {
      return [
        { text: 'Create a new project for me', icon: <FolderOpen size={14} color={IDE.muted} />, agent: false },
        { text: 'Explain how I should start', icon: <Lightbulb size={14} color={IDE.warning} />, agent: false },
        { text: 'Which programming languages do you support?', icon: <Code size={14} color={IDE.primary} />, agent: false },
        { text: 'Help me with a code idea', icon: <Sparkles size={14} color={IDE.keyword} />, agent: false },
      ];
    }
    const paths = allFilePaths ?? [];
    if (paths.length === 0) {
      return [
        { text: 'Create the basic structure for my project', icon: <FolderOpen size={14} color={IDE.accent} />, agent: true },
        { text: 'What should I create first?', icon: <Lightbulb size={14} color={IDE.warning} />, agent: false },
        { text: 'Create a README.md', icon: <FileText size={14} color={IDE.primary} />, agent: false },
      ];
    }
    return [
      { text: 'Show me the project structure', icon: <Search size={14} color={IDE.muted} />, agent: false },
      { text: 'Analyze my project and suggest improvements', icon: <PenTool size={14} color={IDE.primary} />, agent: true },
      { text: 'Finde alle TODO-Kommentare', icon: <Search size={14} color={IDE.warning} />, agent: false },
      { text: 'Explain the code', icon: <Code size={14} color={IDE.keyword} />, agent: false },
    ];
  }, [currentProject, allFilePaths]);

  const planComponent = activePlan ? (
    <AgentPlanView
      plan={activePlan}
      isExecuting={isExecuting}
      onExecute={handleExecutePlan}
      onStop={stopExecution}
      onDismiss={handleDismissPlan}
      onUpdateTask={handleUpdateTask}
      onRemoveTask={handleRemoveTask}
      onAddTask={handleAddTask}
      onRetryTask={handleRetryTask}
      onReorderTasks={handleReorderTasks}
      clarificationQuestions={clarificationQuestions || []}
      onAnswerQuestions={handleAnswerQuestions}
      onSkipQuestions={handleSkipQuestions}
    />
  ) : null;

  const completedPlanComponents = completedPlans.map(p => (
    <AgentPlanView
      key={p.id}
      plan={p}
      isExecuting={false}
      onExecute={() => {}}
      onStop={() => {}}
      onDismiss={() => dismissPlan(p.id)}
      onUpdateTask={() => {}}
      onRemoveTask={() => {}}
      onAddTask={() => {}}
      onRetryTask={() => {}}
    />
  ));

  const workflowGraphBanner = showWorkflowGraphCard ? (
    <View
      style={{
        marginHorizontal: 12,
        marginTop: 10,
        marginBottom: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: IDE.surface,
        borderWidth: 1,
        borderColor: IDE.primary + '55',
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Brain size={15} color={IDE.accent} />
          <Text style={{ fontSize: 13, fontWeight: '800', color: IDE.text }}>
            Dev0 Sub-Agent Workflow & Cron Graph (.agents/)
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowWorkflowGraphCard(false)}>
          <X size={15} color={IDE.muted} />
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 11, color: IDE.textSecondary }}>
        Dev0 orchestrates isolated Sub-Agents with hidden English docs (.agents/&lt;slug&gt;/README.md, RULES.md, STATUS.md, LOG.md), finish_task triggers, and Cron schedules.
      </Text>

      {/* Visual Dev0 -> Sub-Agent Nodes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {subAgentWorkflow.nodes.map((node) => {
          const isRunning = node.status === 'running';
          const isSleeping = node.status === 'sleeping';
          const isCompleted = node.status === 'completed';
          const statusColor = isRunning
            ? IDE.accent
            : isSleeping
              ? IDE.warning
              : isCompleted
                ? IDE.primary
                : IDE.muted;
          return (
            <View
              key={node.id}
              style={{
                width: 195,
                padding: 10,
                borderRadius: 10,
                backgroundColor: IDE.bg,
                borderWidth: 1,
                borderColor: statusColor + '65',
                gap: 5,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: IDE.text }} numberOfLines={1}>
                  {node.name}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 5,
                    backgroundColor: statusColor + '22',
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '800', color: statusColor }}>
                    {node.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, color: IDE.primary, fontFamily: 'monospace' }}>
                {node.workspaceDir}/STATUS.md
              </Text>
              <Text style={{ fontSize: 10, color: IDE.textSecondary }} numberOfLines={2}>
                {node.lastSummary || node.currentTask || `Role: ${node.role}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => togglePauseSubAgent(node.slug, 'Toggled from Dev0 Workflow Card')}
                  style={{
                    flex: 1,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: isSleeping ? IDE.accent + '22' : IDE.warning + '22',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: isSleeping ? IDE.accent : IDE.warning,
                    }}
                  >
                    {isSleeping ? 'Wake Up' : 'Sleep / Pause'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    sendMessage(
                      `Inspect .agents/${node.slug}/ workspace using inspect_subagent_workspace and run ${node.role} Sub-Agent if needed.`,
                    )
                  }
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: IDE.primary + '22',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: IDE.primary }}>
                    Inspect
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Active Cron Jobs */}
      <View
        style={{
          padding: 9,
          borderRadius: 8,
          backgroundColor: IDE.bg,
          borderWidth: 1,
          borderColor: IDE.border,
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: IDE.text }}>
          Sub-Agent Cron Jobs & Event Triggers ({subAgentWorkflow.cronJobs.length})
        </Text>
        {subAgentWorkflow.cronJobs.map((cj) => (
          <View
            key={cj.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 4,
              borderBottomWidth: 1,
              borderBottomColor: IDE.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: IDE.text }}>
                {cj.name} → <Text style={{ color: IDE.accent }}>.agents/{cj.targetSubAgentSlug}/</Text>
              </Text>
              <Text style={{ fontSize: 10, color: IDE.muted }}>
                Schedule: {cj.scheduleExpression} • Runs: {cj.runCount}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleSubAgentCronJob(cj.id)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: cj.enabled ? IDE.accent + '22' : IDE.surface,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: cj.enabled ? IDE.accent : IDE.muted }}>
                {cj.enabled ? 'ACTIVE' : 'PAUSED'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Quick Add Cron Job Row */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: IDE.surface,
              borderWidth: 1,
              borderColor: IDE.border,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 5,
              color: IDE.text,
              fontSize: 11,
            }}
            value={cronNameInput}
            onChangeText={setCronNameInput}
            placeholder="New Cron name (e.g. Audit on finish)"
            placeholderTextColor={IDE.muted}
          />
          <TextInput
            style={{
              width: 115,
              backgroundColor: IDE.surface,
              borderWidth: 1,
              borderColor: IDE.border,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 5,
              color: IDE.text,
              fontSize: 11,
            }}
            value={cronScheduleInput}
            onChangeText={setCronScheduleInput}
            placeholder="on_finish:developer"
            placeholderTextColor={IDE.muted}
          />
          <TouchableOpacity
            onPress={() => {
              if (!cronNameInput.trim()) return;
              addSubAgentCronJob({
                name: cronNameInput.trim(),
                targetSubAgentSlug: cronTargetSlug || 'auditor',
                targetRole: cronTargetSlug || 'auditor',
                scheduleExpression: cronScheduleInput.trim() || 'on_finish:developer',
                triggerOnFinishOf: cronScheduleInput.startsWith('on_finish:')
                  ? cronScheduleInput.replace('on_finish:', '').trim()
                  : undefined,
                taskInstruction: cronTaskInput,
                createdBy: 'user',
              });
              setCronNameInput('');
            }}
            style={{
              paddingHorizontal: 10,
              justifyContent: 'center',
              borderRadius: 6,
              backgroundColor: IDE.accent,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#000' }}>+ Cron</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Request Changes / Adjust Workflow directly to Dev0 */}
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: IDE.bg,
            borderWidth: 1,
            borderColor: IDE.border,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 7,
            color: IDE.text,
            fontSize: 11,
          }}
          value={workflowChangeRequest}
          onChangeText={setWorkflowChangeRequest}
          placeholder="Request workflow/Sub-Agent changes from Dev0 (e.g. 'Add a Tester cron after Developer finishes')..."
          placeholderTextColor={IDE.muted}
        />
        <TouchableOpacity
          onPress={() => {
            if (!workflowChangeRequest.trim()) return;
            const reqText = workflowChangeRequest.trim();
            setWorkflowChangeRequest('');
            sendMessage(
              `[Dev0 Sub-Agent Workflow Change Request]\n${reqText}\nUpdate the relevant .agents/<slug>/ files or Cron jobs and call finish_task when done.`,
            );
          }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: IDE.primary,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>Send to Dev0</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 80}
    >
      {/* Guest Sign-In Reminder Banner */}
      {!freePoolState.isAuthenticatedGoogle && (
        <TouchableOpacity
          onPress={() => setShowFreePoolModal(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: IDE.warning + '18',
            borderBottomWidth: 1,
            borderBottomColor: IDE.warning + '45',
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 11, color: IDE.text, flex: 1 }}>
            🔒 Sandbox Guest Mode — Sign in with Google in <Text style={{ fontWeight: '800', color: IDE.warning }}>AI for Free</Text> to persist projects & use shared pool keys.
          </Text>
          <ChevronRight size={14} color={IDE.warning} />
        </TouchableOpacity>
      )}

      {workflowGraphBanner}

      {showEmptyState ? (
        <ScrollView
          style={styles.emptyScroll}
          contentContainerStyle={styles.emptyState}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.emptyIcon}>
            <Sparkles size={32} color={IDE.primary} />
          </View>
          <Text style={styles.emptyTitle}>Dev0 • AI Orchestrator</Text>
          <Text style={styles.emptySubtitle}>
            {currentProject
              ? 'Isolated Sandbox: "' + currentProject.name + '".\nAsk Dev0 anything or coordinate Sub-Agents (.agents/)!'
              : 'Create an isolated sandbox project in the Projects tab first.'}
          </Text>
          {!hasApiKey && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                ⚠️ No API key configured.{"\n"}
                Go to Settings → AI for Free or API Keys.{"\n\n"}
                💡 Choose &quot;Studio AI ★ Free&quot; or &quot;AI for Free&quot; Pool!
              </Text>
            </View>
          )}

          <View style={styles.modeInfo}>
            <TouchableOpacity
              style={[styles.modeInfoItem, !agentMode && styles.modeInfoItemActive]}
              onPress={() => setAgentMode(false)}
              activeOpacity={0.7}
            >
              <MessageSquare size={16} color={!agentMode ? IDE.primary : IDE.muted} />
              <View style={styles.modeInfoText}>
                <Text style={[styles.modeInfoTitle, !agentMode && { color: IDE.primary }]}>Dev0 Chat Mode</Text>
                <Text style={styles.modeInfoDesc}>Direct dialog + .agents/ Sub-Agents & Cron</Text>
              </View>
              {!agentMode && <View style={styles.modeActiveIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeInfoItem, agentMode && styles.modeInfoItemActive]}
              onPress={() => setAgentMode(true)}
              activeOpacity={0.7}
            >
              <Brain size={16} color={agentMode ? IDE.accent : IDE.muted} />
              <View style={styles.modeInfoText}>
                <Text style={[styles.modeInfoTitle, agentMode && { color: IDE.accent }]}>Dev0 Planner Mode</Text>
                <Text style={styles.modeInfoDesc}>Dev0 plans, Sub-Agents execute step-by-step</Text>
              </View>
              {agentMode && <View style={[styles.modeActiveIndicator, { backgroundColor: IDE.accent }]} />}
            </TouchableOpacity>
          </View>

          <View style={styles.suggestionList}>
            {contextSuggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestion}
                onPress={() => { setInput(s.text); if (s.agent) setAgentMode(true); }}
                activeOpacity={0.7}
              >
                {s.icon}
                <Text style={styles.suggestionText}>{s.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : showPlanOnly ? (
        <ScrollView
          style={styles.planOnlyScroll}
          contentContainerStyle={styles.planOnlyContent}
          keyboardShouldPersistTaps="handled"
        >
          {planComponent}
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          renderItem={renderMessage}
          keyExtractor={item => item?.id ?? Math.random().toString()}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          ListHeaderComponent={
            <View>
              {completedPlanComponents}
              {activePlan ? planComponent : null}
            </View>
          }
          ListFooterComponent={
            isThinking ? (
              <View style={styles.thinkingContainer}>
                <ThinkingBlock thinking={thinkingPhase || ''} isLive phase={thinkingPhase} />
              </View>
            ) : null
          }
        />
      )}

      {showAttachMenu && !keyboardVisible && (
        <TouchableOpacity
          style={styles.attachMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <View style={styles.attachMenu}>
            <TouchableOpacity
              style={styles.attachMenuItem}
              onPress={handleOpenFilePicker}
              activeOpacity={0.7}
            >
              <FileText size={16} color={IDE.primary} />
              <Text style={styles.attachMenuText}>Attach file</Text>
            </TouchableOpacity>
            <View style={styles.attachMenuDivider} />
            <TouchableOpacity
              style={styles.attachMenuItem}
              onPress={handleToggleAgentMode}
              activeOpacity={0.7}
            >
              <Brain size={16} color={agentMode ? IDE.accent : IDE.muted} />
              <Text style={[styles.attachMenuText, agentMode && { color: IDE.accent }]}>
                {agentMode ? 'Disable Agent Mode' : 'Agent Mode (Planning)'}
              </Text>
              {agentMode && (
                <View style={styles.attachMenuActiveBadge}>
                  <Text style={styles.attachMenuActiveBadgeText}>ON</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.attachMenuDivider} />
            <TouchableOpacity
              style={styles.attachMenuItem}
              onPress={() => {
                setShowAttachMenu(false);
                router.push({ pathname: '/(tabs)/tools', params: { tab: 'dashboard' } } as any);
              }}
              activeOpacity={0.7}
            >
              <LayoutDashboard size={16} color={IDE.primary} />
              <Text style={styles.attachMenuText}>Agent Dashboard</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {showAtSuggestions && atFilteredPaths.length > 0 && (
        <View style={styles.atSuggestions}>
          {atFilteredPaths.map(path => (
            <TouchableOpacity
              key={path}
              style={styles.atSuggestionItem}
              onPress={() => handleAtSelect(path)}
              activeOpacity={0.7}
            >
              <FileText size={12} color={IDE.primary} />
              <Text style={styles.atSuggestionText} numberOfLines={1}>{path}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {attachedFiles.length > 0 && (
        <View style={styles.attachments}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {attachedFiles.map(path => (
              <View key={path} style={styles.attachChip}>
                <FileText size={12} color={IDE.primary} />
                <Text style={styles.attachChipText} numberOfLines={1}>
                  {path?.split('/')?.pop() ?? path}
                </Text>
                <TouchableOpacity onPress={() => removeAttachment(path)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={12} color={IDE.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {lastFallbackInfo && (
        <View style={styles.fallbackBanner}>
          <Info size={12} color={IDE.warning} />
          <Text style={styles.fallbackText}>{lastFallbackInfo}</Text>
        </View>
      )}

      {(pendingApproval || pendingToolApproval) && (
        <View style={styles.approvalBanner}>
          <View style={styles.approvalHeader}>
            <ShieldAlert size={16} color={IDE.warning} />
            <Text style={styles.approvalTitle}>Tool Approval Required</Text>
          </View>
          <View style={styles.approvalBody}>
            <Text style={styles.approvalToolName}>
              {(pendingApproval || pendingToolApproval)?.toolDisplayName}
            </Text>
            <Text style={styles.approvalArgs} numberOfLines={3}>
              {JSON.stringify((pendingApproval || pendingToolApproval)?.arguments ?? {}, null, 0).slice(0, 200)}
            </Text>
          </View>
          <View style={styles.approvalActions}>
            <TouchableOpacity
              style={styles.approvalRejectBtn}
              onPress={() => {
                if (pendingApproval) approvePendingTool(false);
                if (pendingToolApproval) approveAgentTool(false);
              }}
              activeOpacity={0.7}
            >
              <Ban size={14} color={IDE.danger} />
              <Text style={styles.approvalRejectText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.approvalAcceptBtn}
              onPress={() => {
                if (pendingApproval) approvePendingTool(true);
                if (pendingToolApproval) approveAgentTool(true);
              }}
              activeOpacity={0.7}
            >
              <Check size={14} color="#fff" />
              <Text style={styles.approvalAcceptText}>Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {((clarificationQuestions && clarificationQuestions.length > 0) || activePlan?.status === 'clarifying' || hasPendingChatQuestions) && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: IDE.surface,
          borderTopWidth: 1,
          borderTopColor: IDE.accent + '60',
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
          zIndex: 9999,
          elevation: 20,
        }} pointerEvents="auto">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <MessageSquare size={15} color={IDE.warning} />
            <Text style={{ fontSize: 12, color: IDE.text, fontWeight: '600', flex: 1 }} numberOfLines={2}>
              KI-Rückfragen offen ({pendingSubAgentQuestion?.questions?.length || clarificationQuestions?.length || 1})
            </Text>
          </View>
          {pendingSubAgentQuestion && (
            <TouchableOpacity
              onPress={() => openSubAgentFloatingLauncher({
                role: pendingSubAgentQuestion.subAgentRole,
                name: pendingSubAgentQuestion.subAgentName,
                task: pendingSubAgentQuestion.suggestedTask,
                questions: pendingSubAgentQuestion.questions.map(q => q.question),
              })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: IDE.primary,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 8,
              }}
              activeOpacity={0.75}
            >
              <Brain size={13} color="#fff" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
                Floating Fenster
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleSkipQuestions}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: IDE.accent,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              zIndex: 9999,
              elevation: 20,
            }}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Zap size={13} color="#fff" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
              Überspringen & Direkt starten (Skip)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {(isLoading || isPlanning) && !isThinking && !pendingApproval && !pendingToolApproval && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={isPlanning ? IDE.accent : IDE.primary} />
          <Text style={styles.loadingText}>
            {isPlanning ? 'Main agent planning tasks...' : settings?.selectedProvider === 'rork' ? 'Studio AI processing...' : 'AI processing...'}
          </Text>
        </View>
      )}

      {/* Saved Sub-Agents Quick List Bar */}
      {!keyboardVisible && customSubAgents && customSubAgents.length > 0 && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: IDE.bg,
          borderTopWidth: 1,
          borderTopColor: IDE.border,
          paddingHorizontal: 10,
          paddingVertical: 5,
          gap: 6,
        }}>
          <TouchableOpacity
            onPress={() => setShowSubAgentStudioModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: IDE.primary + '18',
              borderWidth: 1,
              borderColor: IDE.primary + '45',
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
            }}
            activeOpacity={0.75}
          >
            <Brain size={11} color={IDE.primary} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: IDE.primary }}>
              Sub-Agents ({customSubAgents.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowWorkflowGraphCard(prev => !prev)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: showWorkflowGraphCard ? IDE.accent + '25' : IDE.surface,
              borderWidth: 1,
              borderColor: showWorkflowGraphCard ? IDE.accent : IDE.border,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
            }}
            activeOpacity={0.75}
          >
            <Zap size={10} color={IDE.accent} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: showWorkflowGraphCard ? IDE.accent : IDE.textSecondary }}>
              Workflow & Cron ({subAgentWorkflow.cronJobs.length})
            </Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
            {customSubAgents.map(tpl => (
              <TouchableOpacity
                key={tpl.id}
                onPress={() =>
                  openSubAgentFloatingLauncher({
                    role: tpl.role,
                    name: tpl.name,
                    task: tpl.description,
                    questions: [
                      `Welche Aufgabe soll der gespeicherte Sub-Agent "${tpl.name}" (${tpl.role}) für den Main-Ersteller ausführen?`,
                    ],
                  })
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: IDE.surface,
                  borderWidth: 1,
                  borderColor: IDE.border,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                }}
                activeOpacity={0.75}
              >
                <Sparkles size={10} color={IDE.accent} />
                <Text style={{ fontSize: 10, fontWeight: '600', color: IDE.text }} numberOfLines={1}>
                  {tpl.name}
                </Text>
                <Text style={{ fontSize: 9, color: IDE.muted }}>
                  ({tpl.role})
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => openSubAgentFloatingLauncher()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: IDE.accent + '18',
                borderWidth: 1,
                borderColor: IDE.accent + '45',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: IDE.accent }}>
                + Sub-Agent starten
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {showAgentBadge && (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(tabs)/tools', params: { tab: 'dashboard' } } as any)}
          activeOpacity={0.7}
        >
          <Animated.View style={[styles.agentModeBadgeRow, { opacity: agentBadgeAnim, transform: [{ translateY: agentBadgeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]} pointerEvents={isBusy || hasAttachments || keyboardVisible ? 'none' : 'auto'}>
            <Brain size={10} color={IDE.accent} />
            <Text style={styles.agentModeBadgeText}>AGENT</Text>
            <Text style={[styles.agentModeBadgeText, { opacity: 0.6, fontSize: 9, marginLeft: 4 }]}>• Dashboard</Text>
          </Animated.View>
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.inputBar, { borderTopColor: activeBorderColor, borderTopWidth: isBusy || hasAttachments ? 2 : 1 }]}>
        <TouchableOpacity
          style={[styles.attachBtn, showAttachMenu && styles.attachBtnActive]}
          onPress={handlePaperclipPressFixed}
          activeOpacity={0.7}
        >
          <Paperclip size={18} color={showAttachMenu ? IDE.primary : IDE.muted} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder={agentMode ? 'Describe goal... (@ for files)' : 'Ask AI... (@ for files)'}
          placeholderTextColor={IDE.muted}
          value={input}
          onChangeText={handleInputChange}
          multiline
          maxLength={10000}
          editable={!isBusy}
          onFocus={() => setShowAttachMenu(false)}
          onKeyPress={(e: any) => {
            if (Platform.OS === 'web') {
              if (e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
                e.preventDefault?.();
                if ((input.trim() || attachedFiles.length > 0) && !isBusy) {
                  handleSend();
                }
              }
            }
          }}
          onSubmitEditing={() => {
            if (Platform.OS === 'web' && (input.trim() || attachedFiles.length > 0) && !isBusy) {
              handleSend();
            }
          }}
          blurOnSubmit={false}
        />

        {isBusy ? (
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={isExecuting ? stopExecution : stopGeneration}
            activeOpacity={0.7}
          >
            <Square size={16} color={IDE.danger} fill={IDE.danger} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() && attachedFiles.length === 0) && styles.sendBtnDisabled,
              agentMode && input.trim().length > 0 && styles.sendBtnAgent]}
            onPress={handleSend}
            disabled={!input.trim() && attachedFiles.length === 0}
            activeOpacity={0.7}
          >
            {agentMode ? (
              <Zap size={16} color={input.trim() || attachedFiles.length > 0 ? '#fff' : IDE.muted} />
            ) : (
              <Send size={16} color={input.trim() || attachedFiles.length > 0 ? '#fff' : IDE.muted} />
            )}
          </TouchableOpacity>
        )}
      </Animated.View>

      <Modal visible={showFilePicker} transparent animationType="slide">
        <View style={fpStyles.overlay}>
          <TouchableOpacity
            style={fpStyles.backdrop}
            activeOpacity={1}
            onPress={() => { setShowFilePicker(false); setFileSearch(''); }}
          />
          <View style={fpStyles.container}>
            <View style={fpStyles.header}>
              <Text style={fpStyles.title}>Attach file (@)</Text>
              <TouchableOpacity onPress={() => { setShowFilePicker(false); setFileSearch(''); }}>
                <X size={20} color={IDE.muted} />
              </TouchableOpacity>
            </View>
            <View style={fpStyles.searchBar}>
              <TextInput
                style={fpStyles.searchInput}
                placeholder="Search file..."
                placeholderTextColor={IDE.muted}
                value={fileSearch}
                onChangeText={setFileSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredPaths}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[fpStyles.fileItem, attachedFiles.includes(item) && fpStyles.fileItemActive]}
                  onPress={() => handleAttachFile(item)}
                  activeOpacity={0.7}
                >
                  <FileText size={14} color={attachedFiles.includes(item) ? IDE.primary : IDE.muted} />
                  <Text style={fpStyles.filePath} numberOfLines={1}>{item}</Text>
                </TouchableOpacity>
              )}
              style={fpStyles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={fpStyles.emptyText}>No files found</Text>
              }
            />
          </View>
        </View>
      </Modal>

      <SubAgentFloatingQuestionModal
        visible={Boolean(pendingSubAgentQuestion)}
        request={pendingSubAgentQuestion}
        onSubmit={submitSubAgentQuestionResponse}
        onSkip={submitSubAgentQuestionResponse}
        onClose={closeSubAgentQuestionModal}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IDE.bg,
  },
  emptyScroll: {
    flex: 1,
  },
  emptyState: {
    flexGrow: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 32,
    paddingBottom: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: IDE.primary + '20',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: IDE.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: IDE.muted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  warningBanner: {
    backgroundColor: IDE.warning + '15',
    borderWidth: 1,
    borderColor: IDE.warning + '40',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    width: '100%',
  },
  warningText: {
    fontSize: 12,
    color: IDE.warning,
    lineHeight: 18,
  },
  modeInfo: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  modeInfoItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: IDE.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  modeInfoItemActive: {
    borderColor: IDE.primary + '60',
    backgroundColor: IDE.primary + '08',
  },
  modeActiveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IDE.primary,
  },
  modeInfoText: {
    flex: 1,
  },
  modeInfoTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: IDE.text,
  },
  modeInfoDesc: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 1,
  },
  suggestionList: {
    marginTop: 16,
    gap: 8,
    width: '100%',
  },
  suggestion: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  suggestionText: {
    fontSize: 13,
    color: IDE.textSecondary,
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  thinkingContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  planOnlyScroll: {
    flex: 1,
  },
  planOnlyContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  attachMenuOverlay: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end' as const,
    zIndex: 100,
    paddingBottom: 54,
  },
  attachMenu: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  attachMenuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachMenuText: {
    fontSize: 14,
    color: IDE.text,
    flex: 1,
  },
  attachMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IDE.border,
    marginHorizontal: 16,
  },
  attachMenuActiveBadge: {
    backgroundColor: IDE.accent + '25',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attachMenuActiveBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.accent,
    letterSpacing: 0.5,
  },
  atSuggestions: {
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    maxHeight: 200,
  },
  atSuggestionItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IDE.border,
  },
  atSuggestionText: {
    fontSize: 13,
    color: IDE.textSecondary,
    flex: 1,
    fontFamily: 'monospace',
  },
  attachments: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
  },
  attachChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.primary + '20',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  attachChipText: {
    fontSize: 11,
    color: IDE.primary,
    maxWidth: 100,
  },
  fallbackBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: IDE.warning + '15',
    borderTopWidth: 1,
    borderTopColor: IDE.warning + '30',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  fallbackText: {
    fontSize: 11,
    color: IDE.warning,
    flex: 1,
  },
  loadingBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: IDE.muted,
  },
  inputBar: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    padding: 8,
    paddingHorizontal: 10,
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    gap: 6,
  } as any,
  agentModeBadgeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.accent + '15',
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden' as const,
  },
  agentModeBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.accent,
    letterSpacing: 0.5,
  },
  attachBtn: {
    padding: 8,
    marginBottom: 2,
    borderRadius: 8,
  },
  attachBtnActive: {
    backgroundColor: IDE.primary + '15',
  },
  input: {
    flex: 1,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: IDE.text,
    maxHeight: 100,
    minHeight: 36,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IDE.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendBtnDisabled: {
    backgroundColor: IDE.surface,
  },
  sendBtnAgent: {
    backgroundColor: IDE.accent,
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IDE.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: IDE.danger + '40',
  },
  approvalBanner: {
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.warning + '40',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  approvalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  approvalTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: IDE.warning,
  },
  approvalBody: {
    backgroundColor: IDE.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 10,
    marginBottom: 10,
  },
  approvalToolName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: IDE.text,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  approvalArgs: {
    fontSize: 11,
    color: IDE.muted,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  approvalActions: {
    flexDirection: 'row' as const,
    gap: 10,
    justifyContent: 'flex-end' as const,
  },
  approvalRejectBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: IDE.danger + '15',
    borderWidth: 1,
    borderColor: IDE.danger + '30',
  },
  approvalRejectText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: IDE.danger,
  },
  approvalAcceptBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: IDE.accent,
  },
  approvalAcceptText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
});

const fpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end' as const,
  },
  backdrop: {
    flex: 1,
  },
  container: {
    backgroundColor: IDE.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: IDE.border,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: IDE.text,
  },
  searchBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  searchInput: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: IDE.text,
  },
  list: {
    maxHeight: 300,
  },
  fileItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IDE.border,
  },
  fileItemActive: {
    backgroundColor: IDE.primary + '15',
  },
  filePath: {
    fontSize: 13,
    color: IDE.textSecondary,
    flex: 1,
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 13,
    color: IDE.muted,
    textAlign: 'center' as const,
    padding: 20,
  },
});
