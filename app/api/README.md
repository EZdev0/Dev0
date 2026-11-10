# 🔒 Server-Side API Routes (`app/api/README.md`) — EN / DE (v1.9)

🇬🇧 **English** | 🇩🇪 **Deutsch (unten)** · [⬅ Main README](../../README.md) · [🌐 Master Concept](../../docs/MASTER_CONCEPT.md)

---

## 🇬🇧 English Overview

This directory contains Expo server-side API routes powering CORS-safe streaming, the Server Key Vault, isolated Docker sandboxes, and keyless web grounding:

| Route File | Endpoint | Purpose |
| :--- | :--- | :--- |
| **`chat+api.ts`** | `POST /api/chat` | Proxies AI chat requests with header sanitization and keyless Pollinations fallback. |
| **`pool+api.ts`** | `GET/POST /api/pool` | **Server-Only Key Vault Proxy:** Stores shared API keys server-side, blocks prompt-injection jailbreaks, clamps `max_tokens`, and enforces the `40%` warning / `50%` Emergency Auto-Cutoff (*Not-Aus*) without deleting keys. |
| **`sandbox+api.ts`** | `POST /api/sandbox` | Isolated per-user workspace filesystem and Dual Git commit backend (`/workspace/sandboxes/<userId>`). |
| **`models+api.ts`** | `GET/POST /api/models` | Server-side proxy for discovering `/v1/models` from OpenRouter, Ollama (`11434`), LM Studio (`1234`), and custom OpenAI-compatible endpoints without browser CORS errors. |
| **`search+api.ts`** | `GET/POST /api/search` | Server-side keyless web search proxy supporting the 4-stage `web_search` cascade. |
| **`fetch+api.ts`** | `GET/POST /api/fetch` | Server-side keyless web page reader supporting the 3-stage `web_fetch` cascade. |

---

## 🇩🇪 Deutsche Übersicht

Dieses Verzeichnis enthält die serverseitigen Expo-API-Routen für CORS-freies Streaming, den Server-Key-Tresor, Docker-Sandboxes und die schlüssellose Websuche:

- **`chat+api.ts` (`/api/chat`)**: Leitet KI-Anfragen mit bereinigten Headern und Keyless-Fallback weiter.
- **`pool+api.ts` (`/api/pool`)**: **Server-Only Key-Tresor** mit Anti-Jailbreak-Prüfung, harter `max_tokens`-Begrenzung, `40-%`-Warnung und automatischem **`50-%`-Not-Aus ohne Löschen von Schlüsseln**.
- **`sandbox+api.ts` (`/api/sandbox`)**: Isoliertes Pro-Benutzer-Dateisystem und Dual-Git-Commit-Backend.
- **`models+api.ts` (`/api/models`)**: CORS-sicherer Proxy zum Abrufen von `/v1/models` für OpenRouter, Ollama, LM Studio und eigene Server.
- **`search+api.ts` & `fetch+api.ts`**: Serverseitige Endpunkte für die Keyless-`web_search`- und `web_fetch`-Kaskaden.
