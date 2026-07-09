// src/components/ui/StatCard.tsx — Carte statistique à bordure colorée (même pattern que dashboard/stock)
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatTone = 'green' | 'red' | 'blue' | 'orange' | 'yellow' | 'gray';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  description?: React.ReactNode;
}

const TONE_BORDER: Record<StatTone, string> = {
  green: 'border-green-400', red: 'border-red-400', blue: 'border-blue-400',
  orange: 'border-orange-400', yellow: 'border-yellow-400', gray: 'border-gray-300',
};
const TONE_TEXT: Record<StatTone, string> = {
  green: 'text-green-600', red: 'text-red-600', blue: 'text-blue-600',
  orange: 'text-orange-600', yellow: 'text-yellow-600', gray: 'text-gray-700',
};
const TONE_ICON: Record<StatTone, string> = {
  green: 'text-green-500', red: 'text-red-500', blue: 'text-blue-500',
  orange: 'text-orange-500', yellow: 'text-yellow-500', gray: 'text-gray-400',
};

export function StatCard({ label, value, icon: Icon, tone = 'gray', description }: StatCardProps) {
  return (
    <div className={cn('card p-5 border-l-4', TONE_BORDER[tone])}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        {Icon && <Icon className={cn('w-4 h-4', TONE_ICON[tone])} />}
      </div>
      <p className={cn('text-2xl font-bold mt-2', TONE_TEXT[tone])}>{value}</p>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  );
}
