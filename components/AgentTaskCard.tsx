import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, ScrollView,
} from 'react-native';
import {
  Check, X, Loader2, Clock, Play, Pencil, Trash2, ChevronDown, ChevronRight,
  FileText, FilePlus, FileX, RefreshCw, AlertCircle, Brain, Lightbulb, Wrench, Globe, ExternalLink, Zap,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { AgentTask, AgentTaskStatus, AgentTaskType, ToolCall, isLearningTool, isLearningEnabled } from '@/types';
import { useApp } from '@/providers/AppProvider';
import ToolCallView from './ToolCallView';

interface Props {
  task: AgentTask;
  index: number;
  editable: boolean;
  onUpdate?: (title: string, description: string) => void;
  onRemove?: () => void;
  onRetry?: () => void;
}

const STATUS_CONFIG: Record<AgentTaskStatus, { color: string; label: string }> = {
  draft: { color: IDE.muted, label: 'Draft' },
  pending: { color: IDE.warning, label: 'Pending' },
  running: { color: IDE.primary, label: 'Running...' },
  completed: { color: IDE.accent, label: 'Done' },
  error: { color: IDE.danger, label: 'Error' },
  cancelled: { color: IDE.muted, label: 'Cancelled' },
};

const TYPE_CONFIG: Record<AgentTaskType, { icon: typeof Brain; color: string; label: string }> = {
  task: { icon: Play, color: IDE.primary, label: 'Task' },
  thinking: { icon: Brain, color: IDE.keyword, label: 'Analysis' },
  brainstorm: { icon: Lightbulb, color: IDE.warning, label: 'Brainstorm' },
  question: { icon: Wrench, color: IDE.accent, label: 'Question' },
  web_search: { icon: Globe, color: '#2196F3', label: 'Web Search' },
  sub_agent: { icon: Zap, color: IDE.accent, label: 'Sub-agent' },
};

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
  add_memo: 'Save Memo',
  web_search: 'Web Search',
  web_fetch: 'Fetch Webpage',
  think: 'Think',
  task_complete: 'Task Complete',
  verify_file: 'Verify File',
};

const AgentTaskCard = React.memo(({ task, index, editable, onUpdate, onRemove, onRetry }: Props) => {
  const { settings } = useApp();
  const learningActive = isLearningEnabled(settings);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>(task.title);
  const [editDesc, setEditDesc] = useState<string>(task.description);
  const [thinkingExpanded, setThinkingExpanded] = useState<boolean>(false);
  const [toolsExpanded, setToolsExpanded] = useState<boolean>(false);
  const [resultExpanded, setResultExpanded] = useState<boolean>(false);
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const thinkingScrollRef = useRef<ScrollView>(null);

  const taskType = task.taskType || 'task';
  const isThinkingType = taskType === 'thinking' || taskType === 'brainstorm';
  const isWebSearchType = taskType === 'web_search';
  const isSpecialType = isThinkingType || isWebSearchType;
  const config = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.draft;
  const typeConfig = TYPE_CONFIG[taskType] ?? TYPE_CONFIG.task;
  const TypeIcon = typeConfig.icon;

  const entryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (task.status === 'running') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 600, useNativeDriver: false }),
        ])
      );
      const spinAnimation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      );
      pulseAnimation.start();
      spinAnimation.start();
      return () => {
        pulseAnimation.stop();
        spinAnimation.stop();
        spinAnim.setValue(0);
      };
    } else {
      pulseAnim.setValue(1);
      spinAnim.setValue(0);
    }
  }, [task.status, pulseAnim, spinAnim]);

  useEffect(() => {
    if (task.status === 'running' && (isThinkingType || isWebSearchType)) {
      setExpanded(true);
      if (isThinkingType) setThinkingExpanded(true);
    }
  }, [task.status, isThinkingType, isWebSearchType]);

  useEffect(() => {
    if (task.status === 'running' && isThinkingType && thinkingExpanded && thinkingScrollRef.current) {
      setTimeout(() => {
        thinkingScrollRef.current?.scrollToEnd?.({ animated: true });
      }, 80);
    }
  }, [task.thinkingContent, task.status, isThinkingType, thinkingExpanded]);

  const toggleExpand = useCallback(() => setExpanded(p => !p), []);

  const handleSaveEdit = useCallback(() => {
    if (onUpdate && editTitle.trim()) {
      onUpdate(editTitle.trim(), editDesc.trim());
    }
    setEditing(false);
  }, [onUpdate, editTitle, editDesc]);

  const handleStartEdit = useCallback(() => {
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditing(true);
  }, [task.title, task.description]);

  const StatusIcon = task.status === 'completed' ? Check
    : task.status === 'error' ? AlertCircle
    : task.status === 'running' ? Loader2
    : task.status === 'pending' ? Clock
    : task.status === 'cancelled' ? X
    : Play;

  const allToolCalls: ToolCall[] = [];
  for (const msg of (task.subAgentMessages ?? [])) {
    if (msg?.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (
          tc &&
          tc.name !== 'task_complete' &&
          tc.name !== 'think' &&
          tc.name !== 'get_active_tools' &&
          (learningActive || !isLearningTool(tc.name))
        ) {
          allToolCalls.push(tc);
        }
      }
    }
  }

  const totalFileActions = (task.filesCreated?.length ?? 0) + (task.filesModified?.length ?? 0) + (task.filesDeleted?.length ?? 0);
  const toolCallCount = allToolCalls.length;

  const isRunningThinking = task.status === 'running' && isThinkingType;
  const isRunningWebSearch = task.status === 'running' && isWebSearchType;
  const liveThinkingContent = isRunningThinking ? (stripMarkdown(task.thinkingContent || task.description || 'Thinking...')) : null;

  const webSearchResults = useMemo((): { url: string; title: string; snippet: string }[] => {
    if (!isWebSearchType) return [];
    const results: { url: string; title: string; snippet: string }[] = [];
    for (const msg of (task.subAgentMessages ?? [])) {
      if (msg?.role === 'tool' && msg.toolName === 'web_search' && msg.content) {
        const urlMatches = msg.content.match(/URL: (https?:\/\/[^\s]+)/g);
        if (urlMatches) {
          for (const um of urlMatches) {
            const url = um.replace('URL: ', '').trim();
            results.push({ url, title: url.replace(/https?:\/\//, '').split('/')[0], snippet: '' });
          }
        }
      }
      if (msg?.role === 'tool' && msg.toolName === 'web_fetch' && msg.content) {
        const snippet = msg.content.slice(0, 200);
        results.push({ url: '', title: 'Webpage loaded', snippet });
      }
    }
    return results;
  }, [isWebSearchType, task.subAgentMessages]);

  const spinRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <Animated.View style={[{ opacity: entryAnim, transform: [{ translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
    <View style={[
      styles.card,
      task.status === 'running' && styles.cardRunning,
      isThinkingType && styles.cardThinking,
      isWebSearchType && styles.cardWebSearch,
    ]}>
      <TouchableOpacity onPress={toggleExpand} style={styles.header} activeOpacity={0.7}>
        <Animated.View style={[
          styles.indexBadge,
          { backgroundColor: isSpecialType ? typeConfig.color + '20' : config.color + '25', opacity: task.status === 'running' ? pulseAnim : 1 },
        ]}>
          {isSpecialType ? (
            <TypeIcon size={13} color={typeConfig.color} />
          ) : (
            <Text style={[styles.indexText, { color: config.color }]}>{index + 1}</Text>
          )}
        </Animated.View>

        <View style={styles.headerContent}>
          {editing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Title..."
                placeholderTextColor={IDE.muted}
              />
              <TextInput
                style={[styles.editInput, styles.editInputMulti]}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Description..."
                placeholderTextColor={IDE.muted}
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity onPress={handleSaveEdit} style={styles.editSaveBtn}>
                  <Check size={14} color="#fff" />
                  <Text style={styles.editSaveBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(false)} style={styles.editCancelBtn}>
                  <X size={14} color={IDE.muted} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.titleRow}>
                {isSpecialType && (
                  <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                  </View>
                )}
                <Text style={[styles.title, isSpecialType && { color: typeConfig.color }]} numberOfLines={2}>{task.title}</Text>
              </View>
              <View style={styles.metaRow}>
                <View style={[styles.statusPill, { backgroundColor: config.color + '20' }]}>
                  {task.status === 'running' ? (
                    <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                      <View style={{
                        width: 10, height: 10, borderRadius: 5,
                        borderWidth: 1.5, borderColor: config.color,
                        borderTopColor: 'transparent',
                      }} />
                    </Animated.View>
                  ) : (
                    <StatusIcon size={10} color={config.color} />
                  )}
                  <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                </View>
                {toolCallCount > 0 && (
                  <Text style={styles.metaText}>{toolCallCount} Tools</Text>
                )}
                {totalFileActions > 0 && (
                  <Text style={styles.metaText}>{totalFileActions} Files</Text>
                )}
                {isWebSearchType && webSearchResults.length > 0 && (
                  <Text style={[styles.metaText, { color: '#2196F3' }]}>{webSearchResults.length} Matches</Text>
                )}
              </View>
            </>
          )}
        </View>

        {!editing && (
          <View style={styles.headerRight}>
            {editable && task.status === 'draft' && (
              <View style={styles.actionBtns}>
                <TouchableOpacity onPress={handleStartEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Pencil size={14} color={IDE.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={14} color={IDE.danger} />
                </TouchableOpacity>
              </View>
            )}
            {task.status === 'error' && onRetry && (
              <TouchableOpacity onPress={onRetry} style={styles.retryBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <RefreshCw size={12} color={IDE.warning} />
              </TouchableOpacity>
            )}
            {expanded ? <ChevronDown size={16} color={IDE.muted} /> : <ChevronRight size={16} color={IDE.muted} />}
          </View>
        )}
      </TouchableOpacity>

      {liveThinkingContent && !expanded && (
        <View style={styles.liveThinkingPreview}>
          <Animated.View style={[styles.liveThinkingDot, { opacity: pulseAnim }]} />
          <Text style={styles.liveThinkingPreviewText} numberOfLines={2}>{liveThinkingContent}</Text>
        </View>
      )}

      {expanded && !editing && (
        <View style={styles.details}>
          {!isThinkingType && !isWebSearchType && (
            <Text style={styles.description}>{task.description}</Text>
          )}
          {isWebSearchType && (
            <Text style={[styles.description, { color: '#2196F3' }]}>{task.description}</Text>
          )}

          {isThinkingType && (task.thinkingContent || isRunningThinking) && (
            <View style={styles.thinkingSection}>
              <TouchableOpacity
                style={styles.thinkingHeader}
                onPress={() => setThinkingExpanded(p => !p)}
                activeOpacity={0.7}
              >
                <Brain size={12} color={typeConfig.color} />
                <Text style={[styles.thinkingSectionTitle, { color: typeConfig.color }]}>
                  {isRunningThinking ? 'Thinking...' : taskType === 'thinking' ? 'Thought Process' : 'Brainstorm Result'}
                </Text>
                {isRunningThinking && (
                  <View style={styles.liveIndicator}>
                    <Animated.View style={[styles.liveDotSmall, { opacity: pulseAnim }]} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                )}
                {thinkingExpanded ? <ChevronDown size={12} color={IDE.muted} /> : <ChevronRight size={12} color={IDE.muted} />}
              </TouchableOpacity>
              {thinkingExpanded && (
                <ScrollView
                  ref={thinkingScrollRef}
                  style={styles.thinkingScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  <Text style={styles.thinkingText}>
                    {stripMarkdown(task.thinkingContent || task.description || 'Thinking...')}
                  </Text>
                  {isRunningThinking && (
                    <Animated.View style={[styles.cursor, { opacity: pulseAnim }]} />
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {isThinkingType && !task.thinkingContent && !isRunningThinking && (
            <Text style={styles.description}>{task.description}</Text>
          )}

          {task.error && (
            <View style={styles.errorBox}>
              <AlertCircle size={12} color={IDE.danger} />
              <Text style={styles.errorText}>{task.error}</Text>
            </View>
          )}

          {(task.filesCreated?.length ?? 0) > 0 && (
            <View style={styles.fileSection}>
              <View style={styles.fileSectionHeader}>
                <FilePlus size={12} color={IDE.accent} />
                <Text style={[styles.fileSectionTitle, { color: IDE.accent }]}>Created</Text>
              </View>
              {task.filesCreated.map(f => (
                <Text key={f} style={styles.filePath}>{f}</Text>
              ))}
            </View>
          )}

          {(task.filesModified?.length ?? 0) > 0 && (
            <View style={styles.fileSection}>
              <View style={styles.fileSectionHeader}>
                <FileText size={12} color={IDE.primary} />
                <Text style={[styles.fileSectionTitle, { color: IDE.primary }]}>Modified</Text>
              </View>
              {task.filesModified.map(f => (
                <Text key={f} style={styles.filePath}>{f}</Text>
              ))}
            </View>
          )}

          {(task.filesDeleted?.length ?? 0) > 0 && (
            <View style={styles.fileSection}>
              <View style={styles.fileSectionHeader}>
                <FileX size={12} color={IDE.danger} />
                <Text style={[styles.fileSectionTitle, { color: IDE.danger }]}>Deleted</Text>
              </View>
              {task.filesDeleted.map(f => (
                <Text key={f} style={styles.filePath}>{f}</Text>
              ))}
            </View>
          )}

          {isWebSearchType && webSearchResults.length > 0 && (
            <View style={styles.webResultsSection}>
              <View style={styles.webResultsHeader}>
                <Globe size={12} color="#2196F3" />
                <Text style={styles.webResultsTitle}>{webSearchResults.length} Result{webSearchResults.length !== 1 ? 's' : ''}</Text>
              </View>
              {webSearchResults.slice(0, 5).map((wr: { url: string; title: string; snippet: string }, wi: number) => (
                <View key={wi} style={styles.webResultItem}>
                  <View style={styles.webResultRow}>
                    <ExternalLink size={10} color={IDE.primary} />
                    <Text style={styles.webResultUrl} numberOfLines={1}>{wr.url || wr.title}</Text>
                  </View>
                  {wr.snippet ? <Text style={styles.webResultSnippet} numberOfLines={2}>{wr.snippet}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {task.result && task.status === 'completed' && !isThinkingType && (
            <View style={styles.thinkingSection}>
              <TouchableOpacity
                style={styles.thinkingHeader}
                onPress={() => setResultExpanded(p => !p)}
                activeOpacity={0.7}
              >
                <Brain size={12} color={IDE.accent} />
                <Text style={[styles.thinkingSectionTitle, { color: IDE.accent }]}>Result</Text>
                {resultExpanded ? <ChevronDown size={12} color={IDE.muted} /> : <ChevronRight size={12} color={IDE.muted} />}
              </TouchableOpacity>
              {resultExpanded && (
                <ScrollView
                  style={styles.thinkingScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  <Text style={styles.thinkingText}>
                    {stripMarkdown(task.result)}
                  </Text>
                </ScrollView>
              )}
            </View>
          )}

          {toolCallCount > 0 && (task.status === 'completed' || task.status === 'error') && (
            <View style={styles.toolCallsSection}>
              <TouchableOpacity
                style={styles.toolCallsSectionHeader}
                onPress={() => setToolsExpanded(p => !p)}
                activeOpacity={0.7}
              >
                <Wrench size={12} color={IDE.muted} />
                <Text style={styles.toolCallsSectionTitle}>
                  {toolCallCount} Tool{toolCallCount !== 1 ? 's' : ''} used
                </Text>
                <View style={styles.toolBadgesRow}>
                  {allToolCalls.filter(tc => tc.status === 'completed').length > 0 && (
                    <View style={styles.toolBadgeOk}>
                      <Text style={styles.toolBadgeOkText}>{allToolCalls.filter(tc => tc.status === 'completed').length}✓</Text>
                    </View>
                  )}
                  {allToolCalls.filter(tc => tc.status === 'error').length > 0 && (
                    <View style={styles.toolBadgeErr}>
                      <Text style={styles.toolBadgeErrText}>{allToolCalls.filter(tc => tc.status === 'error').length}✗</Text>
                    </View>
                  )}
                </View>
                {toolsExpanded ? <ChevronDown size={12} color={IDE.muted} /> : <ChevronRight size={12} color={IDE.muted} />}
              </TouchableOpacity>
              {toolsExpanded && (
                <View style={styles.toolCallsList}>
                  {allToolCalls.map(tc => (
                    <ToolCallView key={tc.id} toolCall={tc} />
                  ))}
                </View>
              )}
            </View>
          )}

          {toolCallCount > 0 && task.status === 'running' && (
            <View style={styles.toolSummary}>
              <Text style={styles.toolSummaryText}>
                {toolCallCount} Tool calls · Running...
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
    </Animated.View>
  );
});

AgentTaskCard.displayName = 'AgentTaskCard';

export default AgentTaskCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: IDE.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IDE.border,
    marginBottom: 8,
    overflow: 'hidden' as const,
  },
  cardRunning: {
    borderColor: IDE.primary + '60',
    borderWidth: 1.5,
  },
  cardThinking: {
    borderColor: IDE.keyword + '30',
    backgroundColor: IDE.keyword + '08',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    gap: 10,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  indexText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  headerContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flexWrap: 'wrap' as const,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: IDE.text,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  statusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  metaText: {
    fontSize: 10,
    color: IDE.muted,
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  actionBtns: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  retryBtn: {
    padding: 4,
  },
  liveThinkingPreview: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 0,
  },
  liveThinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IDE.keyword,
  },
  liveThinkingPreviewText: {
    fontSize: 11,
    color: IDE.keyword,
    fontStyle: 'italic' as const,
    flex: 1,
    opacity: 0.8,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 12,
  },
  description: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  thinkingSection: {
    backgroundColor: IDE.keyword + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.keyword + '20',
    marginBottom: 8,
    overflow: 'hidden' as const,
  },
  thinkingHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  thinkingSectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.keyword + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: IDE.keyword,
  },
  liveText: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: IDE.keyword,
    letterSpacing: 0.5,
  },
  thinkingScroll: {
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: IDE.keyword + '15',
  },
  thinkingText: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
    fontFamily: 'monospace',
    padding: 10,
  },
  cursor: {
    width: 6,
    height: 14,
    backgroundColor: IDE.keyword,
    borderRadius: 1,
    marginLeft: 10,
    marginBottom: 10,
  },
  errorBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: IDE.danger + '15',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 11,
    color: IDE.danger,
    flex: 1,
  },
  fileSection: {
    marginBottom: 6,
  },
  fileSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginBottom: 2,
  },
  fileSectionTitle: {
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  filePath: {
    fontSize: 11,
    color: IDE.textSecondary,
    fontFamily: 'monospace',
    paddingLeft: 16,
    lineHeight: 16,
  },
  resultBox: {
    backgroundColor: IDE.accent + '10',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: IDE.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  resultText: {
    fontSize: 11,
    color: IDE.textSecondary,
    lineHeight: 16,
  },
  toolCallsSection: {
    marginTop: 8,
    backgroundColor: IDE.bg + 'CC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    overflow: 'hidden' as const,
  },
  toolCallsSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toolCallsSectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: IDE.textSecondary,
    flex: 1,
  },
  toolBadgesRow: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  toolBadgeOk: {
    backgroundColor: IDE.accent + '20',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  toolBadgeOkText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.accent,
  },
  toolBadgeErr: {
    backgroundColor: IDE.danger + '20',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  toolBadgeErrText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.danger,
  },
  toolCallsList: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 6,
  },
  toolSummary: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IDE.border,
  },
  toolSummaryText: {
    fontSize: 10,
    color: IDE.muted,
  },
  editContainer: {
    gap: 8,
  },
  editInput: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: IDE.text,
  },
  editInputMulti: {
    minHeight: 60,
    textAlignVertical: 'top' as const,
  },
  editActions: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  },
  editSaveBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editSaveBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600' as const,
  },
  editCancelBtn: {
    padding: 6,
  },
  cardWebSearch: {
    borderColor: '#2196F3' + '30',
    backgroundColor: '#2196F3' + '08',
  },
  webResultsSection: {
    backgroundColor: '#2196F3' + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3' + '20',
    marginBottom: 8,
    overflow: 'hidden' as const,
  },
  webResultsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2196F3' + '15',
  },
  webResultsTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#2196F3',
  },
  webResultItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2196F3' + '10',
  },
  webResultRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  webResultUrl: {
    fontSize: 11,
    color: IDE.primary,
    flex: 1,
  },
  webResultSnippet: {
    fontSize: 10,
    color: IDE.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
});

function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    // Remove headers
    .replace(/#{1,6}\s+/g, '')
    // Remove bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove lists and blockquotes
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/^\s*>\s+/gm, '')
    // Remove links and images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown table formatting (e.g. |---|)
    .replace(/^\|?.*\|$/gm, (m) => m.replace(/\|/g, ' ').replace(/-{3,}/g, '').trim())
    // Remove HTML tags
    .replace(/<[^>]*>?/gm, '');
}
