/**
 * Theme Types
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  dark?: {
    background: string;
    surface: string;
    text: string;
    border: string;
  };
}

export interface ThemeFonts {
  family: string;
  size: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  weight: {
    normal: number;
    medium: number;
    bold: number;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeBorderRadius {
  sm: string;
  md: string;
  lg: string;
  full: string;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  none: string;
}

export interface ThemeComponents {
  button: ButtonTheme;
  input: InputTheme;
  table: TableTheme;
  card: CardTheme;
}

export interface ButtonTheme {
  primaryBg: string;
  primaryColor: string;
  secondaryBg: string;
  secondaryColor: string;
  borderRadius: string;
  padding: string;
  fontSize: string;
}

export interface InputTheme {
  background: string;
  border: string;
  color: string;
  focusBorder: string;
  borderRadius: string;
  padding: string;
}

export interface TableTheme {
  headerBg: string;
  headerColor: string;
  rowBg: string;
  rowAltBg: string;
  border: string;
  hoverBg: string;
}

export interface CardTheme {
  background: string;
  border: string;
  borderRadius: string;
  padding: string;
  shadow: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  components: ThemeComponents;
}
