import { ExpoRequest } from 'expo-router/server';

const RORK_DEFAULT_ENDPOINT = 'https://toolkit.rork.com/agent/chat';
const POLLINATIONS_OPENAI_ENDPOINT = 'https://text.pollinations.ai/openai';

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
    return { role, content: content || '(empty)' };
  });
}

export async function POST(request: ExpoRequest) {
  try {
    const body = await request.json();
    let endpoint: string = typeof body?.endpoint === 'string' && body.endpoint.trim()
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
          : 'rork-default';

    // Try primary endpoint first (when targeting Rork)
    if (endpoint.startsWith('https://toolkit.rork.com')) {
      try {
        const rorkPayload = body.messages
          ? { ...body, model: safeModel, messages: body.messages }
          : { ...body, model: safeModel };
        delete rorkPayload.endpoint;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rorkPayload),
          signal: AbortSignal.timeout(45000),
        });

        if (response.ok) {
          const newHeaders = new Headers(response.headers);
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }
        console.warn(`[chat+api] Rork endpoint ${endpoint} returned ${response.status}, falling back to Pollinations AI...`);
      } catch (rorkErr: any) {
        console.warn('[chat+api] Rork primary call failed, falling back to Pollinations AI:', rorkErr?.message);
      }
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

