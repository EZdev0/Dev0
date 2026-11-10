# 🛠️ Core Engines & Utilities (`utils/README.md`) — EN / DE (v1.9)

🇬🇧 **English** | 🇩🇪 **Deutsch (unten)** · [⬅ Main README](../README.md) · [🌐 Master Concept](../docs/MASTER_CONCEPT.md)

---

## 🇬🇧 English Overview

This directory houses the core architectural engines of **Dev0 v1.9**:

| Module | Responsibility |
| :--- | :--- |
| **`ai-service.ts`** | Multi-provider AI gateway (OpenAI, Anthropic, Gemini, Groq, OpenRouter, NVIDIA NIM, Rork + Pollinations keyless fallback, Local Ollama/LM Studio), Forced Extended Thinking (`<think>...</think>`), 3-Tier Hybrid Tool Parser, and Gemini `thoughtSignature` self-healing. |
| **`skill-loader.ts`** | **Extra YAML Learning & `AGENTS.md` Engine:** `.md`/`.yml`/`.zip` skill pack importer (`importSkillsFromZipOrFiles`), `.qoder/` prefix stripping, `! CORRUPTED YAML` detection, 1-click AI repair (`repairCorruptedSkillContent`), and dynamic background vs. trigger phrase matching (`matchActiveSkillsForTurn`). |
| **`synapse-graph.ts`** | **2D Synapse Memory & Codebase Graph:** Indexes files, exported symbols, imports, calls, memories, and YAML skills (`buildSynapseGraph`, `buildMemoryOnlySynapseGraph`, `localize_code_graph`, `cleanStaleMemoryGraphLinks`). |
| **`free-ai-pool.ts`** | **"AI for Free" Key Pool & Zero-PII 3-Tier RBAC:** Placeholder detection (`detectAuthOrKeyPlaceholder`), anti-jailbreak inspection (`inspectPromptForKeyJailbreak`), BPE token accounting (`estimateTokensBPE`), `40%` warning alerts, and non-destructive `50%` Emergency Auto-Cutoff (*Not-Aus*). |
| **`git-restore.ts`** | **Built-in Dual Git & Restore Point Engine:** Snapshot diffing (`computeSnapshotDiff`), browser restore points, and Docker `/api/sandbox` Git commit mirroring. |
| **`chat-zip.ts` & `cross-chat-reader.ts`** | In-memory PKZIP archive creation/reading (`zip_create`, `zip_read`) and token-efficient (`< 1,750 chars`) BM25 cross-chat search (`read_other_chat_messages`). |
| **`subagent-workspace.ts` & `subagent-question-relay.ts`** | Hidden `.agents/<slug>/` workspace management, Cron workflows, strict `hasExplicitQuestionToolCall` guard, and `"AI Generate All"` helper. |

---

## 🇩🇪 Deutsche Übersicht

Dieses Verzeichnis enthält die technologischen Kernmodule von **Dev0 v1.9**:

- **`ai-service.ts`**: Multi-Provider-KI-Schnittstelle inklusive Keyless-Fallback, Forced Extended Thinking (`<think>...</think>`), 3-Stufen-Tool-Parser (JSON/XML/ReAct) und Gemini `thoughtSignature`-Self-Healing.
- **`skill-loader.ts`**: **Extra YAML Learning & `AGENTS.md` Engine** mit `.zip`-Skill-Pack-Importer, `.qoder/`-Bereinigung, `! CORRUPTED YAML`-Erkennung, 1-Klick-Reparatur (`repairCorruptedSkillContent`) und Trigger-Wort-Matching (`matchActiveSkillsForTurn`).
- **`synapse-graph.ts`**: **2D Synapse Memory & Codebase Graph** (`buildSynapseGraph`, `buildMemoryOnlySynapseGraph`, `localize_code_graph`).
- **`free-ai-pool.ts`**: **Shared Key Pool & 3-Tier RBAC** mit Platzhalter-Erkennung, Anti-Jailbreak-Prüfung, BPE-Token-Zähler, `40-%`-Warnung und nicht-destruktivem `50-%`-Not-Aus.
- **`git-restore.ts`**: **Duales Git- & Wiederherstellungspunkt-System** (Browser + Docker `/api/sandbox`).
- **`chat-zip.ts` & `cross-chat-reader.ts`**: PKZIP-Erstellung im Chat (`zip_create`, `zip_read`) und BM25-Suche über andere Chats (`read_other_chat_messages`).
