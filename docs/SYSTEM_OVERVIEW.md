# 📊 Dev0 System Overview & Architecture Reference (v1.9)

🇬🇧 **English** | 🇩🇪 [Deutsch](SYSTEM_OVERVIEW.de.md) · [⬅ Back to Documentation Hub](README.md) · [🌐 Master Concept](MASTER_CONCEPT.md)

**Version:** `v1.9.0` (2026-11-10)  
**Status:** ✅ Production Ready — **0 TypeScript Errors** | **92+ Automated Tests Passing**  
**Stack:** Expo SDK 54.0 | React Native 0.81 | React 19.1 | TypeScript 5.9 | Firebase Auth & Firestore | Docker Sandboxes

---

## 🎯 1. Executive Summary

**Dev0** is a cross-platform AI Software Engineering Workspace and Multi-Agent IDE running natively on **Web (`http://localhost:3000`), Android, iOS, and Docker Sandboxes**. Unlike early prototypes that relied on static identity files (`SOUL.md`, `USER.md`, `MEMORY.md`), Dev0 v1.9 operates on:
1. **Mutual-Exclusive Mode Isolation:** Normal Chat Mode (`.zip` & Plan Graphic Cards) vs. Agent Mode (46+ filesystem, Git, and Sub-Agent tools).
2. **Forced Extended Thinking & Animated Reasoning Orb:** Displays **only** the pulsing Reasoning Orb (`isLive && !hasRealReasoning`) before transitioning into a single text-streaming `ThinkingBlock`.
3. **Extra YAML Learning & `AGENTS.md` Engine:** Supports `.md`, `.yml`, `AGENTS.md`, and `.zip` skill pack uploads, automatic `! CORRUPTED YAML` detection, 1-click **"Fix with AI"** repair, and background vs. custom keyword/phrase triggers with bottom-right `Loaded:` attribution in Chat.
4. **Interactive 2D Synapse Memory & Codebase Graph:** Placed in `Tools -> Graph` (with `Dashboard` in Slot 1) featuring Node Drag-and-Drop, Left-Click Inspector, Right-Click / Long-Press Context Menu, and 2-hop Ego-Subgraph Code Localization.
5. **Server-Only Key Vault (`/api/pool`) & 50% Emergency Auto-Cutoff (*Not-Aus*):** Real Firebase Google Sign-In, Zero-PII 3-Tier RBAC (`owner` / `admin` / `user`), anti-jailbreak prompt inspection, 40% warning threshold, and 50% Emergency Stop without key deletion.

---

## 🧠 2. Core State & Runtime Providers (`providers/`)

### 2.1 `AppProvider.tsx` — Global Settings, YAML Skill Store, Key Pool & Modals
- Manages persistent `AppSettings`, `todos`, `memos` (Synapse Memory Graph nodes), `customSubAgents`, `uploadedSkillFiles`, `skillEnabledOverrides`, `skillTriggerOverrides` (`mode: 'always' | 'keywords' | 'manual'`, `keywords: string[]`), and `subAgentWorkflow`.
- Persists state across sessions via `AsyncStorage` and `IndexedDB`.
- Controls global interactive modals:
  - `showSubAgentStudioModal` (`SubAgentStudioModal`)
  - `showFreePoolModal` (`FreeAIPoolModal`)
  - `showTutorialModal` (`TutorialModal`)
  - `showMasterConceptModal` (`MasterConceptModal`)
  - `showSponsorModal` (`SponsorModal`)

### 2.2 `ChatProvider.tsx` — Dual-Mode AI Orchestration, Streaming & Skill Matching
- **Dynamic Skill Matching (`matchActiveSkillsForTurn`):** Evaluates all project and uploaded YAML skills / `AGENTS.md` contracts on every message turn, injects matching rules into the system prompt, and records `loadedSkills` on the user and assistant messages for the bottom-right `Loaded:` badge.
- **Strict Mode Isolation:**
  - When `agentMode === false` (Normal Chat Mode): Strips filesystem/Git/Sub-Agent mutation tools, enables `zip_create`, `zip_read`, `draft_agent_plan`, and `read_other_chat_messages`, converts any stray file writes into downloadable `.zip` archives, and intercepts `sub_agent` requests by opening the **Sub-Agent Floating Configuration Modal**.
  - When `agentMode === true` (Agent Mode): Disables chat-only `.zip`/draft tools and unlocks the full 46+ engineering tool suite.
- **Per-Chat Debug Telemetry (`ChatDebugLogEntry`):** Logs exact latency, API vs. BPE token counts (`cl100k`), tool calls, fallback stages, and pool key rotations.

### 2.3 `AgentProvider.tsx` — Autonomous Multi-Step Execution, Sub-Agents & Cron Jobs
- **Plan Creation & Execution:** Supports up to 25 structured steps (`task`, `thinking`, `brainstorm`, `web_search`, `sub_agent`) with automatic analysis phase insertion and interactive **Skip & Start Immediately** bypass (`SKIP_QUESTIONS_INSTRUCTION`).
- **Scoped Sub-Agents & Hidden `.agents/<slug>/` Workspaces:** Enforces glob file permissions (`isFileAllowedForSubAgent`), writes English status/log files inside `.agents/<slug>/`, and executes automated Cron workflows (`on_finish_task`, intervals) when `finish_task` completes.

### 2.4 `ProjectProvider.tsx` — Isolated User Sandboxes & 1-Click Project Deletion
- Isolates each user's projects in a dedicated namespace (`dev0_sandbox_projects_v2_<userId>`) and strips legacy self-source exposure (`sanitizeUserSandboxProjects`).
- Supports instant 1-click project deletion (`deleteProject`), classic File Tree navigation (`viewMode = 'tree'`), ZIP/JSON export, and Dual Git Restore Points.

---

## 🧩 3. Key UI Components (`components/` & `app/`)

| Component / Screen | Primary Responsibilities |
| :--- | :--- |
| **`app/(tabs)/(home)/index.tsx`** | Classic Project File Tree view (`viewMode = 'tree'`), 1-click Project Delete button, responsive wrapping toolbar (`Concept`, `Tutorial`, `Git`, `Synapse Graph`), and Built-in Git Restore Points modal. |
| **`app/(tabs)/chat/index.tsx`** | Dual-mode AI Chat screen with Normal/Agent mode toggle, Sub-Agent launcher bar, live Orb-only initial `ThinkingBlock`, and Floating Plan Refinement editor. |
| **`app/(tabs)/tools/index.tsx`** | 6-slot command center with **Dashboard in Slot 1**: `[Dashboard, Tools, Plans, Graph, Search, Chat]`. Includes Codebase & Synapse Graph Node search. |
| **`components/ThinkingBlock.tsx`** | Renders **only** the **Animated Reasoning Orb** when `isLive && !hasRealReasoning`, transitioning into **one single text-streaming box** once reasoning text arrives. |
| **`components/ChatBubble.tsx`** | Custom regex GFM markdown parser, interactive **ZIP Download Graphic Card**, **Execution Plan Graphic Card**, and bottom-right **`Loaded: <Skills / AGENTS.md>`** badge. |
| **`components/SynapseGraphView.tsx`** | Interactive 2D canvas with separate **Memory Graph** and **Project Code Graph** tabs, **Node Drag-and-Drop**, **Left-Click Inspector**, and **Right-Click / Long-Press Context Menu**. |
| **`components/SubAgentStudioModal.tsx`** | Visual builder for scoped Sub-Agents plus the **Extra YAML Learning & `AGENTS.md` Engine** (`.md`/`.yml`/`.zip` upload, `! CORRUPTED YAML` badge, 1-click **"Fix with AI"**, and trigger mode selector). |
| **`components/FreeAIPoolModal.tsx`** | "AI for Free" Shared Key Pool & Zero-PII 3-Tier RBAC Governance UI with Firebase Google Sign-In, custom numeric quota inputs (`0` = Unlimited), `40%`/`50%` *Not-Aus* sliders, and live Owner System Prompt editors. |
| **`components/MasterConceptModal.tsx`** | Bilingual (**EN / DE**) interactive Master Concept & System Architecture Explorer showcasing all 6 pillars, target personas, and direct feature launchers. |
| **`components/TutorialModal.tsx`** | Interactive 5-step English System Tutorial guiding users through Chat vs. Agent Mode, YAML Learning, Synapse Graph, Dual Git, and Key Vault safety. |

---

## ✅ 4. Verification & Quality Commands

```bash
# TypeScript strict verification (0 errors)
npm run typecheck

# Full automated test suite (92+ unit & integration tests)
npm test

# Static analysis suite
npm run lint
npm run lint:biome
npm run lint:oxlint
```
