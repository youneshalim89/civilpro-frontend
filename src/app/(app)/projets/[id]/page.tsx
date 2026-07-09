// src/app/(app)/projets/[id]/page.tsx — Fiche projet (Chantier UI-3 : en-tête + onglets)
//
// Un seul onglet réel supplémentaire est possible aujourd'hui ("Marchés
// liés" → /marches?projet_id=), car aucune autre page (RH, Stock/Parc
// Matériel, Alertes, Rapports) ne lit de filtre projet_id depuis l'URL —
// voir docs/AVANCEMENT.md. Équipe/Engins/Alertes/Planning/Budget/Incidents/
// Journal restent donc regroupés dans "Vue générale", comme avant, mais
// réorganisés en sections claires. Documents exclu : aucune route API
// n'existe pour documents_projet (créé pour le seed, jamais exposé).
'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, TrendingDown, Landmark, Users, Truck, AlertTriangle,
  Calendar, MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { fmt } from '@/lib/utils';
import { Card, CardHeader, KpiCard, Badge, EmptyState, Loading, Tabs } from '@/components/ui';
import type { TabItem } from '@/components/ui/Tabs';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string) =>
  fetch(`${API}/api${url}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => r.json());

const STATUT_COLOR: Record<string, string> = {
  nouveau: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-emerald-100 text-emerald-700',
  annule: 'bg-red-100 text-red-700',
};

export default function FicheProjetPage() {
  const { id } = useParams<{ id: string }>();

  const { data: projet, isLoading: loadingProjet } = useQuery({
    queryKey: ['projet-detail', id],
    queryFn: () => apiFetch(`/projets/${id}`).then((r) => r.data),
  });

  const { data: kpi } = useQuery({
    queryKey: ['projet-dashboard', id],
    queryFn: () => apiFetch(`/projets/${id}/dashboard`).then((r) => r.data),
  });

  const { data: equipe } = useQuery({
    queryKey: ['projet-equipe', id],
    queryFn: () => apiFetch(`/rh/employes?projet_id=${id}`).then((r) => r.data || []),
  });

  const { data: enginsAll } = useQuery({
    queryKey: ['projet-engins', id],
    queryFn: () => apiFetch('/stock/engins').then((r) => (r.data || []).filter((e: any) => e.projet_id === id)),
  });

  const { data: alertes } = useQuery({
    queryKey: ['projet-alertes', id],
    queryFn: () => apiFetch(`/alertes?projet_id=${id}&statut=active`).then((r) => r.data || []),
  });

  const { data: journal } = useQuery({
    queryKey: ['projet-journal', id],
    queryFn: () => apiFetch(`/rapports?projet_id=${id}`).then((r) => r.data || []),
  });

  if (loadingProjet) return <Loading label="Chargement du projet..." />;
  if (!projet) return <EmptyState icon={FileText} title="Projet introuvable" />;

  const tabItems: TabItem[] = [
    { label: 'Vue générale', href: `/projets/${id}` },
    { label: 'Marchés liés', href: `/marches?projet_id=${id}` },
  ];

  const kpis = [
    { label: 'Budget', value: fmt.currency(projet.budget_total), icon: Landmark, color: 'bg-brand-500' },
    { label: 'Dépenses', value: fmt.currency(kpi?.total_depenses ?? 0), icon: TrendingDown, color: 'bg-red-500' },
    { label: 'Équipe', value: equipe?.length ?? '—', icon: Users, color: 'bg-purple-500' },
    { label: 'Engins', value: enginsAll?.length ?? '—', icon: Truck, color: 'bg-slate-500' },
    { label: 'Alertes', value: alertes?.length ?? '—', icon: AlertTriangle, color: 'bg-rose-500' },
  ];

  const remainingBudget = Math.max(0, Number(projet?.budget_total || 0) - Number(kpi?.total_depenses || 0));
  const openIncidents = Array.isArray(projet?.incidents) ? projet.incidents : [];
  const pendingTasks = Array.isArray(projet?.taches) ? projet.taches.filter((t: any) => t.statut !== 'terminee' && t.statut !== 'annulee') : [];
  const overdueTasks = pendingTasks.filter((t: any) => t.date_echeance && new Date(t.date_echeance) < new Date());

  const operationalCards = [
    { label: 'Budget restant', value: fmt.currency(remainingBudget), tone: 'brand' as const },
    { label: 'Tâches actives', value: pendingTasks.length.toString(), tone: 'info' as const },
    { label: 'Retards', value: overdueTasks.length.toString(), tone: 'danger' as const },
    { label: 'Incidents ouverts', value: String(kpi?.nb_incidents_ouverts ?? openIncidents.length), tone: 'warning' as const },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête — aucun chiffre financier */}
      <div className="space-y-3">
        <div className="flex items-start gap-4">
          <Link href="/projets" className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{projet.nom}</h1>
              <Badge tone="gray" className={STATUT_COLOR[projet.statut] || 'bg-gray-100 text-gray-700'}>{projet.statut}</Badge>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              {projet.code_projet} · {projet.localisation || 'Localisation non renseignée'}
            </p>
            {projet.maitre_ouvrage && (
              <p className="text-gray-400 text-xs mt-0.5">Maître d&apos;ouvrage : {projet.maitre_ouvrage}</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-sm text-gray-600">Avancement</span>
            <span className="text-sm font-semibold">{fmt.pct(kpi?.avancement ?? 0)}</span>
          </div>
          <div className="bg-gray-100 rounded-full h-2.5">
            <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${kpi?.avancement ?? 0}%` }} />
          </div>
        </div>
      </div>

      {/* Onglets */}
      <Tabs items={tabItems} />

      {/* Contenu de l'onglet "Vue générale" */}
      <div className="space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} color={k.color} />
          ))}
        </div>

        <Card padded={false}>
          <CardHeader title="Résumé opérationnel" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-5">
            {operationalCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{item.label}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xl font-semibold text-gray-900">{item.value}</span>
                  <Badge tone={item.tone}>{item.tone === 'danger' ? 'vigilance' : item.tone === 'warning' ? 'à suivre' : 'ok'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Planning (phases + tâches) */}
          <Card padded={false}>
            <CardHeader title="Planning" action={<Calendar className="w-4 h-4 text-gray-400" />} />
            <div className="divide-y">
              {!projet.phases?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune phase</p>}
              {projet.phases?.map((phase: any) => {
                const tachesPhase = (projet.taches || []).filter((t: any) => t.phase_id === phase.id);
                return (
                  <div key={phase.id} className="px-5 py-3">
                    <p className="text-sm font-semibold text-gray-800">{phase.nom}</p>
                    <div className="mt-2 space-y-1.5">
                      {tachesPhase.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-brand-500 h-full rounded-full" style={{ width: `${t.progression_pct || 0}%` }} />
                          </div>
                          <span className="text-gray-500 w-32 truncate">{t.titre}</span>
                          <span className="text-gray-400 w-10 text-right">{t.progression_pct || 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Incidents ouverts */}
          <Card padded={false}>
            <CardHeader title="Incidents ouverts" />
            <div className="divide-y">
              {!openIncidents.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun incident ouvert</p>}
              {openIncidents.map((incident: any) => (
                <div key={incident.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{incident.titre || incident.description || 'Incident sans titre'}</p>
                    {incident.description && <p className="text-xs text-gray-500 mt-0.5">{incident.description}</p>}
                  </div>
                  <Badge tone="danger">{fmt.date(incident.date_incident)}</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Budget */}
          <Card padded={false}>
            <CardHeader title="Budget par catégorie" />
            <div className="divide-y">
              {!projet.budgets?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun budget renseigné</p>}
              {projet.budgets?.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-sm text-gray-700">{b.categorie}</span>
                  <span className="text-sm font-medium text-gray-900">{fmt.currency(b.montant_prevu)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Équipe */}
          <Card padded={false}>
            <CardHeader title="Équipe" />
            <div className="divide-y">
              {!equipe?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun employé affecté</p>}
              {equipe?.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-700 text-xs font-bold">{e.prenom?.[0]}{e.nom?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{e.prenom} {e.nom}</p>
                    <p className="text-xs text-gray-400">{e.poste || e.role_systeme}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Engins */}
          <Card padded={false}>
            <CardHeader title="Engins affectés" />
            <div className="divide-y">
              {!enginsAll?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun engin affecté</p>}
              {enginsAll?.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{e.designation} ({e.code})</p>
                    <p className="text-xs text-gray-400">{e.marque} {e.modele}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Alertes */}
          <Card padded={false}>
            <CardHeader title="Alertes actives" action={<Link href="/alertes" className="text-xs text-brand-600 hover:underline">Centre d&apos;alertes</Link>} />
            <div className="divide-y">
              {!alertes?.length && <EmptyState icon={AlertTriangle} title="Aucune alerte active" />}
              {alertes?.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{a.titre}</p>
                    {a.message && <p className="text-xs text-gray-500">{a.message}</p>}
                  </div>
                  <Badge tone={a.niveau === 'critique' ? 'danger' : a.niveau === 'warning' ? 'warning' : 'info'}>{a.niveau}</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Journal */}
          <Card padded={false}>
            <CardHeader title="Journal de chantier" action={<MessageSquare className="w-4 h-4 text-gray-400" />} />
            <div className="divide-y">
              {!journal?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun rapport</p>}
              {journal?.map((r: any) => (
                <div key={r.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{fmt.date(r.date_rapport)}</p>
                    <span className="text-xs text-gray-400">{r.meteo} · {r.temperature}°C</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{r.travaux_realises}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
