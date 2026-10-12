import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
  Animated, LayoutAnimation, Platform, UIManager, Modal, Pressable, ScrollView,
} from 'react-native';
import {
  Play, Square, Plus, CheckCircle, AlertTriangle, X, Brain,
  ChevronDown, ChevronUp, Zap, Lightbulb, Sparkles, Wrench, Globe,
  ArrowUp, ArrowDown, GripVertical, MessageSquare,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { AgentPlan, AgentTask, AgentTaskType, AgentToolUsage } from '@/types';
import AgentTaskCard from './AgentTaskCard';

interface Props {
  plan: AgentPlan;
  isExecuting: boolean;
  onExecute: () => void;
  onStop: () => void;
  onDismiss: () => void;
  onUpdateTask: (taskId: string, title: string, description: string) => void;
  onRemoveTask: (taskId: string) => void;
  onAddTask: (title: string, description: string, taskType?: AgentTaskType) => void;
  onRetryTask: (taskId: string) => void;
  onReorderTasks?: (fromIndex: number, toIndex: number) => void;
  clarificationQuestions?: ClarificationQuestion[];
  onAnswerQuestions?: (answers: ClarificationQuestion[]) => void;
}

interface SwapModalState {
  visible: boolean;
  fromIndex: number;
  targetIndex: number;
}

interface DeleteConfirmState {
  visible: boolean;
  taskIndex: number;
  taskId: string;
}

interface ClarificationQuestion {
  question: string;
  answer: string;
}

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Read File',
  read_lines: 'Read Lines',
  write_file: 'Write File',
  create_file: 'Create File',
  edit_file: 'Edit File',
  delete_file: 'Delete File',
  rename_file: 'Rename File',
  list_directory: 'List Directory',
  search_files: 'Search Files',
  find_replace: 'Find & Replace',
  create_directory: 'Create Folder',
  get_project_tree: 'Project Tree',
  get_file_info: 'File Info',
  create_todo: 'Create Todo',
  update_todo: 'Update Todo',
  add_memo: 'Add Memo',
  web_search: 'Web Search',
  web_fetch: 'Web Fetch',
  verify_file: 'Verify File',
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AgentPlanView = React.memo(({ plan, isExecuting, onExecute, onStop, onDismiss, onUpdateTask, onRemoveTask, onAddTask, onRetryTask, onReorderTasks, clarificationQuestions, onAnswerQuestions }: Props) => {
  const [showAddTask, setShowAddTask] = useState<boolean>(false);
  const [addType, setAddType] = useState<AgentTaskType>('task');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [toolsSummaryExpanded, setToolsSummaryExpanded] = useState<boolean>(false);
  const [swapModal, setSwapModal] = useState<SwapModalState>({ visible: false, fromIndex: 0, targetIndex: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ visible: false, taskIndex: 0, taskId: '' });
  const [localQuestions, setLocalQuestions] = useState<ClarificationQuestion[]>(clarificationQuestions || []);
  const swapHighlightAnim = useRef(new Animated.Value(0)).current;

  const isEditable = plan?.status === 'review';
  const isRunning = plan?.status === 'executing';
  const isDone = plan?.status === 'completed' || plan?.status === 'error';

  const tasks = plan?.tasks ?? [];
  const totalCount = tasks.length;

  useEffect(() => {
    if (isDone && !collapsed) {
      const timer = setTimeout(() => setCollapsed(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isDone]);

  const stats = useMemo(() => {
    let completed = 0;
    let error = 0;
    let running = 0;
    let pending = 0;
    let thinking = 0;
    let brainstorm = 0;
    let webSearch = 0;
    let subAgent = 0;
    for (const t of tasks) {
      if (t?.status === 'completed') completed++;
      else if (t?.status === 'error') error++;
      else if (t?.status === 'running') running++;
      else if (t?.status === 'pending') pending++;
      const tt = t?.taskType || 'task';
      if (tt === 'thinking') thinking++;
      else if (tt === 'brainstorm') brainstorm++;
      else if (tt === 'web_search') webSearch++;
      else if (tt === 'sub_agent') subAgent++;
    }
    return { completed, error, running, pending, thinking, brainstorm, webSearch, subAgent };
  }, [tasks]);

  const handleAddTask = useCallback(() => {
    if (newTitle.trim()) {
      onAddTask(newTitle.trim(), newDesc.trim(), addType);
      setNewTitle('');
      setNewDesc('');
      setShowAddTask(false);
      setAddType('task');
    }
  }, [newTitle, newDesc, addType, onAddTask]);

  const handleQuickAddBrainstorm = useCallback(() => {
    setAddType('brainstorm');
    setShowAddTask(true);
    setNewTitle('');
    setNewDesc('');
  }, []);

  const handleQuickAddThinking = useCallback(() => {
    setAddType('thinking');
    setShowAddTask(true);
    setNewTitle('');
    setNewDesc('');
  }, []);

  const handleAutoAddBrainstorm = useCallback(() => {
    const autoTitle = 'Intermediate Analysis';
    const autoDesc = 'Automatic review of the progress so far and validation of the approach.';
    onAddTask(autoTitle, autoDesc, 'brainstorm');
  }, [onAddTask]);

  const handleQuickAddWebSearch = useCallback(() => {
    setAddType('web_search');
    setShowAddTask(true);
    setNewTitle('');
    setNewDesc('');
  }, []);

  const handleQuickAddSubAgent = useCallback(() => {
    setAddType('sub_agent');
    setShowAddTask(true);
    setNewTitle('');
    setNewDesc('');
  }, []);

  const handleDeleteConfirm = useCallback((index: number, taskId: string) => {
    setDeleteConfirm({ visible: true, taskIndex: index, taskId });
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm({ visible: false, taskIndex: 0, taskId: '' });
  }, []);

  const handleDeleteExecute = useCallback(() => {
    if (deleteConfirm.taskId) {
      onRemoveTask(deleteConfirm.taskId);
      setDeleteConfirm({ visible: false, taskIndex: 0, taskId: '' });
    }
  }, [deleteConfirm.taskId, onRemoveTask]);

  const handleAnswerQuestion = useCallback((index: number, answer: string) => {
    const updated = [...localQuestions];
    updated[index] = { ...updated[index], answer };
    setLocalQuestions(updated);
  }, [localQuestions]);

  const handleSubmitAnswers = useCallback(() => {
    if (onAnswerQuestions && localQuestions.length > 0) {
      onAnswerQuestions(localQuestions);
    }
  }, [onAnswerQuestions, localQuestions]);

  const handleMoveUp = useCallback((index: number) => {
    if (index > 0 && onReorderTasks) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onReorderTasks(index, index - 1);
    }
  }, [onReorderTasks]);

  const handleMoveDown = useCallback((index: number) => {
    if (index < tasks.length - 1 && onReorderTasks) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onReorderTasks(index, index + 1);
    }
  }, [onReorderTasks, tasks.length]);

  const handleLongPressStart = useCallback((index: number) => {
    if (!isEditable || !onReorderTasks || tasks.length <= 1) return;
    setSwapModal({ visible: true, fromIndex: index, targetIndex: index });
    swapHighlightAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(swapHighlightAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(swapHighlightAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    ).start();
  }, [isEditable, onReorderTasks, tasks.length, swapHighlightAnim]);

  const handleSwapSelect = useCallback((targetIndex: number) => {
    if (swapModal.fromIndex !== targetIndex && onReorderTasks) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onReorderTasks(swapModal.fromIndex, targetIndex);
    }
    setSwapModal({ visible: false, fromIndex: 0, targetIndex: 0 });
    swapHighlightAnim.stopAnimation();
  }, [swapModal.fromIndex, onReorderTasks, swapHighlightAnim]);

  const handleSwapCancel = useCallback(() => {
    setSwapModal({ visible: false, fromIndex: 0, targetIndex: 0 });
    swapHighlightAnim.stopAnimation();
  }, [swapHighlightAnim]);

  const totalToolsUsed = plan?.totalToolsUsed ?? [];
  const totalToolCount = totalToolsUsed.reduce((sum, t) => sum + t.count, 0);

  return (
    <View>
      <View style={styles.container}>
        <TouchableOpacity style={styles.planHeader} onPress={() => setCollapsed(p => !p)} activeOpacity={0.7}>
          <View style={styles.planHeaderLeft}>
            <View style={[
              styles.planIcon,
              isDone && stats.error === 0 && stats.completed === totalCount ? styles.planIconDone :
              isDone && stats.error > 0 ? styles.planIconError :
              isDone ? styles.planIconDone :
              isRunning ? styles.planIconRunning : styles.planIconReview,
            ]}>
              {isRunning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : isDone && stats.error === 0 ? (
                <CheckCircle size={14} color="#fff" />
              ) : isDone && stats.error > 0 ? (
                <AlertTriangle size={14} color="#fff" />
              ) : (
                <Brain size={14} color="#fff" />
              )}
            </View>
            <View style={styles.planHeaderInfo}>
              <Text style={styles.planTitle} numberOfLines={1}>
                {isRunning ? 'Agent working...' : isDone && stats.error === 0 ? 'Task completed' : isDone && stats.error > 0 ? ('Task: ' + stats.error + ' errors, ' + stats.completed + ' successful') : 'Review task plan'}
              </Text>
              <Text style={styles.planSubtitle} numberOfLines={1}>{plan?.userRequest ?? ''}</Text>
            </View>
          </View>
          <View style={styles.planHeaderRight}>
            <View style={[styles.counterBadge, stats.error > 0 && styles.counterBadgeError, isDone && stats.error === 0 && styles.counterBadgeSuccess]}>
              <Text style={[styles.counterText, stats.error > 0 && styles.counterTextError, isDone && stats.error === 0 && styles.counterTextSuccess]}>
                {stats.error > 0 ? (stats.completed + '/' + totalCount + ' · ' + stats.error + '✗') : (stats.completed + '/' + totalCount)}
              </Text>
            </View>
            {collapsed ? <ChevronDown size={16} color={IDE.muted} /> : <ChevronUp size={16} color={IDE.muted} />}
          </View>
        </TouchableOpacity>

        {!collapsed && (
          <View style={styles.planBody}>
            {(isRunning || isDone) && totalCount > 0 && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { flex: totalCount > 0 ? stats.completed / totalCount : 0 }]} />
                  {stats.error > 0 && (
                    <View style={[styles.progressError, { flex: stats.error / totalCount }]} />
                  )}
                </View>
                <View style={styles.statsRow}>
                  {stats.completed > 0 && (
                    <View style={styles.statItem}>
                      <View style={[styles.statDot, { backgroundColor: IDE.accent }]} />
                      <Text style={styles.statText}>{stats.completed} done</Text>
                    </View>
                  )}
                  {stats.running > 0 && (
                    <View style={styles.statItem}>
                      <View style={[styles.statDot, { backgroundColor: IDE.primary }]} />
                      <Text style={styles.statText}>{stats.running} aktiv</Text>
                    </View>
                  )}
                  {stats.pending > 0 && (
                    <View style={styles.statItem}>
                      <View style={[styles.statDot, { backgroundColor: IDE.warning }]} />
                      <Text style={styles.statText}>{stats.pending} wartend</Text>
                    </View>
                  )}
                  {stats.error > 0 && (
                    <View style={styles.statItem}>
                      <View style={[styles.statDot, { backgroundColor: IDE.danger }]} />
                      <Text style={styles.statText}>{stats.error} failed</Text>
                    </View>
                  )}
                  {stats.thinking > 0 && (
                    <View style={styles.statItem}>
                      <View style={[styles.statDot, { backgroundColor: IDE.keyword }]} />
                      <Text style={styles.statText}>{stats.thinking} Analyse</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {isDone && stats.error > 0 && (
              <View style={styles.errorBanner}>
                <AlertTriangle size={14} color={IDE.danger} />
                <View style={styles.errorBannerContent}>
                  <Text style={styles.errorBannerText}>{stats.error} Task(s) failed</Text>
                  <Text style={styles.errorBannerHint}>Tap a failed task to retry</Text>
                </View>
              </View>
            )}

            {isDone && stats.completed > 0 && stats.completed === totalCount && stats.error === 0 && (
              <View style={styles.successBanner}>
                <CheckCircle size={14} color={IDE.accent} />
                <Text style={styles.successBannerText}>All {totalCount} steps completed successfully</Text>
              </View>
            )}

            <View style={styles.taskList}>
              {tasks.map((task, i) => task ? (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={i}
                  totalCount={totalCount}
                  isEditable={isEditable}
                  canReorder={!!(isEditable && onReorderTasks && tasks.length > 1)}
                  onUpdateTask={onUpdateTask}
                  onRemoveTask={onRemoveTask}
                  onRetryTask={onRetryTask}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onLongPress={handleLongPressStart}
                  onDeleteConfirm={handleDeleteConfirm}
                />
              ) : null)}
            </View>

            {isEditable && showAddTask && (
              <View style={styles.addTaskForm}>
                <View style={styles.addTypeRow}>
                  {(['task', 'thinking', 'brainstorm', 'web_search', 'sub_agent'] as AgentTaskType[]).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.addTypeBtn, addType === type && styles.addTypeBtnActive]}
                      onPress={() => setAddType(type)}
                      activeOpacity={0.7}
                    >
                      {type === 'thinking' ? <Brain size={12} color={addType === type ? IDE.keyword : IDE.muted} /> :
                       type === 'brainstorm' ? <Lightbulb size={12} color={addType === type ? IDE.warning : IDE.muted} /> :
                       type === 'web_search' ? <Globe size={12} color={addType === type ? '#2196F3' : IDE.muted} /> :
                       type === 'sub_agent' ? <Zap size={12} color={addType === type ? IDE.accent : IDE.muted} /> :
                       <Play size={12} color={addType === type ? IDE.primary : IDE.muted} />}
                      <Text style={[styles.addTypeBtnText, addType === type && {
                        color: type === 'thinking' ? IDE.keyword : type === 'brainstorm' ? IDE.warning : type === 'web_search' ? '#2196F3' : type === 'sub_agent' ? IDE.accent : IDE.primary,
                        fontWeight: '700' as const,
                      }]}>
                        {type === 'thinking' ? 'Analyse' : type === 'brainstorm' ? 'Brainstorm' : type === 'web_search' ? 'Web' : type === 'sub_agent' ? 'Agent' : 'Task'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.addInput}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder={addType === 'thinking' ? 'What to analyze...' : addType === 'brainstorm' ? 'What to brainstorm...' : 'Task Title...'}
                  placeholderTextColor={IDE.muted}
                  autoFocus
                />
                <TextInput
                  style={[styles.addInput, styles.addInputMulti]}
                  value={newDesc}
                  onChangeText={setNewDesc}
                  placeholder="Beschreibung..."
                  placeholderTextColor={IDE.muted}
                  multiline
                />
                <View style={styles.addTaskActions}>
                  <TouchableOpacity onPress={handleAddTask} style={styles.addConfirmBtn}>
                    <Plus size={14} color="#fff" />
                    <Text style={styles.addConfirmText}>Hinzufügen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowAddTask(false)} style={styles.addCancelBtn}>
                    <X size={14} color={IDE.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.actionBar}>
              {isEditable && (
                <>
                  <View style={styles.actionBarLeft}>
                    <TouchableOpacity
                      style={styles.addTaskBtn}
                      onPress={() => { setAddType('task'); setShowAddTask(true); }}
                      activeOpacity={0.7}
                    >
                      <Plus size={14} color={IDE.primary} />
                      <Text style={[styles.addTaskBtnText, { color: IDE.primary }]}>Aufgabe</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addTaskBtn, styles.addBrainstormBtn]}
                      onPress={handleQuickAddBrainstorm}
                      activeOpacity={0.7}
                    >
                      <Lightbulb size={14} color={IDE.warning} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addTaskBtn, styles.addThinkingBtn]}
                      onPress={handleQuickAddThinking}
                      activeOpacity={0.7}
                    >
                      <Brain size={14} color={IDE.keyword} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addTaskBtn, styles.addWebSearchBtn]}
                      onPress={handleQuickAddWebSearch}
                      activeOpacity={0.7}
                    >
                      <Globe size={14} color="#2196F3" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addTaskBtn, styles.addSubAgentBtn]}
                      onPress={handleQuickAddSubAgent}
                      activeOpacity={0.7}
                    >
                      <Zap size={14} color={IDE.accent} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addTaskBtn, styles.addAutoBtn]}
                      onPress={handleAutoAddBrainstorm}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={12} color={IDE.accent} />
                      <Text style={[styles.addTaskBtnText, { color: IDE.accent, fontSize: 10 }]}>Auto</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.actionBarRight}>
                    <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} activeOpacity={0.7}>
                      <X size={14} color={IDE.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={onExecute}
                      style={[styles.executeBtn, totalCount === 0 && styles.executeBtnDisabled]}
                      disabled={totalCount === 0}
                      activeOpacity={0.7}
                    >
                      <Play size={14} color="#fff" />
                      <Text style={styles.executeBtnText}>Start</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {isRunning && (
                <TouchableOpacity onPress={onStop} style={styles.stopBtn} activeOpacity={0.7}>
                  <Square size={14} color={IDE.danger} />
                  <Text style={styles.stopBtnText}>Stop</Text>
                </TouchableOpacity>
              )}

              {isDone && (
                <TouchableOpacity onPress={() => setCollapsed(true)} style={styles.doneBtn} activeOpacity={0.7}>
                  <CheckCircle size={14} color={IDE.accent} />
                  <Text style={styles.doneBtnText}>Collapse</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* FIX 2: Einfacheres Swap Modal mit Cancel-Button */}
      <Modal visible={swapModal.visible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.swapOverlay}
          activeOpacity={1}
          onPress={handleSwapCancel}
        >
          <View style={styles.swapModal}>
            <View style={styles.swapModalHeader}>
              <GripVertical size={16} color={IDE.primary} />
              <Text style={styles.swapModalTitle}>Position {swapModal.fromIndex + 1} verschieben</Text>
              <TouchableOpacity onPress={handleSwapCancel} style={styles.cancelBtnSmall}>
                <X size={18} color={IDE.danger} />
              </TouchableOpacity>
            </View>
            <Text style={styles.swapModalHint}>
              Choose a new position:
            </Text>
            <ScrollView style={styles.swapListScroll} showsVerticalScrollIndicator>
              {tasks.map((task, i) => task ? (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.swapItem,
                    i === swapModal.fromIndex && styles.swapItemFrom,
                  ]}
                  onPress={() => handleSwapSelect(i)}
                  activeOpacity={0.7}
                  disabled={i === swapModal.fromIndex}
                >
                  <View style={[
                    styles.swapItemIndex,
                    i === swapModal.fromIndex && {
                      backgroundColor: IDE.primary + '40',
                    },
                  ]}>
                    <Text style={[
                      styles.swapItemIndexText,
                      i === swapModal.fromIndex && { color: IDE.primary },
                    ]}>{i + 1}</Text>
                  </View>
                  <Text
                    style={[
                      styles.swapItemText,
                      i === swapModal.fromIndex && styles.swapItemTextFrom,
                    ]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>
                  {i === swapModal.fromIndex ? (
                    <View style={styles.currentBadgeSimple}>
                      <Text style={styles.currentBadgeText}>Aktuell</Text>
                    </View>
                  ) : (
                    <ArrowDown size={14} color={IDE.muted} style={{ transform: [{ rotate: i < swapModal.fromIndex ? '180deg' : '0deg' }] }} />
                  )}
                </TouchableOpacity>
              ) : null)}
            </ScrollView>
            <TouchableOpacity onPress={handleSwapCancel} style={styles.cancelButtonFullWidth}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lösch-Bestätigung Modal */}
      <Modal visible={deleteConfirm.visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.deleteOverlay}
          activeOpacity={1}
          onPress={handleDeleteCancel}
        >
          <View style={styles.deleteModal}>
            <View style={styles.deleteModalHeader}>
              <AlertTriangle size={20} color={IDE.warning} />
              <Text style={styles.deleteModalTitle}>Delete Task?</Text>
            </View>
            <Text style={styles.deleteModalText}>
              Bist du sicher, dass du diesen Task entfernen möchtest? Dieser Schritt kann nicht rückgängig gemacht werden.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                onPress={handleDeleteCancel}
                style={[styles.deleteBtn, styles.deleteBtnCancel]}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteExecute}
                style={[styles.deleteBtn, styles.deleteBtnConfirm]}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteBtnConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Klärungsfragen Modal */}
      {localQuestions.length > 0 && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.questionsOverlay}>
            <View style={styles.questionsContainer}>
              <View style={styles.questionsHeader}>
                <MessageSquare size={24} color={IDE.primary} />
                <Text style={styles.questionsTitle}>Klärungsfragen</Text>
              </View>
              <Text style={styles.questionsSubtitle}>
                Bevor ich den Plan erstelle, beantworte bitte diese Fragen:
              </Text>
              <ScrollView style={styles.questionsScroll} showsVerticalScrollIndicator={false}>
                {localQuestions.map((q, idx) => (
                  <View key={idx} style={styles.questionItem}>
                    <View style={styles.questionNumberBadge}>
                      <Text style={styles.questionNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.questionText}>{q.question}</Text>
                    <TextInput
                      style={styles.answerInput}
                      placeholder="Deine Antwort..."
                      placeholderTextColor={IDE.muted}
                      value={q.answer}
                      onChangeText={(text) => handleAnswerQuestion(idx, text)}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={handleSubmitAnswers}
                style={styles.submitAnswersButton}
                activeOpacity={0.7}
              >
                <Text style={styles.submitAnswersButtonText}>Antworten & Plan erstellen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {isDone && plan?.finalResponse && (
        <View style={styles.finalResponseContainer}>
          <View style={styles.finalResponseHeader}>
            <View style={styles.finalResponseDot} />
            <Text style={styles.finalResponseLabel}>Ergebnis</Text>
          </View>
          <Text style={styles.finalResponseText}>{formatFinalResponse(plan.finalResponse)}</Text>

          {totalToolsUsed.length > 0 && (
            <View style={styles.totalToolsSection}>
              <TouchableOpacity
                style={styles.totalToolsHeader}
                onPress={() => setToolsSummaryExpanded(p => !p)}
                activeOpacity={0.7}
              >
                <Wrench size={12} color={IDE.muted} />
                <Text style={styles.totalToolsHeaderText}>
                  {totalToolCount} Tool{totalToolCount !== 1 ? 's' : ''} insgesamt verwendet
                </Text>
                {toolsSummaryExpanded ? <ChevronUp size={12} color={IDE.muted} /> : <ChevronDown size={12} color={IDE.muted} />}
              </TouchableOpacity>
              {toolsSummaryExpanded && (
                <View style={styles.totalToolsList}>
                  {totalToolsUsed.map((tool) => (
                    <View key={tool.name} style={styles.totalToolItem}>
                      <View style={[
                        styles.totalToolDot,
                        { backgroundColor: tool.status === 'error' ? IDE.danger : tool.status === 'mixed' ? IDE.warning : IDE.accent },
                      ]} />
                      <Text style={styles.totalToolName}>{TOOL_LABELS[tool.name] || tool.name}</Text>
                      <Text style={styles.totalToolCount}>×{tool.count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
});

function formatFinalResponse(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    // HASHTAG-DOKUMENTATION: !####! 📘 Dokumentation
    const hashtagMatch = line.match(/^!(#{1,6})!\s*(.+)$/);
    if (hashtagMatch) {
      const level = hashtagMatch[1].length;
      const headingText = hashtagMatch[2].trim();
      const fontSize: number = level === 1 ? 17 : (level === 2 ? 15 : 13);
      const marginTop: number = li > 0 ? 8 : 0;
      elements.push(
        <Text key={'h' + li} style={[styles.finalHeading, { fontSize, marginTop }]}>
          {formatInlineFinal(headingText)}
        </Text>
      );
      continue;
    }

    // Normale Headings #, ##, ###
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)![1].length;
      const headingText = line.replace(/^#{1,3}\s+/, '');
      const fontSize: number = level === 1 ? 17 : (level === 2 ? 15 : 13);
      const marginTop: number = li > 0 ? 8 : 0;
      elements.push(
        <Text key={'h' + li} style={[styles.finalHeading, { fontSize, marginTop: li > 0 ? 8 : 0 }]}>
          {formatInlineFinal(headingText)}
        </Text>
      );
      continue;
    }

    if (/^\s*[-*]\s/.test(line)) {
      const bulletText = line.replace(/^\s*[-*]\s+/, '');
      elements.push(
        <View key={'li' + li} style={styles.finalListItem}>
          <Text style={styles.finalBullet}>{"\u2022"}</Text>
          <Text style={styles.finalListText}>{formatInlineFinal(bulletText)}</Text>
        </View>
      );
      continue;
    }

    if (line.trim() === '') {
      elements.push(<Text key={'br' + li}>{"\n"}</Text>);
      continue;
    }

    elements.push(
      <Text key={'t' + li} style={styles.finalResponseText}>
        {formatInlineFinal(line)}{li < lines.length - 1 ? '\n' : ''}
      </Text>
    );
  }

  return elements;
}

function formatInlineFinal(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|~~[^~]+~~)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <Text key={i} style={styles.boldText}>{part.slice(2, -2)}</Text>;
    }
    if ((part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) ||
        (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__'))) {
      return <Text key={i} style={styles.italicText}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <Text key={i} style={styles.finalInlineCode}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <Text key={i} style={styles.strikethroughText}>{part.slice(2, -2)}</Text>;
    }
    return <Text key={i}>{part}</Text>;
  });
}

AgentPlanView.displayName = 'AgentPlanView';

interface TaskRowProps {
  task: AgentTask;
  index: number;
  totalCount: number;
  isEditable: boolean;
  canReorder: boolean;
  onUpdateTask: (taskId: string, title: string, description: string) => void;
  onRemoveTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onLongPress: (index: number) => void;
  onDeleteConfirm?: (index: number, taskId: string) => void;
}

const TaskRow = React.memo(({ task, index, totalCount, isEditable, canReorder, onUpdateTask, onRemoveTask, onRetryTask, onMoveUp, onMoveDown, onLongPress, onDeleteConfirm }: TaskRowProps) => {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (!canReorder) return;
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.96, duration: 100, useNativeDriver: false }),
        Animated.timing(scaleAnim, { toValue: 1.02, duration: 150, useNativeDriver: false }),
      ]).start(() => {
        scaleAnim.setValue(1);
        onLongPress(index);
      });
    }, 400);
  }, [canReorder, index, onLongPress, scaleAnim]);

  const handlePressOut = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      scaleAnim.setValue(1);
    }
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.taskRow, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        style={styles.taskRowPressable}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={() => {}}
        delayLongPress={400}
      >
        {canReorder && (
          <View style={styles.reorderControls}>
            <TouchableOpacity
              style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
              onPress={() => onMoveUp(index)}
              disabled={index === 0}
              activeOpacity={0.6}
            >
              <ArrowUp size={12} color={index === 0 ? IDE.border : IDE.muted} />
            </TouchableOpacity>
            <View style={styles.reorderIndexBtn}>
              <Text style={styles.reorderIndex}>{index + 1}</Text>
            </View>
            <TouchableOpacity
              style={[styles.arrowBtn, index === totalCount - 1 && styles.arrowBtnDisabled]}
              onPress={() => onMoveDown(index)}
              disabled={index === totalCount - 1}
              activeOpacity={0.6}
            >
              <ArrowDown size={12} color={index === totalCount - 1 ? IDE.border : IDE.muted} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.taskCardWrapper}>
          <AgentTaskCard
            task={task}
            index={index}
            editable={isEditable}
            onUpdate={(title, desc) => onUpdateTask(task.id, title, desc)}
            onRemove={() => onDeleteConfirm ? onDeleteConfirm(index, task.id) : onRemoveTask(task.id)}
            onRetry={() => onRetryTask(task.id)}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
});

TaskRow.displayName = 'TaskRow';

export default AgentPlanView;

const styles = StyleSheet.create({
  container: {
    backgroundColor: IDE.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: IDE.border,
    marginHorizontal: 8,
    marginVertical: 6,
    overflow: 'hidden' as const,
  },
  planHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 12,
    backgroundColor: IDE.surface,
  },
  planHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    flex: 1,
  },
  planIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  planIconReview: {
    backgroundColor: IDE.warning,
  },
  planIconRunning: {
    backgroundColor: IDE.primary,
  },
  planIconDone: {
    backgroundColor: IDE.accent,
  },
  planIconError: {
    backgroundColor: IDE.danger,
  },
  planHeaderInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: IDE.text,
  },
  planSubtitle: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 1,
  },
  planHeaderRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  counterBadge: {
    backgroundColor: IDE.primary + '25',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  counterBadgeError: {
    backgroundColor: IDE.danger + '25',
  },
  counterBadgeSuccess: {
    backgroundColor: IDE.accent + '25',
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: IDE.primary,
  },
  counterTextError: {
    color: IDE.danger,
  },
  counterTextSuccess: {
    color: IDE.accent,
  },
  planBody: {
    padding: 10,
  },
  progressSection: {
    marginBottom: 10,
  },
  progressBar: {
    height: 3,
    backgroundColor: IDE.border,
    borderRadius: 2,
    overflow: 'hidden' as const,
    flexDirection: 'row' as const,
  },
  progressFill: {
    height: 3,
    backgroundColor: IDE.accent,
    borderRadius: 2,
  },
  progressError: {
    height: 3,
    backgroundColor: IDE.danger,
  },
  statsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    marginTop: 6,
  },
  statItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 10,
    color: IDE.muted,
  },
  summaryBox: {
    backgroundColor: IDE.surface,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: IDE.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: IDE.danger + '12',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: IDE.danger + '20',
  },
  errorBannerContent: {
    flex: 1,
  },
  errorBannerText: {
    fontSize: 12,
    color: IDE.danger,
    fontWeight: '600' as const,
  },
  errorBannerHint: {
    fontSize: 10,
    color: IDE.danger,
    opacity: 0.7,
    marginTop: 2,
  },
  successBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: IDE.accent + '12',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: IDE.accent + '20',
  },
  successBannerText: {
    fontSize: 12,
    color: IDE.accent,
    fontWeight: '600' as const,
  },
  taskList: {
    marginBottom: 8,
  },
  taskRow: {
    marginBottom: 0,
  },
  taskRowPressable: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  reorderControls: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingTop: 6,
    paddingRight: 2,
    paddingLeft: 2,
    width: 26,
    gap: 2,
  },
  arrowBtn: {
    padding: 2,
    borderRadius: 4,
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  reorderIndexBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    backgroundColor: IDE.primary + '12',
  },
  reorderIndex: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: IDE.primary,
    textAlign: 'center' as const,
    minWidth: 14,
  },
  swapOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end' as const,
    alignItems: 'center' as const,
  },
  swapModalBackdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  swapModalContent: {
    backgroundColor: IDE.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderColor: IDE.border,
    width: '92%',
    maxHeight: '80%',
    overflow: 'hidden' as const,
    paddingBottom: 16,
  },
  swapModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  cancelBtnSmall: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: IDE.danger + '15',
  },
  swapListScroll: {
    padding: 8,
    gap: 4,
    maxHeight: 300,
  },
  currentBadgeSimple: {
    backgroundColor: IDE.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  cancelButtonFullWidth: {
    margin: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    alignItems: 'center' as const,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: IDE.text,
  },
  swapModal: {
    backgroundColor: IDE.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IDE.border,
    width: '95%',
    maxWidth: 400,
    overflow: 'hidden' as const,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  swapModalTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: IDE.text,
  },
  swapModalHint: {
    fontSize: 12,
    color: IDE.muted,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  swapList: {
    padding: 8,
    gap: 4,
  },
  swapItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  swapItemFrom: {
    borderColor: IDE.primary + '50',
    backgroundColor: IDE.primary + '10',
  },
  swapItemIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: IDE.border,
  },
  swapItemIndexText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: IDE.muted,
  },
  swapItemText: {
    flex: 1,
    fontSize: 12,
    color: IDE.text,
    fontWeight: '500' as const,
  },
  swapItemTextFrom: {
    color: IDE.primary,
    fontWeight: '700' as const,
  },
  swapItemCurrent: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.primary,
    backgroundColor: IDE.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  taskCardWrapper: {
    flex: 1,
  },
  addTaskForm: {
    backgroundColor: IDE.surface,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  addTypeRow: {
    flexDirection: 'row' as const,
    gap: 6,
    marginBottom: 4,
  },
  addTypeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  addTypeBtnActive: {
    borderColor: IDE.primary + '60',
    backgroundColor: IDE.primary + '10',
  },
  addTypeBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: IDE.muted,
  },
  addInput: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: IDE.text,
  },
  addInputMulti: {
    minHeight: 50,
    textAlignVertical: 'top' as const,
  },
  addTaskActions: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  },
  addConfirmBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addConfirmText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600' as const,
  },
  addCancelBtn: {
    padding: 6,
  },
  actionBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: 4,
  },
  actionBarLeft: {
    flexDirection: 'row' as const,
    gap: 6,
    alignItems: 'center' as const,
    flex: 1,
    flexWrap: 'wrap' as const,
  },
  actionBarRight: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  },
  addTaskBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: IDE.primary + '40',
  },
  addBrainstormBtn: {
    borderColor: IDE.warning + '40',
    paddingHorizontal: 6,
  },
  addThinkingBtn: {
    borderColor: IDE.keyword + '40',
    paddingHorizontal: 6,
  },
  addWebSearchBtn: {
    borderColor: '#2196F3' + '40',
    paddingHorizontal: 6,
  },
  addSubAgentBtn: {
    borderColor: IDE.accent + '40',
    paddingHorizontal: 6,
  },
  addAutoBtn: {
    borderColor: IDE.accent + '40',
    backgroundColor: IDE.accent + '08',
  },
  addTaskBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  dismissBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: IDE.surface,
  },
  executeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: IDE.accent,
  },
  executeBtnDisabled: {
    opacity: 0.5,
  },
  executeBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700' as const,
  },
  stopBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: IDE.danger + '20',
    marginLeft: 'auto' as const,
  },
  stopBtnText: {
    fontSize: 12,
    color: IDE.danger,
    fontWeight: '600' as const,
  },
  doneBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: IDE.accent + '20',
    marginLeft: 'auto' as const,
  },
  doneBtnText: {
    fontSize: 12,
    color: IDE.accent,
    fontWeight: '600' as const,
  },
  finalResponseContainer: {
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  finalResponseHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  finalResponseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IDE.accent,
  },
  finalResponseLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: IDE.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  finalResponseText: {
    fontSize: 14,
    color: IDE.text,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '700' as const,
    color: IDE.text,
  },
  totalToolsSection: {
    marginTop: 12,
    backgroundColor: IDE.bg + 'CC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    overflow: 'hidden' as const,
  },
  totalToolsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  totalToolsHeaderText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: IDE.textSecondary,
    flex: 1,
  },
  totalToolsList: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 8,
    gap: 4,
  },
  totalToolItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 3,
  },
  totalToolDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  totalToolName: {
    fontSize: 12,
    color: IDE.textSecondary,
    flex: 1,
  },
  totalToolCount: {
    fontSize: 11,
    color: IDE.muted,
    fontWeight: '600' as const,
  },
  finalHeading: {
    fontWeight: '700' as const,
    color: IDE.text,
    marginBottom: 4,
  },
  finalListItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    paddingLeft: 4,
    marginVertical: 1,
  },
  finalBullet: {
    fontSize: 14,
    color: IDE.primary,
    lineHeight: 22,
    width: 12,
  },
  finalListText: {
    fontSize: 14,
    color: IDE.text,
    lineHeight: 22,
    flex: 1,
  },
  finalInlineCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: IDE.surface,
    color: IDE.accent,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  italicText: {
    fontStyle: 'italic' as const,
    color: IDE.text,
  },
  strikethroughText: {
    textDecorationLine: 'line-through' as const,
    color: IDE.muted,
  },
  // Delete Confirm Modal Styles
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    width: '85%',
    backgroundColor: IDE.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: IDE.warning + '40',
    padding: 16,
  },
  deleteModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 12,
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: IDE.warning,
    flex: 1,
  },
  deleteModalText: {
    fontSize: 14,
    color: IDE.text,
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteModalButtons: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  deleteBtnCancel: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  deleteBtnCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: IDE.text,
  },
  deleteBtnConfirm: {
    backgroundColor: IDE.warning,
  },
  deleteBtnConfirmText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  // Clarification Questions Modal Styles
  questionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  questionsContainer: {
    backgroundColor: IDE.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderColor: IDE.border,
    maxHeight: '85%',
    overflow: 'hidden' as const,
  },
  questionsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  questionsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: IDE.text,
    flex: 1,
  },
  questionsSubtitle: {
    fontSize: 13,
    color: IDE.muted,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  questionsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  questionItem: {
    marginBottom: 16,
  },
  questionNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: IDE.primary + '20',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 8,
  },
  questionNumberText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: IDE.primary,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: IDE.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  answerInput: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: IDE.text,
    minHeight: 60,
    textAlignVertical: 'top' as const,
  },
  submitAnswersButton: {
    margin: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: IDE.primary,
    alignItems: 'center' as const,
  },
  submitAnswersButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
