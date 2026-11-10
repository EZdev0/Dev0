# ⚡ Dev0 — Autonomous AI Software Engineering Workspace & Multi-Agent IDE (v1.9)

🇬🇧 **English** | 🇩🇪 [Deutsch](README.de.md) · 📖 **[Master Concept & Vision (EN)](docs/MASTER_CONCEPT.md)** · 📖 **[Master-Konzept & Vision (DE)](docs/MASTER_CONCEPT.de.md)** · 📚 **[Full Documentation Hub](docs/README.md)**

Welcome to **Dev0**, a cross-platform, self-evolving **Autonomous AI Software Engineering Workspace and Multi-Agent IDE** built with **Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9, and isolated Docker / IndexedDB Sandboxes**.

---

## 🌟 Why Dev0? (The 6 Core Pillars)

1. **Strict Dual-Mode Tool Isolation (Normal Chat vs. Agent Mode):**
   - **Normal Chat Mode (`agentMode: false`):** Project filesystem and background sub-agent tools are strictly isolated. Generated multi-file outputs are packaged into downloadable **PKZIP Graphic Cards** (`zip_create` / `zip_read`), architectural workflows are drafted as interactive **Execution Plan Graphic Cards** (`draft_agent_plan`), and Sub-Agent requests open the **Sub-Agent Floating Configuration Menu**.
   - **Agent Mode (`agentMode: true`):** Full access to **46+ engineering tools**, read-before-write file mutations, scoped Sub-Agent delegation, automated Cron jobs, and Dual Git Restore Points.
2. **Forced Extended Thinking (`<think>...</think>`) & Animated Reasoning Orb:**
   - Displays **only** the pulsing **Animated Reasoning Orb** while waiting for initial reasoning tokens (`isLive && !hasRealReasoning`), transitioning seamlessly into **one single text-streaming `ThinkingBlock`**—with end-to-end Gemini 2.5/3 `thoughtSignature` preservation and HTTP 400 self-healing.
3. **Extra YAML Learning Engine, `.ZIP` Skill Pack Importer & 1-Click AI Repair:**
   - Upload `.md`, `.yml`, `AGENTS.md`, or entire `.zip` skill packs (`importSkillsFromZipOrFiles`).
   - Automatically detects broken or missing YAML frontmatter (`! CORRUPTED YAML`) and repairs it in 1 click via **"Fix with AI"** (`repairCorruptedSkillContent`).
   - Configure each skill or `AGENTS.md` rule to load **Always (Background)**, on **Custom Trigger Words / Phrases / Letters**, or **Manually (`@skill`)**, with subtle bottom-right **`Loaded: <Skills / AGENTS.md>`** attribution on every chat bubble.
4. **Interactive 2D Synapse Memory & Codebase Graph (`Tools -> Graph`):**
   - Separate **Memory Graph** (works with or without an active project) and **Project Code Graph** tabs featuring **Node Drag-and-Drop**, **Left-Click Inspector**, **Right-Click / Long-Press Context Menu**, and **2-Hop Ego-Subgraph Code Localization (`localize_code_graph`)**.
5. **Scoped Multi-Agent Swarm, Live Read-Only Stream & `.agents/<slug>/` Cron Workflows:**
   - Configure custom glob-scoped Sub-Agents with the **"AI Generate All"** striped lock button, watch running Sub-Agents in a **Live Read-Only Stream Modal**, and automate recurring workflows via hidden `.agents/<slug>/` workspaces and `finish_task` Cron triggers.
6. **Zero-PII Server Key Vault (`/api/pool`), 50% Emergency Auto-Cutoff (*Not-Aus*) & Dual Git Restore:**
   - Server-side API key vault with anti-jailbreak prompt inspection, real Firebase Google Sign-In, 3-Tier RBAC (`owner` / `admin` / `user`), configurable `40%` warning alerts, and an automatic `50%` **Emergency Stop (*Not-Aus*)** that pauses keys **without deleting them**—paired with Browser + Docker Dual Git Restore Points.

---

## 🗂️ Repository & Module Documentation Index (EN / DE)

Every directory contains bilingual (**English & German**) documentation:

- 📖 **[docs/MASTER_CONCEPT.md](docs/MASTER_CONCEPT.md)** | **[docs/MASTER_CONCEPT.de.md](docs/MASTER_CONCEPT.de.md)** — Flagship Master Concept, Target Audiences & 6 Architectural Pillars
- 📚 **[docs/README.md](docs/README.md)** | **[docs/README.de.md](docs/README.de.md)** — Complete Documentation Hub (System Overview, Multi-Agent Guide, Audit Reports)
- 🧩 **[components/README.md](components/README.md)** — UI Components (`SynapseGraphView`, `ThinkingBlock`, `SubAgentStudioModal`, `MasterConceptModal`, `TutorialModal`)
- 🧠 **[providers/README.md](providers/README.md)** — State & Runtime Providers (`AppProvider`, `ChatProvider`, `AgentProvider`, `ProjectProvider`)
- 🛠️ **[utils/README.md](utils/README.md)** — Core Engines (`ai-service`, `skill-loader`, `synapse-graph`, `free-ai-pool`, `git-restore`, `chat-zip`)
- 📱 **[app/README.md](app/README.md)** & **[app/api/README.md](app/api/README.md)** — Expo Router Screens & Server API Routes (`/api/chat`, `/api/pool`, `/api/sandbox`, `/api/models`, `/api/search`, `/api/fetch`)
- 📐 **[types/README.md](types/README.md)** & **[constants/README.md](constants/README.md)** — TypeScript Contracts, 46+ Tool Schemas & IDE Theme Tokens
- 🧪 **[__tests__/README.md](__tests__/README.md)** & **[scripts/README.md](scripts/README.md)** — 92+ Automated Unit/Integration Tests & Build Patching Scripts

---

## 🚀 Quick Start & Verification

```bash
# 1. Install dependencies
npm install

# 2. Start the Web & API Development Server (Port 3000)
npm run dev

# 3. Run TypeScript Strict Typecheck (0 errors)
npm run typecheck

# 4. Run the Full Automated Test Suite (92+ tests)
npm test
```

---
*Architected and maintained by the Dev0 Engineering Team. Explore the [Master Concept (EN)](docs/MASTER_CONCEPT.md) / [Master-Konzept (DE)](docs/MASTER_CONCEPT.de.md) for the complete system vision.*
