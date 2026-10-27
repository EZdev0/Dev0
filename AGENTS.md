# 🧠 AI Mega Brain Workspace (Root DOX Contract)

## Purpose
This document establishes the binding DOX work contract for `d:\AI_mega_Brain_rork`. The workspace hosts a modern, cross-platform React Native / Expo SDK 54 AI application integrating multi-agent reasoning, interactive chat interfaces, edge API proxying, and cross-session Persistent Memory recall.

## Ownership
- **Scope:** Root directory and all underlying subtrees.
- **Authority:** Controls repo-wide workflows, tool integrations, quality standards, and persistent memory directives.

---

## Local Contracts

### 1. Mandatory Persistent Memory & Inception Protocol (CRITICAL)
Before designing plans, writing code, or answering complex user tasks, every agent MUST execute the Inception Protocol:
1. **Load Active Rules:** Call `get_user_profile()` via the Persistent Memory MCP tool to inspect active engineering rules and user constraints.
2. **Historical BM25 Recall:** Call `search_past_memory(query)` using precise technical keywords (e.g., `expo`, `build`, `cors`, `git`, `metro`) to identify prior solutions across conversations.
3. **Grounding:** Explicitly ground solutions in verified historical memory rather than speculating.
4. **Keep Memory Synchronized:** Proactively update rules and lessons via `/learn` whenever durable corrections or new patterns occur.

### 2. Strict Version Control & Feature Branch Isolation
- **NEVER push directly to the `main` branch under any circumstances.**
- Always create an isolated feature branch (`feat/...`, `fix/...`) for each distinct user request.
- Push the branch to remote and provide a complete, copy-pasteable Pull Request template in English:
  - **PR Title:** Semantic title (e.g. `feat(memory): ...`)
  - **Summary:** Clear explanation of purpose and problem solved.
  - **Key Changes:** Bulleted breakdown of modified components and files.
  - **Verification:** Concrete proof of automated tests (`npm test`, `tsc`, `lint`).
  - **PR Link:** Direct clickable GitHub PR comparison link.

### 3. Bilingual Communication Protocol
- **Conversational Chat:** Exclusively in German (**Ausschließlich Deutsch**).
- **Technical Artifacts:** All code, comments, commit messages, PR descriptions, and markdown documentation files MUST strictly be written in **English**.

### 4. Security & Credential Protection
- NEVER store access tokens, refresh tokens, passwords, or API keys in plaintext.
- Always use OS-native secure encryption (e.g., Electron `safeStorage.encryptString()`) or environment variables.
- Strictly sanitize external URLs (`http:` / `https:` only) and IPC channels.

### 5. Localhost & Server Visibility
- Whenever starting any local development server, API service, or preview worker, ALWAYS output the clickable localhost URL (e.g., `http://localhost:8081` or `http://localhost:55689`) immediately in the chat response.

### 6. Environment & CI/CD Safety Guardrails
- **Windows Runner Compatibility:** NEVER use `shell: bash` for GitHub Actions or Gitea workflows running on Windows (`runs-on: windows`). Always use PowerShell (`shell: pwsh`).
- **Non-blocking CI Audits:** Use the native Actions directive `continue-on-error: true` directly on individual steps when non-blocking audits are required.
- **Subagent Recursion Limit:** Enforce a strict depth limit of 1 (depth <= 1; no nested subagents) to save tokens and prevent recursion loops.

---

## Work Guidance

### Architecture Overview
- **Framework:** Expo SDK 54 (`expo@54.x`, `expo-router@6.x`, `react-native@0.81.x`).
- **Web Export & Netlify Functions:** Routed via `scripts/patch-modules.js` to provide compatibility shims for internal Expo Router paths (`expo-router/internal/static`, `expo-router/internal/routing`) on CI.
- **Multi-Agent Runtime:** Orchestrated via `providers/AgentProvider.tsx` and `providers/ChatProvider.tsx`.

### Persistent Memory Plugin Architecture
- **Database Engine:** SQLite database located at `~/.gemini/config/plugins/persistent-memory-plugin/memory.db`.
- **FTS5 Full-Text Search:** Uses BM25 ranking across 21,600+ indexed messages with real-time database triggers (`AFTER INSERT`, `AFTER DELETE`, `AFTER UPDATE`).
- **Concurrency & Resilience:** Configured with `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;` to ensure non-blocking concurrent reads and writes across background hooks, MCP servers, and sidecars.
- **Lifecycle Hooks:**
  - `PreInvocation`: Runs `scripts/proactive_memory.py` to inject subconscious past context before prompt evaluation.
  - `Stop`: Runs `scripts/harness.py update` to incrementally ingest new conversation transcripts into the SQLite FTS5 database.
- **Sidecar Dashboard:** Accessible locally via `sidecars/memory-dashboard/dashboard_server.py` on port `55689` or `ANTIGRAVITY_SIDECAR_WEB_PORT` with real-time search, stats, and rule management.

---

## Verification
Every code or rule change must be validated against the following checks:
1. **Type Checking:** `npx tsc --noEmit` (must exit with 0 errors).
2. **Automated Tests:** `npm test` (all unit and integration tests must pass).
3. **Memory Integrity:** Query `get_user_profile()` via MCP to verify active rule alignment.
4. **Build Integrity:** `npm run export-web` (must successfully bundle static and API routes).

---

## Child DOX Index
- [`.agent/rules/`](file:///d:/AI_mega_Brain_rork/.agent/rules/RULES.md) - Project-level rules, user profile preferences, and error memory log.
- [`app/`](file:///d:/AI_mega_Brain_rork/app) - File-based routing, screen containers, and layout wrappers.
- [`components/`](file:///d:/AI_mega_Brain_rork/components) - Reusable UI widgets, animated Task cards, and Thinking blocks.
- [`providers/`](file:///d:/AI_mega_Brain_rork/providers) - State providers, AI service bridges, and multi-agent coordination.
- [`scripts/`](file:///d:/AI_mega_Brain_rork/scripts) - Build patching, CI export shims, and postinstall hooks.

---

## AI Resilience, Keyless Web Tools & Privacy Guards (2026-10-18)
- **Resilient AI Fallback (`utils/ai-service.ts`, `app/api/chat+api.ts`, `utils/chat-compression.ts`):**
  - Guarantees non-empty model resolution (`resolveDefaultModel`), pre-API context compression (`compressAndSanitizeMessagesForAPI`), and tool output truncation (`MAX_TOOL_RESULT_LENGTH = 6000`).
  - Performs 2x exponential backoff retries on `toolkit.rork.com` and seamlessly falls back in-place to keyless `https://text.pollinations.ai/openai` (`model: 'openai'`).
- **Keyless Web Search & Fetch (`utils/web-tools.ts`, `app/api/search+api.ts`, `app/api/fetch+api.ts`):**
  - 4-stage keyless `web_search` cascade (Jina Reader + DDG Lite → Pollinations `searchgpt` → Wikipedia DE/EN + DDG Instant Answer → AllOrigins/CodeTabs CORS proxies) orchestrated by `runSubAISearchAgent`.
  - 3-stage keyless `web_fetch` cascade (Jina Reader → `/api/fetch` + direct fetch → rotating CORS proxies with `cleanHtml` and 6,000-char cap).
- **Skip Clarification & 3-Layer Learn Guard:**
  - Prominent **"Überspringen & Direkt starten (Skip)"** button in `AgentPlanView`, `MultiAgentUI`, and `ChatScreen` immediately starts execution with `SKIP_QUESTIONS_INSTRUCTION`.
  - 3-layer guard (`isLearningEnabled`, `LEARNING_TOOL_NAMES`, `setMemoSystemEnabled`) hides Learn/Memo tools in UI, strips them from system/planner prompts and tool schemas, and blocks runtime execution when disabled.

---

## ThoughtSignature Resilience, Dashboard Navigation & Linter Suite (2026-10-27)
- **Gemini / OpenRouter `thoughtSignature` Preservation & Self-Healing (`utils/ai-service.ts`, `utils/chat-compression.ts`, `types/index.ts`):**
  - Preserves `thoughtSignature` and `extra_content.google.thought_signature` across all tool call lifecycles (`callOpenAI`, `callOpenRouter`, `callGemini`, `compressAndSanitizeMessagesForAPI`, `ChatProvider`, `AgentProvider`).
  - Automatically detects `HTTP 400` missing `thought_signature` errors (`isThoughtSignatureError`) and retries in-place with unsigned historical tool calls flattened into structured text context (`flattenUnsignedToolCalls`).
- **Unblocked Sub-Tab Navigation & Cross-Platform Modals (`app/(tabs)/tools/index.tsx`, `components/MultiAgentUI.tsx`, `app/(tabs)/(home)/index.tsx`, `app/editor.tsx`, `components/FileTreeItem.tsx`):**
  - Syncs route parameters via `router.setParams({ tab })` without locking `activeTab` to `dashboard`, and provides a persistent Quick-Return Navigation Bar inside `AgentDashboard`.
  - Replaces `Alert.alert` and `Alert.prompt` with cross-platform `Modal` dialogs and explicit `•••` context menu buttons (`MoreHorizontal`) with $\ge 40\text{–}44\text{px}$ touch targets.
- **Static Analysis & Audit Documentation (`biome.json`, `.eslintrc.js`, `CHANGELOG.md`, `docs/AUDIT_REPORT.md`):**
  - Integrates `@biomejs/biome` (`npm run lint:biome`), `oxlint` (`npm run lint:oxlint`), ESLint (`npm run lint`), and TypeScript (`npm run typecheck`).

---

## Synapse Memory Graph, Free AI Key Pool, YAML Skill Loader & 3-Tier Parser (v1.2.0)
- **Synapse Memory Graph & Code Localization (`utils/synapse-graph.ts`, `components/SynapseGraphView.tsx`, `app/(tabs)/(home)/index.tsx`):**
  - Indexes project files, exported functions/components/hooks/classes, imports, function calls, persistent memories (`MemoEntry`), and YAML skills (`ParsedYamlSkill`) into an interactive 2D synapse graph with ego-subgraph code localization (`localize_code_graph`).
- **3-Tier Hybrid ReAct / XML / JSON Tool Parser (`utils/ai-service.ts`):**
  - Enables local models (Ollama, LM Studio, custom endpoints) and open-weight models to reliably invoke tools via fenced JSON blocks, XML `<tool_call>`/`<tool>` tags, or ReAct `Action:` / `Action Input:` blocks with automatic JSON repair (`repairAndParseJSON`).
- **YAML Skill Loader & Scoped Sub-Agent Studio (`utils/skill-loader.ts`, `components/SubAgentStudioModal.tsx`):**
  - Automatically parses YAML frontmatter (`--- ... ---`) from `.qoder/rules/*`, `.agents/*`, and project files, and provides a visual builder for custom Sub-Agent templates with glob file-scope enforcement (`isFileAllowedForSubAgent`).
- **"AI for Free" Shared Key Pool & Zero-Config Admin Governance (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`, `providers/AppProvider.tsx`):**
  - Supports masked API key sharing with token/time limits and target `User ID` scoping, real API + BPE token accounting (`extractActualTokenUsage`, `estimateTokensBPE`), 80% quota warnings, automatic key rotation, and First-User (`ggjonasgameryt@gmail.com`) Super Admin user governance persisted via `IndexedDB` + `AsyncStorage`.
- **Root-Cause Bug Documentation (`bugs/*.md`) & CORS-Safe `/api/models` Proxy (`app/api/models+api.ts`, `components/HTMLPreview.tsx`):**
  - Eliminates `@rork-ai/toolkit-sdk` deprecation warnings, proxies custom `/v1/models` requests server-side, and enables WebAssembly (`window.runWasmBytes`) inside `HTMLPreview.tsx`.

