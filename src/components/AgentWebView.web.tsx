import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function AgentWebView({ url, title }: { url: string; title: string; onClose?: () => void }) {
  const [error, setError] = useState(false);
  return <View style={styles.container}><Text style={styles.title}>{title} hazır</Text><Text style={styles.text}>Bu, uygulamanın web önizlemesidir. Ajanı tarayıcıda açabilirsiniz. iPhone uygulamasında görüşme ve dosya paylaşımı bu ekranın içinde çalışır.</Text><Pressable style={styles.button} onPress={() => { void Linking.openURL(url).catch(() => setError(true)); }}><Text style={styles.buttonText}>Ajanı tarayıcıda aç</Text></Pressable>{error && <Text style={styles.text}>Sayfa açılamadı. İnternet bağlantınızı kontrol edin.</Text>}</View>;
}
export default AgentWebView;
const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }, title: { fontSize: 26, color: colors.ink, fontWeight: '600' }, text: { color: colors.muted, textAlign: 'center', maxWidth: 420, fontSize: 16, lineHeight: 25 }, button: { padding: 18, backgroundColor: colors.ink, borderRadius: 16 }, buttonText: { color: colors.accent, fontWeight: '600' } });
