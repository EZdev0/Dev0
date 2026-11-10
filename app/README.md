# 📱 Expo Router Screens & Navigation (`app/README.md`) — EN / DE (v1.9)

🇬🇧 **English** | 🇩🇪 **Deutsch (unten)** · [⬅ Main README](../README.md) · [🌐 Master Concept](../docs/MASTER_CONCEPT.md)

---

## 🇬🇧 English Overview

This directory contains the file-based routing screens and layouts using **Expo Router**:

- **`app/_layout.tsx`**: Root layout mounting `AppProvider`, `ProjectProvider`, `AgentProvider`, `ChatProvider`, and global modals (`SubAgentStudioModal`, `FreeAIPoolModal`, `TutorialModal`, `MasterConceptModal`).
- **`app/(tabs)/(home)/index.tsx` (Projects):** Classic File Tree view (`viewMode = 'tree'`), 1-click project deletion, responsive wrapping toolbar (`Concept`, `Tutorial`, `Git`, `Synapse Graph`), and Built-in Git Restore Points modal.
- **`app/(tabs)/chat/index.tsx` (AI Chat):** Dual-mode chat interface (Normal Chat Mode vs. Agent Mode), Sub-Agent quick-launcher bar, Orb-only initial `ThinkingBlock`, and Floating Plan Refinement modal.
- **`app/(tabs)/tools/index.tsx` (Tools):** 6-slot command center with **Dashboard in Slot 1**: `[Dashboard, Tools, Plans, Graph, Search, Chat]`.
- **`app/(tabs)/settings/index.tsx` (Settings):** Multi-provider model catalog with live yellow search highlighting, 1-tap Ollama/LM Studio presets, Extra YAML Learning launcher, Master Concept launcher, and English Tutorial launcher.
- **`app/editor.tsx`**: Multi-tab code editor with syntax highlighting and live WebAssembly HTML preview (`HTMLPreview`).
- **`app/api/`**: Server-side API routes (see [`app/api/README.md`](api/README.md)).

---

## 🇩🇪 Deutsche Übersicht

Dieses Verzeichnis enthält alle Screens und Layouts auf Basis von **Expo Router**:

- **`app/_layout.tsx`**: Root-Layout mit allen Providern und globalen Modals (`SubAgentStudioModal`, `FreeAIPoolModal`, `TutorialModal`, `MasterConceptModal`).
- **`app/(tabs)/(home)/index.tsx` (Projekte):** Klassische Dateibaum-Ansicht (`viewMode = 'tree'`), 1-Klick Projekt-Löschung, responsive Toolbar (`Concept`, `Tutorial`, `Git`, `Synapse Graph`) und Git-Wiederherstellungspunkte.
- **`app/(tabs)/chat/index.tsx` (KI-Chat):** Dual-Mode-Chat (Normal Chat vs. Agent Mode), Sub-Agent-Schnellstartleiste, animierter Reasoning-Orb und schwebender Plan-Editor.
- **`app/(tabs)/tools/index.tsx` (Tools):** 6-Slot-Ansicht mit **Dashboard auf Slot 1**: `[Dashboard, Tools, Plans, Graph, Search, Chat]`.
- **`app/(tabs)/settings/index.tsx` (Einstellungen):** KI-Anbieter-Katalog mit gelber Suchmarkierung, 1-Klick-Presets für Ollama/LM Studio, Extra YAML Learning, Master-Konzept und Tutorial.
