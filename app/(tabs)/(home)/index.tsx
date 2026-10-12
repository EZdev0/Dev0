import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, FlatList, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  Plus, FolderOpen, Search, X, FilePlus, FolderPlus,
  Download, FileJson, FileText, FolderArchive, CheckCircle,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { useProject } from '@/providers/ProjectProvider';
import { FileNode, PROJECT_TYPES } from '@/types';
import SponsorBanner from '@/components/SponsorBanner';
import FileTreeItem from '@/components/FileTreeItem';
import { isBinaryFile } from '@/utils/file-icons';
import { exportProjectAsZip, exportProjectAsText, exportProjectAsJson, countProjectFiles } from '@/utils/download';

export default function ProjectsScreen() {
  const router = useRouter();
  const {
    projects, currentProject, files, selectProject, createProject, deleteProject,
    deleteFile, createFile, createDirectory, renameFile,
  } = useProject();

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectType, setNewProjectType] = useState<string>('android');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileIsDir, setNewFileIsDir] = useState<boolean>(false);
  const [newFileBasePath, setNewFileBasePath] = useState<string>('');
  const [newFileContent, setNewFileContent] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const toggleDir = useCallback((node: FileNode) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }, []);

  const openFile = useCallback((node: FileNode, path: string) => {
    if (isBinaryFile(node.name)) {
      Alert.alert('Binary File', 'This file cannot be opened in the editor.');
      return;
    }
    setActiveFile(path);
    router.push({ pathname: '/editor' as any, params: { path } });
  }, [router]);

  const openNewFileModal = useCallback((basePath: string, isDir: boolean) => {
    setNewFileBasePath(basePath);
    setNewFileIsDir(isDir);
    setNewFileName('');
    setNewFileContent('');
    setShowNewFileModal(true);
  }, []);

  const handleCreateNewFile = useCallback(() => {
    if (!newFileName.trim()) {
      Alert.alert('Error', 'Please enter a name.');
      return;
    }
    const fullPath = newFileBasePath
      ? newFileBasePath + '/' + newFileName.trim()
      : newFileName.trim();

    if (newFileIsDir) {
      createDirectory(fullPath);
      console.log('[Projects] Directory created:', fullPath);
    } else {
      createFile(fullPath, newFileContent);
      console.log('[Projects] File created:', fullPath);
    }
    setShowNewFileModal(false);
    setNewFileName('');
    setNewFileContent('');
  }, [newFileName, newFileBasePath, newFileIsDir, newFileContent, createFile, createDirectory]);

  const handleLongPress = useCallback((node: FileNode, path: string) => {
    const isDir = node.type === 'directory';
    const actions: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Cancel', style: 'cancel' },
    ];

    if (isDir) {
      actions.push({
        text: '📄 New file here',
        onPress: () => openNewFileModal(path, false),
      });
      actions.push({
        text: '📁 New folder here',
        onPress: () => openNewFileModal(path, true),
      });
    }

    actions.push({
      text: '📋 Copy path',
      onPress: async () => {
        try {
          await Clipboard.setStringAsync(path);
        } catch (e) {
          console.log('[Projects] Copy path error:', e);
        }
      },
    });

    actions.push({
      text: '✏️ Rename',
      onPress: () => {
        if (Alert.prompt) {
          Alert.prompt('Rename', 'New name:', (newName) => {
            if (newName && newName.trim()) {
              const parts = path.split('/');
              parts[parts.length - 1] = newName.trim();
              renameFile(path, parts.join('/'));
            }
          }, 'plain-text', node.name);
        } else {
          handleRenameAlert(node, path);
        }
      },
    });

    actions.push({
      text: '🗑️ Delete',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          'Delete',
          'Really delete "' + node.name + '"?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deleteFile(path);
                if (activeFile === path) {
                  setActiveFile(null);
                }
              },
            },
          ]
        );
      },
    });

    Alert.alert(node.name, isDir ? 'Folder: ' + path : path, actions);
  }, [deleteFile, activeFile, openNewFileModal, renameFile]);

  const handleRenameAlert = useCallback((node: FileNode, path: string) => {
    Alert.alert('Rename', 'Function limited on this device with Alert.alert. Use chat to rename.', [
      { text: 'OK' },
    ]);
  }, []);

  const handleExport = useCallback(async (format: 'zip' | 'text' | 'json') => {
    if (!currentProject) return;
    setIsExporting(true);
    try {
      let success = false;
      if (format === 'zip') {
        success = await exportProjectAsZip(currentProject);
      } else if (format === 'json') {
        success = await exportProjectAsJson(currentProject);
      } else {
        success = await exportProjectAsText(currentProject);
      }
      if (success) {
        console.log('[Projects] Export successful:', format);
        setShowExportModal(false);
      }
    } catch (e) {
      console.log('[Projects] Export error:', e);
      Alert.alert('Export Error', 'An error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  }, [currentProject]);

  const projectStats = useMemo(() => {
    if (!currentProject) return null;
    return countProjectFiles(currentProject.files);
  }, [currentProject]);

  const handleCreateProject = useCallback(() => {
    if (!newProjectName.trim()) {
      Alert.alert('Error', 'Please enter a project name.');
      return;
    }
    createProject(newProjectName.trim(), newProjectType);
    setNewProjectName('');
    setShowNewProject(false);
  }, [newProjectName, newProjectType, createProject]);

  const flattenTree = useCallback((nodes: FileNode[], depth: number, basePath: string): { node: FileNode; depth: number; path: string }[] => {
    const result: { node: FileNode; depth: number; path: string }[] = [];
    if (!nodes) return result;
    const sorted = [...nodes].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const node of sorted) {
      const path = basePath ? basePath + '/' + node.name : node.name;
      result.push({ node, depth, path });
      if (node.type === 'directory' && expandedDirs.has(node.id) && node.children) {
        result.push(...flattenTree(node.children, depth + 1, path));
      }
    }
    return result;
  }, [expandedDirs]);

  const flatFiles = useMemo(() => flattenTree(files, 0, ''), [files, flattenTree]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return flatFiles;
    const q = searchQuery.toLowerCase();
    return flatFiles.filter(f => f.node.name.toLowerCase().includes(q));
  }, [flatFiles, searchQuery]);

  if (projects.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <FolderOpen size={64} color={IDE.muted} />
        <Text style={styles.emptyTitle}>No project opened</Text>
        <Text style={styles.emptySubtitle}>Create a new project to get started</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowNewProject(true)}
          activeOpacity={0.7}
        >
          <Plus size={18} color="#fff" />
          <Text style={styles.createButtonText}>New Project</Text>
        </TouchableOpacity>

        <NewProjectModal
          visible={showNewProject}
          name={newProjectName}
          type={newProjectType}
          onChangeName={setNewProjectName}
          onChangeType={setNewProjectType}
          onCreate={handleCreateProject}
          onClose={() => setShowNewProject(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.projectHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectTabs}>
          {projects.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.projectTab, currentProject?.id === p.id && styles.activeProjectTab]}
              onPress={() => selectProject(p.id)}
              onLongPress={() => {
                Alert.alert('Delete Project', 'Do you really want to delete "' + p.name + '"? All files will be deleted.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteProject(p.id) },
                ]);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.projectTabText, currentProject?.id === p.id && styles.activeProjectTabText]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addProjectBtn}
            onPress={() => setShowNewProject(true)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={IDE.primary} />
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={styles.searchToggle}
          onPress={() => setShowSearch(p => !p)}
          activeOpacity={0.7}
        >
          <Search size={18} color={IDE.muted} />
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchBar}>
          <Search size={14} color={IDE.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search file..."
            placeholderTextColor={IDE.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color={IDE.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBarBtn}
          onPress={() => openNewFileModal('', false)}
          activeOpacity={0.7}
        >
          <FilePlus size={15} color={IDE.accent} />
          <Text style={styles.actionBarBtnText}>File</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBarBtn}
          onPress={() => openNewFileModal('', true)}
          activeOpacity={0.7}
        >
          <FolderPlus size={15} color={IDE.primary} />
          <Text style={styles.actionBarBtnText}>Folder</Text>
        </TouchableOpacity>
        <View style={styles.actionBarSpacer} />
        <TouchableOpacity
          style={[styles.actionBarBtn, styles.exportBtn]}
          onPress={() => setShowExportModal(true)}
          activeOpacity={0.7}
        >
          <Download size={15} color={IDE.warning} />
          <Text style={[styles.actionBarBtnText, { color: IDE.warning }]}>Export</Text>
        </TouchableOpacity>
      </View>

      <SponsorBanner style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 0 }} />
      <FlatList
        data={filteredFiles}
        keyExtractor={(item) => item.node.id + '_' + item.path}
        renderItem={({ item }) => (
          <FileTreeItem
            node={item.node}
            depth={item.depth}
            expanded={expandedDirs.has(item.node.id)}
            isActive={activeFile === item.path}
            onPress={(n) => {
              if (n.type === 'directory') {
                toggleDir(n);
              } else {
                openFile(n, item.path);
              }
            }}
            onToggle={toggleDir}
            onLongPress={(n) => handleLongPress(n, item.path)}
          />
        )}
        style={styles.fileList}
        contentContainerStyle={styles.fileListContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyListText}>Project is empty. Create files or folders.</Text>
          </View>
        }
      />

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {currentProject?.projectType || 'custom'} • {projectStats ? `${projectStats.files} files, ${projectStats.dirs} folders` : `${files.length} items`}
        </Text>
        {projectStats && (
          <Text style={styles.statusText}>
            {projectStats.totalChars > 1024 ? Math.round(projectStats.totalChars / 1024) + ' KB' : projectStats.totalChars + ' B'}
          </Text>
        )}
      </View>

      <NewProjectModal
        visible={showNewProject}
        name={newProjectName}
        type={newProjectType}
        onChangeName={setNewProjectName}
        onChangeType={setNewProjectType}
        onCreate={handleCreateProject}
        onClose={() => setShowNewProject(false)}
      />

      <NewFileModal
        visible={showNewFileModal}
        name={newFileName}
        isDir={newFileIsDir}
        basePath={newFileBasePath}
        content={newFileContent}
        onChangeName={setNewFileName}
        onChangeContent={setNewFileContent}
        onCreate={handleCreateNewFile}
        onClose={() => setShowNewFileModal(false)}
      />

      <ExportModal
        visible={showExportModal}
        projectName={currentProject?.name ?? ''}
        stats={projectStats}
        isExporting={isExporting}
        onExport={handleExport}
        onClose={() => setShowExportModal(false)}
      />
    </View>
  );
}

function NewProjectModal({ visible, name, type, onChangeName, onChangeType, onCreate, onClose }: {
  visible: boolean;
  name: string;
  type: string;
  onChangeName: (v: string) => void;
  onChangeType: (v: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <Text style={modalStyles.title}>New Project</Text>

          <Text style={modalStyles.label}>Project name</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="MyProject"
            placeholderTextColor={IDE.muted}
            value={name}
            onChangeText={onChangeName}
            autoFocus
          />

          <Text style={modalStyles.label}>Project type</Text>
          <View style={modalStyles.typeGrid}>
            {PROJECT_TYPES.map(pt => (
              <TouchableOpacity
                key={pt.id}
                style={[modalStyles.typeCard, type === pt.id && modalStyles.activeTypeCard]}
                onPress={() => onChangeType(pt.id)}
                activeOpacity={0.7}
              >
                <Text style={modalStyles.typeIcon}>{pt.icon}</Text>
                <Text style={[modalStyles.typeName, type === pt.id && modalStyles.activeTypeName]}>{pt.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={modalStyles.actions}>
            <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCreate} style={modalStyles.createBtn}>
              <Text style={modalStyles.createText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NewFileModal({ visible, name, isDir, basePath, content, onChangeName, onChangeContent, onCreate, onClose }: {
  visible: boolean;
  name: string;
  isDir: boolean;
  basePath: string;
  content: string;
  onChangeName: (v: string) => void;
  onChangeContent: (v: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <Text style={modalStyles.title}>
            {isDir ? '📁 New Folder' : '📄 New File'}
          </Text>

          {basePath ? (
            <View style={nfStyles.pathHint}>
              <Text style={nfStyles.pathHintText}>in: {basePath}/</Text>
            </View>
          ) : null}

          <Text style={modalStyles.label}>{isDir ? 'Folder name' : 'File name'}</Text>
          <TextInput
            style={modalStyles.input}
            placeholder={isDir ? 'new-folder' : 'file.kt'}
            placeholderTextColor={IDE.muted}
            value={name}
            onChangeText={onChangeName}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />

          {!isDir && (
            <>
              <Text style={modalStyles.label}>Content (optional)</Text>
              <TextInput
                style={[modalStyles.input, nfStyles.contentInput]}
                placeholder="// File content..."
                placeholderTextColor={IDE.muted}
                value={content}
                onChangeText={onChangeContent}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

          <View style={modalStyles.actions}>
            <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCreate} style={modalStyles.createBtn}>
              <Text style={modalStyles.createText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ExportModal({ visible, projectName, stats, isExporting, onExport, onClose }: {
  visible: boolean;
  projectName: string;
  stats: { files: number; dirs: number; totalChars: number } | null;
  isExporting: boolean;
  onExport: (format: 'zip' | 'text' | 'json') => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <Text style={modalStyles.title}>Export Project</Text>

          <View style={exportStyles.projectInfo}>
            <Download size={20} color={IDE.warning} />
            <View style={exportStyles.projectInfoText}>
              <Text style={exportStyles.projectName}>{projectName}</Text>
              {stats && (
                <Text style={exportStyles.projectStats}>
                  {stats.files} files · {stats.dirs} folders · {stats.totalChars > 1024 ? Math.round(stats.totalChars / 1024) + ' KB' : stats.totalChars + ' B'}
                </Text>
              )}
            </View>
          </View>

          <Text style={exportStyles.formatLabel}>Choose format</Text>

          <TouchableOpacity
            style={[exportStyles.formatOption, exportStyles.formatOptionPrimary]}
            onPress={() => onExport('zip')}
            disabled={isExporting}
            activeOpacity={0.7}
          >
            <View style={[exportStyles.formatIcon, { backgroundColor: IDE.warning + '20' }]}>
              <FolderArchive size={20} color={IDE.warning} />
            </View>
            <View style={exportStyles.formatInfo}>
              <View style={exportStyles.formatTitleRow}>
                <Text style={exportStyles.formatTitle}>ZIP Archive (.zip)</Text>
                <View style={exportStyles.recommendedBadge}>
                  <CheckCircle size={10} color={IDE.accent} />
                  <Text style={exportStyles.recommendedText}>Recommended</Text>
                </View>
              </View>
              <Text style={exportStyles.formatDesc}>
                Real folder structure with all files. Just unzip and go.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={exportStyles.formatOption}
            onPress={() => onExport('json')}
            disabled={isExporting}
            activeOpacity={0.7}
          >
            <View style={[exportStyles.formatIcon, { backgroundColor: IDE.primary + '20' }]}>
              <FileJson size={18} color={IDE.primary} />
            </View>
            <View style={exportStyles.formatInfo}>
              <Text style={exportStyles.formatTitle}>JSON Export (.json)</Text>
              <Text style={exportStyles.formatDesc}>Machine readable format for re-importing.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={exportStyles.formatOption}
            onPress={() => onExport('text')}
            disabled={isExporting}
            activeOpacity={0.7}
          >
            <View style={[exportStyles.formatIcon, { backgroundColor: IDE.accent + '20' }]}>
              <FileText size={18} color={IDE.accent} />
            </View>
            <View style={exportStyles.formatInfo}>
              <Text style={exportStyles.formatTitle}>Text Bundle (.txt)</Text>
              <Text style={exportStyles.formatDesc}>All files in one text file. Good for reading.</Text>
            </View>
          </TouchableOpacity>

          {isExporting && (
            <View style={exportStyles.loadingRow}>
              <ActivityIndicator size="small" color={IDE.primary} />
              <Text style={exportStyles.loadingText}>Exporting...</Text>
            </View>
          )}

          <View style={modalStyles.actions}>
            <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn} disabled={isExporting}>
              <Text style={modalStyles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const exportStyles = StyleSheet.create({
  projectInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: IDE.warning + '10',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: IDE.warning + '25',
  },
  projectInfoText: {
    flex: 1,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: IDE.text,
  },
  projectStats: {
    fontSize: 12,
    color: IDE.muted,
    marginTop: 2,
  },
  formatLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: IDE.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  formatOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: IDE.bg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  formatOptionPrimary: {
    borderColor: IDE.warning + '50',
    backgroundColor: IDE.warning + '08',
  },
  formatTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  recommendedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: IDE.accent + '18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.accent,
    letterSpacing: 0.3,
  },
  formatIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  formatInfo: {
    flex: 1,
  },
  formatTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: IDE.text,
  },
  formatDesc: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  loadingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 13,
    color: IDE.primary,
    fontWeight: '500' as const,
  },
});

const nfStyles = StyleSheet.create({
  pathHint: {
    backgroundColor: IDE.bg,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  pathHintText: {
    fontSize: 12,
    color: IDE.muted,
    fontFamily: 'monospace',
  },
  contentInput: {
    minHeight: 80,
    maxHeight: 160,
    fontFamily: 'monospace',
    fontSize: 13,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IDE.bg,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: IDE.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: IDE.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: IDE.muted,
    textAlign: 'center' as const,
  },
  createButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: IDE.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  projectHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    backgroundColor: IDE.surface,
  },
  projectTabs: {
    flex: 1,
    paddingHorizontal: 8,
  },
  projectTab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeProjectTab: {
    borderBottomColor: IDE.primary,
  },
  projectTabText: {
    fontSize: 13,
    color: IDE.muted,
    fontWeight: '500' as const,
  },
  activeProjectTabText: {
    color: IDE.text,
    fontWeight: '600' as const,
  },
  addProjectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchToggle: {
    padding: 10,
  },
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: IDE.surface,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: IDE.text,
    padding: 0,
  },
  actionBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: IDE.surface,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    gap: 10,
  },
  actionBarBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: IDE.bg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  actionBarBtnText: {
    fontSize: 12,
    color: IDE.textSecondary,
    fontWeight: '500' as const,
  },
  actionBarSpacer: {
    flex: 1,
  },
  exportBtn: {
    borderColor: IDE.warning + '40',
    backgroundColor: IDE.warning + '08',
  },
  fileList: {
    flex: 1,
  },
  fileListContent: {
    paddingBottom: 20,
  },
  emptyList: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyListText: {
    fontSize: 13,
    color: IDE.muted,
    textAlign: 'center' as const,
  },
  statusBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
  },
  statusText: {
    fontSize: 11,
    color: IDE.muted,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: IDE.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: IDE.text,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: IDE.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 6,
    padding: 12,
    fontSize: 15,
    color: IDE.text,
  },
  typeGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 4,
  },
  typeCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: IDE.bg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  activeTypeCard: {
    borderColor: IDE.primary,
    backgroundColor: IDE.primary + '15',
  },
  typeIcon: {
    fontSize: 16,
  },
  typeName: {
    fontSize: 13,
    color: IDE.textSecondary,
    fontWeight: '500' as const,
  },
  activeTypeName: {
    color: IDE.primary,
  },
  actions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    color: IDE.muted,
    fontWeight: '500' as const,
  },
  createBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: IDE.primary,
    borderRadius: 6,
  },
  createText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600' as const,
  },
});
