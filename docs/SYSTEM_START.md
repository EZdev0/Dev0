# 🚀 Dev0 System Startup, Docker Sandbox & Local LLM Guide (v1.9)

🇬🇧 **English** | 🇩🇪 [Deutsch](SYSTEM_START.de.md) · [⬅ Back to Documentation Hub](README.md) · [🌐 Master Concept](MASTER_CONCEPT.md)

---

## 1. Quick Start (Web, Android, iOS & API Server)

### Option A: Full-Stack Web & API Development Server (Port 3000 — Recommended)
```bash
# Install dependencies
npm install

# Start Web & Expo API Server on http://localhost:3000
npm run dev
```
- Serves the full Expo Router web application and all server-side API routes (`/api/chat`, `/api/pool`, `/api/sandbox`, `/api/models`, `/api/search`, `/api/fetch`) on **`http://localhost:3000`**.

### Option B: Android & iOS Native Development
```bash
# Launch Expo Metro bundler for Android Emulator / Expo Go
npm start -- --android

# Launch Expo Metro bundler for iOS Simulator (macOS)
npm start -- --ios
```

---

## 2. Local Open-Weight LLM Setup (Ollama & LM Studio)

Dev0 includes 1-tap presets and live `/api/models` catalog discovery with yellow search highlighting (`#FACC15`) in **Settings -> AI Provider**:

1. **Ollama (`http://localhost:11434/v1`):**
   ```bash
   ollama serve
   ollama pull qwen2.5-coder:14b
   ```
   - In Dev0 **Settings**, select **Custom / Local** and tap the **Ollama (`11434`)** preset button, then click **Load Models**.
2. **LM Studio (`http://localhost:1234/v1`):**
   - Start the LM Studio Local Server on port `1234` with CORS enabled.
   - In Dev0 **Settings**, tap the **LM Studio (`1234`)** preset button.
3. **3-Tier Hybrid Tool Parser:**
   - Local models automatically work with all Dev0 tools via native `tool_calls`, fenced JSON blocks, XML `<tool_call>` tags, or ReAct `Action:` / `Action Input:` blocks.

---

## 3. Isolated Docker Sandbox & Dual Git Restore Backend

Dev0 supports running user workspaces inside an isolated non-root Docker container alongside browser storage (`IndexedDB` / `AsyncStorage`):

```bash
# Build and start the isolated sandbox container
docker compose -f docker-compose.sandbox.yml up -d --build
```
- **Dual Git Restore Points (`utils/git-restore.ts`):** Every restore point created via the **Built-in Git & Restore Points** modal in Projects or via AI tools (`git_create_restore_point`, `git_restore_point`) is persisted in browser storage and mirrored to `/api/sandbox` Git commits.

---

## 4. Production Build & Verification Pipeline

```bash
# 1. TypeScript strict check (must exit with 0 errors)
npm run typecheck

# 2. Automated unit & integration tests (92+ tests)
npm test

# 3. Export static Web & API bundle (runs scripts/patch-modules.js automatically)
npm run export-web
```
