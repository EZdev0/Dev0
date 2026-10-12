import { Platform } from 'react-native';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Normalizes a URL ensuring http or https protocol.
 */
export function normalizeUrl(url: string): string {
  let clean = url.trim();
  if (clean.startsWith('ttps://')) clean = 'https://' + clean.substring(7);
  else if (clean.startsWith('ttp://')) clean = 'http://' + clean.substring(6);

  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  return clean;
}

/**
 * Strips HTML tags, scripts, and styles, returning clean text.
 */
export function cleanHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Performs a reliable, free web search using multiple strategies:
 * 1. Server-side /api/search route (if on web)
 * 2. DuckDuckGo HTML search
 * 3. Wikipedia search API (CORS-friendly open API)
 * 4. DuckDuckGo Instant Answer API
 */
export async function performWebSearch(query: string): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return 'ERROR: Search query cannot be empty.';

  // Strategy 1: If running on web in browser, try our local /api/search endpoint first
  if (Platform.OS === 'web') {
    try {
      const apiResp = await fetch('/api/search?q=' + encodeURIComponent(trimmed), {
        signal: AbortSignal.timeout(6000),
      });
      if (apiResp.ok) {
        const text = await apiResp.text();
        if (text && text.length > 50 && !text.includes('"error"')) {
          return text;
        }
      }
    } catch {
      // Fallback to client-side strategies
    }
  }

  const results: WebSearchResult[] = [];

  // Strategy 2: Wikipedia Search API (Always available, no CORS restrictions, multilingual)
  try {
    const isGerman = /[äöüß]|(?:wie|was|wo|warum|wann|wer|und|der|die|das)\b/i.test(trimmed);
    const wikiLang = isGerman ? 'de' : 'en';
    const wikiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed)}&format=json&origin=*&srlimit=5`;
    
    const wikiResp = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
    if (wikiResp.ok) {
      const data = await wikiResp.json();
      if (data?.query?.search && Array.isArray(data.query.search)) {
        for (const item of data.query.search.slice(0, 4)) {
          const title = item.title;
          const snippet = cleanHtml(item.snippet || '');
          const url = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
          if (title && snippet) {
            results.push({ title: `[Wikipedia] ${title}`, snippet, url });
          }
        }
      }
    }
  } catch (e) {
    console.log('[web-tools] Wikipedia search error:', e);
  }

  // Strategy 3: DuckDuckGo Instant Answer API
  try {
    const ddgUrl = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(trimmed) + '&format=json&no_redirect=1&no_html=1';
    const ddgResp = await fetch(ddgUrl, { signal: AbortSignal.timeout(5000) });
    if (ddgResp.ok) {
      const data = await ddgResp.json();
      if (data?.Abstract && data?.AbstractURL) {
        results.unshift({
          title: data.Heading || trimmed,
          snippet: data.Abstract,
          url: data.AbstractURL,
        });
      }
      if (data?.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic?.Text && topic?.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 40),
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        }
      }
    }
  } catch (e) {
    console.log('[web-tools] DuckDuckGo instant error:', e);
  }

  // Strategy 4: Free DuckDuckGo HTML / Lite scraping (works in Node or non-browser)
  if (results.length === 0 && Platform.OS !== 'web') {
    try {
      const htmlUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(trimmed);
      const htmlResp = await fetch(htmlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (htmlResp.ok) {
        const html = await htmlResp.text();
        const linkMatches = [...html.matchAll(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi)];
        const snippetMatches = [...html.matchAll(/<a class="result__snippet"[^>]*>(.*?)<\/a>/gi)];

        for (let i = 0; i < Math.min(linkMatches.length, 5); i++) {
          const rawUrl = linkMatches[i][1];
          const rawTitle = linkMatches[i][2];
          const rawSnippet = snippetMatches[i] ? snippetMatches[i][1] : '';

          // DDG redirect URLs usually contain uddg=param
          let url = rawUrl;
          const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }

          results.push({
            title: cleanHtml(rawTitle),
            snippet: cleanHtml(rawSnippet),
            url,
          });
        }
      }
    } catch (e) {
      console.log('[web-tools] DDG html error:', e);
    }
  }

  if (results.length === 0) {
    return (
      `ℹ️ No direct web search results found for: "${trimmed}".\n\n` +
      `**Suggestions:**\n` +
      `• Use broader keywords or English terminology.\n` +
      `• Or load a specific URL directly using the "web_fetch" tool.`
    );
  }

  let formatted = `### 🔍 Search results for: "${trimmed}"\n\n`;
  results.forEach((res, index) => {
    formatted += `${index + 1}. **${res.title}**\n`;
    formatted += `   ${res.snippet}\n`;
    formatted += `   _Source: ${res.url}_\n\n`;
  });

  return formatted.trim();
}

/**
 * Downloads webpage content safely with CORS workarounds and HTML sanitization.
 */
export async function performWebFetch(url: string, maxLength = 5000): Promise<string> {
  const normalized = normalizeUrl(url);

  // Strategy 1: Server-side proxy if running on web
  if (Platform.OS === 'web') {
    try {
      const apiResp = await fetch('/api/fetch?url=' + encodeURIComponent(normalized), {
        signal: AbortSignal.timeout(8000),
      });
      if (apiResp.ok) {
        const text = await apiResp.text();
        if (text && text.length > 50 && !text.includes('"error"')) {
          const cleaned = cleanHtml(text);
          return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '... (truncated)' : cleaned;
        }
      }
    } catch {
      // Fallback
    }
  }

  // Strategy 2: Direct fetch (works natively on iOS/Android, and for CORS-enabled sites on web)
  try {
    const directResp = await fetch(normalized, {
      headers: { 'Accept': 'text/html,text/plain,application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (directResp.ok) {
      const text = await directResp.text();
      const cleaned = cleanHtml(text);
      if (cleaned.length > 30) {
        return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '... (truncated)' : cleaned;
      }
    }
  } catch {
    // If blocked by CORS or network, proceed to fallback
  }

  // Strategy 3: Jina AI Reader (Free open reader service with CORS *)
  try {
    const jinaUrl = 'https://r.jina.ai/' + normalized;
    const jinaResp = await fetch(jinaUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (jinaResp.ok) {
      const text = await jinaResp.text();
      const cleaned = cleanHtml(text);
      if (cleaned.length > 30) {
        return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '... (truncated)' : cleaned;
      }
    }
  } catch {
    // Try next fallback
  }

  // Strategy 4: AllOrigins open CORS proxy
  try {
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(normalized);
    const proxyResp = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (proxyResp.ok) {
      const text = await proxyResp.text();
      const cleaned = cleanHtml(text);
      if (cleaned.length > 30) {
        return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '... (truncated)' : cleaned;
      }
    }
  } catch (e: any) {
    console.log('[web-tools] AllOrigins proxy error:', e);
  }

  return `ERROR: Could not fetch content from ${normalized}. The server may be blocking requests or unreachable.`;
}
