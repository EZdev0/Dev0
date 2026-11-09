import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Platform,
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
  Upload,
  AlertTriangle,
  Sparkles,
  FileArchive,
  Check,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { SkillTriggerOverrideConfig, TOOL_REGISTRY } from '@/types';
import {
  CustomSubAgentTemplate,
  ParsedYamlSkill,
  UploadedSkillFileEntry,
  importSkillsFromZipOrFiles,
  repairCorruptedSkillContent,
} from '@/utils/skill-loader';

interface SubAgentStudioModalProps {
  visible: boolean;
  onClose: () => void;
  templates: CustomSubAgentTemplate[];
  skills: ParsedYamlSkill[];
  onSaveTemplate: (template: CustomSubAgentTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onRunTemplateTask: (template: CustomSubAgentTemplate, taskInstruction: string) => void;
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  skillTriggerOverrides?: Record<string, SkillTriggerOverrideConfig>;
  onUpdateSkillTrigger?: (
    skillId: string,
    config: SkillTriggerOverrideConfig,
  ) => void;
  onUploadSkillFiles?: (files: UploadedSkillFileEntry[]) => void;
  onRepairSkill?: (skill: ParsedYamlSkill) => void;
  onDeleteUploadedSkill?: (path: string) => void;
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
  skillTriggerOverrides,
  onUpdateSkillTrigger,
  onUploadSkillFiles,
  onRepairSkill,
  onDeleteUploadedSkill,
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

  // Skill upload / paste states
  const [showPasteSkillBox, setShowPasteSkillBox] = useState<boolean>(false);
  const [pasteFileName, setPasteFileName] = useState<string>('AGENTS.md');
  const [pasteContent, setPasteContent] = useState<string>('');
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [keywordDrafts, setKeywordDrafts] = useState<Record<string, string>>({});
  const fileInputRef = useRef<any>(null);

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
      setSystemPrompt(
        'You are a specialized sub-agent. Follow all rules and stay within your allowed file scope.',
      );
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

  const handleWebFileUpload = async (event: any) => {
    const files: FileList | undefined = event?.target?.files;
    if (!files || files.length === 0 || !onUploadSkillFiles) return;

    const payloads: {
      fileName: string;
      textContent?: string;
      arrayBuffer?: ArrayBuffer | Uint8Array;
    }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f) continue;
      if (f.name.toLowerCase().endsWith('.zip')) {
        const buf = await f.arrayBuffer();
        payloads.push({ fileName: f.name, arrayBuffer: new Uint8Array(buf) });
      } else {
        const text = await f.text();
        payloads.push({ fileName: f.name, textContent: text });
      }
    }

    const res = await importSkillsFromZipOrFiles(payloads);
    if (res.importedFiles.length > 0) {
      onUploadSkillFiles(res.importedFiles);
      const validCount = Math.max(0, res.importedFiles.length - res.corruptedCount);
      setUploadStatusMsg(
        `Imported ${res.importedFiles.length} skill file(s): ${validCount} valid YAML, ${res.corruptedCount} flagged (!) for AI Fix.`,
      );
    } else {
      setUploadStatusMsg('No .md, .yml, or AGENTS.md files found in selection.');
    }
    if (event?.target) {
      event.target.value = '';
    }
  };

  const handlePasteImport = async () => {
    if (!pasteContent.trim() || !onUploadSkillFiles) return;
    const cleanName = pasteFileName.trim() || 'AGENTS.md';
    const res = await importSkillsFromZipOrFiles([
      { fileName: cleanName, textContent: pasteContent },
    ]);
    if (res.importedFiles.length > 0) {
      onUploadSkillFiles(res.importedFiles);
      setUploadStatusMsg(
        res.corruptedCount > 0
          ? `Added "${cleanName}" — flagged (!) as corrupted/non-YAML. Click "Fix with AI" below to format it.`
          : `Added valid YAML skill "${cleanName}".`,
      );
      setPasteContent('');
      setShowPasteSkillBox(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Cpu size={20} color={IDE.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Sub-Agent Templates & Extra YAML Skill Studio</Text>
                <Text style={styles.headerSubtitle}>
                  Scoped sub-agents, .zip skill pack importer, AGENTS.md YAML validator & trigger words
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
                YAML Skills & AGENTS.md ({skills.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
            {activeTab === 'templates' && !editingTemplate ? (
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

                {Boolean(runningTemplate) ? (
                  <View style={styles.runTaskBox}>
                    <View style={styles.runTaskHeader}>
                      <Text style={styles.runTaskTitle}>
                        Assign Task to {runningTemplate?.name}
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
                        if (!taskInput.trim() || !runningTemplate) return;
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
                ) : null}

                {templates.length === 0 ? (
                  <View style={styles.templateCard}>
                    <Text style={styles.templateName}>No Sub-Agents Configured Yet</Text>
                    <Text style={styles.templateDesc}>
                      Zero hardcoded Sub-Agents are loaded by default. Click &quot;New Sub-Agent&quot; above or ask Dev0 in Chat to configure and save a custom Sub-Agent.
                    </Text>
                  </View>
                ) : null}

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
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => onDeleteTemplate(tpl.id)}
                        >
                          <Trash2 size={14} color={IDE.danger} />
                        </TouchableOpacity>
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
            ) : null}

            {activeTab === 'templates' && Boolean(editingTemplate) ? (
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
            ) : null}

            {activeTab === 'skills' ? (
              <>
                <View style={styles.topRow}>
                  <Text style={styles.sectionDesc}>
                    Extra YAML Learning Engine: Upload single .md/.yml/AGENTS.md files or a .zip pack of skills. Non-YAML or corrupted files are flagged with (!) and can be repaired in 1 click.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {Platform.OS === 'web' ? (
                      <>
                        {React.createElement('input', {
                          ref: fileInputRef,
                          type: 'file',
                          accept: '.md,.yml,.yaml,.zip',
                          multiple: true,
                          style: { display: 'none' },
                          onChange: handleWebFileUpload,
                        })}
                        <TouchableOpacity
                          style={styles.createBtn}
                          onPress={() => fileInputRef.current?.click()}
                        >
                          <Upload size={14} color="#fff" />
                          <Text style={styles.createBtnText}>Upload .md / .zip</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.createBtn, { backgroundColor: IDE.accent }]}
                      onPress={() => setShowPasteSkillBox(v => !v)}
                    >
                      <FileArchive size={14} color="#fff" />
                      <Text style={styles.createBtnText}>Paste / Author Skill</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {Boolean(uploadStatusMsg) ? (
                  <View style={styles.statusBanner}>
                    <Sparkles size={14} color={IDE.accent} />
                    <Text style={styles.statusBannerText}>{uploadStatusMsg}</Text>
                    <TouchableOpacity onPress={() => setUploadStatusMsg(null)}>
                      <X size={14} color={IDE.muted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {showPasteSkillBox ? (
                  <View style={styles.formContainer}>
                    <View style={styles.runTaskHeader}>
                      <Text style={styles.runTaskTitle}>
                        Import or Author AGENTS.md / YAML Skill
                      </Text>
                      <TouchableOpacity onPress={() => setShowPasteSkillBox(false)}>
                        <X size={16} color={IDE.muted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.label}>File Name (e.g. AGENTS.md or security-skill.md)</Text>
                    <TextInput
                      style={styles.input}
                      value={pasteFileName}
                      onChangeText={setPasteFileName}
                      placeholder="AGENTS.md"
                      placeholderTextColor={IDE.muted}
                    />
                    <Text style={styles.label}>
                      Markdown Content (With or without --- YAML frontmatter ---)
                    </Text>
                    <TextInput
                      style={styles.textArea}
                      value={pasteContent}
                      onChangeText={setPasteContent}
                      multiline
                      placeholder={`---\nname: Clean Architecture Rules\ndescription: Enforces strict TypeScript and modular files\ntrigger: always\n---\n\nAlways verify types before committing.`}
                      placeholderTextColor={IDE.muted}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.executeBtn, { flex: 1, backgroundColor: IDE.accent }]}
                        onPress={() => {
                          if (!pasteContent.trim()) return;
                          setPasteContent(
                            repairCorruptedSkillContent(pasteFileName || 'AGENTS.md', pasteContent).content,
                          );
                        }}
                      >
                        <Sparkles size={14} color="#fff" />
                        <Text style={styles.executeBtnText}>Format YAML with AI</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.executeBtn, { flex: 1 }]}
                        onPress={handlePasteImport}
                      >
                        <Check size={14} color="#fff" />
                        <Text style={styles.executeBtnText}>Import Skill</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {skills.length === 0 ? (
                  <View style={styles.templateCard}>
                    <Text style={styles.templateName}>No YAML Skills or AGENTS.md Loaded Yet</Text>
                    <Text style={styles.templateDesc}>
                      Upload an AGENTS.md file, a SKILL.md file, or a .zip archive of skills above — or ask Dev0 in Chat to call create_yaml_skill.
                    </Text>
                  </View>
                ) : null}

                {skills.map(s => {
                  const currentTrigger =
                    skillTriggerOverrides?.[s.id]?.mode ?? s.trigger ?? 'always';
                  const currentKeywordsText =
                    keywordDrafts[s.id] !== undefined
                      ? keywordDrafts[s.id]
                      : (skillTriggerOverrides?.[s.id]?.keywords ?? s.triggerKeywords ?? []).join(', ');

                  return (
                    <View
                      key={s.id}
                      style={[
                        styles.templateCard,
                        s.isCorrupted && { borderColor: IDE.danger, backgroundColor: IDE.danger + '10' },
                      ]}
                    >
                      <View style={styles.templateHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {s.isCorrupted ? (
                              <View style={styles.corruptedBadge}>
                                <AlertTriangle size={12} color="#fff" />
                                <Text style={styles.corruptedBadgeText}>! CORRUPTED YAML</Text>
                              </View>
                            ) : null}
                            <Text style={styles.templateName}>{s.name}</Text>
                          </View>
                          <Text style={styles.metaLine}>
                            Source: {s.displaySource} · Mode:{' '}
                            {currentTrigger === 'always'
                              ? 'Always Load (Background)'
                              : currentTrigger === 'keywords'
                                ? 'Custom Trigger Words'
                                : 'Manual'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {s.isCorrupted && onRepairSkill ? (
                            <TouchableOpacity
                              style={styles.aiFixBtn}
                              onPress={() => {
                                onRepairSkill(s);
                                setUploadStatusMsg(`Repaired "${s.name}" into valid YAML frontmatter!`);
                              }}
                            >
                              <Sparkles size={12} color="#000" />
                              <Text style={styles.aiFixBtnText}>Fix with AI</Text>
                            </TouchableOpacity>
                          ) : null}
                          {onDeleteUploadedSkill ? (
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => onDeleteUploadedSkill(s.sourcePath)}
                            >
                              <Trash2 size={13} color={IDE.danger} />
                            </TouchableOpacity>
                          ) : null}
                          <Switch
                            value={s.enabled}
                            onValueChange={val => onToggleSkill(s.id, val)}
                            trackColor={{ false: IDE.border, true: IDE.accent }}
                          />
                        </View>
                      </View>

                      {s.isCorrupted && Boolean(s.corruptionReason) ? (
                        <Text style={styles.corruptionReasonText}>
                          ! {s.corruptionReason}
                        </Text>
                      ) : (
                        <Text style={styles.templateDesc}>{s.description}</Text>
                      )}

                      {!s.isCorrupted && onUpdateSkillTrigger ? (
                        <View style={styles.triggerConfigBox}>
                          <Text style={styles.triggerConfigLabel}>Load Mode:</Text>
                          <View style={styles.triggerPillsRow}>
                            {(
                              [
                                { id: 'always', label: 'Always (Background)' },
                                { id: 'keywords', label: 'Trigger Words / Phrases' },
                                { id: 'manual', label: 'Manual Only' },
                              ] as const
                            ).map(mode => {
                              const active = currentTrigger === mode.id;
                              return (
                                <TouchableOpacity
                                  key={mode.id}
                                  style={[styles.triggerPill, active && styles.triggerPillActive]}
                                  onPress={() =>
                                    onUpdateSkillTrigger(s.id, {
                                      mode: mode.id,
                                      keywords:
                                        skillTriggerOverrides?.[s.id]?.keywords ??
                                        s.triggerKeywords ??
                                        [],
                                    })
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.triggerPillText,
                                      active && styles.triggerPillTextActive,
                                    ]}
                                  >
                                    {mode.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          {currentTrigger === 'keywords' ? (
                            <View style={styles.keywordsInputRow}>
                              <TextInput
                                style={[styles.input, { flex: 1 }]}
                                value={currentKeywordsText}
                                onChangeText={txt =>
                                  setKeywordDrafts(prev => ({ ...prev, [s.id]: txt }))
                                }
                                onBlur={() => {
                                  const parsed = (keywordDrafts[s.id] ?? currentKeywordsText)
                                    .split(',')
                                    .map(k => k.trim())
                                    .filter(Boolean);
                                  onUpdateSkillTrigger(s.id, {
                                    mode: 'keywords',
                                    keywords: parsed,
                                  });
                                }}
                                placeholder="Custom trigger words, phrases, or letters (comma-separated, e.g. auth,zustand,fix bug)"
                                placeholderTextColor={IDE.muted}
                              />
                              <TouchableOpacity
                                style={styles.saveKeywordsBtn}
                                onPress={() => {
                                  const parsed = (keywordDrafts[s.id] ?? currentKeywordsText)
                                    .split(',')
                                    .map(k => k.trim())
                                    .filter(Boolean);
                                  onUpdateSkillTrigger(s.id, {
                                    mode: 'keywords',
                                    keywords: parsed,
                                  });
                                  setUploadStatusMsg(`Saved trigger words for "${s.name}".`);
                                }}
                              >
                                <Check size={13} color="#fff" />
                                <Text style={styles.saveKeywordsBtnText}>Save</Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </>
            ) : null}
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
    maxWidth: 680,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionDesc: {
    flex: 1,
    minWidth: 220,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: IDE.accent + '18',
    borderWidth: 1,
    borderColor: IDE.accent + '50',
    marginBottom: 12,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 12,
    color: IDE.text,
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
    gap: 8,
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
  corruptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IDE.danger,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  corruptedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  aiFixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: IDE.warning,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  aiFixBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  corruptionReasonText: {
    fontSize: 11,
    color: IDE.danger,
    fontWeight: '600',
    marginTop: 4,
  },
  triggerConfigBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    gap: 6,
  },
  triggerConfigLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.textSecondary,
  },
  triggerPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  triggerPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: IDE.border,
    backgroundColor: IDE.surface,
  },
  triggerPillActive: {
    borderColor: IDE.primary,
    backgroundColor: IDE.primary + '22',
  },
  triggerPillText: {
    fontSize: 11,
    color: IDE.muted,
    fontWeight: '600',
  },
  triggerPillTextActive: {
    color: IDE.primary,
  },
  keywordsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveKeywordsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IDE.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveKeywordsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
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
    marginBottom: 14,
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
