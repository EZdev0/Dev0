# 🌐 Dev0 — Master-Konzept, Vision & Systemarchitektur (v1.9)

🇬🇧 [English](MASTER_CONCEPT.md) | 🇩🇪 **Deutsch** · [⬅ Zurück zum Dokumentations-Index](README.de.md) · [🏠 Haupt-README](../README.de.md)

> **„Zero Friction. Zero Hallucination. Infinite Autonomous Engineering.“**  
> **Dev0** ist eine plattformübergreifende, selbstlernende **Autonomous AI Software Engineering Workspace & Multi-Agent IDE** für **Web, Android, iOS und Docker-Sandboxes**.

---

## 1. Executive Summary & Leitbild

Moderne KI-Entwicklungswerkzeuge zwingen Entwickler bisher in einen grundlegenden Kompromiss:
- **Klassische Chatbots** generieren zwar einzelne Code-Snippets, verlieren jedoch über mehrere Runden hinweg den Kontext, können komplexe Multi-Datei-Architekturen nicht sicher verwalten und vergessen Projektregeln sofort wieder.
- **Schwergewichtige Desktop-IDEs** setzen lokale Installationen voraus, legen API-Schlüssel oft ungeschützt im Client ab, verbrauchen enorme Token-Mengen durch blindes Einlesen ganzer Repositories und sind auf Smartphones oder Tablets nicht nativ nutzbar.

**Dev0 löst diesen Widerspruch vollständig auf.**  
Aufgebaut auf **Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9 sowie isolierten Docker- und IndexedDB-Sandboxes** vereint Dev0 einen vollwertigen Multi-Datei-Code-Editor, einen autonomen Multi-Agenten-Schwarm, einen interaktiven 2D-**Synapse Memory & Codebase Graphen**, eine **Extra YAML Learning Engine** (inklusive `.zip`-Skill-Pack-Import und 1-Klick-KI-Reparatur), ein **duales Git- & Wiederherstellungspunkt-System** sowie einen **Zero-PII Server-Key-Tresor** in einer einzigen, hochperformanten Arbeitsumgebung.

---

## 2. Wofür Dev0 steht (Die 4 Grundprinzipien)

| Prinzip | Architektonische Umsetzung | Messbarer Mehrwert für Anwender & Partner |
| :--- | :--- | :--- |
| **01. Kein Kontextverlust (Zero Context Loss)** | Interaktiver 2D-**Synapse Memory Graph** (`utils/synapse-graph.ts`) + BM25 Cross-Chat-Reader (`utils/cross-chat-reader.ts`) + Extra YAML Learning (`utils/skill-loader.ts`). | Die KI behält Architekturentscheidungen, frühere Chat-Lösungen und Projektregeln dauerhaft im Gedächtnis. |
| **02. Keine ungewollten Dateiänderungen (Zero Unintended Mutation)** | Strikte **wechselseitige Tool-Isolation** zwischen **Normal Chat Mode** (reine `.zip`- & Plan-Karten) und **Agent Mode** (46+ Dateisystem-, Git- und Sub-Agent-Tools). | Beim freien Brainstorming im normalen Chat werden niemals versehentlich Projektdateien überschrieben. |
| **03. Kein Daten- oder Key-Leak (Zero Credential Exposure)** | **Server-Only Key-Tresor (`/api/pool`)**, Anti-Jailbreak-Prompt-Prüfung, 40-%-Owner-Warnung und **nicht-destruktiver 50-%-Not-Aus (*Emergency Auto-Cutoff*)**. | Teams, Bildungseinrichtungen und Communities können KI-Kontingente sicher teilen, ohne API-Keys preiszugeben. |
| **04. Keine Plattform-Abhängigkeit (Zero Platform Lock-In)** | Native Unterstützung für **iOS, Android, Web (PWA/SSR)** und **Docker-Sandboxes** + **10+ KI-Anbieter** (Cloud-APIs, Keyless-Fallbacks & lokales Ollama / LM Studio). | Softwareentwicklung auf PC, Laptop, Tablet oder Smartphone – sowohl in der Cloud als auch 100 % lokal. |

---

## 3. Für wen Dev0 entwickelt wurde (Zielgruppen & Personas)

### A. Solo-Founder, Produktentwickler & Indie-Builder („Vibecoders“)
- **Herausforderung:** Komplexe Produktideen schnell in funktionierende Multi-Datei-Anwendungen verwandeln, ohne in Terminal-Konfigurationen steckenzubleiben oder funktionierenden Code durch fehlerhafte KI-Edits zu verlieren.
- **Wie Dev0 dies löst:**
  - **Normal Chat Mode `.zip`- & Plan-Karten:** Im normalen Chat verpackt die KI generierte Dateien automatisch in herunterladbare PKZIP-Archive (`zip_create`) oder erstellt interaktive Ausführungspläne (`draft_agent_plan`) mit direktem **„Proceed in Agent Mode“**-Button.
  - **Eingebautes Dual-Git & Restore Points:** Jeder Meilenstein lässt sich mit einem Klick sichern und wiederherstellen – sowohl im Browser (`IndexedDB`/`AsyncStorage`) als auch als echter Git-Commit im Docker-Container (`/api/sandbox`).

### B. Senior Software Engineers & Systemarchitekten
- **Herausforderung:** Deterministische Kontrolle über autonome Agenten, strikte Dateiberechtigungen (File-Scopes), Echtzeit-Transparenz über Reasoning und Token-Verbrauch sowie präzise Code-Lokalisierung ohne Halluzinationen.
- **Wie Dev0 dies löst:**
  - **Scoped Sub-Agenten-Schwarm & `.agents/<slug>/`-Workspaces:** Aufgaben werden gezielt an `Analyst`, `Developer`, `Tester`, `Researcher` oder eigene, per Glob-Muster eingeschränkte Sub-Agenten delegiert. Jeder Sub-Agent führt ein eigenes verstecktes Audit-Verzeichnis (`README.md`, `RULES.md`, `STATUS.md`, `LOG.md`) und kann über `finish_task` automatische Cron-Workflows auslösen.
  - **2-Hop Ego-Subgraph Code-Lokalisierung (`localize_code_graph`):** Statt 50 Dateien blind einzulesen, fragt die KI den Synapse-Graphen ab und lädt exakt die relevanten Symbole, Imports und Aufrufer – das spart bis zu 75 % der Kontext-Tokens.
  - **Per-Chat Debug-Telemetrie:** Exakte Aufschlüsselung von Latenz, API- vs. BPE-Tokens (`cl100k`), Tool-Aufrufen, Fallback-Stufen und Key-Rotationen nach jeder Nachricht.

### C. Datenschutzbewusste Entwickler & Nutzer lokaler Open-Weight-Modelle
- **Herausforderung:** Lokale Modelle (Ollama, LM Studio, vLLM, Qwen, DeepSeek, Llama) scheitern in herkömmlichen IDEs oft daran, dass sie XML-`<tool_call>`-Tags oder ReAct-`Action:`-Blöcke statt nativer OpenAI-`tool_calls` ausgeben.
- **Wie Dev0 dies löst:**
  - **1-Klick-Presets & Live-`/api/models`-Erkennung:** Sofortige Verbindung zu **LM Studio (`:1234`)**, **Ollama (`:11434`)** und **lokalen OpenAI-kompatiblen Servern (`:8080`)** inklusive gelber Live-Suchmarkierung im Modellkatalog.
  - **3-Stufen Hybrid-Tool-Parser (`utils/ai-service.ts`):** Parst automatisch eingezäunte JSON-Blöcke, XML-`<tool_call>`/`<tool>`-Tags sowie ReAct-`Action:`/`Action Input:`-Blöcke inklusive automatischer JSON-Reparatur (`repairAndParseJSON`).

### D. Entwickler-Teams, Universitäten, Hackathons & Open-Source-Communities
- **Herausforderung:** Studierenden, Teammitgliedern oder Community-Nutzern Zugang zu leistungsstarken KI-Modellen ermöglichen, ohne Klartext-API-Keys herauszugeben oder unkontrollierte Kosten zu riskieren.
- **Wie Dev0 dies löst:**
  - **„AI for Free“ Shared Key Pool & Zero-PII 3-Tier RBAC:** Owner und Admins hinterlegen geteilte API-Schlüssel sicher im Server-Tresor (`/api/pool`) mit Token-/Zeitlimits und optionaler `User ID`-Bindung – geschützt durch maskierte E-Mail-Adressen (`j***s@gmail.com`), echtes Firebase Google Sign-In, einstellbare `40-%`-Warnungen und einen automatischen `50-%`-Not-Aus (*Emergency Stop*), der Schlüssel pausiert, **ohne sie jemals zu löschen**.

---

## 4. Die 6 technologischen Kernpfeiler von Dev0

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│                       DEV0 MASTER-SYSTEMARCHITEKTUR (v1.9)                         │
├─────────────────────────────────────────┬──────────────────────────────────────────┤
│  1. DUAL-MODE INTELLIGENZ-ENGINE        │  2. EXTENDED THINKING & ORB-STREAMING    │
│  • Normaler Chat-Modus:                 │  • Erzwungenes <think>...</think>        │
│    - Herunterladbare PKZIP-Karten       │  • Animierter Reasoning-Orb während der  │
│    - Interaktive Ausführungsplan-Karten │    ersten Denkphase (keine Doppelboxen)  │
│    - Sub-Agent Floating-KonfigurationsUI│  • Nahtloser Übergang in genau eine      │
│  • Agenten-Modus:                       │    Text-Streaming-ThinkingBlock-Box      │
│    - 46+ Datei-, Git-, Web- & SwarmTools│  • Gemini thoughtSignature Self-Healing  │
├─────────────────────────────────────────┼──────────────────────────────────────────┤
│  3. EXTRA YAML LEARNING & .ZIP-ENGINE   │  4. 2D SYNAPSE MEMORY & CODE GRAPH       │
│  • Upload von .md, .yml, AGENTS.md, .zip│  • Eigenständiger Memory-Graph-Tab       │
│  • Erkennt korruptes YAML (!) sofort    │  • Projekt-Codebase AST/Symbol-Graph-Tab │
│    mit 1-Klick „Fix with AI“-Reparatur  │  • Knoten Drag & Drop, Linksklick-       │
│  • Always (Hintergrund) vs. eigene      │    Inspektor & Rechtsklick-Kontextmenü   │
│    Trigger-Wörter / Sätze / Buchstaben  │  • 2-Hop Ego-Subgraph Code-Lokalisierung │
│  • „Loaded:“-Anzeige unten rechts       │  • Nicht-destruktive Link-Bereinigung    │
├─────────────────────────────────────────┼──────────────────────────────────────────┤
│  5. SCOPED MULTI-AGENTEN & CRON-JOBS    │  6. KEY-TRESOR, 3-TIER RBAC & DUAL-GIT   │
│  • Floating Q&A-Relay an Main-Creator   │  • Server-Only Key-Tresor (/api/pool)    │
│  • „AI Generate All“ mit Sperr-Overlay  │  • 40-%-Warnung & 50-%-Not-Aus (ohne Del)│
│  • Live Read-Only Sub-Agenten-Stream    │  • Anti-Jailbreak Prompt-Überwachung     │
│  • Versteckte .agents/<slug>/-Ordner    │  • Firebase Google Auth + 3-Tier RBAC    │
│  • finish_task & automatische Cron-Jobs │  • Browser- + Docker-Dual-Git-Restore    │
└─────────────────────────────────────────┴──────────────────────────────────────────┘
```

### Pfeiler 1: Strikte wechselseitige Tool-Isolation (Normal Chat Mode vs. Agent Mode)
Dev0 zieht eine klare Sicherheitsgrenze zwischen beratendem Chat und autonomer Projektbearbeitung:
- **Im Normal Chat Mode (`agentMode: false`):**
  - Sämtliche Datei-Schreibwerkzeuge (`write_file`, `edit_file`, `delete_file`), Git-Schreiboperationen und das direkte Spawnen von Hintergrund-Sub-Agenten (`sub_agent`) sind **deaktiviert und ausgeblendet**.
  - Stattdessen nutzt die KI **`zip_create` / `zip_read`** (erzeugt eine interaktive **ZIP-Download-Grafikkarte** direkt im Chat), **`draft_agent_plan`** (rendert eine **Execution Plan Card** mit Floating-Editor und **„Proceed in Agent Mode“**-Button), **`read_other_chat_messages`** (token-sparende `< 1.750 Zeichen` BM25-Suche über andere Chats) sowie die **Synapse Memory Graph Tools**.
  - Wenn im normalen Chat ein Sub-Agent angefragt wird, öffnet Dev0 das **Sub-Agent Floating Modal**, anstatt unbemerkt Prozesse im Hintergrund zu starten.
- **Im Agent Mode (`agentMode: true`):**
  - Die reinen Chat-Paketwerkzeuge (`zip_create`, `zip_read`, `draft_agent_plan`) werden ausgeblendet, sodass der Agent direkt im isolierten Projekt-Dateibaum mit über 46 Engineering-Tools, Sub-Agenten und Git-Wiederherstellungspunkten arbeitet.

### Pfeiler 2: Erzwungenes Extended Thinking & Animierter Reasoning-Orb
- **Strukturiertes Chain-of-Thought (`<think>...</think>`):** Jeder System-Prompt verpflichtet das Modell dazu, vor der Antwort oder Tool-Ausführung eine mehrschichtige Analyse (aktive Modus-Grenzen, geladene YAML-Skills, Synapse-Knoten) durchzuführen.
- **Zweistufige visuelle Darstellung (`components/ThinkingBlock.tsx`):**
  1. **Stufe 1 (Warten auf erste Reasoning-Tokens):** Zeigt **ausschließlich** den pulsierenden **Animated Reasoning Orb** – ohne leere oder doppelte Boxen.
  2. **Stufe 2 (Live-Text-Streaming):** Sobald der Denktext eintrifft, öffnet sich **genau eine** aufklappbare Text-Streaming-Box.
- **Kryptografisches `thoughtSignature` Self-Healing:** Bewahrt `thoughtSignature` und `extra_content.google.thought_signature` über alle Tool-Runden hinweg und wandelt unsignierte historische Tool-Calls bei einem HTTP-400-Fehler automatisch in strukturierten Kontext um (`flattenUnsignedToolCalls`).

### Pfeiler 3: Extra YAML Learning Engine, `.ZIP`-Skill-Pack-Importer & KI-Reparatur
Anstelle starrer Identitätsdateien nutzt Dev0 eine selbstheilende **Extra YAML Learning & `AGENTS.md` Engine** (`utils/skill-loader.ts`, `components/SubAgentStudioModal.tsx`):
- **Einzeldatei- & `.ZIP`-Paket-Import:** Unterstützt das Hochladen einzelner `.md`-, `.yml`- und `AGENTS.md`-Dateien sowie kompletter `.zip`-Skill-Archive (`importSkillsFromZipOrFiles`), die automatisch entpackt und indexiert werden.
- **Automatische Korruptions-Erkennung (`!`) & 1-Klick „Fix with AI“:** Fehlt in einer hochgeladenen `AGENTS.md` oder Skill-Datei ein gültiges `---`-YAML-Frontmatter, markiert Dev0 die Datei mit einem **`! CORRUPTED YAML`**-Warnbadge und repariert sie per Klick auf **„Fix with AI“** (`repairCorruptedSkillContent`), ohne bestehenden Inhalt zu löschen.
- **Flexible Auslöser-Steuerung:** Für jeden Skill und jede `AGENTS.md` lässt sich festlegen:
  - **Always (Background):** Wird automatisch im Hintergrund bei jeder Anfrage geladen.
  - **Trigger Words / Phrases / Letters:** Wird gezielt geladen, sobald bestimmte eigene Wörter, Sätze oder Buchstabenkombinationen im Prompt vorkommen (`matchActiveSkillsForTurn`).
  - **Manual (`@skill`):** Wird bei expliziter Erwähnung aktiviert.
- **Transparente `Loaded:`-Anzeige unten rechts:** Jede Chat-Nachricht zeigt unten rechts dezent an (`Loaded: <Skills / AGENTS.md>`), welche Skills und Regeln das System für diesen Turn tatsächlich geladen hat.

### Pfeiler 4: Interaktiver 2D Synapse Memory & Codebase Graph
Direkt erreichbar über **`Tools -> Graph`** (Slot 4) oder die Projekt-Kopfzeile (`components/SynapseGraphView.tsx`, `utils/synapse-graph.ts`):
- **Zwei spezialisierte Graph-Tabs:**
  1. **Memory Graph Tab (auch ohne aktives Projekt nutzbar):** Visualisiert gespeicherte Erkenntnisse, Architekturentscheidungen und YAML-Skills (`memory_search`, `memory_update`, `memory_delete`, `memory_graph_query`).
  2. **Project Code Graph Tab:** Indexiert alle Projektdateien, exportierten Funktionen, Komponenten, Hooks, Klassen, Imports und Funktionsaufrufe.
- **Volle Maus- & Touch-Interaktivität:**
  - **Node Drag & Drop:** Knoten frei auf der 2D-Fläche verschieben und anpinnen.
  - **Linksklick-Inspektor:** Detailansicht für Dateipfade, Verbindungen, Code-Vorschau und Memory-Inhalte.
  - **Rechtsklick- / Long-Press-Kontextmenü:** 2-Hop-Subgraph fokussieren, `@Pfad` in den Chat einfügen, Nachbarknoten hervorheben oder veraltete Memory-Knoten löschen.

### Pfeiler 5: Autonomer Multi-Agenten-Schwarm, Floating Relay & `.agents/`-Cron-Workflows
- **Strikter Question-Tool-Guard (`hasExplicitQuestionToolCall`):** Das Banner `KI-Rückfragen offen / Skip & Start Immediately` erscheint ausschließlich bei echten `ask_user_question`-Tool-Aufrufen oder aktiven Klärungsplänen – niemals durch normale `?`-Zeichen im Text.
- **Floating Question Modal & „AI Generate All“ (`components/SubAgentFloatingQuestionModal.tsx`):** Rückfragen von Sub-Agenten öffnen ein schwebendes Konfigurationsfenster. Mit **„AI Generate All“** legt sich ein diagonal gestreiftes Sperr-Overlay über die Felder, während die KI alle Parameter automatisch ausfüllt und den konfigurierten Sub-Agenten dauerhaft speichert.
- **Live Read-Only Sub-Agenten-Stream:** Ein Klick auf einen aktiven oder gespeicherten Sub-Agenten öffnet den Live-Stream (mit deaktiviertem Eingabefeld zur sicheren Beobachtung).
- **Versteckte `.agents/<slug>/`-Workspaces & Cron-Jobs (`utils/subagent-workspace.ts`):** Jeder Sub-Agent pflegt versteckte englische Statusdateien (`README.md`, `RULES.md`, `STATUS.md`, `LOG.md`) und unterstützt `finish_task`, `create_cron_job`, `sleep_agent` sowie `inspect_subagent_workspace`.

### Pfeiler 6: Zero-PII Server-Key-Tresor, 50-%-Not-Aus & Dual-Git-Restore
- **Server-Only Key-Tresor (`/api/pool`):** Geteilte API-Schlüssel liegen geschützt im Server-Tresor, werden in der UI maskiert (`gsk_••••••••••••9a1f`), gegen Prompt-Jailbreaks geprüft (`inspectPromptForKeyJailbreak`) und bei `max_tokens` hart begrenzt (`clampMaxTokensForPoolKey`).
- **Einstellbare 40-%-Warnung & 50-%-Not-Aus ohne Löschen:** Der Owner legt fest, ab wann gewarnt wird (Standard `40 %`) und wann der automatische Not-Aus greift (Standard `50 %`). Bei Erreichen wechselt der Schlüssel auf `status: 'emergency_stop'` (`isActive: false`), **ohne gelöscht zu werden**, und rotiert nahtlos zum nächsten aktiven Schlüssel.
- **Keyless-Fallback-Kaskade:** Auch ohne hinterlegten API-Key bleibt Dev0 dank Rork-Retry (`2x` Backoff) -> Pollinations AI (`openai`) sowie der 4-stufigen `web_search`- und 3-stufigen `web_fetch`-Kaskade voll einsatzfähig.
- **Dual-Git & Restore Points (`utils/git-restore.ts`):** Kombiniert sofortige Browser-Snapshots mit echten Git-Commits im isolierten Docker-Sandbox-Backend (`/api/sandbox`).

---

## 5. Strategische Bedeutung & Mehrwert für Partner & Unterstützer

Dev0 wurde als **nachhaltige, zukunftssichere Referenzplattform** für KI-gestützte Softwareentwicklung konzipiert:
1. **Demokratisierung autonomer KI-Entwicklung:** Durch die Kombination aus Keyless-Fallback, sicher verwaltetem Shared Key Pool (`/api/pool`) und nativer Unterstützung lokaler Modelle (Ollama / LM Studio) macht Dev0 modernste Multi-Agenten-Entwicklung für jeden zugänglich.
2. **Geprüfte Produktionsreife:** Abgesichert durch **92+ automatisierte Unit- und Integrationstests** (`npm test`), fehlerfreie TypeScript-Kompilierung (`npx tsc --noEmit`) und dreifache statische Code-Analyse (`ESLint`, `Biome`, `Oxlint`).
3. **Offenes Skill-Ökosystem:** Über `.zip`-Skill-Pakete und standardisierte `AGENTS.md`-Verträge können Unternehmen, Forschungsgruppen und Open-Source-Communities eigene domänenspezifische Engineering-Skills (Cloud, Security, WebGL, Mobile, Data Science) direkt für Dev0 bereitstellen.

---

*Weiterführende technische Details finden sich in der [Systemübersicht (DE)](SYSTEM_OVERVIEW.de.md) / [System Overview (EN)](SYSTEM_OVERVIEW.md), der [Multi-Agenten-Architektur (DE)](MULTI_AGENT_IMPLEMENTATION.de.md) / [Multi-Agent Architecture (EN)](MULTI_AGENT_IMPLEMENTATION.md) sowie im [Sicherheits- & Audit-Bericht (DE)](AUDIT_REPORT.de.md) / [Security & Audit Report (EN)](AUDIT_REPORT.md).*
