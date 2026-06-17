'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, chargesService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { ChargeMensuelle } from '@/lib/api';

const CHAMPS: { key: keyof ChargeMensuelle; label: string }[] = [
  { key: 'masse_salariale', label: 'Masse salariale' },
  { key: 'carburant',       label: 'Carburant' },
  { key: 'hebergement',     label: 'Hébergement équipe' },
  { key: 'restauration',    label: 'Restauration' },
  { key: 'reparations',     label: 'Réparations / pièces' },
  { key: 'pneumatiques',    label: 'Pneumatiques / lubrifiants' },
  { key: 'transport',       label: 'Transport / déplacement' },
  { key: 'sous_traitance',  label: 'Sous-traitance' },
  { key: 'divers',          label: 'Divers / imprévus' },
];

const moisActuel = () => new Date().toISOString().slice(0, 7);

export default function ChargesPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [mois, setMois] = useState(moisActuel());
  const [form, setForm] = useState<Record<string, number>>(
    Object.fromEntries(CHAMPS.map(c => [c.key, 0])) as Record<string, number>
  );
  const [objectif, setObjectif] = useState(0);

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['charges', id],
    queryFn:  () => chargesService.list(id).then(r => r.data.data),
  });

  const charges: ChargeMensuelle[] = data || [];
  const current = charges.find(c => c.mois === mois);

  useEffect(() => {
    if (current) {
      setForm(Object.fromEntries(CHAMPS.map(c => [c.key, Number(current[c.key]) || 0])) as Record<string, number>);
      setObjectif(Number(current.objectif_mensuel) || 0);
    } else {
      setForm(Object.fromEntries(CHAMPS.map(c => [c.key, 0])) as Record<string, number>);
      setObjectif(0);
    }
  }, [mois, current]);

  const saveMut = useMutation({
    mutationFn: () => chargesService.save(id, { mois, ...form, objectif_mensuel: objectif }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['charges', id] }); toast.success('Charges enregistrées'); },
    onError:    () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const deleteMut = useMutation({
    mutationFn: (chargeId: string) => chargesService.delete(id, chargeId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['charges', id] }); toast.success('Supprimé'); },
  });

  const total = CHAMPS.reduce((s, c) => s + (form[c.key] || 0), 0);
  const marge = objectif - total;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charges Mensuelles</h1>
          <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
        </div>
      </div>

      {/* Sélecteur de mois */}
      <div className="card p-4 flex items-center gap-4">
        <label className="label mb-0 whitespace-nowrap">Mois</label>
        <input type="month" className="input text-sm w-48" value={mois} onChange={e => setMois(e.target.value)} />
        {current && (
          <span className="text-xs text-gray-400">Dernière mise à jour enregistrée pour ce mois</span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Formulaire */}
        <div className="card p-5 xl:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Détail des charges — {mois}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Objectif mensuel (DH)</label>
              <input type="number" className="input text-sm" value={objectif}
                onChange={e => setObjectif(parseFloat(e.target.value) || 0)} />
            </div>
            <div />
            {CHAMPS.map(c => (
              <div key={c.key}>
                <label className="label">{c.label} (DH)</label>
                <input type="number" className="input text-sm" value={form[c.key] || 0}
                  onChange={e => setForm(f => ({ ...f, [c.key]: parseFloat(e.target.value) || 0 }))} />
              </div>
            ))}
          </div>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="btn-primary text-sm flex items-center gap-2 mt-5">
            <Save className="w-4 h-4" /> {saveMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        {/* Récapitulatif */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Récapitulatif</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Objectif mensuel</span><span className="font-semibold">{fmt.currency(objectif)}</span></div>
              <div className="flex justify-between border-t pt-3"><span className="text-gray-500">Total charges</span><span className="font-bold text-red-600">{fmt.currency(total)}</span></div>
              <div className={`flex justify-between border-t pt-3 font-bold ${marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span>Marge brute</span><span>{fmt.currency(marge)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Historique des mois renseignés</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Mois</th>
                <th className="table-header text-right">Total charges</th>
                <th className="table-header text-right">Objectif</th>
                <th className="table-header text-right">Marge</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
              {charges.map(c => {
                const t = CHAMPS.reduce((s, ch) => s + (Number(c[ch.key]) || 0), 0);
                const m = (Number(c.objectif_mensuel) || 0) - t;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setMois(c.mois)}>
                    <td className="table-cell font-medium">{c.mois}</td>
                    <td className="table-cell text-right">{fmt.currency(t)}</td>
                    <td className="table-cell text-right text-gray-500">{fmt.currency(c.objectif_mensuel)}</td>
                    <td className={`table-cell text-right font-semibold ${m >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt.currency(m)}</td>
                    <td className="table-cell">
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer ce mois ?')) deleteMut.mutate(c.id); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !charges.length && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">Aucune charge renseignée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
