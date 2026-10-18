import {
  normalizeUrl,
  cleanHtml,
  optimizeSearchQuery,
  performWebSearch,
  performWebFetch,
  runSubAISearchAgent,
} from '../../utils/web-tools';

describe('web-tools utils', () => {
  describe('normalizeUrl', () => {
    it('should prepend https if missing protocol', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com');
      expect(normalizeUrl('api.github.com/repos')).toBe('https://api.github.com/repos');
    });

    it('should keep http and https intact', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
      expect(normalizeUrl('http://insecure.org')).toBe('http://insecure.org');
    });

    it('should fix typos like ttps:// and ttp://', () => {
      expect(normalizeUrl('ttps://example.com')).toBe('https://example.com');
      expect(normalizeUrl('ttp://example.com')).toBe('http://example.com');
    });

    it('should trim surrounding whitespace and handle empty input', () => {
      expect(normalizeUrl('   https://example.com/path   ')).toBe('https://example.com/path');
      expect(normalizeUrl('')).toBe('');
    });
  });

  describe('cleanHtml', () => {
    it('should strip script and style tags completely', () => {
      const raw = '<style>.test { color: red; }</style><p>Hello</p><script>console.log("bad");</script> World!';
      expect(cleanHtml(raw)).toBe('Hello World!');
    });

    it('should strip navigation, header, footer tags', () => {
      const raw = '<header>Header Text</header><main>Main Content</main><footer>Footer Text</footer>';
      expect(cleanHtml(raw)).toBe('Main Content');
    });

    it('should decode common HTML entities', () => {
      const raw = '&quot;Hello&quot; &amp; &lt;World&gt; &#39;test&#39;';
      expect(cleanHtml(raw)).toBe('"Hello" & <World> \'test\'');
    });

    it('should normalize consecutive whitespaces', () => {
      const raw = '   Word1    \n\n\t  Word2   ';
      expect(cleanHtml(raw)).toBe('Word1 Word2');
    });
  });

  describe('optimizeSearchQuery (Sub-KI Search Agent helper)', () => {
    it('should strip conversational filler words and preserve technical terms', () => {
      const optimized = optimizeSearchQuery('Kannst du bitte im Internet nach Expo SDK 54 Router suchen?');
      expect(optimized).toContain('Expo');
      expect(optimized).toContain('SDK');
      expect(optimized).toContain('54');
      expect(optimized).not.toContain('Kannst');
    });

    it('should fallback to original trimmed query if only filler words exist', () => {
      const optimized = optimizeSearchQuery('bitte danke');
      expect(optimized.length).toBeGreaterThan(0);
    });
  });

  describe('performWebSearch (Keyless 4-Stage Fallback)', () => {
    it('should reject empty queries gracefully', async () => {
      const result = await performWebSearch('   ');
      expect(result).toContain('ERROR');
    });

    it('should fall back across stages when earlier stages fail (mocked fetch)', async () => {
      const origFetch = global.fetch;
      let callCount = 0;
      global.fetch = (async (url: any) => {
        callCount++;
        const urlStr = String(url);
        // Simulate Stage 1 (Jina) failing, Stage 2 (Pollinations) succeeding
        if (urlStr.includes('r.jina.ai')) {
          return { ok: false, status: 503, text: async () => '' } as any;
        }
        if (urlStr.includes('pollinations.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: '### React Native 0.81\n- Supports Expo SDK 54\n- Source: https://reactnative.dev' } }],
            }),
          } as any;
        }
        return { ok: false, status: 500, text: async () => '' } as any;
      }) as any;

      try {
        const result = await performWebSearch('React Native 0.81', { summarizeWithAI: false });
        expect(callCount).toBeGreaterThanOrEqual(2);
        expect(result).toContain('React Native 0.81');
      } finally {
        global.fetch = origFetch;
      }
    });

    it('should run Sub-KI Search Agent and return structured markdown', async () => {
      const origFetch = global.fetch;
      global.fetch = (async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('r.jina.ai')) {
          return {
            ok: true,
            status: 200,
            text: async () => '[TypeScript Handbook](https://www.typescriptlang.org/docs/) Official TypeScript documentation and guides for static typing.',
          } as any;
        }
        if (urlStr.includes('pollinations.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: '- **TypeScript**: Strongly typed programming language.\n- Source: https://www.typescriptlang.org/docs/' } }],
            }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => '' } as any;
      }) as any;

      try {
        const result = await runSubAISearchAgent('Was ist TypeScript?');
        expect(result).toContain('TypeScript');
        expect(result.length).toBeLessThanOrEqual(6000);
      } finally {
        global.fetch = origFetch;
      }
    });
  });

  describe('performWebFetch (Keyless 3-Stage Fallback & 6000-char limit)', () => {
    it('should handle empty URLs gracefully', async () => {
      const result = await performWebFetch('   ');
      expect(result).toContain('FEHLER');
    });

    it('should truncate fetched webpage content to at most 6000 characters', async () => {
      const origFetch = global.fetch;
      global.fetch = (async () => ({
        ok: true,
        status: 200,
        text: async () => 'A'.repeat(12000),
      })) as any;

      try {
        const result = await performWebFetch('https://example.com/large-page');
        expect(result.length).toBeLessThanOrEqual(6000);
        expect(result).toContain('example.com');
      } finally {
        global.fetch = origFetch;
      }
    });
  });
});
