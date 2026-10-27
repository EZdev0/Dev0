# Dev0 v1.5 — Security Isolation, Multi-Role Free AI Governance, `.agents/` Sub-Agent Workspaces & Live Model Discovery

## 1. Architectural Vision & Core Objectives

This plan upgrades **Dev0** (`ZeroProCode IDE`) to eliminate privacy leaks, enforce strict workspace sandboxing, provide 100% real per-chat token and debug telemetry, expand local/custom model discovery with yellow search highlighting, and establish a full `.agents/` multi-agent coordination ecosystem with Cron jobs, sleep/pause states, and interactive workflow cards.

---

## 2. Key Workstreams

### Workstream A: Sandboxed Workspace Isolation & Docker Execution Backend (No Self-Source Exposure)
- **Remove Self-Source Exposure (`providers/ProjectProvider.tsx`)**:
  - Stop loading `SELF_SOURCE_FILES` (`ZeroProCode IDE (Self)`) into the user project list so neither users nor AI agents can inspect or modify internal platform source files.
  - Initialize new users with a clean, isolated starter project stored exclusively in their per-user Browser IndexedDB / AsyncStorage sandbox (`dev0_sandbox_projects_<userId>`).
  - Display a non-intrusive sign-in reminder banner when operating as an unauthenticated guest so users know to sign in with Google to persist their workspace, keys, and settings across sessions.
- **Docker Sandbox Backend Mode (`app/api/sandbox+api.ts`, `utils/sandbox-workspace.ts`, `Dockerfile.sandbox`, `docker-compose.sandbox.yml`)**:
  - Provide a dedicated `/api/sandbox` backend route and Docker container configuration (`Dockerfile.sandbox` with non-root user, isolated `/workspace` mount, memory/CPU quotas, and network guards) so commands and file operations execute inside an isolated container workspace when Docker mode is enabled.
- **Hidden `.agents/` Directory & `.gitignore` Protection**:
  - Add `.agents/` to `.gitignore` and filter `.agents/**` out of the standard user file tree in `ProjectProvider` and `FileTreeItem` unless the user explicitly toggles the **Sub-Agent `.agents/` Inspector** view.

### Workstream B: Zero-PII Privacy Scrubbing, Google Sign-In & 3-Tier RBAC (Owner / Admin / User)
- **Complete Email Leak Removal (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`, `__tests__/*`, `AGENTS.md`)**:
  - Purge all hardcoded occurrences of any personal email address from constants, placeholders, default state factories, and test suites.
  - Mask all displayed emails (`maskEmailAddress('user@example.com') -> 'us***@example.com'`) for non-owner views.
- **Google Sign-In & Owner Passphrase Claim (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`)**:
  - Add a **Sign in with Google** authentication flow (supporting Google OAuth popup / token verification and persistent session identity) required before consuming or sharing keys in the **AI for Free** pool.
  - Implement a secure **Claim Owner Role** verification flow (using SHA-256 hashed passphrase/claim token verification with zero plaintext credentials or emails in source code).
- **Strict 3-Tier Role Access Control (`Owner` vs. `Admin` vs. `User`)**:
  - **Owner**: Full governance over users, keys, quotas, timeouts, AND access to the **Chat Audit & Debug Log Inspector** across sessions.
  - **Admin**: Can view the user directory (with masked emails), manage user timeouts/bans, and adjust key quotas, but **cannot** view private chat transcripts of other users.
  - **User**: Can access the **AI for Free** floating modal to contribute keys, configure token/time limits, and monitor their own token consumption and personal chat debug telemetry, with zero visibility into other users' chats or admin controls.

### Workstream C: 100% Real Token Accounting & Per-Chat Debug Telemetry
- **Eliminate Seeded Counters (`utils/free-ai-pool.ts`)**:
  - Reset `createDefaultFreePoolState()` initial counters (`totalPromptTokens`, `totalCompletionTokens`, `totalTokensConsumed`, `tokensSavedByCompression`) to `0` and remove seeded demo user entries.
- **Per-Chat Debug & Token Telemetry (`types/index.ts`, `providers/ChatProvider.tsx`, `components/FreeAIPoolModal.tsx`)**:
  - Record a structured `ChatDebugTurnLog` for every chat turn capturing: `turnId`, `timestamp`, `provider`, `model`, `keyAliasUsed`, `promptTokens`, `completionTokens`, `totalTokens`, `tokensSavedByCompression`, `latencyMs`, `toolCallsCount`, `fallbackTriggered`, and `status`.
  - Automatically deduct exact consumed tokens from the active shared Free Pool key, trigger the 80% warning threshold, and seamlessly rotate to the next available key when a key reaches 100% of its token or time limit.

### Workstream D: Provider Model Catalog, Live Search with Yellow Highlight & Local/LM Studio Discovery
- **Comprehensive Provider Model Lists & Live Search (`constants/providers.ts`, `app/(tabs)/settings/index.tsx`, `components/HighlightedText.tsx`)**:
  - Update model catalogs across Gemini, OpenAI, Anthropic, OpenRouter, Groq, DeepSeek, xAI, Mistral, Perplexity, Together, Fireworks, Cohere, Pollinations, Ollama, and LM Studio with current official model IDs and display names.
  - Add a live search bar inside the Model Selector modal that filters models by ID, name, or capability and highlights every matching substring in **yellow text** (`#FACC15`).
- **Custom Provider, Local Model & LM Studio / Ollama Integration (`app/(tabs)/settings/index.tsx`, `app/api/models+api.ts`)**:
  - Under Custom Provider (`Benutzerdefiniert`), add dedicated quick-select presets and rows for **LM Studio (`http://localhost:1234/v1`)**, **Ollama (`http://localhost:11434/v1`)**, and **Custom Local/Remote OpenAI-Compatible Endpoint URL**.
  - Allow querying any custom endpoint URL (`Fetch Models from URL`) to dynamically load, search, and select available models.

### Workstream E: `Dev0` Identity, `.agents/` Sub-Agent Workspaces, Cron Jobs, Pause State & Direct Relay
- **`Dev0` Core Identity & English Agent Rules (`constants/agent.ts`, `utils/agent-tools.ts`, `providers/ChatProvider.tsx`)**:
  - Standardize the primary orchestrator identity as **Dev0** across prompts, headers, and sub-agent coordination headers.
- **`.agents/<agent-name>/` Structured Sub-Agent Folders (`utils/subagent-workspace.ts`)**:
  - Whenever `Dev0` or the user spawns or configures a Sub-Agent (e.g., `auditor`, `teamworker`, `localizer`, `developer`, `critic`, or custom), automatically initialize and maintain `.agents/<agent-name>/README.md`, `.agents/<agent-name>/RULES.md`, `.agents/<agent-name>/STATUS.md`, and `.agents/<agent-name>/LOG.md` in English.
  - Allow both `Dev0` and sibling Sub-Agents to read/update their `.agents/<agent-name>/` files to coordinate multi-step tasks without polluting the user's source tree.
- **Sub-Agent Lifecycle Tools (`finish_task`, `create_cron_job`, `sleep_agent`) (`utils/agent-tools.ts`, `utils/cron-scheduler.ts`, `providers/AgentProvider.tsx`)**:
  - **`finish_task` (`complete_subagent_task`)**: Mandatory completion tool that Sub-Agents invoke when their assigned work is finished, writing a structured summary to `.agents/<name>/STATUS.md` and notifying `Dev0` or dependent Cron jobs.
  - **`create_cron_job` / `list_cron_jobs` / `cancel_cron_job`**: In-app scheduler allowing `Dev0` or any Sub-Agent to register recurring or event-triggered tasks (e.g. run `auditor` after `developer` calls `finish_task`, or every $N$ minutes).
  - **`sleep_agent` / `wake_agent`**: Allows `Dev0` or the user to pause (`sleeping` state) and resume any Sub-Agent or Cron job with clear visual status indicators in the UI.
- **Interactive Sub-Agent Workflow Graph Card & Direct Relay (`components/SubAgentFloatingQuestionModal.tsx`, `components/MultiAgentUI.tsx`, `app/(tabs)/chat/index.tsx`)**:
  - Render an interactive visual Sub-Agent coordination graph/card directly in Chat showing active Sub-Agents (`Dev0` -> `teamworker` -> `auditor`), their `.agents/` status, Cron triggers, and a **"Request Changes / Adjust Workflow"** button.
  - When answering Sub-Agent questions or submitting change requests in the floating modal, immediately dispatch the structured prompt into `sendMessage()` (instead of only prefilling the text box) and persist the configured Sub-Agent in the saved list.

---

## 3. Verification & Git / PR Delivery Plan
1. **Automated Unit & Integration Tests (`__tests__/`)**:
   - Add comprehensive tests for zero-PII email masking, 3-tier RBAC permissions, real token accounting & automatic key rotation, `.agents/` workspace creation, Cron scheduler & `finish_task` triggers, and model search yellow highlighting.
2. **Static Analysis & Web Export**:
   - Run `npx tsc --noEmit`, `npm test`, `npm run export-web`, and `compile_applet`.
3. **Isolated Feature Branch & Pull Request**:
   - Commit all changes to a dedicated feature branch (`feat/dev0-sandbox-rbac-agents-cron`) and provide the ready-to-run branch push commands and English Pull Request template for `EZdev0/Dev0`.
