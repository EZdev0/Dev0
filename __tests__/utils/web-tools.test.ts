import { normalizeUrl, cleanHtml, performWebSearch, performWebFetch } from '../../utils/web-tools';

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

    it('should trim surrounding whitespace', () => {
      expect(normalizeUrl('   https://example.com/path   ')).toBe('https://example.com/path');
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

  describe('performWebSearch', () => {
    it('should reject empty queries gracefully', async () => {
      const result = await performWebSearch('   ');
      expect(result).toContain('ERROR');
    });

    it('should return formatted markdown search results for queries', async () => {
      const result = await performWebSearch('TypeScript');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(10);
    });
  });

  describe('performWebFetch', () => {
    it('should handle invalid or unreachable URLs gracefully without throwing', async () => {
      const result = await performWebFetch('https://invalid-non-existent-domain-12345.xyz');
      expect(typeof result).toBe('string');
      expect(result).toBeDefined();
    });
  });
});
