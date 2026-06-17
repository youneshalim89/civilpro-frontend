'use client';
// src/app/(app)/layout.tsx — Layout protégé (auth requise)
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/lib/store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuth = useAuthStore((s) => s.isAuth);

  useEffect(() => {
    if (!isAuth) router.replace('/login');
  }, [isAuth, router]);

  if (!isAuth) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[var(--sidebar-width)] min-h-screen">
        <div className="p-6 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
