# 📐 TypeScript Interfaces & Tool Registry (`types/README.md`) — EN / DE (v1.9)

🇬🇧 **English** | 🇩🇪 **Deutsch (unten)** · [⬅ Main README](../README.md) · [🌐 Master Concept](../docs/MASTER_CONCEPT.md)

---

## 🇬🇧 English Overview

`types/index.ts` defines all strict TypeScript contracts and the central `TOOL_REGISTRY` (`47` registered tool definitions) for **Dev0 v1.9**:

- **`ChatMessage` & `ToolCall`:** Includes `loadedSkills?: string[]` (for the bottom-right `Loaded:` badge), `zipArtifact?: ChatZipArtifact` (for downloadable `.zip` cards), `draftPlan?: ChatDraftPlanArtifact` (for execution plan cards), and Gemini `thoughtSignature` preservation fields.
- **`SkillTriggerOverrideConfig` & `AppSettings`:** Configures per-skill activation (`mode: 'always' | 'keywords' | 'manual'`, `keywords: string[]`), dual-mode toggles (`agentMode`, `betaSuperAgent`), and provider presets (`LOCAL_SERVER_PRESETS` for LM Studio `1234`, Ollama `11434`, and Local `8080`).
- **`TOOL_REGISTRY`:** Defines metadata, parameter schemas, and default permissions across `filesystem`, `analysis`, `planning`, `memory`, `learning`, `web`, and `system` categories, plus mutual-exclusion guards `isChatModeOnlyTool` and `isProjectFilesystemOrAgentOnlyTool`.

---

## 🇩🇪 Deutsche Übersicht

`types/index.ts` definiert sämtliche TypeScript-Interfaces sowie die zentrale `TOOL_REGISTRY` (`47` registrierte Tool-Definitionen) für **Dev0 v1.9**:

- **`ChatMessage` & `ToolCall`:** Enthält `loadedSkills?: string[]` (für die `Loaded:`-Anzeige unten rechts im Chat), `zipArtifact?: ChatZipArtifact`, `draftPlan?: ChatDraftPlanArtifact` sowie `thoughtSignature`-Felder.
- **`SkillTriggerOverrideConfig` & `AppSettings`:** Speichert Trigger-Modi (`mode: 'always' | 'keywords' | 'manual'`, `keywords: string[]`), Modus-Schalter (`agentMode`, `betaSuperAgent`) und lokale Server-Presets (`LOCAL_SERVER_PRESETS`).
- **`TOOL_REGISTRY`:** Zentrale Registrierung aller Werkzeuge über die Kategorien `filesystem`, `analysis`, `planning`, `memory`, `learning`, `web` und `system` inklusive der Isolations-Guards `isChatModeOnlyTool` und `isProjectFilesystemOrAgentOnlyTool`.
