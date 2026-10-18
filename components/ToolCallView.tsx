import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronRight, Check, X, Loader2, Wrench } from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { ToolCall, isLearningTool, isLearningEnabled } from '@/types';
import { useApp } from '@/providers/AppProvider';

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
  create_directory: 'Create Directory',
  get_project_tree: 'Project Structure',
  get_file_info: 'File Info',
  create_todo: 'Create Todo',
  update_todo: 'Update Todo',
  add_memo: 'Save Memo',
  web_search: 'Web Search',
  web_fetch: 'Fetch Webpage',
  think: 'Think',
  task_complete: 'Task Complete',
  verify_file: 'Verify File',
  read_identity_files: 'Read Identity Files',
  update_soul_md: 'Update SOUL.md',
  update_agents_md: 'Update AGENT.md',
  update_identity_md: 'Update IDENTITY.md',
  update_user_md: 'Update USER.md',
  update_memory_md: 'Update MEMORY.md',
  get_active_tools: 'Get Active Tools',
};

interface Props {
  toolCall: ToolCall;
}

const ToolCallView = React.memo(({ toolCall }: Props) => {
  const { settings } = useApp();
  const [expanded, setExpanded] = useState<boolean>(false);

  const toggle = useCallback(() => setExpanded(p => !p), []);

  if (!toolCall || (isLearningTool(toolCall.name) && !isLearningEnabled(settings))) {
    return null;
  }

  const statusColor = toolCall.status === 'completed' ? IDE.accent
    : toolCall.status === 'error' ? IDE.danger
    : IDE.warning;

  const StatusIcon = toolCall.status === 'completed' ? Check
    : toolCall.status === 'error' ? X
    : Loader2;

  const label = TOOL_LABELS[toolCall.name] || toolCall.name;

  const argsStr = Object.entries(toolCall.arguments || {})
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? (v.length > 60 ? v.slice(0, 60) + '...' : v) : JSON.stringify(v);
      return k + ': ' + val;
    })
    .join('\n');

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} style={styles.header} activeOpacity={0.7}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]}>
          <StatusIcon size={10} color="#fff" />
        </View>
        <Wrench size={12} color={IDE.muted} style={styles.toolIcon} />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {toolCall.arguments?.path ? (
          <Text style={styles.path} numberOfLines={1}>{toolCall.arguments.path}</Text>
        ) : null}
        <View style={styles.chevron}>
          {expanded ? <ChevronDown size={12} color={IDE.muted} /> : <ChevronRight size={12} color={IDE.muted} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.details}>
          {argsStr ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Parameter</Text>
              <Text style={styles.mono}>{argsStr}</Text>
            </View>
          ) : null}
          {toolCall.result ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ergebnis</Text>
              <Text style={[styles.mono, toolCall.status === 'error' && styles.errorText]} numberOfLines={20}>
                {toolCall.result.length > 500 ? toolCall.result.slice(0, 500) + '...' : toolCall.result}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
});

ToolCallView.displayName = 'ToolCallView';

export default ToolCallView;

const styles = StyleSheet.create({
  container: {
    backgroundColor: IDE.bg + 'CC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: IDE.border,
    marginVertical: 4,
    overflow: 'hidden' as const,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
  },
  toolIcon: {
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: IDE.text,
    flexShrink: 0,
  },
  path: {
    fontSize: 11,
    color: IDE.muted,
    marginLeft: 6,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto' as const,
    paddingLeft: 8,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 10,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: IDE.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mono: {
    fontSize: 11,
    color: IDE.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  errorText: {
    color: IDE.danger,
  },
});
