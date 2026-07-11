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
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, TrendingDown, TrendingUp, Landmark, Users, Truck, AlertTriangle,
  Calendar, MessageSquare, Plus, Pencil, Trash2, Check, X, Wallet, Scale,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { Card, CardHeader, KpiCard, Badge, Button, Modal, StatCard, EmptyState, Loading, Tabs } from '@/components/ui';
import type { TabItem } from '@/components/ui/Tabs';
import NumberInput from '@/components/NumberInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then((r) => r.json());

type Budget = { id: string; projet_id: string; categorie: string; montant_prevu: number; reel_depense: number };
type Depense = {
  id: string; projet_id: string; categorie: string; description?: string;
  montant_ht: number; tva_pct: number; montant_ttc: number; date_depense: string;
  statut_validation: 'en_attente' | 'validee' | 'rejetee'; validee_par_nom?: string;
};

const VALIDATEURS = ['admin', 'directeur', 'comptable'];

const STATUT_DEPENSE: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  validee:    { label: 'Validée',    color: 'bg-green-100 text-green-700' },
  rejetee:    { label: 'Rejetée',    color: 'bg-red-100 text-red-700' },
};

type TresorerieMarche = { id: string; numero_marche: string; objet: string; encaissement: number; decaissement: number; solde: number };
type Tresorerie = {
  marches: TresorerieMarche[];
  encaissement_marches: number; decaissement_marches: number; decaissement_depenses: number;
  encaissement_total: number; decaissement_total: number; solde: number;
};

const emptyBudgetForm = { id: '', categorie: '', montant_prevu: 0 };
const emptyDepenseForm = { id: '', categorie: '', description: '', montant_ht: 0, tva_pct: 20, date_depense: new Date().toISOString().split('T')[0] };

const STATUT_COLOR: Record<string, string> = {
  nouveau: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-emerald-100 text-emerald-700',
  annule: 'bg-red-100 text-red-700',
};

export default function FicheProjetPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const peutValider = VALIDATEURS.includes(user?.role || '');

  const [budgetForm, setBudgetForm] = useState<typeof emptyBudgetForm | null>(null);
  const [depenseForm, setDepenseForm] = useState<typeof emptyDepenseForm | null>(null);

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

  const { data: budgets } = useQuery({
    queryKey: ['finance-budgets', id],
    queryFn: () => apiFetch(`/finance/budgets?projet_id=${id}`).then((r) => r.data || []),
  });

  const { data: depenses } = useQuery({
    queryKey: ['finance-depenses', id],
    queryFn: () => apiFetch(`/finance/depenses?projet_id=${id}`).then((r) => r.data || []),
  });

  const { data: tresorerie } = useQuery<Tresorerie | undefined>({
    queryKey: ['tresorerie-projet', id],
    queryFn: () => apiFetch(`/projets/${id}/tresorerie`).then((r) => r.data),
  });

  const invalidateFinance = () => {
    qc.invalidateQueries({ queryKey: ['finance-budgets', id] });
    qc.invalidateQueries({ queryKey: ['finance-depenses', id] });
    qc.invalidateQueries({ queryKey: ['projet-dashboard', id] });
    qc.invalidateQueries({ queryKey: ['tresorerie-projet', id] });
  };

  const saveBudgetMut = useMutation({
    mutationFn: () => {
      const payload = { projet_id: id, categorie: budgetForm!.categorie, montant_prevu: budgetForm!.montant_prevu };
      return budgetForm!.id
        ? apiFetch(`/finance/budgets/${budgetForm!.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : apiFetch('/finance/budgets', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: (r) => {
      if (!r.success) throw new Error(r.message);
      invalidateFinance();
      toast.success(budgetForm!.id ? 'Budget modifié' : 'Ligne de budget créée');
      setBudgetForm(null);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement du budget'),
  });

  const deleteBudgetMut = useMutation({
    mutationFn: (budgetId: string) => apiFetch(`/finance/budgets/${budgetId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateFinance(); toast.success('Ligne de budget supprimée'); },
  });

  const saveDepenseMut = useMutation({
    mutationFn: () => {
      const payload = {
        projet_id: id, categorie: depenseForm!.categorie, description: depenseForm!.description || undefined,
        montant_ht: depenseForm!.montant_ht, tva_pct: depenseForm!.tva_pct, date_depense: depenseForm!.date_depense,
      };
      return depenseForm!.id
        ? apiFetch(`/finance/depenses/${depenseForm!.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : apiFetch('/finance/depenses', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: (r) => {
      if (!r.success) throw new Error(r.message);
      invalidateFinance();
      toast.success(depenseForm!.id ? 'Dépense modifiée' : 'Dépense créée');
      setDepenseForm(null);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement de la dépense'),
  });

  const deleteDepenseMut = useMutation({
    mutationFn: (depenseId: string) => apiFetch(`/finance/depenses/${depenseId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateFinance(); toast.success('Dépense supprimée'); },
  });

  const validerDepenseMut = useMutation({
    mutationFn: (vars: { depenseId: string; decision: 'validee' | 'rejetee' }) =>
      apiFetch(`/finance/depenses/${vars.depenseId}/valider`, { method: 'PATCH', body: JSON.stringify({ decision: vars.decision }) }),
    onSuccess: (_r, vars) => {
      invalidateFinance();
      toast.success(vars.decision === 'validee' ? 'Dépense validée' : 'Dépense rejetée');
    },
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

        {/* Trésorerie consolidée (Chantier Finance-F) */}
        <Card padded={false}>
          <CardHeader title="Trésorerie consolidée" action={
            <span className="text-xs text-gray-400">Marchés liés + dépenses validées</span>
          } />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Encaissement" tone="green" icon={TrendingUp} value={fmt.currency(tresorerie?.encaissement_total ?? 0)} />
              <StatCard label="Décaissement" tone="red" icon={TrendingDown} value={fmt.currency(tresorerie?.decaissement_total ?? 0)} />
              <StatCard label="Solde" tone={(tresorerie?.solde ?? 0) >= 0 ? 'blue' : 'orange'} icon={Scale} value={fmt.currency(tresorerie?.solde ?? 0)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-3">
                <p className="text-xs text-gray-500">Décaissement marchés (charges)</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{fmt.currency(tresorerie?.decaissement_marches ?? 0)}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-gray-500">Décaissement dépenses de projet</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{fmt.currency(tresorerie?.decaissement_depenses ?? 0)}</p>
              </Card>
            </div>
            {!tresorerie?.marches?.length && <p className="text-sm text-gray-400 text-center py-4">Aucun marché lié</p>}
            {!!tresorerie?.marches?.length && (
              <div className="divide-y border-t">
                {tresorerie.marches.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.numero_marche}</p>
                      <p className="text-xs text-gray-400 truncate">{m.objet}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm flex-shrink-0">
                      <span className="text-green-600">+{fmt.currency(m.encaissement)}</span>
                      <span className="text-red-500">-{fmt.currency(m.decaissement)}</span>
                      <span className={`font-semibold ${m.solde >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt.currency(m.solde)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <CardHeader title="Budget par catégorie" action={
              <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setBudgetForm(emptyBudgetForm)}>Ajouter</Button>
            } />
            <div className="divide-y">
              {!budgets?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun budget renseigné</p>}
              {budgets?.map((b: Budget) => {
                const pct = Number(b.montant_prevu) > 0 ? Math.min(100, (Number(b.reel_depense) / Number(b.montant_prevu)) * 100) : 0;
                const over = Number(b.reel_depense) > Number(b.montant_prevu);
                return (
                  <div key={b.id} className="px-5 py-3 group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-700">{b.categorie}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {fmt.currency(b.reel_depense)} <span className="text-gray-400 font-normal">/ {fmt.currency(b.montant_prevu)}</span>
                        </span>
                        <button onClick={() => setBudgetForm({ id: b.id, categorie: b.categorie, montant_prevu: Number(b.montant_prevu) })}
                          className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                        <button onClick={() => { if (confirm('Supprimer cette ligne de budget ?')) deleteBudgetMut.mutate(b.id); }}
                          className="p-1 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${over ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Dépenses */}
          <Card padded={false}>
            <CardHeader title="Dépenses" action={
              <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setDepenseForm(emptyDepenseForm)}>Nouvelle dépense</Button>
            } />
            <div className="divide-y">
              {!depenses?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune dépense enregistrée</p>}
              {depenses?.map((d: Depense) => {
                const s = STATUT_DEPENSE[d.statut_validation] || STATUT_DEPENSE.en_attente;
                const modifiable = d.statut_validation === 'en_attente';
                return (
                  <div key={d.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{d.categorie}</p>
                        <p className="text-xs text-gray-400">{fmt.date(d.date_depense)}{d.description ? ` · ${d.description}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-900">{fmt.currency(d.montant_ht)}</span>
                        <Badge tone="gray" className={s.color}>{s.label}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      {peutValider && d.statut_validation === 'en_attente' && (
                        <>
                          <Button size="sm" icon={<Check className="w-3.5 h-3.5" />}
                            onClick={() => validerDepenseMut.mutate({ depenseId: d.id, decision: 'validee' })}>Valider</Button>
                          <Button size="sm" variant="secondary" icon={<X className="w-3.5 h-3.5" />}
                            onClick={() => validerDepenseMut.mutate({ depenseId: d.id, decision: 'rejetee' })}>Rejeter</Button>
                        </>
                      )}
                      {modifiable && (
                        <>
                          <button onClick={() => setDepenseForm({
                            id: d.id, categorie: d.categorie, description: d.description || '',
                            montant_ht: Number(d.montant_ht), tva_pct: Number(d.tva_pct) || 20,
                            date_depense: d.date_depense.slice(0, 10),
                          })} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                          <button onClick={() => { if (confirm('Supprimer cette dépense ?')) deleteDepenseMut.mutate(d.id); }}
                            className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
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

      {/* Modal Budget (création/édition) */}
      <Modal open={!!budgetForm} onClose={() => setBudgetForm(null)} title={budgetForm?.id ? 'Modifier la ligne de budget' : 'Nouvelle ligne de budget'}>
        <div className="space-y-4">
          <div>
            <label className="label">Catégorie *</label>
            <input className="input" value={budgetForm?.categorie || ''}
              onChange={e => setBudgetForm(f => f ? { ...f, categorie: e.target.value } : f)}
              placeholder="Terrassement, Main d'œuvre, Matériel/Engins..." />
          </div>
          <div>
            <label className="label">Montant prévu (MAD) *</label>
            <NumberInput min={0} className="input" value={budgetForm?.montant_prevu || 0}
              onChange={v => setBudgetForm(f => f ? { ...f, montant_prevu: v } : f)} autoFocus />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => {
            if (!budgetForm?.categorie.trim()) { toast.error('Catégorie requise'); return; }
            saveBudgetMut.mutate();
          }} loading={saveBudgetMut.isPending}>{budgetForm?.id ? 'Modifier' : 'Créer'}</Button>
          <Button variant="secondary" onClick={() => setBudgetForm(null)}>Annuler</Button>
        </div>
      </Modal>

      {/* Modal Dépense (création/édition) */}
      <Modal open={!!depenseForm} onClose={() => setDepenseForm(null)} title={depenseForm?.id ? 'Modifier la dépense' : 'Nouvelle dépense'}>
        <div className="space-y-4">
          <div>
            <label className="label">Catégorie *</label>
            <input className="input" value={depenseForm?.categorie || ''}
              onChange={e => setDepenseForm(f => f ? { ...f, categorie: e.target.value } : f)}
              placeholder="Idem catégorie budget pour le lien réel/prévu" list="categories-budget" />
            <datalist id="categories-budget">
              {budgets?.map((b: Budget) => <option key={b.id} value={b.categorie} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={depenseForm?.date_depense || ''}
              onChange={e => setDepenseForm(f => f ? { ...f, date_depense: e.target.value } : f)} />
          </div>
          <div>
            <label className="label">Montant HT (MAD) *</label>
            <NumberInput min={0} className="input" value={depenseForm?.montant_ht || 0}
              onChange={v => setDepenseForm(f => f ? { ...f, montant_ht: v } : f)} />
          </div>
          <div>
            <label className="label">TVA (%)</label>
            <NumberInput min={0} className="input" value={depenseForm?.tva_pct ?? 20}
              onChange={v => setDepenseForm(f => f ? { ...f, tva_pct: v } : f)} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={depenseForm?.description || ''}
              onChange={e => setDepenseForm(f => f ? { ...f, description: e.target.value } : f)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => {
            if (!depenseForm?.categorie.trim()) { toast.error('Catégorie requise'); return; }
            if (!depenseForm.montant_ht || depenseForm.montant_ht <= 0) { toast.error('Montant requis'); return; }
            saveDepenseMut.mutate();
          }} loading={saveDepenseMut.isPending}>{depenseForm?.id ? 'Modifier' : 'Créer'}</Button>
          <Button variant="secondary" onClick={() => setDepenseForm(null)}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}
