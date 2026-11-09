---
trigger: always_on
alwaysApply: true
---

# 🧠 QCoder System Memory (Lessons Learned)

*This document serves as the long-term engineering memory to prevent regressions and recurring bugs across code analysis and implementation tasks.*

## Known Issues & Resolved Lessons
- **[2026-10-27] Gemini 2.5 / 3 `thoughtSignature` Preservation on Tool Calls**:
  - **Issue**: Gemini 2.5 and Gemini 3 thinking models return a `thoughtSignature` (or `extra_content.google.thought_signature` via OpenAI/OpenRouter compatibility layers) on `functionCall` / `tool_calls` parts. Stripping this signature during message sanitization or history formatting triggers `HTTP 400: Function call is missing a thought_signature in functionCall parts`.
  - **Rule**: Always preserve `thoughtSignature` and `extra_content` in `ToolCall` objects (`types/index.ts`), `compressAndSanitizeMessagesForAPI` (`utils/chat-compression.ts`), `ChatProvider.tsx`, `AgentProvider.tsx`, and API formatters (`formatMessagesForOpenAI`, `formatMessagesForGemini`). Always maintain an automatic self-healing fallback (`flattenUnsignedToolCalls`) for unsigned historical tool calls.
- **[2026-10-27] Route Param Synchronization vs. Local Sub-Tab State (`app/(tabs)/tools/index.tsx`)**:
  - **Issue**: Including local `activeTab` in the dependency array of a `useEffect` that watches `params.tab` (`[params.tab, activeTab]`) causes an immediate state snap-back loop whenever the user clicks another sub-tab while `?tab=dashboard` remains in route params.
  - **Rule**: Only depend on `[params.tab]` when syncing route parameters to local tab state, and call `router.setParams({ tab: newTab })` when the user manually switches sub-tabs.
- **[2026-10-27] Cross-Platform Web Compatibility (`Alert.prompt` & `react-native-webview`)**:
  - **Issue**: `Alert.prompt` is iOS-only and multi-button `Alert.alert` calls fail on React Native Web; native `WebView` components crash on Web if rendered without a `Platform.OS === 'web'` guard.
  - **Rule**: Always use React Native `Modal` components for interactive confirmations, context menus, and rename prompts, and guard `WebView` embeds with a Web fallback.
- **[2026-10-27] Eliminating `@rork-ai/toolkit-sdk` Deprecation Warnings & Unifying Tool Execution (`providers/ChatProvider.tsx`)**:
  - **Issue**: Importing and calling `createRorkTool` and `useRorkAgent` emitted console warnings (`[Toolkit] createRorkTool / useRorkAgent is deprecated`) on startup and bypassed custom tool parsers and token accounting.
  - **Rule**: Route all chat providers through the unified `callAI` manual loop in `ChatProvider.tsx` so token usage (`recordPoolTokenUsage`), 3-tier tool parsing (`parseToolCallsFromText`), and `localize_code_graph` work identically across every provider.
- **[2026-10-27] Custom `/v1/models` Browser CORS Failures (`app/api/models+api.ts`, `app/(tabs)/settings/index.tsx`)**:
  - **Issue**: Calling `fetch(customEndpoint + '/v1/models')` directly from browser clients triggers `TypeError: NetworkError when attempting to fetch resource` when the target server lacks browser CORS headers.
  - **Rule**: Always proxy custom `/v1/models` discovery through the server-side `/api/models` route with a graceful default model fallback.
- **[2026-10-27] Strict Tool-Only Question Detection (`hasExplicitQuestionToolCall`) vs. Plain-Text `?` (`utils/subagent-question-relay.ts`, `providers/ChatProvider.tsx`)**:
  - **Issue**: Checking `lastMsg.content.includes('?')` on assistant replies caused the `KI-Rückfragen offen (1) / Überspringen & Direkt starten (Skip)` banner to appear falsely on normal greetings or conversational replies ending with `?`.
  - **Rule**: Never use a plain-text `?` check to trigger clarification/skip banners. Always require an explicit invocation of the `ask_user_question` tool (`hasExplicitQuestionToolCall`) or an active `SubAgentQuestionRequest`.
- **[2026-10-27] Sub-Agent Floating Window Relay & Saved Sub-Agent List (`components/SubAgentFloatingQuestionModal.tsx`, `utils/subagent-question-relay.ts`)**:
  - **Rule**: Whenever a question arises via or about a Sub-Agent, launch `SubAgentFloatingQuestionModal`, persist the configured Sub-Agent via `saveSubAgentTemplate` (`createSavedSubAgentFromQuestionResponse`) so it is displayed in the Saved Sub-Agent List, and relay structured answers directly back to the Main Creator Agent (`buildMainCreatorRelayPrompt`).
- **[2026-11-09] Metro Watcher `ENOENT` Crash on Temporary `.bun-tmp-*` Directories (`metro.config.js`, `scripts/patch-modules.js`)**:
  - **Issue**: Installing packages (such as `firebase`) while Metro is watching `node_modules` creates transient `@firebase/.bun-tmp-*` directories that vanish mid-install, crashing Metro's `FallbackWatcher` / `NodeWatcher` with `Error: ENOENT: no such file or directory, watch '.../.bun-tmp-.../dist/esm'`.
  - **Rule**: Block `/\/\.bun-tmp-[^/]+/` in `metro.config.js` (`resolver.blockList`), clean leftover `.bun-tmp-*` directories in `scripts/patch-modules.js`, and patch `metro-file-map` watcher error handlers to ignore transient `ENOENT` events.
- **[2026-11-09] Duplicate Live `ThinkingBlock` in Chat Screen (`providers/ChatProvider.tsx`, `app/(tabs)/chat/index.tsx`)**:
  - **Issue**: Appending an assistant `thinking_...` placeholder message into `manualMessages` while `ChatScreen` also renders `<ThinkingBlock />` in `ListFooterComponent` when `isLoading` is true caused two simultaneous live thinking boxes (`Reasoning & analyzing...` + `Dev0 is thinking...`).
  - **Rule**: Never insert a separate `thinking_...` placeholder message into `manualMessages`; rely on `liveThinkingContent` and the single `ListFooterComponent` `<ThinkingBlock />` during streaming/execution.
- **[2026-11-09] Mutual-Exclusive Tool Isolation Between Normal Chat Mode and Agent Mode (`types/index.ts`, `utils/ai-service.ts`, `providers/ChatProvider.tsx`, `app/(tabs)/tools/index.tsx`)**:
  - **Issue**: Allowing `zip_create` / `zip_read` in Agent Mode caused the AI to package files into ZIPs instead of editing project files, while showing disabled tools in the Tools UI confused users.
  - **Rule**: Strictly block `CHAT_MODE_ONLY_TOOL_NAMES` (`zip_create`, `zip_read`, `draft_agent_plan`) when `agentMode === true`, strictly block `PROJECT_FILESYSTEM_TOOL_NAMES` when `agentMode === false`, and hide mode-disabled tools from standard users in `ToolsScreen` (with an Owner-only visibility toggle).
- **[2026-11-09] Server-Only Key Vault, Placeholder Rejection & 50% Emergency Auto-Cutoff Without Deletion (`utils/free-ai-pool.ts`, `app/api/pool+api.ts`, `utils/firebase-client.ts`)**:
  - **Issue**: Simulated Google Sign-In (`google.user@gmail.com`), built-in placeholder pool entries (`pool_builtin_studio_free`), or client-exposed API keys risked placeholder confusion or over-billing.
  - **Rule**: Authenticate via real Firebase Google Sign-In (`utils/firebase-client.ts`), reject all auth/key placeholders via `detectAuthOrKeyPlaceholder`, proxy shared pool requests through `/api/pool` with `clampMaxTokensForPoolKey` and `inspectPromptForKeyJailbreak`, and trigger an automatic Emergency Stop (`status: 'emergency_stop'`, `isActive: false`) at `emergencyCutoffPercent` (default `50%`) without ever deleting any key.