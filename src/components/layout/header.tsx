// src/components/layout/header.tsx — Header professionnel CivilPro V2 (Phase 1, non branché)
//
// Recherche globale (UI seule pour l'instant, non connectée à une recherche
// backend réelle), cloche Notifications, icône Centre d'alertes (toutes deux
// avec badge de comptage réutilisant les endpoints déjà en production :
// GET /api/notifications et GET /api/alertes/summary), et menu utilisateur
// (profil + déconnexion).
//
// Non encore importé dans (app)/layout.tsx : composant préparé pour
// validation avant branchement, conformément à la Phase 1.
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Bell, AlertTriangle, ChevronDown, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import { authService } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string) =>
  fetch(`${API}/api${url}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => r.json());

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: notifData } = useQuery({
    queryKey: ['header-notifications'],
    queryFn: () => apiFetch('/notifications'),
    refetchInterval: 30000,
  });

  const { data: alertesSummary } = useQuery({
    queryKey: ['alertes-summary'],
    queryFn: () => apiFetch('/alertes/summary').then((r) => r.data),
    refetchInterval: 30000,
  });

  const nonLues = notifData?.non_lues || 0;
  const alertesActives = alertesSummary?.total_actives ? parseInt(alertesSummary.total_actives, 10) : 0;

  const handleLogout = async () => {
    try { await authService.logout(); } catch (_) { /* déconnexion locale malgré tout */ }
    logout();
    router.push('/login');
    toast.success('Déconnexion réussie');
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
      {/* Recherche globale */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un marché, une facture..."
          className="input pl-9 bg-gray-50 border-transparent focus:bg-white"
        />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {/* Centre d'alertes */}
        <Link href="/alertes" className="relative p-2.5 rounded-lg hover:bg-gray-100 transition-colors" title="Centre d'alertes">
          <AlertTriangle className="w-5 h-5 text-gray-500" />
          {alertesActives > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
              {alertesActives}
            </span>
          )}
        </Link>

        {/* Notifications */}
        <Link href="/notifications" className="relative p-2.5 rounded-lg hover:bg-gray-100 transition-colors" title="Notifications">
          <Bell className="w-5 h-5 text-gray-500" />
          {nonLues > 0 && (
            <span className="absolute top-1 right-1 bg-brand-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
              {nonLues}
            </span>
          )}
        </Link>

        {/* Profil / menu utilisateur */}
        <div className="relative ml-1">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-brand-700 text-xs font-bold">
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-800 leading-tight">{user?.prenom} {user?.nom}</p>
              <p className="text-xs text-gray-400 leading-tight">{user?.role}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
                <Link
                  href="/parametres"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" /> Paramètres
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Déconnexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
