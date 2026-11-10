# 🚀 Multi-Agent Swarm, Extra YAML Learning & Synapse Memory Graph (v1.9)

🇬🇧 **English** | 🇩🇪 [Deutsch](MULTI_AGENT_IMPLEMENTATION.de.md) · [⬅ Back to Documentation Hub](README.md) · [🌐 Master Concept](MASTER_CONCEPT.md)

---

## ✅ 1. Architecture Overview (v1.9)

Dev0's autonomous intelligence is built on three tightly integrated engines that replaced the legacy 5 identity files (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`) and legacy `.qcoder/memos` system:

1. **Extra YAML Learning & `AGENTS.md` Engine (`utils/skill-loader.ts`, `components/SubAgentStudioModal.tsx`):**
   - Modular, YAML-frontmatter skills and `AGENTS.md` contracts with `.zip` skill pack importing (`importSkillsFromZipOrFiles`), automatic corruption detection (`! CORRUPTED YAML`), 1-click **"Fix with AI"** repair (`repairCorruptedSkillContent`), and configurable **Always (Background)** vs. **Custom Trigger Words / Phrases / Letters** (`matchActiveSkillsForTurn`).
2. **Scoped Multi-Agent Swarm & Hidden `.agents/<slug>/` Workspaces (`utils/subagent-workspace.ts`, `utils/subagent-question-relay.ts`, `components/SubAgentFloatingQuestionModal.tsx`):**
   - Specialized built-in and custom glob-scoped Sub-Agents (`Analyst`, `Developer`, `Tester`, `Researcher`), Floating Question Relay with **"AI Generate All"** striped lock overlay, **Live Read-Only Sub-Agent Stream Modal**, and automated Cron workflows (`create_cron_job`, `finish_task`, `sleep_agent`).
3. **Interactive 2D Synapse Memory & Codebase Graph (`utils/synapse-graph.ts`, `components/SynapseGraphView.tsx`):**
   - Standalone **Memory Graph** (usable with or without an active project) and **Project Code Graph** with **Node Drag-and-Drop**, **Left-Click Inspector**, **Right-Click / Long-Press Context Menu**, and **2-Hop Ego-Subgraph Code Localization (`localize_code_graph`)**.

---

## 📚 2. Extra YAML Learning & `AGENTS.md` Engine

### 2.1 Valid YAML Frontmatter Schema
Every skill file (`.md`, `.yml`) and `AGENTS.md` contract uses standard YAML frontmatter:

```yaml
---
name: "WebGL & Physics Safety Guard"
description: "Enforces strict separation between Three.js visual meshes and Cannon/Ammo physics bodies."
trigger: "custom"
triggerWords:
  - "physics"
  - "three.js"
  - "webgl"
alwaysApply: false
globs:
  - "src/**/*.ts"
  - "components/**/*.tsx"
---

# Operational Rules
1. Never mutate `mesh.position` directly when attached to a physics body.
2. Always call `.dispose()` on geometries, materials, and textures on cleanup.
```

### 2.2 `.ZIP` Skill Pack Importer & 1-Click AI Corruption Repair
- **Single & `.ZIP` Upload (`importSkillsFromZipOrFiles`):** Users can upload individual `.md` / `.yml` / `AGENTS.md` files or drop a `.zip` archive containing multiple skills. Dev0 extracts all files in the browser, strips `.qoder/` and `.qcoder/` prefixes (`formatSkillSourceForDisplay`), and indexes them immediately.
- **Corrupted YAML Detection (`isCorrupted`):** If an uploaded `AGENTS.md` or skill file is missing `--- ... ---` YAML frontmatter or has malformed YAML syntax, it is flagged with an amber **`! CORRUPTED YAML`** badge in `SubAgentStudioModal`.
- **1-Click "Fix with AI" (`repairCorruptedSkillContent`):** Clicking **"Fix with AI"** synthesizes a clean, valid YAML frontmatter block (`name`, `description`, `trigger`, `alwaysApply`, `globs`) while preserving 100% of the markdown instructions.
- **Bottom-Right `Loaded:` Badge (`components/ChatBubble.tsx`):** Every chat turn records which background and keyword-triggered skills were loaded (`loadedSkills`) and displays `Loaded: <Skills / AGENTS.md>` at the bottom right of the chat bubble.

---

## 🤖 3. Scoped Multi-Agent Swarm & `.agents/<slug>/` Workspaces

### 3.1 Normal Chat Mode vs. Agent Mode Sub-Agent Rules
- **In Normal Chat Mode (`!agentMode`):** The chatbot cannot silently spawn background Sub-Agents. If the user asks to configure or launch a Sub-Agent, Dev0 opens the **Sub-Agent Floating Configuration Modal** (`SubAgentFloatingQuestionModal`) or lets the user pick a saved Sub-Agent from the launcher bar above the chat input.
- **In Agent Mode (`agentMode: true`):** The Main Agent can delegate parallel or specialized tasks via the `sub_agent` tool and coordinate execution across the swarm.

### 3.2 Floating Question Relay & "AI Generate All" Lock
- When a Sub-Agent requires clarification via `ask_user_question` (`hasExplicitQuestionToolCall`), `SubAgentFloatingQuestionModal` opens.
- Clicking **"AI Generate All"** activates a diagonal striped lock overlay over the input fields (`generateCompleteSubAgentConfig`), populates the Sub-Agent's name, role, system prompt, and file globs in English, saves the template to the **Saved Sub-Agents List**, and relays the structured specification to the Main Creator Agent (`buildMainCreatorRelayPrompt`).

### 3.3 Hidden `.agents/<slug>/` Workspaces & Cron Automation
Every Sub-Agent maintains four hidden English audit files inside `.agents/<slug>/` (automatically hidden from normal user file trees via `filterVisibleUserFiles`):
- `.agents/<slug>/README.md` — Role overview and scope
- `.agents/<slug>/RULES.md` — Allowed file globs and safety constraints
- `.agents/<slug>/STATUS.md` — Current lifecycle state (`idle`, `running`, `sleeping`, `completed`)
- `.agents/<slug>/LOG.md` — Timestamped execution log and `finish_task` summaries

---

## 🕸️ 4. Interactive 2D Synapse Memory & Codebase Graph

Located in **`Tools -> Graph`** (`components/SynapseGraphView.tsx`):
- **Memory Graph Tab:** Works even when no project is open (`buildMemoryOnlySynapseGraph`). Visualizes persistent memories and YAML skills and connects with AI tools `memory_search`, `memory_update`, `memory_delete`, and `memory_graph_query`.
- **Project Code Graph Tab:** Visualizes files, exported symbols, imports, and function calls (`buildSynapseGraph`) and powers `localize_code_graph`.
- **Interactive Controls:**
  - **Drag & Drop:** Drag any node to a custom position and pin it.
  - **Left-Click:** Open the Node Inspector drawer with code/memory details and connected edges.
  - **Right-Click / Long-Press:** Open the context menu to focus a 2-hop subgraph, insert `@path` into Chat, highlight neighbors, or delete a memory node.
