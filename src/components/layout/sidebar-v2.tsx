// src/components/layout/sidebar-v2.tsx — Sidebar CivilPro V2 (Chantier UI-1 : sections dépliables)
//
// Structure validée : Tableau de bord (racine) puis 3 sections — GESTION
// (Marchés + sous-menu Commandes/Situations/Factures, Finance et
// IA grisés "Bientôt", Parc Matériel, Stock, Documents), INTELLIGENCE
// (IA CivilPro), ADMINISTRATION (Alertes, Notifications). Les anciens liens
// Chantier/Utilisateurs/Paramètres ont été retirés : aucune page réelle ne
// leur correspond (vérifié en direct, 404 confirmé sur les 3 routes).
// Chantier Fusion-3 : entrée "Projets" retirée de la navigation — le marché
// est désormais le seul concept visible, /api/projets reste consommé en
// interne (TresorerieService, création auto du projet "coquille").
//
// Un groupe (ex. "Marchés") s'auto-déplie dès que la route active lui
// correspond ou correspond à l'un de ses enfants sémantiques, sans jamais
// écraser un dépliage manuel de l'utilisateur. En mode réduit (icônes
// seules), les groupes redeviennent des liens simples vers leur page
// principale — pas de flyout au survol.
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, FileText, ShoppingCart, Receipt, BarChart3,
  Package, FolderOpen, Users, Bell, Settings, LogOut,
  Building2, ChevronRight, ChevronLeft, ChevronDown, AlertTriangle,
  Truck, Sparkles, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, useUiStore } from '@/lib/store';
import { authService } from '@/lib/api';
import toast from 'react-hot-toast';

type IconType = typeof LayoutDashboard;

type NavLink   = { kind: 'link';     label: string; href: string; icon: IconType; roles?: string[] };
type NavGroup  = { kind: 'group';    label: string; href: string; icon: IconType; children: NavLink[] };
type NavSoon   = { kind: 'soon';     label: string; icon: IconType };
type NavEntry  = NavLink | NavGroup | NavSoon;
type NavSection = { title: string; items: NavEntry[] };

const ROOT_ITEM: NavLink = { kind: 'link', label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard };

const SECTIONS: NavSection[] = [
  {
    title: 'Gestion',
    items: [
      {
        kind: 'group', label: 'Marchés', href: '/marches', icon: FileText,
        children: [
          { kind: 'link', label: 'Commandes',  href: '/commandes',  icon: ShoppingCart },
          { kind: 'link', label: 'Situations', href: '/situations', icon: BarChart3 },
          { kind: 'link', label: 'Factures',   href: '/factures',   icon: Receipt },
        ],
      },
      { kind: 'soon',  label: 'Finance',                             icon: Wallet },
      { kind: 'link',  label: 'Parc Matériel', href: '/parc-materiel', icon: Truck },
      { kind: 'link',  label: 'Stock',         href: '/stock',        icon: Package },
      { kind: 'link',  label: 'Documents',     href: '/documents',    icon: FolderOpen },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { kind: 'soon', label: 'IA CivilPro', icon: Sparkles },
    ],
  },
  {
    title: 'Administration',
    items: [
      { kind: 'link', label: 'Alertes',       href: '/alertes',       icon: AlertTriangle },
      { kind: 'link', label: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');

// Un groupe est "actif" si la route courante correspond à lui-même ou à
// l'un de ses enfants sémantiques (Commandes/Situations/Factures ne sont
// pas des sous-chemins d'URL de /marches, mais en font partie logiquement).
function isGroupActive(group: NavGroup, pathname: string): boolean {
  const hrefs = [group.href, ...group.children.map((c) => c.href)];
  return hrefs.some((h) => pathname === h || pathname.startsWith(h + '/'));
}

export function SidebarV2() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const collapsed = !sidebarOpen;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Auto-ouverture sémantique : n'ouvre jamais un groupe fermé manuellement
  // par erreur au premier rendu, se contente d'ajouter les groupes actifs
  // à l'ensemble déjà ouvert (ne referme jamais rien automatiquement).
  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const section of SECTIONS) {
        for (const item of section.items) {
          if (item.kind === 'group' && isGroupActive(item, pathname) && !next[item.label]) {
            next[item.label] = true;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [pathname]);

  const { data: alertesSummary } = useQuery({
    queryKey: ['alertes-summary'],
    queryFn: () => fetch(`${API}/api/alertes/summary`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json()).then((r) => r.data),
    refetchInterval: 30000,
  });
  const alertesActives = alertesSummary?.total_actives ? parseInt(alertesSummary.total_actives, 10) : 0;
  const BADGES: Record<string, number> = { '/alertes': alertesActives };

  const handleLogout = async () => {
    try { await authService.logout(); } catch (_) { /* déconnexion locale malgré tout */ }
    logout();
    router.push('/login');
    toast.success('Déconnexion réussie');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const LinkRow = ({ item, badge, sub }: { item: NavLink; badge?: number; sub?: boolean }) => {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg text-sm font-medium transition-all group',
          sub ? 'py-1.5 pl-11 pr-3' : 'px-3 py-2',
          collapsed && !sub && 'justify-center px-2',
          active
            ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
            : 'text-gray-400 hover:bg-white/5 hover:text-white',
        )}
      >
        {!sub && <item.icon className={cn('w-5 h-5 flex-shrink-0', active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300')} />}
        {(!collapsed || sub) && <span className={sub ? 'truncate' : undefined}>{item.label}</span>}
        {!collapsed && !!badge && badge > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const GroupRow = ({ item }: { item: NavGroup }) => {
    const active = isGroupActive(item, pathname);
    const open = collapsed ? false : !!openGroups[item.label];

    // Mode réduit : le groupe redevient un lien simple vers sa page principale,
    // pas de flyout au survol (comportement validé).
    if (collapsed) {
      return <LinkRow item={{ kind: 'link', label: item.label, href: item.href, icon: item.icon }} />;
    }

    return (
      <div>
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group cursor-pointer',
            active && !open ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white',
          )}
        >
          <Link href={item.href} className="flex items-center gap-3 flex-1 min-w-0">
            <item.icon className={cn('w-5 h-5 flex-shrink-0', active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300')} />
            <span className="truncate">{item.label}</span>
          </Link>
          <button
            type="button"
            aria-label={open ? `Replier ${item.label}` : `Déplier ${item.label}`}
            onClick={() => setOpenGroups((g) => ({ ...g, [item.label]: !g[item.label] }))}
            className="p-1 -mr-1 rounded hover:bg-white/10 flex-shrink-0"
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
        {open && (
          <div className="mt-0.5 space-y-0.5">
            {item.children.map((child) => <LinkRow key={child.href} item={child} sub />)}
          </div>
        )}
      </div>
    );
  };

  const SoonRow = ({ item }: { item: NavSoon }) => (
    <div
      title={collapsed ? `${item.label} — Bientôt` : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 cursor-not-allowed select-none',
        collapsed && 'justify-center px-2',
      )}
    >
      <item.icon className="w-5 h-5 flex-shrink-0 text-gray-600" />
      {!collapsed && (
        <>
          <span>{item.label}</span>
          <span className="ml-auto bg-white/5 text-gray-500 text-[9px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5">
            Bientôt
          </span>
        </>
      )}
    </div>
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-sidebar flex flex-col z-40 border-r border-white/5 transition-all duration-200',
        collapsed ? 'w-[76px]' : 'w-[var(--sidebar-width)]',
      )}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/5 flex-shrink-0">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-white font-bold text-sm leading-tight">CivilPro</p>
              <p className="text-brand-400 text-xs">Golden Leader</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation (défile indépendamment si le contenu dépasse la hauteur disponible) */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto min-h-0">
        <LinkRow item={ROOT_ITEM} />

        {SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 mb-1.5 mt-3 pt-3 border-t border-white/5">
                {section.title}
              </p>
            )}
            {collapsed && <div className="my-2 border-t border-white/5" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                if (item.kind === 'group') return <GroupRow key={item.label} item={item} />;
                if (item.kind === 'soon')  return <SoonRow key={item.label} item={item} />;
                return <LinkRow key={item.href} item={item} badge={BADGES[item.href]} />;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Réduction / agrandissement (responsive tablette) */}
      <button
        onClick={() => toggleSidebar()}
        className="mx-3 mb-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-gray-500 hover:bg-white/5 hover:text-gray-300 text-xs transition-colors flex-shrink-0"
        title={collapsed ? 'Agrandir' : 'Réduire'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /> Réduire</>}
      </button>

      {/* Profil utilisateur */}
      <div className="px-3 py-3 border-t border-white/5 flex-shrink-0">
        <div className={cn('flex items-center gap-3 px-2 mb-1.5', collapsed && 'justify-center')}>
          <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-brand-400 text-xs font-bold">
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.prenom} {user?.nom}</p>
              <p className="text-gray-500 text-xs truncate">{user?.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Déconnexion' : undefined}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 text-sm transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && 'Déconnexion'}
        </button>
      </div>
    </aside>
  );
}
