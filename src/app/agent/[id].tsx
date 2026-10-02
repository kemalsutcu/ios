import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentWebView } from '../../components/AgentWebView';
import { agents } from '../../data/agents';
import { colors } from '../../theme';

export default function AgentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AgentSession key={id} id={id} />;
}

function AgentSession({ id }: { id: string }) {
  const agent = agents.find((item) => item.id === id);
  const [consent, setConsent] = useState(false);
  const [started, setStarted] = useState(false);
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');
  const close = () => {
    if (Platform.OS === 'web') { setStarted(false); goBack(); return; }
    if (!started) { goBack(); return; }
    Alert.alert('Ajan kapatılsın mı?', 'Açık görüşme sonlanır. İhtiyacınız olan belgeleri önce kaydedin.', [
      { text: 'Görüşmede kal', style: 'cancel' },
      { text: 'Kapat', style: 'destructive', onPress: () => { setStarted(false); goBack(); } },
    ]);
  };
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!started) return false;
      Alert.alert('Ajan kapatılsın mı?', 'Açık görüşme sonlanır.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Kapat', style: 'destructive', onPress: () => { setStarted(false); if (router.canGoBack()) router.back(); else router.replace('/'); } }]);
      return true;
    });
    return () => listener.remove();
  }, [started]);
  // Deep links select a known agent ID only, never an arbitrary URL or consent state.
  if (!agent) return <SafeAreaView style={styles.page}><View style={styles.content}><Text style={styles.title}>Ajan bulunamadı</Text><Pressable style={styles.button} onPress={goBack}><Text style={styles.buttonText}>Ajanlara dön</Text></Pressable></View></SafeAreaView>;
  return <SafeAreaView style={styles.page} edges={['top', 'left', 'right', 'bottom']}>
    <View style={styles.bar}><Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Ajanı kapat" style={styles.back}><Ionicons name="chevron-back" size={25} color={colors.ink} /></Pressable><View style={{ flex: 1 }}><Text style={styles.barTitle}>{agent.name}</Text><Text style={styles.barSubtitle}>{started ? 'yapaymevzular.com' : agent.role}</Text></View><View style={styles.status}><View style={styles.dot} /><Text style={styles.statusText}>{started ? 'Ajan açık' : 'Hazır'}</Text></View></View>
    {started ? <AgentWebView key={agent.id} url={agent.url} title={agent.name} /> : <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.avatar, { backgroundColor: agent.tint }]}><Ionicons name={agent.icon} size={43} color={colors.ink} /></View>
      <Text style={styles.category}>{agent.category.toLocaleUpperCase('tr-TR')}</Text><Text style={styles.title}>{agent.name} ile tanışın.</Text><Text style={styles.lead}>{agent.description}</Text>
      <View style={styles.capabilities}>{agent.features.map((feature) => <View key={feature} style={styles.feature}><Ionicons name="checkmark-circle-outline" color={colors.ink} size={20} /><Text style={styles.featureText}>{feature}</Text></View>)}</View>
      <View style={styles.notice}><Ionicons name="information-circle-outline" color={colors.ink} size={22} /><Text style={styles.noticeText}>Yanıtlar yapay zekâ ile üretilir. Sesiniz, mesajlarınız ve seçtiğiniz belgeler yanıt üretmek için ajanın hizmet sağlayıcıları tarafından işlenir. Ajan sayfasındaki güncel açıklamaları da inceleyin.</Text></View>
      <Pressable onPress={() => setConsent((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} accessibilityLabel="Sesimin, mesajlarımın ve seçtiğim dosyaların yapay zekâ hizmet sağlayıcıları tarafından işlenmesini kabul ediyorum" style={styles.consent}><View style={[styles.checkbox, consent && styles.checked]}>{consent && <Ionicons name="checkmark" color="white" size={18} />}</View><Text style={styles.consentText}>Sesimin, mesajlarımın ve seçtiğim dosyaların yanıt üretmek amacıyla yapay zekâ hizmet sağlayıcıları tarafından işlenmesini kabul ediyorum.</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !consent }} disabled={!consent} style={[styles.button, !consent && { opacity: 0.4 }]} onPress={() => setStarted(true)}><Text style={styles.buttonText}>Ajanı aç</Text><Ionicons name="arrow-forward" color={colors.accent} size={20} /></Pressable>
      <Text style={styles.footnote}>Sesli görüşme ajan ekranındaki düğmeye dokunduğunuzda başlar. Mikrofon izni ayrıca sorulur.</Text>
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line }, back: { height: 44, width: 44, justifyContent: 'center', alignItems: 'center' }, barTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 }, barSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 }, status: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 9, backgroundColor: colors.soft, borderRadius: 20 }, dot: { height: 5, width: 5, borderRadius: 5, backgroundColor: '#79935A' }, statusText: { color: colors.ink, fontSize: 10 }, content: { padding: 26, paddingBottom: 35, maxWidth: 650, width: '100%', alignSelf: 'center' }, avatar: { height: 92, width: 92, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 30 }, category: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: colors.muted, marginBottom: 12 }, title: { fontSize: 31, lineHeight: 39, letterSpacing: -1, color: colors.ink, fontWeight: '700' }, lead: { fontSize: 16, lineHeight: 25, color: colors.muted, marginTop: 14 }, capabilities: { gap: 14, marginVertical: 28 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 10 }, featureText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 }, notice: { backgroundColor: colors.soft, padding: 18, borderRadius: 18, gap: 12 }, noticeText: { color: colors.muted, fontSize: 13, lineHeight: 21 }, consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 26 }, checkbox: { height: 26, width: 26, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.ink, borderColor: colors.ink }, consentText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 21 }, button: { backgroundColor: colors.ink, padding: 19, borderRadius: 18, flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center' }, buttonText: { color: colors.accent, fontWeight: '700', fontSize: 16 }, footnote: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 16 } });
