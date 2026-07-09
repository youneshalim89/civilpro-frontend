// src/components/ui/Modal.tsx — Fenêtre modale réutilisable (même pattern que la modale existante de stock/page.tsx)
'use client';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const WIDTHS: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', '2xl': 'max-w-3xl',
};

export function Modal({ open, onClose, title, children, maxWidth = 'md' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={cn('bg-white rounded-2xl shadow-2xl w-full p-6', WIDTHS[maxWidth])}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Fermer">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
