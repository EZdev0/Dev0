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

    try {
      const parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return Response.json({ error: 'Only http and https URLs are allowed' }, { status: 400 });
      }
    } catch {
      return Response.json({ error: 'Invalid target URL' }, { status: 400 });
    }

    // Stage 1: Jina AI Reader (returns clean Markdown/text)
    try {
      const jinaResp = await fetch(`https://r.jina.ai/${cleanUrl}`, {
        headers: {
          Accept: 'text/plain',
          'X-Return-Format': 'markdown',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (jinaResp.ok) {
        const jinaText = (await jinaResp.text()).trim();
        if (jinaText.length > 40) {
          return new Response(jinaText.slice(0, 12000), {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'public, max-age=300',
            },
          });
        }
      }
    } catch (e) {
      console.error('[fetch+api] Jina Reader fallback error:', e);
    }

    // Stage 2: Direct server-side fetch (no browser CORS restrictions)
    try {
      const resp = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,text/plain,application/json,*/*',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (resp.ok) {
        const text = await resp.text();
        if (text && text.trim().length > 0) {
          return new Response(text, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'public, max-age=300',
            },
          });
        }
      }
    } catch (e) {
      console.error('[fetch+api] Direct fetch error:', e);
    }

    // Stage 3: Rotating public CORS proxies
    const proxyUrls = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`,
    ];

    for (const proxyUrl of proxyUrls) {
      try {
        const proxyResp = await fetch(proxyUrl, {
          headers: { Accept: 'text/html,text/plain,*/*' },
          signal: AbortSignal.timeout(7000),
        });
        if (proxyResp.ok) {
          const text = await proxyResp.text();
          if (text && text.trim().length > 20) {
            return new Response(text, {
              status: 200,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=300',
              },
            });
          }
        }
      } catch (e) {
        console.error('[fetch+api] Proxy error:', e);
      }
    }

    return Response.json({ error: 'All fetch strategies failed for target URL' }, { status: 502 });
  } catch (error: any) {
    console.error('[fetch+api] Server error:', error);
    return Response.json({ error: error.message || 'Internal Fetch Error' }, { status: 500 });
  }
}

