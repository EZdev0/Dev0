import { FileNode } from '@/types';

let _id = 1000;
function sid(): string {
  return 'self_' + (_id++);
}

function file(name: string, content: string): FileNode {
  return { id: sid(), name, type: 'file', content };
}

function dir(name: string, children: FileNode[]): FileNode {
  return { id: sid(), name, type: 'directory', children };
}

function generateReadme(): string {
  return `# Studio Mobile IDE — Quellcode-Dokumentation

## Übersicht

Studio Mobile IDE ist eine mobile Code-Entwicklungsumgebung mit integriertem KI-Assistenten.
Gebaut mit **React Native (Expo)**, **TypeScript** und **Expo Router**.

---

## Project Structure

\`\`\`
studio-mobile-ide/
├── app/                          # Expo Router Seiten
│   ├── _layout.tsx               # Root-Layout: Provider-Hierarchie, Navigation
│   ├── editor.tsx                # Code-Editor Screen (Syntax-Highlighting, Bearbeiten)
│   ├── +not-found.tsx            # 404-Seite
│   ├── +native-intent.tsx        # Native Intent Handler
│   └── (tabs)/                   # Tab-Navigation
│       ├── _layout.tsx           # Tab-Konfiguration (4 Tabs)
│       ├── (home)/               # Projects Tab
│       │   ├── _layout.tsx       # Stack Navigation for Home
│       │   └── index.tsx         # Project list, file tree, create/delete
│       ├── chat/                 # AI Chat Tab
│       │   ├── _layout.tsx       # Stack Navigation for Chat
│       │   └── index.tsx         # Chat-Interface, Agent-Modus, Anhänge
│       ├── tools/                # Tools Tab
│       │   ├── _layout.tsx       # Stack Navigation for Tools
│       │   └── index.tsx         # Tool-Registry, Pläne, Memos, Search
│       └── settings/             # Settings Tab
│           ├── _layout.tsx       # Stack Navigation for Settings
│           └── index.tsx         # API-Keys, Modelle, Persona, Beta-Features
│
├── components/                   # Wiederverwendbare Komponenten
│   ├── AgentPlanView.tsx         # Agent-Plan Grafik (To-Do-Visualisierung)
│   ├── AgentTaskCard.tsx         # Einzelne Task-Karte im Plan
│   ├── ChatBubble.tsx            # Chat-Nachricht (Markdown, Code, Formatierung)
│   ├── FileTreeItem.tsx          # Dateibaum-Eintrag (Ordner/Datei)
│   ├── ThinkingBlock.tsx         # KI-Denkprozess Anzeige (Live-Stream)
│   └── ToolCallView.tsx          # Tool-Aufruf Anzeige (Parameter, Ergebnis)
│
├── constants/
│   └── colors.ts                 # IDE Farbschema (Dark Theme)
│
├── providers/                    # React Context Provider
│   ├── AgentProvider.tsx         # Agent-Modus: Planung, Task-Ausführung, Tool-Calls
│   ├── AppProvider.tsx           # App settings, Todos, Memos, Tool-Berechtigungen
│   ├── ChatProvider.tsx          # Chat history, KI-Kommunikation, Komprimierung
│   └── ProjectProvider.tsx       # Project management, File system, Search
│
├── types/
│   └── index.ts                  # TypeScript Typen, Interfaces, Konstanten
│
├── utils/
│   ├── ai-service.ts             # KI-API Integration (Multi-Provider, Streaming, Tools)
│   ├── download.ts               # Projekt-Export/Download System
│   ├── file-icons.ts             # File Icons, Colors, Language Recognition
│   ├── sample-project.ts         # Sample Projects (Android, Web, Python, IDE)
│   ├── self-source.ts            # App Source Code as Project (diese Datei)
│   └── syntax.ts                 # Syntax Highlighting Engine
│
├── app.json                      # Expo-Konfiguration
├── babel.config.js               # Babel-Konfiguration
├── package.json                  # Abhängigkeiten
└── tsconfig.json                 # TypeScript-Konfiguration
\`\`\`

---

## Architektur

### Provider-Hierarchie (app/_layout.tsx)

\`\`\`
QueryClientProvider (React Query)
  └── GestureHandlerRootView
      └── AppProvider (Einstellungen, Todos, Memos)
          └── ProjectProvider (Projekte, Dateien)
              └── ChatProvider (Chat history, KI)
                  └── AgentProvider (Agent-Modus, Pläne)
                      └── RootLayoutNav (Expo Router Stack)
\`\`\`

### Navigation (Expo Router)

- **Tab-Navigation**: 4 Tabs (Projekte, KI-Chat, Werkzeuge, Einstellungen)
- **Stack innerhalb jedes Tabs**: Ermöglicht verschachtelte Navigation
- **Editor**: Modal/Card-Präsentation über den Tabs

### Daten-Persistenz

- **AsyncStorage**: Projekte, Einstellungen, Chat history, Todos, Memos
- **React Query**: Server-State Management
- **@nkzw/create-context-hook**: Context-Provider Erstellung

---

## Dateibeschreibungen

### app/_layout.tsx
Root-Layout der gesamten App. Konfiguriert die Provider-Hierarchie:
- QueryClientProvider für React Query
- GestureHandlerRootView für Touch-Gesten
- AppProvider, ProjectProvider, ChatProvider, AgentProvider
- Stack-Navigation mit Editor als Card-Modal

### app/editor.tsx
Vollständiger Code-Editor mit:
- Syntax-Highlighting (multi-language)
- Zeilennummern (schaltbar)
- Bearbeitungsmodus mit Symbol-Leiste
- Save/discard changes
- Breadcrumb-Navigation
- Status-Leiste (Zeilen, Zeichen, Sprache)

### app/(tabs)/(home)/index.tsx
Project managementsseite:
- Project tabs to switch between projects
- Dateibaum mit Ordner-Navigation
- Search in Dateien
- Create, delete, rename file/folder
- Long-Press Kontextmenü
- Projekt-Export/Download

### app/(tabs)/chat/index.tsx
KI-Chat-Interface:
- Nachrichten mit Markdown-Formatierung
- Agent-Modus mit Plan-Erstellung
- Datei-Anhänge für Kontext
- Tool-Vorschläge und Bestätigungen
- Breathing-Animation während KI arbeitet
- Streaming-Antworten

### app/(tabs)/tools/index.tsx
Werkzeuge-Verwaltung:
- Tool-Registry mit Kategorien
- Berechtigungen (Immer/Fragen/Blockiert/Entfernt)
- Agent-Plan Übersicht
- Memos (Projekt-Notizen)
- Datei-Search (grep)
- Chat-Komprimierung

### app/(tabs)/settings/index.tsx
Einstellungen:
- KI-Anbieter Auswahl (7 Provider)
- API-Schlüssel Verwaltung
- Persona-Auswahl
- Editor-Einstellungen (Schriftgröße, Zeilennummern)
- Verhalten (YOLO, Auto-Retry, Auto-Fallback)
- Beta-Features (Web-Search, Web-Fetch, Agent-Lernen)

### providers/AppProvider.tsx
Central app settings:
- Settings mit AsyncStorage Persistenz
- Todo-Liste (CRUD)
- Memos (CRUD)
- Tool-Berechtigungen
- API-Key Verwaltung
- Agent.md / Soul.md

### providers/ProjectProvider.tsx
Projekt- und Dateiverwaltung:
- Multiple projects at once
- Dateibaum (FileNode) Manipulation
- Read, write, create, delete files
- Verzeichnis-Navigation
- Datei-Search
- Projekt-Export

### providers/ChatProvider.tsx
Chat-Verwaltung:
- Nachrichtenverlauf mit AsyncStorage
- KI-API Aufrufe (Streaming)
- Tool-Call Verarbeitung
- Chat-Komprimierung
- Multi-Provider Support

### providers/AgentProvider.tsx
Agent-Modus:
- Plan-Erstellung aus User-Anfragen
- Task-Ausführung mit Tool-Calls
- Brainstorming-Schritte
- Error handling and retry
- Tool-Genehmigung (Ask-Modus)
- Finale Antwort-Generierung

### utils/ai-service.ts
KI-API Integration:
- Multi-Provider (OpenAI, Anthropic, Gemini, Groq, OpenRouter, Custom)
- Streaming-Support
- Tool-Call Parsing
- Rate-Limit Handling
- Auto-Fallback zwischen Providern
- Request/Response Formatierung

### utils/download.ts
Projekt-Export System:
- Flatten von FileNode-Bäumen
- Text-Bundle Export (formatiert)
- JSON-Export (maschinenlesbar)
- Web: Blob-Download
- Native: expo-file-system + expo-sharing
- Datei-Statistiken

### utils/syntax.ts
Syntax-Highlighting:
- Multi-Language Keywords (Kotlin, Java, TS, JS, Python, Go, Rust, Swift, Dart, CSS, SQL, Shell)
- Token-basiertes Highlighting
- XML/HTML spezifisches Highlighting
- JSON-Highlighting
- Markdown-Segment Parsing

### components/AgentPlanView.tsx
Agent-Plan Visualisierung:
- To-Do Grafik mit Fortschrittsanzeige
- Task-Status (Draft, Pending, Running, Completed, Error)
- Drag & Drop zum Umsortieren (Long-Press)
- Einklappbare Task-Details
- Tool-Usage Zusammenfassung
- Brainstorming-Stream Anzeige

### components/ChatBubble.tsx
Chat-Nachricht Komponente:
- Markdown-Rendering (Überschriften, Listen, Code, Links)
- Code-Block mit Syntax-Highlighting
- Tool-Call Anzeige (eingeklappt)
- Thinking-Block Integration
- Web-Ergebnis Rendering
- Kopieren/Bearbeiten Aktionen

### types/index.ts
Central Type Definitions:
- FileNode, Project (File system)
- ChatMessage, ToolCall (Chat)
- AgentPlan, AgentTask (Agent)
- AppSettings (Einstellungen)
- AI_PROVIDERS, PERSONAS (Konfiguration)
- TOOL_REGISTRY (Tool-Definitionen)
- PROJECT_TYPES (Projekt-Vorlagen)

---

## Technologie-Stack

| Technologie | Version | Zweck |
|-------------|---------|-------|
| React Native | 0.81.5 | UI Framework |
| Expo | SDK 54 | Build & Deploy |
| Expo Router | 6.x | File-based Routing |
| TypeScript | 5.9 | Typsicherheit |
| React Query | 5.x | Server State |
| AsyncStorage | 2.2 | Lokale Persistenz |
| Lucide Icons | 0.475 | Icon-Bibliothek |
| Zod | 4.x | Schema-Validierung |

## Farbschema (constants/colors.ts)

| Farbe | Hex | Verwendung |
|-------|-----|------------|
| Primary | #3B82F6 | Akzentfarbe, Links |
| Background | #0F172A | Haupthintergrund |
| Surface | #1E293B | Karten, Header |
| Text | #F1F5F9 | Haupttext |
| Muted | #64748B | Sekundärtext |
| Accent | #10B981 | Erfolg, Grün |
| Danger | #EF4444 | Fehler, Löschen |
| Warning | #F59E0B | Warnungen, Beta |

---

## Lizenz & Version

Studio Mobile IDE v1.4
Erstellt mit Expo SDK 54 + React Native 0.81
`;
}

export function createSelfSourceProject(): FileNode[] {
  _id = 1000;

  return [
    file('README.md', generateReadme()),

    file('package.json', `{
  "name": "expo-app",
  "main": "expo-router/entry",
  "version": "1.0.0",
  "scripts": {
    "start": "expo start",
    "lint": "expo lint"
  },
  "dependencies": {
    "@expo/vector-icons": "^15.0.3",
    "@nkzw/create-context-hook": "^1.1.0",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@tanstack/react-query": "^5.83.0",
    "expo": "~54.0.27",
    "expo-blur": "~15.0.8",
    "expo-clipboard": "~8.0.8",
    "expo-constants": "~18.0.11",
    "expo-file-system": "~18.0.0",
    "expo-font": "~14.0.10",
    "expo-haptics": "~15.0.8",
    "expo-image": "~3.0.11",
    "expo-image-picker": "~17.0.9",
    "expo-linear-gradient": "~15.0.8",
    "expo-linking": "~8.0.10",
    "expo-router": "~6.0.17",
    "expo-sharing": "~13.0.0",
    "expo-splash-screen": "~31.0.12",
    "expo-status-bar": "~3.0.9",
    "expo-web-browser": "~15.0.10",
    "lucide-react-native": "^0.475.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.81.5",
    "react-native-gesture-handler": "~2.28.0",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-svg": "15.12.1",
    "react-native-web": "^0.21.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@types/react": "~19.1.10",
    "eslint": "^9.31.0",
    "eslint-config-expo": "~10.0.0",
    "typescript": "~5.9.2"
  },
  "private": true
}`),

    file('app.json', `{
  "expo": {
    "name": "Studio Mobile IDE",
    "slug": "studio-mobile-ide",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "rork-app",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "app.rork.studio-mobile-ide"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "app.rork.studio_mobile_ide"
    },
    "web": {
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      ["expo-router", { "origin": "https://rork.com/" }],
      "expo-font",
      "expo-web-browser"
    ],
    "experiments": { "typedRoutes": true }
  }
}`),

    file('tsconfig.json', `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "baseUrl": null,
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}`),

    file('babel.config.js', `module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
  };
};`),

    file('.gitignore', `*.iml
.gradle
node_modules/
.expo/
dist/
web-build/
*.log`),

    dir('constants', [
      file('colors.ts', `export const IDE = {
  primary: '#3B82F6',
  bg: '#0F172A',
  surface: '#1E293B',
  surfaceHover: '#253348',
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  muted: '#64748B',
  accent: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  border: '#334155',
  keyword: '#C792EA',
  string: '#C3E88D',
  number: '#F78C6C',
  comment: '#546E7A',
  func: '#82AAFF',
  type: '#FFCB6B',
  operator: '#89DDFF',
  tag: '#F07178',
};

export default {
  light: {
    text: IDE.text,
    background: IDE.bg,
    tint: IDE.primary,
    tabIconDefault: IDE.muted,
    tabIconSelected: IDE.primary,
  },
};`),
    ]),

    dir('types', [
      file('index.ts', `// Zentrale Typdefinitionen für Studio Mobile IDE
// Enthält: FileNode, Project, ChatMessage, ToolCall, AgentPlan, AgentTask,
// AppSettings, AI_PROVIDERS, PERSONAS, TOOL_REGISTRY, PROJECT_TYPES
// Siehe README.md für vollständige Dokumentation der Interfaces.

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileNode[];
}

export interface Project {
  id: string;
  name: string;
  projectType: string;
  files: FileNode[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  timestamp: number;
  thinking?: string;
  todos?: InlineTodo[];
}

export interface InlineTodo {
  id: string;
  text: string;
  completed: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export type ToolPermission = 'always' | 'ask' | 'blocked' | 'removed';

export interface AppSettings {
  openaiKey: string;
  anthropicKey: string;
  geminiKey: string;
  groqKey: string;
  openrouterKey: string;
  customEndpoint: string;
  customKey: string;
  selectedProvider: string;
  selectedModel: string;
  fontSize: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
  yoloMode: boolean;
  persona: string;
  autoRetry: boolean;
  autoFallback: boolean;
  betaHtmlPreview: boolean;
  betaWebSearch: boolean;
  betaWebFetch: boolean;
  betaAgentLearning: boolean;
  betaSuperAgent: boolean;
  toolPermissions: Record<string, ToolPermission>;
}

export type AgentTaskStatus = 'draft' | 'pending' | 'running' | 'completed' | 'error' | 'cancelled';
export type AgentTaskType = 'task' | 'thinking' | 'brainstorm' | 'question' | 'web_search';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: AgentTaskStatus;
  taskType: AgentTaskType;
  subAgentMessages: ChatMessage[];
  result?: string;
  thinkingContent?: string;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface AgentPlan {
  id: string;
  userRequest: string;
  tasks: AgentTask[];
  status: 'planning' | 'review' | 'executing' | 'completed' | 'error';
  summary?: string;
  finalResponse?: string;
  totalToolsUsed?: { name: string; count: number; status: string }[];
  createdAt: number;
  completedAt?: number;
  dismissed?: boolean;
}

// Weitere Konstanten: AI_PROVIDERS, PERSONAS, TOOL_REGISTRY, PROJECT_TYPES
// Siehe types/index.ts im Hauptprojekt für vollständige Implementierung.`),
    ]),

    dir('app', [
      file('_layout.tsx', `import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '@/providers/AppProvider';
import { ProjectProvider } from '@/providers/ProjectProvider';
import { ChatProvider } from '@/providers/ChatProvider';
import { AgentProvider } from '@/providers/AgentProvider';
import { IDE } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Zurück' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="editor" options={{
        presentation: 'card',
        headerStyle: { backgroundColor: IDE.surface },
        headerTintColor: IDE.text,
        headerShadowVisible: false,
      }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <ProjectProvider>
            <ChatProvider>
              <AgentProvider>
                <StatusBar style="light" />
                <RootLayoutNav />
              </AgentProvider>
            </ChatProvider>
          </ProjectProvider>
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}`),

      file('+not-found.tsx', `import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { IDE } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Diese Seite existiert nicht.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Zurück zur Startseite</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: IDE.bg },
  title: { fontSize: 20, fontWeight: '600', color: IDE.text },
  link: { marginTop: 15, paddingVertical: 15 },
  linkText: { fontSize: 14, color: IDE.primary },
});`),

      file('+native-intent.tsx', `export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  return '/';
}`),

      dir('(tabs)', [
        file('_layout.tsx', `import { Tabs } from 'expo-router';
import { FolderOpen, Sparkles, Wrench, Settings } from 'lucide-react-native';
import { IDE } from '@/constants/colors';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: IDE.primary,
      tabBarInactiveTintColor: IDE.muted,
      tabBarStyle: { backgroundColor: IDE.surface, borderTopColor: IDE.border, borderTopWidth: 1 },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    }}>
      <Tabs.Screen name="(home)" options={{ title: 'Projects', tabBarIcon: ({ color, size }) => <FolderOpen size={size - 2} color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: 'AI Chat', tabBarIcon: ({ color, size }) => <Sparkles size={size - 2} color={color} /> }} />
      <Tabs.Screen name="tools" options={{ title: 'Tools', tabBarIcon: ({ color, size }) => <Wrench size={size - 2} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} /> }} />
    </Tabs>
  );
}`),

        dir('(home)', [
          file('_layout.tsx', `import { Stack } from 'expo-router';
import { IDE } from '@/constants/colors';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: IDE.surface },
      headerTintColor: IDE.text,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: IDE.bg },
    }}>
      <Stack.Screen name="index" options={{ title: 'Projects' }} />
    </Stack>
  );
}`),
          file('index.tsx', `// Projekte-Screen: Hauptseite der App
// Features: Projekt-Tabs, Dateibaum, Erstellen/Löschen, Search, Export
// Siehe README.md für Details.
// Full Source Code: ~760 Zeilen`),
        ]),

        dir('chat', [
          file('_layout.tsx', `import { Stack } from 'expo-router';
import { IDE } from '@/constants/colors';

export default function ChatLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: IDE.surface },
      headerTintColor: IDE.text,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: IDE.bg },
    }}>
      <Stack.Screen name="index" options={{ title: 'AI Chat' }} />
    </Stack>
  );
}`),
          file('index.tsx', `// KI-Chat Screen: Chat with AI assistant
// Features: Nachrichten, Agent-Modus, Datei-Anhänge, Tool-Calls, Streaming
// Breathing-Animation, Vorschläge, Plan-Erstellung
// Full Source Code: ~900 Zeilen`),
        ]),

        dir('tools', [
          file('_layout.tsx', `import { Stack } from 'expo-router';
import { IDE } from '@/constants/colors';

export default function ToolsLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: IDE.surface },
      headerTintColor: IDE.text,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: IDE.bg },
    }}>
      <Stack.Screen name="index" options={{ title: 'Tools' }} />
    </Stack>
  );
}`),
          file('index.tsx', `// Werkzeuge-Screen: Tool-Registry, Pläne, Memos, Search, Chat-Verwaltung
// Features: Tool-Berechtigungen, YOLO-Modus, Agent-Plan Übersicht
// Full Source Code: ~1167 Zeilen`),
        ]),

        dir('settings', [
          file('_layout.tsx', `import { Stack } from 'expo-router';
import { IDE } from '@/constants/colors';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: IDE.surface },
      headerTintColor: IDE.text,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: IDE.bg },
    }}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
    </Stack>
  );
}`),
          file('index.tsx', `// Einstellungen-Screen: API-Keys, Modelle, Persona, Beta-Features
// Features: 7 KI-Anbieter, Editor-Einstellungen, Verhalten
// Full Source Code: ~1098 Zeilen`),
        ]),
      ]),

      file('editor.tsx', `// Code-Editor Screen
// Features: Syntax-Highlighting, Bearbeitungsmodus, Symbol-Leiste, Speichern
// Breadcrumb, Zeilennummern, Status-Leiste
// Full Source Code: ~247 Zeilen`),
    ]),

    dir('components', [
      file('AgentPlanView.tsx', `// Agent-Plan Visualisierung (To-Do Grafik)
// Features: Fortschritt, Drag&Drop, Task-Status, Tool-Usage, Brainstorm-Stream
// Full Source Code: ~1044 Zeilen`),
      file('AgentTaskCard.tsx', `// Agent Task Karte
// Features: Status-Anzeige, Dateien-Liste, Fehler-Handling, Ergebnisse
// Full Source Code: ~673 Zeilen`),
      file('ChatBubble.tsx', `// Chat-Nachricht Komponente
// Features: Markdown, Code-Blöcke, Tool-Calls, Thinking, Web-Ergebnisse
// Full Source Code: ~459 Zeilen`),
      file('FileTreeItem.tsx', `// Dateibaum-Eintrag
// Features: Ordner/Datei Anzeige, Expand/Collapse, Active-State, Long-Press
// Full Source Code: ~142 Zeilen`),
      file('ThinkingBlock.tsx', `// KI-Denkprozess Anzeige
// Features: Live-Stream, Puls-Animation, Markdown-Stripping, Auto-Scroll
// Full Source Code: ~198 Zeilen`),
      file('ToolCallView.tsx', `// Tool-Aufruf Anzeige
// Features: Status-Dot, Parameter, Ergebnis, Einklappbar
// Full Source Code: ~168 Zeilen`),
    ]),

    dir('providers', [
      file('AppProvider.tsx', `// App settings Provider
// Features: Settings, Todos, Memos, Tool-Berechtigungen, API-Keys
// Verwendet: @nkzw/create-context-hook, AsyncStorage
// Full Source Code: ~163 Zeilen`),
      file('ProjectProvider.tsx', `// Project management Provider
// Features: Projekte, File system, Search, Export
// Verwendet: @nkzw/create-context-hook, AsyncStorage
// Full Source Code: ~338 Zeilen`),
      file('ChatProvider.tsx', `// Chat history Provider
// Features: Nachrichten, KI-API, Tool-Calls, Komprimierung
// Verwendet: @nkzw/create-context-hook, AsyncStorage
// Full Source Code: ~941 Zeilen`),
      file('AgentProvider.tsx', `// Agent-Modus Provider
// Features: Plan-Erstellung, Task-Ausführung, Tool-Genehmigung
// Verwendet: @nkzw/create-context-hook
// Full Source Code: ~1097 Zeilen`),
    ]),

    dir('utils', [
      file('ai-service.ts', `// KI-API Integration
// Features: Multi-Provider, Streaming, Tool-Calls, Rate-Limiting, Fallback
// Unterstützt: OpenAI, Anthropic, Gemini, Groq, OpenRouter, Custom
// Full Source Code: ~1018 Zeilen`),
      file('download.ts', `// Projekt-Export/Download System
// Features: Flatten, Text-Bundle, JSON-Export, Web-Download, Native-Share
// Full Source Code: ~150 Zeilen`),
      file('file-icons.ts', `// File Icons und Language Recognition
// Features: Colors, Labels, Sprach-Mapping, Binary-Detection
// Full Source Code: ~62 Zeilen`),
      file('sample-project.ts', `// Sample Projects
// Features: Android (Kotlin), Web (TypeScript), Python, Studio IDE
// Full Source Code: ~100 Zeilen`),
      file('self-source.ts', `// App Source Code as Project (diese Datei)
// Generiert die Project Structure der Studio IDE App
// Inkl. README-Dokumentation
// Full Source Code: dynamisch generiert`),
      file('syntax.ts', `// Syntax Highlighting Engine
// Features: Multi-Language, XML/HTML, JSON, Markdown-Parsing
// Sprachen: Kotlin, Java, TypeScript, JavaScript, Python, Go, Rust, Swift, Dart, CSS, SQL, Shell
// Full Source Code: ~142 Zeilen`),
    ]),
  ];
}
