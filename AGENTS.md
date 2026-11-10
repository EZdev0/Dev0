---
name: Dev0 Root Architecture & Autonomous Engineering Contract
description: Official open-source architecture contract and verification protocol for the Dev0 Autonomous AI Software Engineering Workspace & Multi-Agent IDE.
trigger: always
alwaysApply: true
globs:
  - "**/*"
---

# ⚡ Dev0 — Autonomous AI Software Engineering Workspace (Root Architecture Contract)

## Purpose
This document defines the official open-source architecture and engineering contract for **Dev0** (`v1.9.0`). The repository hosts a cross-platform React Native `0.81.5` / Expo SDK `54` AI engineering IDE integrating Dual-Mode tool isolation, Forced Extended Thinking (`<think>...</think>`), Extra YAML Skill Learning, the 2D Synapse Memory & Codebase Graph, and server-side API key governance.

## Ownership & Scope
- **Scope:** Root directory and all underlying modules (`app/`, `components/`, `providers/`, `utils/`, `types/`, `constants/`, `scripts/`, `docs/`).
- **Authority:** Establishes repository-wide engineering standards, security boundaries, and automated verification requirements.

---

## Core Engineering Standards

### 1. Strict Read-Before-Write & Context Grounding
Before modifying any module or executing multi-step refactors:
1. **Inspect Existing Modules:** Read target files completely before applying edits (`read_file` -> `edit_file` / `write_file`).
2. **Graph & Skill Grounding:** Query the Synapse Code & Memory Graph (`localize_code_graph`, `memory_search`) and active YAML skills (`matchActiveSkillsForTurn`) to preserve architectural invariants.
3. **Dual Git Restore Points:** Create a snapshot restore point (`git_create_restore_point`) prior to structural changes.

### 2. Version Control & Pull Request Discipline
- **Never push untested breaking changes directly to `main`.**
- Create dedicated feature or fix branches (`feat/...`, `fix/...`) and verify all checks before submitting a Pull Request.
- Every Pull Request should include:
  - **PR Title:** Semantic conventional commit title (e.g., `feat(graph): ...`).
  - **Summary & Key Changes:** Concise overview of architectural updates.
  - **Verification:** Output of `npm run typecheck` (`0` errors) and `npm test` (`92+` tests passing).

### 3. Security & Zero-PII Credential Governance
- Never hardcode or commit plaintext API keys, tokens, or personal data (`PII`) into the repository.
- Route shared pool keys exclusively through the server-side vault (`/api/pool`) with anti-jailbreak inspection (`inspectPromptForKeyJailbreak`), `40%` warning notifications, and `50%` Emergency Auto-Cutoff (`status: 'emergency_stop'`) without deleting keys.
- Sanitize external URLs (`http:` / `https:` only) and enforce strict mode-based tool isolation (`isChatModeOnlyTool` vs. `isProjectFilesystemOrAgentOnlyTool`).

### 4. CI/CD & Cross-Platform Guardrails
- **Cross-Platform Compatibility:** Maintain full compatibility across Web (Port `3000`), Android, and iOS.
- **Sub-Agent Recursion Limit:** Enforce a strict Sub-Agent delegation depth limit (`depth <= 1`; no nested sub-agents) to prevent runaway token loops.

---

## Architecture Overview
- **Framework:** Expo SDK `~54.0.37` (`expo-router@~6.0.27`, `react-native@0.81.5`, `react@19.1.0`, `typescript@~5.9.2`).
- **Web Export & Edge API Routes:** Bundled via `scripts/patch-modules.js` and `expo export -p web`.
- **Multi-Agent & Dual-Mode Runtime:** Orchestrated via `providers/AppProvider.tsx`, `providers/ChatProvider.tsx`, `providers/AgentProvider.tsx`, and `providers/ProjectProvider.tsx`.

---

## Verification Protocol
Every pull request or architectural change must pass:
1. **Type Checking:** `npm run typecheck` (`npx tsc --noEmit` must exit with `0` errors).
2. **Automated Tests:** `npm test` (all `92+` unit and integration tests must pass).
3. **Static Analysis:** `npm run lint` / `npm run lint:biome`.
4. **Web Bundle Integrity:** `npm run export-web`.

---

## Repository Directory Index
- [`docs/MASTER_CONCEPT.md`](docs/MASTER_CONCEPT.md) | [`docs/MASTER_CONCEPT.de.md`](docs/MASTER_CONCEPT.de.md) — Flagship Master Concept & Vision (EN / DE).
- [`docs/README.md`](docs/README.md) | [`docs/README.de.md`](docs/README.de.md) — Bilingual Documentation Hub.
- [`app/`](app/README.md) — Expo Router screens and server-side API routes (`app/api/`).
- [`components/`](components/README.md) — Reusable UI components, Synapse Graph, Reasoning Orb, and Studio modals.
- [`providers/`](providers/README.md) — Application state, chat orchestration, multi-agent runtime, and sandbox providers.
- [`utils/`](utils/README.md) — Core AI service, YAML skill loader, Synapse Graph indexer, Key Pool vault, and Dual Git engine.
- [`scripts/`](scripts/README.md) — Metro/Expo build patches and test runner utilities.

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
- **"AI for Free" Shared Key Pool & Zero-PII 3-Tier RBAC Governance (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`, `providers/AppProvider.tsx`):**
  - Supports masked API key sharing with token/time limits and target `User ID` scoping, real API + BPE token accounting (`extractActualTokenUsage`, `estimateTokensBPE`), 80% quota warnings, automatic key rotation, and 3-Tier RBAC (`owner` / `admin` / `user`) with Google Sign-In and Owner Passphrase Claim persisted via `IndexedDB` + `AsyncStorage` with zero hardcoded PII.
- **Root-Cause Bug Documentation (`bugs/*.md`) & CORS-Safe `/api/models` Proxy (`app/api/models+api.ts`, `components/HTMLPreview.tsx`):**
  - Eliminates `@rork-ai/toolkit-sdk` deprecation warnings, proxies custom `/v1/models` requests server-side, and enables WebAssembly (`window.runWasmBytes`) inside `HTMLPreview.tsx`.

---

## Sub-Agent Floating Question Relay, Strict Question Tool Guard & Netlify Hardening (v1.3.0)
- **Strict Question Tool Guard (`utils/subagent-question-relay.ts`, `providers/ChatProvider.tsx`):**
  - `hasPendingChatQuestions` uses `hasExplicitQuestionToolCall` so the `KI-Rückfragen offen / Überspringen & Direkt starten (Skip)` banner is strictly shown **only** when the AI invokes the `ask_user_question` tool (`toolCallId` present) or during an active `clarifying` plan, never from plain-text `?` characters in normal chat messages.
- **Sub-Agent Floating Window -> Main Creator Relay -> Saved Sub-Agent List (`components/SubAgentFloatingQuestionModal.tsx`, `app/(tabs)/chat/index.tsx`, `components/MultiAgentUI.tsx`):**
  - Launches a floating configuration and Q&A modal when Sub-Agent questions arise via `ask_user_question`, relays structured answers directly to the Main Creator Agent (`buildMainCreatorRelayPrompt`), and persists the configured Sub-Agent into `customSubAgents` (`createSavedSubAgentFromQuestionResponse`) displayed in `ChatScreen`, `AgentDashboard`, and `SubAgentStudioModal`.
- **Netlify & CI Build Hardening (`.npmrc`, `netlify.toml`, `package.json`, `.github/workflows/lint.yml`):**
  - Enforces Node 20 (`NODE_VERSION = "20"`), `legacy-peer-deps=true`, `node scripts/patch-modules.js && expo export -p web`, and `esbuild` Netlify Functions 2.0 bundling.

---

## Dev0 Sandboxed Workspaces, Docker Backend, 3-Tier RBAC, Per-Chat Telemetry & `.agents/` Cron Workflows (v1.5.0)
- **Isolated User Sandboxes & Docker Container Backend (`utils/sandbox-workspace.ts`, `utils/sample-project.ts`, `app/api/sandbox+api.ts`, `Dockerfile.sandbox`, `docker-compose.sandbox.yml`):**
  - Strips legacy `studio-ide` self-source exposure (`sanitizeUserSandboxProjects`) and stores each user's projects in an isolated IndexedDB/AsyncStorage namespace (`dev0_sandbox_projects_v2_<userId>`) or non-root Docker container volume (`/workspace/sandboxes/<userId>`).
- **Zero-PII 3-Tier RBAC & Real Per-Chat Debug Telemetry (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`, `providers/ChatProvider.tsx`):**
  - Enforces `owner` (`canViewUserChats === true`, `canManageUsers === true`), `admin` (`canManageUsers === true`, `canViewUserChats === false`), and `user` roles with masked emails (`maskEmailAddress`) and Google Sign-In.
  - Initializes all counters at `0` and appends a verified `ChatDebugLogEntry` (latency, exact API vs. BPE tokens, tool calls, fallback, key rotation) after every chat turn.
- **Provider Model Catalog Search Highlight & Local / LM Studio / Ollama Presets (`app/(tabs)/settings/index.tsx`, `types/index.ts`):**
  - Displays exact provider model IDs with live yellow search highlighting (`#FACC15`) and provides 1-tap presets + live `/api/models` discovery for **LM Studio (`1234`)**, **Ollama (`11434`)**, and **Local OpenAI-Compatible (`8080`)** servers.
- **Hidden `.agents/<slug>/` Workspaces, Mandatory `finish_task` Tool, Cron Jobs & Pause/Sleep Mode (`utils/subagent-workspace.ts`, `providers/ChatProvider.tsx`, `providers/AgentProvider.tsx`, `app/(tabs)/chat/index.tsx`):**
  - Maintains hidden English `.agents/<slug>/README.md`, `RULES.md`, `STATUS.md`, and `LOG.md` files for every Sub-Agent, hidden from the normal user file tree (`filterVisibleUserFiles`) and Git-ignored.
  - Adds `finish_task`, `create_cron_job`, `sleep_agent`, and `inspect_subagent_workspace` tools plus an interactive Workflow & Cron Graph Card in Chat for pausing, resuming, and scheduling Sub-Agents.

---

## Normal Chat Mode Tool Isolation, Downloadable Chat ZIPs, Dual Git Restore Points, Standalone Memory Graph & 100% English UI (v1.6.0)
- **Normal Chat Mode vs. Agent Mode Tool Isolation (`utils/ai-service.ts`, `providers/ChatProvider.tsx`, `types/index.ts`):**
  - Strips project filesystem and `sub_agent` tools (`isProjectFilesystemOrAgentOnlyTool`) when in Normal Chat Mode (`chatModeOnly: true` / `agentMode: false`) or when no project is active.
  - Provides `zip_create` and `zip_read` (`utils/chat-zip.ts`) so generated files in Normal Chat Mode are packaged into a downloadable PKZIP archive rendered as an interactive **ZIP Download Graphic Card** (`ChatBubble.tsx`), automatically converting stray `write_file`/`create_file` calls in Normal Chat Mode into `.zip` bundles.
  - Provides `draft_agent_plan` to render an interactive **Execution Plan Graphic Card** in Chat with **Proceed in Agent Mode** and **Edit / Refine Plan** floating editor support, plus `read_other_chat_messages` (`utils/cross-chat-reader.ts`) for token-efficient (< 1,750 chars) BM25 cross-chat retrieval.
- **Zero Hardcoded Sub-Agents or Skills & Separate Memory Graph vs. Project Code Graph Tabs (`utils/skill-loader.ts`, `utils/subagent-workspace.ts`, `utils/synapse-graph.ts`, `components/SynapseGraphView.tsx`):**
  - Empties `DEFAULT_CUSTOM_SUB_AGENT_TEMPLATES = []`, `BUILTIN_WORKSPACE_SKILL_FILES = []`, and default workflow nodes/cron jobs so only real user/AI-created Sub-Agents and project YAML skills appear.
  - Splits `SynapseGraphView` into a standalone **Memory Graph** tab (`buildMemoryOnlySynapseGraph`, usable with or without an active project, plus AI tools `memory_search`, `memory_update`, `memory_delete`, `memory_graph_query`) and a **Project Code Graph** tab (requires an active project).
- **Built-in Dual Git & Restore Point System (`utils/git-restore.ts`, `app/(tabs)/(home)/index.tsx`, `providers/ChatProvider.tsx`, `providers/ProjectProvider.tsx`):**
  - Combines browser-side snapshot restore points (`IndexedDB` / `AsyncStorage`) with Docker `/api/sandbox` Git commit mirroring (`git_status`, `git_create_restore_point`, `git_list_restore_points`, `git_restore_point`) and an interactive **Built-in Git & Restore Points** modal in Projects.
- **100% English UI, "AI Generate All" Striped Lock Overlay, Live Read-Only Sub-Agent Stream & Sub-Agent Deletion (`components/SubAgentFloatingQuestionModal.tsx`, `app/(tabs)/chat/index.tsx`, `components/SubAgentStudioModal.tsx`):**
  - Translates all UI components and modals to 100% English, adds an **"AI Generate All"** button with a diagonal striped lock overlay in `SubAgentFloatingQuestionModal`, provides a **Live Read-Only Sub-Agent Stream Modal** with a disabled grayed-out input bar when clicking a Sub-Agent, and enables deleting any Sub-Agent template.

---

## Firebase Google Auth, Server Key Vault Proxy, 50% Emergency Auto-Cutoff, Mutual-Exclusive Tool Isolation & Owner Prompt Control (v1.7.0)
- **Real Free Firebase Google Sign-In & Placeholder Elimination (`utils/firebase-client.ts`, `firebase-applet-config.json`, `firestore.rules`, `utils/free-ai-pool.ts`, `providers/AppProvider.tsx`, `components/FreeAIPoolModal.tsx`):**
  - Integrates real Firebase Authentication (`signInWithPopup` with `GoogleAuthProvider`) and Firestore persistence (`users`, `pool_keys`, `pool_logs`).
  - Eliminates `google.user@gmail.com`, `pool_builtin_studio_free`, and `rork_builtin` placeholders via `detectAuthOrKeyPlaceholder`.
- **Server-Only Key Vault Proxy (`/api/pool`) & 50% Emergency Auto-Cutoff (Not-Aus) Without Deletion (`app/api/pool+api.ts`, `utils/free-ai-pool.ts`, `utils/ai-service.ts`):**
  - Stores shared API keys in the server vault (`/api/pool`), clamps `max_tokens` (`clampMaxTokensForPoolKey`), blocks key-extraction prompt jailbreaks (`inspectPromptForKeyJailbreak`), notifies the Owner at configurable `notifyAtPercent` (`40%`), and triggers an automatic Emergency Stop (`status: 'emergency_stop'`, `isActive: false`) at `emergencyCutoffPercent` (`50%`) **without deleting any key**.
- **Mutual-Exclusive Tool Isolation, Hidden Disabled Tools & Live Owner System Prompt Control (`types/index.ts`, `utils/ai-service.ts`, `providers/ChatProvider.tsx`, `app/(tabs)/tools/index.tsx`, `components/FreeAIPoolModal.tsx`):**
  - Blocks `zip_create`, `zip_read`, and `draft_agent_plan` (`isChatModeOnlyTool`) in Agent Mode (`agentMode: true`) and blocks project filesystem/Git/Sub-Agent tools (`isProjectFilesystemOrAgentOnlyTool`) in Normal Chat Mode (`agentMode: false`).
  - Hides mode-disabled and removed tools from standard users in `ToolsScreen` (with an Owner-only visibility toggle), replaces the hardcoded `Cap 50k` button with a custom numeric quota setter (`0` = Unlimited), and adds live Owner editing for `customSystemPrompt`, `customChatModePrompt`, and `customPlannerPrompt`.
- **Metro `.bun-tmp-*` Watcher Fix, Single Live `ThinkingBlock`, `create_yaml_skill` & Non-Destructive Memory Graph Cleanup (`metro.config.js`, `scripts/patch-modules.js`, `utils/skill-loader.ts`, `utils/synapse-graph.ts`):**
  - Blocks transient `/\/\.bun-tmp-[^/]+/` paths in `metro.config.js` and patches `metro-file-map` watchers in `scripts/patch-modules.js`.
  - Removes the duplicate `thinking_...` message in `ChatProvider.tsx`, adds the `create_yaml_skill` tool (`createAndValidateYamlSkillFile`), and repairs stale `[Synapse: ...]` file references (`cleanStaleMemoryGraphLinks`) without deleting user memories.

---

## Extra YAML Learning + `.ZIP` Skill Importer, Corrupted YAML `!` AI Fix, Animated Reasoning Orb, Drag-and-Drop Synapse Graph & English Tutorial (v1.8.0)
- **Legacy 5-Identity-File Removal & Extra YAML Learning Engine (`utils/skill-loader.ts`, `components/SubAgentStudioModal.tsx`, `app/(tabs)/settings/index.tsx`, `utils/ai-service.ts`):**
  - Removes the legacy 5 Identity Files (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`) from Beta Settings and system prompts.
  - Replaces them with the **Extra YAML Skill & `AGENTS.md` Learning Engine** supporting on-site `.md`, `.yml`, `AGENTS.md`, and `.zip` skill pack uploads (`importSkillsFromZipOrFiles`), `.qoder/`-free source paths (`formatSkillSourceForDisplay`), automatic detection of broken/non-YAML files with an exclamation warning (`!`) and 1-click **"Fix with AI"** repair (`repairCorruptedSkillContent`), and configurable **Always (Background)** vs. **Custom Trigger Words / Phrases / Letters** (`matchActiveSkillsForTurn`).
- **Subtle Bottom-Right Active Skills & `AGENTS.md` Badge in Chat (`components/ChatBubble.tsx`, `providers/ChatProvider.tsx`, `types/index.ts`):**
  - Records `loadedSkills` on every chat turn and renders a subtle bottom-right `Loaded: <Skills / AGENTS.md>` indicator inside `ChatBubble.tsx` showing which rules/skills the system actually loaded.
- **Animated Reasoning Orb -> Single Text-Streaming Extended Thinking Box (`components/ThinkingBlock.tsx`, `app/(tabs)/chat/index.tsx`, `utils/ai-service.ts`):**
  - Forces structured `<think>...</think>` extended thinking in `buildSystemPrompt`, renders **only** an animated **Reasoning Orb** while waiting for initial reasoning tokens (`isLive && !hasRealReasoning`), and transitions into **one single text-streaming box** once reasoning text streams in.
- **Classic Projects View, Working 1-Click Project Deletion, Dashboard in Slot 1, Interactive Drag-and-Drop Synapse Graph & English Tutorial (`app/(tabs)/(home)/index.tsx`, `providers/ProjectProvider.tsx`, `app/(tabs)/tools/index.tsx`, `components/SynapseGraphView.tsx`, `components/TutorialModal.tsx`):**
  - Restores the classic File Tree view in Projects (`viewMode = 'tree'`), fixes persistent project deletion in `ProjectProvider.tsx` (`deleteProject`), places **Dashboard in Slot 1** of Tools (`[Dashboard, Tools, Plans, Graph, Search, Chat]`), upgrades `SynapseGraphView` with **Node Drag-and-Drop**, **Left-Click Inspector**, and **Right-Click / Long-Press Context Menu**, adds Codebase & Graph Node results to `Tools -> Search`, and includes an interactive 5-step **English System Tutorial** (`TutorialModal.tsx`).

---

## Bilingual Master Concept System (`MASTER_CONCEPT.md` / `.de.md`), In-App Concept Explorer & Deduplicated Documentation Suite (v1.9.0)
- **Flagship Bilingual Master Concept & Vision (`docs/MASTER_CONCEPT.md`, `docs/MASTER_CONCEPT.de.md`, `components/MasterConceptModal.tsx`):**
  - Establishes a persuasive, capability-driven Master Concept in both **English** and **German** detailing what Dev0 stands for (Zero Context Loss, Zero Unintended Mutation, Zero Credential Exposure, Zero Platform Lock-In), target personas (Indie Builders / Vibecoders, Senior Systems Architects, Privacy/Local-LLM Engineers, Teams/Educators), and the 6 core technological pillars.
  - Adds the interactive bilingual (`DE` / `EN`) **Master Concept & System Architecture Modal** (`components/MasterConceptModal.tsx`) accessible from the Projects toolbar (`Concept (DE/EN)`) and Settings (`Master Concept & Vision (DE / EN)`).
- **Complete Documentation Modernization, Bilingual Translation & Duplicate Removal (`docs/*.md`, `docs/*.de.md`, `README.md`, `README.de.md`, module `README.md`s):**
  - Removed all 12 duplicate/fragment March 2026 `.md` files from `docs/` (`FIXES_*.md`, `NULL_SAFETY_COMPLETE.md`, `QUESTIONS_PHASE_UI_COMPLETE.md`, duplicate `docs/AGENTS.md`, `docs/CLAUDE.md`, `docs/copilot-instructions.md`, `docs/README_changes.md`, `docs/info.md`), legacy `.qoder/rules/lessons_learned.md` & `user.md`, and root dummy files (`Update`, `Update2`).
  - Consolidated and translated all core documentation pairs in `docs/` (`README`, `MASTER_CONCEPT`, `SYSTEM_OVERVIEW`, `MULTI_AGENT_IMPLEMENTATION`, `SYSTEM_START`, `AUDIT_REPORT`, `IMPLEMENTATION_REPORT` in both `.md` [EN] and `.de.md` [DE]) plus all 11 module `README.md` files.

