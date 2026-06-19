/**
 * useTheme Hook - 테마 접근용 커스텀 훅
 */
import { useContext } from 'react';
import { ThemeContext } from '../providers/ThemeProvider';

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

/**
 * 특정 테마 색상 접근 Hook
 */
export const useThemeColor = (colorPath: string) => {
  const { theme } = useTheme();
  const keys = colorPath.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = theme;
  for (const key of keys) {
    value = value?.[key];
  }
  return value as string;
};

export default useTheme;
