import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import SahikaIdentity from './SahikaIdentity';
import {
  buildAppBootstrapScript,
  buildAppTransitionScript,
  externalDestination,
  isSahikaPageUrl,
  parseBridgeMessage,
  SAHIKA_PAGE_URL,
} from '../lib/wixAppBridge';

const BOOTSTRAP = buildAppBootstrapScript();
const LOAD_TIMEOUT_MS = 60_000;

/** The original PulseVet page owns Şahika's interface, assets, CMS configuration and voice engine. */
export default function SahikaScreen() {
  const webView = useRef<WebView>(null);
  const mounted = useRef(true);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [generation, setGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const externalBusy = useRef(false);
  const lastExternal = useRef({ url: '', time: 0 });
  const exportBusy = useRef(false);
  const exportedIds = useRef(new Set<string>());

  const stopCapture = useCallback(() => {
    webView.current?.injectJavaScript(buildAppTransitionScript('unmount'));
  }, []);

  const fail = useCallback((message: string) => {
    clearTimeout(timeout.current);
    stopCapture();
    if (mounted.current) { setReady(false); setFailure(message); }
  }, [stopCapture]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' || state === 'inactive' || state === 'background') {
        webView.current?.injectJavaScript(buildAppTransitionScript(state));
      }
    });
    return () => {
      mounted.current = false;
      clearTimeout(timeout.current);
      subscription.remove();
      stopCapture();
    };
  }, [stopCapture]);

  useEffect(() => {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => fail('Şahika şu anda yüklenemedi. İnternet bağlantını kontrol edip yeniden dene.'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout.current);
  }, [generation, fail]);

  const openExternal = useCallback(async (value: string) => {
    const url = externalDestination(value);
    const now = Date.now();
    if (!url || externalBusy.current || (lastExternal.current.url === url && now - lastExternal.current.time < 1500)) return;
    externalBusy.current = true;
    lastExternal.current = { url, time: now };
    try { await Linking.openURL(url); }
    catch { if (mounted.current) Alert.alert('Bağlantı açılamadı', 'Gerekli uygulamanın iPhone’unda kurulu olduğunu kontrol et.'); }
    finally { externalBusy.current = false; }
  }, []);

  const shareDownload = useCallback(async (message: Extract<NonNullable<ReturnType<typeof parseBridgeMessage>>, { type: 'SAHIKA_APP_DOWNLOAD' }>) => {
    if (exportBusy.current || exportedIds.current.has(message.id)) return;
    exportBusy.current = true;
    exportedIds.current.add(message.id);
    if (exportedIds.current.size > 64) exportedIds.current.delete(exportedIds.current.values().next().value!);
    let directory: Directory | undefined;
    try {
      if (!await Sharing.isAvailableAsync() || !mounted.current) return;
      directory = new Directory(Paths.cache, `sahika-export-${message.id}`);
      directory.create();
      const file = new File(directory, message.filename);
      file.create(); file.write(message.text);
      if (file.size !== message.size) throw new Error('incomplete');
      await Sharing.shareAsync(file.uri, { mimeType: message.mime, dialogTitle: 'Şahika konuşmasını kaydet veya paylaş' });
    } catch {
      if (mounted.current) Alert.alert('Dosya paylaşılamadı', 'Konuşma dökümünü yeniden indirip tekrar dene.');
    } finally {
      try { if (directory?.exists) directory.delete(); } catch { /* OS cache cleanup remains a fallback. */ }
      exportBusy.current = false;
    }
  }, []);

  const receiveMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseBridgeMessage(event.nativeEvent.data, event.nativeEvent.url);
    if (!message || !mounted.current) return;
    if (message.type === 'SAHIKA_APP_READY') {
      clearTimeout(timeout.current);
      setReady(true); setFailure(null);
      if (AppState.currentState !== 'active') webView.current?.injectJavaScript(buildAppTransitionScript('background'));
    } else if (message.type === 'SAHIKA_APP_EXTERNAL') { void openExternal(message.url); }
    else { void shareDownload(message); }
  }, [openExternal, shareDownload]);

  const retry = () => {
    stopCapture();
    setReady(false); setFailure(null); setGeneration(value => value + 1);
  };
  const identityDidLoad = useCallback(() => setIdentityReady(true), []);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <SahikaIdentity onReady={identityDidLoad} />
      <View style={styles.conversation}>
      {!failure ? <WebView
        key={generation}
        ref={webView}
        source={{ uri: SAHIKA_PAGE_URL }}
        style={styles.webView}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={request => {
          if (request.isTopFrame === false) return request.url === 'about:blank' || request.url.startsWith('https://');
          if (isSahikaPageUrl(request.url)) return true;
          if (request.navigationType === 'click') void openExternal(request.url);
          return false;
        }}
        onNavigationStateChange={state => {
          if (!isSahikaPageUrl(state.url)) {
            webView.current?.stopLoading();
            fail('Şahika sayfasına güvenli bağlantı kurulamadı. Yeniden dene.');
          }
        }}
        onMessage={receiveMessage}
        onOpenWindow={() => { /* Only links authorized by the trusted-gesture bridge leave this screen. */ }}
        onError={() => fail('Şahika’ya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.')}
        onHttpError={({ nativeEvent }) => {
          if (isSahikaPageUrl(nativeEvent.url) && nativeEvent.statusCode >= 400) fail('Şahika şu anda yanıt vermiyor. Biraz sonra yeniden dene.');
        }}
        onContentProcessDidTerminate={() => fail('Görüşme ekranı kapandı. Şahika’yı yeniden açabilirsin.')}
        onRenderProcessGone={() => fail('Görüşme ekranı kapandı. Şahika’yı yeniden açabilirsin.')}
        injectedJavaScriptBeforeContentLoaded={BOOTSTRAP}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        injectedJavaScript={BOOTSTRAP}
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
        webviewDebuggingEnabled={false}
        contentInsetAdjustmentBehavior="never"
        allowsBackForwardNavigationGestures={false}
        bounces={false}
      /> : null}
      {!ready || !identityReady || failure ? <View style={styles.cover} accessibilityLiveRegion="polite">
        <View style={styles.coverContent}>
          {failure ? <>
            <Text style={styles.message}>{failure}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Şahika’yı yeniden yükle" onPress={retry} style={styles.retry}>
              <Text style={styles.retryText}>Yeniden dene</Text>
            </Pressable>
          </> : <View style={styles.loading}>
            <ActivityIndicator color="#243434" />
            <Text style={styles.loadingText}>Şahika hazırlanıyor…</Text>
          </View>}
        </View>
        <Image
          source={require('../../assets/pulsevet-logo.png')}
          style={styles.clinicLogo}
          resizeMode="contain"
          accessibilityLabel="PulseVet Veteriner Kliniği, Acıbadem"
        />
      </View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  conversation: { flex: 1, minHeight: 0 },
  webView: { flex: 1, backgroundColor: '#FFFFFF' },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', backgroundColor: '#FFFFFF', padding: 24 },
  coverContent: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  clinicLogo: { width: 82, height: 114, marginTop: 20 },
  loading: { marginTop: 32, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#526464' },
  message: { marginTop: 28, maxWidth: 320, fontSize: 15, lineHeight: 22, textAlign: 'center', color: '#526464' },
  retry: { marginTop: 24, minHeight: 48, minWidth: 156, borderRadius: 24, backgroundColor: '#172020', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  retryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
