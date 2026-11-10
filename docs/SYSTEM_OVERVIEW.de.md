# 📊 Dev0 Systemübersicht & Architektur-Referenz (v1.9)

🇬🇧 [English](SYSTEM_OVERVIEW.md) | 🇩🇪 **Deutsch** · [⬅ Zurück zum Dokumentations-Zentrum](README.de.md) · [🌐 Master-Konzept](MASTER_CONCEPT.de.md)

**Version:** `v1.9.0` (2026-11-10)  
**Status:** ✅ Produktionsreif — **0 TypeScript-Fehler** | **92+ automatisierte Tests bestanden**  
**Stack:** Expo SDK 54.0 | React Native 0.81 | React 19.1 | TypeScript 5.9 | Firebase Auth & Firestore | Docker-Sandboxes

---

## 🎯 1. Management-Zusammenfassung

**Dev0** ist eine plattformübergreifende KI-Software-Engineering-Arbeitsumgebung und Multi-Agenten-IDE für **Web (`http://localhost:3000`), Android, iOS und Docker-Sandboxes**. Während frühe Prototypen noch auf statischen Identitätsdateien (`SOUL.md`, `USER.md`, `MEMORY.md`) basierten, nutzt Dev0 v1.9 eine moderne 6-Säulen-Architektur:
1. **Wechselseitige Modus-Isolation:** Normal Chat Mode (`.zip`- & Ausführungsplan-Grafikkarten) vs. Agent Mode (46+ Dateisystem-, Git- und Sub-Agent-Tools).
2. **Forced Extended Thinking & Animierter Reasoning-Orb:** Zeigt beim Warten auf die ersten Denk-Tokens (`isLive && !hasRealReasoning`) **ausschließlich** den pulsierenden Reasoning-Orb und wechselt danach in genau eine Text-Streaming-Box (`ThinkingBlock`).
3. **Extra YAML Learning & `AGENTS.md` Engine:** Unterstützt den Upload von `.md`-, `.yml`-, `AGENTS.md`- und `.zip`-Skill-Paketen, automatische `! CORRUPTED YAML`-Erkennung, 1-Klick-Reparatur per **„Fix with AI“** sowie Hintergrund- vs. eigene Wort-/Satz-Trigger inklusive `Loaded:`-Anzeige unten rechts im Chat.
4. **Interaktiver 2D Synapse Memory & Codebase Graph:** Integriert unter `Tools -> Graph` (mit `Dashboard` auf Slot 1), inklusive **Node Drag & Drop**, **Linksklick-Inspektor**, **Rechtsklick- / Long-Press-Kontextmenü** und 2-Hop Ego-Subgraph Code-Lokalisierung.
5. **Server-Only Key-Tresor (`/api/pool`) & 50-%-Not-Aus (*Emergency Stop*):** Echtes Firebase Google Sign-In, Zero-PII 3-Tier RBAC (`owner` / `admin` / `user`), Anti-Jailbreak-Prüfung, 40-%-Warnschwelle und automatischer 50-%-Not-Aus ohne Löschen von Schlüsseln.

---

## 🧠 2. Zentrale State- & Runtime-Provider (`providers/`)

### 2.1 `AppProvider.tsx` — Globale Einstellungen, YAML-Skill-Speicher, Key-Pool & Modals
- Verwaltet `AppSettings`, `todos`, `memos` (Synapse Memory Graph Knoten), `customSubAgents`, `uploadedSkillFiles` und `skillTriggerOverrides`.
- Speichert den Zustand persistent über `AsyncStorage` und `IndexedDB`.
- Steuert die globalen System-Modals:
  - `showSubAgentStudio` (`SubAgentStudioModal`)
  - `showFreePoolModal` (`FreeAIPoolModal`)
  - `showTutorialModal` (`TutorialModal`)
  - `showMasterConceptModal` (`MasterConceptModal`)

### 2.2 `ChatProvider.tsx` — Dual-Mode KI-Orchestrierung, Streaming & Skill-Matching
- **Dynamisches Skill-Matching (`matchActiveSkillsForTurn`):** Prüft bei jeder Nachricht alle Projekt- und hochgeladenen YAML-Skills / `AGENTS.md`-Regeln, injiziert passende Anweisungen in den System-Prompt und speichert die aktiven Namen in `loadedSkills` für das `Loaded:`-Badge unten rechts.
- **Strikte Modus-Isolation:**
  - Bei `agentMode === false` (Normal Chat Mode): Entfernt alle Datei-, Git- und Sub-Agent-Schreibwerkzeuge, aktiviert `zip_create`, `zip_read`, `draft_agent_plan` und `read_other_chat_messages`, wandelt verirrte Dateischreibversuche automatisch in `.zip`-Pakete um und öffnet bei Sub-Agent-Anfragen das **Sub-Agent Floating Modal**.
  - Bei `agentMode === true` (Agent Mode): Deaktiviert reine Chat-ZIP-/Plan-Tools und schaltet alle 46+ Projekt- und Agenten-Werkzeuge frei.
- **Per-Chat Debug-Telemetrie (`ChatDebugLogEntry`):** Protokolliert Latenz, exakte API- vs. BPE-Tokenwerte (`cl100k`), Tool-Aufrufe, Fallbacks und Key-Rotationen.

### 2.3 `AgentProvider.tsx` — Autonome Mehrstufen-Ausführung, Sub-Agenten & Cron-Jobs
- **Plan-Erstellung & Ausführung:** Unterstützt bis zu 25 Schritte (`task`, `thinking`, `brainstorm`, `web_search`, `sub_agent`) mit automatischer Analyse-Phase und sofortigem **Skip & Start Immediately**-Direktstart (`SKIP_QUESTIONS_INSTRUCTION`).
- **Scoped Sub-Agenten & Versteckte `.agents/<slug>/`-Workspaces:** Prüft Dateiberechtigungen per Glob-Muster (`isFileAllowedForSubAgent`), pflegt englische Status- und Logdateien in `.agents/<slug>/` und startet Cron-Jobs (`on_finish_task`, Zeitintervalle) nach `finish_task`.

### 2.4 `ProjectProvider.tsx` — Isolierte Benutzer-Sandboxes & 1-Klick Projekt-Löschung
- Isoliert die Projekte jedes Benutzers in einem eigenen Namespace (`dev0_sandbox_projects_v2_<userId>`) und bereinigt alte Self-Source-Artefakte (`sanitizeUserSandboxProjects`).
- Bietet zuverlässiges 1-Klick-Löschen (`deleteProject`), die klassische Dateibaum-Ansicht (`viewMode = 'tree'`), ZIP-/JSON-Export sowie Dual-Git-Wiederherstellungspunkte.

---

## 🧩 3. Zentrale UI-Komponenten (`components/` & `app/`)

| Komponente / Screen | Hauptaufgaben |
| :--- | :--- |
| **`app/(tabs)/(home)/index.tsx`** | Klassischer Projekt-Dateibaum (`viewMode = 'tree'`), 1-Klick Projekt-Löschen-Button, umbruchfähige Toolbar (`Concept`, `Tutorial`, `Git`, `Synapse Graph`) und Built-in Git Restore Modal. |
| **`app/(tabs)/chat/index.tsx`** | Dual-Mode KI-Chat mit Normal-/Agent-Umschalter, Sub-Agent-Schnellstartleiste, Orb-Only-Initialzustand für `ThinkingBlock` und Floating Plan-Editor. |
| **`app/(tabs)/tools/index.tsx`** | 6-Slot-Kommandozentrale mit **Dashboard auf Slot 1**: `[Dashboard, Tools, Plans, Graph, Search, Chat]`. Inklusive Codebase- & Graph-Knoten-Suche. |
| **`components/ThinkingBlock.tsx`** | Rendert bei `isLive && !hasRealReasoning` **nur** den **Animated Reasoning Orb** und wechselt bei eintreffendem Denktext in **genau eine Text-Streaming-Box**. |
| **`components/ChatBubble.tsx`** | Eigener GFM-Markdown-Parser, interaktive **ZIP-Download-Grafikkarte**, **Execution Plan Card** und **`Loaded: <Skills / AGENTS.md>`**-Badge unten rechts. |
| **`components/SynapseGraphView.tsx`** | Interaktiver 2D-Graph mit getrennten Tabs für **Memory Graph** und **Project Code Graph**, **Node Drag & Drop**, **Linksklick-Inspektor** und **Rechtsklick- / Long-Press-Kontextmenü**. |
| **`components/SubAgentStudioModal.tsx`** | Visueller Builder für Scoped Sub-Agenten sowie die **Extra YAML Learning & `AGENTS.md` Engine** (`.md`/`.yml`/`.zip`-Upload, `! CORRUPTED YAML`-Badge, 1-Klick **„Fix with AI“** und Trigger-Steuerung). |
| **`components/FreeAIPoolModal.tsx`** | „AI for Free“ Shared Key Pool & Zero-PII 3-Tier RBAC Governance mit Firebase Google Sign-In, freier Kontingent-Eingabe (`0` = Unbegrenzt), `40-%`/`50-%`-Not-Aus-Reglern und Live-Owner-Systemprompt-Editor. |
| **`components/MasterConceptModal.tsx`** | Zweisprachiger (**DE / EN**) interaktiver Master-Konzept- & Systemarchitektur-Explorer mit allen 6 Kernpfeilern, Zielgruppen und Direkt-Startern. |
| **`components/TutorialModal.tsx`** | Interaktives 5-Schritte-System-Tutorial (Englisch) zu Chat vs. Agent Mode, YAML Learning, Synapse Graph, Dual Git und Key-Tresor. |

---

## ✅ 4. Verifizierungs- & Qualitätsbefehle

```bash
# Strikte TypeScript-Prüfung (0 Fehler)
npm run typecheck

# Vollständige automatisierte Test-Suite (92+ Unit- & Integrationstests)
npm test

# Statische Code-Analyse
npm run lint
npm run lint:biome
npm run lint:oxlint
```
