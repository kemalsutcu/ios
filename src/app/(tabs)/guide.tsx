import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';

const steps = [
  ['01', 'Ajanınızı seçin', 'İlgilendiğiniz alana göre bir ajan açın. Başlamadan önce bilgi ve onam ekranını okuyun.'],
  ['02', 'Yazın veya konuşun', 'Ajan sayfasındaki görüşme düğmesine dokunun. Sesli görüşme için iPhone’un mikrofon iznini verin.'],
  ['03', 'Belgelerle devam edin', 'Dosya destekleyen ajanlarda “Dosya yükle” alanını kullanın. iPhone’un Dosyalar ekranından belgelerinizi seçin.'],
  ['04', 'Sonucu yanınıza alın', 'Desteklenen belge indirmelerinde iOS paylaşım menüsünden “Dosyalara Kaydet” seçin. UDF belgelerini UYAP uyumlu uygulamada açabilirsiniz.'],
];
export default function Guide() {
  return <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>YAPAY MEVZULAR</Text><Text style={styles.title}>Küçük bir rehber.</Text><Text style={styles.lead}>Ajanlarla ilk görüşmeniz için bilmeniz gerekenler.</Text>
    {steps.map(([number, title, text]) => <View key={number} style={styles.step}><Text style={styles.number}>{number}</Text><View style={{ flex: 1 }}><Text style={styles.heading}>{title}</Text><Text style={styles.body}>{text}</Text></View></View>)}
    <View style={styles.panel}><Ionicons name="finger-print-outline" size={27} color={colors.ink} /><Text style={styles.heading}>Verileriniz ve kontrolünüz</Text><Text style={styles.body}>Ses, mesaj ve seçilen dosyalar yanıt üretmek için ilgili ajanın kullandığı yapay zekâ hizmetlerine iletilir. Ajan sayfasındaki güncel aydınlatma metni ve onam koşulları geçerlidir.</Text><Text style={styles.body}>Uygulamanın favoriler alanı yalnızca ajan seçiminizi cihazda tutar. İndirdiğiniz veya paylaştığınız belgeler seçtiğiniz konuma kaydedilir. Ajanı kapattığınızda görüşme ekranı da kapanır.</Text></View>
    <View style={styles.panel}><Text style={styles.heading}>Mikrofon çalışmıyorsa</Text><Text style={styles.body}>iPhone Ayarlar → Uygulamalar → Yapay Mevzular bölümünden mikrofon iznini kontrol edin. İnternet bağlantınızı doğrulayın; görüşme düğmesine tekrar dokunun.</Text></View>
    <Text style={styles.heading}>Kemal Sütçü tarafından tasarlandı.</Text><Text style={styles.body}>Yapay Mevzular; uzmanlaşmış ajanları, sesli ve yazılı görüşmeyi bir araya getirir. Yanıtlar yapay zekâ ile üretilir. Ajanların yetenekleri ve kaynakları kendi bilgi bankalarının kapsamına bağlıdır.</Text>
    <Pressable accessibilityRole="link" style={styles.link} onPress={() => { void Linking.openURL('https://www.yapaymevzular.com/').catch(() => {}); }}><Text style={styles.linkText}>yapaymevzular.com</Text><Ionicons name="open-outline" size={17} color={colors.ink} /></Pressable>
    <Text style={styles.version}>Yapay Mevzular · 1.0.0</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: 24, paddingBottom: 40, maxWidth: 650, width: '100%', alignSelf: 'center' }, eyebrow: { color: colors.muted, letterSpacing: 2, fontSize: 10, marginBottom: 14, fontWeight: '700' }, title: { color: colors.ink, fontSize: 34, fontWeight: '700', letterSpacing: -1 }, lead: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 28 }, step: { flexDirection: 'row', gap: 18, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 23 }, number: { fontSize: 16, color: '#839477', fontWeight: '600' }, heading: { color: colors.ink, fontSize: 17, fontWeight: '600', lineHeight: 24 }, body: { color: colors.muted, fontSize: 14, lineHeight: 23, marginTop: 8 }, panel: { backgroundColor: colors.soft, padding: 22, borderRadius: 22, gap: 8, marginVertical: 12 }, link: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 }, linkText: { fontSize: 15, color: colors.ink, fontWeight: '600' }, version: { color: colors.muted, fontSize: 12, marginTop: 16 } });
