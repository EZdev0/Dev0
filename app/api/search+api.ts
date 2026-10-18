import { ExpoRequest } from 'expo-router/server';

export async function GET(request: ExpoRequest) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query || !query.trim()) {
      return Response.json({ error: 'Query parameter q is required' }, { status: 400 });
    }

    const trimmed = query.trim();

    // Stage 1: Jina AI Reader over DuckDuckGo Lite (Markdown/Plaintext, zero API key)
    try {
      const jinaUrl = `https://r.jina.ai/https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(trimmed)}`;
      const jinaResp = await fetch(jinaUrl, {
        headers: {
          Accept: 'text/plain',
          'X-Return-Format': 'markdown',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (jinaResp.ok) {
        const jinaText = (await jinaResp.text()).trim();
        if (jinaText.length > 80 && !jinaText.toLowerCase().includes('access denied')) {
          return new Response(`### 🔍 Search results for: "${trimmed}"\n\n${jinaText.slice(0, 6000)}`, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      }
    } catch (e) {
      console.error('[search+api] Jina DDG Lite error:', e);
    }

    // Stage 2: DuckDuckGo HTML search on server (Node.js fetch has no CORS)
    const results: { title: string; snippet: string; url: string }[] = [];
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

        for (let i = 0; i < Math.min(linkMatches.length, 6); i++) {
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

    // Stage 3: Pollinations SearchGPT keyless fallback
    if (results.length === 0) {
      try {
        const prompt = `Search the web and list facts with URLs for: ${trimmed}`;
        const pollUrl = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=searchgpt`;
        const pollResp = await fetch(pollUrl, {
          headers: { Accept: 'text/plain' },
          signal: AbortSignal.timeout(8000),
        });
        if (pollResp.ok) {
          const pollText = (await pollResp.text()).trim();
          if (pollText.length > 40) {
            return new Response(`### 🔍 Search results for: "${trimmed}"\n\n${pollText.slice(0, 6000)}`, {
              status: 200,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
          }
        }
      } catch (e) {
        console.error('[search+api] Pollinations SearchGPT error:', e);
      }
    }

    // Stage 4: Wikipedia search API (DE + EN) & DuckDuckGo Instant Answer JSON API
    if (results.length === 0) {
      try {
        const ddgJsonUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmed)}&format=json&no_html=1&skip_disambig=1`;
        const ddgJsonResp = await fetch(ddgJsonUrl, { signal: AbortSignal.timeout(5000) });
        if (ddgJsonResp.ok) {
          const ddgData = await ddgJsonResp.json();
          if (ddgData?.AbstractText && ddgData?.AbstractURL) {
            results.push({
              title: ddgData.Heading || trimmed,
              snippet: ddgData.AbstractText,
              url: ddgData.AbstractURL,
            });
          }
        }
      } catch (e) {
        console.error('[search+api] DDG JSON error:', e);
      }

      try {
        const isGerman = /[äöüß]|(?:wie|was|wo|warum|wann|wer|und|der|die|das)\b/i.test(trimmed);
        const wikiLangs = isGerman ? ['de', 'en'] : ['en', 'de'];
        for (const wikiLang of wikiLangs) {
          if (results.length >= 5) break;
          const wikiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed)}&format=json&srlimit=4&origin=*`;
          const wikiResp = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });

          if (wikiResp.ok) {
            const data = await wikiResp.json();
            if (data?.query?.search) {
              for (const item of data.query.search.slice(0, 3)) {
                results.push({
                  title: `${item.title} (Wikipedia ${wikiLang.toUpperCase()})`,
                  snippet: item.snippet ? item.snippet.replace(/<[^>]+>/g, '').trim() : '',
                  url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
                });
              }
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

    return new Response(formatted.trim().slice(0, 6000), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('[search+api] Server error:', error);
    return Response.json({ error: error.message || 'Internal Search Error' }, { status: 500 });
  }
}

