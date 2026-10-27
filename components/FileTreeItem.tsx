import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreHorizontal } from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { FileNode } from '@/types';
import { getFileColor, getFileLabel } from '@/utils/file-icons';

interface Props {
  node: FileNode;
  depth: number;
  expanded: boolean;
  isActive: boolean;
  onPress: (node: FileNode) => void;
  onLongPress?: (node: FileNode) => void;
  onToggle: (node: FileNode) => void;
}

const FileTreeItem = React.memo(({ node, depth, expanded, isActive, onPress, onLongPress, onToggle }: Props) => {
  const handlePress = useCallback(() => {
    if (node.type === 'directory') {
      onToggle(node);
    } else {
      onPress(node);
    }
  }, [node, onPress, onToggle]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(node);
  }, [node, onLongPress]);

  const isDir = node.type === 'directory';
  const color = isDir ? IDE.primary : getFileColor(node.name);
  const label = isDir ? null : getFileLabel(node.name);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.6}
      style={[
        styles.row,
        { paddingLeft: 12 + depth * 18 },
        isActive && styles.activeRow,
      ]}
      testID={`file-tree-item-${node.name}`}
    >
      {isActive && <View style={styles.activeIndicator} />}

      {isDir ? (
        <View style={styles.chevron}>
          {expanded ? (
            <ChevronDown size={14} color={IDE.muted} />
          ) : (
            <ChevronRight size={14} color={IDE.muted} />
          )}
        </View>
      ) : (
        <View style={styles.chevron} />
      )}

      {isDir ? (
        expanded ? (
          <FolderOpen size={16} color={IDE.primary} style={styles.icon} />
        ) : (
          <Folder size={16} color={IDE.primary} style={styles.icon} />
        )
      ) : (
        <View style={[styles.fileIcon, { backgroundColor: color + '22' }]}>
          <Text style={[styles.fileLabel, { color }]}>{label}</Text>
        </View>
      )}

      <Text
        style={[styles.name, isDir && styles.dirName, isActive && styles.activeName]}
        numberOfLines={1}
      >
        {node.name}
      </Text>

      {onLongPress && (
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={handleLongPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          testID={`file-tree-more-${node.name}`}
        >
          <MoreHorizontal size={15} color={IDE.muted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

FileTreeItem.displayName = 'FileTreeItem';

export default FileTreeItem;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingVertical: 8,
    paddingRight: 8,
    position: 'relative' as const,
  },
  moreBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 6,
    marginLeft: 4,
  },
  activeRow: {
    backgroundColor: IDE.surface,
  },
  activeIndicator: {
    position: 'absolute' as const,
    left: 0,
    top: 4,
    bottom: 4,
    width: 2,
    backgroundColor: IDE.primary,
    borderRadius: 1,
  },
  chevron: {
    width: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  icon: {
    marginRight: 8,
  },
  fileIcon: {
    width: 22,
    height: 18,
    borderRadius: 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
  },
  fileLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 13,
    color: IDE.textSecondary,
    flex: 1,
  },
  dirName: {
    color: IDE.text,
    fontWeight: '500' as const,
  },
  activeName: {
    color: IDE.text,
    fontWeight: '600' as const,
  },
});
