import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Cpu,
  FileArchive,
  GitBranch,
  Globe,
  Layers,
  Network,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';

export type ConceptLanguage = 'de' | 'en';

interface MasterConceptModalProps {
  visible: boolean;
  onClose: () => void;
  initialLanguage?: ConceptLanguage;
  onOpenSkillStudio?: () => void;
  onOpenFreePool?: () => void;
  onOpenTutorial?: () => void;
  onNavigateTab?: (tab: 'projects' | 'chat' | 'tools' | 'graph' | 'settings') => void;
}

interface ConceptPillar {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: 'vision' | 'modes' | 'orb' | 'yaml' | 'graph' | 'vault';
  principles: { heading: string; detail: string; metric: string }[];
  architectureAscii: string;
  outcomeSummary: string;
  actionLabel: string;
  actionTarget: 'chat' | 'skills' | 'graph' | 'pool' | 'projects' | 'tutorial';
}

const CONCEPT_PILLARS_DE: ConceptPillar[] = [
  {
    id: 'vision',
    badge: 'SÄULE 1 VON 6 • LEITBILD & ZIELGRUPPEN',
    title: 'Wofür Dev0 steht & Für wen es gebaut wurde',
    subtitle:
      'Zero Friction. Zero Hallucination. Infinite Autonomous Engineering — Eine selbstlernende KI-Arbeitsumgebung für Web, Android, iOS & Docker.',
    icon: 'vision',
    principles: [
      {
        heading: 'Solo-Founder & Indie-Builder („Vibecoders“)',
        detail:
          'Ideen ohne Terminal-Hürden in komplette Multi-Datei-Anwendungen verwandeln — mit 1-Klick PKZIP-Downloads im normalen Chat, interaktiven Ausführungsplänen und sofortigen Git-Wiederherstellungspunkten.',
        metric: 'Zero Friction',
      },
      {
        heading: 'Senior Software Engineers & Systemarchitekten',
        detail:
          'Deterministische Steuerung über Scoped Sub-Agenten (.agents/<slug>/), 2-Hop Ego-Subgraph Code-Lokalisierung (bis zu 75 % Token-Ersparnis) und echte Per-Chat Debug-Telemetrie.',
        metric: '46+ Engineering Tools',
      },
      {
        heading: 'Privacy-First & Local-LLM-Entwickler (Ollama / LM Studio)',
        detail:
          '1-Klick-Presets für Ollama (:11434) und LM Studio (:1234) mit 3-Stufen Hybrid-Tool-Parser (JSON, XML <tool_call> & ReAct Action-Blöcke).',
        metric: '100 % Lokal nutzbar',
      },
      {
        heading: 'Teams, Bildung, Hackathons & Partner-Ökosysteme',
        detail:
          'Sicheres Teilen von KI-Kontingenten über den Server-Key-Tresor (/api/pool) mit 3-Tier RBAC (Owner / Admin / User), 40-%-Warnung und nicht-destruktivem 50-%-Not-Aus.',
        metric: 'Zero-PII Governance',
      },
    ],
    architectureAscii: [
      '┌───────────────────────────────────────────────────────────────┐',
      '│              DEV0 MASTER-PLATTFORM (v1.9)                     │',
      '├───────────────────┬───────────────────┬───────────────────────┤',
      '│ Web / Desktop IDE │ Android / iOS App │ Docker Sandbox Git    │',
      '├───────────────────┴───────────────────┴───────────────────────┤',
      '│ • 10+ KI-Provider + Keyless Fallback + Ollama / LM Studio     │',
      '│ • 92+ automatisierte Tests & 0 TypeScript-Compiler-Fehler     │',
      '└───────────────────────────────────────────────────────────────┘',
    ].join('\n'),
    outcomeSummary:
      'Dev0 überzeugt Partner, Entwickler und Teams durch echte technische Tiefe, überprüfbare Sicherheit und plattformübergreifende Unabhängigkeit.',
    actionLabel: 'Interaktives Tutorial öffnen',
    actionTarget: 'tutorial',
  },
  {
    id: 'modes',
    badge: 'SÄULE 2 VON 6 • DUAL-MODE INTELLIGENZ',
    title: 'Strikte wechselseitige Tool-Isolation (Chat vs. Agent)',
    subtitle:
      'Kein versehentliches Überschreiben von Projektdateien mehr: Normal Chat Mode und Agent Mode sind architektonisch sauber getrennt.',
    icon: 'modes',
    principles: [
      {
        heading: 'Normal Chat Mode (Agent-Schalter AUS)',
        detail:
          'Alle Datei-, Git- und Hintergrund-Sub-Agent-Schreibwerkzeuge sind isoliert. Generierte Dateien werden als herunterladbare PKZIP-Grafikkarte (zip_create) bereitgestellt.',
        metric: 'PKZIP & Plan Cards',
      },
      {
        heading: 'Interaktive Ausführungspläne & Sub-Agent-Menü',
        detail:
          'Komplexe Vorhaben werden über draft_agent_plan als interaktive Karte mit „Proceed in Agent Mode“ entworfen. Sub-Agent-Anfragen öffnen gezielt das Floating-Konfigurationsmenü.',
        metric: 'Sichere Vorschau',
      },
      {
        heading: 'Agent Mode (Agent-Schalter EIN)',
        detail:
          'Schaltet alle 46+ Projekt-, Datei-, Git-, Web- und Sub-Agent-Werkzeuge frei, während reine Chat-ZIP-Tools ausgeblendet werden.',
        metric: 'Volle Autonomie',
      },
    ],
    architectureAscii: [
      '┌─────────────────────────────┐   ┌─────────────────────────────┐',
      '│ NORMAL CHAT MODE (!agent)   │   │ AGENT MODE (agentMode=true) │',
      '├─────────────────────────────┤   ├─────────────────────────────┤',
      '│ ✅ zip_create / zip_read    │   │ ✅ read/write/edit_file     │',
      '│ ✅ draft_agent_plan         │   │ ✅ git_create_restore_point │',
      '│ ✅ read_other_chat_messages │   │ ✅ sub_agent & finish_task  │',
      '│ 🚫 Keine Datei-Überschreibung│   │ 🚫 Keine Chat-ZIP-Kollision │',
      '└─────────────────────────────┘   └─────────────────────────────┘',
    ].join('\n'),
    outcomeSummary:
      'Jeder Modus besitzt exakt die Werkzeuge, die für seine Aufgabe optimal und sicher sind.',
    actionLabel: 'Zum KI-Chat wechseln',
    actionTarget: 'chat',
  },
  {
    id: 'orb',
    badge: 'SÄULE 3 VON 6 • EXTENDED THINKING & ORB',
    title: 'Erzwungenes Extended Thinking & Animierter Reasoning-Orb',
    subtitle:
      'Strukturiertes Chain-of-Thought (<think>...</think>) mit zweistufiger visueller Darstellung ohne doppelte Denkboxen.',
    icon: 'orb',
    principles: [
      {
        heading: 'Stufe 1: Nur der animierte Reasoning-Orb beim Initialisieren',
        detail:
          'Solange das Modell die ersten Reasoning-Tokens vorbereitet (isLive && !hasRealReasoning), erscheint ausschließlich der pulsierende Reasoning-Orb.',
        metric: 'Keine Doppelboxen',
      },
      {
        heading: 'Stufe 2: Einzelne Live-Text-Streaming-Box',
        detail:
          'Sobald der Denktext eintrifft, öffnet sich genau eine aufklappbare Text-Streaming-Box (ThinkingBlock) mit Live-Daueranzeige.',
        metric: 'Echtzeit-Streaming',
      },
      {
        heading: 'Kryptografisches thoughtSignature Self-Healing',
        detail:
          'Bewahrt Gemini 2.5/3 thoughtSignature-Felder über alle Tool-Runden hinweg und heilt HTTP-400-Signaturfehler automatisch in-place.',
        metric: 'Zero HTTP-400 Crash',
      },
    ],
    architectureAscii: [
      'Prompt ──► [Stufe 1: Pulsierender Reasoning-Orb (Warten auf Tokens)]',
      '       ──► [Stufe 2: Eine einzelne Text-Streaming-ThinkingBlock-Box]',
      '       ──► [Validierte Tool-Calls & Finale Antwort]',
    ].join('\n'),
    outcomeSummary:
      'Volle Transparenz über den Denkprozess der KI bei minimalem Platzbedarf auf Desktop und Mobile.',
    actionLabel: 'Im Chat erleben',
    actionTarget: 'chat',
  },
  {
    id: 'yaml',
    badge: 'SÄULE 4 VON 6 • EXTRA YAML LEARNING ENGINE',
    title: 'YAML-Skills, AGENTS.md, .ZIP-Importer & 1-Klick KI-Reparatur',
    subtitle:
      'Ersetzt die veralteten 5 Identitätsdateien durch modulare YAML-Skills mit automatischer Fehlererkennung (!) und Trigger-Steuerung.',
    icon: 'yaml',
    principles: [
      {
        heading: 'Einzeldatei- & .ZIP-Skill-Pack-Upload',
        detail:
          'Lade .md-, .yml-, AGENTS.md-Dateien oder komplette .zip-Skill-Archive hoch — alle Skills werden automatisch im Browser entpackt und ohne .qoder/-Präfixe angezeigt.',
        metric: '.ZIP Auto-Extract',
      },
      {
        heading: 'Korruptions-Erkennung (!) & 1-Klick „Fix with AI“',
        detail:
          'Fehlt bei einer AGENTS.md oder Skill-Datei der gültige YAML-Header (--- ... ---), markiert Dev0 sie mit „! CORRUPTED YAML“ und repariert sie per Klick auf „Fix with AI“.',
        metric: '1-Klick YAML-Fix',
      },
      {
        heading: 'Hintergrund vs. Eigene Trigger-Wörter & „Loaded:“-Badge',
        detail:
          'Wähle pro Skill zwischen Always (Background), eigenen Trigger-Wörtern/Sätzen oder Manual. Unten rechts in jeder Chat-Blase steht exakt „Loaded: <Skills / AGENTS.md>“.',
        metric: 'Transparente Attribution',
      },
    ],
    architectureAscii: [
      'Upload (.md / .yml / AGENTS.md / .zip)',
      '  ├── Gültiges YAML (---) ──► Aktiv (Always | Trigger-Wörter | Manual)',
      '  └── Fehlendes YAML (!)  ──► [1-Klick "Fix with AI"] ──► Valides YAML',
      '                                      │',
      '                                      ▼',
      '               Chat-Blase unten rechts: "Loaded: <Skill>"',
    ].join('\n'),
    outcomeSummary:
      'Das System lernt kontinuierlich dazu, repariert beschädigte Regeldateien selbstständig und zeigt transparent an, welches Wissen aktiv ist.',
    actionLabel: 'YAML Skill Studio öffnen',
    actionTarget: 'skills',
  },
  {
    id: 'graph',
    badge: 'SÄULE 5 VON 6 • SYNAPSE GRAPH & SUB-AGENTEN',
    title: '2D Synapse Memory Graph, Drag & Drop & Multi-Agenten-Schwarm',
    subtitle:
      'Interaktive Wissens- und Code-Visualisierung kombiniert mit spezialisierten Sub-Agenten und versteckten .agents/-Workspaces.',
    icon: 'graph',
    principles: [
      {
        heading: 'Getrennte Memory- & Projekt-Code-Graph-Tabs',
        detail:
          'Der Memory Graph funktioniert auch ohne aktives Projekt; der Project Code Graph visualisiert Dateien, Funktionen, Hooks, Klassen und Imports.',
        metric: '2D Interaktiv',
      },
      {
        heading: 'Drag & Drop, Linksklick-Inspektor & Rechtsklick-Menü',
        detail:
          'Knoten frei verschieben und anpinnen, per Linksklick inspizieren oder per Rechtsklick / Long-Press fokussieren, in den Chat einfügen oder bereinigen.',
        metric: 'Maus & Touch',
      },
      {
        heading: 'Floating Question Relay, „AI Generate All“ & Live-Stream',
        detail:
          'Konfiguriere Sub-Agenten mit dem „AI Generate All“-Sperr-Overlay, beobachte sie im Live Read-Only Stream und automatisiere Abläufe über .agents/<slug>/ und Cron-Jobs.',
        metric: 'Scoped Swarm',
      },
    ],
    architectureAscii: [
      'Tools -> [1. Dashboard] [2. Tools] [3. Plans] [4. Graph] [5. Search] [6. Chat]',
      '             │                                    │',
      '             ▼                                    ▼',
      '   Saved Sub-Agents & Live Stream       Memory Graph & Codebase Graph',
    ].join('\n'),
    outcomeSummary:
      'Kein blinder Token-Verbrauch mehr: Mensch und KI navigieren visuell durch Gedächtnis-Synapsen und Code-Abhängigkeiten.',
    actionLabel: 'Synapse Graph öffnen',
    actionTarget: 'graph',
  },
  {
    id: 'vault',
    badge: 'SÄULE 6 VON 6 • KEY-TRESOR, 50-%-NOT-AUS & DUAL-GIT',
    title: 'Server-Only Key-Tresor (/api/pool), 3-Tier RBAC & Dual-Git',
    subtitle:
      'Höchste Sicherheit für geteilte API-Schlüssel und jederzeitige 1-Klick-Wiederherstellung des gesamten Projekts.',
    icon: 'vault',
    principles: [
      {
        heading: 'Server-Only Key-Tresor & Anti-Jailbreak-Schutz',
        detail:
          'Geteilte API-Keys liegen im Server-Tresor (/api/pool), sind in der UI maskiert (gsk_••••9a1f) und gegen Prompt-Injection-Extraktion sowie Fake-Platzhalter geschützt.',
        metric: 'Zero Key Leaks',
      },
      {
        heading: '40-%-Warnung & Nicht-destruktiver 50-%-Not-Aus',
        detail:
          'Einstellbare Warnschwelle (40 %) und automatischer Not-Aus bei 50 % (status: emergency_stop), der den Schlüssel pausiert und rotiert — OHNE ihn jemals zu löschen.',
        metric: '50 % Not-Aus Schutz',
      },
      {
        heading: 'Eingebautes Dual-Git & 1-Klick Projekt-Löschung',
        detail:
          'Kombiniert sofortige Browser-Snapshots mit echten Docker-Git-Commits (/api/sandbox) und bietet eine klassische Dateibaum-Ansicht mit 1-Klick-Papierkorb.',
        metric: 'Dual Git Restore',
      },
    ],
    architectureAscii: [
      'API-Aufruf ──► Anti-Jailbreak Check ──► max_tokens Clamp',
      '           ──► [>= 40 %: Owner-Warnung]',
      '           ──► [>= 50 %: Automatischer Not-Aus (Pausiert, NICHT gelöscht!)]',
    ].join('\n'),
    outcomeSummary:
      'Volle Kosten- und Prompt-Hoheit für den Owner/Admin bei gleichzeitigem Schutz vor Datenverlust durch Dual-Git.',
    actionLabel: 'AI Key Pool & RBAC öffnen',
    actionTarget: 'pool',
  },
];

const CONCEPT_PILLARS_EN: ConceptPillar[] = [
  {
    id: 'vision',
    badge: 'PILLAR 1 OF 6 • VISION & TARGET AUDIENCES',
    title: 'What Dev0 Stands For & Who It Is Built For',
    subtitle:
      'Zero Friction. Zero Hallucination. Infinite Autonomous Engineering — A self-evolving AI Software Engineering Workspace for Web, Android, iOS & Docker.',
    icon: 'vision',
    principles: [
      {
        heading: 'Solo Founders & Indie Builders ("Vibecoders")',
        detail:
          'Turn product visions into complete multi-file apps without terminal friction—using 1-click downloadable PKZIP cards, visual execution plans, and instant Git restore points.',
        metric: 'Zero Friction',
      },
      {
        heading: 'Senior Software Engineers & Systems Architects',
        detail:
          'Deterministic control over scoped Sub-Agents (.agents/<slug>/), 2-hop Ego-Subgraph code localization (up to 75% token savings), and real per-chat debug telemetry.',
        metric: '46+ Engineering Tools',
      },
      {
        heading: 'Privacy-First & Local-LLM Engineers (Ollama / LM Studio)',
        detail:
          '1-tap presets for Ollama (:11434) and LM Studio (:1234) powered by a 3-Tier Hybrid Tool Parser (JSON, XML <tool_call>, and ReAct Action blocks).',
        metric: '100% Local-Capable',
      },
      {
        heading: 'Teams, Educators, Hackathons & Strategic Partners',
        detail:
          'Safely share AI quotas via the Server-Only Key Vault (/api/pool) with Zero-PII 3-Tier RBAC (Owner / Admin / User), 40% warning alerts, and non-destructive 50% Emergency Stop.',
        metric: 'Zero-PII Governance',
      },
    ],
    architectureAscii: [
      '┌───────────────────────────────────────────────────────────────┐',
      '│               DEV0 MASTER PLATFORM (v1.9)                     │',
      '├───────────────────┬───────────────────┬───────────────────────┤',
      '│ Web / Desktop IDE │ Android / iOS App │ Docker Sandbox Git    │',
      '├───────────────────┴───────────────────┴───────────────────────┤',
      '│ • 10+ AI Providers + Keyless Fallback + Ollama / LM Studio    │',
      '│ • 92+ Automated Unit/Integration Tests & 0 TypeScript Errors  │',
      '└───────────────────────────────────────────────────────────────┘',
    ].join('\n'),
    outcomeSummary:
      'Dev0 convinces engineering leaders, contributors, and strategic partners through architectural depth, verifiable safety, and cross-platform freedom.',
    actionLabel: 'Open Interactive Tutorial',
    actionTarget: 'tutorial',
  },
  {
    id: 'modes',
    badge: 'PILLAR 2 OF 6 • DUAL-MODE INTELLIGENCE',
    title: 'Strict Mutual-Exclusive Tool Isolation (Chat vs. Agent)',
    subtitle:
      'Zero accidental file overwrites: Normal Chat Mode and Agent Mode are architecturally isolated.',
    icon: 'modes',
    principles: [
      {
        heading: 'Normal Chat Mode (Agent Toggle OFF)',
        detail:
          'All project filesystem, Git, and background Sub-Agent mutation tools are stripped. Generated files are packaged into downloadable PKZIP Graphic Cards (zip_create).',
        metric: 'PKZIP & Plan Cards',
      },
      {
        heading: 'Interactive Plan Drafts & Sub-Agent Floating Menu',
        detail:
          'Complex architectures are drafted via draft_agent_plan with a 1-click "Proceed in Agent Mode" button. Sub-Agent requests open the Floating Configuration Modal.',
        metric: 'Safe Preview',
      },
      {
        heading: 'Agent Mode (Agent Toggle ON)',
        detail:
          'Unlocks all 46+ project, filesystem, Git, web, and Sub-Agent orchestration tools while hiding chat-only ZIP tools.',
        metric: 'Full Autonomy',
      },
    ],
    architectureAscii: [
      '┌─────────────────────────────┐   ┌─────────────────────────────┐',
      '│ NORMAL CHAT MODE (!agent)   │   │ AGENT MODE (agentMode=true) │',
      '├─────────────────────────────┤   ├─────────────────────────────┤',
      '│ ✅ zip_create / zip_read    │   │ ✅ read/write/edit_file     │',
      '│ ✅ draft_agent_plan         │   │ ✅ git_create_restore_point │',
      '│ ✅ read_other_chat_messages │   │ ✅ sub_agent & finish_task  │',
      '│ 🚫 Zero File Overwrites     │   │ 🚫 Zero Chat-ZIP Collisions │',
      '└─────────────────────────────┘   └─────────────────────────────┘',
    ].join('\n'),
    outcomeSummary:
      'Every mode exposes the exact toolset engineered for its workflow without cross-mode interference.',
    actionLabel: 'Switch to AI Chat',
    actionTarget: 'chat',
  },
  {
    id: 'orb',
    badge: 'PILLAR 3 OF 6 • EXTENDED THINKING & ORB',
    title: 'Forced Extended Thinking & Animated Reasoning Orb',
    subtitle:
      'Structured Chain-of-Thought (<think>...</think>) with two-stage visual feedback and zero duplicate boxes.',
    icon: 'orb',
    principles: [
      {
        heading: 'Stage 1: Animated Reasoning Orb Only While Waiting',
        detail:
          'While waiting for initial reasoning tokens (isLive && !hasRealReasoning), Dev0 renders ONLY the pulsing Reasoning Orb—never empty or duplicate boxes.',
        metric: 'Zero Duplicate Boxes',
      },
      {
        heading: 'Stage 2: Single Live Text-Streaming Box',
        detail:
          'As soon as reasoning text arrives, the Orb transitions into one collapsible text-streaming box (ThinkingBlock) with live duration tracking.',
        metric: 'Live Text Stream',
      },
      {
        heading: 'Cryptographic thoughtSignature Self-Healing',
        detail:
          'Preserves Gemini 2.5/3 thoughtSignature across tool turns and automatically flattens unsigned historical tool calls if an HTTP 400 occurs.',
        metric: 'Zero HTTP-400 Crash',
      },
    ],
    architectureAscii: [
      'Prompt ──► [Stage 1: Pulsing Reasoning Orb (Waiting for Tokens)]',
      '       ──► [Stage 2: Single Text-Streaming ThinkingBlock Box]',
      '       ──► [Validated Tool Calls & Final Response]',
    ].join('\n'),
    outcomeSummary:
      'Complete observability into AI reasoning with clean, distraction-free visual ergonomics.',
    actionLabel: 'Experience in AI Chat',
    actionTarget: 'chat',
  },
  {
    id: 'yaml',
    badge: 'PILLAR 4 OF 6 • EXTRA YAML LEARNING ENGINE',
    title: 'YAML Skills, AGENTS.md, .ZIP Importer & 1-Click AI Repair',
    subtitle:
      'Replaces the legacy 5 identity files with modular YAML skills, automatic corruption detection (!), and custom phrase triggers.',
    icon: 'yaml',
    principles: [
      {
        heading: 'Single-File & .ZIP Skill Pack Importer',
        detail:
          'Upload .md, .yml, AGENTS.md, or complete .zip skill archives—all skills are extracted automatically in the browser and displayed without .qoder/ prefixes.',
        metric: '.ZIP Auto-Extract',
      },
      {
        heading: 'Corrupted YAML Detection (!) & 1-Click "Fix with AI"',
        detail:
          'If an uploaded AGENTS.md or skill file lacks valid YAML frontmatter (--- ... ---), Dev0 flags it with "! CORRUPTED YAML" and repairs it in 1 click.',
        metric: '1-Click YAML Repair',
      },
      {
        heading: 'Background vs. Custom Trigger Words & "Loaded:" Badge',
        detail:
          'Configure each skill to load Always (Background), on Custom Trigger Words/Phrases/Letters, or Manually. Every chat bubble shows "Loaded: <Skills / AGENTS.md>" at the bottom right.',
        metric: 'Transparent Attribution',
      },
    ],
    architectureAscii: [
      'Upload (.md / .yml / AGENTS.md / .zip)',
      '  ├── Valid YAML (---) ──► Active (Always | Trigger Words | Manual)',
      '  └── Missing YAML (!) ──► [1-Click "Fix with AI"] ──► Valid YAML',
      '                                      │',
      '                                      ▼',
      '               ChatBubble Bottom-Right: "Loaded: <Skill>"',
    ].join('\n'),
    outcomeSummary:
      'Continuous self-learning with automatic YAML validation and transparent per-turn attribution.',
    actionLabel: 'Open YAML Skill Studio',
    actionTarget: 'skills',
  },
  {
    id: 'graph',
    badge: 'PILLAR 5 OF 6 • SYNAPSE GRAPH & SUB-AGENTS',
    title: '2D Synapse Memory Graph, Drag & Drop & Multi-Agent Swarm',
    subtitle:
      'Interactive knowledge and code graph paired with scoped Sub-Agents and hidden .agents/ Cron workflows.',
    icon: 'graph',
    principles: [
      {
        heading: 'Separate Memory Graph & Project Code Graph Tabs',
        detail:
          'The Memory Graph works with or without an active project; the Project Code Graph indexes files, exported functions, hooks, classes, and imports.',
        metric: '2D Interactive',
      },
      {
        heading: 'Drag & Drop, Left-Click Inspector & Right-Click Menu',
        detail:
          'Drag any node to reposition and pin it, left-click to inspect details, or right-click / long-press to focus a 2-hop subgraph, insert @path, or clean up nodes.',
        metric: 'Mouse & Touch',
      },
      {
        heading: 'Floating Question Relay, "AI Generate All" & Live Stream',
        detail:
          'Configure Sub-Agents with the "AI Generate All" striped lock overlay, watch execution in the Live Read-Only Stream, and automate .agents/<slug>/ Cron jobs.',
        metric: 'Scoped Swarm',
      },
    ],
    architectureAscii: [
      'Tools -> [1. Dashboard] [2. Tools] [3. Plans] [4. Graph] [5. Search] [6. Chat]',
      '             │                                    │',
      '             ▼                                    ▼',
      '   Saved Sub-Agents & Live Stream       Memory Graph & Codebase Graph',
    ].join('\n'),
    outcomeSummary:
      'Humans and AI agents navigate memory synapses and codebase dependencies visually with minimal token overhead.',
    actionLabel: 'Open Synapse Graph',
    actionTarget: 'graph',
  },
  {
    id: 'vault',
    badge: 'PILLAR 6 OF 6 • KEY VAULT, 50% CUTOFF & DUAL GIT',
    title: 'Server-Only Key Vault (/api/pool), 3-Tier RBAC & Dual Git',
    subtitle:
      'Enterprise-grade protection for shared API keys combined with 1-click Dual Git project recovery.',
    icon: 'vault',
    principles: [
      {
        heading: 'Server-Only Key Vault & Anti-Jailbreak Guard',
        detail:
          'Shared API keys reside in the server vault (/api/pool), remain masked in UI (gsk_••••9a1f), and block prompt-injection key extraction and fake placeholders.',
        metric: 'Zero Key Leaks',
      },
      {
        heading: '40% Warning Alert & Non-Destructive 50% Emergency Stop',
        detail:
          'Configurable warning threshold (40%) and automatic Emergency Auto-Cutoff at 50% (status: emergency_stop) that pauses and rotates keys WITHOUT deleting them.',
        metric: '50% Not-Aus Safety',
      },
      {
        heading: 'Built-in Dual Git & 1-Click Project Deletion',
        detail:
          'Combines instant browser snapshots with isolated Docker Git commits (/api/sandbox) alongside the classic File Tree view and 1-click project deletion.',
        metric: 'Dual Git Restore',
      },
    ],
    architectureAscii: [
      'API Request ──► Anti-Jailbreak Guard ──► max_tokens Clamp',
      '            ──► [>= 40%: Owner Warning Alert]',
      '            ──► [>= 50%: Emergency Auto-Cutoff (Paused, NEVER Deleted!)]',
    ].join('\n'),
    outcomeSummary:
      'Full quota and prompt control for Owners/Admins alongside zero-data-loss Dual Git version recovery.',
    actionLabel: 'Open AI Key Pool & RBAC',
    actionTarget: 'pool',
  },
];

export default function MasterConceptModal({
  visible,
  onClose,
  initialLanguage = 'de',
  onOpenSkillStudio,
  onOpenFreePool,
  onOpenTutorial,
  onNavigateTab,
}: MasterConceptModalProps) {
  const [lang, setLang] = useState<ConceptLanguage>(initialLanguage);
  const [pillarIndex, setPillarIndex] = useState<number>(0);

  const pillars = lang === 'de' ? CONCEPT_PILLARS_DE : CONCEPT_PILLARS_EN;
  const activePillar = pillars[pillarIndex] || pillars[0];

  const renderPillarIcon = (icon: ConceptPillar['icon'], size = 20) => {
    switch (icon) {
      case 'vision':
        return <Globe size={size} color={IDE.primary} />;
      case 'modes':
        return <Layers size={size} color={IDE.accent} />;
      case 'orb':
        return <Sparkles size={size} color="#8B5CF6" />;
      case 'yaml':
        return <FileArchive size={size} color={IDE.warning} />;
      case 'graph':
        return <Network size={size} color="#06B6D4" />;
      case 'vault':
        return <ShieldCheck size={size} color="#10B981" />;
    }
  };

  const handleTriggerAction = (target: ConceptPillar['actionTarget']) => {
    onClose();
    if (target === 'skills' && onOpenSkillStudio) {
      onOpenSkillStudio();
      return;
    }
    if (target === 'pool' && onOpenFreePool) {
      onOpenFreePool();
      return;
    }
    if (target === 'tutorial' && onOpenTutorial) {
      onOpenTutorial();
      return;
    }
    if (onNavigateTab) {
      if (target === 'chat') onNavigateTab('chat');
      else if (target === 'graph') onNavigateTab('graph');
      else if (target === 'projects') onNavigateTab('projects');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top Header with Bilingual Switcher */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerBadge}>
                <Cpu size={18} color={IDE.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>
                  {lang === 'de'
                    ? 'Dev0 — Master-Konzept & Systemarchitektur'
                    : 'Dev0 — Master Concept & System Architecture'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {lang === 'de'
                    ? 'Leitbild, Zielgruppen & die 6 technologischen Kernpfeiler (docs/MASTER_CONCEPT.de.md)'
                    : 'Vision, Target Personas & the 6 Technological Pillars (docs/MASTER_CONCEPT.md)'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.langSwitch}>
                <TouchableOpacity
                  style={[styles.langBtn, lang === 'de' && styles.langBtnActive]}
                  onPress={() => setLang('de')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.langBtnText, lang === 'de' && styles.langBtnTextActive]}>
                    DE
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
                  onPress={() => setLang('en')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>
                    EN
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityLabel="Close Master Concept"
              >
                <X size={18} color={IDE.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Pillar Selector Bar */}
          <View style={styles.pillarTabsBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillarTabsContent}
            >
              {pillars.map((p, idx) => {
                const isSelected = idx === pillarIndex;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pillarTab, isSelected && styles.pillarTabActive]}
                    onPress={() => setPillarIndex(idx)}
                    activeOpacity={0.75}
                  >
                    {renderPillarIcon(p.icon, 14)}
                    <Text
                      style={[
                        styles.pillarTabText,
                        isSelected && styles.pillarTabTextActive,
                      ]}
                    >
                      {idx + 1}. {p.id.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Main Scrollable Content */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroBanner}>
              <View style={styles.heroIconWrap}>
                {renderPillarIcon(activePillar.icon, 24)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroKicker}>{activePillar.badge}</Text>
                <Text style={styles.heroTitle}>{activePillar.title}</Text>
                <Text style={styles.heroSubtitle}>{activePillar.subtitle}</Text>
              </View>
            </View>

            {/* Capability & Principle Cards */}
            <View style={styles.principlesList}>
              {activePillar.principles.map((item, idx) => (
                <View key={idx} style={styles.principleCard}>
                  <View style={styles.principleTopRow}>
                    <View style={styles.principleTitleWrap}>
                      <CheckCircle2 size={15} color={IDE.accent} />
                      <Text style={styles.principleHeading}>{item.heading}</Text>
                    </View>
                    <Text style={styles.principleMetric}>{item.metric}</Text>
                  </View>
                  <Text style={styles.principleDetail}>{item.detail}</Text>
                </View>
              ))}
            </View>

            {/* Architecture Diagram Block */}
            <View style={styles.diagramBox}>
              <Text style={styles.diagramLabel}>
                {lang === 'de' ? 'SYSTEMARCHITEKTUR & DATENFLUSS' : 'SYSTEM ARCHITECTURE & DATA FLOW'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.diagramCode}>{activePillar.architectureAscii}</Text>
              </ScrollView>
            </View>

            {/* Strategic Outcome Note */}
            <View style={styles.outcomeBox}>
              <Zap size={16} color={IDE.warning} />
              <Text style={styles.outcomeText}>{activePillar.outcomeSummary}</Text>
            </View>
          </ScrollView>

          {/* Footer Navigation & Direct Action Launcher */}
          <View style={styles.footer}>
            <View style={styles.footerNav}>
              <TouchableOpacity
                style={[styles.navBtn, pillarIndex === 0 && styles.navBtnDisabled]}
                disabled={pillarIndex === 0}
                onPress={() => setPillarIndex(i => Math.max(0, i - 1))}
              >
                <Text style={styles.navBtnText}>
                  {lang === 'de' ? '← Zurück' : '← Previous'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.navBtn,
                  pillarIndex === pillars.length - 1 && styles.navBtnDisabled,
                ]}
                disabled={pillarIndex === pillars.length - 1}
                onPress={() => setPillarIndex(i => Math.min(pillars.length - 1, i + 1))}
              >
                <Text style={styles.navBtnText}>
                  {lang === 'de' ? 'Weiter →' : 'Next →'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => handleTriggerAction(activePillar.actionTarget)}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionText}>{activePillar.actionLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    backgroundColor: IDE.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IDE.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    backgroundColor: IDE.bg,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: IDE.primary + '18',
    borderWidth: 1,
    borderColor: IDE.primary + '45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IDE.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: IDE.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langSwitch: {
    flexDirection: 'row',
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 2,
  },
  langBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  langBtnActive: {
    backgroundColor: IDE.primary,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.textSecondary,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarTabsBar: {
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    backgroundColor: IDE.bg,
  },
  pillarTabsContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  pillarTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  pillarTabActive: {
    backgroundColor: IDE.primary + '20',
    borderColor: IDE.primary,
  },
  pillarTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.textSecondary,
  },
  pillarTabTextActive: {
    color: IDE.text,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 14,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: IDE.primary,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IDE.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
  },
  principlesList: {
    gap: 10,
  },
  principleCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    gap: 6,
  },
  principleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  principleTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  principleHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: IDE.text,
    flex: 1,
  },
  principleMetric: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.primary,
  },
  principleDetail: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
  },
  diagramBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#070A12',
    borderWidth: 1,
    borderColor: IDE.border,
    gap: 6,
  },
  diagramLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: IDE.muted,
    letterSpacing: 0.8,
  },
  diagramCode: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#93C5FD',
    lineHeight: 16,
  },
  outcomeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: IDE.warning + '12',
    borderWidth: 1,
    borderColor: IDE.warning + '40',
  },
  outcomeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: IDE.text,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    backgroundColor: IDE.bg,
  },
  footerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: IDE.text,
  },
  primaryActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: IDE.primary,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
