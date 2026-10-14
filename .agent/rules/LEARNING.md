# 🧠 System Memory & Learned Constraints (LEARNING.md)

*This file acts as long-term memory for all AI tools working in this repository to prevent repeating past errors.*

## 📋 Resolved Lessons & Known Issues

### [2026-03-02] React Hooks Order & Conditional Returns
- **[ERROR]** `Rendered fewer hooks than expected` runtime error.
- **[CAUSE]** React Hook called conditionally after an early `if (!data) return null;` check.
- **[PREVENTION]** Declare all React Hooks (`useState`, `useMemo`, `useCallback`) unconditionally at the very top of the component function before any return statements.

### [2026-03-02] Asynchronous Fetch Timeouts
- **[ERROR]** App hangs on weak network connections during web requests.
- **[CAUSE]** Missing timeout configuration on fetch calls.
- **[PREVENTION]** Pass an `AbortSignal.timeout(ms)` or custom signal to every network request.

### [2026-03-02] Read-Before-Write File Edits
- **[ERROR]** Overwriting imports or breaking adjacent functions during search/replace.
- **[CAUSE]** Editing a file without reading the surrounding lines.
- **[PREVENTION]** Always inspect complete file content before generating replacement chunks.

---

## 📝 Error Entry Template for Future AI Actions

```markdown
### [2026-09-12] Studio AI fetch CORS Issue in Web
- **[ERROR]** Studio KI fails to fetch when hosted or outside of Expo Go due to CORS blocks (`network error`).
- **[CAUSE]** `@rork-ai/toolkit-sdk`'s `useRorkAgent` uses a hardcoded `expoFetch` and `AGENT_URL` that cannot be overridden by default, which causes browsers to block the request via CORS.
- **[PREVENTION]** Patch `@rork-ai/toolkit-sdk/lib/module/agent.js` (and `.d.ts`) via `postinstall` to allow `fetch` overrides in `useRorkAgent`, then wrap the fetch call in `ChatProvider.tsx` using a CORS proxy (e.g. `corsproxy.io`) for web builds.

```markdown
### [YYYY-MM-DD] <Title of Issue>
- **[ERROR]** Description of failure.
- **[CAUSE]** Root cause analysis.
- **[PREVENTION]** Specific rule to avoid recurrence.
```

### [2026-09-12] Direct Push to Main Violation
- **[ERROR]** AI agent pushed fixes directly to the \main\ branch, bypassing the user's manual review process.
- **[CAUSE]** Missing strict Git workflow constraint in user preferences.
- **[PREVENTION]** Agents MUST ALWAYS create a feature branch, commit changes locally, push the branch to remote, and provide a Pull Request URL. The user will handle merging.

### [2026-09-12] Missing Server URL in Response
- **[ERROR]** The AI started the development server but did not explicitly provide the clickable localhost link in its response.
- **[CAUSE]** Lack of a strict communication rule requiring the URL.
- **[PREVENTION]** The AI MUST always append the clickable URL (e.g., http://localhost:8081) to its response whenever it starts a server.

### [2026-09-12] Branching Discipline Violation
- **[ERROR]** The AI pushed a massive new feature (Critic Agent & Architecture) into an existing PR branch (\fix-studio-ki-web-deployment\) instead of isolating it.
- **[CAUSE]** The AI assumed it could reuse the current branch because it wasn't \main\.
- **[PREVENTION]** The AI MUST ALWAYS create a explicitly NEW branch (and provide the new PR link) for every new task, ensuring separation of concerns.

### [2026-10-12] Missing Complete PR Message with Pull Request Link
- **[ERROR]** Providing only a PR link or high-level summary without a structured, copy-pasteable PR description and title.
- **[CAUSE]** Missing rule requiring a complete GitHub PR template/message in the final response.
- **[PREVENTION]** Whenever creating or updating a PR, the AI MUST ALWAYS include a ready-to-use PR message (Title, Description, Detailed Changes, Test Verification) alongside the PR link.

### [2026-10-14] Mandatory Persistent Memory Recall & Active Tool Engagement
- **[CONTEXT]** Persistent Memory plugin successfully installed and validated with SQLite FTS5 BM25 search across 428 conversations and 21,300+ messages.
- **[DIRECTIVE]** The user mandates that the AI MUST ALWAYS proactively query Persistent Memory (`get_user_profile` and `search_past_memory`) and leverage active MCP tools and Skills on every task.
- **[PREVENTION]** Never begin solving complex tasks without first querying memory for existing patterns, solutions, and historical fixes. Always incorporate remembered context into the strategy.

