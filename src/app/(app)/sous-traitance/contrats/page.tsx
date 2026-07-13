'use client';
// src/app/(app)/sous-traitance/contrats/page.tsx — Liste des contrats de sous-traitance (Chantier ST-C)
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { Card, Table, Badge, Button, Modal, Input, EmptyState, Loading, Tabs } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

type Contrat = {
  id: string; numero_contrat: string; objet: string; statut: string;
  montant_ht: number; montant_ttc: number; sous_traitant_nom: string;
  numero_marche: string | null; montant_bordereau: number; montant_paye_total: number;
};
type SousTraitant = { id: string; raison_sociale: string };
type Marche = { id: string; numero_marche: string; objet: string };

const STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon', en_cours: 'En cours', suspendu: 'Suspendu',
  acheve: 'Achevé', resilie: 'Résilié', solde: 'Soldé',
};
const STATUT_COLOR: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600', en_cours: 'bg-blue-100 text-blue-700', suspendu: 'bg-yellow-100 text-yellow-700',
  acheve: 'bg-purple-100 text-purple-700', resilie: 'bg-red-100 text-red-700', solde: 'bg-green-100 text-green-700',
};

const emptyForm = {
  numero_contrat: '', sous_traitant_id: '', marche_id: '', objet: '', montant_ht: 0, taux_tva: 20,
  date_debut: '', date_fin_prevue: '', delai_jours: 0, conditions_paiement: 'selon_situations',
  taux_retenue_garantie: 7, taux_avance: 0,
};

export default function ContratsSousTraitancePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [modalOuvert, setModalOuvert] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['contrats-st'],
    queryFn: () => apiFetch('/contrats-sous-traitance').then(r => r.data || []),
  });
  const contrats: Contrat[] = data || [];

  const { data: sousTraitantsData } = useQuery({
    queryKey: ['sous-traitants', false],
    queryFn: () => apiFetch('/sous-traitants').then(r => r.data || []),
  });
  const sousTraitants: SousTraitant[] = sousTraitantsData || [];

  const { data: marchesData } = useQuery({
    queryKey: ['marches-st-select'],
    queryFn: () => apiFetch('/marches?limit=100').then(r => r.data || []),
  });
  const marches: Marche[] = marchesData || [];

  const creerMut = useMutation({
    mutationFn: () => apiFetch('/contrats-sous-traitance', { method: 'POST', body: JSON.stringify(form) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['contrats-st'] });
      toast.success('Contrat créé');
      setModalOuvert(false); setForm(emptyForm);
      router.push(`/sous-traitance/contrats/${r.data.id}`);
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la création'),
  });

  const columns: TableColumn<Contrat>[] = [
    { key: 'numero_contrat', header: 'N° Contrat', render: c => (
      <Link href={`/sous-traitance/contrats/${c.id}`} className="font-mono text-sm font-medium text-brand-600 hover:underline">{c.numero_contrat}</Link>
    ) },
    { key: 'sous_traitant_nom', header: 'Sous-traitant', render: c => <span className="text-gray-700">{c.sous_traitant_nom}</span> },
    { key: 'numero_marche', header: 'Marché', render: c => c.numero_marche || <span className="text-gray-300">—</span> },
    { key: 'objet', header: 'Objet', render: c => <span className="truncate max-w-[220px] block text-gray-600">{c.objet}</span> },
    { key: 'montant_ttc', header: 'Montant TTC', align: 'right', render: c => <span className="font-semibold">{fmt.currency(c.montant_ttc)}</span> },
    { key: 'montant_paye_total', header: 'Payé', align: 'right', render: c => fmt.currency(c.montant_paye_total) },
    { key: 'statut', header: 'Statut', render: c => (
      <Badge tone="gray" className={STATUT_COLOR[c.statut] || 'bg-gray-100 text-gray-700'}>{STATUT_LABEL[c.statut] || c.statut}</Badge>
    ) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sous-traitance</h1>
          <p className="text-sm text-gray-500">{contrats.length} contrat(s)</p>
        </div>
        <Button data-testid="ouvrir-creation-contrat" onClick={() => setModalOuvert(true)} icon={<Plus className="w-4 h-4" />}>Nouveau contrat</Button>
      </div>

      <Tabs items={[
        { label: 'Sous-traitants', href: '/sous-traitance' },
        { label: 'Contrats', href: '/sous-traitance/contrats' },
      ]} />

      {isLoading ? <Loading label="Chargement des contrats..." /> : contrats.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun contrat" description="Aucun contrat de sous-traitance n'a encore été créé." />
      ) : (
        <Card padded={false}>
          <Table<Contrat> columns={columns} data={contrats} rowKey={c => c.id} loading={isLoading} emptyMessage="Aucun contrat" />
        </Card>
      )}

      <Modal open={modalOuvert} onClose={() => setModalOuvert(false)} title="Nouveau contrat de sous-traitance" maxWidth="2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">N° Contrat *</label>
              <input className="input" data-testid="contrat-form-numero" value={form.numero_contrat}
                onChange={e => setForm((f: any) => ({ ...f, numero_contrat: e.target.value }))} placeholder="Ex: ST-2026-001" />
            </div>
            <div>
              <label className="label">Marché *</label>
              <select className="input" data-testid="contrat-form-marche" value={form.marche_id}
                onChange={e => setForm((f: any) => ({ ...f, marche_id: e.target.value }))}>
                <option value="">Sélectionner un marché</option>
                {marches.map(m => <option key={m.id} value={m.id}>{m.numero_marche} — {m.objet}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Sous-traitant *</label>
            <select className="input" data-testid="contrat-form-st" value={form.sous_traitant_id}
              onChange={e => setForm((f: any) => ({ ...f, sous_traitant_id: e.target.value }))}>
              <option value="">Sélectionner un sous-traitant</option>
              {sousTraitants.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Objet / lot *</label>
            <textarea className="input" rows={2} value={form.objet}
              onChange={e => setForm((f: any) => ({ ...f, objet: e.target.value }))} placeholder="Ex: Étanchéité des ouvrages d'art" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Montant HT (MAD) *</label>
              <input type="number" className="input" data-testid="contrat-form-montant" value={form.montant_ht}
                onChange={e => setForm((f: any) => ({ ...f, montant_ht: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Taux TVA (%)</label>
              <input type="number" className="input" value={form.taux_tva}
                onChange={e => setForm((f: any) => ({ ...f, taux_tva: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Retenue garantie (%)</label>
              <input type="number" className="input" value={form.taux_retenue_garantie}
                onChange={e => setForm((f: any) => ({ ...f, taux_retenue_garantie: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Date début</label>
              <input type="date" className="input" value={form.date_debut}
                onChange={e => setForm((f: any) => ({ ...f, date_debut: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date fin prévue</label>
              <input type="date" className="input" value={form.date_fin_prevue}
                onChange={e => setForm((f: any) => ({ ...f, date_fin_prevue: e.target.value }))} />
            </div>
            <div>
              <label className="label">Taux avance (%)</label>
              <input type="number" className="input" value={form.taux_avance}
                onChange={e => setForm((f: any) => ({ ...f, taux_avance: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <label className="label">Conditions de paiement</label>
            <select className="input" value={form.conditions_paiement}
              onChange={e => setForm((f: any) => ({ ...f, conditions_paiement: e.target.value }))}>
              <option value="selon_situations">Selon situations (attachements successifs)</option>
              <option value="apres_achevement">Après achèvement (règlement unique)</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="confirmer-contrat-form" onClick={() => creerMut.mutate()} loading={creerMut.isPending}
            disabled={!form.numero_contrat || !form.marche_id || !form.sous_traitant_id || !form.objet}>
            Créer le contrat
          </Button>
          <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}
