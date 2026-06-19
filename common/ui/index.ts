/**
 * Common UI Module - 공통 UI 컴포넌트 & 테마 시스템
 * 
 * 사용법:
 * import { Button, Card, Modal, useTheme, ThemeProvider } from '@resonance/common/ui';
 */

export { Button } from './components/Button';
export { Card, CardHeader, CardBody, CardFooter } from './components/Card';
export { Modal } from './components/Modal';
export { Table, Thead, Tbody, Tr, Th, Td } from './components/Table';
export { Input, Label, Select } from './components/Form';

// Theme exports
export { ThemeProvider, useTheme } from './providers/ThemeProvider';

// Theme types
export type { Theme, ThemeColors, ThemeFonts } from './themes';

// Re-export themes
import defaultTheme from './themes/default.json';
import darkTheme from './themes/dark.json';
import corporateTheme from './themes/corporate.json';
import minimalTheme from './themes/minimal.json';

export const themes = {
  default: defaultTheme,
  dark: darkTheme,
  corporate: corporateTheme,
  minimal: minimalTheme,
} as const;

export type ThemeId = keyof typeof themes;
