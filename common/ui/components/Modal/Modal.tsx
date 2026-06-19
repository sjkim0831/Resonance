/**
 * Modal - 테마 지원 공통 모달 컴포넌트
 */
import React, { ReactNode, useEffect, useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  closeOnEsc = true,
}) => {
  const { theme } = useTheme();

  const sizeMap = {
    sm: '400px',
    md: '500px',
    lg: '700px',
    xl: '900px',
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (closeOnEsc && e.key === 'Escape') {
      onClose();
    }
  }, [closeOnEsc, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease',
  };

  const modalStyle: React.CSSProperties = {
    background: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.lg,
    width: '90%',
    maxWidth: sizeMap[size],
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideIn 0.2s ease',
  };

  const headerStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.text,
    margin: 0,
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: theme.colors.textSecondary,
    padding: '0',
    lineHeight: 1,
  };

  const bodyStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    overflow: 'auto',
    flex: 1,
    color: theme.colors.text,
  };

  const footerStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
  };

  return (
    <div style={overlayStyle} onClick={closeOnOverlay ? onClose : undefined}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div style={headerStyle}>
            <h2 style={titleStyle}>{title}</h2>
            <button style={closeButtonStyle} onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        )}
        <div style={bodyStyle}>{children}</div>
        {footer && <div style={footerStyle}>{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
