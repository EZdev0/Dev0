# BUG-01: Excessive Token Consumption & Local LLM Tool Parsing Failures

## 1. Symptoms
- **High Token Burn ("Tokenschleuder")**: Multi-turn coding conversations and agent runs consumed tens of thousands of tokens per turn because entire file trees, uncompressed tool outputs, and full file contents were repeatedly injected into prompts.
- **Local LLM Tool Calling Failures**: Local models running via Ollama, LM Studio, or custom OpenAI-compatible endpoints frequently failed to trigger tools, emitted malformed JSON, or wrapped tool invocations in XML/Markdown blocks (`<tool_call>`, `<tool>`, ````json`) that the strict native parser ignored.

## 2. Root Cause Analysis
1. **Lack of Structural Code Localization**: Without a structural graph of the project, the agent had to call `read_file` on multiple large files to locate a single function definition or dependency chain.
2. **Single-Tier Native Tool Parsing**: `callOpenAI` only inspected `choice.message.tool_calls` unless `usedFlattenedTools` was triggered by an HTTP 400 error. Local models that returned tool calls inside `choice.message.content` (using ReAct tags or fenced JSON blocks) were treated as plain text responses.
3. **Missing Real-Time Token Telemetry**: Token usage was not tracked from provider responses (`usage` / `usageMetadata`), giving users no visibility into prompt vs. completion token expenditure.

## 3. Architectural Solution
1. **RepoGraph / LocAgent Code & Memory Synapse Indexer (`utils/synapse-graph.ts`)**:
   - Parses project files to extract exported functions, hooks, classes, and import/call relationships alongside linked project memories.
   - Generates a compact localized subgraph context for prompts, cutting context token overhead by 60–80%.
2. **3-Tier Hybrid Tool Parser (`utils/ai-service.ts`)**:
   - **Tier 1**: Native `tool_calls` / `functionCall` array.
   - **Tier 2**: Fenced ````tool` / ````json` and inline JSON object extraction with automatic trailing-comma and quote repair (`repairAndParseJSON`).
   - **Tier 3**: ReAct XML tag fallback (`<tool>name</tool><args>{...}</args>`, `<tool_call>{...}</tool_call>`, and `Action: ... / Action Input: ...`).
3. **Real Token Accounting (`utils/free-ai-pool.ts`)**:
   - Extracts exact `prompt_tokens` and `completion_tokens` from API responses and falls back to a deterministic BPE subword estimator (`estimateTokensBPE`) when streaming.
