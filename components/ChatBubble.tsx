import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import {
  Copy,
  Bot,
  User,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Archive,
  Download,
  FileCode,
  Play,
  Edit3,
  Sparkles,
  X,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { IDE } from '@/constants/colors';
import {
  ChatMessage,
  DraftedAgentPlan,
  isLearningTool,
  isLearningEnabled,
} from '@/types';
import { triggerChatZipDownload } from '@/utils/chat-zip';
import { highlightLine, parseMarkdownSegments } from '@/utils/syntax';
import { useApp } from '@/providers/AppProvider';
import ToolCallView from './ToolCallView';
import ThinkingBlock from './ThinkingBlock';

interface Props {
  message: ChatMessage;
  onProceedDraftPlan?: (plan: DraftedAgentPlan) => void;
  onUpdateDraftPlan?: (
    messageId: string,
    updatedPlan: DraftedAgentPlan,
    aiFeedback?: string
  ) => void;
}

const ChatBubble = React.memo(
  ({ message, onProceedDraftPlan, onUpdateDraftPlan }: Props) => {
    const isUser = message.role === 'user';
    const appContext = useApp();
    const appTodos = appContext.todos;
    const updateTodoItem = appContext.updateTodoItem;
    const learningActive = isLearningEnabled(appContext.settings);

    const [zipFilesExpanded, setZipFilesExpanded] = useState<boolean>(false);
    const [selectedZipFilePath, setSelectedZipFilePath] = useState<string | null>(null);
    const [planModalVisible, setPlanModalVisible] = useState<boolean>(false);
    const [editPlanTitle, setEditPlanTitle] = useState<string>(
      message.draftPlan?.title || ''
    );
    const [editPlanSummary, setEditPlanSummary] = useState<string>(
      message.draftPlan?.summary || ''
    );
    const [editStepsText, setEditStepsText] = useState<string>(
      (message.draftPlan?.steps || [])
        .map((s) => `${s.title} | ${s.description}`)
        .join('\n')
    );
    const [aiPlanFeedback, setAiPlanFeedback] = useState<string>('');

    const visibleToolCalls = useMemo(
      () =>
        (message.toolCalls ?? []).filter((tc) => {
          if (!tc) return false;
          if (tc.name === 'think') return false;
          if (isLearningTool(tc.name) && !learningActive) return false;
          if (
            message.todos &&
            message.todos.length > 0 &&
            (tc.name === 'create_todo' || tc.name === 'update_todo')
          ) {
            return false;
          }
          return true;
        }),
      [message.toolCalls, message.todos, learningActive]
    );

    const segments = useMemo(() => {
      if (!message.content) return [];
      return parseMarkdownSegments(message.content);
    }, [message.content]);

    const handleCopyMessage = useCallback(async () => {
      try {
        if (message.content) {
          await Clipboard.setStringAsync(message.content);
        }
      } catch (e) {
        console.log('[ChatBubble] Copy error:', e);
      }
    }, [message.content]);

    const todoStats = useMemo(() => {
      if (!message.todos || message.todos.length === 0) return null;
      const total = message.todos.length;
      let completed = 0;
      let pending = 0;
      for (const todo of message.todos) {
        const live = appTodos.find((at) => at.id === todo.id);
        if (live ? live.completed : todo.completed) {
          completed++;
        } else {
          pending++;
        }
      }
      return { total, completed, pending };
    }, [message.todos, appTodos]);

    const hasThinking = Boolean(message.thinking || message.isThinking);
    const hasTodos = Boolean(
      message.todos && message.todos.length > 0 && todoStats
    );
    const hasToolCalls = visibleToolCalls.length > 0;
    const hasCopyButton =
      !isUser && message.content && message.content.length > 0;

    if (message.role === 'tool') return null;

    const openEditPlanModal = () => {
      if (!message.draftPlan) return;
      setEditPlanTitle(message.draftPlan.title);
      setEditPlanSummary(message.draftPlan.summary);
      setEditStepsText(
        message.draftPlan.steps
          .map((s) => `${s.title} | ${s.description}`)
          .join('\n')
      );
      setAiPlanFeedback('');
      setPlanModalVisible(true);
    };

    const handleSaveEditedPlan = (sendAiFeedback: boolean) => {
      if (!message.draftPlan || !onUpdateDraftPlan) {
        setPlanModalVisible(false);
        return;
      }
      const parsedSteps = editStepsText
        .split('\n')
        .map((line, idx) => {
          const clean = line.trim();
          if (!clean) return null;
          const parts = clean.split('|');
          const title = (parts[0] || `Step ${idx + 1}`).trim();
          const description = (parts.slice(1).join('|') || title).trim();
          return {
            id: `step_${idx}_${Date.now()}`,
            title,
            description,
          };
        })
        .filter(Boolean) as { id: string; title: string; description: string }[];

      const updated: DraftedAgentPlan = {
        ...message.draftPlan,
        title: editPlanTitle.trim() || message.draftPlan.title,
        summary: editPlanSummary.trim() || message.draftPlan.summary,
        steps: parsedSteps.length > 0 ? parsedSteps : message.draftPlan.steps,
      };
      setPlanModalVisible(false);
      onUpdateDraftPlan(
        message.id,
        updated,
        sendAiFeedback ? aiPlanFeedback.trim() : undefined
      );
    };

    return (
      <View
        style={[
          styles.container,
          isUser ? styles.userContainer : styles.aiContainer,
        ]}
      >
        {!isUser && (
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Bot size={14} color={IDE.primary} />
            </View>
            <Text style={styles.roleName}>Dev0 Assistant</Text>
          </View>
        )}

        {isUser && (
          <View style={[styles.avatarRow, styles.userAvatarRow]}>
            <Text style={styles.roleName}>You</Text>
            <View style={[styles.avatar, styles.userAvatar]}>
              <User size={14} color={IDE.bg} />
            </View>
          </View>
        )}

        <View
          style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}
        >
          {hasThinking ? (
            <ThinkingBlock
              thinking={message.thinking || ''}
              isLive={Boolean(message.isThinking)}
              phase={message.isThinking ? 'Reasoning & analyzing...' : undefined}
            />
          ) : null}

          {segments.map((seg, i) => {
            if (seg.type === 'iframe') {
              const h = seg.height ? parseInt(seg.height, 10) : 100;
              const w = seg.width ? parseInt(seg.width, 10) : '100%';
              return (
                <View
                  key={i}
                  style={{
                    height: h,
                    width: w as any,
                    borderRadius: seg.borderRadius
                      ? parseInt(seg.borderRadius, 10)
                      : 0,
                    overflow: 'hidden',
                    marginVertical: 8,
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <WebView
                    source={{ uri: seg.src || 'about:blank' }}
                    style={{
                      height: h,
                      width: '100%',
                      backgroundColor: 'transparent',
                    }}
                    scrollEnabled={false}
                  />
                </View>
              );
            }
            if (seg.type === 'code') {
              return (
                <CodeBlock
                  key={i}
                  code={seg.content}
                  language={seg.language || 'plain'}
                />
              );
            }
            return (
              <Text key={i} style={[styles.text, isUser && styles.userText]}>
                {formatInlineText(seg.content)}
              </Text>
            );
          })}

          {/* Interactive Downloadable ZIP Graphic Card (Normal Chat Mode) */}
          {message.zipArtifact && (
            <View style={styles.zipArtifactCard}>
              <View style={styles.zipCardHeader}>
                <View style={styles.zipIconBox}>
                  <Archive size={18} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zipCardKicker}>
                    DOWNLOADABLE ZIP ARCHIVE · CHAT BUNDLE
                  </Text>
                  <Text style={styles.zipCardTitle}>
                    {message.zipArtifact.archiveName}
                  </Text>
                  <Text style={styles.zipCardDesc}>
                    {message.zipArtifact.description} ·{' '}
                    {message.zipArtifact.entries.length} file
                    {message.zipArtifact.entries.length === 1 ? '' : 's'} (
                    {Math.max(
                      1,
                      Math.round(message.zipArtifact.totalSizeBytes / 1024)
                    )}{' '}
                    KB)
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.zipDownloadBtn}
                  onPress={() => triggerChatZipDownload(message.zipArtifact!)}
                  activeOpacity={0.8}
                >
                  <Download size={14} color="#fff" />
                  <Text style={styles.zipDownloadBtnText}>Download .ZIP</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.zipFilesToggle}
                onPress={() => setZipFilesExpanded((p) => !p)}
                activeOpacity={0.75}
              >
                <FileCode size={13} color="#38BDF8" />
                <Text style={styles.zipFilesToggleText}>
                  {zipFilesExpanded ? 'Hide packaged files' : 'Inspect packaged files'} (
                  {message.zipArtifact.entries.length})
                </Text>
                {zipFilesExpanded ? (
                  <ChevronUp size={14} color={IDE.muted} />
                ) : (
                  <ChevronDown size={14} color={IDE.muted} />
                )}
              </TouchableOpacity>

              {zipFilesExpanded && (
                <View style={styles.zipFilesList}>
                  {message.zipArtifact.entries.map((entry) => {
                    const isPreviewOpen = selectedZipFilePath === entry.path;
                    return (
                      <View key={entry.path} style={styles.zipFileRowWrap}>
                        <TouchableOpacity
                          style={styles.zipFileRow}
                          onPress={() =>
                            setSelectedZipFilePath(
                              isPreviewOpen ? null : entry.path
                            )
                          }
                        >
                          <FileCode size={12} color={IDE.primary} />
                          <Text style={styles.zipFilePath}>{entry.path}</Text>
                          <Text style={styles.zipFileSize}>
                            {entry.sizeBytes} B
                          </Text>
                        </TouchableOpacity>
                        {isPreviewOpen && (
                          <CodeBlock
                            code={entry.content}
                            language={entry.path.split('.').pop() || 'txt'}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Interactive Drafted Execution Plan Graphic Card */}
          {message.draftPlan && (
            <View style={styles.draftPlanCard}>
              <View style={styles.draftPlanHeader}>
                <View style={styles.draftPlanBadgeRow}>
                  <Sparkles size={14} color="#10B981" />
                  <Text style={styles.draftPlanKicker}>
                    INTERACTIVE AGENT EXECUTION PLAN
                  </Text>
                </View>
                <Text style={styles.draftPlanTitle}>
                  {message.draftPlan.title}
                </Text>
                {message.draftPlan.summary ? (
                  <Text style={styles.draftPlanSummary}>
                    {message.draftPlan.summary}
                  </Text>
                ) : null}
              </View>

              <View style={styles.draftStepsList}>
                {message.draftPlan.steps.map((step, idx) => (
                  <View key={step.id || idx} style={styles.draftStepItem}>
                    <View style={styles.draftStepNumCircle}>
                      <Text style={styles.draftStepNumText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.draftStepTitle}>{step.title}</Text>
                      <Text style={styles.draftStepDesc}>
                        {step.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.draftPlanActions}>
                <TouchableOpacity
                  style={styles.editPlanBtn}
                  onPress={openEditPlanModal}
                  activeOpacity={0.8}
                >
                  <Edit3 size={14} color={IDE.text} />
                  <Text style={styles.editPlanBtnText}>Edit / Refine Plan</Text>
                </TouchableOpacity>

                {onProceedDraftPlan && (
                  <TouchableOpacity
                    style={styles.proceedPlanBtn}
                    onPress={() => onProceedDraftPlan(message.draftPlan!)}
                    activeOpacity={0.8}
                  >
                    <Play size={14} color="#fff" />
                    <Text style={styles.proceedPlanBtnText}>
                      Proceed in Agent Mode
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {hasTodos && (
            <View style={styles.inlineTodos}>
              <View style={styles.inlineTodosHeader}>
                <Text style={styles.inlineTodosTitle}>📋 Todos</Text>
                <View style={styles.todoBadgesRow}>
                  {todoStats!.pending > 0 && (
                    <View style={styles.todoPendingBadge}>
                      <Text style={styles.todoPendingText}>
                        {todoStats!.pending} open
                      </Text>
                    </View>
                  )}
                  <View style={styles.todoCountBadge}>
                    <Text style={styles.todoCountText}>
                      {todoStats!.completed}/{todoStats!.total}
                    </Text>
                  </View>
                </View>
              </View>
              {todoStats!.total > 0 && (
                <View style={styles.todoProgressBar}>
                  <View
                    style={[
                      styles.todoProgressFill,
                      { flex: todoStats!.completed / todoStats!.total },
                    ]}
                  />
                </View>
              )}
              {message.todos!.map((todo) => {
                const liveTodo = appTodos.find((t) => t.id === todo.id);
                const isCompleted = liveTodo
                  ? liveTodo.completed
                  : todo.completed;
                const todoText = liveTodo ? liveTodo.text : todo.text;
                return (
                  <TouchableOpacity
                    key={todo.id}
                    style={styles.inlineTodoItem}
                    onPress={() => updateTodoItem(todo.id, !isCompleted)}
                    activeOpacity={0.7}
                  >
                    {isCompleted ? (
                      <CheckSquare size={14} color={IDE.accent} />
                    ) : (
                      <Square size={14} color={IDE.muted} />
                    )}
                    <Text
                      style={[
                        styles.inlineTodoText,
                        isCompleted && styles.inlineTodoDone,
                      ]}
                    >
                      {todoText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {hasToolCalls && <CollapsedToolCalls toolCalls={visibleToolCalls} />}

          {hasCopyButton && (
            <TouchableOpacity
              style={styles.copyMsgBtn}
              onPress={handleCopyMessage}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Copy size={12} color={IDE.muted} />
              <Text style={styles.copyMsgText}>Copy</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Floating Plan Editor Modal */}
        <Modal
          visible={planModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPlanModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>
                  Edit Execution Plan or Ask Dev0 to Refine
                </Text>
                <TouchableOpacity onPress={() => setPlanModalVisible(false)}>
                  <X size={18} color={IDE.muted} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
                <Text style={styles.modalLabel}>Plan Title</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPlanTitle}
                  onChangeText={setEditPlanTitle}
                  placeholder="Plan title"
                  placeholderTextColor={IDE.muted}
                />
                <Text style={styles.modalLabel}>Architecture Summary</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 54 }]}
                  value={editPlanSummary}
                  onChangeText={setEditPlanSummary}
                  placeholder="Summary"
                  placeholderTextColor={IDE.muted}
                  multiline
                />
                <Text style={styles.modalLabel}>
                  Steps (one per line: Title | Description)
                </Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 110, fontFamily: 'monospace' }]}
                  value={editStepsText}
                  onChangeText={setEditStepsText}
                  multiline
                />
                <Text style={styles.modalLabel}>
                  Or tell Dev0 what to add / change in this plan:
                </Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 54 }]}
                  value={aiPlanFeedback}
                  onChangeText={setAiPlanFeedback}
                  placeholder="e.g. Add a unit test step and Docker verification..."
                  placeholderTextColor={IDE.muted}
                  multiline
                />
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.editPlanBtn}
                  onPress={() => handleSaveEditedPlan(false)}
                >
                  <Text style={styles.editPlanBtnText}>Save Manual Edits</Text>
                </TouchableOpacity>
                {aiPlanFeedback.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.proceedPlanBtn}
                    onPress={() => handleSaveEditedPlan(true)}
                  >
                    <Sparkles size={14} color="#fff" />
                    <Text style={styles.proceedPlanBtnText}>
                      Ask AI to Update Plan
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }
);

ChatBubble.displayName = 'ChatBubble';

const CollapsedToolCalls = React.memo(({ toolCalls }: { toolCalls: any[] }) => {
  const [expanded, setExpanded] = React.useState<boolean>(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const completedCount = toolCalls.filter(
    (tc) => tc?.status === 'completed'
  ).length;
  const errorCount = toolCalls.filter((tc) => tc?.status === 'error').length;
  const totalCount = toolCalls.length;

  return (
    <View style={styles.toolCallsWrapper}>
      <TouchableOpacity
        style={styles.toolCallsHeader}
        onPress={() => setExpanded((p) => !p)}
        activeOpacity={0.7}
      >
        <Text style={styles.toolCallsHeaderText}>
          🔧 {totalCount} tool{totalCount !== 1 ? 's' : ''} used
        </Text>
        <View style={styles.toolCallsBadges}>
          {completedCount > 0 && (
            <View style={styles.toolBadgeOk}>
              <Text style={styles.toolBadgeOkText}>{completedCount}✓</Text>
            </View>
          )}
          {errorCount > 0 && (
            <View style={styles.toolBadgeErr}>
              <Text style={styles.toolBadgeErrText}>{errorCount}✗</Text>
            </View>
          )}
        </View>
        {expanded ? (
          <ChevronUp size={14} color={IDE.muted} />
        ) : (
          <ChevronDown size={14} color={IDE.muted} />
        )}
      </TouchableOpacity>
      {expanded && (
        <View style={styles.toolCallsContainer}>
          {toolCalls.map((tc) =>
            tc ? <ToolCallView key={tc.id} toolCall={tc} /> : null
          )}
        </View>
      )}
    </View>
  );
});

CollapsedToolCalls.displayName = 'CollapsedToolCalls';

function formatInlineText(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    if (line.trim().startsWith('|')) {
      const tableLines = [];
      while (li < lines.length && lines[li].trim().startsWith('|')) {
        tableLines.push(lines[li]);
        li++;
      }
      li--;

      const rows = [];
      let isHeader = true;
      for (let r = 0; r < tableLines.length; r++) {
        const rowStr = tableLines[r].trim();
        if (
          /^\|[-:| ]+\|/.test(rowStr) ||
          (/^[-\s|:]+$/.test(rowStr) &&
            rowStr.includes('-') &&
            rowStr.includes('|'))
        ) {
          isHeader = false;
          continue;
        }
        const cells = rowStr
          .split('|')
          .filter(
            (c, i, arr) =>
              !(i === 0 && c === '') && !(i === arr.length - 1 && c === '')
          );

        rows.push(
          <View
            key={'tr' + li + '-' + r}
            style={[
              styles.tableRow,
              isHeader && styles.tableHeaderRow,
              r === tableLines.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            {cells.map((cell, ci) => (
              <View
                key={'tc' + li + '-' + r + '-' + ci}
                style={[
                  styles.tableCell,
                  ci === cells.length - 1 && styles.tableCellLast,
                ]}
              >
                <Text
                  style={
                    isHeader ? styles.tableHeaderText : styles.tableCellText
                  }
                >
                  {formatInlineParts(cell.trim())}
                </Text>
              </View>
            ))}
          </View>
        );
        if (r === 0) isHeader = false;
      }

      elements.push(
        <ScrollView
          key={'tbl' + li}
          horizontal
          showsHorizontalScrollIndicator={Platform.OS === 'web'}
          style={{ marginVertical: 8 }}
        >
          <View style={styles.tableContainer}>{rows}</View>
        </ScrollView>
      );
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)![1].length;
      const headingText = line.replace(/^#{1,3}\s+/, '');
      const fontSize = level === 1 ? 18 : level === 2 ? 16 : 14;
      elements.push(
        <Text
          key={'h' + li}
          style={[styles.heading, { fontSize, marginTop: li > 0 ? 10 : 0 }]}
        >
          {formatInlineParts(headingText)}
        </Text>
      );
      continue;
    }

    if (/^\s*[-*]\s/.test(line)) {
      const indent = (line.match(/^(\s*)/) || [''])[0].length;
      const bulletText = line.replace(/^\s*[-*]\s+/, '');
      elements.push(
        <View
          key={'li' + li}
          style={[styles.listItem, { paddingLeft: 8 + indent * 6 }]}
        >
          <Text style={styles.listBullet}>{'\u2022'}</Text>
          <Text style={styles.listText}>{formatInlineParts(bulletText)}</Text>
        </View>
      );
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const num = line.match(/^\s*(\d+)\./)![1];
      const olText = line.replace(/^\s*\d+\.\s+/, '');
      elements.push(
        <View key={'ol' + li} style={styles.listItem}>
          <Text style={styles.listNumber}>{num}.</Text>
          <Text style={styles.listText}>{formatInlineParts(olText)}</Text>
        </View>
      );
      continue;
    }

    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<View key={'hr' + li} style={styles.hr} />);
      continue;
    }

    if (line.trim() === '') {
      elements.push(<Text key={'br' + li}>{'\n'}</Text>);
      continue;
    }

    elements.push(
      <Text key={'t' + li}>
        {formatInlineParts(line)}
        {li < lines.length - 1 ? '\n' : ''}
      </Text>
    );
  }

  return elements;
}

function formatInlineParts(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|~~[^~]+~~)/g
  );
  return parts.map((part, i) => {
    if (!part) return null;
    if (
      (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('__') && part.endsWith('__'))
    ) {
      return (
        <Text key={i} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (
      (part.startsWith('*') &&
        part.endsWith('*') &&
        !part.startsWith('**')) ||
      (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__'))
    ) {
      return (
        <Text key={i} style={styles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text key={i} style={styles.inlineCode}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return (
        <Text key={i} style={styles.strikethrough}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

const CodeBlock = React.memo(
  ({ code, language }: { code: string; language: string }) => {
    const handleCopy = useCallback(async () => {
      try {
        await Clipboard.setStringAsync(code);
      } catch (e) {
        console.log('[Copy] Error:', e);
      }
    }, [code]);

    const lines = useMemo(() => code.split('\n'), [code]);

    return (
      <View style={cbStyles.container}>
        <View style={cbStyles.header}>
          <Text style={cbStyles.lang}>{language}</Text>
          <TouchableOpacity
            onPress={handleCopy}
            style={cbStyles.copyBtn}
            activeOpacity={0.6}
          >
            <Copy size={12} color={IDE.muted} />
            <Text style={cbStyles.copyText}>Copy</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={Platform.OS === 'web'}
          style={cbStyles.codeScroll}
        >
          <View style={cbStyles.code}>
            {lines.map((line, i) => (
              <View key={i} style={cbStyles.line}>
                <Text style={cbStyles.lineNum}>{i + 1}</Text>
                <Text style={cbStyles.lineContent}>
                  {highlightLine(line, language).map((token, j) => (
                    <Text key={j} style={{ color: token.color }}>
                      {token.text}
                    </Text>
                  ))}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }
);

CodeBlock.displayName = 'CodeBlock';

export default ChatBubble;

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  userContainer: {
    alignItems: 'flex-end' as const,
  },
  aiContainer: {
    alignItems: 'flex-start' as const,
  },
  avatarRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
    gap: 6,
  },
  userAvatarRow: {
    justifyContent: 'flex-end' as const,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: IDE.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  userAvatar: {
    backgroundColor: IDE.primary,
  },
  roleName: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: IDE.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  bubble: {
    maxWidth: '92%',
    borderRadius: 12,
    padding: 12,
  },
  userBubble: {
    backgroundColor: IDE.surface,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: 'transparent',
    paddingLeft: 0,
    paddingRight: 0,
    maxWidth: '100%',
  },
  text: {
    fontSize: 14,
    color: IDE.text,
    lineHeight: 22,
  },
  userText: {
    color: IDE.text,
  },
  bold: {
    fontWeight: '700' as const,
    color: IDE.text,
  },
  italic: {
    fontStyle: 'italic' as const,
    color: IDE.text,
  },
  strikethrough: {
    textDecorationLine: 'line-through' as const,
    color: IDE.muted,
  },
  heading: {
    fontWeight: '700' as const,
    color: IDE.text,
    marginBottom: 4,
    lineHeight: 26,
  },
  listItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    paddingLeft: 8,
    marginVertical: 1,
  },
  listBullet: {
    fontSize: 14,
    color: IDE.primary,
    lineHeight: 22,
    width: 12,
  },
  listNumber: {
    fontSize: 14,
    color: IDE.primary,
    lineHeight: 22,
    width: 18,
    fontWeight: '600' as const,
  },
  listText: {
    fontSize: 14,
    color: IDE.text,
    lineHeight: 22,
    flex: 1,
  },
  hr: {
    height: 1,
    backgroundColor: IDE.border,
    marginVertical: 8,
  },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: IDE.surface,
    color: IDE.accent,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  zipArtifactCard: {
    marginTop: 10,
    backgroundColor: '#0B1528',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#38BDF855',
    padding: 12,
    gap: 8,
  },
  zipCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zipIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#38BDF81A',
    borderWidth: 1,
    borderColor: '#38BDF845',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zipCardKicker: {
    fontSize: 9,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.6,
  },
  zipCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IDE.text,
  },
  zipCardDesc: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 1,
  },
  zipDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  zipDownloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  zipFilesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  zipFilesToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
    flex: 1,
  },
  zipFilesList: {
    gap: 4,
    marginTop: 4,
  },
  zipFileRowWrap: {
    backgroundColor: IDE.bg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  zipFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zipFilePath: {
    fontSize: 12,
    color: IDE.text,
    fontFamily: 'monospace',
    flex: 1,
  },
  zipFileSize: {
    fontSize: 10,
    color: IDE.muted,
  },
  draftPlanCard: {
    marginTop: 10,
    backgroundColor: '#0C1924',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#10B98155',
    padding: 14,
    gap: 10,
  },
  draftPlanHeader: {
    gap: 4,
  },
  draftPlanBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  draftPlanKicker: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 0.6,
  },
  draftPlanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IDE.text,
  },
  draftPlanSummary: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 17,
  },
  draftStepsList: {
    gap: 6,
  },
  draftStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: IDE.bg,
    borderRadius: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  draftStepNumCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B98122',
    borderWidth: 1,
    borderColor: '#10B98160',
    justifyContent: 'center',
    alignItems: 'center',
  },
  draftStepNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  draftStepTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IDE.text,
  },
  draftStepDesc: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 1,
  },
  draftPlanActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  editPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editPlanBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: IDE.text,
  },
  proceedPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  proceedPlanBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: IDE.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: IDE.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IDE.bg,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  modalHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IDE.text,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.textSecondary,
  },
  modalInput: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: IDE.text,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 12,
    backgroundColor: IDE.bg,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
  },
  toolCallsWrapper: {
    backgroundColor: IDE.bg + 'CC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    marginTop: 8,
    overflow: 'hidden' as const,
  },
  toolCallsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  toolCallsHeaderText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: IDE.textSecondary,
    flex: 1,
  },
  toolCallsBadges: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  toolBadgeOk: {
    backgroundColor: IDE.accent + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolBadgeOkText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: IDE.accent,
  },
  toolBadgeErr: {
    backgroundColor: IDE.danger + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolBadgeErrText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: IDE.danger,
  },
  toolCallsContainer: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 6,
  },
  inlineTodos: {
    backgroundColor: IDE.accent + '08',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.accent + '20',
    padding: 10,
    marginVertical: 6,
  },
  inlineTodosHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  inlineTodosTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: IDE.accent,
  },
  todoBadgesRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  todoPendingBadge: {
    backgroundColor: IDE.warning + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  todoPendingText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.warning,
  },
  todoCountBadge: {
    backgroundColor: IDE.accent + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  todoCountText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: IDE.accent,
  },
  todoProgressBar: {
    height: 3,
    backgroundColor: IDE.border,
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden' as const,
    flexDirection: 'row' as const,
  },
  todoProgressFill: {
    height: 3,
    backgroundColor: IDE.accent,
    borderRadius: 2,
  },
  inlineTodoItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 4,
  },
  inlineTodoText: {
    fontSize: 13,
    color: IDE.text,
    flex: 1,
  },
  inlineTodoDone: {
    textDecorationLine: 'line-through' as const,
    color: IDE.muted,
  },
  copyMsgBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start' as const,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  tableHeaderRow: {
    backgroundColor: IDE.surface,
  },
  tableCell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: IDE.border,
    justifyContent: 'center',
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  tableHeaderText: {
    fontWeight: '700',
    fontSize: 13,
    color: IDE.text,
  },
  tableCellText: {
    fontSize: 13,
    color: IDE.text,
  },
  copyMsgText: {
    fontSize: 11,
    color: IDE.muted,
  },
});

const cbStyles = StyleSheet.create({
  container: {
    backgroundColor: IDE.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    marginVertical: 8,
    overflow: 'hidden' as const,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: IDE.surface,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  lang: {
    fontSize: 11,
    color: IDE.muted,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  copyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  copyText: {
    fontSize: 11,
    color: IDE.muted,
  },
  codeScroll: {
    flexGrow: 0,
  },
  code: {
    padding: 10,
    minWidth: '100%',
  },
  line: {
    flexDirection: 'row' as const,
    minHeight: 18,
  },
  lineNum: {
    width: 28,
    textAlign: 'right' as const,
    color: IDE.muted,
    fontSize: 11,
    fontFamily: 'monospace',
    marginRight: 10,
    opacity: 0.6,
  },
  lineContent: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
