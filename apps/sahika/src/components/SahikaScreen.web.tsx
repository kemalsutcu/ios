import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { SAHIKA_PAGE_URL } from '../lib/wixAppBridge';

/** Browser preview uses the same live Wix page; the signed iOS app applies its page-chrome adaptation. */
export default function SahikaScreen() {
  return <View style={styles.screen}>{createElement('iframe', {
    src: SAHIKA_PAGE_URL,
    title: 'Şahika — Yapay Zekâ Veteriner Asistanı',
    allow: 'microphone; autoplay; clipboard-write',
    referrerPolicy: 'strict-origin-when-cross-origin',
    style: { border: 0, width: '100%', height: '100%', display: 'block' },
  })}</View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#FFFFFF' } });
