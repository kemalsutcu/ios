import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FavoritesProvider } from '../providers/Favorites';
import { colors } from '../theme';

export default function RootLayout() {
  return <SafeAreaProvider><FavoritesProvider><StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="agent/[id]" options={{ gestureEnabled: false }} />
    </Stack>
  </FavoritesProvider></SafeAreaProvider>;
}
