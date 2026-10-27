import React, { useState } from 'react';
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
  ShieldCheck,
  Plus,
  Trash2,
  Play,
  X,
  FileCode,
  Wrench,
  Edit3,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { TOOL_REGISTRY } from '@/types';
import { CustomSubAgentTemplate, ParsedYamlSkill } from '@/utils/skill-loader';

interface SubAgentStudioModalProps {
  visible: boolean;
  onClose: () => void;
  templates: CustomSubAgentTemplate[];
  skills: ParsedYamlSkill[];
  onSaveTemplate: (template: CustomSubAgentTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onRunTemplateTask: (template: CustomSubAgentTemplate, taskInstruction: string) => void;
  onToggleSkill: (skillId: string, enabled: boolean) => void;
}

export const SubAgentStudioModal: React.FC<SubAgentStudioModalProps> = ({
  visible,
  onClose,
  templates,
  skills,
  onSaveTemplate,
  onDeleteTemplate,
  onRunTemplateTask,
  onToggleSkill,
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'skills'>('templates');
  const [editingTemplate, setEditingTemplate] = useState<CustomSubAgentTemplate | null>(null);
  const [runningTemplate, setRunningTemplate] = useState<CustomSubAgentTemplate | null>(null);
  const [taskInput, setTaskInput] = useState<string>('');

  // Form states for creating/editing a manual Sub-Agent template
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<string>('custom');
  const [description, setDescription] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [rulesText, setRulesText] = useState<string>('');
  const [allowedFilesText, setAllowedFilesText] = useState<string>('*');
  const [allowedTools, setAllowedTools] = useState<string[]>([
    'read_file',
    'read_lines',
    'list_directory',
    'search_files',
    'get_project_tree',
    'think',
  ]);
  const [canBeCalledByAI, setCanBeCalledByAI] = useState<boolean>(true);

  const openEditor = (tpl?: CustomSubAgentTemplate) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setName(tpl.name);
      setRole(tpl.role);
      setDescription(tpl.description);
      setSystemPrompt(tpl.systemPrompt);
      setRulesText(tpl.rules.join('\n'));
      setAllowedFilesText(tpl.allowedFiles.join(', '));
      setAllowedTools(tpl.allowedTools);
      setCanBeCalledByAI(tpl.canBeCalledByAI);
    } else {
      const fresh: CustomSubAgentTemplate = {
        id: 'tpl_custom_' + Date.now().toString(36),
        name: '',
        role: 'developer',
        description: '',
        systemPrompt: '',
        rules: [],
        allowedTools: ['read_file', 'read_lines', 'search_files', 'write_file', 'edit_file', 'think'],
        allowedFiles: ['*'],
        canBeCalledByAI: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setEditingTemplate(fresh);
      setName('');
      setRole('developer');
      setDescription('');
      setSystemPrompt('You are a specialized sub-agent. Follow all rules and stay within your allowed file scope.');
      setRulesText('Always read files with read_file before modifying.\nKeep changes minimal and type-safe.');
      setAllowedFilesText('app/**, components/**, utils/**');
      setAllowedTools(fresh.allowedTools);
      setCanBeCalledByAI(true);
    }
  };

  const handleSave = () => {
    if (!editingTemplate || !name.trim()) return;
    const saved: CustomSubAgentTemplate = {
      ...editingTemplate,
      name: name.trim(),
      role: role.trim() || 'custom',
      description: description.trim() || 'Custom user-defined sub-agent template',
      systemPrompt: systemPrompt.trim(),
      rules: rulesText
        .split('\n')
        .map(r => r.trim())
        .filter(Boolean),
      allowedFiles: allowedFilesText
        .split(',')
        .map(f => f.trim())
        .filter(Boolean),
      allowedTools,
      canBeCalledByAI,
      updatedAt: Date.now(),
    };
    onSaveTemplate(saved);
    setEditingTemplate(null);
  };

  const toggleToolInForm = (toolName: string) => {
    setAllowedTools(prev =>
      prev.includes(toolName) ? prev.filter(t => t !== toolName) : [...prev, toolName],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Cpu size={20} color={IDE.primary} />
              <View>
                <Text style={styles.headerTitle}>Sub-Agent Templates & YAML Skill Loader</Text>
                <Text style={styles.headerSubtitle}>
                  Manual & AI-callable sub-agents with file scopes and YAML frontmatter skills
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <X size={20} color={IDE.muted} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'templates' && styles.tabActive]}
              onPress={() => setActiveTab('templates')}
            >
              <Cpu size={14} color={activeTab === 'templates' ? IDE.primary : IDE.muted} />
              <Text style={[styles.tabText, activeTab === 'templates' && styles.tabTextActive]}>
                Sub-Agent Templates ({templates.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'skills' && styles.tabActive]}
              onPress={() => setActiveTab('skills')}
            >
              <ShieldCheck size={14} color={activeTab === 'skills' ? IDE.primary : IDE.muted} />
              <Text style={[styles.tabText, activeTab === 'skills' && styles.tabTextActive]}>
                Loaded YAML Skills ({skills.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
            {activeTab === 'templates' && !editingTemplate && (
              <>
                <View style={styles.topRow}>
                  <Text style={styles.sectionDesc}>
                    Create reusable sub-agent templates with custom system prompts, rules, tool permissions, and allowed file patterns. Both you and the main AI can invoke them.
                  </Text>
                  <TouchableOpacity style={styles.createBtn} onPress={() => openEditor()}>
                    <Plus size={15} color="#fff" />
                    <Text style={styles.createBtnText}>New Sub-Agent</Text>
                  </TouchableOpacity>
                </View>

                {runningTemplate && (
                  <View style={styles.runTaskBox}>
                    <View style={styles.runTaskHeader}>
                      <Text style={styles.runTaskTitle}>
                        Assign Task to {runningTemplate.name}
                      </Text>
                      <TouchableOpacity onPress={() => setRunningTemplate(null)}>
                        <X size={16} color={IDE.muted} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.textArea}
                      value={taskInput}
                      onChangeText={setTaskInput}
                      multiline
                      placeholder="Describe the specific task for this sub-agent to execute..."
                      placeholderTextColor={IDE.muted}
                    />
                    <TouchableOpacity
                      style={styles.executeBtn}
                      onPress={() => {
                        if (!taskInput.trim()) return;
                        onRunTemplateTask(runningTemplate, taskInput.trim());
                        setTaskInput('');
                        setRunningTemplate(null);
                        onClose();
                      }}
                    >
                      <Play size={15} color="#fff" />
                      <Text style={styles.executeBtnText}>Launch Sub-Agent Now</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {templates.map(tpl => (
                  <View key={tpl.id} style={styles.templateCard}>
                    <View style={styles.templateHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.templateName}>
                          {tpl.name} · <Text style={styles.templateRole}>{tpl.role.toUpperCase()}</Text>
                        </Text>
                        <Text style={styles.templateDesc}>{tpl.description}</Text>
                      </View>
                      <View style={styles.templateActions}>
                        <TouchableOpacity
                          style={styles.runBtn}
                          onPress={() => setRunningTemplate(tpl)}
                        >
                          <Play size={13} color="#fff" />
                          <Text style={styles.runBtnText}>Run</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => openEditor(tpl)}
                        >
                          <Edit3 size={14} color={IDE.textSecondary} />
                        </TouchableOpacity>
                        {!tpl.id.startsWith('tpl_repograph') && (
                          <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => onDeleteTemplate(tpl.id)}
                          >
                            <Trash2 size={14} color={IDE.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <Text style={styles.metaLine}>
                      <FileCode size={11} color={IDE.primary} /> Allowed Files:{' '}
                      {tpl.allowedFiles.join(', ')}
                    </Text>
                    <Text style={styles.metaLine}>
                      <Wrench size={11} color={IDE.accent} /> Tools ({tpl.allowedTools.length}):{' '}
                      {tpl.allowedTools.slice(0, 6).join(', ')}
                      {tpl.allowedTools.length > 6 ? '...' : ''}
                    </Text>
                    <Text style={styles.metaLine}>
                      AI Callable: {tpl.canBeCalledByAI ? 'Yes (via sub_agent tool)' : 'Manual only'}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {activeTab === 'templates' && editingTemplate && (
              <View style={styles.formContainer}>
                <View style={styles.runTaskHeader}>
                  <Text style={styles.runTaskTitle}>Configure Sub-Agent Template</Text>
                  <TouchableOpacity onPress={() => setEditingTemplate(null)}>
                    <X size={16} color={IDE.muted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Sub-Agent Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. API Security Specialist"
                  placeholderTextColor={IDE.muted}
                />

                <Text style={styles.label}>Specialty Role</Text>
                <TextInput
                  style={styles.input}
                  value={role}
                  onChangeText={setRole}
                  placeholder="analyst | developer | tester | researcher | critic"
                  placeholderTextColor={IDE.muted}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Short summary of when to use this sub-agent"
                  placeholderTextColor={IDE.muted}
                />

                <Text style={styles.label}>System Prompt</Text>
                <TextInput
                  style={styles.textArea}
                  value={systemPrompt}
                  onChangeText={setSystemPrompt}
                  multiline
                  placeholder="Detailed instructions for this sub-agent..."
                  placeholderTextColor={IDE.muted}
                />

                <Text style={styles.label}>Operating Rules (One per line)</Text>
                <TextInput
                  style={styles.textArea}
                  value={rulesText}
                  onChangeText={setRulesText}
                  multiline
                  placeholder="Always read files first..."
                  placeholderTextColor={IDE.muted}
                />

                <Text style={styles.label}>
                  Allowed File Scopes (Comma-separated globs, e.g. app/**, utils/**, *.ts)
                </Text>
                <TextInput
                  style={styles.input}
                  value={allowedFilesText}
                  onChangeText={setAllowedFilesText}
                  placeholder="app/**, components/**, *"
                  placeholderTextColor={IDE.muted}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Allow Main AI Agent to Call Automatically</Text>
                  <Switch
                    value={canBeCalledByAI}
                    onValueChange={setCanBeCalledByAI}
                    trackColor={{ false: IDE.border, true: IDE.accent }}
                  />
                </View>

                <Text style={styles.label}>Allowed Tools ({allowedTools.length} selected)</Text>
                <View style={styles.toolsWrap}>
                  {TOOL_REGISTRY.map(tool => {
                    const selected = allowedTools.includes(tool.name);
                    return (
                      <TouchableOpacity
                        key={tool.name}
                        style={[styles.toolChip, selected && styles.toolChipActive]}
                        onPress={() => toggleToolInForm(tool.name)}
                      >
                        <Text style={[styles.toolChipText, selected && styles.toolChipTextActive]}>
                          {tool.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity style={styles.executeBtn} onPress={handleSave}>
                  <Text style={styles.executeBtnText}>Save Sub-Agent Template</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'skills' && (
              <>
                <Text style={[styles.sectionDesc, { marginBottom: 12 }]}>
                  Automatically detected Markdown and YAML files with valid YAML frontmatter (e.g. .qoder/rules/*, .agents/*, and project SKILL.md files). Active skills are injected into the agent reasoning context.
                </Text>

                {skills.map(s => (
                  <View key={s.id} style={styles.templateCard}>
                    <View style={styles.templateHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.templateName}>{s.name}</Text>
                        <Text style={styles.metaLine}>
                          Source: {s.sourcePath} · Trigger: {s.trigger}
                          {s.alwaysApply ? ' (alwaysApply: true)' : ''}
                        </Text>
                      </View>
                      <Switch
                        value={s.enabled}
                        onValueChange={val => onToggleSkill(s.id, val)}
                        trackColor={{ false: IDE.border, true: IDE.accent }}
                      />
                    </View>
                    <Text style={styles.templateDesc}>{s.description}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    backgroundColor: IDE.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: IDE.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: IDE.bg,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IDE.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: IDE.bg,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: IDE.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: IDE.muted,
  },
  tabTextActive: {
    color: IDE.primary,
  },
  body: {
    flex: 1,
  },
  bodyInner: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionDesc: {
    flex: 1,
    fontSize: 12,
    color: IDE.muted,
    lineHeight: 17,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IDE.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  templateCard: {
    backgroundColor: IDE.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 12,
    marginBottom: 10,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '700',
    color: IDE.text,
  },
  templateRole: {
    fontSize: 11,
    color: IDE.primary,
  },
  templateDesc: {
    fontSize: 12,
    color: IDE.muted,
    marginTop: 2,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IDE.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  runBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  iconBtn: {
    padding: 6,
    backgroundColor: IDE.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  metaLine: {
    fontSize: 11,
    color: IDE.textSecondary,
    marginTop: 3,
  },
  runTaskBox: {
    backgroundColor: IDE.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IDE.accent,
    padding: 12,
    marginBottom: 14,
  },
  runTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  runTaskTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IDE.text,
  },
  formContainer: {
    backgroundColor: IDE.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: IDE.textSecondary,
    marginBottom: 5,
    marginTop: 6,
  },
  input: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: IDE.text,
  },
  textArea: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: IDE.text,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  toolsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
  },
  toolChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  toolChipActive: {
    backgroundColor: IDE.primary + '25',
    borderColor: IDE.primary,
  },
  toolChipText: {
    fontSize: 11,
    color: IDE.muted,
  },
  toolChipTextActive: {
    color: IDE.primary,
    fontWeight: '600',
  },
  executeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: IDE.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  executeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});

export default SubAgentStudioModal;
