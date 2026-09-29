# 🤖 Master AI Agent Architecture & Core Directives

> **Status:** ACTIVE | **Scope:** Universal AI Assistants (Antigravity, Cursor, Claude Code, Windsurf, Copilot, Qoder)  
> **User:** Jonas (Vibcoder) | **Autonomy Level:** MAXIMUM

---

## 🎯 Core Directive

**Maximum logic, systematic execution, and zero repeated errors.**

All AI assistants and sub-agents operating within this codebase must strictly observe the following execution loop:

```text
1. Read Context & Rules (.agent/rules/RULES.md, LEARNING.md, USER.md)
2. Analyze Codebase (Read files thoroughly before writing)
3. Formulate Plan (For complex multi-step tasks)
4. Execute with Precision (TypeScript strict mode, React hook safety)
5. Validate (Compile, test, check for zero runtime/linter errors)
6. Log Learnings (Update LEARNING.md if any new errors or edge cases occur)
```

---

## 1. Universal Rule Loading Order

Every AI tool operating in this repository must inspect and enforce rules in the following hierarchy:

1. **`AGENTS.md`** (Root Contract & Architecture Directives)
2. **`.agent/rules/USER.md`** (User Communication & Coding Preferences)
3. **`.agent/rules/LEARNING.md`** (Active System Memory & Error Log)
4. **`.agent/rules/RULES.md`** (Operational Coding & Engineering Standards)

---

## 2. Execution Guardrails & Anti-Hallucination

- **Read-Before-Write:** ALWAYS read target files completely before making edits.
- **Never Assume or Fabricate:** Validate APIs, imports, and types against actual codebase files or external documentation via search.
- **Strict Error Handling:** Do not mask exceptions, return fallback placeholders, or ignore failing tests. Fix root causes.
- **No Repeated Errors:** If an issue occurs, log it immediately in `.agent/rules/LEARNING.md` and avoid repeating it.

---

## 3. Multi-Agent & Autonomy Protocols

- **Maximal Autonomy:** Proactively install missing dependencies (`npm install`), research documentation via search, and execute tests before declaring a task finished.
- **Multi-Agent Hierarchy:**
  - **Lead / Main Agent:** Formulates strategy, manages state, coordinates sub-agents, communicates with user.
  - **Analyst Sub-Agent:** Read-only inspection, architectural mapping, dependency tracing.
  - **Developer Sub-Agent:** Code edits, refactoring, feature implementation.
  - **Tester Sub-Agent:** Test execution, verification, runtime checks.
- **Permissions:**
  - **Read Operations:** Always permitted.
  - **Write / Execute Operations:** Permitted under high autonomy / user approval.

---

## 4. Verification Checklist

Before reporting completion:
- [ ] TypeScript compilation (`npx tsc --noEmit`) passes with 0 errors.
- [ ] Code formatting and linting guidelines are followed.
- [ ] React Hooks adhere strictly to Rules of Hooks (hooks declared before conditional returns).
- [ ] Any runtime error encountered during development has been documented in `LEARNING.md`.
