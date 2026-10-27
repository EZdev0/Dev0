import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredChatMessageDigest {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  contentSnippet: string;
  timestamp: number;
}

export interface StoredChatSessionSnapshot {
  sessionId: string;
  title: string;
  projectName?: string;
  mode: 'chat' | 'agent';
  updatedAt: number;
  messageCount: number;
  messages: StoredChatMessageDigest[];
}

const CROSS_CHAT_STORAGE_KEY = 'dev0_cross_chat_sessions_v1';
const MAX_STORED_SESSIONS = 25;
const MAX_MESSAGES_PER_SESSION = 30;
const MAX_SNIPPET_LENGTH = 360;
const MAX_READ_OUTPUT_CHARS = 1750;

let inMemorySessionsCache: StoredChatSessionSnapshot[] = [];

function normalizeContentSnippet(raw: string): string {
  const cleaned = (raw || '')
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= MAX_SNIPPET_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_SNIPPET_LENGTH)}...`;
}

export async function clearCrossChatStoreForTests(): Promise<void> {
  inMemorySessionsCache = [];
  try {
    await AsyncStorage.removeItem(CROSS_CHAT_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

export async function loadCrossChatSessions(): Promise<StoredChatSessionSnapshot[]> {
  if (inMemorySessionsCache.length > 0) {
    return inMemorySessionsCache;
  }
  try {
    const raw = await AsyncStorage.getItem(CROSS_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemorySessionsCache = parsed;
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

export async function saveCrossChatSessionSnapshot(
  paramsOrSessionId:
    | {
        sessionId: string;
        title?: string;
        projectName?: string;
        mode?: 'chat' | 'agent';
        messages: { id: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: string; timestamp: number }[];
      }
    | string,
  maybeMessagesOrTitle?:
    | { id: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: string; timestamp: number }[]
    | string,
  maybeProjectOrMessages?:
    | string
    | { id: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: string; timestamp: number }[]
): Promise<void> {
  let params: {
    sessionId: string;
    title?: string;
    projectName?: string;
    mode: 'chat' | 'agent';
    messages: { id: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: string; timestamp: number }[];
  };

  if (typeof paramsOrSessionId === 'string') {
    if (Array.isArray(maybeMessagesOrTitle)) {
      params = {
        sessionId: paramsOrSessionId,
        projectName: typeof maybeProjectOrMessages === 'string' ? maybeProjectOrMessages : undefined,
        mode: 'chat',
        messages: maybeMessagesOrTitle,
      };
    } else {
      params = {
        sessionId: paramsOrSessionId,
        title: typeof maybeMessagesOrTitle === 'string' ? maybeMessagesOrTitle : undefined,
        mode: 'chat',
        messages: Array.isArray(maybeProjectOrMessages) ? maybeProjectOrMessages : [],
      };
    }
  } else {
    params = {
      ...paramsOrSessionId,
      mode: paramsOrSessionId.mode || 'chat',
    };
  }

  const visibleMessages = (params.messages || []).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && m.content && m.content.trim().length > 0
  );
  if (visibleMessages.length === 0) return;

  const firstUserMsg = visibleMessages.find((m) => m.role === 'user');
  const computedTitle =
    params.title ||
    (firstUserMsg ? normalizeContentSnippet(firstUserMsg.content).slice(0, 64) : 'Chat Session');

  const snapshot: StoredChatSessionSnapshot = {
    sessionId: params.sessionId,
    title: computedTitle,
    projectName: params.projectName,
    mode: params.mode,
    updatedAt: Date.now(),
    messageCount: visibleMessages.length,
    messages: visibleMessages.slice(-MAX_MESSAGES_PER_SESSION).map((m) => ({
      id: m.id,
      role: m.role,
      contentSnippet: normalizeContentSnippet(m.content),
      timestamp: m.timestamp || Date.now(),
    })),
  };

  const existing = await loadCrossChatSessions();
  const filtered = existing.filter((s) => s.sessionId !== params.sessionId);
  const next = [snapshot, ...filtered].slice(0, MAX_STORED_SESSIONS);
  inMemorySessionsCache = next;

  try {
    await AsyncStorage.setItem(CROSS_CHAT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Token-efficient BM25-style cross-chat search & reader.
 * Strictly capped under 1,750 characters so reading other chats never bloats the token context.
 */
export async function readOtherChatMessages(options?: {
  currentSessionId?: string;
  currentChatId?: string;
  query?: string;
  sessionId?: string;
  limit?: number;
  maxMessages?: number;
  maxSnippets?: number;
}): Promise<string> {
  const sessions = await loadCrossChatSessions();
  const activeSessionId = options?.currentSessionId || options?.currentChatId;
  const otherSessions = sessions.filter((s) =>
    options?.sessionId ? s.sessionId === options.sessionId : s.sessionId !== activeSessionId
  );

  if (otherSessions.length === 0) {
    return 'No other chat sessions were found in memory yet.';
  }

  const rawLimit = options?.limit ?? options?.maxSnippets ?? options?.maxMessages ?? 5;
  const maxItems = Math.min(Math.max(rawLimit, 1), 10);
  const queryTerms = (options?.query || '')
    .toLowerCase()
    .split(/[^a-z0-9_äöüß-]+/)
    .filter((t) => t.length >= 2);

  if (queryTerms.length === 0) {
    // Return compact session overview + latest messages
    const lines: string[] = [`Cross-Chat Overview (${otherSessions.length} session(s)):`];
    for (const s of otherSessions.slice(0, maxItems)) {
      const latest = s.messages.slice(-2);
      lines.push(
        `- [${s.sessionId}] "${s.title}" (${s.mode} mode, ${s.messageCount} msgs${s.projectName ? `, project: ${s.projectName}` : ''})`
      );
      for (const m of latest) {
        lines.push(`    ${m.role.toUpperCase()}: ${m.contentSnippet}`);
      }
    }
    const output = lines.join('\n');
    return output.length > MAX_READ_OUTPUT_CHARS
      ? `${output.slice(0, MAX_READ_OUTPUT_CHARS)}\n...[truncated for token efficiency]`
      : output;
  }

  // Score messages with lightweight BM25 keyword overlap
  const scored: {
    session: StoredChatSessionSnapshot;
    msg: StoredChatMessageDigest;
    score: number;
  }[] = [];

  for (const session of otherSessions) {
    for (const msg of session.messages) {
      const hay = `${session.title} ${session.projectName || ''} ${msg.contentSnippet}`.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        if (hay.includes(term)) {
          score += 2;
          if (msg.contentSnippet.toLowerCase().includes(term)) score += 3;
        }
      }
      if (score > 0) {
        scored.push({ session, msg, score });
      }
    }
  }

  if (scored.length === 0) {
    return `No matching messages found across ${otherSessions.length} other chat session(s) for query "${options?.query}".`;
  }

  scored.sort((a, b) => b.score - a.score || b.msg.timestamp - a.msg.timestamp);
  const top = scored.slice(0, maxItems);
  const lines = [`Cross-Chat Matches for "${options?.query}" (top ${top.length}):`];
  for (const item of top) {
    lines.push(
      `- [${item.session.sessionId} | ${item.session.title}] ${item.msg.role.toUpperCase()}: ${item.msg.contentSnippet}`
    );
  }
  const output = lines.join('\n');
  return output.length > MAX_READ_OUTPUT_CHARS
    ? `${output.slice(0, MAX_READ_OUTPUT_CHARS)}\n...[truncated for token efficiency]`
    : output;
}
