# Dev0 v1.8 — Extra YAML Skill & AGENTS.md Learning Engine, Interactive Drag-and-Drop Synapse Graph, Animated Reasoning Orb + Single Streaming Box, Classic Projects View & Interactive English Tutorial

This plan restructures **Dev0** into a cleanly separated, responsive desktop-and-Android IDE experience: removing legacy Beta Memory (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md` and the old `Memos` tab), introducing the **Extra YAML Learning & Skill Engine** (with `.zip` skill pack import, corrupted-file `!` detection, 1-click **AI Fix**, and custom keyword/phrase triggers), restoring the classic **Projects** file-tree view with working project deletion, placing **Dashboard** in the first slot of **Tools** (`[Dashboard, Tools, Plans, Graph, Search, Chat]`), upgrading the **Synapse Graph** with drag-and-drop and left/right-click menus, replacing duplicate thinking boxes with a **Pulsing Reasoning Orb → Single Text-Streaming Extended Thinking Box**, and adding an **Interactive English Tutorial & Architecture Guide**.

---

## User Review & Confirmed Decisions

> [!IMPORTANT]
> All three core UX and architectural decisions were confirmed in Phase 1 and take highest precedence:

- **Confirmed Decision 1 — Animated Reasoning Orb → Single Text-Streaming Thinking Box**:
  - While the AI initiates forced extended reasoning, display **only** a sleek animated **Reasoning Orb** (no duplicate boxes). As reasoning tokens/text stream in, render **only one** unified text-streaming Extended Thinking box (`<think>...</think>` forced in system prompt).
- **Confirmed Decision 2 — Auto-Extract Skills from `.zip` & Flag Corrupted YAML with 1-Click AI Fix**:
  - Users can upload `.md` / `.yml` / `AGENTS.md` files or `.zip` skill bundles directly on-site. All valid YAML skills are auto-extracted and registered; any file with missing or corrupted YAML frontmatter is listed with an **Exclamation Warning (`!`)** and a **"Fix with AI"** button that automatically repairs and formats the file into valid YAML frontmatter.
- **Confirmed Decision 3 — Classic Projects View + Graphs & Interactive English Tutorial in Tools**:
  - The **Projects** tab returns to the clean classic File Tree & Project Switcher (with an explicit **Delete Project** button and fixed per-user storage cleanup) plus a quick launcher to the **Git & Restore Points** modal.
  - The **Tools** tab places **Dashboard** in **Slot 1** (`Dashboard` → `Tools` → `Plans` → `Graph` (replaces `Memos`) → `Search` → `Chat`), hosts the interactive **Synapse Memory & Code Graph**, and includes a comprehensive **English Interactive Tutorial** explaining every workflow.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Complete Removal of Legacy Beta Memory & 5 Identity Files**: Strips `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, legacy non-YAML `AGENTS.md`, `betaAgentLearning`, and the old `Memos` list from Settings, Tools, and all AI System/Planner prompts.
  2. **Extra YAML Learning & Skill System (`.qoder` Hidden from Display)**:
     - Recognizes `AGENTS.md` and Skill `.md`/`.yml` files strictly via structured YAML frontmatter (`name`, `description`, `trigger`, `keywords`, `alwaysApply`).
     - Hides internal `.qoder/` path prefixes in the UI so skills display clean human titles and source badges.
     - Supports **3 Trigger Modes** per skill / `AGENTS.md`:
       - **Always Load (Background)** (`always_on`)
       - **Custom Trigger Words / Phrases / Letters** (`keywords: ["auth", " refactor ", "fix bug"]`)
       - **Manual / On-Demand** (`manual`)
     - Supports uploading individual `.md`/`.yml` files or `.zip` archives containing multiple skills/rules. Files with missing or broken YAML frontmatter are flagged as **Corrupted / Invalid YAML (`!`)** with a 1-click **"Fix with AI"** button and explicit AI formatting instructions so the AI repairs them in-place.
  3. **Subtle Bottom-Right Active Skills & `AGENTS.md` Indicator in Chat**:
     - Whenever a message is sent and processed, the chat turn records and displays a compact, unboxed typographic caption at the bottom-right of the message showing exactly which Skills and/or `AGENTS.md` rules the system loaded and used for that turn (not just user-typed triggers, but all background + keyword-matched skills actually injected).
  4. **Normal Chatbot Sub-Agent Menu Enforcement**:
     - In Normal Chat Mode, the chatbot can **never** directly spawn or run a Sub-Agent on its own. If the user asks to create or use a Sub-Agent, the chatbot opens the **Sub-Agent Configuration Floating Modal** (`SubAgentFloatingQuestionModal`). If a Sub-Agent template/definition is already configured or completed in that modal, it is then created and saved to the Sub-Agents list.
  5. **Forced Extended Thinking + Animated Orb → Single Streaming Box**:
     - Enforces `<think>...</think>` extended reasoning across AI turns so the model always reasons thoroughly before acting.
     - Eliminates duplicate thinking boxes: shows a **Pulsing Reasoning Orb** while waiting/initializing, and transitions into **one** clean text-streaming reasoning box once reasoning text streams in.
  6. **Classic Projects View, Working Project Deletion & Tools Re-Ordering (`Dashboard` First)**:
     - Restores the classic **Projects** screen (file tree, file actions, project tabs with an explicit trash/delete button that properly deletes from both `AsyncStorage` and `IndexedDB`,even when deleting the last project).
     - Re-orders the **Tools** sub-tabs to: **`1. Dashboard` | `2. Tools` | `3. Plans` | `4. Graph` | `5. Search` | `6. Chat`**.
     - Replaces `Memos` with **`Graph`** (Interactive Synapse Memory & Code Graph supporting **Drag & Drop** node positioning, **Left-Click** Node Inspector, and **Right-Click** Context Menu for Pin, Edit, Link, and Delete).
     - Upgrades **`Search`** in Tools to display the **Codebase Structure Tree & Interactive Graph Nodes** alongside text/symbol search matches.
     - Adds an **Interactive English Tutorial** modal accessible from Tools and Projects that walks through Chat vs. Agent Mode, YAML Skills & `.zip` Upload/AI-Fix, the Synapse Graph, Sub-Agents & Cron Jobs, and Git Restore Points.
  7. **Fix `Unexpected text node: . A text node cannot be a child of a <View>` & Responsive Window Scaling**:
     - Sanitizes all JSX `<View>` children across the entire app so stray dots (`.`), whitespace text nodes, or boolean/string short-circuits never render raw strings inside `<View>`.
     - Uses wrapping flex rows (`flexWrap: 'wrap'`), horizontal scroll containers with `flexShrink: 0`, and responsive breakpoints so shrinking the browser window on PC or running on Android never hides or clips action buttons or custom tool cards.

---

## 2. User Experience & Visual Design

- **Aesthetic Direction & Color Palette**:
  - **60% Dominant Canvas**: Deep Slate (`#0B0F19`) workspace background.
  - **30% Structural Surfaces**: Elevated Slate (`#111827`) panels and modals with `1px` hairline borders (`#1E293B`).
  - **10% Semantic Accents**: Electric Blue (`#3B82F6`) for primary actions, Emerald (`#10B981`) for active Memory/Skill synapses, Amber (`#F59E0B`) for corrupted YAML warnings (`!`) and Git restore points, and Violet (`#8B5CF6`) for the Animated Reasoning Orb.
- **Typography & Tabular Discipline**:
  - Crisp geometric sans headings paired with monospace tabular numerals (`tabular-nums`) for all node counts, token telemetry, and line numbers.
  - Unboxed bottom-right metadata in Chat (`Loaded: Master Agent Rules · API Security Skill`) using `·` separators in `11px` muted text.
- **Interactive Feedback & Motion**:
  - **Animated Reasoning Orb**: Smooth compositor-friendly pulsing/scaling energy sphere (`Animated.Value` scale + glow opacity) shown before text arrives, seamlessly morphing into a single live text-streaming reasoning box.
  - **Interactive Graph Canvas**: Pan/drag nodes directly on the canvas, left-click any node to inspect code/memory details, and right-click (or long-press on Android) any node or canvas area to open a contextual action menu (`Create Linked Node`, `Edit Content`, `Pin Position`, `Open File`, `Delete Node`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Replacing Legacy 5 Identity Files with Validated YAML Skills & `AGENTS.md`**:
  - *Chosen Approach*: Unify all agent learning and rules around YAML-frontmatter files (`AGENTS.md`, `SKILL.md`, `.yml`/`.md`), with automatic corruption detection (`!`) and 1-click AI repair.
  - *Why*: Eliminates prompt bloat and unvalidated free-form identity files while giving the user full control over **when** each rule loads (`Always in Background` vs. `Custom Trigger Words/Phrases` vs. `Manual`).
- **Decision 2 — Classic Projects File Tree vs. Dedicated Graph Tab in Tools**:
  - *Chosen Approach*: Keep the **Projects** screen focused on fast file-tree navigation, editing, and project management, and place the **Synapse Graph** (`Graph` tab) and **Codebase Structure + Node Search** (`Search` tab) inside **Tools** (with `Dashboard` in Slot 1).
  - *Why*: Prevents overcrowding the Projects screen while making the Graph and Dashboard immediately accessible in a logical order.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                 Dev0 IDE (v1.8)                                   │
├─────────────────────────┬────────────────────────────┬────────────────────────────┤
│   Projects Tab (Home)   │      AI Chat Tab           │     Tools Tab (Reordered)  │
│  ┌───────────────────┐  │  ┌──────────────────────┐  │  1. [Dashboard] (Slot 1)   │
│  │ Classic File Tree │  │  │ Single Reasoning Orb │  │  2. [Tools Registry]       │
│  │ + Project Tabs    │  │  │  ↓ (Text Streams)    │  │  3. [Plans]                │
│  │ + Explicit Delete │  │  │ Single Thinking Box  │  │  4. [Graph] (Replaces Memo)│
│  │ + Git Restore Btn │  │  ├──────────────────────┤  │     • Drag & Drop Nodes    │
│  └───────────────────┘  │  │ Custom Tool Cards    │  │     • Left/Right Click Menu│
│                         │  │ (ZIP / Plan / Diff)  │  │  5. [Search]               │
│                         │  ├──────────────────────┤  │     • Codebase Tree + Nodes│
│                         │  │ Bottom-Right Caption:│  │  6. [Chat Actions]         │
│                         │  │ "Loaded: AGENTS.md…" │  │  + [English Tutorial Modal]│
│                         │  └──────────────────────┘  │                            │
└─────────────────────────┴──────────────┬─────────────┴────────────────────────────┘
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                Extra YAML Skill & AGENTS.md Learning Engine                       │
│  • Single File (.md/.yml/AGENTS.md) & .zip Skill Pack Importer                    │
│  • Corrupted / Missing YAML Detector (!) + 1-Click "Fix with AI" Auto-Formatter   │
│  • Trigger Modes: Always (Background) | Custom Keywords/Phrases/Letters | Manual  │
│  • Strips ".qoder/" from UI Display · Injects Active Skills + Formatting Rules    │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

1. **Extra YAML Learning & `.zip` Skill Importer (`utils/skill-loader.ts`, `components/SubAgentStudioModal.tsx`, `app/(tabs)/settings/index.tsx`)**:
   - Extends `ParsedYamlSkill` with `triggerMode: 'always' | 'keywords' | 'manual'`, `triggerKeywords: string[]`, `isCorrupted: boolean`, and `corruptionReason?: string`.
   - Adds `importSkillsFromZipOrFiles`: unpacks `.zip` archives via `JSZip`, inspects every `.md` / `.yml` / `AGENTS.md` file, validates YAML frontmatter, imports valid skills, and flags corrupted/unformatted files with `!` so the user can click **"Fix with AI"** (`repairCorruptedSkillWithAI`) to automatically add valid YAML frontmatter and structure.
   - Removes all `.qoder` prefixes from visible UI labels (`formatSkillSourceForDisplay`).
   - Completely removes legacy `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, and `betaAgentLearning` from Settings and `buildSystemPrompt`.
2. **Active Skill & `AGENTS.md` Bottom-Right Badge (`types/index.ts`, `providers/ChatProvider.tsx`, `components/ChatBubble.tsx`)**:
   - Adds `loadedSkills?: string[]` to `ChatMessage`.
   - On every chat turn, `matchActiveSkillsForTurn(skills, userMessage)` resolves all background (`always`) + keyword-matched (`keywords`) skills and `AGENTS.md` files, injects them into the system prompt, and stores their display names on the assistant message so `ChatBubble` renders `Used: <Skill / AGENTS.md names>` in small muted text at the bottom-right.
3. **Forced Extended Thinking + Reasoning Orb → Single Streaming Box (`components/ThinkingBlock.tsx`, `app/(tabs)/chat/index.tsx`, `utils/ai-service.ts`)**:
   - Updates `buildSystemPrompt` to enforce mandatory `<think>...</think>` reasoning before every response/tool call.
   - Updates `ThinkingBlock.tsx`: when `isLive` is true and no thinking text has streamed yet (or during initial connection), renders only the **Animated Reasoning Orb**; once thinking text streams in, renders the single expandable streaming text box.
4. **Interactive Drag-and-Drop + Left/Right-Click Synapse Graph (`components/SynapseGraphView.tsx`, `app/(tabs)/tools/index.tsx`)**:
   - Replaces the `Memos` sub-tab in `ToolsScreen` with `Graph` (`SynapseGraphView`), and moves `Dashboard` to the first sub-tab slot (`['dashboard', 'tools', 'plans', 'graph', 'search', 'chat']`).
   - Adds pointer/touch drag-and-drop (`nodePositionOverrides`), Left-Click node selection, and Right-Click (`onContextMenu` on Web / long-press on Android) floating context menu at cursor coordinates.
   - Upgrades the `Search` sub-tab in `ToolsScreen` to show the **Codebase File/Directory Structure** and matching **Synapse Graph Nodes** (Functions, Files, Skills, Memories) with 1-click navigation.
5. **Project Deletion Fix, `<View>` Text Node Sanitization & English Tutorial Modal (`providers/ProjectProvider.tsx`, `app/(tabs)/(home)/index.tsx`, `components/TutorialModal.tsx`)**:
   - Fixes `deleteProject` in `ProjectProvider.tsx` to clear both `userSandboxKey` and `userCurrentProjKey` in `AsyncStorage` and `IndexedDB`, and adds a visible **Trash / Delete Project** button in `ProjectsScreen`.
   - Audits and removes all raw text / `.` nodes inside `<View>` components to eliminate `Unexpected text node: . A text node cannot be a child of a <View>`.
   - Adds `components/TutorialModal.tsx` providing a structured, interactive **English Tutorial & System Guide** accessible from the Tools and Projects headers.
