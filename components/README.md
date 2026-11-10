# 🧩 UI Components (`components/README.md`) — EN / DE (v1.9)

🇬🇧 **English** | 🇩🇪 **Deutsch (unten)** · [⬅ Main README](../README.md) · [🌐 Master Concept](../docs/MASTER_CONCEPT.md)

---

## 🇬🇧 English Overview

This directory contains all reusable React Native / Expo UI components powering **Dev0 v1.9**:

| Component | Purpose & Key Capabilities |
| :--- | :--- |
| **`ThinkingBlock.tsx`** | Renders **only** the **Animated Reasoning Orb** when `isLive && !hasRealReasoning`, transitioning into **one single collapsible text-streaming box** once reasoning tokens arrive. |
| **`ChatBubble.tsx`** | Custom regex GFM Markdown renderer, interactive **ZIP Download Graphic Card**, **Execution Plan Graphic Card**, and bottom-right **`Loaded: <Skills / AGENTS.md>`** badge. |
| **`SynapseGraphView.tsx`** | Interactive 2D canvas with separate **Memory Graph** and **Project Code Graph** tabs, **Node Drag-and-Drop**, **Left-Click Inspector**, and **Right-Click / Long-Press Context Menu**. |
| **`SubAgentStudioModal.tsx`** | Scoped Sub-Agent builder + **Extra YAML Learning & `AGENTS.md` Engine** (`.md`/`.yml`/`.zip` upload, `! CORRUPTED YAML` detection, 1-click **"Fix with AI"**, and trigger mode configuration). |
| **`SubAgentFloatingQuestionModal.tsx`** | Floating Sub-Agent Q&A relay with the **"AI Generate All"** button and diagonal striped lock overlay. |
| **`FreeAIPoolModal.tsx`** | "AI for Free" Shared Key Pool & Zero-PII 3-Tier RBAC Governance UI with Firebase Google Sign-In, `40%` warning / `50%` *Not-Aus* sliders, and live Owner System Prompt editors. |
| **`MasterConceptModal.tsx`** | Interactive bilingual (**EN / DE**) Master Concept & System Architecture Showcase modal. |
| **`TutorialModal.tsx`** | Interactive 5-step English System Tutorial covering Dual-Mode Chat, YAML Learning, Synapse Graph, Dual Git, and Key Vault safety. |
| **`AgentPlanView.tsx` & `AgentTaskCard.tsx`** | Hierarchical 25-step execution plan viewer with long-press reordering, semantic node badges, and "Skip & Start Immediately" action. |
| **`HTMLPreview.tsx`** | Live HTML/CSS/JS preview (`<iframe srcDoc>` on Web, `WebView` on native) with `window.runWasmBytes` WebAssembly support. |

---

## 🇩🇪 Deutsche Übersicht

Dieses Verzeichnis enthält alle wiederverwendbaren React Native / Expo UI-Komponenten von **Dev0 v1.9**:

- **`ThinkingBlock.tsx`**: Zeigt beim Warten auf erste Denk-Tokens (`isLive && !hasRealReasoning`) **nur** den **Animated Reasoning Orb** und wechselt bei Text-Streaming in **genau eine Denkbox**.
- **`ChatBubble.tsx`**: GFM-Markdown-Renderer, interaktive **ZIP-Download-Grafikkarte**, **Execution Plan Card** und **`Loaded: <Skills / AGENTS.md>`**-Badge unten rechts.
- **`SynapseGraphView.tsx`**: Interaktiver 2D-Graph mit getrennten Tabs für **Memory Graph** und **Project Code Graph**, **Node Drag & Drop**, **Linksklick-Inspektor** und **Rechtsklick-Kontextmenü**.
- **`SubAgentStudioModal.tsx`**: Builder für Sub-Agenten sowie **Extra YAML Learning & `AGENTS.md` Engine** (`.md`/`.yml`/`.zip`-Upload, `! CORRUPTED YAML`-Erkennung, 1-Klick **„Fix with AI“** und Trigger-Steuerung).
- **`MasterConceptModal.tsx`**: Zweisprachiges (**DE / EN**) interaktives Master-Konzept- & Architektur-Modal.
- **`TutorialModal.tsx`**: Interaktives 5-Schritte-System-Tutorial auf Englisch.
