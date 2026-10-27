# Technical Audit & Verification Report (2026-10-27)

## 1. Executive Summary
This audit investigated four high-priority issues reported in the **ZeroProCode IDE (`AI_mega_Brain_rork`)** application:
1. **HTTP 400 `thoughtSignature` API Failure in AI Chat** when invoking tools (specifically `default_api:get_active_tools`) with Gemini 2.5 / 3 thinking models.
2. **Dashboard Sub-Tab Navigation Lock ("Dashboard Schrottet alles kein Zurück auf andere Tabs")** preventing users from leaving the Agent Dashboard once opened via route parameters (`?tab=dashboard`).
3. **Dev Server Port 3000 Startup & Web Compatibility Issues**, including missing `"dev"` scripts and unguarded native `WebView` usage on Web (`SponsorBanner.tsx`) as well as iOS-only `Alert.prompt` / multi-button `Alert.alert` dialogs.
4. **Repository Hygiene & Static Analysis**, including leftover `.orig`/`.rej`/`.patch` artifacts and integration of modern fast linters (`@biomejs/biome`, `oxlint`).

---

## 2. Root-Cause Analysis & Implemented Remediations

### 2.1 Finding A — HTTP 400 `Function call is missing a thought_signature in functionCall parts`
- **Symptom**: After executing a tool call (`get_active_tools`), the subsequent turn failed with:
  `Fehler (400): [{"error": {"code": 400, "message": "Function call is missing a thought_signature in functionCall parts. This is required for tools to work correctly, and missing thought_signature may lead to degraded model performance. Additional data, function call default_api:get_active_tools , pos 0."}}]`
- **Root Cause**:
  1. Gemini 2.5 Flash/Pro and Gemini 3 Flash/Pro thinking models attach a cryptographic `thoughtSignature` (on native Gemini `functionCall` parts) or `extra_content.google.thought_signature` / `thought_signature` (on OpenAI/OpenRouter-compatible `tool_calls` payloads).
  2. When the conversation history was serialized for the follow-up turn after tool execution, `formatMessagesForGemini` and `formatMessagesForOpenAI` in `utils/ai-service.ts`, as well as `compressAndSanitizeMessagesForAPI` in `utils/chat-compression.ts`, stripped `thoughtSignature` and `extra_content`.
  3. Additionally, `get_active_tools` was defined in `IDE_TOOLS` (`utils/ai-service.ts`) but omitted from `rorkTools` in `providers/ChatProvider.tsx`.
- **Remediation**:
  - Added `thoughtSignature?: string` and `extra_content?: Record<string, any>` to `ToolCall` in `types/index.ts`.
  - Preserved `thoughtSignature` and `extra_content` end-to-end across `callOpenAI`, `callOpenRouter`, `callGemini`, `extractNativeToolCalls`, `compressAndSanitizeMessagesForAPI`, `ChatProvider.tsx`, and `AgentProvider.tsx`.
  - Added a self-healing fallback (`isThoughtSignatureError` + `flattenUnsignedToolCalls`): if any historical or cross-provider tool call lacks a valid signature or triggers an HTTP 400 `thought_signature` error, `callGemini`, `callOpenAI`, and `callOpenRouter` automatically retry the request with historical tool calls flattened into structured text transcripts.

### 2.2 Finding B — Agent Dashboard Navigation Lock
- **Symptom**: Navigating to the Agent Dashboard from AI Chat (`router.push('/(tabs)/tools?tab=dashboard')`) locked the user into the Dashboard view. Tapping `Tools`, `Plans`, `Memos`, or `Search` immediately snapped back to `Dashboard`.
- **Root Cause**:
  - In `app/(tabs)/tools/index.tsx`, the `useEffect` hook depended on `[params.tab, activeTab]`:
    ```ts
    useEffect(() => {
      if (params.tab === 'dashboard' && activeTab !== 'dashboard') {
        setActiveTab('dashboard');
      }
    }, [params.tab, activeTab]);
    ```
  - Because `setActiveTab('tools')` changed `activeTab` without clearing `params.tab === 'dashboard'`, the effect immediately re-ran and forced `activeTab` back to `'dashboard'`.
- **Remediation**:
  - Removed `activeTab` from the `useEffect` dependency array so route param synchronization only runs when `params.tab` changes.
  - Added `handleSelectTab(tabId)` in `ToolsScreen` that updates both local state (`setActiveTab`) and URL parameters (`router.setParams({ tab: resolvedTab })`).
  - Added a persistent **Quick-Return Navigation Bar** at the top of `AgentDashboard` (`components/MultiAgentUI.tsx`) with direct 1-click buttons for `Tools Registry`, `Plans`, `AI Chat`, and `Projects`.

### 2.3 Finding C — Cross-Platform UI, `/api/chat` Header Sanitization & Web Compatibility
- **Symptom**:
  - Browser reported `A network error occurred.` when `/api/chat` forwarded upstream `content-encoding: br` / `content-encoding: none` headers on already-decompressed Node `fetch` bodies, or when loading cold un-warmed 13.5 MB Metro bundles.
  - Long-press file actions on `ProjectsScreen` did not work reliably on Web/desktop, and `Alert.prompt` (used for file renaming) is iOS-only.
  - `SponsorBanner.tsx` rendered an unguarded `react-native-webview` `WebView` for its GitHub Sponsor button embed, which is unsupported on `react-native-web`.
- **Remediation**:
  - Sanitized response headers in `app/api/chat+api.ts` (stripping `content-encoding`, `content-length`, and hop-by-hop headers) and unified Web `'rork'` chat calls onto `callAI` in `providers/ChatProvider.tsx`.
  - Removed Rork telemetry/console-error wrapper injection from `metro.config.js`, added an HMR-disabled guard in `scripts/patch-modules.js`, and optimized `lucide-react-native` ESM exports (reducing bundle size from 13.5 MB to 9.4 MB).
  - Replaced `Alert.alert` and `Alert.prompt` in `app/(tabs)/(home)/index.tsx`, `app/editor.tsx`, and `app/(tabs)/tools/index.tsx` with cross-platform React Native `Modal` components.
  - Added a visible `MoreHorizontal` (`•••`) action button to `components/FileTreeItem.tsx` with `minWidth: 36, minHeight: 36` hit targets.
  - Upgraded header buttons and sub-tab navigation pills to $\ge 40\text{–}44\text{px}$ touch targets.
  - Added `SponsorButtonEmbed` in `components/SponsorBanner.tsx` with a clean Web button fallback (`Platform.OS === 'web'`).

### 2.4 Finding D — Linter Suite & Repository Cleanup
- **Remediation**:
  - Installed `@biomejs/biome` and `oxlint` and configured `biome.json` and `.eslintrc.js`.
  - Removed 14 obsolete `.orig`, `.rej`, `.patch`, and scratch test files from the workspace root and `providers/` / `utils/`.

---

## 3. Verification Matrix

| Check | Command | Result |
| :--- | :--- | :--- |
| TypeScript Typecheck | `npx tsc --noEmit` | **PASS (0 errors)** |
| Jest Unit & Integration Suite | `npm test` | **PASS (All test suites passed)** |
| Oxlint Static Analysis | `npm run lint:oxlint` | **PASS (0 errors)** |
| Biome Static Analysis | `npm run lint:biome` | **PASS (0 errors)** |
| ESLint Expo Rules | `npm run lint` | **PASS (0 errors)** |
| Web Dev Server (Port 3000) | `npm run dev` | **PASS (`http://localhost:3000`)** |

---

## 4. Phase 2 Architecture Upgrade (v1.2.0 — Synapse Graph, Free AI Key Pool & Local LLM Parser)

### 4.1 Synapse Memory Graph & Ego-Graph Code Localization (`utils/synapse-graph.ts`, `components/SynapseGraphView.tsx`)
- **Problem**: Agents burned excessive tokens by calling `get_project_tree` and reading entire files sequentially to locate function definitions and callers.
- **Solution**: Implemented an AST/regex RepoGraph + LocAgent indexer (`buildSynapseGraph`) that maps files, exported functions/components/hooks/classes, imports, function calls, persistent memories (`MemoEntry`), and YAML skills (`ParsedYamlSkill`) into an interactive 2D neural synapse canvas (`SynapseGraphView`) in the Projects screen, plus the `localize_code_graph` tool for 2-hop ego-subgraph retrieval.

### 4.2 3-Tier Hybrid ReAct / XML / JSON Tool Parser (`utils/ai-service.ts`)
- **Problem**: Local and open-weight models (Ollama, LM Studio, Qwen, DeepSeek, Llama) often emit `<tool_call>`, `<tool>...</tool><args>...</args>`, or `Action: / Action Input:` blocks instead of native OpenAI `tool_calls`.
- **Solution**: Implemented `parseToolCallsFromText` and `repairAndParseJSON` supporting all 3 tiers automatically whenever native `tool_calls` are absent.

### 4.3 "AI for Free" Shared Key Pool, Real BPE Token Reader & Zero-Config Admin Governance (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`)
- **Problem**: Users needed a zero-config way to share API keys with token/time limits and target `User ID` scoping without exposing raw keys, alongside real token accounting and First-User (`ggjonasgameryt@gmail.com`) Super Admin governance.
- **Solution**: Built `FreeAIPoolModal` and `utils/free-ai-pool.ts` with `IndexedDB` + `AsyncStorage` persistence, secret obfuscation + masking (`gsk_••••••••••••9a1f`), exact API `usage`/`usageMetadata` + cl100k BPE token counting (`estimateTokensBPE`), 80% quota warnings, automatic key rotation, and Super Admin user management.

### 4.4 Deprecated SDK Removal, `/api/models` Proxy & WebAssembly Preview (`providers/ChatProvider.tsx`, `app/api/models+api.ts`, `components/HTMLPreview.tsx`)
- **Solution**: Removed deprecated `createRorkTool` and `useRorkAgent` calls from `ChatProvider.tsx`, added `/api/models` to prevent CORS `NetworkError` on custom model endpoints, and upgraded `HTMLPreview.tsx` with Web `<iframe srcDoc>` + `window.runWasmBytes` WebAssembly support.

