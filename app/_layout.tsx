import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AppProvider, useApp } from '@/providers/AppProvider';
import { ProjectProvider, useProject } from '@/providers/ProjectProvider';
import { ChatProvider, useChat } from '@/providers/ChatProvider';
import { AgentProvider } from '@/providers/AgentProvider';
import { IDE } from '@/constants/colors';
import { SponsorOverlay } from '@/components/SponsorBanner';
import { FreeAIPoolModal } from '@/components/FreeAIPoolModal';
import { SubAgentStudioModal } from '@/components/SubAgentStudioModal';
import TutorialModal from '@/components/TutorialModal';
import MasterConceptModal from '@/components/MasterConceptModal';
import { discoverYamlSkills, repairCorruptedSkillContent } from '@/utils/skill-loader';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function GlobalModalsHost() {
  const router = useRouter();
  const {
    settings,
    updateSettings,
    freePoolState,
    showFreePoolModal,
    setShowFreePoolModal,
    togglePoolEnabled,
    shareKeyToPool,
    removePoolKey,
    togglePoolKeyActive,
    updatePoolKeyThresholds,
    switchUserIdentity,
    signInWithRealGoogleFirebase,
    signOutRealGoogleFirebase,
    claimOwnerRole,
    setUserRole,
    timeoutUser,
    toggleSuspendUser,
    updateUserTokenQuota,
    clearPoolNotifications,
    customSubAgents,
    saveSubAgentTemplate,
    deleteSubAgentTemplate,
    skillEnabledOverrides,
    skillTriggerOverrides,
    toggleYamlSkill,
    updateSkillTriggerConfig,
    uploadedSkillFiles,
    addUploadedSkills,
    updateUploadedSkillContent,
    removeUploadedSkill,
    showSubAgentStudioModal,
    setShowSubAgentStudioModal,
    showTutorialModal,
    setShowTutorialModal,
    showMasterConceptModal,
    setShowMasterConceptModal,
  } = useApp();
  const { currentProject, createFile } = useProject();
  const { sendMessage } = useChat();

  const discoveredSkills = React.useMemo(
    () =>
      discoverYamlSkills(
        currentProject?.files || [],
        skillEnabledOverrides,
        uploadedSkillFiles,
        skillTriggerOverrides,
      ),
    [currentProject?.files, uploadedSkillFiles, skillEnabledOverrides, skillTriggerOverrides],
  );

  return (
    <>
      <FreeAIPoolModal
        visible={showFreePoolModal}
        onClose={() => setShowFreePoolModal(false)}
        poolState={freePoolState}
        settings={settings}
        onUpdateSettings={updateSettings}
        onTogglePoolEnabled={togglePoolEnabled}
        onShareKeyToPool={shareKeyToPool}
        onRemovePoolKey={removePoolKey}
        onTogglePoolKeyActive={togglePoolKeyActive}
        onUpdatePoolKeyThresholds={updatePoolKeyThresholds}
        onSwitchUserIdentity={switchUserIdentity}
        onSignInWithFirebaseGoogle={signInWithRealGoogleFirebase}
        onSignOutFirebaseGoogle={signOutRealGoogleFirebase}
        onClaimOwnerRole={claimOwnerRole}
        onSetUserRole={setUserRole}
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
        skillTriggerOverrides={skillTriggerOverrides}
        onUpdateSkillTrigger={updateSkillTriggerConfig}
        onUploadSkillFiles={addUploadedSkills}
        onRepairSkill={skill => {
          const uploadedEntry = uploadedSkillFiles.find(f => f.path === skill.sourcePath);
          const rawContent = uploadedEntry ? uploadedEntry.content : skill.body || '';
          const repaired = repairCorruptedSkillContent(skill.sourcePath, rawContent);
          if (uploadedEntry) {
            updateUploadedSkillContent(skill.sourcePath, repaired.content);
          } else if (currentProject) {
            createFile(skill.sourcePath, repaired.content);
          }
        }}
        onDeleteUploadedSkill={removeUploadedSkill}
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
      <TutorialModal
        visible={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        onNavigateTab={dest => {
          if (dest === 'projects') router.push('/(tabs)/(home)' as any);
          else if (dest === 'chat') router.push('/(tabs)/chat' as any);
          else if (dest === 'tools') router.push('/(tabs)/tools?tab=dashboard' as any);
          else if (dest === 'settings') router.push('/(tabs)/settings' as any);
        }}
      />
      <MasterConceptModal
        visible={showMasterConceptModal}
        onClose={() => setShowMasterConceptModal(false)}
        onOpenSkillStudio={() => setShowSubAgentStudioModal(true)}
        onOpenFreePool={() => setShowFreePoolModal(true)}
        onOpenTutorial={() => setShowTutorialModal(true)}
        onNavigateTab={dest => {
          if (dest === 'projects') router.push('/(tabs)/(home)' as any);
          else if (dest === 'chat') router.push('/(tabs)/chat' as any);
          else if (dest === 'tools') router.push('/(tabs)/tools?tab=dashboard' as any);
          else if (dest === 'graph') router.push('/(tabs)/tools?tab=graph' as any);
          else if (dest === 'settings') router.push('/(tabs)/settings' as any);
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
