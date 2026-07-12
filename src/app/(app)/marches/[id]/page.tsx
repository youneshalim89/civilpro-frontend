'use client';
// src/app/(app)/marches/[id]/page.tsx — Détail d'un marché (Chantier UI-2 : en-tête riche + onglets)
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit2, FileText, AlertCircle, FileDown, Trash2,
  HardHat, Truck, ChevronDown, Wrench, Activity, ClipboardCheck,
  Plus, Pencil, Check, X, Wallet, Scale, TrendingUp, TrendingDown, Users,
  Calendar, MessageSquare, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import { exportMarchePDF } from '@/lib/pdf';
import { useAuthStore } from '@/lib/store';
import { MarcheStatutBadge } from '@/components/marches/MarcheStatutBadge';
import { SupprimerMarcheModal } from '@/components/marches/SupprimerMarcheModal';
import { Card, CardHeader, StatCard, Badge, Button, Modal, Loading, EmptyState, Tabs } from '@/components/ui';
import type { TabItem } from '@/components/ui/Tabs';
import NumberInput from '@/components/NumberInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then((r) => r.json());

// ── Budget / Dépenses / Trésorerie (Chantier Fusion-1) ──────────
// Réutilise Finance-E/F tels quels (mêmes routes que /projets/[id]) : ces
// données sont scope PROJET (marche.projet_id), donc partagées entre tous
// les marchés d'un même projet — voir le garde-fou "Données communes".
type Budget = { id: string; projet_id: string; categorie: string; montant_prevu: number; reel_depense: number };
type Depense = {
  id: string; projet_id: string; categorie: string; description?: string;
  montant_ht: number; tva_pct: number; montant_ttc: number; date_depense: string;
  statut_validation: 'en_attente' | 'validee' | 'rejetee'; validee_par_nom?: string;
};
type MarcheLie = { id: string; numero_marche: string };
type TresorerieMarche = { id: string; numero_marche: string; objet: string; encaissement: number; decaissement: number; solde: number };
type Tresorerie = { marches: TresorerieMarche[] };

const VALIDATEURS = ['admin', 'directeur', 'comptable'];
const STATUT_DEPENSE: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  validee:    { label: 'Validée',    color: 'bg-green-100 text-green-700' },
  rejetee:    { label: 'Rejetée',    color: 'bg-red-100 text-red-700' },
};
const emptyBudgetForm = { id: '', categorie: '', montant_prevu: 0 };
const emptyDepenseForm = { id: '', categorie: '', description: '', montant_ht: 0, tva_pct: 20, date_depense: new Date().toISOString().split('T')[0] };

// ── Engins / Équipe / Planning / Incidents / Journal (Chantier Fusion-2) ──
// Même logique : scope PROJET, données réutilisées telles quelles depuis
// les routes déjà existantes (GET /stock/engins?projet_id=, GET /rh/employes
// ?projet_id=, GET /projets/:id [phases/taches/incidents], GET /rapports
// ?projet_id=). Affecter/Libérer un engin réutilise les mêmes routes que
// /parc-materiel (POST /stock/engins/:id/affectation, /liberer).
type Engin = { id: string; designation: string; code: string | null; marque: string | null; modele: string | null; projet_id: string | null };

export default function MarcheDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const peutValider = VALIDATEURS.includes(user?.role || '');
  const [showInfos, setShowInfos] = useState(false);
  const [showIndicateurs, setShowIndicateurs] = useState(false);
  const [aSupprimer, setASupprimer] = useState<{ id: string; numero_marche: string } | null>(null);
  const [budgetForm, setBudgetForm] = useState<typeof emptyBudgetForm | null>(null);
  const [depenseForm, setDepenseForm] = useState<typeof emptyDepenseForm | null>(null);

  const { data: marche, isLoading } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
    enabled:  !!id,
  });

  const projetId = marche?.projet_id || null;

  const { data: budgets } = useQuery({
    queryKey: ['finance-budgets-marche', projetId],
    queryFn: () => apiFetch(`/finance/budgets?projet_id=${projetId}`).then(r => r.data || []),
    enabled: !!projetId,
  });

  const { data: depenses } = useQuery({
    queryKey: ['finance-depenses-marche', projetId],
    queryFn: () => apiFetch(`/finance/depenses?projet_id=${projetId}`).then(r => r.data || []),
    enabled: !!projetId,
  });

  const { data: tresorerie } = useQuery<Tresorerie | undefined>({
    queryKey: ['tresorerie-marche', projetId],
    queryFn: () => apiFetch(`/projets/${projetId}/tresorerie`).then(r => r.data),
    enabled: !!projetId,
  });

  const { data: marchesLies } = useQuery<MarcheLie[]>({
    queryKey: ['marches-lies', projetId],
    queryFn: () => apiFetch(`/projets/${projetId}/marches`).then(r => r.data || []),
    enabled: !!projetId,
  });

  const { data: projetDetail } = useQuery({
    queryKey: ['projet-detail-marche', projetId],
    queryFn: () => apiFetch(`/projets/${projetId}`).then(r => r.data),
    enabled: !!projetId,
  });

  const { data: equipe } = useQuery({
    queryKey: ['projet-equipe-marche', projetId],
    queryFn: () => apiFetch(`/rh/employes?projet_id=${projetId}`).then(r => r.data || []),
    enabled: !!projetId,
  });

  const { data: journal } = useQuery({
    queryKey: ['projet-journal-marche', projetId],
    queryFn: () => apiFetch(`/rapports?projet_id=${projetId}`).then(r => r.data || []),
    enabled: !!projetId,
  });

  const { data: enginsAffectes } = useQuery<Engin[]>({
    queryKey: ['engins-affectes-marche', projetId],
    queryFn: () => apiFetch(`/stock/engins?projet_id=${projetId}`).then(r => r.data || []),
    enabled: !!projetId,
  });

  const { data: enginsTous } = useQuery<Engin[]>({
    queryKey: ['engins-tous'],
    queryFn: () => apiFetch('/stock/engins').then(r => r.data || []),
  });

  const [affectationOuverte, setAffectationOuverte] = useState(false);
  const [enginChoisi, setEnginChoisi] = useState('');

  const invalidateEngins = () => qc.invalidateQueries({ queryKey: ['engins-affectes-marche', projetId] });

  const affecterEnginMut = useMutation({
    mutationFn: (enginId: string) => apiFetch(`/stock/engins/${enginId}/affectation`, {
      method: 'POST', body: JSON.stringify({ projet_id: projetId }),
    }),
    onSuccess: (r) => {
      if (!r.success) throw new Error(r.message);
      invalidateEngins();
      qc.invalidateQueries({ queryKey: ['engins-tous'] });
      toast.success('Engin affecté');
      setAffectationOuverte(false);
      setEnginChoisi('');
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'affectation"),
  });

  const libererEnginMut = useMutation({
    mutationFn: (enginId: string) => apiFetch(`/stock/engins/${enginId}/liberer`, { method: 'POST' }),
    onSuccess: (r) => {
      if (!r.success) throw new Error(r.message);
      invalidateEngins();
      qc.invalidateQueries({ queryKey: ['engins-tous'] });
      toast.success('Engin libéré');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la libération'),
  });

  const invalidateFinance = () => {
    qc.invalidateQueries({ queryKey: ['finance-budgets-marche', projetId] });
    qc.invalidateQueries({ queryKey: ['finance-depenses-marche', projetId] });
    qc.invalidateQueries({ queryKey: ['tresorerie-marche', projetId] });
  };

  const saveBudgetMut = useMutation({
    mutationFn: () => {
      const payload = { projet_id: projetId, categorie: budgetForm!.categorie, montant_prevu: budgetForm!.montant_prevu };
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
        projet_id: projetId, categorie: depenseForm!.categorie, description: depenseForm!.description || undefined,
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

  if (isLoading) return <Loading label="Chargement du marché..." />;
  if (!marche) return <EmptyState icon={FileText} title="Marché introuvable" />;

  const autresMarchesLies = (marchesLies || []).filter((m) => m.id !== id);
  const tresorerieMarche = tresorerie?.marches?.find((m) => m.id === id);
  const openIncidents = Array.isArray(projetDetail?.incidents) ? projetDetail.incidents : [];
  const enginsDisponibles = (enginsTous || []).filter((e) => e.projet_id !== projetId);

  // montant_actualise revient en NUMERIC PostgreSQL sérialisé en chaîne ("0.00" par
  // exemple) : une chaîne non vide est toujours "truthy" en JS, donc un `||` classique
  // ne retombe jamais sur montant_initial même quand l'actualisation vaut 0 (non définie
  // en pratique). On ne retient l'actualisé que s'il est réellement positif.
  const montantMarche = Number(marche.montant_actualise) > 0 ? Number(marche.montant_actualise) : Number(marche.montant_initial);

  const tabItems: TabItem[] = [
    { label: 'Vue générale', href: `/marches/${id}` },
    { label: 'Bordereau (BQ)', href: `/marches/${id}/articles` },
    { label: 'Commandes',     href: `/commandes?marche_id=${id}` },
    { label: 'Situations',    href: `/situations?marche_id=${id}` },
    { label: 'Factures',      href: `/factures?marche_id=${id}` },
    { label: 'Charges',       href: `/marches/${id}/charges` },
    { label: 'Caisse',        href: `/marches/${id}/caisse` },
    { label: 'Documents',     href: `/documents?marche_id=${id}` },
  ];

  const modulesComplementaires = [
    { label: 'Planning / Chantier', href: `/marches/${id}/chantier`,           icon: HardHat },
    { label: 'Journal matériel',    href: `/marches/${id}/materiel`,          icon: Truck },
    { label: 'Entretien Matériel',  href: `/marches/${id}/entretien-materiel`, icon: Wrench },
    { label: 'Avancement physique', href: `/marches/${id}/avancement-physique`, icon: Activity },
    { label: 'Feuille de Pointage', href: `/marches/${id}/pointage`,          icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête riche */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link href="/marches" className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{marche.numero_marche}</h1>
                <MarcheStatutBadge statut={marche.statut} />
                {marche.jours_restants != null && marche.jours_restants <= 30 && (
                  <span className="badge bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {marche.jours_restants}j restants
                  </span>
                )}
                {autresMarchesLies.length > 0 && (
                  <Link href={`/marches/${autresMarchesLies[0].id}`} data-testid={`voir-marche-lie-${autresMarchesLies[0].id}`} className="badge bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors">
                    Voir {autresMarchesLies.length > 1 ? 'les marchés liés' : 'le marché lié'} ({autresMarchesLies[0].numero_marche})
                  </Link>
                )}
              </div>
              <p className="text-gray-600 mt-1">{marche.objet}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => exportMarchePDF(marche)} icon={<FileDown className="w-4 h-4" />}>PDF</Button>
            <Link href={`/marches/${id}/modifier`} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              <Edit2 className="w-4 h-4" /> Modifier
            </Link>
            {user?.role === 'admin' && (
              <Button variant="danger" onClick={() => setASupprimer({ id: id!, numero_marche: marche.numero_marche })} icon={<Trash2 className="w-4 h-4" />}>
                Supprimer
              </Button>
            )}
          </div>
        </div>

        {/* Avancement physique */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-sm text-gray-600">Avancement physique</span>
            <span className="text-sm font-semibold">{fmt.pct(marche.avancement_physique)}</span>
          </div>
          <div className="bg-gray-100 rounded-full h-2.5">
            <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${marche.avancement_physique}%` }} />
          </div>
        </div>

        {/* 3 chiffres clés */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Montant marché" tone="gray"  value={fmt.currency(montantMarche)} />
          <StatCard label="Facturé"        tone="blue"  value={fmt.currency(marche.total_facture || 0)} />
          <StatCard label="Payé"           tone="green" value={fmt.currency(marche.total_paye || 0)} />
        </div>
      </div>

      {/* Onglets */}
      <Tabs items={tabItems} />

      {/* Contenu de l'onglet "Vue générale" */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Identité */}
          <Card className="col-span-2">
            <button onClick={() => setShowInfos(v => !v)} className="w-full flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Informations générales</h3>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showInfos ? 'rotate-180' : ''}`} />
            </button>
            {showInfos && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mt-4">
                <InfoRow label="Maître d'ouvrage"         value={marche.maitre_ouvrage} />
                <InfoRow label="Rattachement"              value={marche.projet_id ? `${marche.projet_code || ''} ${marche.projet_nom ? '— ' + marche.projet_nom : ''}`.trim() : 'Aucun'} />
                <InfoRow label="Entreprise attributaire"  value={marche.entreprise_attributaire} />
                <InfoRow label="Chef de marché"           value={marche.chef_marche_nom || '—'} />
                <InfoRow label="Date commencement"        value={fmt.date(marche.date_commencement)} />
                <InfoRow label="Délai contractuel"        value={`${marche.delai_contractuel} jours`} />
                <InfoRow label="Date fin prévue"          value={fmt.date(marche.date_fin_prevue)} />
                <InfoRow label="Jours écoulés"            value={`${marche.jours_ecoules || 0} j`} />
                <InfoRow label="Taux TVA"                 value={`${marche.taux_tva} %`} />
                <InfoRow label="Retenue de garantie"      value={`${marche.taux_retenue_garantie} %`} />
              </div>
            )}
          </Card>

          {/* Indicateurs financiers (hors Facturé/Payé, déjà dans l'en-tête) */}
          <Card>
            <button onClick={() => setShowIndicateurs(v => !v)} className="w-full flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Indicateurs financiers</h3>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showIndicateurs ? 'rotate-180' : ''}`} />
            </button>
            {showIndicateurs && (
              <div className="space-y-4 mt-4">
                <FinIndicator label="Montant initial"    value={marche.montant_initial} />
                <FinIndicator label="Montant actualisé"  value={montantMarche} />
                <FinIndicator label="Total commandé"     value={marche.total_commandes || 0} color="blue" />
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-500">Avancement financier</span>
                    <span className="text-sm font-semibold">{fmt.pct(marche.avancement_financier)}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${marche.avancement_financier}%` }} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Trésorerie (Chantier Fusion-1 — TresorerieService, même source que /projets/[id]) */}
        {projetId && (
          <Card padded={false}>
            <CardHeader title="Trésorerie" />
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Encaissement" tone="green" icon={TrendingUp} value={fmt.currency(tresorerieMarche?.encaissement ?? 0)} />
              <StatCard label="Décaissement (charges)" tone="red" icon={TrendingDown} value={fmt.currency(tresorerieMarche?.decaissement ?? 0)} />
              <StatCard label="Solde" tone={(tresorerieMarche?.solde ?? 0) >= 0 ? 'blue' : 'orange'} icon={Scale} value={fmt.currency(tresorerieMarche?.solde ?? 0)} />
            </div>
          </Card>
        )}

        {/* Budget par catégorie + Dépenses (Chantier Fusion-1 — Finance-E, scope projet) */}
        {projetId && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Bandeau "données communes" si le projet a d'autres marchés */}
            {autresMarchesLies.length > 0 && (
              <div className="xl:col-span-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700 flex items-center gap-2">
                <Users className="w-4 h-4 flex-shrink-0" />
                Budget et dépenses communs avec {autresMarchesLies.length > 1 ? 'les marchés' : 'le marché'}{' '}
                {autresMarchesLies.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ', '}
                    <Link href={`/marches/${m.id}`} className="font-medium underline hover:text-blue-900">{m.numero_marche}</Link>
                  </span>
                ))}
                {' '}— rattachement commun, ces chiffres ne sont pas propres à ce marché.
              </div>
            )}

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
          </div>
        )}

        {/* Engins / Équipe / Planning / Incidents / Journal (Chantier Fusion-2) */}
        {projetId && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {autresMarchesLies.length > 0 && (
              <div className="xl:col-span-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700 flex items-center gap-2">
                <Users className="w-4 h-4 flex-shrink-0" />
                Engins, équipe, planning, incidents et journal communs avec {autresMarchesLies.length > 1 ? 'les marchés' : 'le marché'}{' '}
                {autresMarchesLies.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ', '}
                    <Link href={`/marches/${m.id}`} className="font-medium underline hover:text-blue-900">{m.numero_marche}</Link>
                  </span>
                ))}
                {' '}— rattachement commun, ces éléments ne sont pas propres à ce marché.
              </div>
            )}

            {/* Planning */}
            <Card padded={false}>
              <CardHeader title="Planning" action={<Calendar className="w-4 h-4 text-gray-400" />} />
              <div className="divide-y">
                {!projetDetail?.phases?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune phase</p>}
                {projetDetail?.phases?.map((phase: any) => {
                  const tachesPhase = (projetDetail.taches || []).filter((t: any) => t.phase_id === phase.id);
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

            {/* Engins affectés — actions Affecter/Libérer, mêmes routes que /parc-materiel.
                aria-label distinctif par engin (et non "Libérer" x N) : accessibilité +
                cible non ambiguë pour les scripts de test (voir CLAUDE.md, règle Fusion-2). */}
            <Card padded={false}>
              <CardHeader title="Engins affectés" action={
                <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
                  aria-label="Affecter un engin à ce marché" data-testid="ouvrir-affectation-engin"
                  onClick={() => setAffectationOuverte(true)}>Affecter</Button>
              } />
              <div className="divide-y">
                {!enginsAffectes?.length && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun engin affecté</p>}
                {enginsAffectes?.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3" data-testid={`engin-affecte-${e.id}`}>
                    <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{e.designation} ({e.code})</p>
                      <p className="text-xs text-gray-400">{e.marque} {e.modele}</p>
                    </div>
                    <Button size="sm" variant="secondary" icon={<Ban className="w-3.5 h-3.5" />}
                      aria-label={`Libérer ${e.designation}`} data-testid={`liberer-engin-${e.id}`}
                      loading={libererEnginMut.isPending} onClick={() => libererEnginMut.mutate(e.id)}>Libérer</Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Journal de chantier */}
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
        )}

        {/* Modules complémentaires */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Modules complémentaires</h3>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {modulesComplementaires.map((m) => (
              <Link key={m.href} href={m.href}
                className="card p-4 flex items-center gap-3 hover:border-brand-400 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <m.icon className="w-5 h-5 text-brand-600" />
                </div>
                <p className="font-medium text-gray-800 text-sm">{m.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <SupprimerMarcheModal
        marche={aSupprimer}
        onClose={() => setASupprimer(null)}
        onDeleted={() => router.push('/marches')}
      />

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
              placeholder="Idem catégorie budget pour le lien réel/prévu" list="categories-budget-marche" />
            <datalist id="categories-budget-marche">
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

      {/* Modal Affecter un engin — même route que /parc-materiel */}
      <Modal open={affectationOuverte} onClose={() => { setAffectationOuverte(false); setEnginChoisi(''); }} title="Affecter un engin à ce marché">
        <div className="space-y-4">
          <div>
            <label className="label">Engin *</label>
            <select className="input" data-testid="select-engin-affectation" value={enginChoisi} onChange={e => setEnginChoisi(e.target.value)}>
              <option value="">Sélectionner un engin</option>
              {enginsDisponibles.map(e => (
                <option key={e.id} value={e.id}>{e.designation} {e.code ? `(${e.code})` : ''}</option>
              ))}
            </select>
            {!enginsDisponibles.length && (
              <p className="text-xs text-gray-400 mt-1.5">Tous les engins sont déjà affectés à ce marché.</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => affecterEnginMut.mutate(enginChoisi)} loading={affecterEnginMut.isPending} disabled={!enginChoisi}
            aria-label="Confirmer l'affectation de l'engin sélectionné" data-testid="confirmer-affectation-engin">
            Affecter
          </Button>
          <Button variant="secondary" onClick={() => { setAffectationOuverte(false); setEnginChoisi(''); }}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-gray-800 font-medium mt-0.5">{value}</p>
    </div>
  );
}

function FinIndicator({ label, value, color = 'gray' }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'text-gray-900', blue: 'text-blue-600', purple: 'text-purple-600',
    green: 'text-green-600', orange: 'text-orange-600',
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${colors[color]}`}>{fmt.currency(value)}</span>
    </div>
  );
}
