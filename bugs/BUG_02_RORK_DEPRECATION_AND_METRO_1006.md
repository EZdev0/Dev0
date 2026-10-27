# BUG-02: Rork Toolkit SDK Deprecation Warnings & Metro Disconnect (1006)

## 1. Symptoms
- Console logs displayed persistent deprecation warnings on startup:
  - `App Warning [Toolkit] createRorkTool is deprecated. Use an official AI SDK with Toolkit v2 for new apps.`
  - `App Warning [Toolkit] useRorkAgent is deprecated. Use an official AI SDK with Toolkit v2 for new apps.`
- Periodic WebSocket disconnect warnings in containerized/cloud preview environments:
  - `App Warning Disconnected from Metro (1006)`

## 2. Root Cause Analysis
1. **Unconditional Hook Execution in `ChatProvider.tsx`**:
   - Even when running on Web or using non-Rork providers, `ChatProvider` imported and invoked `createRorkTool` inside `useMemo` and `useRorkAgent` at the top level of the component hook.
   - `@rork-ai/toolkit-sdk` logs a deprecation warning every time `createRorkTool` or `useRorkAgent` is called.
2. **Redundant Dual Execution Path**:
   - `utils/ai-service.ts` already implements a hardened, retry-capable `callRork` function with automatic keyless fallback to Pollinations AI (`callPollinationsFallback`), pre-API context compression, and tool parsing.
3. **Metro HMR WebSocket**:
   - When HMR is disabled in cloud iframe environments, Metro's client WebSocket closes with code `1006`.

## 3. Architectural Solution
1. **Unified `callAI` Execution Pipeline in `ChatProvider.tsx`**:
   - Removed the deprecated `createRorkTool` and `useRorkAgent` calls from `ChatProvider.tsx`.
   - Routed all providers—including `rork` ("Studio KI") and the new **"AI for Free"** shared pool—through the unified manual tool-execution loop backed by `callAI`.
   - This eliminates both deprecation warnings, unifies tool permission checks across Web and Native, and ensures 100% consistent token accounting.
2. **Resilient HMR & Reverse-Proxy CORS Guard (`scripts/patch-modules.js`, `app.json`)**:
   - Patched `expo/src/async-require/hmr.ts` and Metro client initialization to gracefully ignore `hot=false` / `1006` socket closures without disrupting bundle loading.
   - Removed the hardcoded `"origin": "https://rork.com/"` constraint from `app.json` and patched `@expo/cli/build/src/start/server/middleware/CorsMiddleware.js` to accept Cloud Run (`*.run.app`), Netlify (`*.netlify.app`), and reverse-proxy `Origin` headers without throwing `Error: Unauthorized request from ...`.

