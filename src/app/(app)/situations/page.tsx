'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Eye, DollarSign, BarChart3, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { situationsService } from '@/lib/api';
import { fmt, STATUTS_SITUATION } from '@/lib/utils';
import type { Situation } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  provisoire: 'Décompte provisoire',
  mensuel:    'Situation mensuelle',
  definitif:  'Décompte définitif',
};

export default function SituationsPage() {
  const searchParams = useSearchParams();
  const marcheId     = searchParams.get('marche_id') || '';
  const qc           = useQueryClient();
  const [statut, setStatut] = useState('');
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['situations', { marcheId, statut, page }],
    queryFn:  () => situationsService.list({ marche_id: marcheId, statut, page, limit: 15 }).then(r => r.data),
  });

  const statutMut = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => situationsService.statut(id, { statut: s }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['situations'] }); toast.success('Statut mis à jour'); },
    onError:    () => toast.error('Erreur'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => situationsService.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['situations'] }); toast.success('Décompte supprimé'); },
    onError:    (err: any) => toast.error(err.response?.data?.message || 'Erreur lors de la suppression'),
  });

  const situations: Situation[] = data?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Situations & Décomptes</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} décomptes</p>
        </div>
        <Link href="/situations/nouvelle" className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouveau décompte
        </Link>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex gap-3">
        <select className="input text-sm w-48" value={statut} onChange={e => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS_SITUATION).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">N°</th>
                <th className="table-header">Marché</th>
                <th className="table-header">Type</th>
                <th className="table-header">Période</th>
                <th className="table-header text-right">Avancement</th>
                <th className="table-header text-right">Montant brut</th>
                <th className="table-header text-right">Retenue G.</th>
                <th className="table-header text-right">Montant net</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 10 }).map((_, j) => (
                  <td key={j} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {situations.map((s) => {
                const st = STATUTS_SITUATION[s.statut];
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-cell font-bold text-brand-600">N°{s.numero_situation}</td>
                    <td className="table-cell text-xs text-gray-500">{(s as any).numero_marche || '—'}</td>
                    <td className="table-cell text-xs">{TYPE_LABELS[s.type_situation]}</td>
                    <td className="table-cell text-xs">
                      {fmt.date(s.periode_debut)} → {fmt.date(s.periode_fin)}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${s.avancement_physique}%` }} />
                        </div>
                        <span className="text-xs w-10 text-right">{fmt.pct(s.avancement_physique)}</span>
                      </div>
                    </td>
                    <td className="table-cell text-right">{fmt.currency(s.montant_brut)}</td>
                    <td className="table-cell text-right text-red-500">{fmt.currency(s.retenue_garantie)}</td>
                    <td className="table-cell text-right font-semibold text-green-700">{fmt.currency(s.montant_net)}</td>
                    <td className="table-cell">
                      <span className={`badge ${st?.color}`}>{st?.label}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <Link href={`/situations/${s.id}`}
                          className="p-1.5 hover:bg-gray-100 rounded-lg" title="Voir">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        {s.statut === 'en_cours' && (
                          <button onClick={() => { if (confirm('Marquer ce décompte comme approuvé et payé ?')) statutMut.mutate({ id: s.id, s: 'paye' }); }}
                            className="p-1.5 hover:bg-emerald-50 rounded-lg" title="Marquer payé">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                          </button>
                        )}
                        {s.statut !== 'paye' && (
                          <button onClick={() => { if (confirm(`Supprimer le décompte N°${s.numero_situation} ?`)) deleteMut.mutate(s.id); }}
                            className="p-1.5 hover:bg-red-50 rounded-lg" title="Supprimer">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                        <Link href={`/situations/recap/${(s as any).marche_id}`}
                          className="p-1.5 hover:bg-gray-100 rounded-lg" title="Récapitulatif">
                          <BarChart3 className="w-4 h-4 text-gray-400" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !situations.length && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">Aucun décompte</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {data?.pagination && data.pagination.total > 15 && (
          <div className="px-4 py-3 border-t flex justify-between text-sm text-gray-500">
            <span>{data.pagination.total} décomptes</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Précédent</button>
              <button onClick={() => setPage(p => p + 1)}
                className="btn-secondary px-3 py-1.5 text-xs">Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
