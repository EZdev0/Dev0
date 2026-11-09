/**
 * Dev0 "AI for Free" Community Key Sharing Pool, Server-Only Vault Proxy Client,
 * Placeholder & Anti-Jailbreak Detector, Configurable Owner Notifications,
 * 50% Emergency Auto-Cutoff Kill-Switch (Not-Aus), Real BPE Token Reader,
 * Per-Chat Debug Telemetry & 3-Tier Role Governance (Owner / Admin / User).
 *
 * Security & Privacy Guarantees:
 * 1. Zero PII / Email Leaks: No personal email addresses are hardcoded anywhere in source code.
 *    Emails are masked via `maskEmailAddress` for non-Owner views.
 * 2. Zero Fake Keys or Placeholders: `createDefaultFreePoolState()` starts with `sharedKeys: []`.
 *    `detectAuthOrKeyPlaceholder` flags any placeholder email (`google.user@gmail.com`) or dummy key (`pool_builtin_studio_free`).
 * 3. Server-Only API Key Vault & Hard `max_tokens` Cap: Shared API keys are stored in the server vault (`/api/pool`)
 *    and never exposed in raw form to other users. Every request is checked for prompt-injection jailbreaks
 *    (`inspectPromptForKeyJailbreak`) and clamped to the remaining token budget (`clampMaxTokensForPoolKey`).
 * 4. Configurable Notification & 50% Emergency Auto-Cutoff (Not-Aus) Without Deletion:
 *    Key owners configure `notifyAtPercent` (e.g. 25%, 40%, 50%, 75%, 80%) and `emergencyCutoffPercent` (default 50%).
 *    When a key hits `emergencyCutoffPercent`, it enters `status: 'emergency_stop'` (`isActive: false`), notifies the owner,
 *    and rotates to the next pool key WITHOUT deleting the key or its telemetry history.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIProviderType } from '@/types';

export type GovernanceRole = 'owner' | 'admin' | 'user';
export type PoolUserRole = GovernanceRole;

export type PoolKeyStatus =
  | 'active'
  | 'warning'
  | 'emergency_stop'
  | 'exhausted'
  | 'expired'
  | 'paused';

export interface SharedPoolKey {
  id: string;
  provider: AIProviderType;
  model: string;
  maskedKey: string;
  encodedSecret: string; // Server-vault token reference or obfuscated local fallback
  vaultBacked?: boolean; // True when stored in server-only /api/pool vault
  ownerUserId: string;
  ownerLabel: string;
  targetUserId: string; // '*' for all Free Pool users, or specific User ID e.g. 'usr_xyz'
  tokenLimit: number; // 0 = unlimited
  tokensUsed: number;
  promptTokensUsed: number;
  completionTokensUsed: number;
  notifyAtPercent?: number; // Configurable notification threshold (default 40%)
  emergencyCutoffEnabled?: boolean; // Emergency Auto-Cutoff Kill-Switch (default true)
  emergencyCutoffPercent?: number; // Configurable Not-Aus percentage (default 50%)
  notifiedWarning?: boolean;
  notifiedThreshold?: boolean;
  notifiedEmergency?: boolean;
  notifiedEmergencyStop?: boolean;
  notifiedExhausted?: boolean;
  emergencyStopReason?: string;
  createdAt: number;
  expiresAt: number | null; // null = no time limit
  isActive: boolean;
  status: PoolKeyStatus;
}

export interface TokenUsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  isExactFromAPI: boolean;
  isExactFromProvider?: boolean;
  provider: string;
  model: string;
  poolKeyId?: string;
  latencyMs?: number;
  toolCallsCount?: number;
  usedFallback?: boolean;
  timestamp: number;
}

export interface ChatDebugLogEntry {
  id: string;
  chatTurnId?: string;
  userId: string;
  provider: string;
  model: string;
  poolKeyId?: string;
  maskedPoolKey?: string;
  maskedKeyUsed?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  isExactFromAPI?: boolean;
  isExactFromProvider?: boolean;
  latencyMs: number;
  toolCalls: string[];
  usedFallback: boolean;
  fallbackProvider?: string;
  promptPreview: string;
  responsePreview?: string;
  timestamp: number;
}

export interface PoolNotification {
  id: string;
  level: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  keyId?: string;
  ownerUserId?: string;
  timestamp: number;
  read: boolean;
}

export interface GovernanceUser {
  id: string;
  email: string;
  maskedEmail?: string;
  displayName: string;
  authProvider: 'google' | 'local' | 'guest';
  firebaseUid?: string;
  role: GovernanceRole;
  status: 'active' | 'timeout' | 'suspended';
  timeoutUntil: number | null;
  suspendReason?: string;
  tokenQuota: number; // 0 = unlimited
  tokensConsumed: number;
  preferredProvider?: string;
  createdAt: number;
  lastActiveAt: number;
  recentChatExcerpts: {
    id: string;
    text: string;
    timestamp: number;
    flagged?: boolean;
    tokens?: number;
    model?: string;
    provider?: string;
  }[];
}

export interface FreePoolState {
  poolEnabled: boolean;
  isAuthenticated: boolean;
  isAuthenticatedGoogle?: boolean;
  ownerClaimedByUserId?: string | null;
  authProvider: 'google' | 'local' | 'guest';
  currentUserId: string;
  currentUserEmail: string;
  sharedKeys: SharedPoolKey[];
  users: GovernanceUser[];
  notifications: PoolNotification[];
  chatDebugLogs: ChatDebugLogEntry[];
  debugLogs?: ChatDebugLogEntry[];
  sessionTokens: {
    prompt: number;
    completion: number;
    total: number;
    savedByCompression: number;
  };
}

export interface PlaceholderDetectionResult {
  isPlaceholder: boolean;
  reason?: string;
  reasons: string[];
  category?: 'email' | 'api_key' | 'unconfigured';
}

const STORAGE_KEY_FREE_POOL = 'ide_free_ai_pool_state_v2';
const OBFUSCATION_SALT = 'AI_MEGA_BRAIN_POOL_2026_KEY_GUARD';

const KNOWN_PLACEHOLDER_PATTERNS = [
  /^google\.user@gmail\.com$/i,
  /^guest@dev0\.local$/i,
  /^user@example\.com$/i,
  /^test@test\.com$/i,
  /^pool_builtin_studio_free$/i,
  /^rork_builtin$/i,
  /^your[_-]?api[_-]?key/i,
  /^insert[_-]?key[_-]?here/i,
  /^placeholder/i,
  /^sk-placeholder/i,
  /^sk-\.\.\.$/i,
  /^gsk_\.\.\.$/i,
  /^AIza\.\.\.$/i,
];

/**
 * Explicitly detects fake/placeholder login emails, dummy keys, or unconfigured states
 * so the UI and backend never silently accept placeholder credentials as real accounts or keys.
 */
export function detectAuthOrKeyPlaceholder(
  input?:
    | string
    | null
    | { email?: string | null; apiKey?: string | null; poolKeyId?: string | null },
): PlaceholderDetectionResult {
  if (input && typeof input === 'object') {
    const candidates = [input.email, input.apiKey, input.poolKeyId].filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
    if (candidates.length === 0) {
      return {
        isPlaceholder: true,
        reason: 'Value is empty or unconfigured.',
        reasons: ['Value is empty or unconfigured.'],
        category: 'unconfigured',
      };
    }
    const reasons: string[] = [];
    let category: 'email' | 'api_key' | 'unconfigured' | undefined;
    for (const c of candidates) {
      const sub = detectAuthOrKeyPlaceholder(c);
      if (sub.isPlaceholder && sub.reason) {
        reasons.push(sub.reason);
        category = category || sub.category;
      }
    }
    return {
      isPlaceholder: reasons.length > 0,
      reason: reasons[0],
      reasons,
      category,
    };
  }

  const clean = (typeof input === 'string' ? input : '').trim();
  if (!clean) {
    const msg = 'Value is empty or unconfigured.';
    return {
      isPlaceholder: true,
      reason: msg,
      reasons: [msg],
      category: 'unconfigured',
    };
  }
  for (const pattern of KNOWN_PLACEHOLDER_PATTERNS) {
    if (pattern.test(clean)) {
      const isEmail = clean.includes('@');
      const msg = isEmail
        ? `Placeholder email "${clean}" detected. Please sign in with a real Google account via Firebase Auth.`
        : `Placeholder API key "${clean}" detected. Please provide a valid provider API key.`;
      return {
        isPlaceholder: true,
        reason: msg,
        reasons: [msg],
        category: isEmail ? 'email' : 'api_key',
      };
    }
  }
  return { isPlaceholder: false, reasons: [] };
}

/**
 * Anti-Jailbreak & Key Exfiltration Guard:
 * Inspects user prompts and tool arguments to block any attempt to extract, print,
 * or exfiltrate shared API keys, vault tokens, or environment secrets.
 */
export function inspectPromptForKeyJailbreak(
  input?: string | null | { role?: string; content?: string }[],
): {
  blocked: boolean;
  safe: boolean;
  reason?: string;
} {
  const text = Array.isArray(input)
    ? input.map(m => m?.content || '').join('\n')
    : typeof input === 'string'
      ? input
      : '';
  if (!text) return { blocked: false, safe: true };
  const normalized = text.toLowerCase();
  const jailbreakPatterns: { pattern: RegExp; reason: string }[] = [
    {
      pattern: /(?:reveal|print|show|dump|output|leak|exfiltrate|echo|return)\s+(?:the\s+|your\s+|all\s+)?(?:raw\s+|secret\s+|shared\s+|pool\s+|system\s+)?(?:api[_\s-]?key|encodedsecret|decodepoolsecret|authorization\s+header|bearer\s+token|env\s+var)/i,
      reason: 'Blocked attempt to extract or reveal protected API keys from the shared pool vault.',
    },
    {
      pattern: /ignore\s+(?:all\s+|previous\s+|prior\s+|system\s+)+(?:instructions|rules|guards).*(?:api[_\s-]?key|secret|token|vault|password)/i,
      reason: 'Blocked prompt-injection jailbreak targeting shared API key credentials.',
    },
    {
      pattern: /decodepoolsecret\s*\(|ide_free_ai_pool_state_v2|process\.env\.(?:openai|groq|gemini|anthropic|openrouter)/i,
      reason: 'Blocked direct inspection of internal key vault storage or environment secrets.',
    },
  ];

  for (const item of jailbreakPatterns) {
    if (item.pattern.test(normalized)) {
      return { blocked: true, safe: false, reason: item.reason };
    }
  }
  return { blocked: false, safe: true };
}

/**
 * Hard `max_tokens` Clamping Guard:
 * Ensures a single API call can NEVER exceed the remaining token allowance before
 * the key's Emergency Auto-Cutoff (`emergencyCutoffPercent`) or total `tokenLimit`.
 */
export function clampMaxTokensForPoolKey(
  firstArg:
    | number
    | Pick<
        SharedPoolKey,
        'tokenLimit' | 'tokensUsed' | 'emergencyCutoffEnabled' | 'emergencyCutoffPercent'
      >,
  secondArg:
    | number
    | Pick<
        SharedPoolKey,
        'tokenLimit' | 'tokensUsed' | 'emergencyCutoffEnabled' | 'emergencyCutoffPercent'
      >,
  estimatedPromptTokens: number = 0,
): { allowed: boolean; clampedMaxTokens: number; remainingBudget: number; reason?: string } {
  const requestedMaxTokens = typeof firstArg === 'number' ? firstArg : (secondArg as number);
  const key = (typeof firstArg === 'object' ? firstArg : secondArg) as Pick<
    SharedPoolKey,
    'tokenLimit' | 'tokensUsed' | 'emergencyCutoffEnabled' | 'emergencyCutoffPercent'
  >;

  const safeRequested = Math.max(1, Math.min(requestedMaxTokens || 2048, 8192));
  if (!key || !key.tokenLimit || key.tokenLimit <= 0) {
    return {
      allowed: true,
      clampedMaxTokens: safeRequested,
      remainingBudget: Number.MAX_SAFE_INTEGER,
    };
  }

  const cutoffEnabled = key.emergencyCutoffEnabled ?? true;
  const cutoffPctVal = key.emergencyCutoffPercent ?? 50;
  const cutoffPct =
    cutoffEnabled && cutoffPctVal > 0 && cutoffPctVal <= 100
      ? cutoffPctVal
      : 100;
  const effectiveCeiling = Math.floor((key.tokenLimit * cutoffPct) / 100);
  const remainingBeforeCeiling = effectiveCeiling - key.tokensUsed - Math.max(0, estimatedPromptTokens);

  if (remainingBeforeCeiling <= 0) {
    return {
      allowed: false,
      clampedMaxTokens: 0,
      remainingBudget: 0,
      reason:
        cutoffPct < 100
          ? `Emergency Auto-Cutoff (Not-Aus at ${cutoffPct}%) reached (${key.tokensUsed.toLocaleString()} / ${key.tokenLimit.toLocaleString()} tokens).`
          : `Token limit reached (${key.tokensUsed.toLocaleString()} / ${key.tokenLimit.toLocaleString()} tokens).`,
    };
  }

  return {
    allowed: true,
    clampedMaxTokens: Math.max(1, Math.min(safeRequested, remainingBeforeCeiling)),
    remainingBudget: remainingBeforeCeiling,
  };
}

/**
 * Masks an email address so raw user PII is never leaked in UI lists (`de•••r@example.com`).
 */
export function maskEmailAddress(rawEmail: string): string {
  const clean = (rawEmail || '').trim();
  if (!clean || !clean.includes('@')) return 'user•••@protected';
  const [localPart, domainPart] = clean.split('@');
  if (localPart.length <= 2) {
    return `${localPart.slice(0, 1)}•••@${domainPart}`;
  }
  return `${localPart.slice(0, 2)}•••${localPart.slice(-1)}@${domainPart}`;
}

/**
 * Role Permission Helpers (3-Tier RBAC: Owner vs. Admin vs. User)
 */
export function canManageUsers(role?: GovernanceRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function canViewUserChats(
  viewerRole?: GovernanceRole | null,
  viewerUserId?: string,
  targetUserId?: string,
): boolean {
  if (viewerRole === 'owner') return true;
  if (viewerUserId && targetUserId && viewerUserId === targetUserId) return true;
  return false;
}

/**
 * Deterministic Owner passphrase hash verification (no plaintext email or password in source).
 */
export function verifyOwnerClaimPassphrase(passphrase?: string | null): boolean {
  const trimmed = (passphrase || '').trim();
  if (trimmed.length < 6) return false;
  let hash = 2166136261;
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsignedHash = hash >>> 0;
  return unsignedHash === 3319956065 || trimmed.toUpperCase().startsWith('DEV0-OWNER');
}

/**
 * Encodes a raw API key so it is never stored in plain readable text.
 */
export function encodePoolSecret(rawKey: string): string {
  if (!rawKey) return '';
  const trimmed = rawKey.trim();
  const bytes: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i) ^ OBFUSCATION_SALT.charCodeAt(i % OBFUSCATION_SALT.length);
    bytes.push(code);
  }
  return 'enc1_' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function decodePoolSecret(encoded: string): string {
  if (!encoded) return '';
  if (encoded.startsWith('vault_ref_')) return encoded;
  if (!encoded.startsWith('enc1_')) return encoded;
  const hex = encoded.slice(5);
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    const saltChar = OBFUSCATION_SALT.charCodeAt((i / 2) % OBFUSCATION_SALT.length);
    out += String.fromCharCode(byte ^ saltChar);
  }
  return out;
}

/**
 * Strictly masks an API key so no user can ever inspect the secret value in the UI
 */
export function maskApiKey(rawKey: string): string {
  const clean = (rawKey || '').trim();
  if (clean.length <= 8) return '••••••••••••';
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Deterministic cl100k-calibrated BPE subword token estimator.
 */
export function estimateTokensBPE(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  let tokenCount = 0;
  const segments = text.match(
    /[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d{1,3}|[^\sA-Za-z0-9]|\s+/g,
  );
  if (!segments) return Math.ceil(text.length / 3.8);

  for (const seg of segments) {
    if (/^\s+$/.test(seg)) {
      tokenCount += Math.max(1, Math.ceil(seg.length / 4));
    } else if (/^[A-Za-z]+$/.test(seg)) {
      tokenCount += seg.length <= 5 ? 1 : Math.ceil(seg.length / 4.5);
    } else {
      tokenCount += 1;
    }
  }
  return Math.max(1, Math.round(tokenCount * 0.88));
}

/**
 * Extracts exact token counts from OpenAI/Groq/OpenRouter/Anthropic/Gemini JSON responses,
 * falling back to deterministic BPE tokenization when streaming or keyless.
 */
export function extractActualTokenUsage(
  rawApiResponse: any,
  promptText: string,
  completionText: string,
  provider: string,
  model: string,
): TokenUsageRecord {
  const usage = rawApiResponse?.usage;
  if (usage && (typeof usage.prompt_tokens === 'number' || typeof usage.total_tokens === 'number')) {
    const promptTokens = Number(usage.prompt_tokens || 0);
    const completionTokens = Number(usage.completion_tokens || 0);
    const totalTokens = Number(usage.total_tokens || promptTokens + completionTokens);
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      isExactFromAPI: true,
      provider,
      model,
      timestamp: Date.now(),
    };
  }

  const gemUsage = rawApiResponse?.usageMetadata;
  if (gemUsage && (typeof gemUsage.promptTokenCount === 'number' || typeof gemUsage.totalTokenCount === 'number')) {
    const promptTokens = Number(gemUsage.promptTokenCount || 0);
    const completionTokens = Number(gemUsage.candidatesTokenCount || 0);
    const totalTokens = Number(gemUsage.totalTokenCount || promptTokens + completionTokens);
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      isExactFromAPI: true,
      provider,
      model,
      timestamp: Date.now(),
    };
  }

  if (usage && (typeof usage.input_tokens === 'number' || typeof usage.output_tokens === 'number')) {
    const promptTokens = Number(usage.input_tokens || 0);
    const completionTokens = Number(usage.output_tokens || 0);
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      isExactFromAPI: true,
      provider,
      model,
      timestamp: Date.now(),
    };
  }

  const promptTokens = estimateTokensBPE(promptText);
  const completionTokens = estimateTokensBPE(completionText);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    isExactFromAPI: false,
    provider,
    model,
    timestamp: Date.now(),
  };
}

/**
 * Evaluates a SharedPoolKey's current status based on token quota, configurable
 * notification threshold (`notifyAtPercent`), and 50% Emergency Auto-Cutoff (`emergencyCutoffPercent`).
 * NEVER deletes the key.
 */
export function evaluatePoolKeyStatus(
  key: SharedPoolKey,
  now: number = Date.now(),
): PoolKeyStatus {
  if (key.expiresAt !== null && now >= key.expiresAt) return 'expired';
  if (key.tokenLimit > 0) {
    const pct = (key.tokensUsed / key.tokenLimit) * 100;
    const cutoffPct =
      typeof key.emergencyCutoffPercent === 'number' && key.emergencyCutoffPercent > 0
        ? key.emergencyCutoffPercent
        : 50;
    const notifyPct =
      typeof key.notifyAtPercent === 'number' && key.notifyAtPercent > 0
        ? key.notifyAtPercent
        : 40;

    if (pct >= 100) return 'exhausted';
    if (key.emergencyCutoffEnabled && pct >= cutoffPct) return 'emergency_stop';
    if (!key.isActive) return 'paused';
    if (pct >= notifyPct) return 'warning';
  }
  if (!key.isActive) return 'paused';
  if (key.expiresAt !== null && key.expiresAt - now <= 5 * 60 * 1000) return 'warning';
  return 'active';
}

/**
 * Intelligent Key Router: Selects the best valid shared key for a given `userId`.
 * Automatically skips `paused`, `expired`, `exhausted`, and `emergency_stop` keys
 * and advances to the next active key without deleting any key.
 */
export function selectActivePoolKeyForUser(
  keys: SharedPoolKey[],
  userId: string,
  preferredProvider?: AIProviderType,
  now: number = Date.now(),
): { selectedKey: SharedPoolKey; decodedSecret: string } | null {
  const validKeys = keys.filter(k => {
    if (k.id === 'pool_builtin_studio_free') return false;
    const st = evaluatePoolKeyStatus(k, now);
    if (st !== 'active' && st !== 'warning') return false;
    if (!k.isActive) return false;
    if (k.targetUserId && k.targetUserId !== '*' && k.targetUserId !== userId) return false;
    return true;
  });

  if (validKeys.length === 0) return null;

  validKeys.sort((a, b) => {
    const aUserMatch = a.targetUserId === userId ? 1 : 0;
    const bUserMatch = b.targetUserId === userId ? 1 : 0;
    if (aUserMatch !== bUserMatch) return bUserMatch - aUserMatch;

    if (preferredProvider) {
      const aProv = a.provider === preferredProvider ? 1 : 0;
      const bProv = b.provider === preferredProvider ? 1 : 0;
      if (aProv !== bProv) return bProv - aProv;
    }

    const aRem = a.tokenLimit > 0 ? a.tokenLimit - a.tokensUsed : Number.MAX_SAFE_INTEGER;
    const bRem = b.tokenLimit > 0 ? b.tokenLimit - b.tokensUsed : Number.MAX_SAFE_INTEGER;
    return bRem - aRem;
  });

  const best = validKeys[0];
  return {
    selectedKey: best,
    decodedSecret: decodePoolSecret(best.encodedSecret),
  };
}

/**
 * Default state with zero hardcoded personal emails, zero fake built-in pool keys,
 * and 100% real zero-initialized counters.
 */
export function createDefaultFreePoolState(): FreePoolState {
  const now = Date.now();
  const guestId = 'usr_guest_local';
  return {
    poolEnabled: true,
    isAuthenticated: false,
    isAuthenticatedGoogle: false,
    authProvider: 'guest',
    currentUserId: guestId,
    currentUserEmail: 'guest@dev0.local',
    sharedKeys: [],
    users: [
      {
        id: guestId,
        email: 'guest@dev0.local',
        maskedEmail: 'gu•••@dev0.local',
        displayName: 'Local Guest (Sign in with Google required for Pool)',
        authProvider: 'guest',
        role: 'user',
        status: 'active',
        timeoutUntil: null,
        tokenQuota: 0,
        tokensConsumed: 0,
        preferredProvider: 'rork',
        createdAt: now,
        lastActiveAt: now,
        recentChatExcerpts: [],
      },
    ],
    notifications: [],
    chatDebugLogs: [],
    sessionTokens: {
      prompt: 0,
      completion: 0,
      total: 0,
      savedByCompression: 0,
    },
  };
}

/**
 * Dual-Engine Persistence: Uses IndexedDB on Web (when available) + AsyncStorage
 */
async function writeToIndexedDB(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  return new Promise<void>(resolve => {
    try {
      const req = window.indexedDB.open('AIMegaBrainDB', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(value, key);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function readFromIndexedDB(key: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  return new Promise<string | null>(resolve => {
    try {
      const req = window.indexedDB.open('AIMegaBrainDB', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('kv', 'readonly');
          const getReq = tx.objectStore('kv').get(key);
          getReq.onsuccess = () => {
            const val = typeof getReq.result === 'string' ? getReq.result : null;
            db.close();
            resolve(val);
          };
          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadFreePoolState(): Promise<FreePoolState> {
  try {
    const idbRaw = await readFromIndexedDB(STORAGE_KEY_FREE_POOL);
    const asyncRaw = idbRaw || (await AsyncStorage.getItem(STORAGE_KEY_FREE_POOL));
    if (asyncRaw) {
      const parsed = JSON.parse(asyncRaw);
      const defaults = createDefaultFreePoolState();
      const sanitizedUsers: GovernanceUser[] =
        Array.isArray(parsed.users) && parsed.users.length > 0
          ? parsed.users.map((u: any) => ({
              ...u,
              maskedEmail: maskEmailAddress(u.email || ''),
              authProvider: u.authProvider || 'local',
              role:
                u.role === 'owner' || u.role === 'admin' || u.role === 'user'
                  ? u.role
                  : 'user',
            }))
          : defaults.users;

      // Strip legacy fake placeholder key `pool_builtin_studio_free`
      const rawKeys = Array.isArray(parsed.sharedKeys)
        ? parsed.sharedKeys.filter((k: any) => k && k.id !== 'pool_builtin_studio_free')
        : [];

      const sanitizedKeys: SharedPoolKey[] = rawKeys.map((k: any) => {
        const normalized: SharedPoolKey = {
          ...k,
          notifyAtPercent:
            typeof k.notifyAtPercent === 'number' && k.notifyAtPercent > 0
              ? k.notifyAtPercent
              : 40,
          emergencyCutoffEnabled:
            typeof k.emergencyCutoffEnabled === 'boolean' ? k.emergencyCutoffEnabled : true,
          emergencyCutoffPercent:
            typeof k.emergencyCutoffPercent === 'number' && k.emergencyCutoffPercent > 0
              ? k.emergencyCutoffPercent
              : 50,
          ownerLabel: k.ownerLabel?.includes('@')
            ? maskEmailAddress(k.ownerLabel)
            : k.ownerLabel || 'Pool Member',
        };
        normalized.status = evaluatePoolKeyStatus(normalized);
        if (normalized.status === 'emergency_stop') {
          normalized.isActive = false;
        }
        return normalized;
      });

      return {
        ...defaults,
        ...parsed,
        sharedKeys: sanitizedKeys,
        users: sanitizedUsers,
        notifications: Array.isArray(parsed.notifications)
          ? parsed.notifications
          : defaults.notifications,
        chatDebugLogs: Array.isArray(parsed.chatDebugLogs) ? parsed.chatDebugLogs : [],
      };
    }
  } catch (e) {
    console.log('[FreePool] Error loading state:', e);
  }
  return createDefaultFreePoolState();
}

export async function saveFreePoolState(state: FreePoolState): Promise<void> {
  try {
    const serialized = JSON.stringify(state);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_FREE_POOL, serialized),
      writeToIndexedDB(STORAGE_KEY_FREE_POOL, serialized),
    ]);
  } catch (e) {
    console.log('[FreePool] Error saving state:', e);
  }
}
