export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  success: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  onPrimary: string;
  shadow: string;
}

const lightTheme: ThemeColors = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3FF',
  border: '#D6DCE8',
  text: '#132238',
  textMuted: '#5F6F86',
  textSoft: '#8A95A8',
  primary: '#2D6BFF',
  primarySoft: '#E7F0FF',
  primaryBorder: '#A7C3FF',
  success: '#0F9D73',
  warning: '#C17A10',
  warningSoft: '#FFF4DA',
  danger: '#D14343',
  dangerSoft: '#FDE8E8',
  onPrimary: '#FFFFFF',
  shadow: 'rgba(18, 31, 54, 0.08)',
};

const darkTheme: ThemeColors = {
  background: '#0E1624',
  surface: '#162133',
  surfaceAlt: '#1B2A41',
  border: '#29384E',
  text: '#F4F7FB',
  textMuted: '#B5C0D4',
  textSoft: '#8C99AF',
  primary: '#75A7FF',
  primarySoft: '#243451',
  primaryBorder: '#4367A6',
  success: '#4FD2A6',
  warning: '#F3BC57',
  warningSoft: '#3B2E12',
  danger: '#FF7B7B',
  dangerSoft: '#3F1E26',
  onPrimary: '#0E1624',
  shadow: 'rgba(0, 0, 0, 0.28)',
};

export function getThemeColors(mode: 'light' | 'dark'): ThemeColors {
  return mode === 'dark' ? darkTheme : lightTheme;
}
