/**
 * Button - 테마 지원 공통 버튼 컴포넌트
 */
import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { useTheme } from '../../hooks/useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    fullWidth = false,
    loading = false,
    disabled,
    style,
    ...props 
  }, ref) => {
    const { theme } = useTheme();
    const { button: buttonTheme } = theme.components;

    const sizeStyles = {
      sm: { padding: '0.375rem 0.75rem', fontSize: theme.fonts.size.sm },
      md: { padding: buttonTheme.padding, fontSize: buttonTheme.fontSize },
      lg: { padding: '0.625rem 1.25rem', fontSize: theme.fonts.size.lg },
    };

    const variantStyles = {
      primary: {
        background: buttonTheme.primaryBg,
        color: buttonTheme.primaryColor,
        border: 'none',
      },
      secondary: {
        background: buttonTheme.secondaryBg,
        color: buttonTheme.secondaryColor,
        border: `1px solid ${theme.colors.border}`,
      },
      outline: {
        background: 'transparent',
        color: theme.colors.primary,
        border: `1px solid ${theme.colors.primary}`,
      },
      ghost: {
        background: 'transparent',
        color: theme.colors.text,
        border: 'none',
      },
    };

    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      fontWeight: theme.fonts.weight.medium,
      borderRadius: buttonTheme.borderRadius,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.15s ease',
      width: fullWidth ? '100%' : 'auto',
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style,
    };

    return (
      <button
        ref={ref}
        style={baseStyle}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg 
            className="animate-spin" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
              strokeOpacity="0.25"
            />
            <path 
              d="M12 2a10 10 0 0 1 10 10" 
              stroke="currentColor" 
              strokeWidth="4" 
              strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
