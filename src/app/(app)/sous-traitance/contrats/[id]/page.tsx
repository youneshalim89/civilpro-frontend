'use client';
// src/app/(app)/sous-traitance/contrats/[id]/page.tsx — Fiche contrat de sous-traitance
// ST-C : en-tête + bordereau (BPU). ST-D : attachements (décompte cumulatif). ST-E : avances + paiements.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Pencil, FileSpreadsheet, ClipboardCheck, Banknote, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { Card, CardHeader, Table, Badge, Button, Modal, StatCard, EmptyState, Loading } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

type Contrat = {
  id: string; numero_contrat: string; objet: string; statut: string;
  montant_ht: number; taux_tva: number; montant_ttc: number;
  date_debut: string | null; date_fin_prevue: string | null; delai_jours: number | null;
  conditions_paiement: string | null; taux_retenue_garantie: number; taux_avance: number;
  sous_traitant_nom: string; sous_traitant_ice: string | null; sous_traitant_contact: string | null;
  numero_marche: string | null; marche_objet: string | null;
  montant_bordereau: number; montant_paye_total: number;
  montant_avances_total: number; montant_avances_recuperees: number;
  montant_realise_cumule: number; nb_attachements: number;
};

type LigneBordereau = {
  id: string; numero_prix: string; designation: string; unite: string;
  quantite_prevue: number; prix_unitaire: number; montant: number;
};

type Attachement = {
  id: string; numero_attachement: number; periode_debut: string; periode_fin: string;
  montant_brut: number; retenue_garantie: number; avances_a_recuperer: number; montant_net: number;
  statut: string;
};

type Avance = {
  id: string; montant: number; date_versement: string; mode_paiement: string | null;
  reference: string | null; montant_recupere: number; statut: string;
};
type Paiement = {
  id: string; montant_du: number; montant_paye: number; date_paiement: string | null;
  reference: string | null; mode_paiement: string | null; statut: string; numero_attachement: number | null;
};

const PAIEMENT_STATUT_LABEL: Record<string, string> = { impaye: 'Impayé', partiel: 'Partiel', paye: 'Payé' };
const PAIEMENT_STATUT_COLOR: Record<string, string> = {
  impaye: 'bg-red-100 text-red-700', partiel: 'bg-yellow-100 text-yellow-700', paye: 'bg-green-100 text-green-700',
};
const MODE_PAIEMENT_LABEL: Record<string, string> = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces' };

const ATT_STATUT_LABEL: Record<string, string> = {
  en_cours: 'En cours', soumis: 'Soumis', valide_technique: 'Validé technique', approuve: 'Approuvé', paye: 'Payé', rejete: 'Rejeté',
};
const ATT_STATUT_COLOR: Record<string, string> = {
  en_cours: 'bg-gray-100 text-gray-600', soumis: 'bg-blue-100 text-blue-700', valide_technique: 'bg-purple-100 text-purple-700',
  approuve: 'bg-green-100 text-green-700', paye: 'bg-green-100 text-green-700', rejete: 'bg-red-100 text-red-700',
};
// Transition suivante proposée pour chaque statut (workflow linéaire, rejet possible depuis soumis/valide_technique)
const ATT_STATUT_SUIVANT: Record<string, string | null> = {
  en_cours: 'soumis', soumis: 'valide_technique', valide_technique: 'approuve', approuve: null, paye: null, rejete: null,
};
const ATT_STATUT_SUIVANT_LABEL: Record<string, string> = {
  soumis: 'Soumettre', valide_technique: 'Valider (technique)', approuve: 'Approuver',
};

const STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon', en_cours: 'En cours', suspendu: 'Suspendu',
  acheve: 'Achevé', resilie: 'Résilié', solde: 'Soldé',
};
const STATUT_COLOR: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600', en_cours: 'bg-blue-100 text-blue-700', suspendu: 'bg-yellow-100 text-yellow-700',
  acheve: 'bg-purple-100 text-purple-700', resilie: 'bg-red-100 text-red-700', solde: 'bg-green-100 text-green-700',
};
const CONDITIONS_LABEL: Record<string, string> = {
  selon_situations: 'Selon situations (attachements)', apres_achevement: 'Après achèvement',
};

const emptyLigneForm = { numero_prix: '', designation: '', unite: '', quantite_prevue: 0, prix_unitaire: 0 };

export default function ContratSousTraitancePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [ligneModalOuvert, setLigneModalOuvert] = useState(false);
  const [ligneEditee, setLigneEditee] = useState<LigneBordereau | null>(null);
  const [ligneForm, setLigneForm] = useState(emptyLigneForm);
  const [attModalOuvert, setAttModalOuvert] = useState(false);
  const [attForm, setAttForm] = useState<{ periode_debut: string; periode_fin: string; quantites: Record<string, number> }>({
    periode_debut: '', periode_fin: '', quantites: {},
  });
  const [avanceModalOuvert, setAvanceModalOuvert] = useState(false);
  const [avanceForm, setAvanceForm] = useState({ montant: 0, date_versement: '', mode_paiement: 'virement', reference: '' });
  const [reglementCible, setReglementCible] = useState<Paiement | null>(null);
  const [reglementForm, setReglementForm] = useState({ montant_paye: 0, date_paiement: '', reference: '', mode_paiement: 'virement' });

  const { data: contrat, isLoading } = useQuery<Contrat>({
    queryKey: ['contrat-st', id],
    queryFn: () => apiFetch(`/contrats-sous-traitance/${id}`).then(r => r.data),
  });

  const { data: bordereauData, isLoading: loadingBordereau } = useQuery({
    queryKey: ['bordereau-st', id],
    queryFn: () => apiFetch(`/contrats-sous-traitance/${id}/bordereau`).then(r => r.data || []),
  });
  const bordereau: LigneBordereau[] = bordereauData || [];

  const { data: attachementsData, isLoading: loadingAttachements } = useQuery({
    queryKey: ['attachements-st', id],
    queryFn: () => apiFetch(`/contrats-sous-traitance/${id}/attachements`).then(r => r.data || []),
  });
  const attachements: Attachement[] = attachementsData || [];

  const { data: avancesData, isLoading: loadingAvances } = useQuery({
    queryKey: ['avances-st', id],
    queryFn: () => apiFetch(`/contrats-sous-traitance/${id}/avances`).then(r => r.data || []),
  });
  const avances: Avance[] = avancesData || [];

  const { data: paiementsData, isLoading: loadingPaiements } = useQuery({
    queryKey: ['paiements-st', id],
    queryFn: () => apiFetch(`/contrats-sous-traitance/${id}/paiements`).then(r => r.data || []),
  });
  const paiements: Paiement[] = paiementsData || [];

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['bordereau-st', id] });
    qc.invalidateQueries({ queryKey: ['contrat-st', id] });
    qc.invalidateQueries({ queryKey: ['contrats-st'] });
    qc.invalidateQueries({ queryKey: ['attachements-st', id] });
    qc.invalidateQueries({ queryKey: ['avances-st', id] });
    qc.invalidateQueries({ queryKey: ['paiements-st', id] });
  };

  const creerLigneMut = useMutation({
    mutationFn: () => apiFetch(`/contrats-sous-traitance/${id}/bordereau`, { method: 'POST', body: JSON.stringify(ligneForm) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidateAll(); toast.success('Ligne ajoutée'); setLigneModalOuvert(false); setLigneForm(emptyLigneForm); },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'ajout"),
  });

  const modifierLigneMut = useMutation({
    mutationFn: () => apiFetch(`/contrats-sous-traitance/${id}/bordereau/${ligneEditee!.id}`, { method: 'PUT', body: JSON.stringify(ligneForm) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidateAll(); toast.success('Ligne modifiée'); setLigneModalOuvert(false); setLigneEditee(null); setLigneForm(emptyLigneForm); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la modification'),
  });

  const supprimerLigneMut = useMutation({
    mutationFn: (ligneId: string) => apiFetch(`/contrats-sous-traitance/${id}/bordereau/${ligneId}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidateAll(); toast.success('Ligne supprimée'); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la suppression'),
  });

  const creerAttachementMut = useMutation({
    mutationFn: () => {
      const lignes = bordereau
        .map(l => ({ bordereau_id: l.id, quantite_periode: attForm.quantites[l.id] || 0 }))
        .filter(l => l.quantite_periode > 0);
      return apiFetch(`/contrats-sous-traitance/${id}/attachements`, {
        method: 'POST',
        body: JSON.stringify({ periode_debut: attForm.periode_debut, periode_fin: attForm.periode_fin, lignes }),
      }).then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; });
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Attachement créé');
      setAttModalOuvert(false);
      setAttForm({ periode_debut: '', periode_fin: '', quantites: {} });
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de la création de l'attachement"),
  });

  const changerStatutAttMut = useMutation({
    mutationFn: ({ attId, statut }: { attId: string; statut: string }) =>
      apiFetch(`/contrats-sous-traitance/${id}/attachements/${attId}/statut`, { method: 'PATCH', body: JSON.stringify({ statut }) })
        .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidateAll(); toast.success('Statut mis à jour'); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors du changement de statut'),
  });

  const verserAvanceMut = useMutation({
    mutationFn: () => apiFetch(`/contrats-sous-traitance/${id}/avances`, { method: 'POST', body: JSON.stringify(avanceForm) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      invalidateAll(); toast.success('Avance versée'); setAvanceModalOuvert(false);
      setAvanceForm({ montant: 0, date_versement: '', mode_paiement: 'virement', reference: '' });
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors du versement de l'avance"),
  });

  const enregistrerReglementMut = useMutation({
    mutationFn: () => apiFetch(`/contrats-sous-traitance/${id}/paiements/${reglementCible!.id}`, { method: 'PATCH', body: JSON.stringify(reglementForm) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      invalidateAll(); toast.success('Règlement enregistré'); setReglementCible(null);
      setReglementForm({ montant_paye: 0, date_paiement: '', reference: '', mode_paiement: 'virement' });
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'enregistrement du règlement"),
  });

  const ouvrirCreationLigne = () => { setLigneEditee(null); setLigneForm(emptyLigneForm); setLigneModalOuvert(true); };
  const ouvrirModificationLigne = (l: LigneBordereau) => {
    setLigneEditee(l);
    setLigneForm({ numero_prix: l.numero_prix, designation: l.designation, unite: l.unite, quantite_prevue: Number(l.quantite_prevue), prix_unitaire: Number(l.prix_unitaire) });
    setLigneModalOuvert(true);
  };

  if (isLoading) return <Loading label="Chargement du contrat..." />;
  if (!contrat) return null;

  const bordereauColumns: TableColumn<LigneBordereau>[] = [
    { key: 'numero_prix', header: 'N° Prix', render: l => <span className="font-mono text-xs">{l.numero_prix}</span> },
    { key: 'designation', header: 'Désignation', render: l => <span className="font-medium text-gray-800">{l.designation}</span> },
    { key: 'unite', header: 'Unité', render: l => l.unite },
    { key: 'quantite_prevue', header: 'Qté prévue', align: 'right', render: l => fmt.number(l.quantite_prevue) },
    { key: 'prix_unitaire', header: 'P.U.', align: 'right', render: l => fmt.currency(l.prix_unitaire) },
    { key: 'montant', header: 'Montant', align: 'right', render: l => <span className="font-semibold">{fmt.currency(l.montant)}</span> },
    { key: 'actions', header: 'Actions', render: l => (
      <div className="flex items-center gap-1">
        <button data-testid={`modifier-ligne-bpu-${l.id}`} onClick={() => ouvrirModificationLigne(l)}
          className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-4 h-4 text-gray-400" /></button>
        <button data-testid={`supprimer-ligne-bpu-${l.id}`} onClick={() => { if (confirm('Supprimer cette ligne du bordereau ?')) supprimerLigneMut.mutate(l.id); }}
          className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
      </div>
    ) },
  ];

  const bordereauFooter = bordereau.length > 0 && (
    <tr className="border-t bg-brand-50">
      <td colSpan={5} className="px-4 py-3 text-right font-bold text-brand-700 text-sm">TOTAL BORDEREAU</td>
      <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(contrat.montant_bordereau)}</td>
      <td></td>
    </tr>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/sous-traitance/contrats" className="p-2 hover:bg-gray-100 rounded-lg mt-1">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{contrat.numero_contrat}</h1>
              <Badge tone="gray" className={STATUT_COLOR[contrat.statut] || 'bg-gray-100 text-gray-700'}>{STATUT_LABEL[contrat.statut] || contrat.statut}</Badge>
            </div>
            <p className="text-gray-600 mt-1">{contrat.objet}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {contrat.sous_traitant_nom}
              {contrat.numero_marche && <> — Marché <span className="font-medium">{contrat.numero_marche}</span></>}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Montant TTC" value={fmt.currency(contrat.montant_ttc)} tone="blue" />
        <StatCard label="Total bordereau" value={fmt.currency(contrat.montant_bordereau)} tone="gray" />
        <StatCard label="Réalisé cumulé" value={fmt.currency(contrat.montant_realise_cumule)}
          tone="gray" description={contrat.montant_bordereau > 0 ? `${fmt.pct((contrat.montant_realise_cumule / contrat.montant_bordereau) * 100)} du bordereau` : undefined} />
        <StatCard label="Payé" value={fmt.currency(contrat.montant_paye_total)} tone="green" />
      </div>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-4">Informations générales</h3>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div><p className="text-gray-500">Sous-traitant</p><p className="font-medium">{contrat.sous_traitant_nom}</p></div>
          <div><p className="text-gray-500">ICE</p><p className="font-medium">{contrat.sous_traitant_ice || '—'}</p></div>
          <div><p className="text-gray-500">Contact</p><p className="font-medium">{contrat.sous_traitant_contact || '—'}</p></div>
          <div><p className="text-gray-500">Date début</p><p className="font-medium">{contrat.date_debut ? fmt.date(contrat.date_debut) : '—'}</p></div>
          <div><p className="text-gray-500">Date fin prévue</p><p className="font-medium">{contrat.date_fin_prevue ? fmt.date(contrat.date_fin_prevue) : '—'}</p></div>
          <div><p className="text-gray-500">Délai</p><p className="font-medium">{contrat.delai_jours ? `${contrat.delai_jours} jours` : '—'}</p></div>
          <div><p className="text-gray-500">Conditions de paiement</p><p className="font-medium">{contrat.conditions_paiement ? CONDITIONS_LABEL[contrat.conditions_paiement] : '—'}</p></div>
          <div><p className="text-gray-500">Retenue de garantie</p><p className="font-medium">{contrat.taux_retenue_garantie} %</p></div>
          <div><p className="text-gray-500">Taux d'avance</p><p className="font-medium">{contrat.taux_avance} %</p></div>
        </div>
      </Card>

      <Card padded={false}>
        <CardHeader title="Bordereau des prix (BPU)" action={
          <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
            data-testid="ouvrir-creation-ligne-bpu" onClick={ouvrirCreationLigne}>Ajouter une ligne</Button>
        } />
        {loadingBordereau ? <Loading label="Chargement..." /> : bordereau.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="Aucune ligne de bordereau" description="Ajoutez les prix unitaires du contrat." />
        ) : (
          <Table<LigneBordereau> columns={bordereauColumns} data={bordereau} rowKey={l => l.id} emptyMessage="Aucune ligne" footer={bordereauFooter} />
        )}
      </Card>

      <Card padded={false}>
        <CardHeader title="Attachements (décompte cumulatif)" action={
          <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} disabled={bordereau.length === 0}
            data-testid="ouvrir-creation-attachement"
            onClick={() => { setAttForm({ periode_debut: '', periode_fin: '', quantites: {} }); setAttModalOuvert(true); }}>
            Nouvel attachement
          </Button>
        } />
        {loadingAttachements ? <Loading label="Chargement..." /> : attachements.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Aucun attachement" description={bordereau.length === 0 ? "Ajoutez d'abord des lignes au bordereau." : 'Saisissez les quantités réalisées de la première période.'} />
        ) : (
          <Table<Attachement>
            columns={[
              { key: 'numero_attachement', header: 'N°', render: a => <span className="font-mono text-sm">#{a.numero_attachement}</span> },
              { key: 'periode', header: 'Période', render: a => `${fmt.date(a.periode_debut)} — ${fmt.date(a.periode_fin)}` },
              { key: 'montant_brut', header: 'Montant brut', align: 'right', render: a => fmt.currency(a.montant_brut) },
              { key: 'retenue_garantie', header: 'Retenue garantie', align: 'right', render: a => fmt.currency(a.retenue_garantie) },
              { key: 'avances_a_recuperer', header: 'Avance récupérée', align: 'right', render: a => fmt.currency(a.avances_a_recuperer) },
              { key: 'montant_net', header: 'Net à payer', align: 'right', render: a => <span className="font-semibold">{fmt.currency(a.montant_net)}</span> },
              { key: 'statut', header: 'Statut', render: a => <Badge tone="gray" className={ATT_STATUT_COLOR[a.statut] || 'bg-gray-100 text-gray-700'}>{ATT_STATUT_LABEL[a.statut] || a.statut}</Badge> },
              { key: 'actions', header: 'Actions', render: a => {
                const suivant = ATT_STATUT_SUIVANT[a.statut];
                return (
                  <div className="flex items-center gap-1.5">
                    {suivant && (
                      <Button size="sm" variant="secondary" data-testid={`avancer-statut-att-${a.id}`}
                        loading={changerStatutAttMut.isPending} onClick={() => changerStatutAttMut.mutate({ attId: a.id, statut: suivant })}>
                        {ATT_STATUT_SUIVANT_LABEL[suivant]}
                      </Button>
                    )}
                    {(a.statut === 'soumis' || a.statut === 'valide_technique') && (
                      <Button size="sm" variant="ghost" data-testid={`rejeter-att-${a.id}`}
                        onClick={() => changerStatutAttMut.mutate({ attId: a.id, statut: 'rejete' })}>Rejeter</Button>
                    )}
                  </div>
                );
              } },
            ]}
            data={attachements} rowKey={a => a.id} emptyMessage="Aucun attachement"
          />
        )}
      </Card>

      <Modal open={attModalOuvert} onClose={() => setAttModalOuvert(false)} title="Nouvel attachement" maxWidth="2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Période début *</label>
              <input type="date" className="input" data-testid="att-form-periode-debut" value={attForm.periode_debut}
                onChange={e => setAttForm(f => ({ ...f, periode_debut: e.target.value }))} />
            </div>
            <div>
              <label className="label">Période fin *</label>
              <input type="date" className="input" data-testid="att-form-periode-fin" value={attForm.periode_fin}
                onChange={e => setAttForm(f => ({ ...f, periode_fin: e.target.value }))} />
            </div>
          </div>
          <div>
            <p className="label mb-2">Quantités réalisées cette période, par ligne de bordereau</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {bordereau.map(l => (
                <div key={l.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.numero_prix} — {l.designation}</p>
                    <p className="text-xs text-gray-400">Prévu : {fmt.number(l.quantite_prevue)} {l.unite} · P.U. {fmt.currency(l.prix_unitaire)}</p>
                  </div>
                  <input type="number" className="input w-28 text-sm" data-testid={`att-quantite-${l.id}`}
                    value={attForm.quantites[l.id] ?? ''} placeholder="0"
                    onChange={e => setAttForm(f => ({ ...f, quantites: { ...f.quantites, [l.id]: parseFloat(e.target.value) || 0 } }))} />
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Montant brut de la période : <strong className="text-gray-800">
              {fmt.currency(bordereau.reduce((s, l) => s + (attForm.quantites[l.id] || 0) * Number(l.prix_unitaire), 0))}
            </strong>
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="confirmer-attachement" onClick={() => creerAttachementMut.mutate()} loading={creerAttachementMut.isPending}
            disabled={!attForm.periode_debut || !attForm.periode_fin || Object.values(attForm.quantites).every(q => !q)}>
            Créer l'attachement
          </Button>
          <Button variant="secondary" onClick={() => setAttModalOuvert(false)}>Annuler</Button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card padded={false}>
          <CardHeader title="Avances" action={
            <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
              data-testid="ouvrir-versement-avance" onClick={() => setAvanceModalOuvert(true)}>Verser une avance</Button>
          } />
          {loadingAvances ? <Loading label="Chargement..." /> : avances.length === 0 ? (
            <EmptyState icon={Wallet} title="Aucune avance versée" />
          ) : (
            <div className="divide-y">
              {avances.map(a => {
                const restant = Number(a.montant) - Number(a.montant_recupere);
                return (
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{fmt.currency(a.montant)} — {fmt.date(a.date_versement)}</p>
                      <p className="text-xs text-gray-400">{a.mode_paiement ? MODE_PAIEMENT_LABEL[a.mode_paiement] : '—'} {a.reference ? `· ${a.reference}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <Badge tone="gray" className={a.statut === 'soldee' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                        {a.statut === 'soldee' ? 'Soldée' : 'En cours'}
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">Restant : {fmt.currency(restant)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padded={false}>
          <CardHeader title="Paiements" />
          {loadingPaiements ? <Loading label="Chargement..." /> : paiements.length === 0 ? (
            <EmptyState icon={Banknote} title="Aucun paiement" description="Générés automatiquement à l'approbation d'un attachement." />
          ) : (
            <div className="divide-y">
              {paiements.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between text-sm" data-testid={`paiement-${p.id}`}>
                  <div>
                    <p className="font-medium text-gray-800">
                      {p.numero_attachement ? `Attachement #${p.numero_attachement}` : 'Paiement'} — {fmt.currency(p.montant_du)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Payé : {fmt.currency(p.montant_paye)} {p.date_paiement ? `· ${fmt.date(p.date_paiement)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="gray" className={PAIEMENT_STATUT_COLOR[p.statut] || 'bg-gray-100 text-gray-700'}>{PAIEMENT_STATUT_LABEL[p.statut] || p.statut}</Badge>
                    {p.statut !== 'paye' && (
                      <Button size="sm" variant="secondary" data-testid={`reglement-paiement-${p.id}`}
                        onClick={() => { setReglementCible(p); setReglementForm({ montant_paye: Number(p.montant_du) - Number(p.montant_paye), date_paiement: '', reference: '', mode_paiement: 'virement' }); }}>
                        Régler
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={avanceModalOuvert} onClose={() => setAvanceModalOuvert(false)} title="Verser une avance">
        <div className="space-y-4">
          <div>
            <label className="label">Montant (MAD) *</label>
            <input type="number" className="input" data-testid="avance-form-montant" value={avanceForm.montant}
              onChange={e => setAvanceForm(f => ({ ...f, montant: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="label">Date de versement *</label>
            <input type="date" className="input" data-testid="avance-form-date" value={avanceForm.date_versement}
              onChange={e => setAvanceForm(f => ({ ...f, date_versement: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Mode de paiement</label>
              <select className="input" value={avanceForm.mode_paiement}
                onChange={e => setAvanceForm(f => ({ ...f, mode_paiement: e.target.value }))}>
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="especes">Espèces</option>
              </select>
            </div>
            <div>
              <label className="label">Référence</label>
              <input className="input" value={avanceForm.reference}
                onChange={e => setAvanceForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="confirmer-avance" onClick={() => verserAvanceMut.mutate()} loading={verserAvanceMut.isPending}
            disabled={!avanceForm.montant || !avanceForm.date_versement}>
            Verser l'avance
          </Button>
          <Button variant="secondary" onClick={() => setAvanceModalOuvert(false)}>Annuler</Button>
        </div>
      </Modal>

      <Modal open={!!reglementCible} onClose={() => setReglementCible(null)}
        title={reglementCible ? `Régler — ${fmt.currency(reglementCible.montant_du)}` : ''}>
        <div className="space-y-4">
          <div>
            <label className="label">Montant réglé (MAD) *</label>
            <input type="number" className="input" data-testid="reglement-form-montant" value={reglementForm.montant_paye}
              onChange={e => setReglementForm(f => ({ ...f, montant_paye: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="label">Date de paiement *</label>
            <input type="date" className="input" data-testid="reglement-form-date" value={reglementForm.date_paiement}
              onChange={e => setReglementForm(f => ({ ...f, date_paiement: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Mode de paiement</label>
              <select className="input" value={reglementForm.mode_paiement}
                onChange={e => setReglementForm(f => ({ ...f, mode_paiement: e.target.value }))}>
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="especes">Espèces</option>
              </select>
            </div>
            <div>
              <label className="label">Référence</label>
              <input className="input" value={reglementForm.reference}
                onChange={e => setReglementForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="confirmer-reglement" onClick={() => enregistrerReglementMut.mutate()} loading={enregistrerReglementMut.isPending}
            disabled={!reglementForm.montant_paye || !reglementForm.date_paiement}>
            Enregistrer le règlement
          </Button>
          <Button variant="secondary" onClick={() => setReglementCible(null)}>Annuler</Button>
        </div>
      </Modal>

      <Modal open={ligneModalOuvert} onClose={() => { setLigneModalOuvert(false); setLigneEditee(null); }}
        title={ligneEditee ? `Modifier la ligne ${ligneEditee.numero_prix}` : 'Nouvelle ligne de bordereau'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">N° Prix *</label>
              <input className="input" data-testid="ligne-bpu-numero" value={ligneForm.numero_prix}
                onChange={e => setLigneForm(f => ({ ...f, numero_prix: e.target.value }))} placeholder="Ex: P1" />
            </div>
            <div>
              <label className="label">Unité *</label>
              <input className="input" value={ligneForm.unite}
                onChange={e => setLigneForm(f => ({ ...f, unite: e.target.value }))} placeholder="Ex: m², ml, u" />
            </div>
          </div>
          <div>
            <label className="label">Désignation *</label>
            <input className="input" value={ligneForm.designation}
              onChange={e => setLigneForm(f => ({ ...f, designation: e.target.value }))} placeholder="Ex: Étanchéité toiture terrasse" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantité prévue *</label>
              <input type="number" className="input" value={ligneForm.quantite_prevue}
                onChange={e => setLigneForm(f => ({ ...f, quantite_prevue: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Prix unitaire (MAD) *</label>
              <input type="number" className="input" value={ligneForm.prix_unitaire}
                onChange={e => setLigneForm(f => ({ ...f, prix_unitaire: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Montant : <strong className="text-gray-800">{fmt.currency(ligneForm.quantite_prevue * ligneForm.prix_unitaire)}</strong>
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="confirmer-ligne-bpu"
            onClick={() => ligneEditee ? modifierLigneMut.mutate() : creerLigneMut.mutate()}
            loading={creerLigneMut.isPending || modifierLigneMut.isPending}
            disabled={!ligneForm.numero_prix || !ligneForm.designation || !ligneForm.unite}>
            {ligneEditee ? 'Enregistrer' : 'Ajouter'}
          </Button>
          <Button variant="secondary" onClick={() => { setLigneModalOuvert(false); setLigneEditee(null); }}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}
