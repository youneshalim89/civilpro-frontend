// src/components/ui/Tabs.tsx — Barre d'onglets réutilisable (navigation par lien, pas de contenu qui bascule)
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface TabItem {
  label: string;
  href: string;
  /** Force l'état actif indépendamment de la route courante (rare, cas particuliers). */
  active?: boolean;
}

interface TabsProps {
  items: TabItem[];
}

export function Tabs({ items }: TabsProps) {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200 overflow-x-auto">
      <nav className="flex gap-1 -mb-px min-w-max">
        {items.map((item) => {
          const hrefPath = item.href.split('?')[0];
          const active = item.active ?? (pathname === hrefPath || pathname.startsWith(hrefPath + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
