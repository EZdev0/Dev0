import { ExpoRequest } from 'expo-router/server';

const RORK_DEFAULT_ENDPOINT = 'https://toolkit.rork.com/agent/chat';
const POLLINATIONS_OPENAI_ENDPOINT = 'https://text.pollinations.ai/openai';
export const DEFAULT_RORK_MODEL = 'gpt-4o-mini';
const MAX_MESSAGE_CONTENT_LENGTH = 6000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function truncateContent(text: string, maxLen: number = MAX_MESSAGE_CONTENT_LENGTH): string {
  if (!text || text.length <= maxLen) return text;
  const keepStart = Math.floor(maxLen * 0.7);
  const keepEnd = Math.floor(maxLen * 0.2);
  return `${text.slice(0, keepStart)}\n...[gekürzt]...\n${text.slice(text.length - keepEnd)}`;
}

function normalizeMessagesForOpenAI(messages: any[]): { role: string; content: string }[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((m: any) => {
    const role = m?.role === 'assistant' || m?.role === 'system' ? m.role : 'user';
    let content = '';
    if (typeof m?.content === 'string') {
      content = m.content;
    } else if (Array.isArray(m?.parts)) {
      content = m.parts
        .map((p: any) => (typeof p?.text === 'string' ? p.text : JSON.stringify(p)))
        .join('\n');
    } else if (m?.content != null) {
      content = JSON.stringify(m.content);
    }
    return { role, content: truncateContent(content || '(empty)') };
  });
}

export async function POST(request: ExpoRequest) {
  try {
    const body = await request.json();
    const endpoint: string = typeof body?.endpoint === 'string' && body.endpoint.trim()
      ? body.endpoint.trim()
      : RORK_DEFAULT_ENDPOINT;

    const allowedPrefixes = [
      'https://toolkit.rork.com',
      'https://text.pollinations.ai',
    ];
    if (!allowedPrefixes.some(prefix => endpoint.startsWith(prefix))) {
      return Response.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const safeModel =
      typeof body?.model === 'string' && body.model.trim().length > 0
        ? body.model.trim()
        : endpoint.startsWith('https://text.pollinations.ai')
          ? 'openai'
          : DEFAULT_RORK_MODEL;

    // Try primary endpoint first with 2x exponential backoff retries (when targeting Rork)
    if (endpoint.startsWith('https://toolkit.rork.com')) {
      const rorkPayload = body.messages
        ? { ...body, model: safeModel, messages: body.messages }
        : { ...body, model: safeModel };
      delete rorkPayload.endpoint;
      const serializedRorkPayload = JSON.stringify(rorkPayload);

      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            await sleep(300 * Math.pow(2, attempt - 1));
          }
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializedRorkPayload,
            signal: AbortSignal.timeout(25000),
          });

          if (response.ok) {
            const newHeaders = new Headers(response.headers);
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            });
          }
          console.warn(`[chat+api] Rork attempt ${attempt + 1}/${maxRetries + 1} returned ${response.status}`);
          if (response.status < 500 && response.status !== 408 && response.status !== 413 && response.status !== 429) {
            break;
          }
        } catch (rorkErr: any) {
          console.warn(`[chat+api] Rork attempt ${attempt + 1}/${maxRetries + 1} failed:`, rorkErr?.message);
        }
      }
      console.warn('[chat+api] Rork primary retries exhausted, falling back to Pollinations AI...');
    }

    // Keyless 100% Free Fallback: Pollinations OpenAI-compatible endpoint
    const openAIMessages = normalizeMessagesForOpenAI(body?.messages || []);
    const pollResponse = await fetch(POLLINATIONS_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: openAIMessages.length > 0 ? openAIMessages : [{ role: 'user', content: 'Hello' }],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!pollResponse.ok) {
      const errText = await pollResponse.text().catch(() => 'Pollinations error');
      return Response.json({ error: `Fallback AI failed (${pollResponse.status}): ${errText}` }, { status: pollResponse.status });
    }

    const pollData = await pollResponse.json();
    const completionText =
      pollData?.choices?.[0]?.message?.content ||
      pollData?.completion ||
      '';

    return Response.json({
      ...pollData,
      completion: completionText,
      usedFallback: true,
      fallbackProvider: 'pollinations',
    });
  } catch (error: any) {
    console.error('API proxy error:', error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

