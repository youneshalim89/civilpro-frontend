'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Wallet, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { Card, CardHeader, StatCard, Badge, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import NumberInput from '@/components/NumberInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

const CATEGORIES: Record<string, { label: string; color: string }> = {
  decompte:         { label: 'Décompte',         color: 'bg-blue-100 text-blue-700' },
  cotisation:       { label: 'Cotisation',       color: 'bg-purple-100 text-purple-700' },
  vente_materiaux:  { label: 'Vente matériaux',  color: 'bg-amber-100 text-amber-700' },
  autres_travaux:   { label: 'Autres travaux',   color: 'bg-emerald-100 text-emerald-700' },
  autre:            { label: 'Autre',            color: 'bg-gray-100 text-gray-600' },
};

const emptyForm = {
  date_mouvement: new Date().toISOString().split('T')[0],
  categorie: 'cotisation' as 'cotisation' | 'vente_materiaux' | 'autres_travaux' | 'autre',
  designation: '',
  montant: 0,
  notes: '',
};

export default function CaissePage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => apiFetch(`/marches/${id}`).then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['caisse', id],
    queryFn:  () => apiFetch(`/marches/${id}/caisse`).then(r => r.data),
  });

  const historique = data?.historique || [];
  const s = data?.synthese || {
    total_decomptes: 0, total_cotisation: 0, total_vente_materiaux: 0,
    total_autres_travaux: 0, total_autre: 0, total_entree: 0, total_sortie: 0, solde: 0,
  };

  const createMut = useMutation({
    mutationFn: () => apiFetch(`/marches/${id}/caisse`, { method: 'POST', body: JSON.stringify(form) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['caisse', id] });
      toast.success('Mouvement ajouté à la caisse');
      setForm({ ...emptyForm, categorie: form.categorie });
      setShowForm(false);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const deleteMut = useMutation({
    mutationFn: (mid: string) => apiFetch(`/marches/${id}/caisse/${mid}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['caisse', id] }); toast.success('Supprimé'); },
  });

  const historiqueColumns: TableColumn<any>[] = [
    { key: 'date_mouvement', header: 'Date', render: (h) => fmt.date(h.date_mouvement) },
    {
      key: 'categorie', header: 'Catégorie',
      render: (h) => <Badge tone="gray" className={CATEGORIES[h.categorie]?.color}>{CATEGORIES[h.categorie]?.label}</Badge>,
    },
    { key: 'designation', header: 'Désignation', render: (h) => <span className="font-medium">{h.designation || '—'}</span> },
    {
      key: 'montant', header: 'Montant', align: 'right',
      render: (h) => <span className="font-semibold text-green-600">+ {fmt.currency(h.montant)}</span>,
    },
    { key: 'created_by_nom', header: 'Saisi par', render: (h) => <span className="text-xs text-gray-400">{h.created_by_nom || '—'}</span> },
    {
      key: 'actions', header: '',
      render: (h) => h.source === 'manuel' ? (
        <button onClick={() => { if (confirm('Supprimer ce mouvement ?')) deleteMut.mutate(h.id); }}
          className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-brand-500" /> Caisse Générale
            </h1>
            <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} icon={<Plus className="w-4 h-4" />}>Ajouter un mouvement</Button>
      </div>

      {/* Synthèse Entrée / Sortie / Solde */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Entrée" tone="green" icon={TrendingUp} value={fmt.currency(s.total_entree)} />
        <StatCard label="Total Sortie (charges)" tone="red" icon={TrendingDown} value={fmt.currency(s.total_sortie)} />
        <StatCard label="Solde Caisse" tone={s.solde >= 0 ? 'blue' : 'orange'} icon={Scale} value={fmt.currency(s.solde)} />
      </div>

      {/* Détail des sources d'entrée */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Décomptes payés</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{fmt.currency(s.total_decomptes)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Cotisations</p>
          <p className="text-lg font-bold text-purple-600 mt-1">{fmt.currency(s.total_cotisation)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Vente matériaux</p>
          <p className="text-lg font-bold text-amber-600 mt-1">{fmt.currency(s.total_vente_materiaux)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Autres travaux</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{fmt.currency(s.total_autres_travaux)}</p>
        </Card>
      </div>

      {/* Formulaire */}
      {showForm && (
        <Card className="border-brand-200 border-2">
          <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouveau mouvement de caisse (entrée)</h4>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input text-sm" value={form.date_mouvement}
                onChange={e => setForm(f => ({ ...f, date_mouvement: e.target.value }))} />
            </div>
            <div>
              <label className="label">Catégorie *</label>
              <select className="input text-sm" value={form.categorie}
                onChange={e => setForm(f => ({ ...f, categorie: e.target.value as any }))}>
                <option value="cotisation">Cotisation</option>
                <option value="vente_materiaux">Vente de matériaux</option>
                <option value="autres_travaux">Autres travaux</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Désignation</label>
              <input className="input text-sm" placeholder="Ex: Cotisation associé X, Vente surplus ciment..." value={form.designation}
                onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
            </div>
            <div>
              <label className="label">Montant (DH) *</label>
              <NumberInput className="input text-sm" value={form.montant}
                onChange={v => setForm(f => ({ ...f, montant: v }))} />
            </div>
            <div className="col-span-3">
              <label className="label">Notes</label>
              <input className="input text-sm" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => { if (form.montant <= 0) { toast.error('Montant requis'); return; } createMut.mutate(); }}
              loading={createMut.isPending}
            >
              {createMut.isPending ? 'Ajout...' : 'Enregistrer'}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {/* Historique combiné */}
      <Card padded={false}>
        <CardHeader title="Historique des mouvements (décomptes + entrées manuelles)" />
        <Table<any>
          columns={historiqueColumns}
          data={historique}
          rowKey={(h) => h.id}
          loading={isLoading}
          emptyMessage="Aucun mouvement enregistré"
        />
      </Card>
    </div>
  );
}
