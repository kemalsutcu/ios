import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F7F8F4',
    surface: '#FFFFFF',
    ink: '#15373E',
    secondary: '#52686C',
    muted: '#7C8B8B',
    line: '#E3E9E4',
    accent: '#087F8C',
    accentDark: '#086773',
    accentSoft: '#E4F2EE',
    user: '#E6F0EC',
    danger: '#B34242',
    dangerSoft: '#FFF0ED',
  },
  radius: { small: 14, medium: 22, large: 30 },
  shadow: Platform.select({
    ios: { shadowColor: '#203B32', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 16 },
    android: { elevation: 3 },
    default: {},
  }),
} as const;
