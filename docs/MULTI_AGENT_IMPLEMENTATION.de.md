# 🚀 Multi-Agenten-Schwarm, Extra YAML Learning & Synapse Memory Graph (v1.9)

🇬🇧 [English](MULTI_AGENT_IMPLEMENTATION.md) | 🇩🇪 **Deutsch** · [⬅ Zurück zum Dokumentations-Zentrum](README.de.md) · [🌐 Master-Konzept](MASTER_CONCEPT.de.md)

---

## ✅ 1. Architektur-Überblick (v1.9)

Die autonome Intelligenz von Dev0 basiert auf drei eng verzahnten Systemen, welche die veralteten 5 Identitätsdateien (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`) und das frühere `.qcoder/memos`-System vollständig abgelöst haben:

1. **Extra YAML Learning & `AGENTS.md` Engine (`utils/skill-loader.ts`, `components/SubAgentStudioModal.tsx`):**
   - Modulare YAML-Frontmatter-Skills und `AGENTS.md`-Verträge mit `.zip`-Skill-Pack-Import (`importSkillsFromZipOrFiles`), automatischer Korruptions-Erkennung (`! CORRUPTED YAML`), 1-Klick-Reparatur per **„Fix with AI“** (`repairCorruptedSkillContent`) sowie konfigurierbaren **Always (Background)**- vs. **Custom Trigger Words / Phrases / Letters**-Auslösern (`matchActiveSkillsForTurn`).
2. **Scoped Multi-Agenten-Schwarm & Versteckte `.agents/<slug>/`-Workspaces (`utils/subagent-workspace.ts`, `utils/subagent-question-relay.ts`, `components/SubAgentFloatingQuestionModal.tsx`):**
   - Spezialisierte eingebaute und benutzerdefinierte Sub-Agenten (`Analyst`, `Developer`, `Tester`, `Researcher`) mit Glob-Dateiberechtigungen, Floating Question Relay mit **„AI Generate All“**-Sperr-Overlay, **Live Read-Only Sub-Agenten-Stream** und automatisierten Cron-Workflows (`create_cron_job`, `finish_task`, `sleep_agent`).
3. **Interaktiver 2D Synapse Memory & Codebase Graph (`utils/synapse-graph.ts`, `components/SynapseGraphView.tsx`):**
   - Eigenständiger **Memory Graph** (auch ohne aktives Projekt nutzbar) und **Project Code Graph** mit **Node Drag & Drop**, **Linksklick-Inspektor**, **Rechtsklick- / Long-Press-Kontextmenü** und **2-Hop Ego-Subgraph Code-Lokalisierung (`localize_code_graph`)**.

---

## 📚 2. Extra YAML Learning & `AGENTS.md` Engine

### 2.1 Gültiges YAML-Frontmatter-Schema
Jede Skill-Datei (`.md`, `.yml`) und jede `AGENTS.md` verwendet ein strukturiertes YAML-Frontmatter:

```yaml
---
name: "WebGL & Physics Safety Guard"
description: "Erzwingt die strikte Trennung zwischen Three.js-Meshes und Cannon/Ammo-Physik-Bodies."
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

# Operative Regeln
1. Niemals `mesh.position` manuell verändern, wenn ein Physics-Body verknüpft ist.
2. Beim Entfernen von 3D-Objekten immer `.dispose()` auf Geometrien, Materialien und Texturen aufrufen.
```

### 2.2 `.ZIP`-Skill-Pack-Importer & 1-Klick KI-Reparatur bei defektem YAML
- **Einzel- & `.ZIP`-Upload (`importSkillsFromZipOrFiles`):** Nutzer können einzelne `.md`- / `.yml`- / `AGENTS.md`-Dateien oder komplette `.zip`-Archive mit mehreren Skills hochladen. Dev0 entpackt alle enthaltenen Dateien direkt im Browser, entfernt `.qoder/`- und `.qcoder/`-Präfixe (`formatSkillSourceForDisplay`) und indexiert sie sofort.
- **Erkennung beschädigter YAML-Dateien (`isCorrupted`):** Fehlt bei einer `AGENTS.md` oder Skill-Datei der `--- ... ---`-Header oder ist das YAML fehlerhaft, erscheint im `SubAgentStudioModal` ein gelbes **`! CORRUPTED YAML`**-Warnbadge.
- **1-Klick „Fix with AI“ (`repairCorruptedSkillContent`):** Ein Klick auf **„Fix with AI“** erzeugt automatisch einen validen YAML-Header (`name`, `description`, `trigger`, `alwaysApply`, `globs`), ohne den bestehenden Regeltext zu kürzen.
- **`Loaded:`-Anzeige unten rechts im Chat (`components/ChatBubble.tsx`):** Jede Nachricht speichert in `loadedSkills`, welche Hintergrund- und Trigger-Skills das System tatsächlich geladen hat, und zeigt diese unten rechts in der Chat-Blase an (`Loaded: <Skills / AGENTS.md>`).

---

## 🤖 3. Scoped Multi-Agenten-Schwarm & `.agents/<slug>/`-Workspaces

### 3.1 Sub-Agenten im Normal Chat Mode vs. Agent Mode
- **Im Normal Chat Mode (`!agentMode`):** Der normale Chatbot startet keine Hintergrund-Sub-Agenten. Wird ein Sub-Agent angefordert, öffnet Dev0 das **Sub-Agent Floating Modal** (`SubAgentFloatingQuestionModal`) oder ermöglicht die Auswahl eines bereits definierten Sub-Agenten über die Schnellstartleiste über dem Eingabefeld.
- **Im Agent Mode (`agentMode: true`):** Der Main-Agent kann über das `sub_agent`-Tool komplexe Teilaufgaben an spezialisierte Sub-Agenten delegieren.

### 3.2 Floating Question Relay & „AI Generate All“-Sperr-Overlay
- Stellt ein Sub-Agent Rückfragen über `ask_user_question` (`hasExplicitQuestionToolCall`), öffnet sich das `SubAgentFloatingQuestionModal`.
- Mit einem Klick auf **„AI Generate All“** legt sich ein diagonal gestreiftes Sperr-Overlay über die Eingabefelder (`generateCompleteSubAgentConfig`), während die KI Name, Rolle, System-Prompt und Datei-Globs automatisch ausfüllt, den Sub-Agenten in der **Saved Sub-Agents List** speichert und die Konfiguration an den Main Creator Agent übergibt (`buildMainCreatorRelayPrompt`).

### 3.3 Versteckte `.agents/<slug>/`-Workspaces & Cron-Automatisierung
Jeder Sub-Agent pflegt vier versteckte englische Dokumentationsdateien unter `.agents/<slug>/` (über `filterVisibleUserFiles` im normalen Dateibaum ausgeblendet):
- `.agents/<slug>/README.md` — Rollenbeschreibung und Aufgabenbereich
- `.agents/<slug>/RULES.md` — Erlaubte Datei-Globs und Sicherheitsregeln
- `.agents/<slug>/STATUS.md` — Aktueller Status (`idle`, `running`, `sleeping`, `completed`)
- `.agents/<slug>/LOG.md` — Zeitgestempeltes Ausführungsprotokoll und `finish_task`-Berichte

---

## 🕸️ 4. Interaktiver 2D Synapse Memory & Codebase Graph

Direkt erreichbar über **`Tools -> Graph`** (`components/SynapseGraphView.tsx`):
- **Memory Graph Tab:** Funktioniert auch ohne geöffnetes Projekt (`buildMemoryOnlySynapseGraph`). Visualisiert gespeicherte Erkenntnisse sowie YAML-Skills und ist mit den KI-Tools `memory_search`, `memory_update`, `memory_delete` und `memory_graph_query` gekoppelt.
- **Project Code Graph Tab:** Visualisiert Projektdateien, exportierte Symbole, Imports und Funktionsaufrufe (`buildSynapseGraph`) und versorgt das Tool `localize_code_graph`.
- **Interaktive Steuerung:**
  - **Drag & Drop:** Knoten frei auf der 2D-Oberfläche verschieben und anpinnen.
  - **Linksklick:** Öffnet den Node-Inspektor mit Code-/Memory-Vorschau und Kantenliste.
  - **Rechtsklick / Long-Press:** Öffnet das Kontextmenü zum Fokussieren des 2-Hop-Subgraphen, Einfügen von `@Pfad` in den Chat, Hervorheben verbundener Knoten oder Löschen eines Memory-Knotens.
