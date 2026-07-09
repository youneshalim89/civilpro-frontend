// src/components/ui/KpiCard.tsx — Carte KPI réutilisable (même pattern que dashboard/page.tsx)
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: LucideIcon;
  color?: string; // classe Tailwind bg-*, ex. 'bg-blue-500'
}

export function KpiCard({ label, value, sub, icon: Icon, color = 'bg-brand-500' }: KpiCardProps) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-0.5 leading-tight break-words">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
