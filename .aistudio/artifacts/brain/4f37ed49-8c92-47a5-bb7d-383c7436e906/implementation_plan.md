# Implementation Plan: Dev Server Port 3000 Fix, HTTP 400 `thoughtSignature` Recovery, Dashboard Navigation Fix, UI Polish & Modern Linter Suite

## 1. Executive Summary & Root Cause Analysis

Following a deep codebase audit and review of your screenshot (`Screenshot_20261027_011127_Chrome_Beta_50e4e010.jpg`), four core technical defects were identified and will be resolved in this plan:

1. **Dev Server Not Starting on Port 3000 (`package.json`, `components/SponsorBanner.tsx`)**
   - **Root Cause**: The runtime environment expects a `"dev"` script serving the web bundle on port `3000`, whereas `package.json` only defines `"start": "expo start"` and `"start-web": "expo start --web"` without a port binding or `"dev"` script. In addition, `components/SponsorBanner.tsx` mounts a native `react-native-webview` `<WebView>` unconditionally, which crashes or fails to render on Expo Web (`Platform.OS === 'web'`).
   - **Solution**: Configure `"dev": "expo start --web --port 3000"` and `"start": "expo start --web --port 3000"` in `package.json`, ensure Metro Web dependencies and shims (`scripts/patch-modules.js`) are cleanly applied, and make `SponsorBanner.tsx` Web-safe.

2. **HTTP 400 `thoughtSignature` Error on Multi-Turn Tool Calls (`utils/ai-service.ts`, `types/index.ts`, `providers/ChatProvider.tsx`, `providers/AgentProvider.tsx`)**
   - **Root Cause**: When Gemini 2.5 / 3 thinking models (called either directly via `callGemini` or through OpenAI-compatible proxies in `callOpenAI` / `callOpenRouter` / `callRork` / `callPollinationsFallback`) invoke a tool on Turn 1 (such as `get_active_tools`), the response includes a cryptographic `thoughtSignature` (or `thought_signature` / `extra_content.google.thought_signature`) inside the `functionCall` / `tool_calls` payload. When the app executes the tool and sends Turn 2 back to the API with the tool result, `callGemini` and `callOpenAI` currently strip `thoughtSignature` and `extra_content`. The upstream API rejects Turn 2 with:
     `Fehler (400): Function call is missing a thoughtsignature in functionCall parts. This is required for tools to work correctly... function call default_api:get_active_tools`
   - **Solution**:
     - Preserve `thoughtSignature` and `extra_content` on `ToolCall` across `types/index.ts`, `utils/ai-service.ts`, `utils/chat-compression.ts`, `providers/ChatProvider.tsx`, and `providers/AgentProvider.tsx`.
     - Echo `thoughtSignature` back in `formatMessagesForGemini` and `extra_content` / `thought_signature` in `formatMessagesForOpenAI`.
     - Add an **Automatic Signature Fallback & Self-Healing Retry**: if any historical `functionCall` lacks a `thoughtSignature` or if an upstream proxy returns HTTP 400 mentioning `thoughtsignature` / `thought_signature`, automatically serialize historical tool call/result turns into structured text context (`[Executed Tool: ...]` + `[Tool Result: ...]`) with `buildToolCallInstructions(tools)` and retry the request in-place without failing.

3. **Dashboard Tab-Lock Bug ("Dashboard Schrottet alles kein Zurück auf andere Tabs") (`app/(tabs)/tools/index.tsx`, `components/MultiAgentUI.tsx`)**
   - **Root Cause**: In `app/(tabs)/tools/index.tsx` (lines 78–90), the `useEffect` that syncs the URL parameter `tab` (`useLocalSearchParams<{ tab?: string }>()`) to local state `activeTab` includes `activeTab` in its dependency array `[tab, learningActive, activeTab]`. Once navigated to `/(tabs)/tools?tab=dashboard`, clicking any other sub-tab (`Tools`, `Plans`, `Memos`, `Search`, `Chat`) mutates `activeTab`, which immediately triggers the `useEffect` again and forces `activeTab` back to `'dashboard'`.
   - **Solution**:
     - Decouple `activeTab` from the `tab` parameter sync effect by tracking the last applied route param and calling `router.setParams({ tab: nextTab })` when switching sub-tabs manually.
     - Add a **Quick-Return Navigation Bar** inside `AgentDashboard` (`components/MultiAgentUI.tsx`) so users can jump back to `Tools`, `AI Chat`, or `Projects` with a single tap from inside the Dashboard.

4. **Buttons, Menus, Dialogs & Touch Ergonomics (`app/(tabs)/(home)/index.tsx`, `app/editor.tsx`, `app/(tabs)/chat/index.tsx`, `app/(tabs)/settings/index.tsx`)**
   - **Root Cause**: `Alert.alert` and `Alert.prompt` are used for project deletion, file creation, renaming, and git actions, which fail or no-op on Web/Chrome Mobile. Several header action buttons also have small touch areas (`padding: 4`).
   - **Solution**:
     - Replace broken `Alert.alert` / `Alert.prompt` flows with cross-platform themed Modal dialogs that work identically on Web, Android, and iOS.
     - Upgrade interactive buttons and sub-tab pills to a minimum `44x44px` touch target (`minHeight: 44`, `minWidth: 44`, `hitSlop`) with clear active/pressed visual feedback.

---

## 2. Planned Changes by File

### Phase 1: Dev Server Port 3000 Startup & Web Compatibility
- **`/package.json`**:
  - Add `"dev": "expo start --web --port 3000"` and update `"start": "expo start --web --port 3000"` so the preview server starts cleanly on port 3000.
  - Add linter and verification scripts: `"lint:biome": "biome check ."`, `"lint:oxlint": "oxlint ."`, `"lint:all": "npm run lint && npm run lint:oxlint && npm run lint:biome"`, and `"typecheck": "tsc --noEmit"`.
- **`/components/SponsorBanner.tsx`**:
  - Guard `<WebView>` usage with `Platform.OS === 'web'` fallback so Web renders clean interactive sponsor buttons without crashing on native `react-native-webview`.

### Phase 2: HTTP 400 `thoughtSignature` Fix & Resilient Tool-Calling
- **`/types/index.ts`**:
  - Extend `ToolCall` with optional `thoughtSignature?: string` and `extra_content?: Record<string, any>`.
- **`/utils/ai-service.ts`**:
  - Capture and preserve `part.thoughtSignature || part.thought_signature` in `callGemini` and `tc.thought_signature || tc.extra_content` in `callOpenAI`.
  - Update `formatMessagesForGemini` to include `thoughtSignature` on `functionCall` parts when present, and automatically convert historical tool calls without `thoughtSignature` into structured text blocks so Gemini 2.5/3 never rejects Turn 2+.
  - Update `formatMessagesForOpenAI` to pass back `thought_signature` and `extra_content` on assistant `tool_calls`.
  - Add automatic in-place HTTP 400 `thoughtSignature` retry logic in `callOpenAI`, `callOpenRouter`, and `callGemini` that converts native tool history into text-based tool turns and retries immediately.
- **`/utils/chat-compression.ts`**, **`/providers/ChatProvider.tsx`**, **`/providers/AgentProvider.tsx`**:
  - Ensure `compressAndSanitizeMessagesForAPI` and message state updates preserve `thoughtSignature` and `extra_content` across all multi-turn tool executions.

### Phase 3: Fix Dashboard Tab-Lock & Upgrade Navigation / Modals
- **`/app/(tabs)/tools/index.tsx`**:
  - Fix the `useEffect` hook so `activeTab` changes do not re-trigger `setActiveTab(tab)` when `tab === 'dashboard'`.
  - Synchronize manual sub-tab clicks with `router.setParams({ tab: nextTab })`.
  - Increase sub-tab button touch targets and visual active states.
- **`/components/MultiAgentUI.tsx`**:
  - Add a **Quick-Return Navigation Bar** in the `AgentDashboard` header (`← Tools`, `AI Chat`, `Projects`) and improve agent control button ergonomics.
- **`/app/(tabs)/(home)/index.tsx`** & **`/app/editor.tsx`**:
  - Replace Web-incompatible `Alert.alert` / `Alert.prompt` confirmations with cross-platform themed Modal dialogs and enforce `44x44px` minimum touch targets on header/card actions.

### Phase 4: Modern Linter Suite, Cleanup & Documentation Governance
- **Modern Linters (`@biomejs/biome`, `oxlint`, `.eslintrc.js`, `/biome.json`)**:
  - Install `@biomejs/biome` and `oxlint` as devDependencies.
  - Create `/biome.json` and update `/.eslintrc.js` to enforce `react-hooks/exhaustive-deps` and catch stale hook dependencies.
  - Clean up leftover patch/reject artifacts (`/providers/ChatProvider.tsx.orig`, `/providers/ChatProvider.tsx.rej`, `/utils/ai-service.ts.orig`, `/fix-*.patch`, `/patch_chat_provider*`).
- **Tests & Documentation (`/CHANGELOG.md`, `/docs/AUDIT_REPORT.md`, `/.qoder/rules/lessons_learned.md`, `/AGENTS.md`, `/__tests__/`)**:
  - Add unit tests in `/__tests__/utils/chat-compression.test.ts` verifying `thoughtSignature` preservation and fallback formatting.
  - Create `/CHANGELOG.md` and `/docs/AUDIT_REPORT.md` documenting all root causes, fixes, and linter results.
  - Update `/.qoder/rules/lessons_learned.md` and `/AGENTS.md` with the new lessons learned.
