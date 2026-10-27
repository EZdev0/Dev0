import { Platform } from 'react-native';

export interface ChatZipEntry {
  path: string;
  content: string;
  sizeBytes: number;
}

export interface ChatZipArtifact {
  id: string;
  name: string;
  archiveName: string;
  description: string;
  entries: ChatZipEntry[];
  files: ChatZipEntry[];
  fileCount: number;
  sizeBytes: number;
  totalBytes: number;
  totalSizeBytes: number;
  base64Zip: string;
  base64Data: string;
  createdAt: number;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) utf8.push(charCode);
    else if (charCode < 0x800) {
      utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else {
      utf8.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }
  return new Uint8Array(utf8);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    const triplet = (b1 << 16) | (b2 << 8) | b3;
    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += i + 1 < len ? chars[(triplet >> 6) & 0x3f] : '=';
    result += i + 2 < len ? chars[triplet & 0x3f] : '=';
  }
  return result;
}

function writeUint16LE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeUint32LE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

export type CreateChatZipInput =
  | {
      archiveName?: string;
      description?: string;
      files: { path: string; content: string }[];
    }
  | string;

/**
 * Builds a real PKZIP (STORE method 0) archive in memory and returns a ChatZipArtifact
 * with downloadable base64 data and inspectable entries for zip_read.
 */
export function createChatZipArchive(
  paramsOrName: CreateChatZipInput,
  maybeFiles?: { path: string; content: string }[],
  maybeDescription?: string
): ChatZipArtifact {
  const params =
    typeof paramsOrName === 'string'
      ? {
          archiveName: paramsOrName,
          files: maybeFiles || [],
          description: maybeDescription,
        }
      : paramsOrName;

  const rawName = (params.archiveName || 'dev0-bundle.zip').trim();
  const archiveName = rawName.toLowerCase().endsWith('.zip') ? rawName : `${rawName}.zip`;
  const normalizedEntries: ChatZipEntry[] = (params.files || [])
    .filter((f) => f && typeof f.path === 'string')
    .map((f) => {
      const cleanPath = f.path.replace(/^\/+/, '').replace(/\.\.+/g, '_') || 'snippet.txt';
      const content = typeof f.content === 'string' ? f.content : String(f.content ?? '');
      const bytes = encodeUtf8(content);
      return {
        path: cleanPath,
        content,
        sizeBytes: bytes.length,
      };
    });

  if (normalizedEntries.length === 0) {
    const fallbackContent = '# Dev0 Bundle\nNo files were provided.';
    normalizedEntries.push({
      path: 'README.md',
      content: fallbackContent,
      sizeBytes: encodeUtf8(fallbackContent).length,
    });
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of normalizedEntries) {
    const nameBytes = encodeUtf8(entry.path);
    const dataBytes = encodeUtf8(entry.content);
    const crc = crc32(dataBytes);

    // Local file header (30 bytes + filename + data)
    const localHeader = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50); // signature
    writeUint16LE(localHeader, 4, 20); // version needed
    writeUint16LE(localHeader, 6, 0x0800); // UTF-8 flag
    writeUint16LE(localHeader, 8, 0); // STORE method
    writeUint16LE(localHeader, 10, 0); // mod time
    writeUint16LE(localHeader, 12, 0); // mod date
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(localHeader, 18, dataBytes.length);
    writeUint32LE(localHeader, 22, dataBytes.length);
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0); // extra length
    localHeader.set(nameBytes, 30);
    localHeader.set(dataBytes, 30 + nameBytes.length);
    localParts.push(localHeader);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(centralHeader, 0, 0x02014b50);
    writeUint16LE(centralHeader, 4, 20); // version made by
    writeUint16LE(centralHeader, 6, 20); // version needed
    writeUint16LE(centralHeader, 8, 0x0800); // UTF-8 flag
    writeUint16LE(centralHeader, 10, 0); // STORE
    writeUint16LE(centralHeader, 12, 0);
    writeUint16LE(centralHeader, 14, 0);
    writeUint32LE(centralHeader, 16, crc);
    writeUint32LE(centralHeader, 20, dataBytes.length);
    writeUint32LE(centralHeader, 24, dataBytes.length);
    writeUint16LE(centralHeader, 28, nameBytes.length);
    writeUint16LE(centralHeader, 30, 0);
    writeUint16LE(centralHeader, 32, 0);
    writeUint16LE(centralHeader, 34, 0);
    writeUint16LE(centralHeader, 36, 0);
    writeUint32LE(centralHeader, 38, 0);
    writeUint32LE(centralHeader, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length;
  }

  let centralSize = 0;
  for (const c of centralParts) centralSize += c.length;

  const endRecord = new Uint8Array(22);
  writeUint32LE(endRecord, 0, 0x06054b50);
  writeUint16LE(endRecord, 4, 0);
  writeUint16LE(endRecord, 6, 0);
  writeUint16LE(endRecord, 8, normalizedEntries.length);
  writeUint16LE(endRecord, 10, normalizedEntries.length);
  writeUint32LE(endRecord, 12, centralSize);
  writeUint32LE(endRecord, 16, localOffset);
  writeUint16LE(endRecord, 20, 0);

  const totalZipLength = localOffset + centralSize + endRecord.length;
  const fullZip = new Uint8Array(totalZipLength);
  let cursor = 0;
  for (const part of localParts) {
    fullZip.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    fullZip.set(part, cursor);
    cursor += part.length;
  }
  fullZip.set(endRecord, cursor);

  const totalSizeBytes = normalizedEntries.reduce((sum, e) => sum + e.sizeBytes, 0);
  const base64Zip = uint8ArrayToBase64(fullZip);

  return {
    id: `zip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: archiveName,
    archiveName,
    description:
      params.description ||
      `Downloadable ZIP bundle with ${normalizedEntries.length} file${normalizedEntries.length === 1 ? '' : 's'}`,
    entries: normalizedEntries,
    files: normalizedEntries,
    fileCount: normalizedEntries.length,
    sizeBytes: totalSizeBytes,
    totalBytes: totalSizeBytes,
    totalSizeBytes,
    base64Zip,
    base64Data: base64Zip,
    createdAt: Date.now(),
  };
}

/**
 * Reads either the file index or a specific file slice from one or more ChatZipArtifacts.
 */
export function readChatZipArchive(
  artifactsOrSingle: ChatZipArtifact | ChatZipArtifact[],
  optionsOrFilePath?:
    | string
    | {
        zipId?: string;
        archiveName?: string;
        filePath?: string;
        startLine?: number;
        endLine?: number;
      }
): string {
  const artifacts = Array.isArray(artifactsOrSingle)
    ? artifactsOrSingle
    : artifactsOrSingle
      ? [artifactsOrSingle]
      : [];

  if (!artifacts || artifacts.length === 0) {
    return 'No ZIP archives exist in this chat yet. Use zip_create to create a downloadable ZIP bundle first.';
  }

  const options =
    typeof optionsOrFilePath === 'string'
      ? { filePath: optionsOrFilePath }
      : optionsOrFilePath;

  let target = artifacts[artifacts.length - 1];
  if (options?.zipId) {
    const byId = artifacts.find((a) => a.id === options.zipId);
    if (byId) target = byId;
  } else if (options?.archiveName) {
    const needle = options.archiveName.toLowerCase();
    const byName = artifacts.find((a) => a.archiveName.toLowerCase().includes(needle));
    if (byName) target = byName;
  }

  if (!options?.filePath) {
    const listing = target.entries
      .map((e, i) => `  ${i + 1}. ${e.path} (${e.sizeBytes} bytes)`)
      .join('\n');
    return `ZIP Bundle: ${target.archiveName} (id: ${target.id})\nDescription: ${target.description}\nFiles (${target.entries.length}):\n${listing}\n\nTip: Call zip_read with filePath to inspect a specific file inside this ZIP archive.`;
  }

  const normalizedTarget = options.filePath.replace(/^\/+/, '').toLowerCase();
  const entry =
    target.entries.find((e) => e.path.toLowerCase() === normalizedTarget) ||
    target.entries.find((e) => e.path.toLowerCase().endsWith(normalizedTarget));

  if (!entry) {
    const available = target.entries.map((e) => e.path).join(', ');
    return `ERROR: File "${options.filePath}" not found in ZIP archive "${target.archiveName}". Available files: ${available}`;
  }

  const lines = entry.content.split('\n');
  const start = Math.max(1, options.startLine || 1);
  const end = Math.min(lines.length, options.endLine || Math.min(lines.length, start + 199));
  const slice = lines
    .slice(start - 1, end)
    .map((line, idx) => `${start + idx}: ${line}`)
    .join('\n');

  return `File "${entry.path}" from ${target.archiveName} (lines ${start}-${end} of ${lines.length}):\n${slice}`;
}

/**
 * Triggers a browser download for a ChatZipArtifact on Web, or returns a data URL on native.
 */
export function triggerChatZipDownload(artifact: ChatZipArtifact): boolean {
  if (!artifact?.base64Zip) return false;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const dataUrl = `data:application/zip;base64,${artifact.base64Zip}`;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = artifact.archiveName || 'dev0-bundle.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
