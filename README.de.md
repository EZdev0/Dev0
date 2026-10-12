# Dev0

🇬🇧 [English](README.md) | 🇩🇪 [Deutsch](README.de.md)

Willkommen bei der **Dev0**, einer leistungsstarken, plattformübergreifenden nativen mobilen IDE-Anwendung, die mit React Native und Expo entwickelt wurde. Dev0 bietet eine integrierte KI-gesteuerte Entwicklungsumgebung und unterstützt nativ eine Vielzahl von KI-Anbietern.

## Projektinformationen

- **Plattform**: Native iOS, Android und Web
- **Framework**: Expo Router + React Native
- **Paketmanager**: Bun
- **Sprache**: TypeScript

## Hauptfunktionen

- **Multi-Provider KI-Integration**: Unterstützt nativ OpenAI, Anthropic, Gemini, Groq, OpenRouter, NVIDIA NIM und Custom/Local-Modelle.
- **Rork Integration**: Nutzt das `@rork-ai/toolkit-sdk` für den robusten Rork-Anbieter (Studio KI).
- **Benutzerdefiniertes natives Markdown-Rendering**: Verwendet einen hochoptimierten, benutzerdefinierten Regex-basierten Markdown-Parser (`utils/syntax.ts`) in `ChatBubble.tsx`. Dieser unterstützt GitHub Flavored Markdown (GFM) Tabellen und eingebettete `<iframe>` Tags, die nahtlos auf React Native WebViews abgebildet werden, ohne auf aufgeblähte externe Markdown-Bibliotheken angewiesen zu sein.
- **Plattformübergreifendes Proxying (Web CORS)**:
  - Im Web werden KI-Anfragen an das Rork-Toolkit reibungslos über eine lokale Expo-API-Route (`app/api/chat+api.ts`) weitergeleitet. Dadurch wird sichergestellt, dass Server-Sent Events (SSE) Streaming durch direkte Weitergabe von `response.body` perfekt funktioniert.
  - Anfragen an NVIDIA NIM werden über Netlify-Redirects (`/api/nvidia/*` zu `https://integrate.api.nvidia.com/:splat`), die in `netlify.toml` konfiguriert sind, abgewickelt.
  - Native Apps umgehen diese Proxys effizient und rufen die Endpunkte direkt auf.
- **Sponsoren-Integration**: Beinhaltet eine GitHub Sponsors Integration für [EZdev0](https://github.com/EZdev0) (Kontakt: EZdev-info@proton.me). Bietet ein globales Overlay (`SponsorOverlay`) mit einem strikten 5-sekündigen, nicht überspringbaren Countdown, das dynamisch basierend auf der Anzahl von Benutzerinteraktionen ausgelöst wird.

## Verzeichnisstruktur

Hier ist ein kurzer Überblick über die Projektstruktur. Jeder Ordner enthält eine eigene `README.md` mit weiteren Details (auf Englisch):

- [components/](components/README.md) - Wiederverwendbare UI-Komponenten
- [app/](app/README.md) - Expo Router Screens und Layouts
- [app/api/](app/api/README.md) - Serverseitige API-Routen
- [netlify/](netlify/README.md) - Netlify Funktionen und Konfigurationen
- [utils/](utils/README.md) - Hilfsfunktionen und Utilities
- [docs/](docs/README.md) - Zusätzliche Dokumentation
- [providers/](providers/README.md) - React Context Provider
- [scripts/](scripts/README.md) - Automatisierungs- und Build-Skripte
- [assets/](assets/README.md) - Statische Dateien wie Bilder und Schriftarten
- [\_\_tests\_\_/](__tests__/README.md) - Jest Unit-Tests
- [constants/](constants/README.md) - Globale Konfigurationen und Konstanten
- [types/](types/README.md) - TypeScript Interfaces und Typen

## Erste Schritte

### Voraussetzungen
- [Node.js](https://nodejs.org/) & [Bun](https://bun.sh/)

### Installation

```bash
# 1. Repository klonen
git clone <YOUR_GIT_URL>
cd studio-ide

# 2. Abhängigkeiten mit Bun installieren
bun i
```

### Lokale Entwicklung (Immer erst lokal testen, bevor bereitgestellt wird!)

```bash
# Web-Vorschau starten
bun run start web

# iOS Simulator starten
bun run start -- --ios

# Android Emulator starten
bun run start -- --android
```

## Testen

Das Projekt verwendet **Jest** für Unit-Tests, mit einem starken Fokus auf robuste Null-Fehler-Behandlung.

```bash
# Tests ausführen
npm run test
# oder
npx jest
```

## Build & Deployment

Wir verwenden GitHub Actions (`eas-build.yml`) für Continuous Integration.

### Web Deployment (Netlify)
Web-Builds werden über Expo exportiert und auf Netlify bereitgestellt. Dabei wird der Adapter `expo-server/adapter/netlify` verwendet, um serverseitige Expo API-Routen zu unterstützen.
```bash
bun x expo export -p web
```

### Android Deployment
Android-Builds nutzen EAS (Expo Application Services) unter dem EAS-Projektbesitzer `ezdev2`, um die Zertifikatsanforderungen für iOS Apple Developer zu umgehen.
```bash
eas build --platform android
```

---
*Mit ❤️ vom Dev0 Team gepflegt. Diese Dokumentationen bei Strukturänderungen immer aktualisieren!*
