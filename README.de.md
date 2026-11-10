# ⚡ Dev0 — Autonomous AI Software Engineering Workspace & Multi-Agent IDE (v1.9)

🇬🇧 [English](README.md) | 🇩🇪 **Deutsch** · 📖 **[Master-Konzept & Vision (DE)](docs/MASTER_CONCEPT.de.md)** · 📖 **[Master Concept & Vision (EN)](docs/MASTER_CONCEPT.md)** · 📚 **[Vollständiges Dokumentations-Zentrum](docs/README.de.md)**

Willkommen bei **Dev0**, einer plattformübergreifenden, selbstlernenden **Autonomous AI Software Engineering Workspace und Multi-Agent IDE**, entwickelt mit **Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9 sowie isolierten Docker- und IndexedDB-Sandboxes**.

---

## 🌟 Warum Dev0? (Die 6 technologischen Kernpfeiler)

1. **Strikte wechselseitige Tool-Isolation (Normal Chat Mode vs. Agent Mode):**
   - **Normal Chat Mode (`agentMode: false`):** Dateisystem-Schreibzugriffe und Hintergrund-Sub-Agenten sind strikt isoliert. Generierte Dateien werden als herunterladbare **PKZIP-Grafikkarten** (`zip_create` / `zip_read`) bereitgestellt, komplexe Vorhaben als interaktive **Execution Plan Cards** (`draft_agent_plan`) entworfen, und Sub-Agent-Anfragen öffnen gezielt das **Sub-Agent Floating Konfigurations-Menü**.
   - **Agent Mode (`agentMode: true`):** Voller Zugriff auf **46+ Engineering-Tools**, Read-Before-Write-Dateibearbeitung, Scoped Sub-Agenten, automatische Cron-Jobs und Dual-Git-Wiederherstellungspunkte.
2. **Erzwungenes Extended Thinking (`<think>...</think>`) & Animierter Reasoning-Orb:**
   - Zeigt während des Wartens auf die ersten Denk-Tokens (`isLive && !hasRealReasoning`) **ausschließlich** den pulsierenden **Animated Reasoning Orb** und geht beim Eintreffen des Denktextes nahtlos in **genau eine Text-Streaming-Box (`ThinkingBlock`)** über – inklusive Gemini 2.5/3 `thoughtSignature`-Erhaltung und automatischem HTTP-400-Self-Healing.
3. **Extra YAML Learning Engine, `.ZIP`-Skill-Pack-Importer & 1-Klick-KI-Reparatur:**
   - Direktes Hochladen von `.md`-, `.yml`-, `AGENTS.md`-Dateien oder ganzen `.zip`-Skill-Archiven (`importSkillsFromZipOrFiles`).
   - Automatische Erkennung fehlerhafter oder fehlender YAML-Header (`! CORRUPTED YAML`) mit **1-Klick „Fix with AI“-Reparatur** (`repairCorruptedSkillContent`).
   - Pro Skill / `AGENTS.md` frei wählbar zwischen **Always (Background)**, **Custom Trigger Words / Phrases / Letters** oder **Manual (`@skill`)** – inklusive dezenter **`Loaded: <Skills / AGENTS.md>`**-Anzeige unten rechts in jeder Chat-Blase.
4. **Interaktiver 2D Synapse Memory & Codebase Graph (`Tools -> Graph`):**
   - Getrennte Tabs für **Memory Graph** (auch ohne Projekt nutzbar) und **Project Code Graph** mit **Node Drag & Drop**, **Linksklick-Inspektor**, **Rechtsklick- / Long-Press-Kontextmenü** und **2-Hop Ego-Subgraph Code-Lokalisierung (`localize_code_graph`)**.
5. **Scoped Multi-Agenten-Schwarm, Live Read-Only Stream & `.agents/<slug>/`-Cron-Workflows:**
   - Konfiguration eigener Sub-Agenten mit **„AI Generate All“**-Sperr-Overlay, Echtzeit-Beobachtung im **Live Read-Only Stream Modal** sowie automatisierte Hintergrund-Abläufe über versteckte `.agents/<slug>/`-Workspaces und `finish_task`-Cron-Trigger.
6. **Zero-PII Server-Key-Tresor (`/api/pool`), 50-%-Not-Aus & Dual-Git-Restore:**
   - Serverseitiger API-Key-Tresor mit Anti-Jailbreak-Schutz, echtem Firebase Google Sign-In, 3-Tier RBAC (`owner` / `admin` / `user`), einstellbarer `40-%`-Warnung und automatischem **`50-%`-Not-Aus (*Emergency Stop*) ohne Löschen von Schlüsseln** – kombiniert mit Browser- und Docker-Git-Wiederherstellungspunkten.

---

## 🗂️ Repository- & Modul-Dokumentation (DE / EN)

Jedes Verzeichnis verfügt über zweisprachige (**Deutsch & Englisch**) Dokumentationen:

- 📖 **[docs/MASTER_CONCEPT.de.md](docs/MASTER_CONCEPT.de.md)** | **[docs/MASTER_CONCEPT.md](docs/MASTER_CONCEPT.md)** — Das vollständige Master-Konzept, Zielgruppen & die 6 Architektur-Kernpfeiler
- 📚 **[docs/README.de.md](docs/README.de.md)** | **[docs/README.md](docs/README.md)** — Dokumentations-Zentrum (Systemübersicht, Multi-Agenten-Handbuch, Sicherheits-Audits)
- 🧩 **[components/README.md](components/README.md)** — UI-Komponenten (`SynapseGraphView`, `ThinkingBlock`, `SubAgentStudioModal`, `MasterConceptModal`, `TutorialModal`)
- 🧠 **[providers/README.md](providers/README.md)** — State- & Runtime-Provider (`AppProvider`, `ChatProvider`, `AgentProvider`, `ProjectProvider`)
- 🛠️ **[utils/README.md](utils/README.md)** — Kern-Engines (`ai-service`, `skill-loader`, `synapse-graph`, `free-ai-pool`, `git-restore`, `chat-zip`)
- 📱 **[app/README.md](app/README.md)** & **[app/api/README.md](app/api/README.md)** — Expo Router Screens & Server-API-Routen (`/api/chat`, `/api/pool`, `/api/sandbox`, `/api/models`, `/api/search`, `/api/fetch`)
- 📐 **[types/README.md](types/README.md)** & **[constants/README.md](constants/README.md)** — TypeScript-Typen, 46+ Tool-Definitionen & IDE-Farbschema
- 🧪 **[__tests__/README.md](__tests__/README.md)** & **[scripts/README.md](scripts/README.md)** — 92+ automatisierte Unit-/Integrationstests & Build-Skripte

---

## 🚀 Schnellstart & Verifizierung

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Web- & API-Entwicklungsserver starten (Port 3000)
npm run dev

# 3. Strikte TypeScript-Prüfung (0 Fehler)
npm run typecheck

# 4. Automatisierte Test-Suite ausführen (92+ Tests)
npm test
```

---
*Entwickelt und gepflegt vom Dev0 Engineering Team. Lies das [Master-Konzept (DE)](docs/MASTER_CONCEPT.de.md) / [Master Concept (EN)](docs/MASTER_CONCEPT.md) für die gesamte Systemvision.*
