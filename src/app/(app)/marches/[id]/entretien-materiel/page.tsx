'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Wrench, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { ENGINS_PREDEFINIS } from '@/lib/constants';
import { EnginsDatalist } from '@/components/marches/EnginsDatalist';
import { Card, Badge, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import NumberInput from '@/components/NumberInput';
import type { EntretienMateriel } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

const TYPES_ENTRETIEN: Record<string, string> = {
  pneumatique:       'Pneumatique',
  vidange:           'Vidange',
  soudure:           'Soudure',
  electricite:       'Électricité',
  mecanique:         'Mécanique',
  piece_rechange:    'Pièce de rechange',
  carrosserie:       'Carrosserie',
  batterie:          'Batterie',
  climatisation:     'Climatisation',
  freinage:          'Freinage',
  diagnostic:        'Diagnostic électronique',
  revision_generale: 'Révision générale',
  autre:             'Autre',
};

const emptyForm = {
  date_entretien: new Date().toISOString().split('T')[0],
  engin: '',
  type_entretien: 'vidange',
  designation: '',
  fournisseur: '',
  montant: 0,
  avance: 0,
  notes: '',
};

function statutOf(reste: number, montant: number) {
  if (montant <= 0) return { label: 'N/A', color: 'bg-gray-100 text-gray-500' };
  if (reste <= 0) return { label: 'Payé', color: 'bg-green-100 text-green-700' };
  if (reste < montant) return { label: 'Partiel', color: 'bg-amber-100 text-amber-700' };
  return { label: 'Impayé', color: 'bg-red-100 text-red-700' };
}

export default function EntretienMaterielPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filtreEngin, setFiltreEngin] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingAvance, setEditingAvance] = useState<{ id: string; value: number } | null>(null);

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => apiFetch(`/marches/${id}`).then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['entretien-materiel', id],
    queryFn:  () => apiFetch(`/marches/${id}/entretien-materiel`).then(r => r.data),
  });

  const entretiens: EntretienMateriel[] = data || [];
  const filtres = filtreEngin ? entretiens.filter(e => e.engin === filtreEngin) : entretiens;
  const enginsDisponibles = Array.from(new Set([...ENGINS_PREDEFINIS, ...entretiens.map(e => e.engin)]));

  const totalMontant = filtres.reduce((s, e) => s + Number(e.montant), 0);
  const totalAvance  = filtres.reduce((s, e) => s + Number(e.avance), 0);
  const totalReste   = filtres.reduce((s, e) => s + Number(e.reste_a_regler), 0);

  const createMut = useMutation({
    mutationFn: () => apiFetch(`/marches/${id}/entretien-materiel`, { method: 'POST', body: JSON.stringify(form) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entretien-materiel', id] });
      toast.success('Entretien enregistré');
      setForm({ ...emptyForm, engin: form.engin, type_entretien: form.type_entretien });
      setShowForm(false);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const updateAvanceMut = useMutation({
    mutationFn: ({ entId, avance }: { entId: string; avance: number }) =>
      apiFetch(`/marches/${id}/entretien-materiel/${entId}`, { method: 'PATCH', body: JSON.stringify({ avance }) })
        .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entretien-materiel', id] });
      toast.success('Avance mise à jour');
      setEditingAvance(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (entId: string) => apiFetch(`/marches/${id}/entretien-materiel/${entId}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entretien-materiel', id] }); toast.success('Supprimé'); },
  });

  const columns: TableColumn<EntretienMateriel>[] = [
    { key: 'date_entretien', header: 'Date', render: (e) => fmt.date(e.date_entretien) },
    { key: 'engin', header: 'Engin', render: (e) => <span className="font-medium">{e.engin}</span> },
    {
      key: 'designation', header: 'Entretien',
      render: (e) => <p className="truncate max-w-[180px] text-gray-600">{e.designation || '—'}</p>,
    },
    {
      key: 'type_entretien', header: 'Type',
      render: (e) => <Badge tone="gray" className="bg-blue-50 text-blue-700 text-xs">{TYPES_ENTRETIEN[e.type_entretien] || e.type_entretien}</Badge>,
    },
    { key: 'montant', header: 'Montant', align: 'right', render: (e) => <span className="font-semibold">{fmt.currency(e.montant)}</span> },
    {
      key: 'avance', header: 'Avance', align: 'right',
      render: (e) => editingAvance?.id === e.id ? (
        <div className="flex items-center gap-1 justify-end">
          <NumberInput className="input text-xs py-1 w-24 text-right" max={e.montant}
            value={editingAvance.value} onChange={v => setEditingAvance({ id: e.id, value: v })} />
          <button onClick={() => updateAvanceMut.mutate({ entId: e.id, avance: editingAvance.value })}
            className="p-1 hover:bg-green-50 rounded"><CheckCircle2 className="w-4 h-4 text-green-500" /></button>
        </div>
      ) : (
        <button onClick={() => setEditingAvance({ id: e.id, value: Number(e.avance) })}
          className="text-blue-600 hover:underline">{fmt.currency(e.avance)}</button>
      ),
    },
    {
      key: 'reste_a_regler', header: 'Reste à régler', align: 'right',
      render: (e) => {
        const reste = Number(e.reste_a_regler);
        return <span className={`font-bold ${reste <= 0 ? 'text-green-600' : reste < e.montant ? 'text-amber-600' : 'text-red-600'}`}>{fmt.currency(reste)}</span>;
      },
    },
    {
      key: 'statut', header: 'Statut',
      render: (e) => {
        const st = statutOf(Number(e.reste_a_regler), Number(e.montant));
        return <Badge tone="gray" className={st.color}>{st.label}</Badge>;
      },
    },
    {
      key: 'actions', header: '',
      render: (e) => (
        <button onClick={() => { if (confirm('Supprimer cet entretien ?')) deleteMut.mutate(e.id); }}
          className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
      ),
    },
  ];

  const tableFooter = filtres.length > 0 && (
    <tr className="border-t bg-brand-50">
      <td colSpan={4} className="px-4 py-3 text-right font-bold text-brand-700 text-sm">TOTAL</td>
      <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(totalMontant)}</td>
      <td className="px-4 py-3 text-right font-bold text-green-700">{fmt.currency(totalAvance)}</td>
      <td className={`px-4 py-3 text-right font-bold ${totalReste > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt.currency(totalReste)}</td>
      <td colSpan={2} />
    </tr>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-brand-500" /> Entretien Matériel
            </h1>
            <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} icon={<Plus className="w-4 h-4" />}>Nouvel entretien</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Entretiens enregistrés</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{filtres.length}</p>
        </Card>
        <Card className="p-4 border-l-4 border-brand-400">
          <p className="text-xs text-gray-500">Montant total</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{fmt.currency(totalMontant)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-green-400">
          <p className="text-xs text-gray-500">Total avancé</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt.currency(totalAvance)}</p>
        </Card>
        <Card className={`p-4 border-l-4 ${totalReste > 0 ? 'border-red-400' : 'border-green-400'}`}>
          <p className="text-xs text-gray-500">Reste à régler</p>
          <p className={`text-2xl font-bold mt-1 ${totalReste > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt.currency(totalReste)}</p>
        </Card>
      </div>

      {/* Filtre */}
      <Card className="p-4 flex items-center gap-3">
        <label className="label mb-0 whitespace-nowrap">Filtrer par engin</label>
        <select className="input text-sm w-64" value={filtreEngin} onChange={e => setFiltreEngin(e.target.value)}>
          <option value="">Tous les engins</option>
          {enginsDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        {filtreEngin && (
          <button onClick={() => setFiltreEngin('')} className="text-xs text-brand-600 hover:underline">Réinitialiser</button>
        )}
      </Card>

      {/* Formulaire */}
      {showForm && (
        <Card className="border-brand-200 border-2">
          <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouvel entretien matériel</h4>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input text-sm" value={form.date_entretien}
                onChange={e => setForm(f => ({ ...f, date_entretien: e.target.value }))} />
            </div>
            <div>
              <label className="label">Engin *</label>
              <input className="input text-sm" list="engins-entretien" placeholder="Sélectionner ou saisir..." value={form.engin}
                onChange={e => setForm(f => ({ ...f, engin: e.target.value }))} />
              <EnginsDatalist id="engins-entretien" />
            </div>
            <div>
              <label className="label">Type d'entretien *</label>
              <select className="input text-sm" value={form.type_entretien}
                onChange={e => setForm(f => ({ ...f, type_entretien: e.target.value }))}>
                {Object.entries(TYPES_ENTRETIEN).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fournisseur / Garage</label>
              <input className="input text-sm" value={form.fournisseur}
                onChange={e => setForm(f => ({ ...f, fournisseur: e.target.value }))} />
            </div>
            <div className="xl:col-span-2">
              <label className="label">Désignation / Détails</label>
              <input className="input text-sm" placeholder="Ex: Changement 4 pneus avant + équilibrage" value={form.designation}
                onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
            </div>
            <div>
              <label className="label">Montant total (DH) *</label>
              <NumberInput className="input text-sm" value={form.montant}
                onChange={v => setForm(f => ({ ...f, montant: v }))} />
            </div>
            <div>
              <label className="label">Avance versée (DH)</label>
              <NumberInput className="input text-sm" max={form.montant} value={form.avance}
                onChange={v => setForm(f => ({ ...f, avance: v }))} />
            </div>
            <div className="xl:col-span-4">
              <label className="label">Notes</label>
              <input className="input text-sm" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {form.montant > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              Reste à régler : <strong className={form.montant - form.avance > 0 ? 'text-red-600' : 'text-green-600'}>{fmt.currency(form.montant - form.avance)}</strong>
              {' '}— ce montant sera ajouté automatiquement aux charges journalières (sortie).
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <Button onClick={() => {
              if (!form.engin) { toast.error('Engin requis'); return; }
              if (form.montant <= 0) { toast.error('Montant requis'); return; }
              createMut.mutate();
            }} loading={createMut.isPending}>
              {createMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {/* Tableau */}
      <Card padded={false}>
        <Table<EntretienMateriel>
          columns={columns}
          data={filtres}
          rowKey={(e) => e.id}
          loading={isLoading}
          emptyMessage="Aucun entretien enregistré"
          footer={tableFooter}
        />
      </Card>
    </div>
  );
}
