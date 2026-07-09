'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Fuel, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { ENGINS_PREDEFINIS } from '@/lib/constants';
import { EnginsDatalist } from '@/components/marches/EnginsDatalist';
import { Card, Badge, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import NumberInput from '@/components/NumberInput';
import type { JournalMateriel } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

const STATUTS: Record<string, { label: string; color: string }> = {
  operationnel: { label: 'Opérationnel', color: 'bg-green-100 text-green-700' },
  panne:        { label: 'Panne',        color: 'bg-red-100 text-red-700' },
  entretien:    { label: 'Entretien',    color: 'bg-yellow-100 text-yellow-700' },
  arret:        { label: 'Arrêt',        color: 'bg-gray-100 text-gray-600' },
};

const emptyForm = {
  date_jour: new Date().toISOString().split('T')[0],
  engin: '',
  heures_travaillees: 0,
  gasoil_consomme: 0,
  statut: 'operationnel',
  observation: '',
};

export default function MaterielPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filtreEngin, setFiltreEngin] = useState('');

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => apiFetch(`/marches/${id}`).then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['materiel', id],
    queryFn:  () => apiFetch(`/marches/${id}/materiel`).then(r => r.data),
  });

  const journal: JournalMateriel[] = data || [];
  const journalFiltre = filtreEngin ? journal.filter(j => j.engin === filtreEngin) : journal;
  const enginsDisponibles = Array.from(new Set([...ENGINS_PREDEFINIS, ...journal.map(j => j.engin)]));

  const createMut = useMutation({
    mutationFn: () => apiFetch(`/marches/${id}/materiel`, { method: 'POST', body: JSON.stringify(form) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['materiel', id] });
      toast.success('Entrée enregistrée');
      setForm(emptyForm);
      setShowForm(false);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const deleteMut = useMutation({
    mutationFn: (entryId: string) => apiFetch(`/marches/${id}/materiel/${entryId}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['materiel', id] }); toast.success('Supprimé'); },
  });

  const totalHeures = journal.reduce((s, j) => s + (Number(j.heures_travaillees) || 0), 0);
  const totalGasoil = journal.reduce((s, j) => s + (Number(j.gasoil_consomme) || 0), 0);
  const enginsActifs = new Set(journal.map(j => j.engin)).size;
  const pannes = journal.filter(j => j.statut === 'panne').length;

  const columns: TableColumn<JournalMateriel>[] = [
    { key: 'date_jour', header: 'Date', render: (j) => fmt.date(j.date_jour) },
    { key: 'engin', header: 'Engin', render: (j) => <span className="font-medium">{j.engin}</span> },
    {
      key: 'heures_travaillees', header: 'Heures', align: 'right',
      render: (j) => <span className="inline-flex items-center gap-1 font-mono"><Clock className="w-3 h-3 text-gray-400" />{j.heures_travaillees} h</span>,
    },
    {
      key: 'gasoil_consomme', header: 'Gasoil (L)', align: 'right',
      render: (j) => <span className="inline-flex items-center gap-1 font-mono"><Fuel className="w-3 h-3 text-gray-400" />{j.gasoil_consomme} L</span>,
    },
    {
      key: 'statut', header: 'Statut',
      render: (j) => { const s = STATUTS[j.statut] || STATUTS.operationnel; return <Badge tone="gray" className={s.color}>{s.label}</Badge>; },
    },
    {
      key: 'observation', header: 'Observation',
      render: (j) => <p className="truncate max-w-xs text-sm text-gray-600">{j.observation || '—'}</p>,
    },
    { key: 'created_by_nom', header: 'Saisi par', render: (j) => <span className="text-xs text-gray-400">{j.created_by_nom || '—'}</span> },
    {
      key: 'actions', header: 'Actions',
      render: (j) => (
        <button onClick={() => { if (confirm('Supprimer cette entrée ?')) deleteMut.mutate(j.id); }}
          className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
      ),
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
            <h1 className="text-2xl font-bold text-gray-900">Journal Matériel</h1>
            <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} icon={<Plus className="w-4 h-4" />}>Enregistrer</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Engins suivis</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{enginsActifs}</p>
        </Card>
        <Card className="p-4 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500">Total heures travaillées</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt.number(totalHeures)} h</p>
        </Card>
        <Card className="p-4 border-l-4 border-amber-400">
          <p className="text-xs text-gray-500">Gasoil consommé</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt.number(totalGasoil)} L</p>
        </Card>
        <Card className="p-4 border-l-4 border-red-400">
          <p className="text-xs text-gray-500">Pannes signalées</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{pannes}</p>
        </Card>
      </div>

      {/* Formulaire */}
      {showForm && (
        <Card className="border-brand-200 border-2">
          <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouvelle entrée journal</h4>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input text-sm" value={form.date_jour}
                onChange={e => setForm(f => ({ ...f, date_jour: e.target.value }))} />
            </div>
            <div>
              <label className="label">Engin *</label>
              <input className="input text-sm" list="engins-list" placeholder="Sélectionner ou saisir..." value={form.engin}
                onChange={e => setForm(f => ({ ...f, engin: e.target.value }))} />
              <EnginsDatalist id="engins-list" />
            </div>
            <div>
              <label className="label">Heures travaillées</label>
              <NumberInput className="input text-sm" value={form.heures_travaillees}
                onChange={v => setForm(f => ({ ...f, heures_travaillees: v }))} />
            </div>
            <div>
              <label className="label">Gasoil consommé (L)</label>
              <NumberInput className="input text-sm" value={form.gasoil_consomme}
                onChange={v => setForm(f => ({ ...f, gasoil_consomme: v }))} />
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input text-sm" value={form.statut}
                onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                {Object.entries(STATUTS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
            <div className="col-span-2 xl:col-span-5">
              <label className="label">Observation</label>
              <input className="input text-sm" placeholder="RAS / Panne / Entretien..." value={form.observation}
                onChange={e => setForm(f => ({ ...f, observation: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => { if (!form.engin) { toast.error('Engin requis'); return; } createMut.mutate(); }}
              loading={createMut.isPending}>
              {createMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {/* Filtre par engin */}
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

      {/* Tableau journal */}
      <Card padded={false}>
        <Table<JournalMateriel>
          columns={columns}
          data={journalFiltre}
          rowKey={(j) => j.id}
          loading={isLoading}
          emptyMessage="Aucune entrée dans le journal"
        />
      </Card>
    </div>
  );
}
