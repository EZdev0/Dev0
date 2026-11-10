# 🚀 Dev0 Schnellstart-, Docker-Sandbox- & Local-LLM-Handbuch (v1.9)

🇬🇧 [English](SYSTEM_START.md) | 🇩🇪 **Deutsch** · [⬅ Zurück zum Dokumentations-Zentrum](README.de.md) · [🌐 Master-Konzept](MASTER_CONCEPT.de.md)

---

## 1. Schnellstart (Web, Android, iOS & API-Server)

### Option A: Full-Stack Web- & API-Entwicklungsserver (Port 3000 — Empfohlen)
```bash
# Abhängigkeiten installieren
npm install

# Web-App & Expo-API-Server auf http://localhost:3000 starten
npm run dev
```
- Stellt die gesamte Web-Oberfläche sowie alle serverseitigen API-Routen (`/api/chat`, `/api/pool`, `/api/sandbox`, `/api/models`, `/api/search`, `/api/fetch`) unter **`http://localhost:3000`** bereit.

### Option B: Native Entwicklung für Android & iOS
```bash
# Expo Metro Bundler für Android Emulator / Expo Go starten
npm start -- --android

# Expo Metro Bundler für iOS Simulator (macOS) starten
npm start -- --ios
```

---

## 2. Lokale Open-Weight-KI-Modelle (Ollama & LM Studio)

Dev0 bietet in **Settings -> AI Provider** 1-Klick-Presets sowie eine Live-Modellsuche über `/api/models` mit gelber Suchmarkierung (`#FACC15`):

1. **Ollama (`http://localhost:11434/v1`):**
   ```bash
   ollama serve
   ollama pull qwen2.5-coder:14b
   ```
   - Wähle in den Dev0-**Settings** den Anbieter **Custom / Local**, tippe auf das Preset **Ollama (`11434`)** und klicke auf **Load Models**.
2. **LM Studio (`http://localhost:1234/v1`):**
   - Starte den lokalen Server in LM Studio auf Port `1234` (CORS aktiviert).
   - Tippe in den Dev0-**Settings** auf das Preset **LM Studio (`1234`)**.
3. **3-Stufen Hybrid-Tool-Parser:**
   - Lokale Modelle können sämtliche Dev0-Tools sowohl über native `tool_calls` als auch über eingezäunte JSON-Blöcke, XML-`<tool_call>`-Tags oder ReAct-`Action:`/`Action Input:`-Blöcke aufrufen.

---

## 3. Isolierte Docker-Sandbox & Dual-Git-Backend

Dev0 unterstützt isolierte Non-Root-Docker-Sandboxes parallel zum Browser-Speicher (`IndexedDB` / `AsyncStorage`):

```bash
# Isolierten Sandbox-Container bauen und starten
docker compose -f docker-compose.sandbox.yml up -d --build
```
- **Duale Git-Wiederherstellungspunkte (`utils/git-restore.ts`):** Jeder Wiederherstellungspunkt aus dem **Built-in Git & Restore Points**-Modal oder den KI-Tools (`git_create_restore_point`, `git_restore_point`) wird im Browser gespeichert und gleichzeitig als Git-Commit an `/api/sandbox` gespiegelt.

---

## 4. Produktions-Build & Verifizierungs-Pipeline

```bash
# 1. Strikte TypeScript-Prüfung (muss mit 0 Fehlern abschließen)
npm run typecheck

# 2. Automatisierte Unit- & Integrationstests (92+ Tests)
npm test

# 3. Statisches Web- & API-Bundle exportieren (führt scripts/patch-modules.js automatisch aus)
npm run export-web
```
