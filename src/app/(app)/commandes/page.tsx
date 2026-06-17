'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Eye, Truck, X, CheckCircle, FileDown, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { commandesService } from '@/lib/api';
import { fmt, STATUTS_COMMANDE, exportCSV } from '@/lib/utils';
import { exportListPDF } from '@/lib/pdf';
import type { Commande } from '@/lib/api';

const STATUTS_TRANSITION: Record<string, { label: string; next: string }[]> = {
  en_attente:  [{ label: 'Confirmer', next: 'confirmee' }],
  confirmee:   [{ label: 'En livraison', next: 'en_cours_livraison' }],
  en_cours_livraison: [
    { label: 'Livrée', next: 'livree' },
    { label: 'Part. livrée', next: 'partiellement_livree' },
  ],
};

export default function CommandesPage() {
  const searchParams = useSearchParams();
  const marcheId     = searchParams.get('marche_id') || '';
  const qc           = useQueryClient();
  const [statut, setStatut] = useState('');
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['commandes', { marcheId, statut, page }],
    queryFn:  () => commandesService.list({ marche_id: marcheId, statut, page, limit: 15 }).then(r => r.data),
  });

  const statutMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      commandesService.updateStatut(id, { statut: next }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commandes'] }); toast.success('Statut mis à jour'); },
    onError:   () => toast.error('Erreur lors de la mise à jour'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commandesService.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['commandes'] }); toast.success('Commande supprimée'); },
    onError:    (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const commandes: Commande[] = data?.data || [];

  // Totaux
  const totalHT  = commandes.reduce((s, c) => s + parseFloat(String(c.total_ht)),  0);
  const totalTTC = commandes.reduce((s, c) => s + parseFloat(String(c.total_ttc)), 0);

  const handleExportCSV = () => {
    exportCSV('Commandes.csv',
      ['N° Commande','Fournisseur','Date','Livraison prévue','Total HT','Total TTC','Statut'],
      commandes.map(c => [c.numero_commande, c.fournisseur_nom || '—', fmt.date(c.date_commande), fmt.date(c.date_livraison_prevue), c.total_ht, c.total_ttc, STATUTS_COMMANDE[c.statut]?.label || c.statut]));
  };

  const handleExportPDF = () => {
    exportListPDF({
      title: 'COMMANDES', subtitle: `${commandes.length} commande(s)`, filename: 'Commandes.pdf',
      head: ['N° Commande','Fournisseur','Date','Livraison prévue','Total HT','Total TTC','Statut'],
      body: commandes.map(c => [c.numero_commande, c.fournisseur_nom || '—', fmt.date(c.date_commande), fmt.date(c.date_livraison_prevue), fmt.currency(c.total_ht), fmt.currency(c.total_ttc), STATUTS_COMMANDE[c.statut]?.label || c.statut]),
      rightAlignCols: [4, 5],
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} commandes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-sm flex items-center gap-2">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <Link href="/commandes/nouvelle" className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle commande
          </Link>
        </div>
      </div>

      {/* KPIs rapides */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total HT', value: fmt.currency(totalHT) },
          { label: 'Total TTC', value: fmt.currency(totalTTC) },
          { label: 'En attente', value: commandes.filter(c => c.statut === 'en_attente').length },
          { label: 'Livrées', value: commandes.filter(c => c.statut === 'livree').length },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtre statut */}
      <div className="card p-4 flex gap-3">
        <select className="input text-sm w-52" value={statut} onChange={e => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS_COMMANDE).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">N° Commande</th>
                <th className="table-header">Marché</th>
                <th className="table-header">Fournisseur</th>
                <th className="table-header">Date</th>
                <th className="table-header">Livraison prévue</th>
                <th className="table-header text-right">Total HT</th>
                <th className="table-header text-right">Total TTC</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {commandes.map((c) => {
                const s         = STATUTS_COMMANDE[c.statut];
                const nextSteps = STATUTS_TRANSITION[c.statut] || [];
                const isLate    = c.date_livraison_prevue && new Date(c.date_livraison_prevue) < new Date() && !['livree','annulee'].includes(c.statut);
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono font-medium text-brand-600">{c.numero_commande}</td>
                    <td className="table-cell text-xs text-gray-500">{(c as any).numero_marche || '—'}</td>
                    <td className="table-cell text-gray-700">{c.fournisseur_nom || '—'}</td>
                    <td className="table-cell">{fmt.date(c.date_commande)}</td>
                    <td className="table-cell">
                      <span className={isLate ? 'text-red-600 font-medium' : ''}>
                        {fmt.date(c.date_livraison_prevue)}
                      </span>
                    </td>
                    <td className="table-cell text-right">{fmt.currency(c.total_ht)}</td>
                    <td className="table-cell text-right font-semibold">{fmt.currency(c.total_ttc)}</td>
                    <td className="table-cell">
                      <span className={`badge ${s?.color}`}>{s?.label}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <Link href={`/commandes/${c.id}`}
                          className="p-1.5 hover:bg-gray-100 rounded-lg" title="Voir">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        {nextSteps.map(ns => (
                          <button key={ns.next}
                            onClick={() => statutMut.mutate({ id: c.id, next: ns.next })}
                            className="p-1.5 hover:bg-blue-50 rounded-lg" title={ns.label}>
                            {ns.next === 'livree' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Truck className="w-4 h-4 text-blue-500" />
                            )}
                          </button>
                        ))}
                        {c.statut === 'en_attente' && (
                          <button onClick={() => { if (confirm('Supprimer cette commande ?')) deleteMut.mutate(c.id); }}
                            className="p-1.5 hover:bg-red-50 rounded-lg" title="Supprimer">
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !commandes.length && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">Aucune commande</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {data?.pagination && data.pagination.total > 15 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{data.pagination.total} commandes</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Précédent</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.pagination.total / 15)}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
