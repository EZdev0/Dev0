import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Smartphone, Tablet, Monitor, Terminal, RotateCw } from 'lucide-react-native';
import { IDE } from '@/constants/colors';

interface Props {
  htmlContent: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

/**
 * 2026 Cross-Platform HTML & WebAssembly Preview Component
 * - On Web: Uses a sandboxed <iframe> (srcDoc) with postMessage bridge,
 *   built-in WebAssembly runner (`window.runWasmBytes`), and live console log viewer.
 * - On iOS/Android: Uses native WebView with identical WebAssembly & console bridge.
 */
export const HTMLPreview = React.memo(({ htmlContent, onLoad, onError }: Props) => {
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'full'>('full');
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<{ level: string; text: string; time: string }[]>([]);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const baseTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="${IDE.bg}">
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        margin: 0;
        padding: 16px;
        background-color: ${IDE.bg};
        color: ${IDE.text};
        line-height: 1.6;
        overflow-x: hidden;
      }
      img, canvas, video, svg { max-width: 100%; height: auto; }
      pre {
        background: ${IDE.surface};
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        font-size: 13px;
      }
      code { font-family: 'JetBrains Mono', 'SF Mono', monospace; }
      a { color: ${IDE.primary}; text-decoration: none; }
      a:hover { text-decoration: underline; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th, td { border: 1px solid ${IDE.border}; padding: 8px 12px; text-align: left; }
      th { background: ${IDE.surface}; font-weight: 600; }
    </style>
    <script>
      (function() {
        function emitToHost(payload) {
          var str = typeof payload === 'string' ? payload : JSON.stringify(payload);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(str);
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage({ source: 'AI_MEGA_BRAIN_PREVIEW', payload: payload }, '*');
          }
        }

        // Intercept console logs for inspection
        ['log', 'warn', 'error', 'info'].forEach(function(level) {
          var orig = console[level];
          console[level] = function() {
            var args = Array.prototype.slice.call(arguments).map(function(a) {
              try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
              catch (e) { return String(a); }
            }).join(' ');
            emitToHost({ type: 'CONSOLE', level: level, text: args });
            if (orig) orig.apply(console, arguments);
          };
        });

        // 2026 WebAssembly / Emscripten Helper Bridge
        window.runWasmBytes = async function(bytesOrBase64, importObject) {
          var bytes = bytesOrBase64;
          if (typeof bytesOrBase64 === 'string') {
            var bin = atob(bytesOrBase64);
            bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          }
          var result = await WebAssembly.instantiate(bytes, importObject || {});
          emitToHost({ type: 'CONSOLE', level: 'info', text: '[Wasm] Module instantiated successfully' });
          return result.instance;
        };

        window.addEventListener('load', function() {
          emitToHost({ type: 'HTML_LOADED', wasmSupported: typeof WebAssembly === 'object' });
        });

        window.onerror = function(msg, url, line) {
          emitToHost({ type: 'ERROR', message: String(msg), line: line });
        };
      })();
    </script>
  </head>
  <body>
    ${htmlContent}
  </body>
</html>`;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (event: MessageEvent) => {
      if (!event?.data || event.data.source !== 'AI_MEGA_BRAIN_PREVIEW') return;
      const data = event.data.payload;
      if (!data) return;
      if (data.type === 'HTML_LOADED') {
        onLoad?.();
      } else if (data.type === 'ERROR') {
        setConsoleLogs(prev => [
          ...prev.slice(-49),
          { level: 'error', text: `${data.message} (line ${data.line || 0})`, time: new Date().toLocaleTimeString() },
        ]);
        onError?.(data);
      } else if (data.type === 'CONSOLE') {
        setConsoleLogs(prev => [
          ...prev.slice(-49),
          { level: data.level || 'log', text: data.text || '', time: new Date().toLocaleTimeString() },
        ]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onLoad, onError]);

  const maxWidth =
    viewportMode === 'mobile' ? 375 : viewportMode === 'tablet' ? 768 : '100%';

  return (
    <View style={styles.container}>
      {/* Responsive Viewport & Wasm Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.viewportGroup}>
          <TouchableOpacity
            style={[styles.toolBtn, viewportMode === 'mobile' && styles.toolBtnActive]}
            onPress={() => setViewportMode('mobile')}
          >
            <Smartphone size={14} color={viewportMode === 'mobile' ? IDE.primary : IDE.muted} />
            <Text style={[styles.toolBtnText, viewportMode === 'mobile' && styles.toolBtnTextActive]}>
              Mobile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, viewportMode === 'tablet' && styles.toolBtnActive]}
            onPress={() => setViewportMode('tablet')}
          >
            <Tablet size={14} color={viewportMode === 'tablet' ? IDE.primary : IDE.muted} />
            <Text style={[styles.toolBtnText, viewportMode === 'tablet' && styles.toolBtnTextActive]}>
              Tablet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, viewportMode === 'full' && styles.toolBtnActive]}
            onPress={() => setViewportMode('full')}
          >
            <Monitor size={14} color={viewportMode === 'full' ? IDE.primary : IDE.muted} />
            <Text style={[styles.toolBtnText, viewportMode === 'full' && styles.toolBtnTextActive]}>
              Full
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.viewportGroup}>
          <TouchableOpacity
            style={[styles.toolBtn, showConsole && styles.toolBtnActive]}
            onPress={() => setShowConsole(v => !v)}
          >
            <Terminal size={14} color={showConsole ? IDE.accent : IDE.muted} />
            <Text style={[styles.toolBtnText, showConsole && { color: IDE.accent }]}>
              Console ({consoleLogs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => {
              setConsoleLogs([]);
              setReloadKey(k => k + 1);
            }}
          >
            <RotateCw size={14} color={IDE.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Sandbox Frame */}
      <View style={styles.stageWrapper}>
        <View style={[styles.stageFrame, { width: maxWidth }]}>
          {Platform.OS === 'web' ? (
            React.createElement('iframe', {
              key: reloadKey,
              srcDoc: baseTemplate,
              sandbox: 'allow-scripts allow-modals allow-forms',
              style: {
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: IDE.bg,
              },
              title: 'HTML & WebAssembly Sandbox Preview',
            })
          ) : (
            <WebView
              key={reloadKey}
              originWhitelist={['*']}
              source={{ html: baseTemplate }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={Platform.OS === 'android'}
              onMessage={(event: any) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'HTML_LOADED' || data === 'HTML_LOADED') {
                    onLoad?.();
                  } else if (data.type === 'ERROR') {
                    setConsoleLogs(prev => [
                      ...prev.slice(-49),
                      { level: 'error', text: `${data.message}`, time: new Date().toLocaleTimeString() },
                    ]);
                    onError?.(data);
                  } else if (data.type === 'CONSOLE') {
                    setConsoleLogs(prev => [
                      ...prev.slice(-49),
                      { level: data.level || 'log', text: data.text || '', time: new Date().toLocaleTimeString() },
                    ]);
                  }
                } catch {
                  if (event.nativeEvent.data === 'HTML_LOADED') {
                    onLoad?.();
                  }
                }
              }}
              onError={(syntheticEvent: any) => {
                const { nativeEvent } = syntheticEvent;
                onError?.(nativeEvent);
              }}
            />
          )}
        </View>
      </View>

      {/* Interactive Console Drawer */}
      {showConsole && (
        <View style={styles.consoleDrawer}>
          <View style={styles.consoleHeader}>
            <Text style={styles.consoleTitle}>Sandbox & WebAssembly Console</Text>
            <TouchableOpacity onPress={() => setConsoleLogs([])}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.consoleList}>
            {consoleLogs.length === 0 ? (
              <Text style={styles.consoleEmpty}>No console messages emitted yet.</Text>
            ) : (
              consoleLogs.map((log, i) => (
                <Text
                  key={i}
                  style={[
                    styles.consoleLine,
                    log.level === 'error' && { color: IDE.danger },
                    log.level === 'warn' && { color: IDE.warning },
                  ]}
                >
                  [{log.time}] [{log.level.toUpperCase()}] {log.text}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IDE.bg,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: IDE.surface,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
  },
  viewportGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  toolBtnActive: {
    borderColor: IDE.primary,
    backgroundColor: IDE.primary + '20',
  },
  toolBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: IDE.muted,
  },
  toolBtnTextActive: {
    color: IDE.primary,
  },
  stageWrapper: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#070A10',
  },
  stageFrame: {
    flex: 1,
    backgroundColor: IDE.bg,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: IDE.border,
  },
  webview: {
    flex: 1,
    backgroundColor: IDE.bg,
  },
  consoleDrawer: {
    height: 150,
    backgroundColor: IDE.surface,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 10,
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  consoleTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.textSecondary,
  },
  clearText: {
    fontSize: 11,
    color: IDE.primary,
    fontWeight: '600',
  },
  consoleList: {
    flex: 1,
    backgroundColor: IDE.bg,
    borderRadius: 6,
    padding: 8,
  },
  consoleEmpty: {
    fontSize: 11,
    color: IDE.muted,
    fontFamily: 'monospace',
  },
  consoleLine: {
    fontSize: 11,
    color: IDE.text,
    fontFamily: 'monospace',
    marginBottom: 3,
  },
});

export default HTMLPreview;
