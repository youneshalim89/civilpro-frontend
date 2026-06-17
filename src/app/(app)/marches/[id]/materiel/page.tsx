'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Fuel, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, materielService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { JournalMateriel } from '@/lib/api';

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

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['materiel', id],
    queryFn:  () => materielService.list(id).then(r => r.data.data),
  });

  const journal: JournalMateriel[] = data || [];

  const createMut = useMutation({
    mutationFn: () => materielService.create(id, form),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['materiel', id] });
      toast.success('Entrée enregistrée');
      setForm(emptyForm);
      setShowForm(false);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const deleteMut = useMutation({
    mutationFn: (entryId: string) => materielService.delete(id, entryId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['materiel', id] }); toast.success('Supprimé'); },
  });

  const totalHeures = journal.reduce((s, j) => s + (Number(j.heures_travaillees) || 0), 0);
  const totalGasoil = journal.reduce((s, j) => s + (Number(j.gasoil_consomme) || 0), 0);
  const enginsActifs = new Set(journal.map(j => j.engin)).size;
  const pannes = journal.filter(j => j.statut === 'panne').length;

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
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Enregistrer
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Engins suivis</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{enginsActifs}</p>
        </div>
        <div className="card p-4 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500">Total heures travaillées</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt.number(totalHeures)} h</p>
        </div>
        <div className="card p-4 border-l-4 border-amber-400">
          <p className="text-xs text-gray-500">Gasoil consommé</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt.number(totalGasoil)} L</p>
        </div>
        <div className="card p-4 border-l-4 border-red-400">
          <p className="text-xs text-gray-500">Pannes signalées</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{pannes}</p>
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="card p-5 border-brand-200 border-2">
          <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouvelle entrée journal</h4>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input text-sm" value={form.date_jour}
                onChange={e => setForm(f => ({ ...f, date_jour: e.target.value }))} />
            </div>
            <div>
              <label className="label">Engin *</label>
              <input className="input text-sm" placeholder="Niveleuse, JCB..." value={form.engin}
                onChange={e => setForm(f => ({ ...f, engin: e.target.value }))} />
            </div>
            <div>
              <label className="label">Heures travaillées</label>
              <input type="number" step="0.5" className="input text-sm" value={form.heures_travaillees}
                onChange={e => setForm(f => ({ ...f, heures_travaillees: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Gasoil consommé (L)</label>
              <input type="number" step="0.1" className="input text-sm" value={form.gasoil_consomme}
                onChange={e => setForm(f => ({ ...f, gasoil_consomme: parseFloat(e.target.value) || 0 }))} />
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
            <button onClick={() => { if (!form.engin) { toast.error('Engin requis'); return; } createMut.mutate(); }}
              disabled={createMut.isPending} className="btn-primary text-sm">
              {createMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      )}

      {/* Tableau journal */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Engin</th>
                <th className="table-header text-right">Heures</th>
                <th className="table-header text-right">Gasoil (L)</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Observation</th>
                <th className="table-header">Saisi par</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
              {journal.map(j => {
                const s = STATUTS[j.statut] || STATUTS.operationnel;
                return (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="table-cell">{fmt.date(j.date_jour)}</td>
                    <td className="table-cell font-medium">{j.engin}</td>
                    <td className="table-cell text-right font-mono">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-gray-400" />{j.heures_travaillees} h</span>
                    </td>
                    <td className="table-cell text-right font-mono">
                      <span className="inline-flex items-center gap-1"><Fuel className="w-3 h-3 text-gray-400" />{j.gasoil_consomme} L</span>
                    </td>
                    <td className="table-cell"><span className={`badge ${s.color}`}>{s.label}</span></td>
                    <td className="table-cell text-sm text-gray-600 max-w-xs"><p className="truncate">{j.observation || '—'}</p></td>
                    <td className="table-cell text-xs text-gray-400">{j.created_by_nom || '—'}</td>
                    <td className="table-cell">
                      <button onClick={() => { if (confirm('Supprimer cette entrée ?')) deleteMut.mutate(j.id); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !journal.length && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">Aucune entrée dans le journal</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
