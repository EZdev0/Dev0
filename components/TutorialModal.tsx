import React, { useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileArchive,
  GitBranch,
  Network,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';

interface TutorialModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: 'projects' | 'chat' | 'tools' | 'settings') => void;
}

interface TutorialStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: 'chat' | 'skills' | 'graph' | 'subagents' | 'git';
  highlights: { title: string; body: string }[];
  proTip: string;
  actionLabel?: string;
  actionTab?: 'projects' | 'chat' | 'tools' | 'settings';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'modes',
    badge: 'STEP 1 OF 5 • CORE WORKFLOWS',
    title: 'Normal Chat Mode vs. Agent Mode',
    subtitle:
      'Dev0 separates lightweight conversational Q&A from autonomous multi-file engineering so tools never collide.',
    icon: 'chat',
    highlights: [
      {
        title: 'Normal Chat Mode (Agent Toggle OFF)',
        body: 'Ideal for brainstorming, code snippets, cross-chat recall, web research, and downloadable .zip bundles (zip_create). Project filesystem tools are strictly isolated.',
      },
      {
        title: 'Agent Mode (Agent Toggle ON)',
        body: 'Unlocks full read/write project file access, dependency checks, Git restore points, and autonomous Sub-Agent orchestration.',
      },
      {
        title: 'Animated Reasoning Orb -> Single Stream Box',
        body: 'Forced Extended Thinking starts as an animated Reasoning Orb while the model initializes, then seamlessly expands into one single text-streaming box.',
      },
    ],
    proTip:
      'Look at the bottom-right corner of any chat message to see which YAML Skills and AGENTS.md rules were automatically loaded by the system for that turn!',
    actionLabel: 'Open AI Chat',
    actionTab: 'chat',
  },
  {
    id: 'yaml-skills',
    badge: 'STEP 2 OF 5 • SELF-LEARNING & YAML SKILLS',
    title: 'Extra YAML Learning, AGENTS.md & .ZIP Skill Packs',
    subtitle:
      'Replace static identity files with structured YAML frontmatter skills, custom trigger phrases, and 1-click AI repair.',
    icon: 'skills',
    highlights: [
      {
        title: 'Upload .md, .yml, AGENTS.md, or .zip Packs',
        body: 'Upload single skill files or a multi-skill .zip archive in Sub-Agent & Skill Studio or Settings. All valid skills are extracted automatically.',
      },
      {
        title: 'Corrupted YAML Detection (!) & 1-Click AI Fix',
        body: 'If an uploaded AGENTS.md or skill file lacks valid YAML frontmatter (--- ... ---), Dev0 flags it with an exclamation icon (!) and offers a 1-click "Fix with AI" button.',
      },
      {
        title: 'Background vs. Custom Trigger Words',
        body: 'Configure each skill or AGENTS.md rule to load Always in Background, only when specific Custom Trigger Words/Phrases appear in your prompt, or Manually.',
      },
    ],
    proTip:
      'You can also ask the AI in Chat to call create_yaml_skill to author new validated YAML skills on the fly.',
    actionLabel: 'Configure in Settings',
    actionTab: 'settings',
  },
  {
    id: 'synapse-graph',
    badge: 'STEP 3 OF 5 • INTERACTIVE SYNAPSE GRAPH',
    title: 'Memory Graph, Code Graph & Drag-and-Drop Nodes',
    subtitle:
      'Explore your persistent knowledge synapses and codebase structure inside the Tools -> Graph & Search tabs.',
    icon: 'graph',
    highlights: [
      {
        title: 'Left-Click, Right-Click & Drag-and-Drop',
        body: 'Drag any node to rearrange the layout. Left-click (or tap) a node to inspect its connections; right-click (or long-press on Android) to open the quick action menu.',
      },
      {
        title: 'Standalone Memory Graph vs. Project Code Graph',
        body: 'Switch between the Memory Graph (persistent learnings, YAML skills, and memory links usable even without a project) and the Project Code Graph (files, functions, imports).',
      },
      {
        title: 'Codebase Structure in Search',
        body: 'Open Tools -> Search to filter both full-text file matches and interactive Codebase Structure & Graph nodes in real time.',
      },
    ],
    proTip:
      'Right-click any Memory node in the Synapse Graph to link a related memory or clean up outdated entries non-destructively.',
    actionLabel: 'Open Tools & Graph',
    actionTab: 'tools',
  },
  {
    id: 'subagents',
    badge: 'STEP 4 OF 5 • MULTI-AGENT ORCHESTRATION',
    title: 'Sub-Agent Floating Menu & .agents/ Cron Workflows',
    subtitle:
      'Design specialized Sub-Agents with glob file scopes, live read-only execution streams, and scheduled jobs.',
    icon: 'subagents',
    highlights: [
      {
        title: 'Smart Sub-Agent Floating Configurator',
        body: 'In Normal Chat Mode, asking for a Sub-Agent opens the interactive Sub-Agent Floating Modal (with "AI Generate All") and saves your configured agent to the Saved Sub-Agents list.',
      },
      {
        title: 'Hidden .agents/<slug>/ Workspaces',
        body: 'Each Sub-Agent maintains its own English README.md, RULES.md, STATUS.md, and LOG.md and must call finish_task before returning to the Main Agent.',
      },
      {
        title: 'Dashboard in Slot 1 & Live Read-Only Stream',
        body: 'Monitor all active Sub-Agents in Tools -> Dashboard (Slot 1). Click any Sub-Agent to watch its live read-only token stream.',
      },
    ],
    proTip:
      'Use the Workflow & Cron Graph card in Chat to pause/sleep running agents or schedule recurring checks.',
    actionLabel: 'Open Agent Dashboard',
    actionTab: 'tools',
  },
  {
    id: 'projects-git',
    badge: 'STEP 5 OF 5 • CLASSIC PROJECTS & DUAL GIT',
    title: 'Classic File Tree, 1-Click Delete & Dual Restore Points',
    subtitle:
      'Manage your sandboxed workspaces cleanly with instant snapshot recovery and responsive PC/Android controls.',
    icon: 'git',
    highlights: [
      {
        title: 'Classic File Tree First',
        body: 'The Projects tab defaults to the clean File Tree & Project Switcher. Advanced Git & Restore Points and Graph shortcuts live in a dedicated toolbar.',
      },
      {
        title: 'Dual Browser + Docker Git Restore Points',
        body: 'Create named restore points before risky refactors or let the AI call git_create_restore_point and git_restore_point automatically.',
      },
      {
        title: '1-Click Project Deletion & Responsive Toolbar',
        body: 'Delete any project cleanly using the trash button on the project bar, and enjoy wrapping toolbars that never clip on narrow PC windows or Android screens.',
      },
    ],
    proTip:
      'Every restore point captures the full project file tree so you can roll back with one click at any time.',
    actionLabel: 'Open Projects View',
    actionTab: 'projects',
  },
];

export default function TutorialModal({
  visible,
  onClose,
  onNavigateTab,
}: TutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = TUTORIAL_STEPS[stepIndex] || TUTORIAL_STEPS[0];

  const renderStepIcon = (icon: TutorialStep['icon']) => {
    switch (icon) {
      case 'chat':
        return <Sparkles size={22} color={IDE.primary} />;
      case 'skills':
        return <FileArchive size={22} color="#8B5CF6" />;
      case 'graph':
        return <Network size={22} color="#06B6D4" />;
      case 'subagents':
        return <Bot size={22} color={IDE.accent} />;
      case 'git':
        return <GitBranch size={22} color={IDE.warning} />;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBadge}>
                <BookOpen size={18} color={IDE.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Dev0 System Guide & Interactive Tutorial</Text>
                <Text style={styles.headerSubtitle}>
                  Complete English walkthrough of AI modes, YAML skills, Synapse Graph & Git
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Close tutorial"
            >
              <X size={18} color={IDE.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Step Pills */}
          <View style={styles.stepPillRow}>
            {TUTORIAL_STEPS.map((step, idx) => {
              const active = idx === stepIndex;
              return (
                <TouchableOpacity
                  key={step.id}
                  style={[styles.stepPill, active && styles.stepPillActive]}
                  onPress={() => setStepIndex(idx)}
                >
                  <Text style={[styles.stepPillText, active && styles.stepPillTextActive]}>
                    {idx + 1}. {step.id.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroBanner}>
              <View style={styles.heroIconWrap}>{renderStepIcon(currentStep.icon)}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepBadge}>{currentStep.badge}</Text>
                <Text style={styles.stepTitle}>{currentStep.title}</Text>
                <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
              </View>
            </View>

            {currentStep.highlights.map((item, idx) => (
              <View key={idx} style={styles.highlightCard}>
                <View style={styles.highlightHeader}>
                  <CheckCircle2 size={15} color={IDE.accent} />
                  <Text style={styles.highlightTitle}>{item.title}</Text>
                </View>
                <Text style={styles.highlightBody}>{item.body}</Text>
              </View>
            ))}

            <View style={styles.proTipBox}>
              <Zap size={15} color={IDE.warning} />
              <Text style={styles.proTipText}>
                <Text style={{ fontWeight: '700', color: IDE.warning }}>Pro Tip: </Text>
                {currentStep.proTip}
              </Text>
            </View>
          </ScrollView>

          {/* Footer Controls */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.navBtn, stepIndex === 0 && styles.navBtnDisabled]}
              disabled={stepIndex === 0}
              onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            >
              <ChevronLeft size={16} color={IDE.text} />
              <Text style={styles.navBtnText}>Previous</Text>
            </TouchableOpacity>

            <View style={styles.footerRightGroup}>
              {Boolean(currentStep.actionLabel && currentStep.actionTab && onNavigateTab) ? (
                <TouchableOpacity
                  style={styles.tryNowBtn}
                  onPress={() => {
                    if (currentStep.actionTab && onNavigateTab) {
                      onNavigateTab(currentStep.actionTab);
                    }
                    onClose();
                  }}
                >
                  <Wrench size={14} color={IDE.primary} />
                  <Text style={styles.tryNowBtnText}>{currentStep.actionLabel}</Text>
                </TouchableOpacity>
              ) : null}

              {stepIndex < TUTORIAL_STEPS.length - 1 ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() =>
                    setStepIndex((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1))
                  }
                >
                  <Text style={styles.primaryBtnText}>Next Step</Text>
                  <ChevronRight size={16} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                  <Text style={styles.primaryBtnText}>Finish Tutorial</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 14, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: IDE.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: IDE.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    backgroundColor: IDE.bg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: IDE.primary + '20',
    borderWidth: 1,
    borderColor: IDE.primary + '45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: IDE.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: IDE.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IDE.bg,
  },
  stepPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    backgroundColor: IDE.surface,
  },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    backgroundColor: IDE.bg,
  },
  stepPillActive: {
    borderColor: IDE.primary,
    backgroundColor: IDE.primary + '20',
  },
  stepPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stepPillTextActive: {
    color: IDE.primary,
  },
  bodyScroll: {
    maxHeight: 460,
  },
  bodyContent: {
    padding: 18,
    gap: 12,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: IDE.primary,
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: IDE.text,
    marginTop: 3,
  },
  stepSubtitle: {
    fontSize: 12,
    color: IDE.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  highlightCard: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    gap: 5,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IDE.text,
    flex: 1,
  },
  highlightBody: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
    paddingLeft: 23,
  },
  proTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: IDE.warning + '15',
    borderWidth: 1,
    borderColor: IDE.warning + '40',
  },
  proTipText: {
    flex: 1,
    fontSize: 12,
    color: IDE.text,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    backgroundColor: IDE.bg,
  },
  footerRightGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: IDE.border,
    backgroundColor: IDE.surface,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: IDE.text,
  },
  tryNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: IDE.primary + '60',
    backgroundColor: IDE.primary + '18',
  },
  tryNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: IDE.primary,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: IDE.primary,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
});
