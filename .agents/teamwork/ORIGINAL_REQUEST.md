# Original User Request

## 2026-10-12T16:13:48Z

# Teamwork Project Prompt — Final

> Status: Launched
> Goal: Delegate to teamwork_preview
> Requested team: Small focused team of parallel security fixers (strict token-saving mode)

Resolve open GitHub Dependabot vulnerabilities (`image-size`, `undici`, `node-forge`, and remaining audit findings) across `package.json` and `package-lock.json` in a strictly token-saving, isolated manner without breaking Expo SDK 54 or React Native Web compatibility. Keep agent count minimal to avoid quota limits.

Working directory: d:/AI_mega_Brain_rork
Integrity mode: development

## Requirements

### R1. Target Vulnerable Dependencies Individually
Isolate and update each identified vulnerable package (`image-size` to patched >=2.0.3 or ^1.2.0 non-DoS, `undici` to ^7.29.1, `node-forge` to ^1.4.0) via targeted npm overrides or package upgrades.

### R2. Strict Expo SDK 54 & Metro Compatibility
Ensure all dependency updates maintain strict runtime compatibility with Expo SDK 54, React Native 0.81, and Metro bundler. Avoid breaking major version bumps (e.g., do not force TypeScript 7 or incompatible CLI tools).

### R3. Automated Regression Verification
Every single dependency fix must be verified with automated test suites (`npm test`), full TypeScript compilation (`npx tsc --noEmit`), and linter (`npm run lint`).

### R4. Version Control & PR Discipline
Commit all verified fixes to a dedicated branch (`feat/dependabot-vulnerability-fixes`), push to GitHub, and provide a complete, copy-pasteable PR description and link.

## Acceptance Criteria

### Security & Dependency Health
- [ ] `npm audit` shows High-severity vulnerabilities for `image-size`, `undici`, and `node-forge` are resolved.
- [ ] `package.json` and `package-lock.json` remain valid and consistent.

### Build & Test Integrity
- [ ] `npm test` runs all test suites with 0 failures.
- [ ] `npx tsc --noEmit` exits with 0 type errors.
- [ ] `npm run lint` exits with 0 errors.

### Delivery
- [ ] Changes committed to a new feature branch and pushed to remote.
- [ ] Full Pull Request template message (Title, Summary, Changes, Verification) provided.
