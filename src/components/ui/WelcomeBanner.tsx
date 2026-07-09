// src/components/ui/WelcomeBanner.tsx — Bandeau de bienvenue réutilisable
// (Dashboard Directeur V2, Phase 2) : salutation, date, météo (placeholder),
// actions rapides. Ne contient aucune logique métier — uniquement de la
// présentation, les actions sont des liens vers des pages existantes.
import { CloudSun } from 'lucide-react';
import Link from 'next/link';
import { Button } from './Button';

interface QuickAction {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface WelcomeBannerProps {
  name: string;
  dateLabel: string;
  actions?: QuickAction[];
}

export function WelcomeBanner({ name, dateLabel, actions = [] }: WelcomeBannerProps) {
  return (
    <div className="card p-6 bg-gradient-to-r from-brand-500 to-brand-600 text-white border-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bonjour {name} 👋</h1>
          <p className="text-brand-50 text-sm mt-1 capitalize">{dateLabel}</p>
          <div className="flex items-center gap-2 mt-2 text-brand-50 text-sm">
            <CloudSun className="w-4 h-4" />
            <span>22°C — Ensoleillé <span className="text-brand-100/70">(exemple)</span></span>
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Link key={a.href} href={a.href}>
                <Button variant="secondary" size="sm" icon={a.icon} className="!bg-white/15 !text-white !border-white/20 hover:!bg-white/25">
                  {a.label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
