# 🌐 Dev0 — Master Concept, Vision & System Architecture (v1.9)

🇬🇧 **English** | 🇩🇪 [Deutsch](MASTER_CONCEPT.de.md) · [⬅ Back to Documentation Index](README.md) · [🏠 Main README](../README.md)

> **"Zero Friction. Zero Hallucination. Infinite Autonomous Engineering."**  
> **Dev0** is a cross-platform, self-evolving Autonomous AI Software Engineering Workspace & Multi-Agent IDE built for **Web, Android, iOS, and Docker Sandboxes**.

---

## 1. Executive Summary & Core Philosophy

Modern AI coding tools force developers into an uncomfortable trade-off:
- **Chatbots** can generate isolated code snippets, but they lose context across turns, cannot safely manage multi-file architectures, and forget project conventions immediately.
- **Desktop-Locked IDEs** require heavy local installations, expose raw API keys in client environments, burn massive token budgets reading entire repositories sequentially, and cannot run natively on mobile devices or tablets.

**Dev0 solves this fundamental divide.**  
Built on **Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9, and isolated Docker / IndexedDB Sandboxes**, Dev0 unites a full multi-file code editor, an autonomous Multi-Agent Swarm, a 2D **Synapse Memory & Codebase Graph**, an **Extra YAML Learning Engine** with `.zip` skill pack importing and AI self-repair, a **Built-in Dual Git Restore Point System**, and a **Zero-PII Server-Side API Key Vault** into one cohesive workspace that runs everywhere.

---

## 2. What Dev0 Stands For (The 4 Core Principles)

| Principle | Meaning in Architecture | Measurable User Benefit |
| :--- | :--- | :--- |
| **01. Zero Context Loss** | 2D **Synapse Memory Graph** (`utils/synapse-graph.ts`) + BM25 Cross-Chat Reader (`utils/cross-chat-reader.ts`) + Extra YAML Learning (`utils/skill-loader.ts`). | The AI remembers architectural decisions, past chat solutions, and project rules without re-prompting. |
| **02. Zero Unintended Mutation** | Strict **Mutual-Exclusive Tool Isolation** between **Normal Chat Mode** (artifact-only `.zip` & Plan Cards) and **Agent Mode** (46+ filesystem, Git, and Sub-Agent tools). | Users never experience accidental file overwrites during casual brainstorming. |
| **03. Zero Credential Exposure** | **Server-Only Key Vault (`/api/pool`)**, Anti-Jailbreak Prompt Guard, 40% Owner Warning, and **50% Non-Destructive Emergency Auto-Cutoff (*Not-Aus*)**. | Teams and communities can share AI quotas safely without leaking raw API keys or exceeding budgets. |
| **04. Zero Platform Lock-In** | Native **iOS, Android, Web (PWA/SSR)**, and **Docker Sandbox** support + **10+ AI Providers** (Cloud APIs, Keyless Free Fallbacks, and Local Ollama / LM Studio). | Build, inspect, and deploy software from a workstation, laptop, tablet, or smartphone—online or locally. |

---

## 3. Who Dev0 Is Built For (Target Audiences & Personas)

### A. Solo Founders, Product Creators & Indie Builders ("Vibecoders")
- **Challenge:** Need to transform product ideas into working, multi-file applications rapidly without getting stuck in terminal configuration or losing working code during AI iterations.
- **How Dev0 Empowers Them:**
  - **Normal Chat Mode `.zip` & Plan Cards:** Brainstorm freely; the AI packages multi-file prototypes into 1-click downloadable PKZIP archives (`zip_create`) or interactive Execution Plan Cards (`draft_agent_plan`) with a **"Proceed in Agent Mode"** button.
  - **Built-in Dual Git & Restore Points:** Every milestone can be saved and restored in 1 click—across both browser storage (`IndexedDB`/`AsyncStorage`) and Docker Git commits (`/api/sandbox`).

### B. Senior Software Engineers & Systems Architects
- **Challenge:** Need deterministic control over autonomous agents, strict file-scope boundaries, real-time observability into reasoning and token usage, and zero-hallucination code navigation.
- **How Dev0 Empowers Them:**
  - **Scoped Sub-Agent Swarm & `.agents/<slug>/` Workspaces:** Delegate specialized tasks to `Analyst`, `Developer`, `Tester`, `Researcher`, or custom glob-scoped Sub-Agents. Every Sub-Agent maintains its own hidden English audit trail (`README.md`, `RULES.md`, `STATUS.md`, `LOG.md`) and can trigger automated Cron workflows on `finish_task`.
  - **2-Hop Ego-Subgraph Code Localization (`localize_code_graph`):** Instead of reading 50 files blindly, the AI queries the Synapse Graph to retrieve the exact exported symbols, imports, and callers relevant to a task—cutting token consumption by up to 75%.
  - **Per-Chat Debug Telemetry:** Real-time inspection of latency, exact API vs. BPE token counts (`cl100k`), tool calls, fallback stages, and key rotation events.

### C. Privacy-First Engineers & Local Open-Weight LLM Enthusiasts
- **Challenge:** Local models (Ollama, LM Studio, vLLM, Qwen, DeepSeek, Llama) often fail in standard IDEs because they emit XML `<tool_call>` tags or ReAct `Action:` text instead of strict OpenAI `tool_calls` JSON.
- **How Dev0 Empowers Them:**
  - **1-Tap Local Server Presets & Live `/api/models` Discovery:** Instant connection to **LM Studio (`:1234`)**, **Ollama (`:11434`)**, and **Local OpenAI-Compatible (`:8080`)** servers with live yellow model catalog search highlighting.
  - **3-Tier Hybrid Tool Parser (`utils/ai-service.ts`):** Automatically parses fenced JSON blocks, XML `<tool_call>`/`<tool>` tags, and ReAct `Action:` / `Action Input:` blocks with self-healing JSON repair (`repairAndParseJSON`).

### D. Engineering Teams, Educators, Hackathons & Open-Source Communities
- **Challenge:** Providing students, contributors, or hackathon participants with access to frontier LLMs without handing out raw API keys or risking runaway cloud bills.
- **How Dev0 Empowers Them:**
  - **"AI for Free" Shared Key Pool & Zero-PII 3-Tier RBAC:** Owners and Admins can provision shared keys in the server vault (`/api/pool`) scoped to specific `User ID`s, time windows, and token budgets—with masked emails (`j***s@gmail.com`), real Firebase Google Sign-In, configurable `40%` warnings, and an automatic `50%` Emergency Stop (*Not-Aus*) that pauses keys **without deleting them**.

---

## 4. The 6 Technological Pillars of Dev0 (Complete Capability Matrix)

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│                        DEV0 MASTER SYSTEM ARCHITECTURE (v1.9)                      │
├─────────────────────────────────────────┬──────────────────────────────────────────┤
│  1. DUAL-MODE INTELLIGENCE ENGINE       │  2. EXTENDED THINKING & ORB STREAMING    │
│  • Normal Chat Mode:                    │  • Forced <think>...</think> Reasoning   │
│    - Downloadable PKZIP Cards           │  • Animated Reasoning Orb while waiting  │
│    - Interactive Plan Draft Cards       │    for initial reasoning tokens          │
│    - Sub-Agent Floating Config Menu     │  • Transitions into a single clean       │
│  • Agent Mode:                          │    text-streaming ThinkingBlock          │
│    - 46+ File, Git, Web & Swarm Tools   │  • Gemini thoughtSignature Self-Healing  │
├─────────────────────────────────────────┼──────────────────────────────────────────┤
│  3. EXTRA YAML LEARNING & .ZIP ENGINE   │  4. 2D SYNAPSE MEMORY & CODE GRAPH       │
│  • Upload .md, .yml, AGENTS.md & .zip   │  • Standalone Memory Graph Tab           │
│  • Auto-detects Corrupted YAML (!)      │  • Project Codebase AST/Symbol Graph Tab │
│    with 1-Click "Fix with AI" Repair    │  • Node Drag-and-Drop, Left-Click        │
│  • Always (Background) vs. Custom       │    Inspector & Right-Click Context Menu  │
│    Trigger Words / Phrases / Letters    │  • 2-Hop Ego-Subgraph Code Localization  │
│  • Bottom-Right "Loaded:" Chat Badge    │  • Non-Destructive Stale Link Cleanup    │
├─────────────────────────────────────────┼──────────────────────────────────────────┤
│  5. SCOPED MULTI-AGENT SWARM & CRON     │  6. KEY VAULT, 3-TIER RBAC & DUAL GIT    │
│  • Floating Q&A Relay to Main Creator   │  • Server-Only Key Vault (/api/pool)     │
│  • "AI Generate All" Striped Lock UI    │  • 40% Owner Alert & 50% Emergency Stop  │
│  • Live Read-Only Sub-Agent Stream      │  • Anti-Jailbreak Prompt Inspection      │
│  • Hidden .agents/<slug>/ Workspaces    │  • Firebase Google Auth + 3-Tier RBAC    │
│  • finish_task & Automated Cron Jobs    │  • Browser + Docker Dual Git Restore     │
└─────────────────────────────────────────┴──────────────────────────────────────────┘
```

### Pillar 1: Strict Mutual-Exclusive Mode Isolation (Normal Chat vs. Agent Mode)
Dev0 enforces a hard architectural boundary between conversational assistance and autonomous workspace modification:
- **In Normal Chat Mode (`agentMode: false`):**
  - All project filesystem mutation tools (`write_file`, `edit_file`, `delete_file`), Git mutation tools, and direct background `sub_agent` spawning are **strictly stripped and blocked**.
  - Instead, the AI uses **`zip_create` / `zip_read`** (producing an interactive **ZIP Download Graphic Card** in the chat), **`draft_agent_plan`** (rendering an **Execution Plan Graphic Card** with floating refinement and 1-click **"Proceed in Agent Mode"**), **`read_other_chat_messages`** (token-efficient `< 1,750 char` BM25 cross-chat recall), and **Synapse Memory Graph tools**.
  - If the user asks to create or configure a Sub-Agent in Normal Chat Mode, Dev0 opens the **Sub-Agent Floating Configuration Modal** rather than running background agents silently.
- **In Agent Mode (`agentMode: true`):**
  - Normal-chat-only packaging tools (`zip_create`, `zip_read`, `draft_agent_plan`) are disabled so the agent works directly on the live sandboxed project tree using its 46+ engineering tools, scoped Sub-Agents, and Dual Git Restore Points.

### Pillar 2: Forced Extended Thinking & Animated Reasoning Orb
- **Structured Chain-of-Thought (`<think>...</think>`):** Every system prompt instructs the model to perform deep architectural analysis—checking active mode constraints, loaded YAML skills, and Synapse Memory nodes—before emitting final answers or tool calls.
- **Two-Stage Visual Feedback (`components/ThinkingBlock.tsx`):**
  1. **Stage 1 (Initial Reasoning Wait):** Displays **only** the pulsing **Animated Reasoning Orb** while waiting for initial reasoning tokens—zero empty or duplicate boxes.
  2. **Stage 2 (Live Text Streaming):** Smoothly transitions into **one single collapsible text-streaming box** as reasoning tokens arrive.
- **Cryptographic `thoughtSignature` Self-Healing:** Preserves Gemini 2.5/3 `thoughtSignature` and `extra_content.google.thought_signature` across all tool turns, and automatically flattens unsigned historical tool calls (`flattenUnsignedToolCalls`) if an upstream provider returns HTTP 400.

### Pillar 3: Extra YAML Learning Engine, `.ZIP` Skill Pack Importer & AI Repair
Dev0 replaces rigid, static identity files with a dynamic, self-healing **Extra YAML Learning & `AGENTS.md` Engine** (`utils/skill-loader.ts`, `components/SubAgentStudioModal.tsx`):
- **Single-File & `.ZIP` Pack Ingestion:** Upload individual `.md`, `.yml`, or `AGENTS.md` files—or drop an entire `.zip` archive of skills (`importSkillsFromZipOrFiles`), which Dev0 extracts and indexes client-side.
- **Automatic Corruption Detection (`!`) & 1-Click AI Fix:** If an uploaded `AGENTS.md` or skill file lacks valid `---` YAML frontmatter or has syntax errors, Dev0 flags it with an amber **`! CORRUPTED YAML`** badge and provides a **1-Click "Fix with AI"** button (`repairCorruptedSkillContent`) that converts raw markdown into valid YAML frontmatter without losing a single line of instructions.
- **Granular Activation Modes:** Each skill or `AGENTS.md` rule can be set to:
  - **Always (Background):** Injected automatically into every turn.
  - **Trigger Words / Phrases / Letters:** Loaded dynamically only when the user's message matches custom keywords, phrases, or prefixes (`matchActiveSkillsForTurn`).
  - **Manual (`@skill`):** Loaded on explicit mention.
- **Transparent Bottom-Right Attribution (`Loaded:`):** Every ChatBubble displays a subtle bottom-right indicator (`Loaded: <Skills / AGENTS.md>`) showing the exact rules and skills loaded by the system for that turn.

### Pillar 4: Interactive 2D Synapse Memory & Codebase Graph
Located in **`Tools -> Graph`** and accessible from the Projects toolbar (`components/SynapseGraphView.tsx`, `utils/synapse-graph.ts`):
- **Dual-Tab Architecture:**
  1. **Memory Graph Tab (Works With or Without a Project):** Visualizes persistent memories, architectural decisions, and YAML skills—manageable by both the user and the AI (`memory_search`, `memory_update`, `memory_delete`, `memory_graph_query`).
  2. **Project Code Graph Tab:** Indexes project files, exported functions, components, React hooks, classes, imports, and function calls into a live dependency network.
- **Direct Manipulation UX:**
  - **Node Drag-and-Drop:** Reposition and pin any node on the 2D canvas.
  - **Left-Click Inspector:** Inspect file paths, connected edges, code previews, and memory content.
  - **Right-Click / Long-Press Context Menu:** Focus 2-hop ego-subgraph, insert `@path` into Chat, highlight connected neighbors, or delete obsolete memory nodes.

### Pillar 5: Autonomous Multi-Agent Swarm, Floating Relay & `.agents/` Cron Workflows
- **Strict Question Tool Guard (`hasExplicitQuestionToolCall`):** The clarification banner (`Skip & Start Immediately`) appears strictly when `ask_user_question` is invoked as a real tool call or during an active clarifying plan—never from ordinary `?` characters in chat replies.
- **Floating Question Modal & "AI Generate All" Lock (`components/SubAgentFloatingQuestionModal.tsx`):** When a Sub-Agent needs configuration, a floating modal lets the user answer step-by-step or click **"AI Generate All"**, which locks the form with a diagonal striped overlay while AI completes the entire Sub-Agent specification and relays it to the Main Creator Agent.
- **Live Read-Only Sub-Agent Stream:** Clicking any running or saved Sub-Agent opens a live read-only execution stream with a disabled input bar so users can observe sub-agent reasoning safely.
- **Hidden `.agents/<slug>/` Workspaces & Cron Automation (`utils/subagent-workspace.ts`):** Every Sub-Agent maintains hidden English documentation (`README.md`, `RULES.md`, `STATUS.md`, `LOG.md`) excluded from user file exports, and supports `finish_task`, `create_cron_job`, `sleep_agent`, and `inspect_subagent_workspace`.

### Pillar 6: Zero-PII Server Key Vault, 50% Emergency Auto-Cutoff & Dual Git Restore
- **Server-Only Key Vault (`/api/pool`):** Shared API keys are stored server-side, masked in UI (`gsk_••••••••••••9a1f`), protected against prompt-injection key extraction (`inspectPromptForKeyJailbreak`), and hard-clamped on `max_tokens` (`clampMaxTokensForPoolKey`).
- **Configurable 40% Alert & 50% Non-Destructive Emergency Stop (*Not-Aus*):** Owners configure when to receive quota warnings (default `40%`) and when the automatic Emergency Cutoff triggers (default `50%`). When reached, the key transitions to `status: 'emergency_stop'` (`isActive: false`) **without ever deleting the key**, and automatically rotates to the next available key.
- **Keyless Resilience Cascade:** If no API key is configured, Dev0 automatically cascades across Rork (`2x` exponential backoff) -> keyless Pollinations AI (`openai`), plus a 4-stage keyless `web_search` and 3-stage `web_fetch` pipeline.
- **Built-in Dual Git & Restore Points (`utils/git-restore.ts`):** Synchronizes instant browser snapshots with isolated Docker `/api/sandbox` Git commits (`git_status`, `git_create_restore_point`, `git_list_restore_points`, `git_restore_point`).

---

## 5. Strategic Ecosystem Value & Partnership Vision

Dev0 is engineered as a **sustainable, high-impact platform** for the next era of software creation:
1. **Democratizing Autonomous Engineering:** By combining a Keyless Free AI Fallback, a governed Shared Key Pool (`/api/pool`), and first-class Local LLM support (Ollama / LM Studio), Dev0 enables developers, students, and builders worldwide to experience multi-agent software engineering regardless of hardware or budget constraints.
2. **Production-Verified Quality:** Backed by **92+ automated unit and integration tests** (`npm test`), strict zero-error TypeScript compilation (`npx tsc --noEmit`), and multi-linter static verification (`ESLint`, `Biome`, `Oxlint`).
3. **Open Ecosystem & Extensibility:** Through portable `.zip` YAML Skill Packs and standardized `AGENTS.md` contracts, teams and technology partners can publish domain-specific engineering skills (Cloud, Security, WebGL, Mobile, Data Science) that plug directly into Dev0 with zero code changes.

---

*For hands-on technical details, explore the [System Overview (EN)](SYSTEM_OVERVIEW.md) / [Systemübersicht (DE)](SYSTEM_OVERVIEW.de.md), [Multi-Agent Architecture (EN)](MULTI_AGENT_IMPLEMENTATION.md) / [Multi-Agenten-Architektur (DE)](MULTI_AGENT_IMPLEMENTATION.de.md), and [Security & Audit Report (EN)](AUDIT_REPORT.md) / [Sicherheits- & Audit-Bericht (DE)](AUDIT_REPORT.de.md).*
