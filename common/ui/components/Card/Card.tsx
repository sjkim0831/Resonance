/**
 * Card - 테마 지원 공통 카드 컴포넌트
 */
import React, { HTMLAttributes, forwardRef } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', style, children, ...props }, ref) => {
    const { theme } = useTheme();
    const { card: cardTheme } = theme.components;

    const paddingMap = {
      none: '0',
      sm: theme.spacing.sm,
      md: cardTheme.padding,
      lg: theme.spacing.lg,
    };

    const variantStyles = {
      default: {
        background: cardTheme.background,
        border: `1px solid ${cardTheme.border}`,
        borderRadius: cardTheme.borderRadius,
        boxShadow: cardTheme.shadow,
      },
      outlined: {
        background: cardTheme.background,
        border: `1px solid ${cardTheme.border}`,
        borderRadius: cardTheme.borderRadius,
        boxShadow: 'none',
      },
      elevated: {
        background: cardTheme.background,
        border: 'none',
        borderRadius: cardTheme.borderRadius,
        boxShadow: theme.shadows.md,
      },
    };

    const cardStyle: React.CSSProperties = {
      padding: paddingMap[padding],
      ...variantStyles[variant],
      ...style,
    };

    return (
      <div ref={ref} style={cardStyle} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => {
  const { theme } = useTheme();

  const headerStyle: React.CSSProperties = {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
    ...style,
  };

  return (
    <div style={headerStyle} {...props}>
      {children}
    </div>
  );
};

export const CardBody: React.FC<HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => {
  const { theme } = useTheme();

  const bodyStyle: React.CSSProperties = {
    color: theme.colors.textSecondary,
    ...style,
  };

  return (
    <div style={bodyStyle} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => {
  const { theme } = useTheme();

  const footerStyle: React.CSSProperties = {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
    ...style,
  };

  return (
    <div style={footerStyle} {...props}>
      {children}
    </div>
  );
};

export default Card;
