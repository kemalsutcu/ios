import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useAnimatedValue,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
};
export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};
export type ChatMode = 'text' | 'voice';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
export type ClinicAction = 'call' | 'whatsapp' | 'maps';
export type ChatScreenProps = {
  messages: ChatMessage[];
  sessions: ChatSession[];
  mode: ChatMode;
  status: ConnectionStatus;
  isSpeaking: boolean;
  micMuted: boolean;
  draft: string;
  error: string | null;
  loading: boolean;
  suggestions: string[];
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onSetMode: (mode: ChatMode) => void;
  onToggleMic: () => void;
  onEnd: () => void;
  onNew: () => void;
  onLoadSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onShare: () => void;
  onClinicAction: (action: ClinicAction) => void;
  onClearError: () => void;
  onBack?: () => void;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const c = theme.colors;

function IconButton({ name, label, onPress, disabled = false, tone = 'default' }: {
  name: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'accent';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, tone === 'accent' && styles.accentIconButton, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={name} size={22} color={tone === 'accent' ? c.accent : c.ink} />
    </Pressable>
  );
}

/** Small Markdown subset: assistant emphasis stays selectable and scales with iOS text size. */
function MessageText({ message }: { message: ChatMessage }) {
  if (message.role === 'user') return <Text selectable style={styles.messageText}>{message.text}</Text>;
  return (
    <Text selectable style={styles.messageText}>
      {message.text.split(/(\*\*[\s\S]+?\*\*)/g).map((part, index) => (
        <Text key={index} style={part.startsWith('**') && part.endsWith('**') ? styles.bold : undefined}>
          {part.startsWith('**') && part.endsWith('**') ? part.slice(2, -2) : part}
        </Text>
      ))}
    </Text>
  );
}

function MessageRow({ message, compact = false }: { message: ChatMessage; compact?: boolean }) {
  const assistant = message.role === 'assistant';
  return (
    <View style={[styles.messageRow, assistant ? styles.assistantRow : styles.userRow, compact && styles.compactRow]}>
      {assistant && (
        <View style={styles.assistantAuthor} accessible accessibilityLabel="Şahika">
          <View style={styles.miniBrand}><Ionicons name="paw" size={13} color={c.accent} /></View>
          <Text style={styles.authorName}>Şahika</Text>
        </View>
      )}
      <View style={assistant ? styles.assistantBubble : styles.userBubble}>
        <MessageText message={message} />
      </View>
    </View>
  );
}

function VoiceOrb({ active, speaking, muted }: { active: boolean; speaking: boolean; muted: boolean }) {
  const pulse = useAnimatedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!active || reduceMotion) { pulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: speaking ? 650 : 1600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: speaking ? 650 : 1600, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, speaking, reduceMotion, pulse]);
  return (
    <View style={styles.orbStage} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.orbHalo, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) }] }]} />
      <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, speaking ? 1.06 : 1.025] }) }] }}>
        <LinearGradient colors={muted ? ['#A9BEB7', '#758F89', '#AEC2BC'] : ['#9AD6B5', '#3C9B96', '#0F657B']} locations={[0, 0.5, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.orb}>
          <View style={styles.orbShine} />
          <Ionicons name={muted ? 'mic-off-outline' : 'paw'} size={45} color="#F2FFFA" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function formatSessionDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export default function ChatScreen(props: ChatScreenProps) {
  const {
    messages, sessions, mode, status, isSpeaking, micMuted, draft, error, loading, suggestions,
    onDraftChange, onSend, onSetMode, onToggleMic, onEnd, onNew, onLoadSession,
    onDeleteSession, onShare, onClinicAction, onClearError, onBack,
  } = props;
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const [sheet, setSheet] = useState<'history' | 'clinic' | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const connected = status === 'connected';
  const busy = status === 'connecting' || status === 'disconnecting';
  const canSend = !!draft.trim() && !loading && !busy;
  const voiceLabel = status === 'connecting' ? 'Şahika’ya bağlanılıyor…'
    : status === 'disconnecting' ? 'Görüşme sonlandırılıyor…'
      : !connected ? 'Bir ses kadar yakın.'
        : micMuted ? 'Mikrofonun kapalı'
          : isSpeaking ? 'Şahika konuşuyor' : 'Seni dinliyorum';
  const voiceHint = !connected ? 'Konuşmaya başla; Şahika seni dinlesin.'
    : micMuted ? 'Hazır olduğunda mikrofonunu açabilirsin.'
      : isSpeaking ? 'İstersen sen de konuşabilirsin.' : 'Aklındaki soruyu, kendi cümlelerinle anlat.';

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, mode]);

  function fillSuggestion(value: string) {
    onDraftChange(value);
    inputRef.current?.focus();
  }

  function deleteSession(session: ChatSession) {
    Alert.alert('Sohbet silinsin mi?', `“${session.title}” bu cihazdan silinecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => onDeleteSession(session.id) },
    ]);
  }

  const openSheet = (value: 'history' | 'clinic') => { Keyboard.dismiss(); setSheet(value); };
  const newConversation = () => { Keyboard.dismiss(); setSheet(null); onNew(); };
  const clinicAction = (action: ClinicAction) => { setSheet(null); onClinicAction(action); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          {onBack ? <IconButton name="chevron-back" label="Ajanlara dön" onPress={onBack} /> : <IconButton name="menu-outline" label="Sohbet geçmişini aç" onPress={() => openSheet('history')} />}
          <Pressable onPress={() => openSheet('clinic')} accessibilityRole="button" accessibilityLabel="Şahika, PulseVet. Klinik iletişim seçeneklerini aç" style={styles.brand}>
            <View style={styles.brandTitleRow}>
              <Ionicons name="paw" color={c.accent} size={17} />
              <Text style={styles.brandTitle}>ŞAHİKA</Text>
            </View>
            <Text style={styles.brandByline}>PULSEVET · YAPAY MEVZULAR</Text>
          </Pressable>
          <View style={styles.headerActions}>
            {onBack && <IconButton name="time-outline" label="Sohbet geçmişini aç" onPress={() => openSheet('history')} />}
            <IconButton name="create-outline" label="Yeni sohbet başlat" onPress={newConversation} tone="accent" />
          </View>
        </View>

        <View style={styles.modeRow}>
          <View accessibilityRole="tablist" style={styles.modeTabs}>
            {([['text', 'chatbubble-outline', 'Yazış'], ['voice', 'pulse-outline', 'Konuş']] as const).map(([value, icon, label]) => (
              <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: mode === value }} onPress={() => onSetMode(value)} style={({ pressed }) => [styles.modeTab, mode === value && styles.modeTabActive, pressed && styles.pressed]}>
                <Ionicons name={icon} size={17} color={mode === value ? c.ink : c.muted} />
                <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <IconButton name="ellipsis-horizontal" label="Klinik ve paylaşım seçeneklerini aç" onPress={() => openSheet('clinic')} />
        </View>

        {error && (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" color={c.danger} size={20} />
            <ScrollView style={styles.errorMessage} nestedScrollEnabled><Text selectable style={styles.errorText}>{error}</Text></ScrollView>
            <Pressable onPress={onClearError} accessibilityRole="button" accessibilityLabel="Hata bildirimini kapat" hitSlop={10} style={styles.errorClose}><Ionicons name="close" size={19} color={c.danger} /></Pressable>
          </View>
        )}

        {mode === 'text' ? (
          <>
            {messages.length === 0 ? (
              <ScrollView contentContainerStyle={styles.welcomeScroll} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.welcomeMark}>
                  <LinearGradient colors={['#EAF3DD', '#D7ECE8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.welcomeMarkInner}>
                    <Ionicons name="paw-outline" size={40} color={c.accentDark} />
                  </LinearGradient>
                  <View style={styles.sparkle}><Ionicons name="sparkles" size={19} color={c.accent} /></View>
                </View>
                <Text style={styles.eyebrow}>PATİ DOSTUN İÇİN, YANINDA.</Text>
                <Text accessibilityRole="header" style={styles.welcomeTitle}>Sen anlat,{`\n`}birlikte bakalım.</Text>
                <Text style={styles.welcomeSubtitle}>Ben Şahika. Minik dostunla ilgili sorularını birlikte ele alalım.</Text>
                <View style={styles.suggestions}>
                  {suggestions.map((suggestion, index) => (
                    <Pressable key={`${index}-${suggestion}`} accessibilityRole="button" accessibilityLabel={`Soruyu yaz: ${suggestion}`} onPress={() => fillSuggestion(suggestion)} style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}>
                      <View style={styles.suggestionIcon}><Ionicons name={index % 3 === 0 ? 'heart-outline' : index % 3 === 1 ? 'nutrition-outline' : 'leaf-outline'} size={19} color={c.accent} /></View>
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                      <Ionicons name="arrow-up-outline" style={styles.suggestionArrow} size={17} color={c.muted} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <FlatList ref={listRef} data={messages} keyExtractor={item => item.id} renderItem={({ item }) => <MessageRow message={item} />} contentContainerStyle={styles.chatContent} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })} ListFooterComponent={loading ? <View accessibilityLiveRegion="polite" style={styles.loadingRow}><ActivityIndicator size="small" color={c.accent} /><Text style={styles.loadingText}>Şahika düşünüyor…</Text></View> : null} />
            )}
            <View style={[styles.composerWrap, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12) }]}>
              <View style={styles.composer}>
                <TextInput ref={inputRef} accessibilityLabel="Şahika’ya mesaj yaz" accessibilityHint="Mesajını yazdıktan sonra Gönder düğmesine dokun" placeholder="Şahika’ya sor…" placeholderTextColor={c.muted} value={draft} onChangeText={onDraftChange} multiline maxFontSizeMultiplier={1.8} style={styles.input} textAlignVertical="top" autoCapitalize="sentences" autoCorrect returnKeyType="default" keyboardAppearance="light" />
                <Pressable onPress={onSend} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Mesajı gönder" accessibilityState={{ disabled: !canSend, busy: loading }} style={({ pressed }) => [styles.sendButton, !canSend && styles.sendDisabled, pressed && canSend && styles.pressed]}>
                  {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="arrow-up" size={23} color={canSend ? '#FFFFFF' : '#91A4A0'} />}
                </Pressable>
              </View>
              <Text style={styles.footnote}>Şahika bilgilendirir. Tanı ve tedavi için veterinerine danış.</Text>
            </View>
          </>
        ) : (
          <View style={styles.voiceRoot}>
            <ScrollView contentContainerStyle={styles.voiceContent} showsVerticalScrollIndicator={false}>
              <View style={styles.voiceStatus}>
                <View style={[styles.statusDot, connected && styles.statusDotActive]} />
                <Text style={styles.voiceStatusText}>{connected ? 'CANLI GÖRÜŞME' : busy ? 'BAĞLANTI' : 'SESLİ SOHBET'}</Text>
              </View>
              <VoiceOrb active={connected && !micMuted} speaking={isSpeaking} muted={micMuted} />
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.voiceTitle}>{voiceLabel}</Text>
              <Text style={styles.voiceHint}>{voiceHint}</Text>
              {messages.length > 0 && (
                <View style={styles.captions}>
                  <Text style={styles.captionLabel}>SOHBETTEN</Text>
                  {messages.slice(-2).map(message => <MessageRow key={message.id} message={message} compact />)}
                </View>
              )}
            </ScrollView>
            <View style={[styles.voiceControlsWrap, { paddingBottom: Math.max(insets.bottom, 18) }]}>
              {connected ? (
                <View style={styles.voiceControls}>
                  <View style={styles.voiceControlItem}>
                    <Pressable onPress={onToggleMic} accessibilityRole="button" accessibilityLabel={micMuted ? 'Mikrofonu aç' : 'Mikrofonu kapat'} accessibilityState={{ selected: !micMuted }} style={({ pressed }) => [styles.voiceControl, micMuted && styles.mutedControl, pressed && styles.pressed]}>
                      <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={27} color={micMuted ? c.danger : c.ink} />
                    </Pressable>
                    <Text style={styles.controlLabel}>{micMuted ? 'Mikrofonu aç' : 'Mikrofon'}</Text>
                  </View>
                  <View style={styles.voiceControlItem}>
                    <Pressable onPress={onEnd} accessibilityRole="button" accessibilityLabel="Sesli görüşmeyi bitir" style={({ pressed }) => [styles.voiceControl, styles.endControl, pressed && styles.pressed]}>
                      <Ionicons name="call" size={25} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                    </Pressable>
                    <Text style={styles.controlLabel}>Bitir</Text>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => onSetMode('voice')} disabled={busy} accessibilityRole="button" accessibilityLabel={busy ? 'Bağlanılıyor' : 'Sesli görüşmeyi başlat'} accessibilityState={{ disabled: busy, busy }} style={({ pressed }) => [styles.startVoiceButton, pressed && styles.pressed, busy && styles.disabled]}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="mic" size={22} color="#FFFFFF" />}
                  <Text style={styles.startVoiceText}>{busy ? 'Bağlanıyor…' : 'Konuşmaya başla'}</Text>
                </Pressable>
              )}
              <Text style={styles.footnote}>Acil bir durumda doğrudan veteriner kliniğine ulaş.</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={sheet !== null} animationType="slide" transparent onRequestClose={() => setSheet(null)} statusBarTranslucent>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSheet(null)} accessibilityRole="button" accessibilityLabel="Pencereyi kapat" />
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20), marginTop: insets.top + 32 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text accessibilityRole="header" style={styles.sheetTitle}>{sheet === 'history' ? 'Sohbetlerin' : 'Bir pati kadar yakın'}</Text>
              <IconButton name="close" label="Pencereyi kapat" onPress={() => setSheet(null)} />
            </View>
            {sheet === 'history' ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Yeni sohbet başlat" onPress={newConversation} style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}>
                  <Ionicons name="add" color={c.accent} size={23} /><Text style={styles.newChatText}>Yeni sohbet</Text>
                </Pressable>
                <FlatList data={sessions} keyExtractor={item => item.id} contentContainerStyle={styles.historyList} renderItem={({ item }) => (
                  <View style={styles.historyRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${formatSessionDate(item.updatedAt)}. Sohbeti aç`} onPress={() => { setSheet(null); onLoadSession(item.id); }} style={({ pressed }) => [styles.historyOpen, pressed && styles.pressed]}>
                      <Ionicons name="chatbubble-outline" size={21} color={c.accent} />
                      <View style={styles.historyText}><Text numberOfLines={2} style={styles.historyTitle}>{item.title}</Text><Text style={styles.historyDate}>{formatSessionDate(item.updatedAt)} · {item.messages.length} mesaj</Text></View>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} sohbetini sil`} onPress={() => deleteSession(item)} hitSlop={5} style={styles.historyDelete}><Ionicons name="trash-outline" size={19} color={c.muted} /></Pressable>
                  </View>
                )} ListEmptyComponent={<View style={styles.historyEmpty}><Ionicons name="chatbubbles-outline" color={c.muted} size={40} /><Text style={styles.historyEmptyTitle}>İlk sohbetin burada başlayacak.</Text><Text style={styles.historyEmptyText}>Sohbetlerin bu cihazda saklanır; dilediğinde geri dönebilirsin.</Text></View>} />
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.clinicContent}>
                <View style={styles.clinicIdentity}><View style={styles.clinicMark}><Ionicons name="paw" size={29} color={c.accent} /></View><View style={styles.clinicIdentityText}><Text style={styles.clinicName}>PulseVet</Text><Text style={styles.clinicSubtitle}>Acıbadem Veteriner Kliniği</Text></View></View>
                <Text style={styles.clinicIntro}>Minik dostunun bir hekime ihtiyacı olduğunda, kliniğe buradan ulaşabilirsin.</Text>
                {([
                  ['call', 'call-outline', 'Kliniği ara', 'Telefonla iletişime geç'],
                  ['whatsapp', 'logo-whatsapp', 'WhatsApp’tan yaz', 'Klinikle mesajlaş'],
                  ['maps', 'navigate-outline', 'Yol tarifi al', 'Kliniği haritada aç'],
                ] as const).map(([action, icon, title, subtitle]) => (
                  <Pressable key={action} onPress={() => clinicAction(action)} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.menuAction, pressed && styles.pressed]}><View style={styles.menuActionIcon}><Ionicons name={icon} size={23} color={c.accent} /></View><View style={styles.menuActionText}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuSubtitle}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={c.muted} /></Pressable>
                ))}
                <View style={styles.menuDivider} />
                <Pressable onPress={() => { setSheet(null); onShare(); }} disabled={messages.length === 0} accessibilityRole="button" accessibilityLabel="Sohbet metnini paylaş" accessibilityState={{ disabled: messages.length === 0 }} style={({ pressed }) => [styles.menuAction, messages.length === 0 && styles.disabled, pressed && styles.pressed]}><View style={styles.menuActionIcon}><Ionicons name="share-outline" size={23} color={c.accent} /></View><View style={styles.menuActionText}><Text style={styles.menuTitle}>Sohbeti paylaş</Text><Text style={styles.menuSubtitle}>Görüşmenin metnini dışa aktar</Text></View><Ionicons name="chevron-forward" size={18} color={c.muted} /></Pressable>
                <Text style={styles.clinicFooter}>ŞAHİKA · PULSEVET × YAPAY MEVZULAR</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  root: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  accentIconButton: { backgroundColor: '#EBF1E9' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  brand: { flex: 1, alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, flexShrink: 1 },
  brandTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandTitle: { color: c.ink, fontSize: 21, fontWeight: '700', letterSpacing: 3.1 },
  brandByline: { flexShrink: 1, color: c.muted, marginTop: 5, fontSize: 8, fontWeight: '600', letterSpacing: 1.25, textAlign: 'center' },
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 22, paddingRight: 17, paddingBottom: 6 },
  modeTabs: { flexDirection: 'row', backgroundColor: '#EBEEE7', padding: 4, borderRadius: 18 },
  modeTab: { minWidth: 105, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  modeTabActive: { backgroundColor: c.surface, shadowColor: c.ink, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1 },
  modeText: { color: c.muted, fontSize: 13, fontWeight: '500' },
  modeTextActive: { color: c.ink, fontWeight: '600' },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginHorizontal: 20, marginTop: 7, padding: 12, borderRadius: 16, backgroundColor: c.dangerSoft },
  errorMessage: { flex: 1, maxHeight: 116 },
  errorText: { fontSize: 13, lineHeight: 19, color: c.danger },
  errorClose: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  welcomeScroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 28, paddingBottom: 24, alignItems: 'center', justifyContent: 'center' },
  welcomeMark: { width: 88, height: 88, marginBottom: 23 },
  welcomeMarkInner: { width: 88, height: 88, borderRadius: 31, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  sparkle: { position: 'absolute', right: -7, top: -5, width: 31, height: 31, borderRadius: 12, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, letterSpacing: 1.35, fontWeight: '700', color: c.accent, textAlign: 'center', marginBottom: 12 },
  welcomeTitle: { fontSize: 36, lineHeight: 44, letterSpacing: -1.3, fontWeight: '600', color: c.ink, textAlign: 'center' },
  welcomeSubtitle: { marginTop: 15, maxWidth: 300, fontSize: 15, lineHeight: 23, textAlign: 'center', color: c.secondary },
  suggestions: { gap: 9, width: '100%', maxWidth: 440, marginTop: 30 },
  suggestion: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFFAA', paddingLeft: 12, paddingRight: 14, paddingVertical: 13, borderRadius: 18, borderWidth: 1, borderColor: c.line, gap: 10, minHeight: 54 },
  suggestionIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F5EC' },
  suggestionText: { flex: 1, fontSize: 13, lineHeight: 19, color: c.secondary, fontWeight: '500' },
  suggestionArrow: { transform: [{ rotate: '45deg' }] },
  suggestionPressed: { backgroundColor: c.accentSoft, borderColor: '#BBD6CC' },
  chatContent: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18, gap: 24 },
  messageRow: { width: '100%' },
  compactRow: { marginTop: 15 },
  assistantRow: { alignItems: 'flex-start' },
  userRow: { alignItems: 'flex-end' },
  assistantAuthor: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  miniBrand: { width: 24, height: 24, borderRadius: 9, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  authorName: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2, color: c.accent },
  assistantBubble: { width: '100%', paddingHorizontal: 1 },
  userBubble: { maxWidth: '91%', backgroundColor: c.user, paddingHorizontal: 17, paddingVertical: 13, borderRadius: 22, borderTopRightRadius: 7 },
  messageText: { color: c.ink, fontSize: 16, lineHeight: 25, fontWeight: '400' },
  bold: { fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  loadingText: { color: c.muted, fontSize: 13 },
  composerWrap: { paddingHorizontal: 18, paddingTop: 10, backgroundColor: c.background },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, borderRadius: 26, backgroundColor: c.surface, borderWidth: 1, borderColor: '#DCE4DB', padding: 7, paddingLeft: 18, ...theme.shadow },
  input: { flex: 1, color: c.ink, fontSize: 16, lineHeight: 22, minHeight: 44, maxHeight: 140, paddingTop: 11, paddingBottom: 10, paddingHorizontal: 0 },
  sendButton: { width: 43, height: 43, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
  sendDisabled: { backgroundColor: '#EBF0E9' },
  footnote: { fontSize: 9.5, lineHeight: 14, textAlign: 'center', color: c.muted, marginTop: 10, paddingHorizontal: 5 },
  voiceRoot: { flex: 1 },
  voiceContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 25, paddingTop: 25, paddingBottom: 20 },
  voiceStatus: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A1B4AD' },
  statusDotActive: { backgroundColor: '#4B9E72' },
  voiceStatusText: { color: c.muted, fontSize: 10, letterSpacing: 1.4, fontWeight: '600' },
  orbStage: { width: 236, height: 236, alignItems: 'center', justifyContent: 'center', marginTop: 21, marginBottom: 18 },
  orbHalo: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: '#E4EEE3', borderWidth: 1, borderColor: '#DCE9DE' },
  orb: { width: 180, height: 180, borderRadius: 90, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#2C8E83', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.17, shadowRadius: 22, elevation: 4 },
  orbShine: { position: 'absolute', width: 150, height: 95, borderRadius: 75, top: -42, left: -2, backgroundColor: '#DBF5BE55', transform: [{ rotate: '-25deg' }] },
  voiceTitle: { color: c.ink, fontSize: 25, lineHeight: 33, letterSpacing: -0.6, fontWeight: '600', textAlign: 'center' },
  voiceHint: { fontSize: 14, lineHeight: 22, color: c.secondary, maxWidth: 290, textAlign: 'center', marginTop: 10 },
  captions: { width: '100%', paddingHorizontal: 17, paddingTop: 15, paddingBottom: 18, borderRadius: 22, backgroundColor: '#FFFFFFAB', borderWidth: 1, borderColor: c.line, marginTop: 27 },
  captionLabel: { color: c.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
  voiceControlsWrap: { paddingHorizontal: 28, paddingTop: 12 },
  voiceControls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 32 },
  voiceControlItem: { alignItems: 'center', minWidth: 80 },
  voiceControl: { width: 64, height: 64, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EEE6' },
  mutedControl: { backgroundColor: c.dangerSoft },
  endControl: { backgroundColor: '#B64F4A' },
  controlLabel: { fontSize: 11, color: c.secondary, marginTop: 9, textAlign: 'center' },
  startVoiceButton: { borderRadius: 22, paddingHorizontal: 24, paddingVertical: 17, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  startVoiceText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0D282C55' },
  sheet: { maxHeight: '88%', minHeight: '45%', borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: c.background, paddingHorizontal: 22, overflow: 'hidden' },
  sheetHandle: { alignSelf: 'center', width: 35, height: 4, borderRadius: 2, backgroundColor: '#CDD8CE', marginTop: 10, marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 3, paddingBottom: 17, gap: 8 },
  sheetTitle: { color: c.ink, fontSize: 25, lineHeight: 33, letterSpacing: -0.6, fontWeight: '600', flex: 1 },
  newChat: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 17, padding: 15, backgroundColor: c.accentSoft, marginBottom: 13 },
  newChatText: { color: c.accentDark, fontSize: 15, fontWeight: '600' },
  historyList: { paddingBottom: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: c.line },
  historyOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17, paddingRight: 7 },
  historyText: { flex: 1, gap: 5 },
  historyTitle: { fontSize: 15, lineHeight: 21, fontWeight: '500', color: c.ink },
  historyDate: { color: c.muted, fontSize: 11 },
  historyDelete: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  historyEmpty: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 20, paddingBottom: 50 },
  historyEmptyTitle: { fontSize: 17, color: c.ink, marginTop: 18, textAlign: 'center', fontWeight: '500' },
  historyEmptyText: { color: c.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  clinicContent: { paddingBottom: 4 },
  clinicIdentity: { flexDirection: 'row', gap: 13, alignItems: 'center', marginTop: 4, marginBottom: 17 },
  clinicMark: { width: 61, height: 61, borderRadius: 21, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  clinicIdentityText: { flex: 1 },
  clinicName: { color: c.ink, fontSize: 24, fontWeight: '600', letterSpacing: -0.6 },
  clinicSubtitle: { fontSize: 12, lineHeight: 18, color: c.secondary, marginTop: 3 },
  clinicIntro: { fontSize: 14, lineHeight: 22, color: c.secondary, marginBottom: 19 },
  menuAction: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 69 },
  menuActionIcon: { width: 43, height: 43, backgroundColor: '#EBF0E7', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  menuActionText: { flex: 1, gap: 4 },
  menuTitle: { fontSize: 15, color: c.ink, fontWeight: '500' },
  menuSubtitle: { fontSize: 12, lineHeight: 18, color: c.muted },
  menuDivider: { height: 1, backgroundColor: c.line, marginTop: 5, marginBottom: 5 },
  clinicFooter: { color: c.muted, letterSpacing: 0.8, fontSize: 8.5, fontWeight: '600', textAlign: 'center', marginTop: 20, marginBottom: 10 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});
