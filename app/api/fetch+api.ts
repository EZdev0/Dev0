import { ExpoRequest } from 'expo-router/server';

export async function GET(request: ExpoRequest) {
  try {
    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl || !targetUrl.trim()) {
      return Response.json({ error: 'Query parameter url is required' }, { status: 400 });
    }

    let cleanUrl = targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // Server-side fetch has no browser CORS restrictions
    const resp = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,text/plain,application/json,*/*',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return Response.json({ error: `Fetch failed with status ${resp.status}` }, { status: resp.status });
    }

    const text = await resp.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('[fetch+api] Server error:', error);
    return Response.json({ error: error.message || 'Internal Fetch Error' }, { status: 500 });
  }
}
