import { Platform } from 'react-native';
import { truncateToolResult, MAX_TOOL_RESULT_LENGTH } from '@/utils/chat-compression';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export const SEARCH_CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
] as const;

function createTimeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
      return (AbortSignal as any).timeout(ms);
    }
  } catch {
    // Fallback if AbortSignal.timeout is unavailable
  }
  return undefined;
}

/**
 * Normalizes a URL ensuring http or https protocol.
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
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
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
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
 * Sub-AI Query Optimizer: cleans conversational filler and normalizes the search query.
 */
export function optimizeSearchQuery(rawQuery: string): string {
  if (!rawQuery || typeof rawQuery !== 'string') return '';
  let cleaned = rawQuery
    .trim()
    .replace(/^(?:kannst\s+du\s+|könntest\s+du\s+|würdest\s+du\s+|can\s+you\s+|could\s+you\s+)?(?:mir\s+)?(?:bitte\s+|please\s+)?(?:mal\s+)?(?:im\s+(?:internet|web|netz)\s+)?(?:nach\s+|über\s+|for\s+|about\s+)?(?:search\s+(?:the\s+web\s+)?(?:for|about)\s+|suche\s+(?:im\s+(?:web|internet)\s+)?nach\s+|finde\s+informationen\s+über\s+)?/i, '')
    .replace(/\s+(?:im\s+(?:internet|web|netz)\s+)?(?:suchen|recherchieren|finden|search)\??$/i, '')
    .replace(/[?!.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || rawQuery.trim();
}

/**
 * Extracts unique HTTP/HTTPS URLs from raw text or Markdown.
 */
export function extractUrlsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/https?:\/\/[^\s)\]>"'<]+/gi) || [];
  const cleaned = matches
    .map(u => u.replace(/[.,;:!?]+$/, ''))
    .filter(u => !u.includes('duckduckgo.com/lite') && !u.includes('r.jina.ai'));
  return Array.from(new Set(cleaned)).slice(0, 12);
}

/**
 * Parses DuckDuckGo HTML search result page into structured WebSearchResult items.
 */
export function parseDuckDuckGoHtml(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  if (!html || typeof html !== 'string') return results;

  const linkMatches = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippetMatches = [...html.matchAll(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];

  for (let i = 0; i < Math.min(linkMatches.length, 6); i++) {
    const rawUrl = linkMatches[i][1] || '';
    const rawTitle = linkMatches[i][2] || '';
    const rawSnippet = snippetMatches[i] ? snippetMatches[i][1] : '';

    let url = rawUrl;
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      try {
        url = decodeURIComponent(uddgMatch[1]);
      } catch {
        url = uddgMatch[1];
      }
    }

    const title = cleanHtml(rawTitle);
    const snippet = cleanHtml(rawSnippet);
    if (title && url) {
      results.push({ title, snippet, url });
    }
  }

  return results;
}

/**
 * Sub-AI Search Summarizer: uses keyless Pollinations OpenAI endpoint to synthesize
 * a compact, fact-rich summary including source URLs from raw search results.
 */
export async function summarizeSearchWithSubAI(
  query: string,
  rawSearchContent: string,
  sourceUrls: string[] = []
): Promise<string> {
  const safeRaw = truncateToolResult(rawSearchContent, 4500);
  const urlsSection = sourceUrls.length > 0
    ? '\n\n### 🔗 Sources\n' + sourceUrls.map(u => `- ${u}`).join('\n')
    : '';

  try {
    const resp = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          {
            role: 'system',
            content:
              'You are a specialized Search Sub-Agent. Summarize the provided web search results into a compact, fact-rich markdown summary. Always preserve and cite exact source URLs. Be concise and factual.',
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nRaw Search Results:\n${safeRaw}`,
          },
        ],
        temperature: 0.2,
      }),
      signal: createTimeoutSignal(6000),
    });

    if (resp && resp.ok && typeof resp.json === 'function') {
      const data = await resp.json().catch(() => null);
      const aiSummary = data?.choices?.[0]?.message?.content;
      if (typeof aiSummary === 'string' && aiSummary.trim().length > 40) {
        const combined = `### 🤖 Sub-AI Search Summary for: "${query}"\n\n${aiSummary.trim()}\n\n### 📄 Raw Highlights\n${ truncateToolResult(safeRaw, 1200) }${urlsSection}`;
        return truncateToolResult(combined, MAX_TOOL_RESULT_LENGTH);
      }
    }
  } catch {
    // Graceful fallback to raw search output if offline or in mocked test environment
  }

  return truncateToolResult(`${safeRaw}${urlsSection}`, MAX_TOOL_RESULT_LENGTH);
}

/**
 * Executes the 4-Stage Keyless Web Search Fallback Chain:
 * - Stage 1: Jina Reader + DuckDuckGo Lite (`https://r.jina.ai/https://lite.duckduckgo.com/lite/?q=...`)
 * - Stage 2: Keyless Search-AI Fallback (`https://text.pollinations.ai/...?model=searchgpt`)
 * - Stage 3: Native CORS JSON APIs (Wikipedia `de` + `en` & DuckDuckGo Instant Answer API)
 * - Stage 4: Multi-Proxy Fallback (`api.allorigins.win/raw` & `api.codetabs.com/v1/proxy` on DuckDuckGo HTML)
 */
export async function runSubAISearchAgent(
  query: string,
  options?: { summarizeWithAI?: boolean }
): Promise<string> {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) return 'ERROR: Search query cannot be empty.';

  const optimizedQuery = optimizeSearchQuery(trimmed);
  const shouldSummarize = options?.summarizeWithAI ?? true;

  // Stage 1: Jina Reader + DuckDuckGo Lite (keyless, CORS-friendly markdown)
  try {
    const jinaDdgUrl = `https://r.jina.ai/https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(optimizedQuery)}`;
    const jinaResp = await fetch(jinaDdgUrl, {
      headers: { Accept: 'text/plain' },
      signal: createTimeoutSignal(7000),
    });
    if (jinaResp && jinaResp.ok) {
      const text = await jinaResp.text();
      const cleaned = typeof text === 'string' ? text.trim() : '';
      if (
        cleaned.length > 60 &&
        !cleaned.includes('AuthenticationRequiredError') &&
        !cleaned.includes('SecurityCompromiseError') &&
        !cleaned.toLowerCase().includes('rate limit exceeded')
      ) {
        const urls = extractUrlsFromText(cleaned);
        const formattedStage1 = `### 🔍 Search results for: "${optimizedQuery}" (Stage 1: Jina Reader + DDG Lite)\n\n${cleaned}`;
        if (shouldSummarize) {
          return await summarizeSearchWithSubAI(optimizedQuery, formattedStage1, urls);
        }
        return truncateToolResult(formattedStage1, MAX_TOOL_RESULT_LENGTH);
      }
    }
  } catch (e) {
    console.log('[web-tools] Stage 1 (Jina + DDG Lite) failed:', e);
  }

  // Stage 2: Keyless Search-AI Fallback (Pollinations searchgpt)
  try {
    const searchPrompt = 'Search the web and list facts with URLs for: ' + optimizedQuery;
    const pollinationsSearchUrl = `https://text.pollinations.ai/${encodeURIComponent(searchPrompt)}?model=searchgpt`;
    const pollResp = await fetch(pollinationsSearchUrl, {
      headers: { Accept: 'text/plain,application/json' },
      signal: createTimeoutSignal(8000),
    });
    if (pollResp && pollResp.ok) {
      let text = '';
      if (typeof pollResp.text === 'function') {
        const raw = await pollResp.text();
        try {
          const parsed = JSON.parse(raw);
          text = parsed?.choices?.[0]?.message?.content || parsed?.completion || raw;
        } catch {
          text = raw;
        }
      } else if (typeof pollResp.json === 'function') {
        const parsed = await pollResp.json();
        text = parsed?.choices?.[0]?.message?.content || parsed?.completion || '';
      }
      const cleaned = typeof text === 'string' ? text.trim() : '';
      if (cleaned.length > 40 && !cleaned.startsWith('<!DOCTYPE') && !cleaned.startsWith('<html')) {
        const urls = extractUrlsFromText(cleaned);
        const formattedStage2 = `### 🔍 Search results for: "${optimizedQuery}" (Stage 2: SearchGPT AI)\n\n${cleaned}`;
        if (shouldSummarize) {
          return await summarizeSearchWithSubAI(optimizedQuery, formattedStage2, urls);
        }
        return truncateToolResult(formattedStage2, MAX_TOOL_RESULT_LENGTH);
      }
    }
  } catch (e) {
    console.log('[web-tools] Stage 2 (Pollinations searchgpt) failed:', e);
  }

  // Stage 3: Native CORS JSON APIs (Wikipedia DE + EN & DuckDuckGo Instant Answer API)
  const results: WebSearchResult[] = [];
  const wikiLangs = ['de', 'en'];
  for (const wikiLang of wikiLangs) {
    try {
      const wikiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(optimizedQuery)}&utf8=&format=json&origin=*&srlimit=3`;
      const wikiResp = await fetch(wikiUrl, { signal: createTimeoutSignal(5000) });
      if (wikiResp && wikiResp.ok && typeof wikiResp.json === 'function') {
        const data = await wikiResp.json();
        if (data?.query?.search && Array.isArray(data.query.search)) {
          for (const item of data.query.search.slice(0, 3)) {
            const title = item.title;
            const snippet = cleanHtml(item.snippet || '');
            const url = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
            if (title && snippet) {
              results.push({ title: `[Wikipedia ${wikiLang.toUpperCase()}] ${title}`, snippet, url });
            }
          }
        }
      }
    } catch (e) {
      console.log(`[web-tools] Stage 3 Wikipedia (${wikiLang}) error:`, e);
    }
  }

  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(optimizedQuery)}&format=json`;
    const ddgResp = await fetch(ddgUrl, { signal: createTimeoutSignal(5000) });
    if (ddgResp && ddgResp.ok && typeof ddgResp.json === 'function') {
      const data = await ddgResp.json();
      if (data?.Abstract && data?.AbstractURL) {
        results.unshift({
          title: data.Heading || optimizedQuery,
          snippet: cleanHtml(data.Abstract),
          url: data.AbstractURL,
        });
      }
      if (data?.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic?.Text && topic?.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
              snippet: cleanHtml(topic.Text),
              url: topic.FirstURL,
            });
          }
        }
      }
    }
  } catch (e) {
    console.log('[web-tools] Stage 3 DuckDuckGo Instant Answer error:', e);
  }

  // Stage 4: Multi-Proxy Fallback (AllOrigins & CodeTabs on DuckDuckGo HTML)
  if (results.length === 0) {
    const ddgHtmlTarget = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(optimizedQuery)}`;
    for (const proxyPrefix of SEARCH_CORS_PROXIES) {
      try {
        const proxyUrl = `${proxyPrefix}${encodeURIComponent(ddgHtmlTarget)}`;
        const proxyResp = await fetch(proxyUrl, { signal: createTimeoutSignal(7000) });
        if (proxyResp && proxyResp.ok) {
          const html = await proxyResp.text();
          const parsed = parseDuckDuckGoHtml(html);
          if (parsed.length > 0) {
            results.push(...parsed);
            break;
          } else {
            const plain = cleanHtml(html);
            if (plain.length > 80) {
              results.push({
                title: `DuckDuckGo Results for "${optimizedQuery}"`,
                snippet: plain.slice(0, 600),
                url: ddgHtmlTarget,
              });
              break;
            }
          }
        }
      } catch (e) {
        console.log('[web-tools] Stage 4 proxy failed:', proxyPrefix, e);
      }
    }
  }

  // Optional local /api/search fallback if running on web and stages 1-4 returned nothing
  if (results.length === 0 && Platform.OS === 'web') {
    try {
      const apiResp = await fetch('/api/search?q=' + encodeURIComponent(optimizedQuery), {
        signal: createTimeoutSignal(6000),
      });
      if (apiResp && apiResp.ok) {
        const text = await apiResp.text();
        if (text && text.length > 40 && !text.includes('"error"')) {
          return truncateToolResult(text, MAX_TOOL_RESULT_LENGTH);
        }
      }
    } catch {
      // Ignore
    }
  }

  if (results.length === 0) {
    return (
      `ℹ️ No direct web search results found for: "${optimizedQuery}".\n\n` +
      `**Suggestions:**\n` +
      `• Use broader keywords or English terminology.\n` +
      `• Or load a specific URL directly using the "web_fetch" tool.`
    );
  }

  let formatted = `### 🔍 Search results for: "${optimizedQuery}"\n\n`;
  const sourceUrls: string[] = [];
  results.forEach((res, index) => {
    formatted += `${index + 1}. **${res.title}**\n`;
    if (res.snippet) formatted += `   ${res.snippet}\n`;
    formatted += `   _Source: ${res.url}_\n\n`;
    if (res.url) sourceUrls.push(res.url);
  });

  if (shouldSummarize) {
    return await summarizeSearchWithSubAI(optimizedQuery, formatted.trim(), sourceUrls);
  }

  return truncateToolResult(formatted.trim(), MAX_TOOL_RESULT_LENGTH);
}

/**
 * Performs a reliable, 100% free & keyless web search via the Sub-AI Search Agent
 * and the 4-stage fallback chain.
 */
export async function performWebSearch(
  query: string,
  options?: { summarizeWithAI?: boolean }
): Promise<string> {
  return await runSubAISearchAgent(query, options);
}

/**
 * Downloads webpage content safely without API keys using a 3-stage fallback chain:
 * - Stage 1: `https://r.jina.ai/${targetUrl}` (extracts webpage + JS as clean Markdown)
 * - Stage 2: Local route `/api/fetch` (`app/api/fetch+api.ts`) + direct fetch
 * - Stage 3: Rotating CORS proxies (`api.allorigins.win/raw` + `api.codetabs.com`) with HTML-to-text parser
 */
export async function performWebFetch(url: string, maxLength = 5000): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return 'FEHLER / ERROR: URL cannot be empty.';
  }
  const normalized = normalizeUrl(url);
  const effectiveMax = Math.min(Math.max(100, maxLength || 5000), MAX_TOOL_RESULT_LENGTH);

  const formatOutput = (rawText: string, isMarkdown = false): string => {
    const cleaned = isMarkdown ? rawText.replace(/\s+\n/g, '\n').trim() : cleanHtml(rawText);
    const withHeader = cleaned.includes(normalized)
      ? cleaned
      : `Content of ${normalized}:\n\n${cleaned}`;
    if (withHeader.length > effectiveMax) {
      return truncateToolResult(withHeader, effectiveMax);
    }
    return withHeader;
  };

  // Stage 1: Jina AI Reader (Free keyless reader with open CORS, extracts JS pages as Markdown)
  try {
    const jinaUrl = 'https://r.jina.ai/' + normalized;
    const jinaResp = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
      signal: createTimeoutSignal(8000),
    });
    if (jinaResp && jinaResp.ok) {
      const text = await jinaResp.text();
      if (
        typeof text === 'string' &&
        text.trim().length > 30 &&
        !text.includes('AuthenticationRequiredError') &&
        !text.includes('Target URL returned error')
      ) {
        const cleaned = cleanHtml(text);
        if (cleaned.length > 30) {
          return formatOutput(cleaned, false);
        }
      }
    }
  } catch {
    // Proceed to Stage 2
  }

  // Stage 2a: Local server route `/api/fetch` (when on web)
  if (Platform.OS === 'web') {
    try {
      const apiResp = await fetch('/api/fetch?url=' + encodeURIComponent(normalized), {
        signal: createTimeoutSignal(8000),
      });
      if (apiResp && apiResp.ok) {
        const text = await apiResp.text();
        if (text && text.length > 30 && !text.includes('"error"')) {
          const cleaned = cleanHtml(text);
          if (cleaned.length > 30) {
            return formatOutput(cleaned, false);
          }
        }
      }
    } catch {
      // Proceed to direct / Stage 3
    }
  }

  // Stage 2b: Direct fetch (works natively on iOS/Android and for CORS-enabled web endpoints)
  try {
    const directResp = await fetch(normalized, {
      headers: { Accept: 'text/html,text/plain,application/json' },
      signal: createTimeoutSignal(7000),
    });
    if (directResp && directResp.ok) {
      const text = await directResp.text();
      const cleaned = cleanHtml(text);
      if (cleaned.length > 30) {
        return formatOutput(cleaned, false);
      }
    }
  } catch {
    // Proceed to Stage 3
  }

  // Stage 3: Rotating CORS Proxies (AllOrigins + CodeTabs) with clean HTML-to-Text parser
  for (const proxyPrefix of SEARCH_CORS_PROXIES) {
    try {
      const proxyUrl = proxyPrefix + encodeURIComponent(normalized);
      const proxyResp = await fetch(proxyUrl, {
        signal: createTimeoutSignal(8000),
      });
      if (proxyResp && proxyResp.ok) {
        const text = await proxyResp.text();
        const cleaned = cleanHtml(text);
        if (cleaned.length > 30) {
          return formatOutput(cleaned, false);
        }
      }
    } catch (e: any) {
      console.log('[web-tools] Proxy fetch error:', proxyPrefix, e?.message || e);
    }
  }

  return `ERROR: Could not fetch content from ${normalized}. The server may be blocking requests or unreachable.`;
}

