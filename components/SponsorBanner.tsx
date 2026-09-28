import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Heart, X } from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

export default function SponsorBanner({ style }: { style?: any }) {
  const { settings } = useApp();

  if (settings?.hideSponsor) {
    return null;
  }

  return (
    <View style={[{ marginVertical: 12, padding: 12, backgroundColor: IDE.surface, borderRadius: 8, borderWidth: 1, borderColor: IDE.border }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Heart size={16} color={IDE.primary} style={{ marginRight: 8 }} />
        <Text style={{ color: IDE.text, fontWeight: '600', fontSize: 14 }}>Support EZdev!</Text>
      </View>
      <Text style={{ color: IDE.muted, fontSize: 13, marginBottom: 8, lineHeight: 18 }}>
        A little support would be great! Schau doch mal bei unserem Sponsor-Programm vorbei oder kontaktiere uns unter EZdev-info@proton.me für Feedback und Ideen.
        You can hide this message in the settings, but we would be happy if you wrote to us or followed us at least once!
      </Text>
      <View style={{ height: 32, width: 114, overflow: 'hidden', borderRadius: 6 }}>
        <WebView
          source={{ uri: 'https://github.com/sponsors/EZdev0/button' }}
          style={{ height: 32, width: 114, backgroundColor: 'transparent' }}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}

export function SponsorOverlay() {
  const { showSponsorModal, closeSponsorModal } = useApp();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (showSponsorModal) {
      setCountdown(5);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showSponsorModal]);

  return (
    <Modal visible={showSponsorModal} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity
            style={[styles.closeButton, countdown > 0 && { opacity: 0.5 }]}
            onPress={() => {
              if (countdown === 0) closeSponsorModal();
            }}
            activeOpacity={0.7}
            disabled={countdown > 0}
          >
            {countdown > 0 ? (
              <Text style={{ color: IDE.muted, fontSize: 12, fontWeight: '600' }}>In {countdown}s</Text>
            ) : (
              <X size={20} color={IDE.muted} />
            )}
          </TouchableOpacity>
          <View style={styles.header}>
            <Heart size={28} color={IDE.primary} style={{ marginRight: 12 }} />
            <Text style={styles.title}>Support EZdev!</Text>
          </View>
          <Text style={styles.bodyText}>
            We put a lot of time and love into the development of Studio IDE. In order to continue offering the project free of charge and open-source, we rely on your support!
          </Text>
          <Text style={styles.bodyText}>
            Every contribution, no matter how small, helps us to cover server costs and integrate new AI models. Take a look at our sponsor program or write to us for feedback at EZdev-info@proton.me.
          </Text>
          <Text style={styles.bodyTextSmall}>
            You can disable this popup at any time in the settings.
          </Text>
          <View style={styles.buttonContainer}>
            <WebView
              source={{ uri: 'https://github.com/sponsors/EZdev0/button' }}
              style={{ height: 32, width: 114, backgroundColor: 'transparent' }}
              scrollEnabled={false}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: IDE.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: IDE.border,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: IDE.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  bodyText: {
    color: IDE.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  bodyTextSmall: {
    color: IDE.muted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 24,
  },
  buttonContainer: {
    height: 32,
    width: 114,
    overflow: 'hidden',
    borderRadius: 6,
    alignSelf: 'center',
  }
});
