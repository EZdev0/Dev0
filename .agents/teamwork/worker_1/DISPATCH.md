# Dispatch: worker_1

## Objective
Implement targeted dependency fixes in `package.json` and `package-lock.json` for `image-size`, `undici`, and `node-forge`, verify all automated test suites, commit to `feat/dependabot-vulnerability-fixes`, push to remote, and prepare the PR template.

## Working Directory
`d:/AI_mega_Brain_rork/.agents/teamwork/worker_1`

## File Ownership
- Primary: `package.json`, `package-lock.json`
- Metadata: `d:/AI_mega_Brain_rork/.agents/teamwork/worker_1/*`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Input Context
- `d:/AI_mega_Brain_rork/.agents/teamwork/ORIGINAL_REQUEST.md`
- `d:/AI_mega_Brain_rork/.agents/teamwork/explorer_1/analysis.md`
- `d:/AI_mega_Brain_rork/.agents/teamwork/explorer_1/handoff.md`
- `d:/AI_mega_Brain_rork/.agents/teamwork/orchestrator_1/SCOPE.md`

## Instructions
1. Switch to or create the dedicated branch:
   `git checkout -b feat/dependabot-vulnerability-fixes` (or switch if exists).
2. Update `package.json` overrides to add `"image-size": "^2.0.4"` alongside `"undici": "^7.29.1"` and `"node-forge": "^1.4.0"`:
   ```json
   "overrides": {
     "image-size": "^2.0.4",
     "undici": "^7.29.1",
     "node-forge": "^1.4.0"
   }
   ```
3. Update `package-lock.json` by running `npm install` (or `npm install --package-lock-only`). Ensure no broken peer dependencies and no downgrading of Expo SDK 54 or React Native.
4. Execute full automated verification:
   - `npm test` (all suites must pass)
   - `npx tsc --noEmit` (must exit 0 with 0 errors)
   - `npm run lint` (must exit 0 with 0 errors)
   - Verify image-size resolution and Metro compatibility.
5. Commit all changes to `feat/dependabot-vulnerability-fixes` with a clean, semantic commit message.
6. Push the branch to remote: `git push -u origin feat/dependabot-vulnerability-fixes`.
7. Prepare a comprehensive Pull Request message template (Title, Summary, Changes, Verification).
8. Write detailed findings to `d:/AI_mega_Brain_rork/.agents/teamwork/worker_1/report.md` and `d:/AI_mega_Brain_rork/.agents/teamwork/worker_1/handoff.md`.
9. Send completion notification back to Orchestrator (092fd3fe-0714-4280-a415-7820c94785bf) via `send_message`.

## Strict Rule
DO NOT spawn any subagents (enforce strict depth limit of 1).


## 2026-10-12T16:23:02Z
Resume work at d:/AI_mega_Brain_rork/.agents/teamwork/worker_1. Read DISPATCH.md, d:/AI_mega_Brain_rork/.agents/teamwork/ORIGINAL_REQUEST.md, and d:/AI_mega_Brain_rork/.agents/teamwork/explorer_1/analysis.md.
Follow all instructions in DISPATCH.md:
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
Checkout or create feat/dependabot-vulnerability-fixes branch.
Update package.json overrides with "image-size": "^2.0.4" alongside existing overrides for undici and node-forge.
Regenerate package-lock.json cleanly via npm install.
Run full verification: npm test, npx tsc --noEmit, npm run lint, and metro asset check.
Commit and push to remote origin. Prepare PR template.
Write report to report.md and handoff.md in your working directory.
Parent ID is 092fd3fe-0714-4280-a415-7820c94785bf. Report back with send_message.
Do NOT spawn any subagents.
