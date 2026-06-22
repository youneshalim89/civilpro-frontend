'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Wrench, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, entretienMaterielService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import NumberInput from '@/components/NumberInput';
import type { EntretienMateriel } from '@/lib/api';

const ENGINS_PREDEFINIS = [
  'MAN 8x4', 'Pelle hydraulique sur pneu 318', 'JCB', 'Camion malaxeur 8x4',
  'Camion benne 7m³', 'Niveleuse', 'Compacteur 12T', 'Pick up A80', 'Dokker A48',
  'Camion-citerne', 'Chargeuse', 'Poclain 318',
];

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
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['entretien-materiel', id],
    queryFn:  () => entretienMaterielService.list(id).then(r => r.data.data),
  });

  const entretiens: EntretienMateriel[] = data || [];
  const filtres = filtreEngin ? entretiens.filter(e => e.engin === filtreEngin) : entretiens;
  const enginsDisponibles = Array.from(new Set([...ENGINS_PREDEFINIS, ...entretiens.map(e => e.engin)]));

  const totalMontant = filtres.reduce((s, e) => s + Number(e.montant), 0);
  const totalAvance  = filtres.reduce((s, e) => s + Number(e.avance), 0);
  const totalReste   = filtres.reduce((s, e) => s + Number(e.reste_a_regler), 0);

  const createMut = useMutation({
    mutationFn: () => entretienMaterielService.create(id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entretien-materiel', id] });
      toast.success('Entretien enregistré');
      setForm({ ...emptyForm, engin: form.engin, type_entretien: form.type_entretien });
      setShowForm(false);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const updateAvanceMut = useMutation({
    mutationFn: ({ entId, avance }: { entId: string; avance: number }) => entretienMaterielService.updateAvance(id, entId, avance),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entretien-materiel', id] });
      toast.success('Avance mise à jour');
      setEditingAvance(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (entId: string) => entretienMaterielService.delete(id, entId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entretien-materiel', id] }); toast.success('Supprimé'); },
  });

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
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvel entretien
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Entretiens enregistrés</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{filtres.length}</p>
        </div>
        <div className="card p-4 border-l-4 border-brand-400">
          <p className="text-xs text-gray-500">Montant total</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{fmt.currency(totalMontant)}</p>
        </div>
        <div className="card p-4 border-l-4 border-green-400">
          <p className="text-xs text-gray-500">Total avancé</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt.currency(totalAvance)}</p>
        </div>
        <div className={`card p-4 border-l-4 ${totalReste > 0 ? 'border-red-400' : 'border-green-400'}`}>
          <p className="text-xs text-gray-500">Reste à régler</p>
          <p className={`text-2xl font-bold mt-1 ${totalReste > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt.currency(totalReste)}</p>
        </div>
      </div>

      {/* Filtre */}
      <div className="card p-4 flex items-center gap-3">
        <label className="label mb-0 whitespace-nowrap">Filtrer par engin</label>
        <select className="input text-sm w-64" value={filtreEngin} onChange={e => setFiltreEngin(e.target.value)}>
          <option value="">Tous les engins</option>
          {enginsDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        {filtreEngin && (
          <button onClick={() => setFiltreEngin('')} className="text-xs text-brand-600 hover:underline">Réinitialiser</button>
        )}
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="card p-5 border-brand-200 border-2">
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
              <datalist id="engins-entretien">
                {ENGINS_PREDEFINIS.map(e => <option key={e} value={e} />)}
              </datalist>
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
            <button onClick={() => {
              if (!form.engin) { toast.error('Engin requis'); return; }
              if (form.montant <= 0) { toast.error('Montant requis'); return; }
              createMut.mutate();
            }} disabled={createMut.isPending} className="btn-primary text-sm">
              {createMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Engin</th>
                <th className="table-header">Entretien</th>
                <th className="table-header">Type</th>
                <th className="table-header text-right">Montant</th>
                <th className="table-header text-right">Avance</th>
                <th className="table-header text-right">Reste à régler</th>
                <th className="table-header">Statut</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
              {filtres.map(e => {
                const reste = Number(e.reste_a_regler);
                const st = statutOf(reste, Number(e.montant));
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="table-cell">{fmt.date(e.date_entretien)}</td>
                    <td className="table-cell font-medium">{e.engin}</td>
                    <td className="table-cell text-gray-600 max-w-[180px]"><p className="truncate">{e.designation || '—'}</p></td>
                    <td className="table-cell text-xs">
                      <span className="badge bg-blue-50 text-blue-700">{TYPES_ENTRETIEN[e.type_entretien] || e.type_entretien}</span>
                    </td>
                    <td className="table-cell text-right font-semibold">{fmt.currency(e.montant)}</td>
                    <td className="table-cell text-right">
                      {editingAvance?.id === e.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <NumberInput className="input text-xs py-1 w-24 text-right" max={e.montant}
                            value={editingAvance.value} onChange={v => setEditingAvance({ id: e.id, value: v })} />
                          <button onClick={() => updateAvanceMut.mutate({ entId: e.id, avance: editingAvance.value })}
                            className="p-1 hover:bg-green-50 rounded"><CheckCircle2 className="w-4 h-4 text-green-500" /></button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingAvance({ id: e.id, value: Number(e.avance) })}
                          className="text-blue-600 hover:underline">{fmt.currency(e.avance)}</button>
                      )}
                    </td>
                    <td className={`table-cell text-right font-bold ${reste <= 0 ? 'text-green-600' : reste < e.montant ? 'text-amber-600' : 'text-red-600'}`}>
                      {fmt.currency(reste)}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => { if (confirm('Supprimer cet entretien ?')) deleteMut.mutate(e.id); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !filtres.length && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">Aucun entretien enregistré</td></tr>
              )}
            </tbody>
            {filtres.length > 0 && (
              <tfoot className="border-t bg-brand-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-brand-700 text-sm">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(totalMontant)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{fmt.currency(totalAvance)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${totalReste > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt.currency(totalReste)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
