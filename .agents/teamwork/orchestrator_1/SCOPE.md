# Scope: Dependabot Vulnerability Fixes

## Architecture & Context
- Workspace: React Native / Expo SDK 54 project
- Target Vulnerabilities: `image-size`, `undici`, `node-forge`, and remaining audit findings
- Key Constraints: Strict Expo SDK 54, React Native 0.81, and Metro bundler runtime compatibility. No breaking TypeScript / CLI bumps.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dependency Audit & Tree Mapping | Investigate package.json / package-lock.json and npm audit report | M1 | ORIGINAL_REQUEST.md |
| 2 | image-size Resolution | Update or override image-size (>=2.0.3 or ^1.2.0 non-DoS) | M2 | ORIGINAL_REQUEST.md |
| 3 | undici Resolution | Update or override undici (^7.29.1) | M2 | ORIGINAL_REQUEST.md |
| 4 | node-forge Resolution | Update or override node-forge (^1.4.0) | M2 | ORIGINAL_REQUEST.md |
| 5 | Regression Verification | Run npm test, npx tsc --noEmit, npm run lint | M3 | ORIGINAL_REQUEST.md |
| 6 | Git Branch & PR Delivery | Commit on feat/dependabot-vulnerability-fixes, push, draft PR template | M4 | ORIGINAL_REQUEST.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Analysis | Audit vulnerability trees, Expo SDK 54 dependencies, git state | none | DONE |
| 2 | Targeted Dependency Fixes | Apply overrides in package.json and update package-lock.json | M1 | IN_PROGRESS |
| 3 | Verification & Review | Automated tests, lint, tsc, reviewer, challenger, auditor | M2 | PLANNED |
| 4 | Version Control & PR | Commit to feat/dependabot-vulnerability-fixes, push, PR description | M3 | PLANNED |
