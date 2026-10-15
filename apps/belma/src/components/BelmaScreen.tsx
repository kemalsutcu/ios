import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  BELMA_PAGE_URL, buildAppBootstrapScript, buildAppTransitionScript,
  decodeBase64, externalDestination, isBelmaPageUrl, parseBridgeMessage, type DownloadMessage,
} from '../lib/belmaBridge';

const BOOTSTRAP = buildAppBootstrapScript();
const UTIS: Record<string, string> = {
  'text/plain': 'public.plain-text', 'application/json': 'public.json',
  'application/pdf': 'com.adobe.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'org.openxmlformats.wordprocessingml.document',
  'application/vnd.uyap.udf': 'public.data',
};

/** Only the assistant is revealed after its live page has hydrated and been isolated. */
export default function BelmaScreen() {
  const webView = useRef<WebView>(null);
  const mounted = useRef(true);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [generation, setGeneration] = useState(0);
  const activeGeneration = useRef<number | null>(0);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const externalBusy = useRef(false);
  const lastExternal = useRef({ url: '', time: 0 });
  const exportBusy = useRef(false);
  const exportedIds = useRef(new Set<string>());

  const stopCapture = useCallback(() => {
    webView.current?.injectJavaScript(buildAppTransitionScript('unmount'));
  }, []);
  const fail = useCallback((message: string) => {
    if (activeGeneration.current !== generation) return;
    activeGeneration.current = null;
    clearTimeout(timeout.current); stopCapture();
    if (mounted.current) { setReady(false); setFailure(message); }
  }, [generation, stopCapture]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' || state === 'inactive' || state === 'background') {
        webView.current?.injectJavaScript(buildAppTransitionScript(state));
      }
    });
    return () => {
      mounted.current = false;
      clearTimeout(timeout.current); subscription.remove(); stopCapture();
    };
  }, [stopCapture]);

  useEffect(() => {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => fail('Belma yüklenemedi. İnternet bağlantını kontrol edip yeniden dene.'), 60_000);
    return () => clearTimeout(timeout.current);
  }, [generation, fail]);

  const openExternal = useCallback(async (value: string) => {
    const url = externalDestination(value), now = Date.now();
    if (!url || externalBusy.current || (lastExternal.current.url === url && now - lastExternal.current.time < 1500)) return;
    externalBusy.current = true; lastExternal.current = { url, time: now };
    try { await Linking.openURL(url); }
    catch { if (mounted.current) Alert.alert('Bağlantı açılamadı', 'Bağlantıyı daha sonra yeniden deneyebilirsin.'); }
    finally { externalBusy.current = false; }
  }, []);

  const shareDownload = useCallback(async (message: DownloadMessage) => {
    if (exportBusy.current || exportedIds.current.has(message.id)) return;
    exportBusy.current = true; exportedIds.current.add(message.id);
    if (exportedIds.current.size > 64) exportedIds.current.delete(exportedIds.current.values().next().value!);
    let directory: Directory | undefined;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing unavailable');
      if (!mounted.current || activeGeneration.current !== generation) return;
      const bytes = decodeBase64(message.base64);
      if (bytes.length !== message.size) throw new Error('Invalid document size');
      directory = new Directory(Paths.cache, `belma-export-${message.id}`); directory.create();
      const file = new File(directory, message.filename); file.create(); file.write(bytes);
      if (file.size !== message.size) throw new Error('Incomplete document');
      await Sharing.shareAsync(file.uri, {
        mimeType: message.mime, UTI: UTIS[message.mime], dialogTitle: 'Belma belgesini kaydet veya paylaş',
      });
    } catch {
      if (mounted.current && activeGeneration.current === generation) Alert.alert('Belge paylaşılamadı', 'Belgeyi yeniden oluşturup indirmeyi tekrar dene.');
    } finally {
      // iOS shareAsync resolves after the share sheet is dismissed, so receivers can read the file first.
      try { if (directory?.exists) directory.delete(); } catch { /* The OS also clears cache files. */ }
      exportBusy.current = false;
    }
  }, [generation]);

  const receiveMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseBridgeMessage(event.nativeEvent.data, event.nativeEvent.url);
    if (!message || !mounted.current || activeGeneration.current !== generation) return;
    if (message.type === 'BELMA_APP_READY') {
      clearTimeout(timeout.current); setReady(true); setFailure(null);
      if (AppState.currentState !== 'active') webView.current?.injectJavaScript(buildAppTransitionScript('background'));
    } else if (message.type === 'BELMA_APP_EXTERNAL') { void openExternal(message.url); }
    else if (message.type === 'BELMA_APP_DOWNLOAD') { void shareDownload(message); }
    else { Alert.alert('Belge indirilemedi', 'Desteklenen biçimler PDF, Word, UDF, TXT ve JSON. Dosya en fazla 20 MB olabilir.'); }
  }, [generation, openExternal, shareDownload]);

  const retry = () => {
    stopCapture(); activeGeneration.current = generation + 1;
    setReady(false); setFailure(null); setGeneration(generation + 1);
  };

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
    {!failure ? <WebView
      key={generation} ref={webView} source={{ uri: BELMA_PAGE_URL }} style={styles.webView}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={request => {
        if (activeGeneration.current !== generation) return false;
        if (request.isTopFrame === false) return request.url === 'about:blank' || request.url.startsWith('https:');
        if (isBelmaPageUrl(request.url)) return true;
        if (request.navigationType === 'click') void openExternal(request.url);
        return false;
      }}
      onNavigationStateChange={state => {
        if (activeGeneration.current !== generation) return;
        if (!isBelmaPageUrl(state.url)) { webView.current?.stopLoading(); fail('Belma’ya güvenli bağlantı kurulamadı. Yeniden dene.'); }
      }}
      onMessage={receiveMessage}
      onOpenWindow={() => { /* Trusted assistant links are handed off by the click bridge. */ }}
      onError={() => fail('Belma’ya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.')}
      onHttpError={({ nativeEvent }) => {
        if (isBelmaPageUrl(nativeEvent.url) && nativeEvent.statusCode >= 400) fail('Belma şu anda yanıt vermiyor. Biraz sonra yeniden dene.');
      }}
      onContentProcessDidTerminate={() => fail('Görüşme ekranı kapandı. Belma’yı yeniden açabilirsin.')}
      onRenderProcessGone={() => fail('Görüşme ekranı kapandı. Belma’yı yeniden açabilirsin.')}
      injectedJavaScriptBeforeContentLoaded={BOOTSTRAP} injectedJavaScriptBeforeContentLoadedForMainFrameOnly
      injectedJavaScript={BOOTSTRAP} injectedJavaScriptForMainFrameOnly
      mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} javaScriptEnabled
      javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows mixedContentMode="never"
      allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
      webviewDebuggingEnabled={false} contentInsetAdjustmentBehavior="never"
      allowsBackForwardNavigationGestures={false} allowsLinkPreview={false} bounces={false}
    /> : null}
    {!ready || failure ? <View style={styles.cover} accessibilityLiveRegion="polite">
      <Image source={require('../../assets/belma-avatar.jpg')} style={styles.avatar} accessibilityLabel="Belma" />
      <Text style={styles.title}>Belma</Text><Text style={styles.subtitle}>Yapay Mevzular Hukuk Asistanı</Text>
      {failure ? <>
        <Text style={styles.message}>{failure}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Belma’yı yeniden yükle" onPress={retry} style={styles.retry}>
          <Text style={styles.retryText}>Yeniden dene</Text>
        </Pressable>
      </> : <View style={styles.loading}><ActivityIndicator color="#53614A" /><Text style={styles.loadingText}>Belma hazırlanıyor…</Text></View>}
      <Image source={require('../../assets/yapay-mevzular-light.png')} resizeMode="contain" style={styles.logo} accessibilityLabel="Yapay Mevzular" />
    </View> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' }, webView: { flex: 1, backgroundColor: '#FFFFFF' },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 24 },
  avatar: { width: 104, height: 104, borderRadius: 28 },
  logo: { position: 'absolute', bottom: 28, width: 112, height: 90 },
  title: { marginTop: 18, fontSize: 28, fontWeight: '600', color: '#202124' },
  subtitle: { marginTop: 6, fontSize: 14, color: '#777B83' },
  loading: { marginTop: 30, alignItems: 'center', gap: 12 }, loadingText: { fontSize: 14, color: '#777B83' },
  message: { marginTop: 28, maxWidth: 320, fontSize: 15, lineHeight: 22, textAlign: 'center', color: '#777B83' },
  retry: { marginTop: 24, minHeight: 48, minWidth: 156, borderRadius: 24, backgroundColor: '#354C3C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  retryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
