'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Wallet, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, caisseService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import NumberInput from '@/components/NumberInput';

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
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['caisse', id],
    queryFn:  () => caisseService.get(id).then(r => r.data.data),
  });

  const historique = data?.historique || [];
  const s = data?.synthese || {
    total_decomptes: 0, total_cotisation: 0, total_vente_materiaux: 0,
    total_autres_travaux: 0, total_autre: 0, total_entree: 0, total_sortie: 0, solde: 0,
  };

  const createMut = useMutation({
    mutationFn: () => caisseService.create(id, form),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['caisse', id] });
      toast.success('Mouvement ajouté à la caisse');
      setForm({ ...emptyForm, categorie: form.categorie });
      setShowForm(false);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const deleteMut = useMutation({
    mutationFn: (mid: string) => caisseService.delete(id, mid),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['caisse', id] }); toast.success('Supprimé'); },
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
              <Wallet className="w-6 h-6 text-brand-500" /> Caisse Générale
            </h1>
            <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter un mouvement
        </button>
      </div>

      {/* Synthèse Entrée / Sortie / Solde */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-green-400">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Entrée</p>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-2">{fmt.currency(s.total_entree)}</p>
        </div>
        <div className="card p-5 border-l-4 border-red-400">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sortie (charges)</p>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">{fmt.currency(s.total_sortie)}</p>
        </div>
        <div className={`card p-5 border-l-4 ${s.solde >= 0 ? 'border-blue-400' : 'border-orange-400'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Solde Caisse</p>
            <Scale className={`w-4 h-4 ${s.solde >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
          </div>
          <p className={`text-2xl font-bold mt-2 ${s.solde >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt.currency(s.solde)}</p>
        </div>
      </div>

      {/* Détail des sources d'entrée */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Décomptes payés</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{fmt.currency(s.total_decomptes)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Cotisations</p>
          <p className="text-lg font-bold text-purple-600 mt-1">{fmt.currency(s.total_cotisation)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Vente matériaux</p>
          <p className="text-lg font-bold text-amber-600 mt-1">{fmt.currency(s.total_vente_materiaux)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Autres travaux</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{fmt.currency(s.total_autres_travaux)}</p>
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="card p-5 border-brand-200 border-2">
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
            <button onClick={() => { if (form.montant <= 0) { toast.error('Montant requis'); return; } createMut.mutate(); }}
              disabled={createMut.isPending} className="btn-primary text-sm">
              {createMut.isPending ? 'Ajout...' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      )}

      {/* Historique combiné */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Historique des mouvements (décomptes + entrées manuelles)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Catégorie</th>
                <th className="table-header">Désignation</th>
                <th className="table-header text-right">Montant</th>
                <th className="table-header">Saisi par</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
              {historique.map((h: any) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="table-cell">{fmt.date(h.date_mouvement)}</td>
                  <td className="table-cell">
                    <span className={`badge ${CATEGORIES[h.categorie]?.color}`}>{CATEGORIES[h.categorie]?.label}</span>
                  </td>
                  <td className="table-cell font-medium">{h.designation || '—'}</td>
                  <td className="table-cell text-right font-semibold text-green-600">+ {fmt.currency(h.montant)}</td>
                  <td className="table-cell text-xs text-gray-400">{h.created_by_nom || '—'}</td>
                  <td className="table-cell">
                    {h.source === 'manuel' && (
                      <button onClick={() => { if (confirm('Supprimer ce mouvement ?')) deleteMut.mutate(h.id); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && !historique.length && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">Aucun mouvement enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
