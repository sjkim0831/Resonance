/**
 * ThemeProvider - React Context for Theme Management
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Theme, getTheme } from '../themes';

interface ThemeContextValue {
  theme: Theme;
  themeId: string;
  setTheme: (themeId: string) => void;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const AVAILABLE_THEMES = ['default', 'dark', 'corporate', 'minimal'];

export const ThemeProvider: React.FC<{ children: ReactNode; defaultTheme?: string }> = ({
  children,
  defaultTheme = 'default'
}) => {
  const [themeId, setThemeId] = useState<string>(defaultTheme);
  const [theme, setTheme] = useState<Theme>(() => getTheme(defaultTheme) || getTheme('default')!);

  const handleSetTheme = useCallback((newThemeId: string) => {
    const newTheme = getTheme(newThemeId);
    if (newTheme) {
      setThemeId(newThemeId);
      setTheme(newTheme);
      // localStorage에 저장
      localStorage.setItem('app-theme', newThemeId);
      // CSS 변수 업데이트
      applyThemeToCSS(newTheme);
    }
  }, []);

  // 초기 테마 로드
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme && getTheme(savedTheme)) {
      handleSetTheme(savedTheme);
    }
  }, [handleSetTheme]);

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        themeId, 
        setTheme: handleSetTheme, 
        availableThemes: AVAILABLE_THEMES 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// CSS 변수에 테마 적용
const applyThemeToCSS = (theme: Theme) => {
  const root = document.documentElement;
  
  // Colors
  root.style.setProperty('--theme-primary', theme.colors.primary);
  root.style.setProperty('--theme-secondary', theme.colors.secondary);
  root.style.setProperty('--theme-accent', theme.colors.accent);
  root.style.setProperty('--theme-background', theme.colors.background);
  root.style.setProperty('--theme-surface', theme.colors.surface);
  root.style.setProperty('--theme-text', theme.colors.text);
  root.style.setProperty('--theme-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--theme-border', theme.colors.border);
  root.style.setProperty('--theme-error', theme.colors.error);
  root.style.setProperty('--theme-warning', theme.colors.warning);
  root.style.setProperty('--theme-success', theme.colors.success);
  
  // Spacing
  root.style.setProperty('--theme-spacing-xs', theme.spacing.xs);
  root.style.setProperty('--theme-spacing-sm', theme.spacing.sm);
  root.style.setProperty('--theme-spacing-md', theme.spacing.md);
  root.style.setProperty('--theme-spacing-lg', theme.spacing.lg);
  root.style.setProperty('--theme-spacing-xl', theme.spacing.xl);
  
  // Border Radius
  root.style.setProperty('--theme-radius-sm', theme.borderRadius.sm);
  root.style.setProperty('--theme-radius-md', theme.borderRadius.md);
  root.style.setProperty('--theme-radius-lg', theme.borderRadius.lg);
  
  // Shadows
  root.style.setProperty('--theme-shadow-sm', theme.shadows.sm);
  root.style.setProperty('--theme-shadow-md', theme.shadows.md);
  root.style.setProperty('--theme-shadow-lg', theme.shadows.lg);
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export default ThemeProvider;
