# Changelog

All notable changes, bug fixes, architectural improvements, and audits for **ZeroProCode IDE (`AI_mega_Brain_rork`)** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
- **Web Dev Server & Native WebView Crash (`package.json`, `components/SponsorBanner.tsx`)**:
  - Added `"dev": "expo start --web --port 3000"` and `"build": "expo export -p web"` scripts to `package.json` for AI Studio preview compatibility on port 3000.
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
