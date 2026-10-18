import {
  compressChat,
  analyzeChat,
  prepareCompressionPreview,
  extractKeyMessages,
  MAX_TOOL_RESULT_LENGTH,
  truncateToolResult,
  compressAndSanitizeMessagesForAPI,
} from '../../utils/chat-compression';
import { ChatMessage } from '../../types';

describe('chat-compression utils', () => {
  const t = Date.now();
  const mockMessages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hallo, wie geht es dir?', timestamp: t },
    { id: '2', role: 'assistant', content: 'Mir geht es gut, danke! Wie kann ich dir helfen?', timestamp: t + 1000 },
    { id: '3', role: 'user', content: 'Ich habe einen Bug in meiner App.', timestamp: t + 2000 },
    { id: '4', role: 'assistant', content: 'Lass uns den Fehler beheben. Kannst du den Code zeigen?', timestamp: t + 3000 },
    { id: '5', role: 'user', content: 'Ja, da ist es: const x = 5;', timestamp: t + 4000 },
    { id: '6', role: 'assistant', content: 'wir machen das jetzt so: y = 10;', timestamp: t + 5000 },
    { id: '7', role: 'user', content: 'Was ist mit der Datei app.ts?', timestamp: t + 6000 },
    { id: '8', role: 'assistant', content: 'Die Datei app.ts muss angepasst werden.', timestamp: t + 7000 },
    { id: '9', role: 'user', content: 'Danke!', timestamp: t + 8000 },
    { id: '10', role: 'assistant', content: 'Bitte sehr!', timestamp: t + 9000 },
    { id: '11', role: 'user', content: 'Ein weiterer Text.', timestamp: t + 10000 },
    { id: '12', role: 'assistant', content: 'Ein weiterer Text.', timestamp: t + 11000 },
    { id: '13', role: 'user', content: 'Noch ein Text.', timestamp: t + 12000 },
    { id: '14', role: 'assistant', content: 'Noch ein Text.', timestamp: t + 13000 },
    { id: '15', role: 'user', content: 'Und noch einer.', timestamp: t + 14000 },
    { id: '16', role: 'assistant', content: 'Und noch einer.', timestamp: t + 15000 },
    { id: '17', role: 'user', content: 'Fast fertig.', timestamp: t + 16000 },
    { id: '18', role: 'assistant', content: 'Fast fertig.', timestamp: t + 17000 },
    { id: '19', role: 'user', content: 'Letzter.', timestamp: t + 18000 },
    { id: '20', role: 'assistant', content: 'Letzter.', timestamp: t + 19000 },
    { id: '21', role: 'user', content: 'Allerletzter.', timestamp: t + 20000 },
    { id: '22', role: 'assistant', content: 'Allerletzter.', timestamp: t + 21000 },
  ];

  describe('analyzeChat', () => {
    it('should correctly identify greetings', () => {
      const analysis = analyzeChat([{ id: '1', role: 'user', content: 'hallo', timestamp: t }]);
      expect(analysis.greetings.length).toBe(1);
    });

    it('should correctly identify errors', () => {
      const analysis = analyzeChat([{ id: '1', role: 'user', content: 'es gibt einen bug', timestamp: t }]);
      expect(analysis.errors.length).toBe(1);
    });

    it('should correctly identify decisions', () => {
      const analysis = analyzeChat([{ id: '1', role: 'assistant', content: 'wir machen das so', timestamp: t }]);
      expect(analysis.decisions.length).toBe(1);
    });

    it('should correctly identify code snippets', () => {
      const analysis = analyzeChat([{ id: '1', role: 'user', content: 'Schau mal, das ist der Code: ```javascript\nconsole.log("hello");\n```', timestamp: t }]);
      expect(analysis.codeSnippets.length).toBe(1);
    });

    it('should correctly identify repetitions', () => {
      const analysis = analyzeChat([
        { id: '1', role: 'user', content: 'wiederholung', timestamp: t },
        { id: '2', role: 'assistant', content: 'wiederholung', timestamp: t + 1000 }
      ]);
      expect(analysis.repetitions.length).toBe(1);
    });

    it('should safely handle null/undefined entries and missing content', () => {
      const analysis = analyzeChat([null as any, undefined as any, { id: 'x', role: 'user', content: undefined as any, timestamp: t }]);
      expect(analysis.greetings.length).toBe(0);
    });
  });

  describe('compressChat', () => {
    it('should compress chat based on keepLastN', () => {
      const result = compressChat(mockMessages, { keepLastN: 5, includeSummary: false });
      expect(result.messages.length).toBeGreaterThanOrEqual(5);
      expect(result.messages[result.messages.length - 1].id).toBe('22');
    });

    it('should keep important messages', () => {
      const result = compressChat(mockMessages, { keepLastN: 2, includeSummary: false });
      const keptIds = result.messages.map(m => m.id);
      expect(keptIds).toContain('3');
      expect(keptIds).toContain('4');
      expect(keptIds).toContain('5');
      expect(keptIds).toContain('6');
      expect(keptIds).toContain('7');
    });

    it('should include a summary when includeSummary is true', () => {
      const result = compressChat(mockMessages, { includeSummary: true });
      expect(result.summary).toBeTruthy();
      expect(result.summary).toContain('Entscheidungen');
    });
  });

  describe('prepareCompressionPreview & extractKeyMessages', () => {
    it('should return preview info', () => {
      const preview = prepareCompressionPreview(mockMessages);
      expect(preview.canCompress).toBeDefined();
      expect(preview.recommendation).toBeDefined();
      expect(preview.preview.compressionRatio).toBeDefined();
    });

    it('should extract the most important messages up to limit', () => {
      const keyMessages = extractKeyMessages(mockMessages, 3);
      expect(keyMessages.length).toBeLessThanOrEqual(3);
    });
  });

  describe('truncateToolResult & compressAndSanitizeMessagesForAPI', () => {
    it('should enforce MAX_TOOL_RESULT_LENGTH = 6000', () => {
      expect(MAX_TOOL_RESULT_LENGTH).toBe(6000);
      const huge = 'X'.repeat(10000);
      const truncated = truncateToolResult(huge);
      expect(truncated.length).toBeLessThanOrEqual(6000);
      expect(truncated).toContain('[... Tool-Output gekürzt');
    });

    it('should truncate oversized tool messages and nested toolCall results before API calls', () => {
      const msgs: ChatMessage[] = [
        { id: 'u1', role: 'user', content: 'Bitte prüfe Datei', timestamp: t },
        {
          id: 'a1',
          role: 'assistant',
          content: 'Ich lese die Datei',
          toolCalls: [{ id: 'tc1', name: 'read_file', arguments: { path: 'a.ts' }, status: 'completed', result: 'R'.repeat(9000) }],
          timestamp: t + 100,
        },
        { id: 't1', role: 'tool', content: 'T'.repeat(9000), toolCallId: 'tc1', toolName: 'read_file', timestamp: t + 200 },
      ];
      const sanitized = compressAndSanitizeMessagesForAPI(msgs);
      const toolMsg = sanitized.find(m => m.role === 'tool');
      const assistantMsg = sanitized.find(m => m.role === 'assistant');
      expect(toolMsg?.content.length).toBeLessThanOrEqual(6000);
      expect(assistantMsg?.toolCalls?.[0]?.result?.length).toBeLessThanOrEqual(6000);
    });
  });
});
