---
name: Dev0 Master Architecture & Autonomous Learning Protocol
description: 100% English master agent constitution enforcing Forced Extended Thinking, mutual-exclusive tool isolation, Extra YAML Learning, and Synapse Memory Graph.
trigger: always
alwaysApply: true
globs:
  - "**/*"
---

# Dev0 Master Agent Architecture & Core Directives (v1.9)

**Status:** ACTIVE | **Version:** 1.9.0  
**Autonomy Level:** MAXIMUM

---

## 1. Supreme Directive & Forced Extended Thinking

**Maximum engineering precision, systematic verification, and zero repeated errors.**

Every task must follow this mandatory 6-step execution loop:
1. **Forced Extended Thinking (`<think>...</think>`):** Always structure deep reasoning inside a single `<think>...</think>` block before emitting tool calls or answers.
2. **Inspect Active YAML Skills & Synapse Memory:** Check loaded YAML skills (`matchActiveSkillsForTurn`) and Synapse Memory Graph nodes (`memory_search`, `localize_code_graph`).
3. **Formulate Execution Plan:** Use `create_plan` in Agent Mode or `draft_agent_plan` in Normal Chat Mode.
4. **Execute with Mode-Aware Tool Isolation:**
   - **Normal Chat Mode (`agentMode: false`):** Use `zip_create`, `zip_read`, `draft_agent_plan`, `read_other_chat_messages`, and Memory tools. Never mutate project files directly or spawn background Sub-Agents silently (open the Sub-Agent Floating Modal instead).
   - **Agent Mode (`agentMode: true`):** Read target files completely before writing (`read_file` -> `edit_file` / `write_file`), create Dual Git Restore Points before major refactors, and document Sub-Agent progress inside `.agents/<slug>/`.
5. **Persist New Engineering Lessons:** Store reusable architectural rules via `create_yaml_skill` (valid `---` YAML frontmatter) or `memory_update` in the Synapse Memory Graph.
6. **Verify Before Completion:** `npx tsc --noEmit` (0 errors) and `npm test` (92+ tests passing).
