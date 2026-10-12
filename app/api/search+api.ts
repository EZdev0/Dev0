import { ExpoRequest } from 'expo-router/server';

export async function GET(request: ExpoRequest) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query || !query.trim()) {
      return Response.json({ error: 'Query parameter q is required' }, { status: 400 });
    }

    const trimmed = query.trim();

    // Strategy A: DuckDuckGo HTML search on server (Node.js fetch has no CORS)
    let results: { title: string; snippet: string; url: string }[] = [];
    try {
      const ddgResp = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(trimmed), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (ddgResp.ok) {
        const html = await ddgResp.text();
        const linkMatches = [...html.matchAll(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi)];
        const snippetMatches = [...html.matchAll(/<a class="result__snippet"[^>]*>(.*?)<\/a>/gi)];

        for (let i = 0; i < Math.min(linkMatches.length, 5); i++) {
          const rawUrl = linkMatches[i][1];
          const rawTitle = linkMatches[i][2].replace(/<[^>]+>/g, '').trim();
          const rawSnippet = snippetMatches[i] ? snippetMatches[i][1].replace(/<[^>]+>/g, '').trim() : '';

          let cleanUrl = rawUrl;
          const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            cleanUrl = decodeURIComponent(uddgMatch[1]);
          }

          if (rawTitle && cleanUrl) {
            results.push({ title: rawTitle, snippet: rawSnippet, url: cleanUrl });
          }
        }
      }
    } catch (e) {
      console.error('[search+api] DDG HTML error:', e);
    }

    // Strategy B: Wikipedia search API
    if (results.length === 0) {
      try {
        const isGerman = /[äöüß]|(?:wie|was|wo|warum|wann|wer|und|der|die|das)\b/i.test(trimmed);
        const wikiLang = isGerman ? 'de' : 'en';
        const wikiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed)}&format=json&srlimit=5`;
        const wikiResp = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });

        if (wikiResp.ok) {
          const data = await wikiResp.json();
          if (data?.query?.search) {
            for (const item of data.query.search.slice(0, 4)) {
              results.push({
                title: item.title,
                snippet: item.snippet ? item.snippet.replace(/<[^>]+>/g, '').trim() : '',
                url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
              });
            }
          }
        }
      } catch (e) {
        console.error('[search+api] Wiki error:', e);
      }
    }

    if (results.length === 0) {
      return new Response(`No results found for "${trimmed}".`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    let formatted = `### 🔍 Search results for: "${trimmed}"\n\n`;
    results.forEach((res, index) => {
      formatted += `${index + 1}. **${res.title}**\n`;
      if (res.snippet) formatted += `   ${res.snippet}\n`;
      formatted += `   _Source: ${res.url}_\n\n`;
    });

    return new Response(formatted.trim(), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('[search+api] Server error:', error);
    return Response.json({ error: error.message || 'Internal Search Error' }, { status: 500 });
  }
}
