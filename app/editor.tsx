import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Save, Pencil, Eye } from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { useProject } from '@/providers/ProjectProvider';
import { useApp } from '@/providers/AppProvider';
import { highlightLine } from '@/utils/syntax';
import { detectLanguage } from '@/utils/file-icons';

export default function EditorScreen() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const { getFileContent, updateFileContent } = useProject();
  const { settings } = useApp();

  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const fileName = useMemo(() => {
    if (!path) return 'Unknown';
    return path.split('/').pop() || path;
  }, [path]);

  const breadcrumb = useMemo(() => {
    if (!path) return '';
    const parts = path.split('/');
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join(' › ');
  }, [path]);

  const language = useMemo(() => detectLanguage(fileName), [fileName]);
  const hasChanges = content !== originalContent;

  const lines = useMemo(() => content.split('\n'), [content]);
  const lineCount = lines.length;

  useEffect(() => {
    if (path) {
      const fileContent = getFileContent(path) ?? '';
      setContent(fileContent);
      setOriginalContent(fileContent);
      console.log('[Editor] Loaded file:', path, 'lines:', fileContent.split('\n').length);
    }
  }, [path, getFileContent]);

  const handleSave = useCallback(() => {
    if (path) {
      updateFileContent(path, content);
      setOriginalContent(content);
      setIsEditing(false);
      console.log('[Editor] Saved file:', path);
    }
  }, [path, content, updateFileContent]);

  const handleToggleEdit = useCallback(() => {
    if (isEditing && hasChanges) {
      setShowUnsavedModal(true);
    } else {
      setIsEditing(!isEditing);
      if (!isEditing) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [isEditing, hasChanges]);

  const symbolKeys = useMemo(() => ['{', '}', '(', ')', '[', ']', ';', '=', '"', "'", '<', '>', '/', '.', ':', '_', '-', '+', '*', '!', '&', '|', '@', '#', '\t'], []);

  const insertSymbol = useCallback((sym: string) => {
    setContent(prev => prev + sym);
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: fileName,
          headerStyle: { backgroundColor: IDE.surface },
          headerTintColor: IDE.text,
          headerShadowVisible: false,
          headerRight: () => (
            <View style={headerStyles.right}>
              {hasChanges && (
                <TouchableOpacity onPress={handleSave} style={headerStyles.btn} activeOpacity={0.7}>
                  <Save size={18} color={IDE.accent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleToggleEdit} style={headerStyles.btn} activeOpacity={0.7}>
                {isEditing ? (
                  <Eye size={18} color={IDE.primary} />
                ) : (
                  <Pencil size={18} color={IDE.primary} />
                )}
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {breadcrumb ? (
          <View style={styles.breadcrumb}>
            <Text style={styles.breadcrumbText}>{breadcrumb}</Text>
          </View>
        ) : null}

        {isEditing ? (
          <View style={styles.editorContainer}>
            <ScrollView style={styles.editScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              <View style={styles.editArea}>
                {settings.showLineNumbers && (
                  <View style={styles.gutter}>
                    {lines.map((_, i) => (
                      <Text key={i} style={[styles.lineNum, { fontSize: settings.fontSize - 1 }]}>
                        {i + 1}
                      </Text>
                    ))}
                  </View>
                )}
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.editInput,
                    {
                      fontSize: settings.fontSize,
                      lineHeight: settings.fontSize * 1.6,
                    },
                  ]}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  textAlignVertical="top"
                  scrollEnabled={false}
                />
              </View>
            </ScrollView>

            <View style={styles.symbolBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symbolBarContent}>
                {symbolKeys.map((sym, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.symbolKey}
                    onPress={() => insertSymbol(sym)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.symbolText}>{sym === '\t' ? 'TAB' : sym}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView ref={scrollRef} style={styles.viewScroll} contentContainerStyle={styles.viewContent}>
            {lines.map((line, i) => (
              <View key={i} style={styles.codeLine}>
                {settings.showLineNumbers && (
                  <Text style={[styles.lineNum, { fontSize: settings.fontSize - 1, lineHeight: settings.fontSize * 1.6 }]}>
                    {i + 1}
                  </Text>
                )}
                <Text style={[styles.codeText, { fontSize: settings.fontSize, lineHeight: settings.fontSize * 1.6 }]}>
                  {highlightLine(line, language).map((token, j) => (
                    <Text key={j} style={{ color: token.color }}>{token.text}</Text>
                  ))}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            Ln {lineCount}, {content.length} chars
          </Text>
          <Text style={styles.statusText}>{language}</Text>
          {hasChanges && <Text style={[styles.statusText, { color: IDE.warning }]}>● Modified</Text>}
          <Text style={styles.statusText}>UTF-8</Text>
        </View>

        <Modal visible={showUnsavedModal} transparent animationType="fade">
          <View style={headerStyles.modalOverlay}>
            <View style={headerStyles.modalBox}>
              <Text style={headerStyles.modalTitle}>Unsaved Changes</Text>
              <Text style={headerStyles.modalText}>Do you want to save your changes before leaving edit mode?</Text>
              <View style={headerStyles.modalActions}>
                <TouchableOpacity
                  style={headerStyles.modalBtnCancel}
                  onPress={() => setShowUnsavedModal(false)}
                >
                  <Text style={headerStyles.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={headerStyles.modalBtnDanger}
                  onPress={() => {
                    setContent(originalContent);
                    setIsEditing(false);
                    setShowUnsavedModal(false);
                  }}
                >
                  <Text style={headerStyles.modalBtnText}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={headerStyles.modalBtnSave}
                  onPress={() => {
                    setShowUnsavedModal(false);
                    handleSave();
                  }}
                >
                  <Text style={headerStyles.modalBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
  );
}

const headerStyles = StyleSheet.create({
  right: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn: {
    minWidth: 40,
    minHeight: 40,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: IDE.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IDE.text,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: IDE.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  modalBtnCancelText: {
    fontSize: 13,
    color: IDE.muted,
    fontWeight: '600',
  },
  modalBtnDanger: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: IDE.danger,
  },
  modalBtnSave: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: IDE.accent,
  },
  modalBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IDE.bg },
  breadcrumb: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: IDE.surface,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  breadcrumbText: { fontSize: 11, color: IDE.muted },
  editorContainer: { flex: 1 },
  editScroll: { flex: 1 },
  editArea: { flexDirection: 'row', minHeight: 300 },
  gutter: {
    paddingTop: 10,
    paddingRight: 4,
    paddingLeft: 8,
    borderRightWidth: 1,
    borderRightColor: IDE.border,
    backgroundColor: IDE.surface,
    minWidth: 36,
    alignItems: 'flex-end',
  },
  editInput: {
    flex: 1,
    fontFamily: 'monospace',
    color: IDE.text,
    padding: 10,
    textAlignVertical: 'top',
  },
  viewScroll: { flex: 1 },
  viewContent: { paddingVertical: 8, paddingBottom: 40 },
  codeLine: { flexDirection: 'row', paddingHorizontal: 0 },
  lineNum: {
    width: 36,
    textAlign: 'right',
    color: IDE.muted,
    fontFamily: 'monospace',
    paddingRight: 8,
    opacity: 0.6,
    backgroundColor: IDE.surface,
  },
  codeText: {
    flex: 1,
    fontFamily: 'monospace',
    paddingLeft: 10,
    paddingRight: 12,
  },
  symbolBar: {
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    paddingVertical: 6,
  },
  symbolBarContent: {
    paddingHorizontal: 8,
    gap: 4,
  },
  symbolKey: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 36,
    alignItems: 'center',
  },
  symbolText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: IDE.text,
    fontWeight: '500',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    gap: 12,
  },
  statusText: { fontSize: 10, color: IDE.muted, fontFamily: 'monospace' },
});
