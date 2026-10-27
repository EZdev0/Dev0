# BUG-03: Custom Models CORS NetworkError & Cross-Platform WebView/Wasm Preview

## 1. Symptoms
- Selecting the `Custom` provider or fetching model lists in Settings logged:
  - `[Settings] Error fetching custom models: NetworkError when attempting to fetch resource.`
- Opening `HTMLPreview` on Web or mobile browsers failed because `react-native-webview` does not support React Native Web out-of-the-box without a web-specific `<iframe>` implementation.

## 2. Root Cause Analysis
1. **Direct Browser Fetch to Third-Party/Local Endpoints**:
   - `app/(tabs)/settings/index.tsx` called `fetch(url + '/v1/models')` directly from the browser. Many custom OpenAI-compatible servers and gateways omit permissive CORS preflight headers for `/v1/models`, triggering `TypeError: NetworkError when attempting to fetch resource`.
2. **Native-Only `WebView` Component in `components/HTMLPreview.tsx`**:
   - `HTMLPreview.tsx` unconditionally rendered `<WebView source={{ html }} />` from `react-native-webview`, which is unsupported on `Platform.OS === 'web'`.

## 3. Architectural Solution
1. **Server-Side Models Proxy (`app/api/models+api.ts`)**:
   - Added an Expo Router API endpoint (`/api/models`) that proxies model discovery requests server-side with timeout protection and clean fallback when a custom endpoint does not expose `/v1/models`.
2. **2026 Cross-Platform Sandboxed Iframe + WebAssembly Preview (`components/HTMLPreview.tsx`)**:
   - On `Platform.OS === 'web'`, `HTMLPreview` now renders a sandboxed `<iframe>` (`srcDoc`) equipped with a built-in `WebAssembly` runtime helper (`window.runWasmBytes`), live console log capture (`postMessage` bridge), and responsive viewport switching (Mobile / Tablet / Desktop).
   - On iOS and Android, `HTMLPreview` continues to use `react-native-webview` with the same `WebAssembly` and console bridge injected.
3. **BUG-04 Reference**:
   - See `docs/AUDIT_REPORT.md` and `.qoder/rules/lessons_learned.md` for details on the Gemini 2.5/3 `thoughtSignature` self-healing implementation and sub-tab navigation fix.
