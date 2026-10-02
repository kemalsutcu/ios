import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentCard } from '../../components/AgentCard';
import { agents, categories, filterAgents } from '../../data/agents';
import { colors } from '../../theme';

export default function Home() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tümü');
  const list = filterAgents(query, category);
  return <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.brand}><View style={styles.mark}><Text style={styles.monogram}>ym.</Text></View><View><Text style={styles.brandName}>yapay mevzular</Text><Text style={styles.brandNote}>KEMAL SÜTÇÜ TARAFINDAN</Text></View><View style={styles.appPill}><Text style={styles.appPillText}>iOS</Text></View></View>
    <Text style={styles.eyebrow}>KİŞİSEL AJANLARINIZ</Text>
    <Text style={styles.title}>Aklındaki konu,{"\n"}<Text style={styles.titleAccent}>doğru asistan.</Text></Text>
    <Text style={styles.lead}>Bir ajan seçin. Sorunuzu yazın veya sesli görüşmeye başlayın.</Text>
    <View style={styles.search}><Ionicons name="search-outline" size={21} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Ajan veya konu ara" placeholderTextColor={colors.muted} accessibilityLabel="Ajan veya konu ara" autoCorrect={false} style={styles.input} clearButtonMode="while-editing" /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ gap: 8 }}>
      {categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} accessibilityRole="button" accessibilityState={{ selected: item === category }} style={[styles.chip, item === category && styles.activeChip]}><Text style={[styles.chipText, item === category && { color: '#FFF' }]}>{item}</Text></Pressable>)}
    </ScrollView>
    <View style={styles.section}><Text style={styles.sectionTitle}>Ajanları keşfet</Text><Text style={styles.count}>{list.length} ajan</Text></View>
    {list.map((agent) => <AgentCard key={agent.id} agent={agent} featured={agent.id === 'belma' && category === 'Tümü' && !query} />)}
    {!list.length && <View style={styles.empty}><Ionicons name="search-outline" size={32} color={colors.muted} /><Text style={styles.emptyTitle}>Bir eşleşme bulamadık</Text><Text style={styles.lead}>Farklı bir konu veya ajan adı deneyin.</Text><Pressable onPress={() => { setQuery(''); setCategory('Tümü'); }} style={styles.chip}><Text style={styles.chipText}>Tüm {agents.length} ajanı göster</Text></Pressable></View>}
    <View style={styles.footer}><Ionicons name="sparkles-outline" size={17} color={colors.muted} /><Text style={styles.footerText}>Yanıtlar yapay zekâ ile üretilir.{"\n"}Önemli kararlar için kaynakları kontrol edin.</Text></View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 22, paddingBottom: 28, maxWidth: 650, width: '100%', alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 36 }, mark: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.ink, justifyContent: 'center', alignItems: 'center' }, monogram: { color: colors.accent, fontSize: 23, fontWeight: '800', letterSpacing: -2 },
  brandName: { fontSize: 18, color: colors.ink, fontWeight: '700', letterSpacing: -0.6 }, brandNote: { fontSize: 8, letterSpacing: 1.2, marginTop: 3, color: colors.muted }, appPill: { marginLeft: 'auto', borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }, appPillText: { fontSize: 12, color: colors.muted },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2.1, color: colors.muted, marginBottom: 14 }, title: { color: colors.ink, fontSize: 36, fontWeight: '700', lineHeight: 43, letterSpacing: -1.5 }, titleAccent: { color: '#648165' }, lead: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 14 },
  search: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: '#FFF', paddingHorizontal: 15, marginTop: 26 }, input: { flex: 1, paddingVertical: 16, fontSize: 15, color: colors.ink },
  filters: { marginTop: 14, marginBottom: 28 }, chip: { paddingVertical: 11, paddingHorizontal: 17, borderRadius: 24, backgroundColor: colors.soft }, activeChip: { backgroundColor: colors.ink }, chipText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, sectionTitle: { fontSize: 20, letterSpacing: -0.5, fontWeight: '600', color: colors.ink }, count: { color: colors.muted, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 15 }, emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '600' }, footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 15 }, footerText: { color: colors.muted, fontSize: 11, lineHeight: 18 },
});
