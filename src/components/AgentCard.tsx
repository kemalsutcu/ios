import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Agent } from '../data/agents';
import { useFavorites } from '../providers/Favorites';
import { colors } from '../theme';

export function AgentCard({ agent, featured = false }: { agent: Agent; featured?: boolean }) {
  const { ids, toggle, ready } = useFavorites();
  const selected = ids.includes(agent.id);
  const foreground = featured ? '#F5F8EC' : colors.ink;
  return <View style={[styles.card, featured && styles.featured]}>
    <View style={styles.top}>
      <View style={[styles.icon, { backgroundColor: featured ? '#35564B' : agent.tint }]}>
        <Ionicons name={agent.icon} size={25} color={foreground} />
      </View>
      <Text style={[styles.category, { color: featured ? colors.accent : colors.muted }]}>{featured ? 'ÖNE ÇIKAN AJAN' : agent.category.toLocaleUpperCase('tr-TR')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${agent.name} ${selected ? 'favorilerden çıkar' : 'favorilere ekle'}`} accessibilityState={{ selected, disabled: !ready }} disabled={!ready} onPress={() => toggle(agent.id)} style={styles.favorite}>
        <Ionicons name={selected ? 'heart' : 'heart-outline'} color={featured ? colors.accent : colors.ink} size={23} />
      </Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${agent.name}, ${agent.role}. Ajanı aç`} onPress={() => router.push({ pathname: '/agent/[id]', params: { id: agent.id } })}>
      <Text style={[styles.name, { color: foreground }]}>{agent.name}</Text>
      <Text style={[styles.role, { color: foreground }]}>{agent.role}</Text>
      <Text style={[styles.description, { color: featured ? '#CFDAD1' : colors.muted }]}>{agent.description}</Text>
      <View style={[styles.bottom, featured && { borderColor: '#456157' }]}>
        <Text style={[styles.mode, { color: featured ? '#CFDAD1' : colors.muted }]}>{agent.mode}</Text>
        <View style={[styles.open, featured && { backgroundColor: colors.accent }]}><Text style={styles.openText}>Ajanı aç</Text><Ionicons name="arrow-forward" size={17} color={colors.ink} /></View>
      </View>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: colors.line, marginBottom: 14 },
  featured: { backgroundColor: colors.ink, borderColor: colors.ink },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  icon: { height: 48, width: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  category: { fontSize: 11, letterSpacing: 1.8, fontWeight: '700', flex: 1 },
  favorite: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 29, fontWeight: '700', letterSpacing: -0.8 },
  role: { fontSize: 16, fontWeight: '500', marginTop: 4 },
  description: { fontSize: 14, lineHeight: 22, marginTop: 12 },
  bottom: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 22, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mode: { fontSize: 12, flexShrink: 1 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 30, backgroundColor: colors.soft },
  openText: { fontSize: 13, fontWeight: '700', color: colors.ink },
});
