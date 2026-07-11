// src/app/(app)/dashboard/page.tsx — Dashboard Directeur V2.1
//
// Refonte selon la maquette validée (Chantier Dashboard-V2.1) : en-tête,
// KPI (Projets/Marchés/Engins/Alertes), Alertes + Activité récente,
// tableau Projets en cours. Construit uniquement avec des endpoints déjà
// existants (aucune logique métier ajoutée côté backend) :
//   - GET /api/projets?statut=en_cours
//   - GET /api/marches/dashboard
//   - GET /api/stock/engins
//   - GET /api/alertes/summary, GET /api/alertes
//   - GET /api/notifications
//
// KPI "Trésorerie" (Chantier Finance-F) : seul KPI financier, ajouté une
// fois les chantiers Finance A→F terminés — alimenté par GET
// /api/finance/tresorerie, qui consomme TresorerieService.computeTresorerie(),
// la même fonction que /projets/[id] (pas de calcul parallèle). Réservé aux
// rôles comptable et au-dessus (donnée financière globale sensible), comme
// la route backend elle-même. Le panneau IA reviendra avec le module IA.
'use client';
import { useQuery } from '@tanstack/react-query';
import { FileText, Truck, AlertTriangle, FolderKanban, Bell, Wallet } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { fmt } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { Card, CardHeader, KpiCard, Badge, EmptyState, Loading, Table } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';

const PEUT_VOIR_TRESORERIE = ['admin', 'directeur', 'chef_projet', 'ingenieur', 'comptable'];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string) =>
  fetch(`${API}/api${url}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => r.json());

type Projet = {
  id: string; code_projet: string; nom: string; statut: string;
  budget_total: number; avancement_global: number;
};
type Alerte = {
  id: string; niveau: 'info' | 'warning' | 'critique';
  titre: string; message: string | null; created_at: string;
};
type Notification = { id: string; titre?: string; message: string; created_at: string };

const NIVEAU_COLOR: Record<string, string> = {
  info:     'bg-blue-100 text-blue-700',
  warning:  'bg-yellow-100 text-yellow-700',
  critique: 'bg-red-100 text-red-700',
};
const NIVEAU_BORDER: Record<string, string> = {
  info:     'border-l-blue-400',
  warning:  'border-l-yellow-400',
  critique: 'border-l-red-400',
};
const STATUT_PROJET_COLOR: Record<string, string> = {
  nouveau:  'bg-blue-100 text-blue-700',
  en_cours: 'bg-emerald-100 text-emerald-700',
  annule:   'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const peutVoirTresorerie = PEUT_VOIR_TRESORERIE.includes(user?.role || '');

  const { data: projetsData, isLoading: loadingProjets } = useQuery({
    queryKey: ['dashboard-projets-en-cours'],
    queryFn: () => apiFetch('/projets?statut=en_cours&limit=50'),
  });

  const { data: marchesDash, isLoading: loadingMarches } = useQuery({
    queryKey: ['dashboard-marches'],
    queryFn: () => apiFetch('/marches/dashboard').then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: enginsData } = useQuery({
    queryKey: ['dashboard-engins'],
    queryFn: () => apiFetch('/stock/engins').then((r) => r.data || []),
  });

  const { data: alertesSummary } = useQuery({
    queryKey: ['alertes-summary'],
    queryFn: () => apiFetch('/alertes/summary').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: alertesActives, isLoading: loadingAlertes } = useQuery({
    queryKey: ['dashboard-alertes'],
    queryFn: () => apiFetch('/alertes').then((r) => r.data || []),
  });

  const { data: notifications, isLoading: loadingNotifs } = useQuery({
    queryKey: ['dashboard-notifications'],
    queryFn: () => apiFetch('/notifications').then((r) => r.data || []),
  });

  const { data: tresorerie } = useQuery({
    queryKey: ['dashboard-tresorerie'],
    queryFn: () => apiFetch('/finance/tresorerie').then((r) => (r.success ? r.data : null)),
    enabled: peutVoirTresorerie,
    refetchInterval: 60000,
  });

  if (loadingMarches || loadingProjets) return <Loading label="Chargement du tableau de bord..." />;
  if (!marchesDash) return null;

  const { stats } = marchesDash;
  const projets: Projet[] = projetsData?.data || [];
  const totalProjetsEnCours = projetsData?.pagination?.total ?? projets.length;
  const engins: any[] = enginsData || [];
  const enginsDisponibles = engins.filter((e) => !['maintenance', 'en_panne'].includes(e.statut)).length;
  const totalActives = alertesSummary?.total_actives ? parseInt(alertesSummary.total_actives, 10) : 0;
  const totalCritiques = alertesSummary?.critique ? parseInt(alertesSummary.critique, 10) : 0;
  const dateLabel = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr });

  const kpis = [
    { label: 'Projets',  value: totalProjetsEnCours,   icon: FolderKanban,  color: 'bg-blue-500',  sub: 'En cours' },
    { label: 'Marchés',  value: stats.total,           icon: FileText,      color: 'bg-brand-500', sub: fmt.currency(stats.montant_total) },
    { label: 'Engins',   value: engins.length,         icon: Truck,         color: 'bg-slate-500', sub: `${enginsDisponibles} disponible(s)` },
    { label: 'Alertes',  value: totalActives,          icon: AlertTriangle, color: 'bg-rose-500',  sub: `${totalCritiques} critique(s)` },
    ...(peutVoirTresorerie && tresorerie ? [{
      label: 'Trésorerie', value: fmt.currency(tresorerie.solde), icon: Wallet,
      color: tresorerie.solde >= 0 ? 'bg-emerald-500' : 'bg-orange-500',
      sub: `Encaissé ${fmt.currency(tresorerie.encaissement_total)}`,
    }] : []),
  ];

  const columns: TableColumn<Projet>[] = [
    { key: 'code_projet', header: 'Code', render: (p) => <span className="font-mono text-xs text-gray-500">{p.code_projet}</span> },
    { key: 'nom', header: 'Nom', render: (p) => (
      <Link href={`/projets/${p.id}`} className="font-medium text-gray-800 hover:text-brand-600">{p.nom}</Link>
    ) },
    { key: 'avancement', header: 'Avancement', render: (p) => (
      <div className="flex items-center gap-2 w-32">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-brand-500 h-full rounded-full" style={{ width: `${p.avancement_global || 0}%` }} />
        </div>
        <span className="text-xs text-gray-500 w-9 text-right">{p.avancement_global || 0}%</span>
      </div>
    ) },
    { key: 'budget_total', header: 'Budget', align: 'right', render: (p) => fmt.currency(p.budget_total) },
    { key: 'statut', header: 'Statut', render: (p) => (
      <Badge tone="gray" className={STATUT_PROJET_COLOR[p.statut] || 'bg-gray-100 text-gray-700'}>{p.statut}</Badge>
    ) },
  ];

  return (
    <div className="space-y-6">
      {/* 1. En-tête (recherche/notifications/avatar déjà fournis par le Header global) */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-500 capitalize">{dateLabel}</p>
      </div>

      {/* 2. KPI principaux */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} color={k.color} sub={k.sub} />
        ))}
      </div>

      {/* 3. Alertes + Activité récente */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card padded={false}>
          <CardHeader title="Alertes" action={<Link href="/alertes" className="text-xs text-brand-600 hover:underline">Tout voir</Link>} />
          <div className="divide-y max-h-[320px] overflow-y-auto">
            {loadingAlertes && <div className="p-5"><Loading label="Chargement..." /></div>}
            {!loadingAlertes && !alertesActives?.length && (
              <EmptyState icon={AlertTriangle} title="Aucune alerte active" description="Tout est sous contrôle." />
            )}
            {alertesActives?.map((a: Alerte) => (
              <div key={a.id} className={`flex items-start gap-3 px-5 py-3 border-l-4 ${NIVEAU_BORDER[a.niveau] || 'border-l-gray-200'}`}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{a.titre}</p>
                  {a.message && <p className="text-xs text-gray-500 truncate">{a.message}</p>}
                </div>
                <Badge tone="gray" className={NIVEAU_COLOR[a.niveau] || 'bg-gray-100 text-gray-700'}>{a.niveau}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card padded={false}>
          <CardHeader title="Activité récente" action={<Link href="/notifications" className="text-xs text-brand-600 hover:underline">Tout voir</Link>} />
          <div className="divide-y max-h-[320px] overflow-y-auto">
            {loadingNotifs && <div className="p-5"><Loading label="Chargement..." /></div>}
            {!loadingNotifs && !notifications?.length && (
              <EmptyState icon={Bell} title="Aucune activité récente" />
            )}
            {notifications?.slice(0, 8).map((n: Notification) => (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3">
                <Bell className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{n.titre || n.message}</p>
                  <p className="text-xs text-gray-400">{fmt.dateRelative(n.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 4. Tableau des projets en cours */}
      <Card padded={false}>
        <CardHeader title="Projets en cours" action={<Link href="/projets" className="text-xs text-brand-600 hover:underline">Tout voir</Link>} />
        {!loadingProjets && !projets.length ? (
          <EmptyState icon={FolderKanban} title="Aucun projet en cours" />
        ) : (
          <Table<Projet> columns={columns} data={projets} rowKey={(p) => p.id} loading={loadingProjets} emptyMessage="Aucun projet en cours" />
        )}
      </Card>
    </div>
  );
}
