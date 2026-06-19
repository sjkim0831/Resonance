/**
 * Table - 테마 지원 공통 테이블 컴포넌트
 */
import React, { TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, TheadHTMLAttributes, TrHTMLAttributes } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ striped = true, hoverable = true, bordered = true, style, children, ...props }, ref) => {
    const { theme } = useTheme();
    const { table: tableTheme } = theme.components;

    const tableStyle: React.CSSProperties = {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: theme.fonts.size.sm,
      fontFamily: theme.fonts.family,
      ...style,
    };

    return (
      <table ref={ref} style={tableStyle} {...props}>
        {children}
      </table>
    );
  }
);

Table.displayName = 'Table';

export const Thead = React.forwardRef<HTMLTableSectionElement, TheadHTMLAttributes<HTMLTableSectionElement>>(
  ({ style, children, ...props }, ref) => {
    const { theme } = useTheme();
    const { table: tableTheme } = theme.components;

    const theadStyle: React.CSSProperties = {
      background: tableTheme.headerBg,
      color: tableTheme.headerColor,
      fontWeight: theme.fonts.weight.bold,
      ...style,
    };

    return (
      <thead ref={ref} style={theadStyle} {...props}>
        {children}
      </thead>
    );
  }
);

Thead.displayName = 'Thead';

export const Tbody = React.forwardRef<HTMLTableSectionElement, TheadHTMLAttributes<HTMLTableSectionElement>>(
  ({ style, children, ...props }, ref) => {
    return (
      <tbody ref={ref} style={style} {...props}>
        {children}
      </tbody>
    );
  }
);

Tbody.displayName = 'Tbody';

export const Tr = React.forwardRef<HTMLTableRowElement, TrHTMLAttributes<HTMLTableRowElement>>(
  ({ style, children, ...props }, ref) => {
    const { theme } = useTheme();
    const { table: tableTheme } = theme.components;

    const trStyle: React.CSSProperties = {
      borderBottom: `1px solid ${tableTheme.border}`,
      background: tableTheme.rowBg,
      ...style,
    };

    return (
      <tr ref={ref} style={trStyle} {...props}>
        {children}
      </tr>
    );
  }
);

Tr.displayName = 'Tr';

export const Th = React.forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ style, children, ...props }, ref) => {
    const { theme } = useTheme();
    const { table: tableTheme } = theme.components;

    const thStyle: React.CSSProperties = {
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      textAlign: 'left',
      fontWeight: theme.fonts.weight.bold,
      ...style,
    };

    return (
      <th ref={ref} style={thStyle} {...props}>
        {children}
      </th>
    );
  }
);

Th.displayName = 'Th';

export const Td = React.forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ style, children, ...props }, ref) => {
    const { theme } = useTheme();

    const tdStyle: React.CSSProperties = {
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      color: theme.colors.text,
      ...style,
    };

    return (
      <td ref={ref} style={tdStyle} {...props}>
        {children}
      </td>
    );
  }
);

Td.displayName = 'Td';

export default Table;
