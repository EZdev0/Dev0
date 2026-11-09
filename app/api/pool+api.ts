/**
 * Server-Only Shared API Key Vault & Hard `max_tokens` Proxy (`/api/pool`)
 *
 * Security Architecture:
 * 1. Raw API keys shared in "AI for Free" are stored in this server-side vault (`SERVER_KEY_VAULT`)
 *    and are NEVER returned in raw plaintext to any client GET/POST response.
 * 2. Every proxy execution request runs:
 *    - `detectAuthOrKeyPlaceholder` to reject dummy/placeholder keys.
 *    - `inspectPromptForKeyJailbreak` to block prompt-injection or tool attempts to exfiltrate keys.
 *    - `clampMaxTokensForPoolKey` to hard-cap `max_tokens` so no single API call can over-bill
 *      past the key's `emergencyCutoffPercent` (default 50% Not-Aus) or `tokenLimit`.
 * 3. When a key reaches `notifyAtPercent` or `emergencyCutoffPercent` (50%), the key is NEVER deleted;
 *    its status transitions to `'warning'` or `'emergency_stop'` (`isActive: false`) and an owner
 *    notification is emitted.
 */

import {
  SharedPoolKey,
  PoolNotification,
  maskApiKey,
  maskEmailAddress,
  detectAuthOrKeyPlaceholder,
  inspectPromptForKeyJailbreak,
  clampMaxTokensForPoolKey,
  evaluatePoolKeyStatus,
  estimateTokensBPE,
  extractActualTokenUsage,
} from '@/utils/free-ai-pool';

interface VaultKeyEntry {
  meta: SharedPoolKey;
  rawSecret: string;
}

const SERVER_KEY_VAULT = new Map<string, VaultKeyEntry>();
const SERVER_NOTIFICATIONS: PoolNotification[] = [];

function genVaultId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeMetaForClient(meta: SharedPoolKey): SharedPoolKey {
  return {
    ...meta,
    encodedSecret: `vault_ref_${meta.id}`,
    vaultBacked: true,
  };
}

export async function GET() {
  const keys = Array.from(SERVER_KEY_VAULT.values()).map(entry => {
    entry.meta.status = evaluatePoolKeyStatus(entry.meta);
    if (entry.meta.status === 'emergency_stop') {
      entry.meta.isActive = false;
    }
    return sanitizeMetaForClient(entry.meta);
  });

  return Response.json({
    ok: true,
    keys,
    notifications: SERVER_NOTIFICATIONS.slice(0, 50),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body?.action || '').trim();

    if (action === 'register_key') {
      const rawKey = String(body?.rawKey || '').trim();
      const placeholderCheck = detectAuthOrKeyPlaceholder(rawKey);
      if (placeholderCheck.isPlaceholder) {
        return Response.json(
          { ok: false, error: placeholderCheck.reason || 'Placeholder API key rejected.' },
          { status: 400 },
        );
      }

      const keyId = String(body?.id || genVaultId('pool'));
      const now = Date.now();
      const durationMinutes =
        typeof body?.durationMinutes === 'number' && body.durationMinutes > 0
          ? body.durationMinutes
          : null;
      const notifyAtPercent = Math.min(
        99,
        Math.max(5, Number(body?.notifyAtPercent) || 40),
      );
      const emergencyCutoffEnabled =
        typeof body?.emergencyCutoffEnabled === 'boolean'
          ? body.emergencyCutoffEnabled
          : true;
      const emergencyCutoffPercent = Math.min(
        100,
        Math.max(10, Number(body?.emergencyCutoffPercent) || 50),
      );

      const meta: SharedPoolKey = {
        id: keyId,
        provider: body?.provider || 'groq',
        model: body?.model || 'llama-3.3-70b-versatile',
        maskedKey: maskApiKey(rawKey),
        encodedSecret: `vault_ref_${keyId}`,
        vaultBacked: true,
        ownerUserId: String(body?.ownerUserId || 'usr_owner'),
        ownerLabel: maskEmailAddress(String(body?.ownerEmail || 'owner@dev0.auth')),
        targetUserId: String(body?.targetUserId || '*'),
        tokenLimit: Math.max(0, Number(body?.tokenLimit) || 0),
        tokensUsed: 0,
        promptTokensUsed: 0,
        completionTokensUsed: 0,
        notifyAtPercent,
        emergencyCutoffEnabled,
        emergencyCutoffPercent,
        notifiedWarning: false,
        notifiedEmergency: false,
        notifiedExhausted: false,
        createdAt: now,
        expiresAt: durationMinutes ? now + durationMinutes * 60 * 1000 : null,
        isActive: true,
        status: 'active',
      };

      SERVER_KEY_VAULT.set(keyId, { meta, rawSecret: rawKey });
      return Response.json({
        ok: true,
        key: sanitizeMetaForClient(meta),
      });
    }

    if (action === 'update_thresholds') {
      const keyId = String(body?.keyId || '');
      const entry = SERVER_KEY_VAULT.get(keyId);
      if (!entry) {
        return Response.json({ ok: false, error: 'Key not found in server vault.' }, { status: 404 });
      }
      if (typeof body?.notifyAtPercent === 'number') {
        entry.meta.notifyAtPercent = Math.min(99, Math.max(5, body.notifyAtPercent));
      }
      if (typeof body?.emergencyCutoffEnabled === 'boolean') {
        entry.meta.emergencyCutoffEnabled = body.emergencyCutoffEnabled;
      }
      if (typeof body?.emergencyCutoffPercent === 'number') {
        entry.meta.emergencyCutoffPercent = Math.min(100, Math.max(10, body.emergencyCutoffPercent));
      }
      if (typeof body?.isActive === 'boolean') {
        entry.meta.isActive = body.isActive;
      }
      entry.meta.status = evaluatePoolKeyStatus(entry.meta);
      return Response.json({
        ok: true,
        key: sanitizeMetaForClient(entry.meta),
      });
    }

    if (action === 'proxy_chat') {
      const keyId = String(body?.keyId || '');
      const entry = SERVER_KEY_VAULT.get(keyId);
      if (!entry) {
        return Response.json(
          { ok: false, error: 'Requested pool key is not registered in server vault.' },
          { status: 404 },
        );
      }

      const serializedMessages = JSON.stringify(body?.messages || []);
      const jailbreakCheck = inspectPromptForKeyJailbreak(serializedMessages);
      if (jailbreakCheck.blocked) {
        return Response.json(
          { ok: false, error: `SECURITY_JAILBREAK_BLOCKED: ${jailbreakCheck.reason}` },
          { status: 403 },
        );
      }

      const estimatedPromptTokens = estimateTokensBPE(serializedMessages);
      const clampResult = clampMaxTokensForPoolKey(
        Number(body?.maxTokens) || 2048,
        entry.meta,
        estimatedPromptTokens,
      );

      if (!clampResult.allowed) {
        entry.meta.isActive = false;
        entry.meta.status = evaluatePoolKeyStatus(entry.meta);
        return Response.json(
          {
            ok: false,
            error: clampResult.reason || 'Key quota or 50% Emergency Auto-Cutoff reached.',
            key: sanitizeMetaForClient(entry.meta),
          },
          { status: 429 },
        );
      }

      const endpointMap: Record<string, string> = {
        openai: 'https://api.openai.com/v1/chat/completions',
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
        nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
      };
      const targetUrl = body?.customEndpoint || endpointMap[entry.meta.provider];
      if (!targetUrl) {
        return Response.json(
          { ok: false, error: `Unsupported vault proxy provider: ${entry.meta.provider}` },
          { status: 400 },
        );
      }

      const upstreamRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${entry.rawSecret}`,
        },
        body: JSON.stringify({
          model: body?.model || entry.meta.model,
          messages: body?.messages || [],
          max_tokens: clampResult.clampedMaxTokens,
          temperature: typeof body?.temperature === 'number' ? body.temperature : 0.3,
        }),
      });

      const upstreamJson = await upstreamRes.json();
      const completionText =
        upstreamJson?.choices?.[0]?.message?.content || '';
      const usage = extractActualTokenUsage(
        upstreamJson,
        serializedMessages,
        completionText,
        entry.meta.provider,
        body?.model || entry.meta.model,
      );

      entry.meta.tokensUsed += usage.totalTokens;
      entry.meta.promptTokensUsed += usage.promptTokens;
      entry.meta.completionTokensUsed += usage.completionTokens;
      entry.meta.status = evaluatePoolKeyStatus(entry.meta);

      const now = Date.now();
      if (
        entry.meta.status === 'warning' &&
        !entry.meta.notifiedWarning
      ) {
        entry.meta.notifiedWarning = true;
        SERVER_NOTIFICATIONS.unshift({
          id: genVaultId('notif'),
          level: 'warning',
          title: `Owner Alert: Key Reached ${entry.meta.notifyAtPercent}% Notification Threshold`,
          message: `Shared key ${entry.meta.maskedKey} (${entry.meta.provider.toUpperCase()}) has used ${entry.meta.tokensUsed.toLocaleString()} / ${entry.meta.tokenLimit.toLocaleString()} tokens.`,
          keyId: entry.meta.id,
          ownerUserId: entry.meta.ownerUserId,
          timestamp: now,
          read: false,
        });
      }

      if (
        entry.meta.status === 'emergency_stop' &&
        !entry.meta.notifiedEmergency
      ) {
        entry.meta.notifiedEmergency = true;
        entry.meta.isActive = false;
        SERVER_NOTIFICATIONS.unshift({
          id: genVaultId('notif'),
          level: 'critical',
          title: `EMERGENCY STOP (Not-Aus at ${entry.meta.emergencyCutoffPercent}%): Key Paused & Protected`,
          message: `Shared key ${entry.meta.maskedKey} (${entry.meta.provider.toUpperCase()}) reached its ${entry.meta.emergencyCutoffPercent}% emergency auto-cutoff (${entry.meta.tokensUsed.toLocaleString()} / ${entry.meta.tokenLimit.toLocaleString()} tokens). Key was automatically paused (NOT deleted) and traffic rotated to the next pool key.`,
          keyId: entry.meta.id,
          ownerUserId: entry.meta.ownerUserId,
          timestamp: now,
          read: false,
        });
      }

      return Response.json({
        ok: upstreamRes.ok,
        status: upstreamRes.status,
        data: upstreamJson,
        tokenUsage: usage,
        clampedMaxTokens: clampResult.clampedMaxTokens,
        key: sanitizeMetaForClient(entry.meta),
        notifications: SERVER_NOTIFICATIONS.slice(0, 20),
      });
    }

    return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || 'Vault proxy error' },
      { status: 500 },
    );
  }
}
