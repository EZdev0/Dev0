export function parseToolCallsFromText(text: string): { toolCalls: any[], cleanContent: string } {
  if (!text) return { toolCalls: [], cleanContent: '' };
  const toolCalls: any[] = [];
  let cleanContent = text;

  const toolRegex = /```tool\n(\{[\s\S]*?\})\n```/g;
  let match;
  while ((match = toolRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      toolCalls.push({
        id: 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: parsed.name,
        arguments: parsed.arguments || {}
      });
      cleanContent = cleanContent.replace(match[0], '').trim();
    } catch (e) {
      console.log('Error parsing tool call json', e);
    }
  }
  return { toolCalls, cleanContent };
}
