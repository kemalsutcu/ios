import { StyleSheet, Text, View } from 'react-native';

/** Cross-origin iframe previews cannot apply the iOS-only page-isolation bridge. */
export default function BelmaScreen() {
  return <View style={styles.screen}><Text style={styles.title}>Belma</Text>
    <Text style={styles.text}>Hukuk asistanının bu sürümü iPhone için hazırlanmıştır. Uygulamanın önizleme paketini iPhone’da açın.</Text>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 30, fontWeight: '600', color: '#202124' },
  text: { maxWidth: 400, marginTop: 20, fontSize: 16, lineHeight: 24, textAlign: 'center', color: '#777B83' },
});
