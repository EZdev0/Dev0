import { IDE } from '@/constants/colors';

const KEYWORDS: Record<string, string[]> = {
  kotlin: ['package', 'import', 'class', 'fun', 'val', 'var', 'if', 'else', 'when', 'for', 'while', 'return', 'override', 'private', 'public', 'protected', 'internal', 'abstract', 'open', 'data', 'sealed', 'object', 'companion', 'interface', 'enum', 'suspend', 'try', 'catch', 'finally', 'throw', 'null', 'true', 'false', 'this', 'super', 'is', 'as', 'in', 'out', 'by', 'init', 'constructor', 'lateinit', 'const', 'inline', 'reified', 'vararg'],
  java: ['package', 'import', 'class', 'public', 'private', 'protected', 'static', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'String', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'new', 'try', 'catch', 'finally', 'throw', 'throws', 'null', 'true', 'false', 'this', 'super', 'extends', 'implements', 'interface', 'abstract', 'final'],
  typescript: ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'new', 'try', 'catch', 'finally', 'throw', 'null', 'undefined', 'true', 'false', 'this', 'async', 'await', 'default', 'extends', 'implements', 'readonly', 'static', 'private', 'public', 'protected', 'abstract', 'as', 'of', 'in', 'typeof', 'keyof', 'void', 'any', 'unknown', 'string', 'number', 'boolean'],
  javascript: ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'new', 'try', 'catch', 'finally', 'throw', 'null', 'undefined', 'true', 'false', 'this', 'async', 'await', 'default', 'extends', 'of', 'in', 'typeof', 'void'],
  python: ['import', 'from', 'class', 'def', 'if', 'elif', 'else', 'for', 'while', 'return', 'try', 'except', 'finally', 'raise', 'with', 'as', 'None', 'True', 'False', 'self', 'lambda', 'yield', 'global', 'nonlocal', 'pass', 'break', 'continue', 'del', 'in', 'not', 'and', 'or', 'is', 'assert', 'async', 'await'],
  go: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'return', 'go', 'defer', 'select', 'nil', 'true', 'false'],
  rust: ['use', 'mod', 'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait', 'if', 'else', 'for', 'while', 'loop', 'match', 'return', 'pub', 'self', 'super', 'crate', 'true', 'false', 'as', 'in', 'ref', 'move', 'async', 'await', 'unsafe', 'where', 'type'],
  swift: ['import', 'class', 'struct', 'enum', 'protocol', 'func', 'var', 'let', 'if', 'else', 'guard', 'switch', 'case', 'for', 'while', 'repeat', 'return', 'throw', 'try', 'catch', 'nil', 'true', 'false', 'self', 'super', 'init', 'private', 'public', 'internal', 'open', 'static', 'override', 'async', 'await'],
  dart: ['import', 'class', 'extends', 'implements', 'with', 'mixin', 'abstract', 'enum', 'void', 'var', 'final', 'const', 'static', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'null', 'true', 'false', 'this', 'super', 'async', 'await', 'late', 'required'],
  css: ['@import', '@media', '@keyframes', '@font-face', 'important'],
  sql: ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'NULL', 'TRUE', 'FALSE', 'IN', 'LIKE', 'BETWEEN', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
  shell: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'export', 'source', 'local', 'readonly'],
};

export interface SyntaxToken {
  text: string;
  color: string;
}

export function highlightLine(line: string, language: string): SyntaxToken[] {
  if (!line) return [{ text: ' ', color: IDE.text }];

  if (language === 'xml') return highlightXML(line);
  if (language === 'json') return highlightJSON(line);

  const trimmed = line.trimStart();

  if (trimmed.startsWith('//') || (trimmed.startsWith('#') && language !== 'css')) {
    return [{ text: line, color: IDE.comment }];
  }
  if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
    return [{ text: line, color: IDE.comment }];
  }

  const keywords = KEYWORDS[language] || [];
  const tokens: SyntaxToken[] = [];
  const regex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*|#.*|\d+\.?\d*|@\w+|[a-zA-Z_]\w*|[^\s]|\s+)/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    const token = match[0];
    if (token.startsWith('//') || (token.startsWith('#') && language !== 'css')) {
      tokens.push({ text: token, color: IDE.comment });
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      tokens.push({ text: token, color: IDE.string });
    } else if (/^\d/.test(token)) {
      tokens.push({ text: token, color: IDE.number });
    } else if (token.startsWith('@')) {
      tokens.push({ text: token, color: IDE.keyword });
    } else if (keywords.includes(token)) {
      tokens.push({ text: token, color: IDE.keyword });
    } else if (/^[A-Z][a-zA-Z0-9]*$/.test(token) && token.length > 1) {
      tokens.push({ text: token, color: IDE.type });
    } else if (/^[{}()\[\]<>:;.,=+\-*\/!&|?^~%]$/.test(token)) {
      tokens.push({ text: token, color: IDE.operator });
    } else {
      tokens.push({ text: token, color: IDE.text });
    }
  }

  return tokens.length > 0 ? tokens : [{ text: line, color: IDE.text }];
}

function highlightXML(line: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const regex = /(<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9:._-]*|\/?>|[a-zA-Z:._-]+="[^"]*"|"[^"]*"|[^<>"]+)/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    const token = match[0];
    if (token.startsWith('<!--')) {
      tokens.push({ text: token, color: IDE.comment });
    } else if (token.startsWith('<')) {
      tokens.push({ text: token, color: IDE.tag });
    } else if (token === '/>' || token === '>') {
      tokens.push({ text: token, color: IDE.tag });
    } else if (token.includes('="')) {
      const eqIdx = token.indexOf('=');
      tokens.push({ text: token.slice(0, eqIdx), color: IDE.func });
      tokens.push({ text: '=', color: IDE.operator });
      tokens.push({ text: token.slice(eqIdx + 1), color: IDE.string });
    } else if (token.startsWith('"')) {
      tokens.push({ text: token, color: IDE.string });
    } else {
      tokens.push({ text: token, color: IDE.text });
    }
  }

  return tokens.length > 0 ? tokens : [{ text: line, color: IDE.text }];
}

function highlightJSON(line: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const regex = /("(?:[^"\\]|\\.)*"\s*:|\s*"(?:[^"\\]|\\.)*"|true|false|null|\d+\.?\d*|[{}[\]:,]|\s+)/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    const token = match[0];
    if (token.trimEnd().endsWith(':') && token.trimStart().startsWith('"')) {
      tokens.push({ text: token, color: IDE.func });
    } else if (token.trimStart().startsWith('"')) {
      tokens.push({ text: token, color: IDE.string });
    } else if (/^(true|false|null)$/.test(token.trim())) {
      tokens.push({ text: token, color: IDE.keyword });
    } else if (/^\d/.test(token.trim())) {
      tokens.push({ text: token, color: IDE.number });
    } else {
      tokens.push({ text: token, color: IDE.operator });
    }
  }

  return tokens.length > 0 ? tokens : [{ text: line, color: IDE.text }];
}

export type MarkdownSegment = { type: 'text' | 'code' | 'iframe'; content: string; language?: string; src?: string; height?: string; width?: string; borderRadius?: string };

export function parseMarkdownSegments(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];

  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index);
      parseTextForIframes(textPart, segments);
    }
    segments.push({ type: 'code', content: match[2], language: match[1] || 'plain' });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const textPart = text.slice(lastIndex);
    parseTextForIframes(textPart, segments);
  }

  if (segments.length === 0 && text.length > 0) {
    parseTextForIframes(text, segments);
  } else if (segments.length === 0) {
     segments.push({ type: 'text', content: text });
  }

  return segments;
}

function parseTextForIframes(text: string, segments: MarkdownSegment[]) {
  const iframeRegex = /<iframe\s+([^>]+)><\/iframe>/gi;
  let lastIndex = 0;
  let match;

  while ((match = iframeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const attributesStr = match[1];

    const srcMatch = attributesStr.match(/src=["']([^"']+)["']/i);
    const heightMatch = attributesStr.match(/height=["']([^"']+)["']/i);
    const widthMatch = attributesStr.match(/width=["']([^"']+)["']/i);
    const styleMatch = attributesStr.match(/style=["']([^"']+)["']/i);

    let borderRadius;
    if (styleMatch && styleMatch[1]) {
        const brMatch = styleMatch[1].match(/border-radius:\s*([^;]+);?/i);
        if (brMatch) borderRadius = brMatch[1].trim();
    }

    segments.push({
      type: 'iframe',
      content: match[0],
      src: srcMatch ? srcMatch[1] : undefined,
      height: heightMatch ? heightMatch[1] : undefined,
      width: widthMatch ? widthMatch[1] : undefined,
      borderRadius
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
}
