# Implementation Plan: Dev0 v1.6 — Chat vs. Agent Tool Isolation, ZIP Bundles, Dual Git/Restore Points, Separate Memory & Project Graphs, 2026 Sub-Agent Lifecycle & 100% English UI

## 1. Architectural Overview & Core Goals

This plan upgrades **Dev0** to cleanly separate **Normal Chat Mode** from **Project Agent Mode**, eliminate hardcoded agent/skill presets, provide a dual-mode **Built-in Git & Restore Point System** (Docker real Git + Browser Snapshot fallback), split the **Synapse Graph** into separate **Memory Graph** (always available without a project) and **Project Code Graph** tabs, refine the **2026 Sub-Agent Architecture** with live read-only stream inspection, automatic Cron wakeup on `finish_task`, and a diagonal striped **AI Auto-Generate** lock state, fix initial **Thinking / Reasoning** streaming visibility, and ensure **100% English UI copy** across all screens and modals.

---

## 2. Normal Chat Mode vs. Agent Mode Tool Isolation & ZIP Artifacts

### Problem Fixed
Previously, when chatting in the standard **AI Chat** view without an active project or outside Agent Mode, the model still received project filesystem tools (`create_file`, `write_file`, `read_file`, `update_todo`), causing the AI to create project files in normal chat or hallucinate tools like `verify_file`.

### Solution Architecture
1. **Strict Mode-Aware Tool Filtering (`providers/ChatProvider.tsx`, `constants/tools.ts`)**:
   - **Normal Chat Mode (`chatMode === 'chat'` or no active project)**:
     - **Stripped**: All project filesystem and code-mutation tools (`read_file`, `write_file`, `create_file`, `edit_file`, `delete_file`, `list_files`, `search_files`, `localize_code_graph`, `execute_code`, `git_diff`).
     - **Allowed in Normal Chat Mode**:
       - **ZIP Bundle Tools (`zip_create`, `zip_read`)**: Allows the AI to package single or multiple generated files into an in-chat downloadable `.zip` archive (`ChatZipArtifact`) stored in the conversation state, and read/inspect entries from any ZIP artifact in the chat without requiring a full project. If a model attempts a raw `write_file` / `create_file` call in Normal Chat Mode, an intelligent interceptor automatically converts it into a `zip_create` artifact card so it never fails.
       - **Memory Tools (`memory_add`, `memory_search`, `memory_update`, `memory_delete`, `memory_graph_query`)**: Full access to persistent AI memories and the Memory Graph even when no project is open.
       - **Plan Drafting Tool (`draft_agent_plan`)**: Allows the AI to collaboratively design a structured execution plan in Normal Chat Mode and render it as an interactive **Plan Graphic Card** with **Proceed (Launch in Agent Mode)** and **Edit Plan** buttons.
       - **Token-Efficient Cross-Chat Reader (`read_other_chat_messages`)**: Allows any AI instance to search or read summarized/paginated messages across other chat sessions using BM25 keyword filtering and strict character caps (`maxChars: 1800`) to prevent token bloat.
       - **Web & Clarification Tools (`web_search`, `web_fetch`, `ask_user_question`)**.
   - **Project Agent Mode (`chatMode === 'agent'` with an active project)**:
     - Full access to project filesystem tools, `localize_code_graph`, Built-in Git & Restore Point tools, Sub-Agent orchestration (`spawn_sub_agent`, `finish_task`, `create_cron_job`, `sleep_agent`), plus Memory, ZIP, Cross-Chat, and Web tools.
   - **YOLO Mode & Permission Enforcement Audit**:
     - Audits `yoloMode` and per-tool permissions so disabled tools are excluded from both the system prompt schema and runtime tool dispatcher, while clarify-first rules ensure the Main Agent asks clarifying questions via `ask_user_question` before executing ambiguous multi-step plans.

2. **Interactive ZIP Artifact Graphic Card (`utils/chat-zip.ts`, `components/ChatZipCard.tsx`)**:
   - Generates real standards-compliant `.zip` binary archives in-memory (CRC32 + store/deflate headers, zero external native dependencies required) with a `data:application/zip;base64,...` or Blob download trigger.
   - Displays a crisp card inside the chat message stream showing archive name, file count, total byte size (`tabular-nums`), expandable file list preview, and a 1-tap **Download ZIP** button.

---

## 3. Interactive Chat Plan Graphic Card & Cross-Chat Message Reader

1. **Interactive Plan Card in Chat (`components/ChatPlanGraphicCard.tsx`, `app/(tabs)/chat/index.tsx`)**:
   - Whenever the AI drafts a plan in Chat (`draft_agent_plan` or structured plan state), renders a visual architecture/step card directly inside the chat stream.
   - Includes two primary actions:
     - **Proceed in Agent Mode**: Switches to Agent Mode (creating or selecting a sandbox project if needed) and starts autonomous execution of the approved steps.
     - **Edit / Refine Plan**: Opens a floating Plan Editor Modal where the user can directly edit steps/title or type a short instruction for the AI to revise the plan in-place.
2. **Token-Safe Cross-Chat Message Reader (`utils/cross-chat-reader.ts`)**:
   - Implements `read_other_chat_messages({ query?, conversationId?, limit?: 5 })` which indexes other user conversations locally, ranks matching messages via BM25/keyword relevance, strips tool noise, and returns concise snippets (`<= 1,800 chars`) with conversation title and timestamp.

---

## 4. Built-in Dual Git & Restore Point System (Docker Real Git + Browser Snapshot Engine)

1. **Unified Git & Restore Point Service (`utils/git-restore.ts`, `app/api/sandbox+api.ts`)**:
   - **Docker Container Mode (`/api/sandbox`)**: Executes real `git init`, `git status -s`, `git add -A && git commit -m "..."`, `git log --oneline`, and `git reset --hard <commit>` inside the isolated per-user sandbox directory (`/workspace/sandboxes/<userId>/<projectId>`).
   - **Browser IndexedDB Sandbox Fallback**: Automatically maintains lightweight content-addressed **Restore Points (Snapshots)** in IndexedDB (`dev0_git_snapshots_v1_<userId>_<projectId>`).
   - **Automatic Pre-Mutation Restore Points**: Before destructive or multi-file AI edits (`delete_file`, batch `write_file`), automatically records an auto-snapshot (`Auto Restore Point before <action>`) so deleted or broken files can always be recovered in 1 click.
2. **AI Git Tools & User Restore Point UI (`constants/tools.ts`, `components/GitRestoreModal.tsx`)**:
   - Exposes `git_create_restore_point`, `git_list_restore_points`, `git_restore_point`, and `git_status` to the AI in Agent Mode so both the AI and the user can inspect history and roll back project state at any time.

---

## 5. Separate Tabs for Memory Graph vs. Project Code Graph & Zero Hardcoded Presets

1. **Zero Hardcoded Sub-Agents or YAML Skills (`utils/skill-loader.ts`)**:
   - Empties `BUILT_IN_SUB_AGENT_TEMPLATES` and `BUILT_IN_YAML_SKILLS` so no hardcoded agents (`RepoGraph Localizer`, `UI/UX Component Architect`, `Security & Bug Auditor`) or hardcoded skills appear by default. Only genuine user-created or AI-created Sub-Agents and real `.agents/*` / `.qoder/rules/*` files in the active project are listed.
2. **Separate Graph Tabs (`components/SynapseGraphView.tsx`, `utils/synapse-graph.ts`, `app/(tabs)/(home)/index.tsx`)**:
   - **Tab 1: Memory Graph (Always Available — No Project Required)**:
     - Visualizes persistent `MemoEntry` nodes (user preferences, learned engineering rules, cross-chat facts, semantic tag clusters, and conversation links) as an interactive 2D neural synapse network.
     - Allows adding, editing, searching, and deleting memories directly from the Memory Graph view, plus new AI memory tools (`memory_search`, `memory_add`, `memory_update`, `memory_delete`, `memory_graph_query`).
   - **Tab 2: Project Code Graph (Active Project Only)**:
     - Visualizes project files, exported functions/classes/components, imports, and call edges. If no project is currently active, displays a clean empty state with a **Create Project** button rather than failing or mixing code nodes into the Memory Graph.

---

## 6. 2026 Sub-Agent Architecture: "AI Generate" Striped Lock UI, Live Read-Only Stream View, Cron Wakeup & Deletion

1. **100% English `SubAgentFloatingQuestionModal` + "AI Generate All" Striped Lock Overlay (`components/SubAgentFloatingQuestionModal.tsx`)**:
   - Translates every header, label, placeholder, and toggle into clean English (`Configure Sub-Agent & Answer Questions`, `1. Select Sub-Agent Role`, `2. Name (for Saved List)`, `Allowed Files (Globs)`, `Clarifying Questions — Relayed to Main Creator`, `3. Concrete Mission / Task`, `Save to Sub-Agent List`, `Send to Main Creator & Save`).
   - Replaces the bottom-left skip button with **"AI Generate All"**.
   - When clicked, activates an animated **diagonal striped, slightly dimmed lock overlay** across the modal (`isAiGeneratingConfig = true`, inputs disabled) while the AI automatically synthesizes the optimal Sub-Agent role, name, file globs, clarifying answers, and mission prompt, then populates the fields and submits.
2. **2026 Sub-Agent Creation Rules (`utils/subagent-workspace.ts`, `providers/AgentProvider.tsx`)**:
   - Enforces Single-Responsibility scoping, Clean-Slate vs. Forked Context Summary isolation, strict Least-Privilege tool allowlists per role, and mandatory termination via `finish_task`.
3. **Automatic Cron/Event Wakeup to Main AI on `finish_task` (`providers/ChatProvider.tsx`)**:
   - When a spawned Sub-Agent invokes `finish_task` (or completes its background run), the internal Cron/Event coordinator immediately wakes the Main AI with a structured handoff summary (`[SUB-AGENT HANDOFF COMPLETED]`) so the Main AI seamlessly continues without stalling.
4. **Live Read-Only Sub-Agent Inspector & Sub-Agent Deletion (`components/SubAgentLiveViewerModal.tsx`, `components/MultiAgentUI.tsx`, `app/(tabs)/chat/index.tsx`)**:
   - Displays currently working Sub-Agents with a live status badge. Clicking any active or completed Sub-Agent opens a **Live Read-Only Inspector Modal** showing its real-time thinking stream, tool calls, and `.agents/<slug>/LOG.md` output, with a **grayed-out, disabled bottom input bar** (`Read-Only Sub-Agent Stream — Managed by Main Agent`).
   - Adds a **Delete** button (trash icon with confirmation) on every saved and active Sub-Agent across `ChatScreen`, `AgentDashboard`, and `SubAgentStudioModal`.

---

## 7. Live Thinking / Reasoning Streaming Fix & Complete English Localization

1. **Immediate Thinking / Reasoning Display & Clean Markdown Formatting (`utils/ai-service.ts`, `providers/ChatProvider.tsx`, `components/ThinkingBlock.tsx`)**:
   - Updates `callOpenAI`, `callOpenRouter`, and `callGemini` to stream incremental deltas (including `<think>...</think>`, `reasoning_content`, and initial planning tokens) directly into the active message state from the first token, ensuring the **Thinking / Reasoning** block appears immediately when generation starts and formats markdown cleanly without raw tag leakage.
2. **100% English UI Audit Across the Entire Codebase**:
   - Audits and translates all remaining German UI strings in `app/(tabs)/chat/index.tsx`, `app/(tabs)/(home)/index.tsx`, `app/(tabs)/tools/index.tsx`, `app/(tabs)/settings/index.tsx`, `components/MultiAgentUI.tsx`, `components/AgentPlanView.tsx`, `components/FreeAIPoolModal.tsx`, `components/SubAgentFloatingQuestionModal.tsx`, and `utils/subagent-question-relay.ts` into crisp English.

---

## 8. Verification & Branch / PR Delivery

1. **Automated Unit Tests (`__tests__/`)**:
   - Add unit tests covering Normal Chat vs. Agent Mode tool isolation, `zip_create` / `zip_read` binary archive roundtrip, Cross-Chat BM25 message reader, Dual Git/Restore Point snapshots and rollback, Memory Graph vs. Project Code Graph separation, zero hardcoded Sub-Agents/Skills, and Sub-Agent `finish_task` wakeup relay.
2. **Quality Gates**:
   - Run `npx tsc --noEmit`, `npm test`, and `compile_applet` until 0 errors.
3. **Isolated Feature Branch & Pull Request**:
   - Commit all changes to a dedicated feature branch (`feat/v1-6-chat-zip-git-memory-graph-en`), push to remote, and provide the English Pull Request template.
