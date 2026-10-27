# Changelog

All notable changes, bug fixes, architectural improvements, and audits for **Dev0 (`AI_mega_Brain_rork`)** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.5.0] - 2026-10-27

### Added
- **Sandboxed User Workspaces & Optional Docker Container Backend (`utils/sandbox-workspace.ts`, `utils/sample-project.ts`, `app/api/sandbox+api.ts`, `Dockerfile.sandbox`, `docker-compose.sandbox.yml`, `providers/ProjectProvider.tsx`)**:
  - Replaced self-source project exposure (`studio-ide`) with isolated per-user IndexedDB/AsyncStorage workspaces (`dev0_sandbox_projects_v2_<userId>`) and an optional non-root Docker sandbox backend (`/api/sandbox`).
  - Added automatic self-source stripping (`sanitizeUserSandboxProjects`) so neither users nor AI tools can read or modify the host application's source code.
- **Zero-PII Google Sign-In, Owner Claim & 3-Tier RBAC in "AI for Free" (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`, `providers/AppProvider.tsx`)**:
  - Removed all hardcoded email addresses from the repository and added `maskEmailAddress` privacy protection.
  - Implemented 3-Tier RBAC: **Owner** (`canManageUsers: true`, `canViewUserChats: true`), **Admin** (`canManageUsers: true`, `canViewUserChats: false`), and **User** (`canManageUsers: false`, `canViewUserChats: false`).
  - Added Google Sign-In and Owner Passphrase Claim (`verifyOwnerClaimPassphrase`) directly in the "AI for Free" modal and Settings tab.
- **Real-Time Per-Chat Debug Telemetry & Automatic Free Pool Key Rotation (`utils/free-ai-pool.ts`, `providers/ChatProvider.tsx`, `components/FreeAIPoolModal.tsx`)**:
  - Initialized all token and request counters at `0` with zero fake numbers.
  - Recorded a verified `ChatDebugLogEntry` after every chat turn (latency in ms, exact API vs. BPE token source, prompt/completion/total tokens, tool calls, fallback, and pool key ID) and automatically rotated to the next active pool key upon reaching 100% of token or time quota.
- **Provider Model Catalog Search with Yellow Match Highlight & Local/LM Studio/Ollama Presets (`app/(tabs)/settings/index.tsx`, `types/index.ts`)**:
  - Added live model search across all providers that highlights matching model names and exact provider IDs in yellow (`#FACC15`) with a yellow match badge.
  - Added dedicated 1-tap presets and dynamic `/api/models` discovery for **LM Studio (`http://localhost:1234/v1`)**, **Ollama (`http://localhost:11434/v1`)**, and **Local OpenAI-Compatible (`http://localhost:8080/v1`)** endpoints under Custom Provider.
- **Hidden `.agents/<slug>/` Sub-Agent Workspaces, Mandatory `finish_task` Tool, Cron Jobs & Pause/Sleep Mode (`utils/subagent-workspace.ts`, `providers/ChatProvider.tsx`, `providers/AgentProvider.tsx`, `app/(tabs)/chat/index.tsx`)**:
  - Every Sub-Agent automatically maintains hidden English documentation files (`.agents/<slug>/README.md`, `RULES.md`, `STATUS.md`, `LOG.md`) hidden from the user file tree (`filterVisibleUserFiles`) and excluded via `.gitignore`.
  - Added `finish_task`, `create_cron_job`, `sleep_agent`, and `inspect_subagent_workspace` tools, plus an interactive **Sub-Agent Workflow, Cron & Pause Graph** card in ChatScreen.

### Fixed
- **Eliminated False-Positive `KI-Rückfragen offen (1)` Banner on Plain-Text Replies (`utils/subagent-question-relay.ts`, `providers/ChatProvider.tsx`)**:
  - Removed heuristic `detectSubAgentQuestionFromTurn` calls on normal plain-text assistant responses and required an explicit `ask_user_question` `toolCallId` in `hasExplicitQuestionToolCall`.

---

## [1.3.0] - 2026-10-27

### Added
- **Dedicated `ask_user_question` Tool & Sub-Agent Floating Question Window (`utils/subagent-question-relay.ts`, `components/SubAgentFloatingQuestionModal.tsx`, `utils/ai-service.ts`, `types/index.ts`)**:
  - Added the `ask_user_question` tool (`TOOL_DEFINITIONS` and `TOOL_REGISTRY`) for structured AI and Sub-Agent clarification questions.
  - Added `SubAgentFloatingQuestionModal` floating window that launches automatically when a question comes via/about a Sub-Agent, captures role, name, allowed file globs, and answers, relays all information back to the Main Creator Agent (`buildMainCreatorRelayPrompt`), and saves the Sub-Agent to the persistent Saved Sub-Agents list (`createSavedSubAgentFromQuestionResponse`).
- **Saved Sub-Agents Quick List in Chat & Agent Dashboard (`app/(tabs)/chat/index.tsx`, `components/MultiAgentUI.tsx`, `app/(tabs)/tools/index.tsx`)**:
  - Added a persistent Saved Sub-Agents bar in `ChatScreen` and a Saved Sub-Agents section in `AgentDashboard` so all saved Sub-Agents are immediately visible and launchable with one tap.
- **Expanded Unit & Integration Test Suite (`__tests__/utils/subagent-question-and-pool.test.ts`, `scripts/test-runner.js`)**:
  - Added automated tests verifying strict tool-only question detection, Sub-Agent floating question relay, saved Sub-Agent list persistence, and Free AI Key Pool multi-key quota rotation and user scoping.

### Fixed
- **Eliminated False-Positive `KI-Rückfragen offen / Überspringen & Direkt starten (Skip)` Banner (`providers/ChatProvider.tsx`, `utils/subagent-question-relay.ts`)**:
  - Replaced the naive plain-text `?` check in `hasPendingChatQuestions` with `hasExplicitQuestionToolCall`, ensuring the Skip banner only appears when the AI explicitly invokes `ask_user_question` (or when an `AgentPlan` is in `clarifying` status), never on normal conversational messages ending with `?`.
- **Netlify & GitHub Actions Build Hardening (`.npmrc`, `netlify.toml`, `package.json`, `.github/workflows/lint.yml`)**:
  - Added `.npmrc` (`legacy-peer-deps=true`, `engine-strict=false`), configured `NODE_VERSION = "20"`, `node_bundler = "esbuild"`, and `status = 200` redirects in `netlify.toml`, and ensured `npm run export-web` / `npm run build` always execute `node scripts/patch-modules.js` prior to `expo export -p web`.

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
  - Zero-config local DB (`IndexedDB` + `AsyncStorage`) supports Owner & Admin user governance with user timeouts, suspensions, token quota management, and chat moderation.
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
