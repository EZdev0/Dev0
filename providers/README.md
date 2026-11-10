# 🧠 State & Runtime Providers (`providers/README.md`) — EN / DE (v1.9)

🇬🇧 **English** | 🇩🇪 **Deutsch (unten)** · [⬅ Main README](../README.md) · [🌐 Master Concept](../docs/MASTER_CONCEPT.md)

---

## 🇬🇧 English Overview

This directory contains the four core React context providers orchestrating state, AI streaming, multi-agent execution, and sandboxed projects:

1. **`AppProvider.tsx`:**
   - Persists global `AppSettings`, `todos`, `memos` (Synapse Memory Graph nodes), `customSubAgents`, `uploadedSkillFiles`, and `skillTriggerOverrides`.
   - Manages visibility for `SubAgentStudioModal`, `FreeAIPoolModal`, `TutorialModal`, and `MasterConceptModal`.
2. **`ChatProvider.tsx`:**
   - Enforces **Mutual-Exclusive Mode Isolation** (`agentMode: false` Normal Chat Mode vs. `agentMode: true` Agent Mode).
   - Evaluates active YAML skills and `AGENTS.md` rules on every turn (`matchActiveSkillsForTurn`) and attaches `loadedSkills` for the bottom-right `Loaded:` badge.
   - Records verified per-turn telemetry (`ChatDebugLogEntry`: latency, API vs. BPE tokens, tool calls, fallbacks, key rotations).
3. **`AgentProvider.tsx`:**
   - Orchestrates 25-step execution plans, scoped Sub-Agents (`isFileAllowedForSubAgent`), hidden `.agents/<slug>/` workspaces, and automated Cron jobs (`on_finish_task`).
4. **`ProjectProvider.tsx`:**
   - Manages isolated per-user project sandboxes (`dev0_sandbox_projects_v2_<userId>`), 1-click project deletion (`deleteProject`), classic File Tree navigation, and Dual Git Restore Points.

---

## 🇩🇪 Deutsche Übersicht

Dieses Verzeichnis enthält die vier zentralen React Context Provider für State-Management, KI-Streaming, Multi-Agenten-Steuerung und Projekt-Sandboxes:

1. **`AppProvider.tsx`:** Verwaltet `AppSettings`, `todos`, `memos` (Synapse-Knoten), `customSubAgents`, hochgeladene YAML-Skills (`uploadedSkillFiles`), Trigger-Einstellungen (`skillTriggerOverrides`) sowie die globalen Modals (`SubAgentStudioModal`, `FreeAIPoolModal`, `TutorialModal`, `MasterConceptModal`).
2. **`ChatProvider.tsx`:** Erzwingt die **wechselseitige Modus-Isolation** (Normal Chat Mode vs. Agent Mode), prüft bei jedem Turn aktive YAML-Skills (`matchActiveSkillsForTurn`), setzt `loadedSkills` für das `Loaded:`-Badge unten rechts und protokolliert echte Telemetrie (`ChatDebugLogEntry`).
3. **`AgentProvider.tsx`:** Steuert bis zu 25-stufige Pläne, Scoped Sub-Agenten, versteckte `.agents/<slug>/`-Ordner und automatische Cron-Jobs.
4. **`ProjectProvider.tsx`:** Isoliert Benutzerprojekte (`dev0_sandbox_projects_v2_<userId>`), unterstützt zuverlässiges 1-Klick-Löschen (`deleteProject`) und synchronisiert Dual-Git-Wiederherstellungspunkte.
