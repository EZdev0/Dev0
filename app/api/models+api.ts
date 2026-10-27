export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEndpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

    if (!rawEndpoint) {
      return Response.json({ data: [] }, { status: 200 });
    }

    let base = rawEndpoint;
    if (base.startsWith('ttps://')) base = 'https://' + base.slice(7);
    else if (base.startsWith('ttp://')) base = 'http://' + base.slice(6);
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = 'https://' + base;
    }

    const parsed = new URL(base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return Response.json({ error: 'Invalid URL protocol' }, { status: 400 });
    }

    const modelsUrl = base
      .replace(/\/v1\/chat\/completions\/?$/i, '')
      .replace(/\/v1\/models\/?$/i, '')
      .replace(/\/$/, '') + '/v1/models';

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const upstream = await fetch(modelsUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!upstream.ok) {
        return Response.json({ data: [], status: upstream.status }, { status: 200 });
      }

      const json = await upstream.json().catch(() => ({ data: [] }));
      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.models)
          ? json.models
          : [];

      return Response.json({ data: list }, { status: 200 });
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Model discovery failed';
    return Response.json({ data: [], warning: msg }, { status: 200 });
  }
}
