import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, StyleSheet, Text, useAnimatedValue, useWindowDimensions, View } from 'react-native';

/** Şahika's identity belongs to the app and remains visible above the live assistant. */
export default function SahikaIdentity({ onReady }: { onReady: () => void }) {
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const titleWidth = Math.min(272, width - 32);
  const titleHeight = compact ? 52 : 58;
  const avatarSize = compact ? 88 : 108;
  const [fontsLoaded, fontError] = useFonts({
    SahikaMouzambik: require('../../assets/fonts/mouzambik-inktrap-italic.ttf'),
  });
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);
  const gradientPhase = useAnimatedValue(0);
  const shimmerPhase = useAnimatedValue(0);

  useEffect(() => {
    if (fontsLoaded || fontError) onReady();
  }, [fontsLoaded, fontError, onReady]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => { /* The title remains readable when the system preference is unavailable. */ });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const state = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => { mounted = false; motion.remove(); state.remove(); };
  }, []);

  useEffect(() => {
    gradientPhase.setValue(0);
    shimmerPhase.setValue(0);
    if (!active || reduceMotion) return;
    const gradient = Animated.loop(Animated.timing(gradientPhase, {
      toValue: 1, duration: 6_000, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    const shimmer = Animated.loop(Animated.timing(shimmerPhase, {
      toValue: 1, duration: 2_800, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    gradient.start();
    shimmer.start();
    return () => { gradient.stop(); shimmer.stop(); };
  }, [active, reduceMotion, gradientPhase, shimmerPhase]);

  const titleStyle = [
    styles.title,
    { fontSize: compact ? 44 : 50, lineHeight: titleHeight },
    fontsLoaded ? styles.originalFont : styles.fallbackFont,
  ];

  return (
    <View style={styles.identity}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel="Şahika"
        style={{ width: titleWidth, height: titleHeight }}
      >
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
          <Animated.Text
            allowFontScaling={false}
            style={[titleStyle, styles.glow, { opacity: gradientPhase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.22, 0.42, 0.22] }) }]}
          >Şahika</Animated.Text>
          <MaskedView
            style={{ width: titleWidth, height: titleHeight }}
            maskElement={<View style={styles.mask}><Text allowFontScaling={false} style={titleStyle}>Şahika</Text></View>}
          >
            <Animated.View style={[styles.colorStrip, {
              width: titleWidth * 2,
              transform: [{ translateX: gradientPhase.interpolate({ inputRange: [0, 1], outputRange: [0, -titleWidth] }) }],
            }]}>
              <LinearGradient
                colors={['#7B22D3', '#2568ED', '#7B22D3', '#2568ED', '#7B22D3']}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            {!reduceMotion ? <Animated.View style={[styles.shimmer, {
              transform: [
                { translateX: shimmerPhase.interpolate({ inputRange: [0, 1], outputRange: [-72, titleWidth + 72] }) },
                { skewX: '-18deg' },
              ],
            }]}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.82)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View> : null}
          </MaskedView>
        </View>
      </View>
      <Text style={[styles.subtitle, compact && styles.subtitleCompact]} maxFontSizeMultiplier={1.2}>Yapay Zekâ Veteriner Asistanı</Text>
      <Image
        source={require('../../assets/sahika-avatar.png')}
        style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
        accessibilityLabel="Şahika’nın avatarı"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexShrink: 0, alignItems: 'center', backgroundColor: '#FFFFFF', paddingTop: 3, paddingBottom: 9, paddingHorizontal: 16 },
  title: { textAlign: 'center', color: '#000000', includeFontPadding: false },
  originalFont: { fontFamily: 'SahikaMouzambik', fontWeight: '400' },
  fallbackFont: { fontWeight: '700', fontStyle: 'italic' },
  glow: { position: 'absolute', width: '100%', color: '#6D42D9', textShadowColor: '#6664EF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  mask: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  colorStrip: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 64 },
  subtitle: { marginTop: -2, fontSize: 14, lineHeight: 19, fontStyle: 'italic', color: '#52565F', textAlign: 'center' },
  subtitleCompact: { fontSize: 13, lineHeight: 18 },
  avatar: { marginTop: 6 },
});
