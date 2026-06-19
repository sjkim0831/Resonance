/**
 * Theme System - 공통 UI 테마 타입 및 유틸
 */
import type { Theme } from './types';

// Import themes as modules
import defaultTheme from './default.json';
import darkTheme from './dark.json';
import corporateTheme from './corporate.json';
import minimalTheme from './minimal.json';

export type { Theme, ThemeColors, ThemeFonts, ThemeComponents } from './types';

// Export all themes
export const themes: Record<string, Theme> = {
  default: defaultTheme as Theme,
  dark: darkTheme as Theme,
  corporate: corporateTheme as Theme,
  minimal: minimalTheme as Theme,
};

// Default export
export { defaultTheme, darkTheme, corporateTheme, minimalTheme };

// Get theme by ID
export const getTheme = (themeId: string): Theme | null => {
  return themes[themeId] || null;
};
