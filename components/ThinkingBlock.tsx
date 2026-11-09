import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react-native';
import { IDE } from '@/constants/colors';

interface Props {
  thinking: string;
  isLive?: boolean;
  phase?: string;
}

const GENERIC_PHASE_STRINGS = new Set([
  'thinking...',
  'dev0 is thinking...',
  'processing tool results...',
  'executing tools...',
  'reasoning & analyzing...',
]);

function isRealReasoningContent(text?: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return !GENERIC_PHASE_STRINGS.has(trimmed.toLowerCase());
}

const ThinkingBlock = React.memo(({ thinking, isLive, phase }: Props) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const pulseAnim = useRef(new Animated.Value(0.45)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const hasRealReasoning = isRealReasoningContent(thinking);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1.12, duration: 750, useNativeDriver: false }),
          Animated.timing(ringAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 0.45, duration: 750, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 0.92, duration: 750, useNativeDriver: false }),
          Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ]),
    );
    if (isLive || !hasRealReasoning) {
      pulseLoop.start();
    } else {
      pulseAnim.setValue(1);
      scaleAnim.setValue(1);
    }
    return () => pulseLoop.stop();
  }, [isLive, hasRealReasoning, pulseAnim, scaleAnim, ringAnim]);

  useEffect(() => {
    if (isLive && expanded && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      }, 50);
    }
  }, [thinking, phase, isLive, expanded]);

  const toggle = useCallback(() => setExpanded(p => !p), []);

  // Phase 1: While waiting / thinking before reasoning text streams in -> ONLY render the Animated Reasoning Orb!
  if (isLive && !hasRealReasoning) {
    const ringScale = ringAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 1.65],
    });
    const ringOpacity = ringAnim.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0.65, 0.2, 0],
    });

    return (
      <View style={styles.orbOnlyRow}>
        <View style={styles.orbWrapper}>
          <Animated.View
            style={[
              styles.orbOuterRing,
              {
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.orbCore,
              {
                transform: [{ scale: scaleAnim }],
                opacity: pulseAnim,
              },
            ]}
          >
            <View style={styles.orbInnerHighlight} />
          </Animated.View>
        </View>
        <Text style={styles.orbStatusText} numberOfLines={1}>
          {phase || 'Extended reasoning active...'}
        </Text>
      </View>
    );
  }

  if (!hasRealReasoning) {
    return null;
  }

  // Phase 2: Once reasoning text is available -> render ONLY ONE text-streaming box
  const displayContent = stripMarkdown(thinking);
  const lineCount = displayContent ? displayContent.split('\n').length : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} style={styles.header} activeOpacity={0.7}>
        <Animated.View style={[styles.miniOrb, { opacity: pulseAnim }]} />
        <Brain size={13} color={IDE.keyword} />
        <Text style={styles.label} numberOfLines={1}>
          {isLive ? phase || 'Streaming Extended Reasoning...' : 'Extended Thinking'}
        </Text>
        {!isLive && lineCount > 0 ? (
          <Text style={styles.lengthBadge}>{lineCount} lines</Text>
        ) : null}
        {Boolean(isLive) ? (
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.liveBadgeText}>STREAM</Text>
          </View>
        ) : null}
        <View style={styles.chevron}>
          {expanded ? (
            <ChevronDown size={14} color={IDE.muted} />
          ) : (
            <ChevronRight size={14} color={IDE.muted} />
          )}
        </View>
      </TouchableOpacity>

      {expanded ? (
        <ScrollView
          ref={scrollRef}
          style={styles.contentScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.content}>
            <Text style={styles.thinkingText}>{displayContent}</Text>
            {Boolean(isLive) ? (
              <Animated.View style={[styles.cursor, { opacity: pulseAnim }]} />
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';

function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export default ThinkingBlock;

const styles = StyleSheet.create({
  orbOnlyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  orbWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  orbOuterRing: {
    position: 'absolute' as const,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: IDE.keyword,
    backgroundColor: IDE.keyword + '22',
  },
  orbCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: IDE.keyword,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: IDE.keyword,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  orbInnerHighlight: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.85,
  },
  orbStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: IDE.keyword,
    letterSpacing: 0.2,
  },
  container: {
    backgroundColor: IDE.keyword + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.keyword + '28',
    marginVertical: 6,
    overflow: 'hidden' as const,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  miniOrb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IDE.keyword,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: IDE.keyword,
    flex: 1,
  },
  lengthBadge: {
    fontSize: 10,
    color: IDE.muted,
    backgroundColor: IDE.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.keyword + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IDE.keyword,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.keyword,
    letterSpacing: 0.5,
  },
  chevron: {
    marginLeft: 4,
  },
  contentScroll: {
    maxHeight: 210,
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: IDE.keyword + '20',
    padding: 10,
    backgroundColor: IDE.bg + 'CC',
  },
  thinkingText: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  cursor: {
    width: 6,
    height: 14,
    backgroundColor: IDE.keyword,
    borderRadius: 1,
    marginTop: 4,
  },
});
