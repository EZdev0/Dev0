import { FileNode } from '@/types';
import { createDockerSandboxTemplateFiles } from '@/utils/sandbox-workspace';

let idCounter = 1;
function nid(): string {
  return 'node_' + (idCounter++);
}

export function createSampleProject(projectType: string): FileNode[] {
  idCounter = 1;
  switch (projectType) {
    case 'android': return createAndroidProject();
    case 'web': return createWebProject();
    case 'python': return createPythonProject();
    case 'docker-sandbox':
    case 'studio-ide': return createDockerSandboxTemplateFiles();
    default: return [];
  }
}

function createAndroidProject(): FileNode[] {
  return [
    {
      id: nid(), name: 'app', type: 'directory', children: [
        {
          id: nid(), name: 'src', type: 'directory', children: [
            {
              id: nid(), name: 'main', type: 'directory', children: [
                {
                  id: nid(), name: 'java', type: 'directory', children: [
                    {
                      id: nid(), name: 'com.example.app', type: 'directory', children: [
                        { id: nid(), name: 'MainActivity.kt', type: 'file', content: 'package com.example.app\n\nimport android.os.Bundle\nimport androidx.activity.ComponentActivity\nimport androidx.activity.compose.setContent\nimport androidx.compose.material3.*\nimport androidx.compose.runtime.*\nimport androidx.compose.foundation.layout.*\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.unit.dp\n\nclass MainActivity : ComponentActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        setContent {\n            AppTheme {\n                Surface(\n                    modifier = Modifier.fillMaxSize(),\n                    color = MaterialTheme.colorScheme.background\n                ) {\n                    MainScreen()\n                }\n            }\n        }\n    }\n}\n\n@Composable\nfun MainScreen() {\n    var counter by remember { mutableIntStateOf(0) }\n\n    Column(\n        modifier = Modifier\n            .fillMaxSize()\n            .padding(16.dp),\n        verticalArrangement = Arrangement.Center\n    ) {\n        Text(\n            text = "Willkommen!",\n            style = MaterialTheme.typography.headlineMedium\n        )\n        Spacer(modifier = Modifier.height(16.dp))\n        Text(text = "Zähler: $counter")\n        Spacer(modifier = Modifier.height(8.dp))\n        Button(onClick = { counter++ }) {\n            Text("Erhöhen")\n        }\n    }\n}' },
                        { id: nid(), name: 'AppTheme.kt', type: 'file', content: 'package com.example.app\n\nimport androidx.compose.material3.*\nimport androidx.compose.runtime.Composable\n\n@Composable\nfun AppTheme(\n    content: @Composable () -> Unit\n) {\n    MaterialTheme(\n        colorScheme = dynamicLightColorScheme(),\n        typography = Typography(),\n        content = content\n    )\n}' },
                      ],
                    },
                  ],
                },
                {
                  id: nid(), name: 'res', type: 'directory', children: [
                    {
                      id: nid(), name: 'values', type: 'directory', children: [
                        { id: nid(), name: 'strings.xml', type: 'file', content: '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">MeineApp</string>\n</resources>' },
                        { id: nid(), name: 'themes.xml', type: 'file', content: '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="Theme.App" parent="android:Theme.Material.Light.NoActionBar" />\n</resources>' },
                      ],
                    },
                  ],
                },
                { id: nid(), name: 'AndroidManifest.xml', type: 'file', content: '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    package="com.example.app">\n\n    <application\n        android:label="@string/app_name"\n        android:theme="@style/Theme.App">\n        <activity\n            android:name=".MainActivity"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>' },
              ],
            },
          ],
        },
        { id: nid(), name: 'build.gradle.kts', type: 'file', content: 'plugins {\n    id("com.android.application")\n    id("org.jetbrains.kotlin.android")\n}\n\nandroid {\n    namespace = "com.example.app"\n    compileSdk = 34\n\n    defaultConfig {\n        applicationId = "com.example.app"\n        minSdk = 24\n        targetSdk = 34\n        versionCode = 1\n        versionName = "1.0"\n    }\n\n    buildFeatures {\n        compose = true\n    }\n}' },
      ],
    },
    { id: nid(), name: 'build.gradle.kts', type: 'file', content: 'plugins {\n    id("com.android.application") version "8.2.0" apply false\n    id("org.jetbrains.kotlin.android") version "1.9.20" apply false\n}' },
    { id: nid(), name: 'settings.gradle.kts', type: 'file', content: 'pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\n\nrootProject.name = "MeineApp"\ninclude(":app")' },
    { id: nid(), name: 'README.md', type: 'file', content: '# MeineApp\n\nEin Android-Projekt mit Jetpack Compose.\n\n## Erste Schritte\n\n1. Projekt in Android Studio öffnen\n2. Gradle sync ausführen\n3. App auf Emulator oder Gerät starten' },
    { id: nid(), name: '.gitignore', type: 'file', content: '*.iml\n.gradle\n/local.properties\n/.idea\n/build\n/captures\n.externalNativeBuild\n.cxx' },
  ];
}

function createWebProject(): FileNode[] {
  return [
    {
      id: nid(), name: 'src', type: 'directory', children: [
        { id: nid(), name: 'index.ts', type: 'file', content: 'import { App } from "./App";\n\nconst root = document.getElementById("root");\nif (root) {\n  const app = new App(root);\n  app.mount();\n}' },
        { id: nid(), name: 'App.ts', type: 'file', content: 'export class App {\n  private container: HTMLElement;\n\n  constructor(container: HTMLElement) {\n    this.container = container;\n  }\n\n  mount() {\n    this.container.innerHTML = `\n      <div class="app">\n        <h1>Willkommen</h1>\n        <p>Dein Web-Projekt ist bereit.</p>\n      </div>\n    `;\n  }\n}' },
        { id: nid(), name: 'styles.css', type: 'file', content: ':root {\n  --primary: #3B82F6;\n  --bg: #0F172A;\n  --text: #F1F5F9;\n}\n\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: system-ui, sans-serif;\n  background: var(--bg);\n  color: var(--text);\n}\n\n.app {\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 2rem;\n}' },
      ],
    },
    { id: nid(), name: 'index.html', type: 'file', content: '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Mein Web-Projekt</title>\n  <link rel="stylesheet" href="src/styles.css">\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="src/index.ts"></script>\n</body>\n</html>' },
    { id: nid(), name: 'tsconfig.json', type: 'file', content: '{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "ESNext",\n    "strict": true,\n    "esModuleInterop": true,\n    "outDir": "./dist"\n  },\n  "include": ["src"]\n}' },
    { id: nid(), name: 'package.json', type: 'file', content: '{\n  "name": "mein-web-projekt",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc && vite build"\n  },\n  "devDependencies": {\n    "typescript": "^5.3.0",\n    "vite": "^5.0.0"\n  }\n}' },
    { id: nid(), name: 'README.md', type: 'file', content: '# Mein Web-Projekt\n\nEin TypeScript Web-Projekt.\n\n## Entwicklung\n\n```bash\nnpm install\nnpm run dev\n```' },
  ];
}

function createPythonProject(): FileNode[] {
  return [
    {
      id: nid(), name: 'src', type: 'directory', children: [
        { id: nid(), name: '__init__.py', type: 'file', content: '' },
        { id: nid(), name: 'main.py', type: 'file', content: '"""Hauptmodul der Anwendung."""\n\nfrom src.utils import greet\n\n\ndef main():\n    """Hauptfunktion."""\n    name = input("Wie heißt du? ")\n    print(greet(name))\n\n\nif __name__ == "__main__":\n    main()' },
        { id: nid(), name: 'utils.py', type: 'file', content: '"""Hilfsfunktionen."""\n\n\ndef greet(name: str) -> str:\n    """Erzeugt eine Begrüßungsnachricht."""\n    return f"Hallo {name}! Willkommen zum Projekt."\n\n\ndef add(a: int, b: int) -> int:\n    """Addiert zwei Zahlen."""\n    return a + b' },
      ],
    },
    { id: nid(), name: 'tests', type: 'directory', children: [
      { id: nid(), name: '__init__.py', type: 'file', content: '' },
      { id: nid(), name: 'test_utils.py', type: 'file', content: '"""Tests für utils."""\n\nimport pytest\nfrom src.utils import greet, add\n\n\ndef test_greet():\n    assert greet("Welt") == "Hallo Welt! Willkommen zum Projekt."\n\n\ndef test_add():\n    assert add(2, 3) == 5' },
    ]},
    { id: nid(), name: 'requirements.txt', type: 'file', content: 'pytest>=7.4.0\nblack>=23.0.0\nmypy>=1.0.0' },
    { id: nid(), name: 'pyproject.toml', type: 'file', content: '[project]\nname = "mein-python-projekt"\nversion = "1.0.0"\nrequires-python = ">=3.10"\n\n[tool.black]\nline-length = 100\n\n[tool.mypy]\nstrict = true' },
    { id: nid(), name: 'README.md', type: 'file', content: '# Mein Python-Projekt\n\n## Installation\n\n```bash\npip install -r requirements.txt\n```\n\n## Tests\n\n```bash\npytest\n```' },
  ];
}
