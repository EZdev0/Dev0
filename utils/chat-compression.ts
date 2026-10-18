/**
 * Chat-Komprimierungs-System
 * 
 * Analysiert Chatverläufe und komprimiert sie intelligent
 * - Behält wichtige Informationen (Entscheidungen, Code, Fehler)
 * - Entfernt Irrelevantes (Begrüßungen, Wiederholungen)
 */

import { ChatMessage } from '@/types';

export interface CompressedChat {
  originalCount: number;
  compressedCount: number;
  summary: string;
  messages: ChatMessage[];
  removedMessages: ChatMessage[];
  compressionRatio: number;
}

export interface ChatAnalysis {
  importantMessages: ChatMessage[];
  removableMessages: ChatMessage[];
  decisions: ChatMessage[];
  codeSnippets: ChatMessage[];
  errors: ChatMessage[];
  greetings: ChatMessage[];
  repetitions: ChatMessage[];
}

export const MAX_TOOL_RESULT_LENGTH = 6000;

/**
 * Truncates long tool results to at most maxLength characters (default: 6000)
 * to prevent HTTP 413 / 500 / timeout crashes on Rork and other providers.
 */
export function truncateToolResult(
  content: string | undefined | null,
  maxLength: number = MAX_TOOL_RESULT_LENGTH
): string {
  if (typeof content !== 'string') return '';
  if (content.length <= maxLength) return content;
  const suffix = '\n... [... Tool-Output gekürzt / truncated]';
  if (maxLength <= suffix.length) {
    return content.slice(0, Math.max(0, maxLength));
  }
  return content.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Enforces context compression and truncates all tool outputs to max 6,000 characters
 * before sending messages to an AI API endpoint.
 */
export function compressAndSanitizeMessagesForAPI(
  messages: ChatMessage[],
  options?: {
    maxMessages?: number;
    keepLastN?: number;
    maxToolLength?: number;
  }
): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const {
    maxMessages = 20,
    keepLastN = 12,
    maxToolLength = MAX_TOOL_RESULT_LENGTH,
  } = options || {};

  const validMessages = messages.filter((m): m is ChatMessage => Boolean(m && typeof m === 'object'));
  if (validMessages.length === 0) return [];

  const effectiveKeepLastN = validMessages.length <= maxMessages
    ? validMessages.length
    : keepLastN;

  const compressed = compressChat(validMessages, {
    maxMessages,
    keepLastN: effectiveKeepLastN,
    includeSummary: validMessages.length > maxMessages,
  });

  // Ensure assistant tool_calls and their corresponding tool result messages stay paired
  const keptIdSet = new Set(compressed.messages.map(m => m.id));
  for (const msg of validMessages) {
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && keptIdSet.has(msg.id)) {
      const callIds = new Set(msg.toolCalls.map(tc => tc.id));
      for (const candidate of validMessages) {
        if (candidate.role === 'tool' && candidate.toolCallId && callIds.has(candidate.toolCallId)) {
          keptIdSet.add(candidate.id);
        }
      }
    }
    if (msg.role === 'tool' && msg.toolCallId && keptIdSet.has(msg.id)) {
      for (const candidate of validMessages) {
        if (candidate.role === 'assistant' && candidate.toolCalls?.some(tc => tc.id === msg.toolCallId)) {
          keptIdSet.add(candidate.id);
        }
      }
    }
  }

  const orderedMessages = validMessages
    .filter(m => keptIdSet.has(m.id))
    .map(m => {
      const rawContent = typeof m.content === 'string' ? m.content : '';
      const sanitizedContent = m.role === 'tool'
        ? truncateToolResult(rawContent, maxToolLength)
        : rawContent;

      const sanitizedToolCalls = Array.isArray(m.toolCalls)
        ? m.toolCalls.map(tc => ({
            ...tc,
            result: tc.result !== undefined ? truncateToolResult(tc.result, maxToolLength) : undefined,
          }))
        : undefined;

      return {
        ...m,
        content: sanitizedContent,
        ...(sanitizedToolCalls ? { toolCalls: sanitizedToolCalls } : {}),
      };
    });

  if (compressed.removedMessages.length > 0 && compressed.summary && orderedMessages.length > 0) {
    const firstIdx = orderedMessages.findIndex(m => m.role === 'user');
    if (firstIdx >= 0 && !orderedMessages[firstIdx].content.includes('[Compressed Context Summary]')) {
      orderedMessages[firstIdx] = {
        ...orderedMessages[firstIdx],
        content: `[Compressed Context Summary]\n${compressed.summary}\n\n---\n${orderedMessages[firstIdx].content}`,
      };
    }
  }

  return orderedMessages;
}

/**
 * Komprimiert Chatverlauf intelligent
 */
export function compressChat(messages: ChatMessage[], options?: {
  maxMessages?: number;
  keepLastN?: number;
  includeSummary?: boolean;
}): CompressedChat {
  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const {
    maxMessages = 20,
    keepLastN = 10,
    includeSummary = true
  } = options || {};

  if (safeMessages.length === 0) {
    return {
      originalCount: 0,
      compressedCount: 0,
      summary: '',
      messages: [],
      removedMessages: [],
      compressionRatio: 0,
    };
  }

  // 1. Chat analysieren
  const analysis = analyzeChat(safeMessages);

  // 2. Wichtige Nachrichten behalten
  const importantSet = new Set([
    ...analysis.decisions.map(m => m.id),
    ...analysis.codeSnippets.map(m => m.id),
    ...analysis.errors.map(m => m.id),
    ...analysis.importantMessages.map(m => m.id)
  ]);

  // 3. Letzte N Nachrichten immer behalten
  safeMessages.slice(-keepLastN).forEach(m => importantSet.add(m.id));

  // 4. Filtern (und auf maxMessages begrenzen, falls nötig)
  let keptMessages = safeMessages.filter(m => importantSet.has(m.id));
  if (keptMessages.length > maxMessages && maxMessages > 0) {
    keptMessages = keptMessages.slice(-maxMessages);
  }
  const keptIds = new Set(keptMessages.map(m => m.id));
  const removedMessages = safeMessages.filter(m => !keptIds.has(m.id));

  // 5. Zusammenfassung generieren
  const summary = includeSummary ? generateSummary(analysis) : '';

  return {
    originalCount: safeMessages.length,
    compressedCount: keptMessages.length,
    summary,
    messages: keptMessages,
    removedMessages,
    compressionRatio: ((safeMessages.length - keptMessages.length) / safeMessages.length) * 100
  };
}

/**
 * Analysiert Chat auf relevante Inhalte
 */
export function analyzeChat(messages: ChatMessage[]): ChatAnalysis {
  const analysis: ChatAnalysis = {
    importantMessages: [],
    removableMessages: [],
    decisions: [],
    codeSnippets: [],
    errors: [],
    greetings: [],
    repetitions: []
  };

  if (!Array.isArray(messages)) return analysis;

  const contentHash = new Map<string, number>();

  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const rawContent = typeof message.content === 'string' ? message.content : '';
    const content = rawContent.toLowerCase();
    const isUser = message.role === 'user';

    // Begrüßungen erkennen
    if (isGreeting(content)) {
      analysis.greetings.push(message);
      analysis.removableMessages.push(message);
      continue;
    }

    // Code-Snippets erkennen (meist von Assistant)
    if (containsCode(content)) {
      analysis.codeSnippets.push(message);
      analysis.importantMessages.push(message);
      continue;
    }

    // Fehler-Analysen erkennen
    if (containsError(content)) {
      analysis.errors.push(message);
      analysis.importantMessages.push(message);
      continue;
    }

    // Entscheidungen erkennen
    if (isDecision(content, message)) {
      analysis.decisions.push(message);
      analysis.importantMessages.push(message);
      continue;
    }

    // Wiederholungen erkennen
    const hash = hashContent(rawContent);
    if (contentHash.has(hash)) {
      analysis.repetitions.push(message);
      analysis.removableMessages.push(message);
      continue;
    }
    contentHash.set(hash, messages.indexOf(message));

    // User-Fragen immer wichtig
    if (isUser && content.includes('?')) {
      analysis.importantMessages.push(message);
      continue;
    }

    // KI-Antworten mit File-Referenzen wichtig
    if (!isUser && containsFileReference(content)) {
      analysis.importantMessages.push(message);
      continue;
    }
  }

  return analysis;
}

/**
 * Generiert Zusammenfassung aus Analyse
 */
function generateSummary(analysis: ChatAnalysis): string {
  const parts: string[] = [];

  if (analysis.decisions.length > 0) {
    parts.push(`**Entscheidungen:** ${analysis.decisions.length}`);
  }

  if (analysis.codeSnippets.length > 0) {
    parts.push(`**Code implementiert:** ${analysis.codeSnippets.length} Snippets`);
  }

  if (analysis.errors.length > 0) {
    parts.push(`**Fehler behoben:** ${analysis.errors.length}`);
  }

  if (analysis.importantMessages.length > 0) {
    const keyPoints = analysis.importantMessages
      .slice(0, 5)
      .map(m => `- ${m.content.substring(0, 100)}...`)
      .join('\n');
    
    parts.push(`**Wichtige Punkte:**\n${keyPoints}`);
  }

  return parts.join('\n\n');
}

/**
 * Hilfsfunktionen
 */

function isGreeting(content: string): boolean {
  const greetings = [
    'hallo', 'hi', 'hey', 'good morning', 'guten tag', 'hello',
    'wie geht', 'how are you', 'servus', 'moin'
  ];
  
  return greetings.some(g => content.startsWith(g));
}

function containsCode(content: string): boolean {
  return content.includes('```') || 
         content.includes('import ') || 
         content.includes('function ') ||
         content.includes('const ') ||
         content.includes('export ');
}

function containsError(content: string): boolean {
  const errorKeywords = [
    'error', 'fehler', 'exception', 'failed', 'crash',
    'bug', 'issue', 'problem', 'fix', 'reparatur'
  ];
  
  return errorKeywords.some(keyword => content.includes(keyword));
}

function isDecision(content: string, message: ChatMessage): boolean {
  const decisionPatterns = [
    'wir machen', 'we will', 'entscheidung:', 'decision:',
    'ich habe mich entschieden', 'i decided', 'lassen uns',
    'let\'s do', 'implementiere', 'implementing'
  ];
  
  return decisionPatterns.some(pattern => content.includes(pattern));
}

function containsFileReference(content: string): boolean {
  return content.includes('.ts') || 
         content.includes('.tsx') ||
         content.includes('.js') ||
         content.includes('.json') ||
         content.includes('/') && content.includes('.');
}

function hashContent(content: string): string {
  // Simple hash for deduplication
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Bereitet Chat für Komprimierung vor (User Confirmation)
 */
export function prepareCompressionPreview(messages: ChatMessage[]): {
  preview: CompressedChat;
  canCompress: boolean;
  recommendation: string;
} {
  const preview = compressChat(messages);
  
  const canCompress = preview.compressionRatio > 20; // Mindestens 20% Einsparung
  
  let recommendation = '';
  if (preview.compressionRatio > 50) {
    recommendation = 'Starke Komprimierung empfohlen! Viele irrelevante Nachrichten.';
  } else if (preview.compressionRatio > 30) {
    recommendation = 'Komprimierung sinnvoll.';
  } else if (preview.compressionRatio > 20) {
    recommendation = 'Leichte Komprimierung möglich.';
  } else {
    recommendation = 'Chat ist bereits kompakt. Komprimierung nicht notwendig.';
  }
  
  return {
    preview,
    canCompress,
    recommendation
  };
}

/**
 * Extrahiert die wichtigsten Nachrichten für Quick-View
 */
export function extractKeyMessages(messages: ChatMessage[], limit: number = 10): ChatMessage[] {
  const analysis = analyzeChat(messages);
  
  const allImportant = [
    ...analysis.decisions,
    ...analysis.codeSnippets,
    ...analysis.errors,
    ...analysis.importantMessages
  ];
  
  // Duplikate entfernen und nach Wichtigkeit sortieren
  const unique = Array.from(new Set(allImportant.map(m => m.id)))
    .map(id => allImportant.find(m => m.id === id)!);
  
  return unique.slice(0, limit);
}
