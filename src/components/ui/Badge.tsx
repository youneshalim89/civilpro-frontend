// src/components/ui/Badge.tsx — Étiquette de statut/niveau réutilisable (enveloppe .badge existant)
import { cn } from '@/lib/utils';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'brand';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
  gray:    'bg-gray-100 text-gray-700',
  brand:   'bg-brand-100 text-brand-700',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'gray', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('badge', TONE_CLASSES[tone], className)} {...props}>
      {children}
    </span>
  );
}
