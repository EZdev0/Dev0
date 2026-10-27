import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof process !== 'undefined' && process.env) {
  // Proxy Rork SDK requests to avoid CORS in browser
  // We use a relative path if window is defined, which Expo Router proxies internally
  // Wait, if it's an API route we can't use relative in EXPO_PUBLIC_TOOLKIT_URL if it's evaluated elsewhere. We'll leave it as cors proxy for simplicity or use absolute localhost URL.
}

import { AppProvider, useApp } from '@/providers/AppProvider';
import { ProjectProvider, useProject } from '@/providers/ProjectProvider';
import { ChatProvider, useChat } from '@/providers/ChatProvider';
import { AgentProvider } from '@/providers/AgentProvider';
import { IDE } from '@/constants/colors';
import { SponsorOverlay } from '@/components/SponsorBanner';
import { FreeAIPoolModal } from '@/components/FreeAIPoolModal';
import { SubAgentStudioModal } from '@/components/SubAgentStudioModal';
import { discoverYamlSkills } from '@/utils/skill-loader';
import { useRouter } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function GlobalModalsHost() {
  const router = useRouter();
  const {
    freePoolState,
    showFreePoolModal,
    setShowFreePoolModal,
    togglePoolEnabled,
    shareKeyToPool,
    removePoolKey,
    togglePoolKeyActive,
    switchUserIdentity,
    timeoutUser,
    toggleSuspendUser,
    updateUserTokenQuota,
    clearPoolNotifications,
    customSubAgents,
    saveSubAgentTemplate,
    deleteSubAgentTemplate,
    skillEnabledOverrides,
    toggleYamlSkill,
    showSubAgentStudioModal,
    setShowSubAgentStudioModal,
  } = useApp();
  const { currentProject } = useProject();
  const { sendMessage } = useChat();

  const discoveredSkills = React.useMemo(
    () => discoverYamlSkills(currentProject?.files || [], skillEnabledOverrides),
    [currentProject?.files, skillEnabledOverrides],
  );

  return (
    <>
      <FreeAIPoolModal
        visible={showFreePoolModal}
        onClose={() => setShowFreePoolModal(false)}
        poolState={freePoolState}
        onTogglePoolEnabled={togglePoolEnabled}
        onShareKeyToPool={shareKeyToPool}
        onRemovePoolKey={removePoolKey}
        onTogglePoolKeyActive={togglePoolKeyActive}
        onSwitchUserIdentity={switchUserIdentity}
        onTimeoutUser={timeoutUser}
        onToggleSuspendUser={toggleSuspendUser}
        onUpdateUserTokenQuota={updateUserTokenQuota}
        onClearNotifications={clearPoolNotifications}
      />
      <SubAgentStudioModal
        visible={showSubAgentStudioModal}
        onClose={() => setShowSubAgentStudioModal(false)}
        templates={customSubAgents}
        skills={discoveredSkills}
        onSaveTemplate={saveSubAgentTemplate}
        onDeleteTemplate={deleteSubAgentTemplate}
        onToggleSkill={toggleYamlSkill}
        onRunTemplateTask={(template, taskInstruction) => {
          setShowSubAgentStudioModal(false);
          router.push('/(tabs)/chat' as any);
          setTimeout(() => {
            sendMessage(
              `[Run Sub-Agent "${template.name}" (role: ${template.role})]\nTask: ${taskInstruction}\nUse the sub_agent tool with role="${template.role}" and task="${taskInstruction}".`,
            );
          }, 150);
        }}
      />
    </>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="editor"
        options={{
          presentation: 'card',
          headerStyle: { backgroundColor: IDE.surface },
          headerTintColor: IDE.text,
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <ProjectProvider>
            <ChatProvider>
              <AgentProvider>
                <StatusBar style="light" />
                <RootLayoutNav />
                <GlobalModalsHost />
                <SponsorOverlay />
              </AgentProvider>
            </ChatProvider>
          </ProjectProvider>
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
