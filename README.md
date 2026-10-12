# Dev0

🇬🇧 [English](README.md) | 🇩🇪 [Deutsch](README.de.md)

Welcome to **Dev0**, a powerful, cross-platform native mobile IDE application built with React Native and Expo. Dev0 provides an integrated AI-driven development environment, natively supporting a wide array of AI providers.

## Project Information

- **Platform**: Native iOS, Android, and Web
- **Framework**: Expo Router + React Native
- **Package Manager**: Bun
- **Language**: TypeScript

## Key Features

- **Multi-Provider AI Integration**: Natively supports OpenAI, Anthropic, Gemini, Groq, OpenRouter, NVIDIA NIM, and Custom/Local models.
- **Rork Integration**: Leverages `@rork-ai/toolkit-sdk` for the robust Rork provider (Studio KI).
- **Custom Native Markdown Rendering**: Utilizes a highly optimized custom regex-based markdown parser (`utils/syntax.ts`) inside `ChatBubble.tsx`. It supports GitHub Flavored Markdown (GFM) tables and embedded `<iframe>` tags mapped seamlessly to React Native WebViews without relying on bulky external markdown libraries.
- **Cross-Platform Proxying (Web CORS)**:
  - On the web, AI requests to the Rork toolkit are smoothly proxied via a local Expo API route (`app/api/chat+api.ts`), ensuring Server-Sent Events (SSE) streaming works perfectly by passing `response.body` directly.
  - NVIDIA NIM requests are handled through Netlify redirects (`/api/nvidia/*` to `https://integrate.api.nvidia.com/:splat`) configured in `netlify.toml`.
  - Native apps efficiently bypass these proxies to call endpoints directly.
- **Sponsor Integration**: Includes a GitHub Sponsors integration for [EZdev0](https://github.com/EZdev0) (Contact: EZdev-info@proton.me). Features a global overlay (`SponsorOverlay`) with a strict 5-second unskippable countdown, dynamically triggered based on user interaction counts.

## Directory Structure

Here is a quick overview of the project structure. Each folder contains its own `README.md` with further details:

- [components/](components/README.md) - Reusable UI components
- [app/](app/README.md) - Expo Router screens and layouts
- [app/api/](app/api/README.md) - Server-side API routes
- [netlify/](netlify/README.md) - Netlify functions and configurations
- [utils/](utils/README.md) - Helper functions and utilities
- [docs/](docs/README.md) - Additional documentation
- [providers/](providers/README.md) - React context providers
- [scripts/](scripts/README.md) - Automation and build scripts
- [assets/](assets/README.md) - Static files like images and fonts
- [\_\_tests\_\_/](__tests__/README.md) - Jest unit tests
- [constants/](constants/README.md) - Global configurations and constants
- [types/](types/README.md) - TypeScript interfaces and types

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) & [Bun](https://bun.sh/)

### Installation

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd studio-ide

# 2. Install dependencies using Bun
bun i
```

### Local Development (Always test locally before deploying!)

```bash
# Start web preview
bun run start web

# Start iOS Simulator
bun run start -- --ios

# Start Android Emulator
bun run start -- --android
```

## Testing

The project uses **Jest** for unit testing, focusing heavily on robust null error handling.

```bash
# Run tests
npm run test
# or
npx jest
```

## Build & Deployment

We use GitHub Actions (`eas-build.yml`) for Continuous Integration.

### Web Deployment (Netlify)
Web builds are exported via Expo and deployed on Netlify, using the `expo-server/adapter/netlify` adapter to support Expo server-side API routes.
```bash
bun x expo export -p web
```

### Android Deployment
Android builds use EAS (Expo Application Services) under the EAS project owner `ezdev2` to bypass iOS Apple Developer certificate requirements.
```bash
eas build --platform android
```

---
*Maintained with ❤️ by the Dev0 Team. Always update these documentations when changing the structure!*
