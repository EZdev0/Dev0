# AI Mega Brain — Bug Audit & Architectural Remediation Directory

This directory documents all diagnosed bugs, token-consumption bottlenecks, deprecation warnings, network errors, and platform incompatibilities identified in the AI Mega Brain workspace, along with their permanent architectural fixes.

---

## Index of Documented Bugs & Fixes

| ID | Title | Severity | Status | Primary Modules |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | [Excessive Token Consumption & Local LLM Tool Parsing Failures](./BUG_01_TOKEN_BURN_AND_LOCAL_LLM_PARSING.md) | Critical | Resolved | `utils/ai-service.ts`, `utils/synapse-graph.ts`, `utils/chat-compression.ts` |
| **BUG-02** | [Rork Toolkit SDK Deprecation Warnings & Metro Disconnect (1006)](./BUG_02_RORK_DEPRECATION_AND_METRO_1006.md) | High | Resolved | `providers/ChatProvider.tsx`, `scripts/patch-modules.js` |
| **BUG-03** | [Custom Models CORS NetworkError & Cross-Platform WebView/Wasm Preview](./BUG_03_CUSTOM_MODELS_CORS_AND_WEBVIEW_WASM.md) | High | Resolved | `app/api/models+api.ts`, `app/(tabs)/settings/index.tsx`, `components/HTMLPreview.tsx` |
| **BUG-04** | [Gemini 2.5/3 `thoughtSignature` HTTP 400 & Sub-Tab Lock Loop](./BUG_04_THOUGHT_SIGNATURE_AND_NAVIGATION.md) | Critical | Resolved | `utils/ai-service.ts`, `app/(tabs)/tools/index.tsx`, `components/MultiAgentUI.tsx` |

---

## Summary of Architectural Improvements

1. **RepoGraph / LocAgent Synapse Memory Graph (`utils/synapse-graph.ts`, `components/SynapseGraphView.tsx`)**:
   - Replaces blind full-repository text dumps with AST/regex code localization.
   - Indexes Projects, Files, Functions/Components/Hooks, Imports, Call relationships, Memories, and YAML Skills into an interactive graph.
2. **3-Tier Hybrid Tool Parser for Local & Open-Weight Models (`utils/ai-service.ts`)**:
   - Tier 1: Native API `tool_calls` / `functionCall` extraction.
   - Tier 2: Lenient fenced JSON & inline tool block parser with automatic JSON syntax repair.
   - Tier 3: ReAct XML tag parser (`<tool>...</tool><args>...</args>`, `<tool_call>...</tool_call>`) so local models (Ollama, LM Studio, Llama.cpp) execute tools reliably.
3. **YAML Skill Auto-Loader & Manual Sub-Agent Templates (`utils/skill-loader.ts`)**:
   - Automatically parses YAML frontmatter (`trigger`, `alwaysApply`, `name`, `description`) from `.qoder/rules/*` and project `.md` files.
   - Enables user-defined and AI-callable Sub-Agent templates with strict file-scope and tool-permission enforcement.
4. **"AI for Free" Shared Key Pool & Real Token Accounting (`utils/free-ai-pool.ts`, `components/FreeAIPoolModal.tsx`)**:
   - Reads real API token usage (`usage` / `usageMetadata` + cl100k BPE subword tokenizer fallback).
   - Allows users to share masked keys with token quotas, time limits, and per-user ID routing, with automatic key switching and warning notifications.
