# AI Mega Brain: RepoGraph Synapse Memory, Local LLM Tool Parser, Custom Sub-Agents & "AI for Free" Key Pool

An advanced, zero-fragility engineering upgrade for AI Mega Brain that combines AST-driven **Synapse Memory Graphs** (inspired by open-source *RepoGraph* and *LocAgent* architectures), a **3-Tier Hybrid Tool Parser** for local and open-weight models, automatic **YAML Skill & Learning File Loading**, **User/AI-Callable Custom Sub-Agent Templates**, and an intelligent **"AI for Free" Shared Key Pool** with real API token telemetry and masked key rotation.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> This revised blueprint integrates every requirement from your feedback while preserving 100% of existing features without removing or breaking any existing workflows:

- **Confirmed: RepoGraph / LocAgent Synapse Memory System (No Fake Data)**: Pressing **Projects** (or switching to Graph Mode in Projects/Dashboard) displays all projects and renders an interactive neural **Synapse Memory Graph**. If no project exists, users can create one directly on the graph canvas. It parses real project files to localize **Files**, **Functions/Classes/Hooks**, **Import/Call Relationships**, and **Linked Memories/Lessons** as connected synapses.
- **Confirmed: Local LLM Resilience & 3-Tier Hybrid Tool Parser**: Local models (Ollama, LM Studio, custom OpenAI endpoints, quantized models) are supported via a 3-tier parser:
  1. Native `tool_calls` / `functionCall` API objects.
  2. Lenient JSON block extraction with automatic syntax repair.
  3. ReAct XML/Tag fallback (`<tool>...</tool><args>...</args>`) and compact tool-guidance rules so local models reliably invoke tools without schema failures.
- **Confirmed: YAML Skill & Learning File Auto-Discovery**: Automatically detects and loads Markdown/YAML rule and skill files (including `trigger: always_on`, `alwaysApply: true`, `name`, `description` frontmatter from `.qoder/rules`, project rule folders, and custom skills) into the active agent context and learning system.
- **Confirmed: Manual Sub-Agent Templates (User & AI Callable)**: Users can create custom Sub-Agent templates specifying **System Prompt**, **Rules**, **Allowed Tools**, and **Allowed File Scopes**. These sub-agents can be customized per task, triggered manually by the user, or called autonomously by the primary AI agent via a `delegate_to_sub_agent` tool.
- **Confirmed: "AI for Free" Key Pool & Real Token Accounting**: A dedicated **"AI for Free"** button in Settings and Provider selectors opens a floating window where users can contribute or activate shared keys with **Token Quotas** and/or **Time Limits**. Raw keys remain strictly hidden/masked (`••••`) from other users, intelligently switch per `User ID` upon quota/time expiration, read exact token usage from API responses (`usage` / `usageMetadata` + BPE subword tokenizer), and trigger proactive warnings and recommendations.
- **Confirmed: Zero-Config Storage & First-User Super Admin**: Instant local persistence (`IndexedDB` + `AsyncStorage`) where the first user becomes Admin with user management, timeouts, and chat moderation.

---

### 1. Overview & Core Concept

Modern open-source coding agents (*RepoGraph*, *LocAgent*, *SWE-agent*, *MemGPT/Letta*) prove that flat text dumps burn excessive tokens and confuse smaller models. AI Mega Brain resolves this by combining **Graph-Based Code Localization** with **Hierarchical Sub-Agent Routing** and **Community Key Pooling**.

- **Target Persona**: Developers and power users running complex multi-file tasks across cloud and local LLMs who demand full visibility into file-function relationships, strict token budget control, and customizable multi-agent workflows.
- **Core Value**:
  1. **Drastic Token Reduction**: Instead of sending entire files repeatedly, the agent queries the Synapse Graph for localized function signatures and relevant memories, compressing historical turns automatically.
  2. **Universal Model Compatibility**: Cloud frontier models (Gemini 2.5 Pro/Flash, Claude, GPT-4o) and local models (Ollama, LM Studio) work seamlessly with every tool.
  3. **Collaborative Free AI**: Shared keys rotate transparently by User ID, time limit, and real token consumption without exposing private credentials.

---

### 2. User Experience & Visual Design

Designed in accordance with the **Universal Frontend Design Constitution** and **SaaS Developer Console** standards:

#### A. Key User Flows

1. **Projects & Interactive Synapse Memory Graph**:
   - Opening the **Projects** tab shows the project switcher bar with a prominent **Synapse Graph / Tree View** toggle (and empty-state **"Create First Project in Graph"** action when no projects exist).
   - The **Synapse Canvas** renders interactive nodes:
     - **Project Root Node** (Royal Blue)
     - **File Nodes** (Indigo/Slate)
     - **Exported Functions, Components & Hooks** (Amber, extracted via live code AST/regex analysis)
     - **Memory & Lesson Nodes** (Emerald, linked to the exact files and functions they govern)
     - **Skill / Rule Nodes** (Cyan, showing loaded YAML skills)
   - Clicking any synapse node highlights its incoming/outgoing call and import edges, shows exact line numbers, displays attached memories, and lets the user open the file at that function or attach a new memory synapse.

2. **YAML Skill Loader & Learning System Overhaul**:
   - The system scans project files and rule directories for YAML frontmatter blocks (`--- \n trigger: always_on \n alwaysApply: true \n ---`).
   - Detected skills and rules (`Agent.md`, `lessons_learned.md`, `user.md`, and custom `SKILL.md` files) appear in an interactive **Skills & Rules Registry** where users can inspect parsed metadata, toggle activation, or create new YAML-headed skill files.

3. **Manual Sub-Agent Studio (User & AI Callable)**:
   - In the **Tools / Sub-Agents** view, users can create and manage custom **Sub-Agent Templates**.
   - Each template defines:
     - **Template Name & Role Description**
     - **Custom System Prompt & Strict Rules**
     - **Allowed Tools Matrix** (checkboxes for read, write, search, web, memory tools)
     - **Allowed File/Folder Patterns** (e.g., `app/**`, `utils/**`, or specific filenames the sub-agent is permitted to touch)
   - Users can assign a task directly to any template, and the primary AI agent automatically receives a `delegate_to_sub_agent` tool to spawn these user-defined templates autonomously when a task matches their specialty.

4. **"AI for Free" Floating Window, Key Pool & Notification Engine**:
   - Clicking **"AI for Free"** in Settings or the Provider bar opens the **Floating Key Pool Manager**.
   - **Share a Key**: A user selects a provider + model, enters an API key (immediately encrypted/masked so no other user can ever view or copy the raw key), and sets:
     - **Max Token Allowance** (e.g., `25,000`, `100,000`, `500,000` tokens)
     - **Max Duration** (e.g., `30 min`, `2 hours`, `24 hours`, `Unlimited`)
     - **Target User Scope** (All Free Pool users or specific `User ID`)
   - **Real Token Telemetry & Smart Switching**:
     - Every API call captures exact `prompt_tokens` + `completion_tokens` from provider headers/JSON bodies (with a real BPE subword tokenizer fallback for raw streams) and deducts them from the active pool key.
     - When a key reaches 80% usage or nears expiration, a non-intrusive warning banner notifies the user. At 100% or timeout, the router switches in-place to the next valid pool key or free endpoint without dropping the chat turn.
     - If a user has no API key configured or experiences rate limits, an interactive recommendation banner suggests activating the **"AI for Free"** pool with one tap.

#### B. Visual Identity & Theme
- **Aesthetic Direction**: High-precision neural IDE console with crisp 1px structural borders, zero static pill clutter, and responsive touch targets ($\ge 44\text{px}$).
- **Color Palette (60-30-10)**:
  - **60% Neutral Canvas**: Deep Carbon Slate (`#0B0F17`)
  - **30% Structural Surfaces**: Elevated Panel Slate (`#151C28`) with subtle hairline dividers (`#1E293B`)
  - **10% Semantic Accents**: Primary Blue (`#3B82F6`), Synapse Emerald (`#10B981`), Function Amber (`#F59E0B`), Alert Crimson (`#EF4444`)
- **Typography**: `Plus Jakarta Sans` for UI hierarchy and `JetBrains Mono` (`tabular-nums`) for token counters, line numbers, and graph telemetry.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Real Code Indexing for the Synapse Graph (RepoGraph / LocAgent Pattern)**
  - *Chosen Approach*: Build a deterministic client-side AST/Regex Code & Memory Indexer that scans all project files for `import`, `export`, `function`, `const`, `class`, and `interface` declarations, cross-referencing them with `Memo.linkedFiles` and YAML skills.
  - *Why*: Provides 100% authentic localization of files, functions, and cross-file dependencies without requiring an external Neo4j server, working offline and on Netlify.

- **Decision 2: 3-Tier Hybrid Tool Parser for Local & Open-Weight Models**
  - *Chosen Approach*: Combine native OpenAI/Gemini tool calling with a fallback parser that extracts JSON blocks and `<tool>` / `<args>` XML tags, paired with an automatic file-permission guard that checks sub-agent allowed file scopes before any write operation.
  - *Why*: Local models frequently emit tool calls inside markdown code blocks or XML tags rather than strict API fields; the 3-tier parser makes local models reliable first-class citizens.

- **Decision 3: Real API Usage Extraction + BPE Token Estimator**
  - *Chosen Approach*: Extract exact token counts from OpenAI/Groq/OpenRouter `usage` payloads and Gemini `usageMetadata` blocks, backed by a deterministic cl100k-style subword token counter for streaming/local endpoints.
  - *Why*: Eliminates fake counters or static placeholders and guarantees accurate quota enforcement for shared keys.

---

### 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AI MEGA BRAIN CORE ARCHITECTURE                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  Presentation & Interactive Views                                            │
│  ├── Projects Screen: File Tree View ◄──► Interactive Synapse Memory Graph   │
│  ├── Floating "AI for Free" Window: Masked Key Pool, Quotas, User ID Router  │
│  ├── Sub-Agent Studio: Template Builder (Prompt, Rules, Tools, File Scopes)  │
│  ├── Skills & Learning Panel: YAML Frontmatter Inspector & Rule Toggles      │
│  └── Admin Governance Console: First-User Admin, Timeouts, Chat Moderation   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Intelligence, Parsing & Localization Engines                                │
│  ├── Synapse Graph Indexer: Parses Files -> Functions -> Imports -> Memos    │
│  ├── 3-Tier Tool Parser: Native API ──► Repaired JSON ──► ReAct XML Tags     │
│  ├── YAML Skill Loader: Scans frontmatter (trigger, alwaysApply, tools)      │
│  ├── Context Compressor: Subgraph localization + thoughtSignature healing    │
│  └── Token Accounting Engine: API usageMetadata reader + BPE subword counter │
├──────────────────────────────────────────────────────────────────────────────┤
│  Zero-Config Persistent Storage (IndexedDB on Web / AsyncStorage on Native)  │
│  └── Stores: Projects, Synapse Edges, SubAgentTemplates, SharedKeyPool, Users│
└──────────────────────────────────────────────────────────────────────────────┘
```

#### A. Core Data Models

- **SynapseGraphNode & Edge**:
  - `Node`: `{ id, type: 'project' | 'file' | 'function' | 'memo' | 'skill', label, filePath?, lineNumber?, snippet?, metadata }`
  - `Edge`: `{ id, source, target, relation: 'contains' | 'imports' | 'calls' | 'remembers' | 'governs' }`
- **ParsedYamlSkill**:
  - `{ id, name, description, trigger: 'always_on' | 'manual' | 'keyword', alwaysApply: boolean, sourcePath: string, body: string, enabled: boolean }`
- **CustomSubAgentTemplate**:
  - `{ id, name, role, systemPrompt, rules: string[], allowedTools: string[], allowedFiles: string[], canBeCalledByAI: boolean, createdAt: number }`
- **SharedPoolKey**:
  - `{ id, provider, model, maskedKey: string, encryptedPayload: string, contributedByUserId: string, targetUserId?: string, tokenLimit: number, tokensUsed: number, expiresAt: number | null, status: 'active' | 'exhausted' | 'expired' }`

#### B. Interactive Component & Handler Mapping
1. **Projects & Synapse Graph View**:
   - Working handlers to switch between Tree and Synapse Graph modes, filter nodes by type (Files, Functions, Memories, Skills), zoom/pan the graph, click a node to inspect its callers/callees and linked memories, open the exact file in the editor, or create a new project/memory directly from the graph.
2. **Sub-Agent Template Builder & Runner**:
   - Working handlers to create, edit, duplicate, and delete sub-agent templates; toggle allowed tools; define allowed file patterns (enforced at runtime before `write_file`/`edit_file`/`delete_file`); run a sub-agent manually on a custom task; and expose `delegate_to_sub_agent` to the main AI.
3. **YAML Skill & Learning Loader**:
   - Working parser that automatically reads `.qoder/rules/*` and project `.md` files with YAML headers, displays them in the UI, lets users toggle or create new skill files, and injects active skills into agent prompts.
4. **"AI for Free" Floating Pool Modal & Notification Banner**:
   - Working handlers to add a shared key with token/time limits and optional target `User ID`, activate/deactivate free pool routing, inspect real-time token consumption per key (with zero exposure of raw key strings), receive warnings at 80%/100% consumption, and auto-rotate keys on exhaustion.
