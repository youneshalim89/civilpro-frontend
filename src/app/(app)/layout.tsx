'use client';
// src/app/(app)/layout.tsx — Layout protégé (auth requise)
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarV2 } from '@/components/layout/sidebar-v2';
import { Header } from '@/components/layout/header';
import { useAuthStore, useUiStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuth = useAuthStore((s) => s.isAuth);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  useEffect(() => {
    // Attendre la fin de la réhydratation de la session persistée avant de
    // décider de rediriger : sinon un rechargement complet déconnecte à tort
    // un utilisateur ayant une session valide (isAuth vaut encore sa valeur
    // par défaut le temps que zustand/persist relise localStorage).
    if (hasHydrated && !isAuth) router.replace('/login');
  }, [hasHydrated, isAuth, router]);

  if (!hasHydrated || !isAuth) return null;

  return (
    <div className="flex min-h-screen">
      <SidebarV2 />
      <div className={cn(
        'flex-1 min-h-screen transition-all duration-200',
        sidebarOpen ? 'ml-[var(--sidebar-width)]' : 'ml-[76px]',
      )}>
        <Header />
        <main className="p-6 max-w-screen-2xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
