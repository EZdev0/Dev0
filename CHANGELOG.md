# Changelog

All notable changes, bug fixes, architectural improvements, and audits for **ZeroProCode IDE (`AI_mega_Brain_rork`)** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.2.0] - 2026-10-27

### Added
- **Interactive Synapse Memory Graph & Code Localization (`utils/synapse-graph.ts`, `components/SynapseGraphView.tsx`, `app/(tabs)/(home)/index.tsx`)**:
  - Inspired by *RepoGraph* (ICLR 2025) and *LocAgent* (ACL 2025), indexes all project files, exported functions/components/hooks/classes, import edges, call-graph relationships, persistent memories (`MemoEntry`), and YAML skills (`ParsedYamlSkill`) into an interactive 2D neural synapse network.
  - Integrated into the **Projects** screen (`Synapse Graph` vs. `Files` toggle) and renders a zero-project creation state when no project is open.
  - Added the `localize_code_graph` AI tool (`utils/ai-service.ts`, `ChatProvider.tsx`, `AgentProvider.tsx`) so agents can retrieve a 2-hop ego-subgraph of relevant files, callers/callees, and code snippets instead of reading entire files.
- **3-Tier Hybrid ReAct / XML / JSON Tool Parser (`utils/ai-service.ts`)**:
  - Added `parseToolCallsFromText` and `repairAndParseJSON` supporting Tier 1 (` ```tool ` / ` ```json ` fenced blocks), Tier 2 (`<tool_call>`, `<function_call>`, `<tool>...</tool><args>...</args>` XML tags), and Tier 3 (`Action:` / `Action Input:` ReAct blocks) for local models (Ollama, LM Studio, vLLM, Qwen, DeepSeek, Llama).
- **YAML Frontmatter Skill Loader & Custom Sub-Agent Studio (`utils/skill-loader.ts`, `components/SubAgentStudioModal.tsx`)**:
  - Parses YAML frontmatter (`name`, `description`, `trigger`, `alwaysApply`, `allowedTools`, `allowedFiles`) from `.qoder/rules/*.md`, `.agents/*.md`, and project files.
  - Added `SubAgentStudioModal` to create, edit, and run custom Sub-Agent templates (`CustomSubAgentTemplate`) with scoped file glob enforcement (`isFileAllowedForSubAgent`) and callable via the `sub_agent` tool.
- **"AI for Free" Shared Key Pool, Real BPE Token Reader & Zero-Config Admin Governance (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`, `providers/AppProvider.tsx`)**:
  - Added floating **"AI for Free"** modal accessible from Settings and Tools.
  - Users can share keys to the pool with **Token Limits** and/or **Time Limits**, optionally scoped to a specific `User ID` (`*` or `usr_...`). Raw keys are encrypted at rest (`encodePoolSecret`) and masked (`gsk_••••••••••••9a1f`) so no other user can ever view the secret key.
  - Added `extractActualTokenUsage` + `estimateTokensBPE` (cl100k BPE subword tokenizer) for real token accounting, automatic 80% quota warnings, and zero-downtime key rotation when quotas or time limits expire.
  - Zero-config local DB (`IndexedDB` + `AsyncStorage`) promotes the first user (`ggjonasgameryt@gmail.com`) to `Super Admin` with user timeouts, suspensions, token quota management, and chat moderation.
- **CORS-Safe Custom Models Proxy & WebAssembly HTML Preview (`app/api/models+api.ts`, `components/HTMLPreview.tsx`, `types/index.ts`)**:
  - Added `/api/models` server proxy so custom OpenAI-compatible endpoints never fail with `NetworkError when attempting to fetch resource`.
  - Upgraded `HTMLPreview.tsx` with a cross-platform Web `<iframe srcDoc>` + native `WebView`, viewport switcher (`Mobile`, `Tablet`, `Desktop`), live console drawer, and `window.runWasmBytes` WebAssembly execution helper.
  - Added active 2026 Gemini models (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`).
- **Root-Cause Bug Documentation (`bugs/README.md`, `bugs/BUG_01_*.md`, `bugs/BUG_02_*.md`, `bugs/BUG_03_*.md`)**:
  - Documented all diagnosed bugs, token burn causes, SDK deprecations, CORS model errors, and architectural fixes in English.

### Fixed
- **Eliminated `@rork-ai/toolkit-sdk` Deprecation Warnings (`providers/ChatProvider.tsx`)**:
  - Removed deprecated `createRorkTool` and `useRorkAgent` invocations and unified all providers onto the resilient `callAI` pipeline.

---

## [1.1.0] - 2026-10-27

### Fixed
- **Gemini / OpenRouter / OpenAI `thoughtSignature` HTTP 400 Error (`utils/ai-service.ts`, `utils/chat-compression.ts`, `providers/ChatProvider.tsx`, `providers/AgentProvider.tsx`, `types/index.ts`)**:
  - Resolved `HTTP 400: Function call is missing a thought_signature in functionCall parts (default_api:get_active_tools)` returned by Gemini 2.5 / 3 thinking models.
  - Extended `ToolCall` interface with `thoughtSignature?: string` and `extra_content?: Record<string, any>`.
  - Preserved `thoughtSignature` and `extra_content.google.thought_signature` across `callOpenAI`, `callOpenRouter`, `callGemini`, `extractNativeToolCalls`, `compressAndSanitizeMessagesForAPI`, `ChatProvider`, and `AgentProvider`.
  - Registered `get_active_tools` in `ChatProvider` Rork SDK tool definitions for parity with direct API tool schemas.
  - Implemented automatic self-healing fallback (`isThoughtSignatureError` + `flattenUnsignedToolCalls`) that retries failed requests in-place by serializing legacy or unsigned historical tool calls into structured text context.
- **Dashboard Tab-Lock Bug (`app/(tabs)/tools/index.tsx`, `components/MultiAgentUI.tsx`)**:
  - Fixed the `useEffect` dependency loop in `ToolsScreen` (`[params.tab, activeTab]`) that repeatedly forced `activeTab` back to `'dashboard'` whenever the user clicked `Tools`, `Plans`, `Memos`, or `Search` while `?tab=dashboard` remained in route params.
  - Added `handleSelectTab` in `ToolsScreen` to synchronize `router.setParams({ tab: resolvedTab })` on sub-tab selection.
  - Added a persistent **Quick-Return Navigation Bar** (`Tools Registry`, `Plans`, `AI Chat`, `Projects`) at the top of `AgentDashboard` so users can immediately switch views or tabs from inside the multi-agent dashboard.
- **Web Dev Server, `/api/chat` Content-Encoding Fix & Bundle Optimization (`package.json`, `app/api/chat+api.ts`, `metro.config.js`, `scripts/patch-modules.js`, `components/SponsorBanner.tsx`)**:
  - Added `"dev": "expo start --web --port 3000"` and `"build": "expo export -p web"` scripts to `package.json` for AI Studio preview compatibility on port 3000.
  - Stripped upstream `content-encoding: br` / `content-encoding: none` and hop-by-hop headers in `app/api/chat+api.ts` so decompressed proxy payloads do not trigger `ERR_CONTENT_DECODING_FAILED` (`A network error occurred.`) in browsers over HTTP/2.
  - Routed Web AI Chat `'rork'` requests through the unified `callAI` loop (`providers/ChatProvider.tsx`) and removed telemetry/error-hijacking wrapper injection in `metro.config.js`.
  - Patched `expo/src/async-require/hmr.ts` and tree-shook `lucide-react-native` ESM exports in `scripts/patch-modules.js` (reducing Web bundle size by ~4 MB) and pre-warmed the Metro server.
  - Added `SponsorButtonEmbed` with a `Platform.OS === 'web'` fallback button in `SponsorBanner.tsx` so Web builds do not fail on native `react-native-webview` iframes.
- **Cross-Platform Modals & Context Menus (`app/(tabs)/(home)/index.tsx`, `components/FileTreeItem.tsx`, `app/editor.tsx`, `app/(tabs)/tools/index.tsx`)**:
  - Replaced `Alert.alert` and iOS-only `Alert.prompt` calls with cross-platform React Native `Modal` dialogs for file/folder actions, renaming, deletion confirmation, unsaved editor changes, and system notices.
  - Added an explicit `MoreHorizontal` (`•••`) button on every `FileTreeItem` row so Web and desktop users can trigger file/folder actions without relying on mobile long-press gestures.
  - Enforced $\ge 40\text{–}44\text{px}$ touch targets across header actions, sub-tabs, and tool cards.

### Added
- **Modern Linter Suite (`biome.json`, `package.json`)**:
  - Installed and configured `@biomejs/biome` and `oxlint` alongside ESLint and TypeScript (`npm run lint:biome`, `npm run lint:oxlint`, `npm run lint:all`, `npm run typecheck`).
- **Automated Unit Tests (`__tests__/utils/chat-compression.test.ts`)**:
  - Added unit tests covering `thoughtSignature` and `extra_content` preservation in `compressAndSanitizeMessagesForAPI`, `formatMessagesForOpenAI`, `formatMessagesForGemini`, and `isThoughtSignatureError`.
- **Technical Audit & Documentation (`docs/AUDIT_REPORT.md`, `CHANGELOG.md`, `.qoder/rules/lessons_learned.md`, `AGENTS.md`)**:
  - Documented root causes, architectural fixes, linter audit results, and lessons learned.

### Removed
- Cleaned up 14 leftover patch, backup, and scratch files (`providers/ChatProvider.tsx.orig`, `providers/ChatProvider.tsx.rej`, `utils/ai-service.ts.orig`, `fix-*.patch`, `patch_chat_provider*`, `test-*.ts`, `fix-url.ts`).
