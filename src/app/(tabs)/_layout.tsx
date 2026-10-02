import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { colors } from '../../theme';

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.line }, tabBarLabelStyle: { fontWeight: '600', fontSize: 11 } }}>
    <Tabs.Screen name="index" options={{ title: 'Ajanlar', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="favorites" options={{ title: 'Favoriler', tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="guide" options={{ title: 'Rehber', tabBarIcon: ({ color, size }) => <Ionicons name="information-circle-outline" size={size} color={color} /> }} />
  </Tabs>;
}
