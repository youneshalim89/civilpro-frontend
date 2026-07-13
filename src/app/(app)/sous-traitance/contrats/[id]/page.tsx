'use client';
// src/app/(app)/sous-traitance/contrats/[id]/page.tsx — Fiche contrat de sous-traitance
// ST-C : en-tête + bordereau (BPU). ST-D ajoutera les attachements, ST-E les avances/paiements.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Pencil, FileSpreadsheet } from 'lucide-react';
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
};

type LigneBordereau = {
  id: string; numero_prix: string; designation: string; unite: string;
  quantite_prevue: number; prix_unitaire: number; montant: number;
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

  const { data: contrat, isLoading } = useQuery<Contrat>({
    queryKey: ['contrat-st', id],
    queryFn: () => apiFetch(`/contrats-sous-traitance/${id}`).then(r => r.data),
  });

  const { data: bordereauData, isLoading: loadingBordereau } = useQuery({
    queryKey: ['bordereau-st', id],
    queryFn: () => apiFetch(`/contrats-sous-traitance/${id}/bordereau`).then(r => r.data || []),
  });
  const bordereau: LigneBordereau[] = bordereauData || [];

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['bordereau-st', id] });
    qc.invalidateQueries({ queryKey: ['contrat-st', id] });
    qc.invalidateQueries({ queryKey: ['contrats-st'] });
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
        <StatCard label="Montant HT" value={fmt.currency(contrat.montant_ht)} tone="blue" />
        <StatCard label="Montant TTC" value={fmt.currency(contrat.montant_ttc)} tone="blue" />
        <StatCard label="Total bordereau" value={fmt.currency(contrat.montant_bordereau)} tone="gray" />
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
