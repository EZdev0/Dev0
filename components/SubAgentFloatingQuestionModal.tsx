import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import {
  Cpu,
  MessageSquare,
  Send,
  Zap,
  X,
  FileCode,
  BookmarkCheck,
  Sparkles,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import {
  SubAgentQuestionRequest,
  SubAgentQuestionResponse,
} from '@/utils/subagent-question-relay';

interface SubAgentFloatingQuestionModalProps {
  visible: boolean;
  request: SubAgentQuestionRequest | null;
  onSubmit: (response: SubAgentQuestionResponse) => void;
  onSkip: (response: SubAgentQuestionResponse) => void;
  onClose: () => void;
}

const ROLE_OPTIONS: { id: string; label: string; defaultTask: string }[] = [
  { id: 'developer', label: 'Developer', defaultTask: 'Implement requested feature and verify code changes' },
  { id: 'localizer', label: 'Localizer', defaultTask: 'Localize relevant files and functions via Synapse Graph' },
  { id: 'analyst', label: 'Analyst', defaultTask: 'Analyze project architecture and identify root causes' },
  { id: 'researcher', label: 'Researcher', defaultTask: 'Search documentation and best practices' },
  { id: 'tester', label: 'Tester', defaultTask: 'Create and run unit tests for edge cases' },
  { id: 'critic', label: 'Critic', defaultTask: 'Perform strict code audit and security review' },
];

export const SubAgentFloatingQuestionModal: React.FC<SubAgentFloatingQuestionModalProps> = ({
  visible,
  request,
  onSubmit,
  onSkip,
  onClose,
}) => {
  const [subAgentName, setSubAgentName] = useState<string>('Custom Specialist Sub-Agent');
  const [subAgentRole, setSubAgentRole] = useState<string>('developer');
  const [taskInstruction, setTaskInstruction] = useState<string>('');
  const [allowedFilesText, setAllowedFilesText] = useState<string>('*');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveToSubAgentList, setSaveToSubAgentList] = useState<boolean>(true);

  useEffect(() => {
    if (request) {
      setSubAgentName(request.subAgentName || 'Custom Specialist Sub-Agent');
      setSubAgentRole(request.subAgentRole || 'developer');
      setTaskInstruction(request.suggestedTask || '');
      setAllowedFilesText((request.allowedFiles || ['*']).join(', '));
      setSaveToSubAgentList(request.saveToSubAgentList ?? true);
      const initialAnswers: Record<string, string> = {};
      for (const q of request.questions) {
        initialAnswers[q.id] = q.answer || '';
      }
      setAnswers(initialAnswers);
    }
  }, [request]);

  if (!visible || !request) return null;

  const handleSelectRole = (roleId: string, roleLabel: string, defaultTask: string) => {
    setSubAgentRole(roleId);
    if (
      !subAgentName.trim() ||
      subAgentName === 'Custom Specialist Sub-Agent' ||
      subAgentName.endsWith('Sub-Agent')
    ) {
      setSubAgentName(`${roleLabel} Sub-Agent`);
    }
    if (!taskInstruction.trim()) {
      setTaskInstruction(defaultTask);
    }
  };

  const buildResponsePayload = (skipped: boolean): SubAgentQuestionResponse => {
    const parsedFiles = allowedFilesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      requestId: request.id,
      subAgentName: subAgentName.trim() || `${subAgentRole} Sub-Agent`,
      subAgentRole: subAgentRole.trim() || 'developer',
      taskInstruction: taskInstruction.trim(),
      allowedFiles: parsedFiles.length > 0 ? parsedFiles : ['*'],
      answers: request.questions.map((q) => ({
        question: q.question,
        answer: answers[q.id] || '',
      })),
      saveToSubAgentList,
      skipped,
    };
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.floatingCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Cpu size={18} color={IDE.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeRow}>
                  <Text style={styles.badgeText}>FLOATING SUB-AGENT WINDOW</Text>
                  <Text style={styles.relayBadgeText}>→ MAIN-ERSTELLER RELAY</Text>
                </View>
                <Text style={styles.headerTitle}>
                  Sub-Agent Konfigurieren & Rückfragen Beantworten
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={IDE.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {/* Role Selector */}
            <Text style={styles.sectionLabel}>1. Sub-Agent Rolle wählen</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((r) => {
                const active = subAgentRole.toLowerCase() === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleChip, active && styles.roleChipActive]}
                    onPress={() => handleSelectRole(r.id, r.label, r.defaultTask)}
                    activeOpacity={0.75}
                  >
                    <Sparkles size={11} color={active ? '#fff' : IDE.primary} />
                    <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Name & Allowed Files */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>2. Name (für gespeicherte Liste)</Text>
                <TextInput
                  style={styles.input}
                  value={subAgentName}
                  onChangeText={setSubAgentName}
                  placeholder="z.B. Frontend Developer Sub-Agent"
                  placeholderTextColor={IDE.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>
                  <FileCode size={11} color={IDE.primary} /> Erlaubte Dateien (Globs)
                </Text>
                <TextInput
                  style={styles.input}
                  value={allowedFilesText}
                  onChangeText={setAllowedFilesText}
                  placeholder="*, app/**, components/**"
                  placeholderTextColor={IDE.muted}
                />
              </View>
            </View>

            {/* Questions from Sub-Agent / AI */}
            <View style={styles.questionsBox}>
              <View style={styles.questionsHeader}>
                <MessageSquare size={14} color={IDE.warning} />
                <Text style={styles.questionsTitle}>
                  Rückfragen ({request.questions.length}) — Antworten gehen direkt an den Main-Ersteller
                </Text>
              </View>

              {request.questions.map((q, idx) => (
                <View key={q.id} style={styles.questionItem}>
                  <Text style={styles.questionPrompt}>
                    {idx + 1}. {q.question}
                  </Text>
                  <TextInput
                    style={styles.questionInput}
                    value={answers[q.id] || ''}
                    onChangeText={(txt) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: txt }))
                    }
                    placeholder="Deine Antwort für den Sub-Agent / Main-Ersteller..."
                    placeholderTextColor={IDE.muted}
                    multiline
                  />
                </View>
              ))}
            </View>

            {/* Concrete Task Instruction */}
            <Text style={styles.sectionLabel}>3. Konkrete Aufgabe / Mission (optional ergänzen)</Text>
            <TextInput
              style={[styles.input, { minHeight: 58, textAlignVertical: 'top' }]}
              value={taskInstruction}
              onChangeText={setTaskInstruction}
              placeholder="Was genau soll dieser Sub-Agent ausführen?"
              placeholderTextColor={IDE.muted}
              multiline
            />

            {/* Save in Sub-Agent List Toggle */}
            <View style={styles.saveSwitchRow}>
              <View style={styles.saveSwitchLeft}>
                <BookmarkCheck size={16} color={IDE.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.saveSwitchTitle}>
                    Als gespeicherten Sub-Agent in der Liste anzeigen
                  </Text>
                  <Text style={styles.saveSwitchSub}>
                    Speichert diesen Sub-Agent dauerhaft in deiner Sub-Agent-Liste (Chat, Tools & Studio)
                  </Text>
                </View>
              </View>
              <Switch
                value={saveToSubAgentList}
                onValueChange={setSaveToSubAgentList}
                trackColor={{ false: IDE.border, true: IDE.accent }}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => onSkip(buildResponsePayload(true))}
              activeOpacity={0.75}
            >
              <Zap size={14} color={IDE.warning} />
              <Text style={styles.skipBtnText}>Überspringen (Standard nutzen)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => onSubmit(buildResponsePayload(false))}
              activeOpacity={0.8}
            >
              <Send size={14} color="#fff" />
              <Text style={styles.submitBtnText}>
                An Main-Ersteller senden & Speichern
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  floatingCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: IDE.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IDE.primary + '55',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: IDE.bg,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: IDE.primary + '20',
    borderWidth: 1,
    borderColor: IDE.primary + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: IDE.primary,
    letterSpacing: 0.6,
  },
  relayBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: IDE.accent,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IDE.text,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: IDE.surface,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 16,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.textSecondary,
    marginBottom: 4,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  roleChipActive: {
    backgroundColor: IDE.primary,
    borderColor: IDE.primary,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: IDE.text,
  },
  roleChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: IDE.text,
  },
  questionsBox: {
    backgroundColor: IDE.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IDE.warning + '45',
    padding: 12,
    gap: 10,
  },
  questionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  questionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IDE.warning,
    flex: 1,
  },
  questionItem: {
    gap: 5,
  },
  questionPrompt: {
    fontSize: 12,
    fontWeight: '600',
    color: IDE.text,
    lineHeight: 17,
  },
  questionInput: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: IDE.text,
    minHeight: 42,
  },
  saveSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.accent + '45',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  saveSwitchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  saveSwitchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IDE.text,
  },
  saveSwitchSub: {
    fontSize: 10,
    color: IDE.muted,
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IDE.bg,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: IDE.warning + '15',
    borderWidth: 1,
    borderColor: IDE.warning + '40',
  },
  skipBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.warning,
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: IDE.accent,
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});

export default SubAgentFloatingQuestionModal;
