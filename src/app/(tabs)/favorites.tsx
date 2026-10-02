import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentCard } from '../../components/AgentCard';
import { agents } from '../../data/agents';
import { useFavorites } from '../../providers/Favorites';
import { colors } from '../../theme';

export default function Favorites() {
  const { ids, ready, error, clear } = useFavorites();
  const selected = agents.filter((agent) => ids.includes(agent.id));
  return <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Favoriler</Text><Text style={styles.lead}>Sık kullandığınız ajanlar elinizin altında.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.notice}>{error}</Text>}
    {!ready ? <Text style={styles.lead}>Favoriler yükleniyor…</Text> : selected.length ? <>
      {selected.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
      <Pressable style={styles.button} onPress={() => Alert.alert('Favoriler temizlensin mi?', 'Yalnızca bu cihazdaki ajan seçimleri kaldırılır.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Temizle', style: 'destructive', onPress: clear }])}><Text style={styles.buttonText}>Favorileri temizle</Text></Pressable>
    </> : <View style={styles.empty}><View style={styles.circle}><Ionicons name="heart-outline" size={38} color={colors.ink} /></View><Text style={styles.emptyTitle}>Sizin seçtikleriniz</Text><Text style={styles.emptyText}>Bir ajanın kalbine dokunduğunuzda burada görünür.</Text><Pressable style={styles.button} onPress={() => router.navigate('/')}><Text style={styles.buttonText}>Ajanları keşfet</Text></Pressable></View>}
    <Text style={styles.footnote}>Bu alanda yalnızca seçtiğiniz ajanların kimlikleri cihazınızda tutulur. Görüşme içeriği favorilere kaydedilmez.</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: 24, maxWidth: 650, width: '100%', alignSelf: 'center' }, title: { fontSize: 34, color: colors.ink, fontWeight: '700', letterSpacing: -1 }, lead: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 30 }, notice: { color: '#8C432E', marginBottom: 18 }, empty: { alignItems: 'center', paddingVertical: 45 }, circle: { width: 90, height: 90, backgroundColor: colors.soft, borderRadius: 45, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { marginTop: 25, color: colors.ink, fontSize: 23, fontWeight: '600' }, emptyText: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 12, maxWidth: 260 }, button: { backgroundColor: colors.soft, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 24 }, buttonText: { color: colors.ink, fontWeight: '600' }, footnote: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 24 } });
