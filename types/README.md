# 📐 TypeScript Interfaces & Tool Registry (`types/README.md`) — EN / DE (v1.9)

🇬🇧 **English** | 🇩🇪 **Deutsch (unten)** · [⬅ Main README](../README.md) · [🌐 Master Concept](../docs/MASTER_CONCEPT.md)

---

## 🇬🇧 English Overview

`types/index.ts` defines all strict TypeScript contracts and the central `TOOL_REGISTRY` (`46+` tools) for **Dev0 v1.9**:

- **`ChatMessage` & `ToolCall`:** Includes `loadedSkills?: string[]` (for the bottom-right `Loaded:` badge), `zipBundle`, `draftPlan`, and Gemini `thoughtSignature` preservation fields.
- **`SkillTriggerOverrideConfig` & `AppSettings`:** Configures per-skill activation (`always`, `custom` trigger words/phrases/letters, `manual`), dual-mode toggles (`agentMode`, `betaSuperAgent`), and provider presets (`LOCAL_SERVER_PRESETS` for LM Studio `1234`, Ollama `11434`, and Local `8080`).
- **`TOOL_REGISTRY`:** Defines metadata, parameter schemas, and default permissions for all 46+ tools across `files`, `git`, `memory`, `web`, `planning`, and `system` categories.

---

## 🇩🇪 Deutsche Übersicht

`types/index.ts` definiert sämtliche TypeScript-Interfaces sowie die zentrale `TOOL_REGISTRY` (`46+` Tools) für **Dev0 v1.9**:

- **`ChatMessage` & `ToolCall`:** Enthält `loadedSkills?: string[]` (für die `Loaded:`-Anzeige unten rechts im Chat), `zipBundle`, `draftPlan` sowie `thoughtSignature`-Felder.
- **`SkillTriggerOverrideConfig` & `AppSettings`:** Speichert Trigger-Modi (`always`, `custom` für eigene Wörter/Sätze, `manual`), Modus-Schalter (`agentMode`) und lokale Server-Presets (`LOCAL_SERVER_PRESETS`).
- **`TOOL_REGISTRY`:** Zentrale Registrierung aller 46+ Werkzeuge inklusive Kategorien und Standardberechtigungen.
