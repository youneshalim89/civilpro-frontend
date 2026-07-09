// src/components/ui/Table.tsx — Tableau générique réutilisable (enveloppe .table-header/.table-cell existants)
import { cn } from '@/lib/utils';

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  footer?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
}

export function Table<T>({ columns, data, rowKey, loading, emptyMessage = 'Aucune donnée', onRowClick, footer, rowClassName }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            {columns.map(c => (
              <th key={c.key} className={cn('table-header', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <tr key={`skeleton-${i}`}>
              {columns.map(c => (
                <td key={c.key} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
              ))}
            </tr>
          ))}
          {!loading && data.map(row => (
            <tr key={rowKey(row)} onClick={() => onRowClick?.(row)}
              className={cn('hover:bg-gray-50', onRowClick && 'cursor-pointer', rowClassName?.(row))}>
              {columns.map(c => (
                <td key={c.key} className={cn('table-cell', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {!loading && !data.length && (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">{emptyMessage}</td></tr>
          )}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}
