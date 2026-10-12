import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, ScrollView,
  Keyboard, Animated, Dimensions,
} from 'react-native';
import {
  Send, Square, Paperclip, X, FileText, Sparkles, Brain, MessageSquare,
  Zap, Info, Trash2, ChevronRight, ShieldAlert, Check, Ban,
  FolderOpen, Code, Search, Lightbulb, PenTool, Heart
} from 'lucide-react-native';
import WebView from 'react-native-webview';
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

export default function ChatScreen() {
  const { messages, isLoading, isThinking, thinkingPhase, sendMessage, stopGeneration, clearChat, lastFallbackInfo, pendingApproval, approvePendingTool } = useChat();
  const {
    activePlan, isPlanning, isExecuting,
    createPlan, executePlan, stopExecution, dismissPlan,
    updateTaskDetails, addTaskToPlan, removeTaskFromPlan, reorderTasksInPlan, retryTask,
    plans, pendingToolApproval, approveAgentTool,
    clarificationQuestions, setClarificationQuestions,
  } = useAgent();
  const { allFilePaths, currentProject } = useProject();
  const { settings } = useApp();

  const [input, setInput] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState<boolean>(false);
  const [fileSearch, setFileSearch] = useState<string>('');
  const [showAtSuggestions, setShowAtSuggestions] = useState<boolean>(false);
  const [atQuery, setAtQuery] = useState<string>('');
  const [agentMode, setAgentMode] = useState<boolean>(false);
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

  const handleAnswerQuestions = useCallback(async (answers: {question: string; answer: string}[]) => {
    console.log('[Chat] Questions answered:', answers);
    // Reset questions to close modal
    setClarificationQuestions([]);
    // Recreate plan with answers as context
    if (activePlan) {
      // User has answered questions, now the final plan is created
      dismissPlan(activePlan.id);
    }
    // Call AI again with answers for final plan
    const enhancedRequest = input + '\n\n## Clarification questions answered:\n' +
      answers.map((qa, i) => `${i + 1}. ${qa.question}\n   Answer: ${qa.answer}`).join('\n');
    await createPlan(enhancedRequest);
  }, [activePlan, dismissPlan, createPlan, setClarificationQuestions, input]);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 80}
    >
      {showEmptyState ? (
        <ScrollView
          style={styles.emptyScroll}
          contentContainerStyle={styles.emptyState}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.emptyIcon}>
            <Sparkles size={32} color={IDE.primary} />
          </View>
          <Text style={styles.emptyTitle}>Studio KI-Assistent</Text>
          <Text style={styles.emptySubtitle}>
            {currentProject
              ? 'Context: "' + currentProject.name + '".\nAsk me anything about your project!'
              : 'Create a project in the Projects tab first.'}
          </Text>
          {!hasApiKey && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                ⚠️ No API key configured.{"\n"}
                Go to Settings → API Keys.{"\n\n"}
                💡 Wähle &quot;Studio KI&quot; als Anbieter für kostenlose Nutzung!
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
                <Text style={[styles.modeInfoTitle, !agentMode && { color: IDE.primary }]}>Chat-Modus</Text>
                <Text style={styles.modeInfoDesc}>Direkter Dialog mit der KI</Text>
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
                <Text style={[styles.modeInfoTitle, agentMode && { color: IDE.accent }]}>Agent-Modus</Text>
                <Text style={styles.modeInfoDesc}>Main agent plans, sub-agents execute</Text>
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

      {(isLoading || isPlanning) && !isThinking && !pendingApproval && !pendingToolApproval && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={isPlanning ? IDE.accent : IDE.primary} />
          <Text style={styles.loadingText}>
            {isPlanning ? 'Main agent planning tasks...' : settings?.selectedProvider === 'rork' ? 'Studio AI processing...' : 'AI processing...'}
          </Text>
        </View>
      )}

      {showAgentBadge && (
        <Animated.View style={[styles.agentModeBadgeRow, { opacity: agentBadgeAnim, transform: [{ translateY: agentBadgeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]} pointerEvents={isBusy || hasAttachments || keyboardVisible ? 'none' : 'auto'}>
          <Brain size={10} color={IDE.accent} />
          <Text style={styles.agentModeBadgeText}>AGENT</Text>
        </Animated.View>
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
