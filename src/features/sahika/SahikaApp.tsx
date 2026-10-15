import React from 'react';
import { router } from 'expo-router';
import { Alert, Linking, Share } from 'react-native';
import { ConversationProvider } from '@elevenlabs/react-native';
import ChatScreen, { type ClinicAction } from './components/ChatScreen';
import { useSahika } from './hooks/useSahika';

function SahikaContent() {
  const state = useSahika();
  const share = async () => {
    const message = state.messages.map(m => `${m.role === 'assistant' ? 'Şahika' : 'Sen'}: ${m.text}`).join('\n\n');
    if (!message) return;
    try { await Share.share({ title: 'Şahika konuşması', message }); }
    catch { Alert.alert('Paylaşım açılamadı', 'Biraz sonra yeniden deneyebilirsin.'); }
  };
  const clinicAction = async (action: ClinicAction) => {
    let url: string;
    if (action === 'call') url = 'tel:+905448380838';
    else if (action === 'maps') url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('PulseVet Veteriner Kliniği, Acıbadem Caddesi No:195F, Üsküdar/İstanbul') + '&destination_place_id=ChIJSzD8oJ3DyhQRThyQ8DHvOjU';
    else {
      const message = state.messages.map(m => `${m.role === 'assistant' ? 'Şahika' : 'Ben'}: ${m.text}`).join('\n\n');
      // Draft only. The user reviews and sends in WhatsApp.
      url = 'https://wa.me/905448380838?text=' + encodeURIComponent(('Merhaba PulseVet, Şahika görüşmem hakkında iletişime geçiyorum.\n\n' + message).slice(-6000));
    }
    try { await Linking.openURL(url); }
    catch { Alert.alert('Bağlantı açılamadı', 'Bu işlem için gerekli uygulamanın yüklü olduğunu kontrol et.'); }
  };
  return <ChatScreen {...state} onBack={() => { state.onEnd(); if (router.canGoBack()) router.back(); else router.replace('/'); }} onShare={() => { void share(); }} onClinicAction={action => { void clinicAction(action); }} />;
}

export default function SahikaApp() {
  return <ConversationProvider><SahikaContent /></ConversationProvider>;
}
