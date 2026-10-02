import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import {
  DOWNLOAD_BRIDGE_SCRIPT,
  getExternalLink,
  isAllowedSubframeUrl,
  isTrustedAgentUrl,
  validateDownloadMessage,
} from '../lib/downloadPolicy';

export interface AgentWebViewProps {
  url: string;
  title: string;
  onClose?: () => void;
}

function confirmExport(filename: string, bytes: number): Promise<boolean> {
  return new Promise((resolve) => Alert.alert(
    'Dosyayı kaydet veya paylaş',
    `${filename}\n${(bytes / 1024).toFixed(0)} KB\n\nPaylaş menüsünden Dosyalara Kaydet seçeneğini kullanabilirsin.`,
    [{ text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Devam et', onPress: () => resolve(true) }],
    { cancelable: true, onDismiss: () => resolve(false) },
  ));
}

export function AgentWebView(props: AgentWebViewProps) {
  // A new agent URL gets a fresh session, permission UI, navigation state and message replay set.
  return <AgentWebViewSession key={props.url} {...props} />;
}

export default AgentWebView;

function AgentWebViewSession({ url, title, onClose }: AgentWebViewProps) {
  const webView = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [sharing, setSharing] = useState(false);
  const mounted = useRef(true);
  const externalPrompt = useRef(false);
  const downloadBusy = useRef(false);
  const seenDownloads = useRef(new Set<string>());
  const currentUrl = useRef(url);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const askExternal = useCallback((target: string, isDownload = false) => {
    const link = getExternalLink(target);
    if (!link || externalPrompt.current || !mounted.current) return;
    externalPrompt.current = true;
    const release = () => { externalPrompt.current = false; };
    Alert.alert(
      isDownload ? 'Dosyayı tarayıcıda aç' : 'Uygulama dışına çıkılıyor',
      `${link.label}\n\n${isDownload ? 'Bu indirme bağlantısını tarayıcıda açmak istiyor musun?' : 'Bu bağlantıyı ilgili uygulamada açmak istiyor musun?'}`,
      [{ text: 'Vazgeç', style: 'cancel', onPress: release }, {
        text: 'Aç', onPress: () => {
          release();
          if (!mounted.current) return;
          void Linking.openURL(link.url).catch(() => {
            if (mounted.current) Alert.alert('Bağlantı açılamadı', 'Cihazında bu bağlantıyı açabilen bir uygulama bulunamadı.');
          });
        },
      }],
      { cancelable: true, onDismiss: release },
    );
  }, []);

  const receiveMessage = useCallback(async (event: WebViewMessageEvent) => {
    const { data, url: eventUrl } = event.nativeEvent;
    if (!isTrustedAgentUrl(eventUrl) || !isTrustedAgentUrl(currentUrl.current) || downloadBusy.current) return;
    // Other Wix messages are ignored. No transcript, attachment or message content is logged.
    if (data === '{"type":"YM_DOWNLOAD_ERROR","version":1}') {
      Alert.alert('Dosya hazırlanamadı', 'PDF, UDF, DOCX veya metin dosyası kullan. Paylaşılacak dosya en fazla 20 MB olabilir.');
      return;
    }
    const checked = validateDownloadMessage(data, eventUrl);
    if (!checked.ok) return;
    const document = checked.value;
    if (seenDownloads.current.has(document.id)) return;
    seenDownloads.current.add(document.id);
    if (seenDownloads.current.size > 64) seenDownloads.current.delete(seenDownloads.current.values().next().value!);
    downloadBusy.current = true;
    let directory: Directory | undefined;
    try {
      if (!await confirmExport(document.filename, document.size) || !mounted.current) return;
      if (!await Sharing.isAvailableAsync()) throw new Error('unavailable');
      if (!mounted.current) return;
      setSharing(true);
      // App-private cache only; explicit user save/share creates a separate user-owned copy.
      directory = new Directory(Paths.cache, `ym-export-${Date.now()}-${document.id}`);
      directory.create();
      const file = new File(directory, document.filename);
      file.create();
      file.write(document.base64, { encoding: 'base64' });
      if (file.size !== document.size) throw new Error('incomplete');
      await Sharing.shareAsync(file.uri, { mimeType: document.mimeType, dialogTitle: 'Dosyayı kaydet veya paylaş' });
    } catch {
      if (mounted.current) Alert.alert('Dosya paylaşılamadı', 'Dosyayı yeniden oluşturup tekrar dene.');
    } finally {
      try { if (directory?.exists) directory.delete(); } catch {
        // Never disclose private paths or contents in logs. OS cache cleanup is the final fallback.
      }
      downloadBusy.current = false;
      if (mounted.current) setSharing(false);
    }
  }, []);

  const validUrl = isTrustedAgentUrl(url);

  return (
    <View style={styles.container}>
      {canGoBack || onClose ? <View style={styles.toolbar}>
        {canGoBack ? <Pressable accessibilityRole="button" accessibilityLabel="Önceki sayfaya dön" onPress={() => webView.current?.goBack()} style={styles.action}><Text style={styles.actionText}>Geri</Text></Pressable> : <View style={styles.spacer} />}
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {onClose ? <Pressable accessibilityRole="button" accessibilityLabel="Ajanı kapat" onPress={onClose} style={styles.action}><Text style={styles.actionText}>Kapat</Text></Pressable> : <View style={styles.spacer} />}
      </View> : null}
      {validUrl && !failure ? <WebView
        key={url}
        ref={webView}
        source={{ uri: url }}
        style={styles.webView}
        // '*' prevents RN WebView's automatic OS handoff; EVERY navigation is checked below.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request) => {
          if (request.isTopFrame === false) return isAllowedSubframeUrl(request.url);
          if (isTrustedAgentUrl(request.url)) return true;
          askExternal(request.url);
          return false;
        }}
        onOpenWindow={({ nativeEvent }) => askExternal(nativeEvent.targetUrl)}
        onFileDownload={({ nativeEvent }) => askExternal(nativeEvent.downloadUrl, true)}
        onNavigationStateChange={(state) => {
          if (!isTrustedAgentUrl(state.url)) {
            webView.current?.stopLoading();
            return;
          }
          currentUrl.current = state.url;
          setCanGoBack(state.canGoBack);
        }}
        onLoadStart={() => { setLoading(true); setFailure(null); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setFailure('Ajan sayfasına ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.'); }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.url === currentUrl.current && nativeEvent.statusCode >= 400) {
            setLoading(false);
            setFailure('Ajan sayfası şu anda yanıt vermiyor. Biraz sonra tekrar dene.');
          }
        }}
        onContentProcessDidTerminate={() => { setLoading(false); setFailure('Görüşme sayfası kapandı. Yeniden açarak yeni bir görüşme başlatabilirsin.'); }}
        onMessage={(event) => { void receiveMessage(event); }}
        injectedJavaScriptBeforeContentLoaded={DOWNLOAD_BRIDGE_SCRIPT}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        injectedJavaScript={DOWNLOAD_BRIDGE_SCRIPT}
        injectedJavaScriptForMainFrameOnly
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows
        mixedContentMode="never"
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        incognito
        cacheEnabled={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        webviewDebuggingEnabled={false}
      /> : <View style={styles.error}>
        <Text style={styles.errorTitle}>Bağlantı kurulamadı</Text>
        <Text style={styles.errorBody}>{validUrl ? failure : 'Bu ajan bağlantısı desteklenen bir Yapay Mevzular adresi değil.'}</Text>
        {validUrl ? <Pressable accessibilityRole="button" onPress={() => { setFailure(null); setLoading(true); }} style={styles.retry}><Text style={styles.retryText}>Yeniden dene</Text></Pressable> : null}
      </View>}
      {loading && validUrl && !failure ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#D8F1A0" /><Text style={styles.loadingText}>Ajan hazırlanıyor…</Text></View> : null}
      {sharing ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#D8F1A0" /><Text style={styles.loadingText}>Paylaş menüsü açılıyor…</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F0' },
  webView: { flex: 1, backgroundColor: '#F6F6F0' },
  toolbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#DEE4D9', paddingHorizontal: 8 },
  title: { flex: 1, color: '#183B35', textAlign: 'center', fontSize: 16, fontWeight: '600' },
  action: { minWidth: 60, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#183B35', fontSize: 15 },
  spacer: { width: 60 },
  loading: { position: 'absolute', left: 24, right: 24, bottom: 24, flexDirection: 'row', justifyContent: 'center', gap: 12, borderRadius: 16, padding: 16, backgroundColor: '#183B35' },
  loadingText: { color: '#F6F6F0', fontSize: 14 },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 16 },
  errorTitle: { fontSize: 22, color: '#183B35', fontWeight: '600' },
  errorBody: { color: '#5D716B', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  retry: { minHeight: 48, paddingHorizontal: 24, justifyContent: 'center', borderRadius: 14, backgroundColor: '#D8F1A0' },
  retryText: { color: '#183B35', fontWeight: '600', fontSize: 16 },
});
