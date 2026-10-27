# BUG-04: False-Positive Clarification Banner on Plain-Text `?`, Sub-Agent Floating Question Relay & Netlify Build Hardening

## 1. Root Cause Analysis

### Issue A: False-Positive `KI-Rückfragen offen (1)` / `Überspringen & Direkt starten (Skip)` Banner
- **Symptom**: Whenever the AI Assistant responded in normal conversational text with a sentence ending in a question mark (`?`) — for example `"Hello! How can I help you today?"` or `"I can start a sub-agent for you. What role should the sub-agent have (e.g., localizer, developer, critic), and what task should I assign to it?"` — the bottom chat bar displayed `KI-Rückfragen offen (1)` and the green `⚡ Überspringen & Direkt starten (Skip)` button, even though the AI never called any question/clarification tool.
- **Root Cause**: `hasPendingChatQuestions` in `providers/ChatProvider.tsx` previously checked `lastMsg.content.includes('?')` on plain-text assistant messages instead of checking whether the AI explicitly invoked a dedicated question tool.

### Issue B: Sub-Agent Questions & Configuration Not Opening a Floating Window or Persisting to Saved Sub-Agent List
- **Symptom**: When a Sub-Agent needed user input or when the user asked to start a Sub-Agent (`"starte einen subagent"`), there was no floating interactive window to capture the role, task, allowed files, and answers, relay them back to the Main Creator Agent (`Main-Ersteller`), and persist the configured Sub-Agent into the saved Sub-Agents list.

### Issue C: Netlify & CI Build Environment Compatibility
- **Symptom**: Netlify builds and GitHub Actions CI (`lint.yml`) could fail when falling back to `npm install` with React 19 peer dependency conflicts (`ERESOLVE`), Node 18 engine mismatches (`expo-server@1.0.7` requires `node >= 20.16.0`), or missing `patch-modules.js` execution when `npm run export-web` was invoked directly.

---

## 2. Implemented Resolution

1. **Dedicated `ask_user_question` Tool & Strict Tool-Only Banner Guard (`utils/subagent-question-relay.ts`, `utils/ai-service.ts`, `types/index.ts`, `providers/ChatProvider.tsx`)**:
   - Registered `ask_user_question` in `TOOL_DEFINITIONS` and `TOOL_REGISTRY`.
   - Replaced the naive `?` text check in `hasPendingChatQuestions` with `hasExplicitQuestionToolCall(messages, pendingSubAgentQuestion)`, which returns `true` **only** when the AI explicitly invokes `ask_user_question` (or when an active `pendingSubAgentQuestion` is open). Plain-text `?` sentences never falsely trigger the Skip banner.
2. **Sub-Agent Floating Question Window & Main Creator Relay (`components/SubAgentFloatingQuestionModal.tsx`, `utils/subagent-question-relay.ts`, `app/(tabs)/chat/index.tsx`, `components/MultiAgentUI.tsx`)**:
   - Launches `SubAgentFloatingQuestionModal` whenever a Sub-Agent question or Sub-Agent launch inquiry occurs.
   - Collects Sub-Agent role, name, allowed file globs, task instructions, and question answers, saves the Sub-Agent permanently via `saveSubAgentTemplate` (`createSavedSubAgentFromQuestionResponse`), displays it in the **Saved Sub-Agents List** across `ChatScreen`, `AgentDashboard`, and `SubAgentStudioModal`, and relays the structured response directly back to the **Main Creator Agent** (`buildMainCreatorRelayPrompt`).
3. **Netlify & CI Build Hardening (`.npmrc`, `netlify.toml`, `package.json`, `.github/workflows/lint.yml`)**:
   - Added `.npmrc` (`legacy-peer-deps=true`, `engine-strict=false`).
   - Updated `netlify.toml` with `NODE_VERSION = "20"`, `NPM_FLAGS = "--legacy-peer-deps"`, `(bun install || npm install --legacy-peer-deps) && node scripts/patch-modules.js && npx expo export -p web`, `node_bundler = "esbuild"`, and `status = 200` SSR/SPA routing.
   - Updated `package.json` `export-web` and `build` scripts to always run `node scripts/patch-modules.js && expo export -p web`.
