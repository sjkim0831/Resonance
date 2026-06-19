/**
 * Input - 테마 지원 공통 입력 컴포넌트
 */
import React, { InputHTMLAttributes, forwardRef } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, helperText, style, ...props }, ref) => {
    const { theme } = useTheme();
    const { input: inputTheme } = theme.components;

    const inputStyle: React.CSSProperties = {
      width: '100%',
      background: inputTheme.background,
      border: error 
        ? `1px solid ${theme.colors.error}` 
        : `1px solid ${inputTheme.border}`,
      color: inputTheme.color,
      borderRadius: inputTheme.borderRadius,
      padding: inputTheme.padding,
      fontSize: theme.fonts.size.base,
      fontFamily: theme.fonts.family,
      outline: 'none',
      transition: 'border-color 0.15s ease',
      ...style,
    };

    return (
      <div style={{ width: '100%' }}>
        <input
          ref={ref}
          style={inputStyle}
          onFocus: (e) => {
            e.target.style.borderColor = error 
              ? theme.colors.error 
              : inputTheme.focusBorder;
          }}
          onBlur: (e) => {
            e.target.style.borderColor = error 
              ? theme.colors.error 
              : inputTheme.border;
          }}
          {...props}
        />
        {helperText && (
          <p style={{ 
            color: error ? theme.colors.error : theme.colors.textSecondary,
            fontSize: theme.fonts.size.xs,
            marginTop: theme.spacing.xs,
          }}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ 
  style, 
  children, 
  ...props 
}) => {
  const { theme } = useTheme();

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    ...style,
  };

  return (
    <label style={labelStyle} {...props}>
      {children}
    </label>
  );
};

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ style, children, ...props }, ref) => {
    const { theme } = useTheme();
    const { input: inputTheme } = theme.components;

    const selectStyle: React.CSSProperties = {
      width: '100%',
      background: inputTheme.background,
      border: `1px solid ${inputTheme.border}`,
      color: inputTheme.color,
      borderRadius: inputTheme.borderRadius,
      padding: inputTheme.padding,
      fontSize: theme.fonts.size.base,
      fontFamily: theme.fonts.family,
      outline: 'none',
      cursor: 'pointer',
      ...style,
    };

    return (
      <select ref={ref} style={selectStyle} {...props}>
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

export default Input;
