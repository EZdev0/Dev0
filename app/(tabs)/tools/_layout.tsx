import { Stack } from 'expo-router';
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
}
