'use client';
// src/components/layout/sidebar.tsx — Navigation principale
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, FileText, ShoppingCart, Receipt, BarChart3,
  Package, FolderOpen, HardHat, Users, Bell, Settings, LogOut,
  Building2, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { authService } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Tableau de bord', href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Marchés',         href: '/marches',     icon: FileText },
  { label: 'Commandes',       href: '/commandes',   icon: ShoppingCart },
  { label: 'Facturation',     href: '/factures',    icon: Receipt },
  { label: 'Situations',      href: '/situations',  icon: BarChart3 },
  { label: 'Stock',           href: '/stock',       icon: Package },
  { label: 'Documents',       href: '/documents',   icon: FolderOpen },
  { label: 'Chantier',        href: '/chantier',    icon: HardHat },
];

const SECONDARY_ITEMS = [
  { label: 'Alertes',         href: '/alertes',      icon: AlertTriangle },
  { label: 'Utilisateurs',    href: '/utilisateurs', icon: Users,    roles: ['admin','directeur'] },
  { label: 'Notifications',   href: '/notifications',icon: Bell },
  { label: 'Paramètres',      href: '/parametres',   icon: Settings },
];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '';

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();

  const { data: alertesSummary } = useQuery({
    queryKey: ['alertes-summary'],
    queryFn: () => fetch(`${API}/api/alertes/summary`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(r => r.data),
    refetchInterval: 30000,
  });
  const alertesActives = alertesSummary?.total_actives ? parseInt(alertesSummary.total_actives, 10) : 0;
  const BADGES: Record<string, number> = { '/alertes': alertesActives };

  const handleLogout = async () => {
    try { await authService.logout(); } catch (_) {}
    logout();
    router.push('/login');
    toast.success('Déconnexion réussie');
  };

  const NavLink = ({ item, badge }: { item: typeof NAV_ITEMS[number]; badge?: number }) => {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
          active
            ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
            : 'text-gray-400 hover:bg-white/5 hover:text-white',
        )}>
        <item.icon className={cn('w-5 h-5 flex-shrink-0', active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300')} />
        <span>{item.label}</span>
        {!!badge && badge > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {badge}
          </span>
        )}
        {active && !badge && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[var(--sidebar-width)] bg-sidebar flex flex-col z-40 border-r border-white/5">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">CivilPro</p>
            <p className="text-brand-400 text-xs">Golden Leader</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 mb-2">Principal</p>
        {NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}

        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 mt-5 mb-2 pt-4 border-t border-white/5">
          Administration
        </p>
        {SECONDARY_ITEMS.map((item) => <NavLink key={item.href} item={item as any} badge={BADGES[item.href]} />)}
      </nav>

      {/* Profil utilisateur */}
      <div className="px-3 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-brand-400 text-xs font-bold">
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.prenom} {user?.nom}</p>
            <p className="text-gray-500 text-xs truncate">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 text-sm transition-colors">
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
