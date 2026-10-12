import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { IDE } from '@/constants/colors';

interface Props {
  htmlContent: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

/**
 * HTML Preview Component
 * Zeigt HTML-Content sicher in einer WebView an
 * 
 * Nutzung:
 * - HTML-Vorschau von erstellten Webseiten
 * - Live-Preview während der Entwicklung
 * - Anzeige von lokal gespeicherten HTML-Dateien
 */
export const HTMLPreview = React.memo(({ htmlContent, onLoad, onError }: Props) => {
  // Base-Template mit responsive Viewport und Dark-Mode Support
  const baseTemplate = `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <meta name="theme-color" content="${IDE.bg.replace('#', '#')}">
        <style>
          * {
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            margin: 0;
            padding: 16px;
            background-color: ${IDE.bg};
            color: ${IDE.text};
            line-height: 1.6;
            overflow-x: hidden;
          }
          
          /* Responsive Images */
          img {
            max-width: 100%;
            height: auto;
          }
          
          /* Code Blocks */
          pre {
            background: ${IDE.surface};
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 13px;
          }
          
          code {
            font-family: 'SF Mono', 'Fira Code', monospace;
          }
          
          /* Links */
          a {
            color: ${IDE.primary};
            text-decoration: none;
          }
          
          a:hover {
            text-decoration: underline;
          }
          
          /* Headings */
          h1, h2, h3, h4, h5, h6 {
            color: ${IDE.text};
            margin-top: 24px;
            margin-bottom: 16px;
          }
          
          /* Tables */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
          }
          
          th, td {
            border: 1px solid ${IDE.border};
            padding: 8px 12px;
            text-align: left;
          }
          
          th {
            background: ${IDE.surface};
            font-weight: 600;
          }
          
          /* Blockquotes */
          blockquote {
            border-left: 3px solid ${IDE.primary};
            margin: 16px 0;
            padding-left: 16px;
            color: ${IDE.muted};
          }
          
          /* Mobile Optimization */
          @media (max-width: 600px) {
            body {
              padding: 12px;
            }
            
            h1 {
              font-size: 24px;
            }
            
            h2 {
              font-size: 20px;
            }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        
        <!-- Script für Native Interactions -->
        <script>
          // Notify parent when loaded
          window.onload = function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('HTML_LOADED');
            }
          };
          
          // Error handling
          window.onerror = function(msg, url, line) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ERROR',
                message: msg,
                line: line
              }));
            }
          };
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
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
            if (data === 'HTML_LOADED' && onLoad) {
              onLoad();
            } else if (data.type === 'ERROR' && onError) {
              onError(data);
            }
          } catch (e) {
            // Simple string message
            if (event.nativeEvent.data === 'HTML_LOADED' && onLoad) {
              onLoad();
            }
          }
        }}
        onError={(syntheticEvent: any) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[HTMLPreview] WebView Error:', nativeEvent);
          if (onError) {
            onError(nativeEvent);
          }
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <View style={styles.spinner} />
            <Text style={styles.loadingText}>Loading Preview...</Text>
          </View>
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IDE.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: IDE.bg,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IDE.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: IDE.primary + '30',
    borderTopColor: IDE.primary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: IDE.muted,
  },
});

export default HTMLPreview;
