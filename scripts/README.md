# ⚙️ Build, Patch & Test Runner Scripts (`scripts/README.md`) — EN / DE (v1.9)

🇬🇧 **English** | 🇩🇪 **Deutsch (unten)** · [⬅ Main README](../README.md) · [🌐 Master Concept](../docs/MASTER_CONCEPT.md)

---

## 🇬🇧 English Overview

This directory contains automation, module patching, and test execution scripts:
- **`scripts/patch-modules.js`:** Applies compatibility shims for `expo-router/internal/static` and `expo-router/internal/routing`, patches `metro-file-map` to ignore transient `.bun-tmp-*` directories, and disables noisy HMR overlays in iframe preview environments.
- **`scripts/test-runner.js`:** Executes the complete 92+ unit and integration test suite across `__tests__/utils/*`.

---

## 🇩🇪 Deutsche Übersicht

Dieses Verzeichnis enthält Build-, Patch- und Test-Skripte:
- **`scripts/patch-modules.js`:** Erstellt Kompatibilitäts-Shims für `expo-router`, schützt `metro-file-map` vor temporären `.bun-tmp-*`-Ordnern und stabilisiert den Web-Preview-Betrieb.
- **`scripts/test-runner.js`:** Führt alle 92+ automatisierten Unit- und Integrationstests unter `__tests__/utils/*` aus.
