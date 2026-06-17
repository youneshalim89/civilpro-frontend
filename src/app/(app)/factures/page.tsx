'use client';
// src/app/(app)/factures/page.tsx — Liste des factures
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Eye, CheckCircle, XCircle, DollarSign, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { facturesService } from '@/lib/api';
import { fmt, STATUTS_FACTURE } from '@/lib/utils';
import type { Facture } from '@/lib/api';

export default function FacturesPage() {
  const searchParams = useSearchParams();
  const marcheId     = searchParams.get('marche_id') || '';
  const qc           = useQueryClient();

  const [statut,     setStatut]     = useState('');
  const [date_debut, setDateDebut]  = useState('');
  const [date_fin,   setDateFin]    = useState('');
  const [page,       setPage]       = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['factures', { marcheId, statut, date_debut, date_fin, page }],
    queryFn:  () => facturesService.list({ marche_id: marcheId, statut, date_debut, date_fin, page, limit: 15 }).then(r => r.data),
  });

  const validerMut = useMutation({
    mutationFn: (id: string) => facturesService.valider(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['factures'] }); toast.success('Facture validée'); },
    onError:    () => toast.error('Erreur lors de la validation'),
  });

  const annulerMut = useMutation({
    mutationFn: (id: string) => facturesService.annuler(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['factures'] }); toast.success('Facture annulée'); },
    onError:    () => toast.error('Erreur lors de l\'annulation'),
  });

  const totaux = (data as any)?.totaux;
  const factures: Facture[] = data?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} factures</p>
        </div>
        <Link href="/factures/nouvelle" className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle facture
        </Link>
      </div>

      {/* KPIs */}
      {totaux && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Total HT',              value: totaux.total_ht,   color: 'text-gray-900' },
            { label: 'Total TTC',             value: totaux.total_ttc,  color: 'text-brand-600 font-bold' },
            { label: 'Total payé',            value: totaux.payee,      color: 'text-green-600' },
            { label: 'En attente paiement',   value: totaux.validee,    color: 'text-orange-600' },
          ].map(k => (
            <div key={k.label} className="card p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className={`text-lg font-semibold mt-1 ${k.color}`}>{fmt.currency(k.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input text-sm w-44" value={statut} onChange={e => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS_FACTURE).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
        <input type="date" className="input text-sm" value={date_debut} onChange={e => setDateDebut(e.target.value)} placeholder="Date début" />
        <input type="date" className="input text-sm" value={date_fin} onChange={e => setDateFin(e.target.value)} placeholder="Date fin" />
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">N° Facture</th>
                <th className="table-header">Marché</th>
                <th className="table-header">Date</th>
                <th className="table-header">Échéance</th>
                <th className="table-header text-right">HT</th>
                <th className="table-header text-right">TTC</th>
                <th className="table-header text-right">Payé</th>
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
              {factures.map((f) => {
                const s = STATUTS_FACTURE[f.statut];
                return (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono text-brand-600 font-medium">{f.numero_facture}</td>
                    <td className="table-cell text-xs text-gray-500 max-w-[150px]">
                      <p className="truncate">{(f as any).numero_marche}</p>
                    </td>
                    <td className="table-cell">{fmt.date(f.date_facture)}</td>
                    <td className="table-cell">
                      {f.date_echeance ? (
                        <span className={new Date(f.date_echeance) < new Date() && f.statut !== 'payee' ? 'text-red-600 font-medium' : ''}>
                          {fmt.date(f.date_echeance)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-cell text-right">{fmt.currency(f.montant_ht)}</td>
                    <td className="table-cell text-right font-semibold">{fmt.currency(f.montant_ttc)}</td>
                    <td className="table-cell text-right text-green-600">{fmt.currency(f.montant_paye)}</td>
                    <td className="table-cell">
                      <span className={`badge ${s?.color}`}>{s?.label}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <Link href={`/factures/${f.id}`}
                          className="p-1.5 hover:bg-gray-100 rounded-lg" title="Voir">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        {f.statut === 'brouillon' && (
                          <button onClick={() => { if (confirm('Valider cette facture ?')) validerMut.mutate(f.id); }}
                            className="p-1.5 hover:bg-green-50 rounded-lg" title="Valider">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </button>
                        )}
                        {f.statut === 'validee' && (
                          <Link href={`/factures/${f.id}`}
                            className="p-1.5 hover:bg-blue-50 rounded-lg" title="Enregistrer paiement">
                            <DollarSign className="w-4 h-4 text-blue-500" />
                          </Link>
                        )}
                        {['brouillon','validee'].includes(f.statut) && (
                          <button onClick={() => { if (confirm('Annuler cette facture ?')) annulerMut.mutate(f.id); }}
                            className="p-1.5 hover:bg-red-50 rounded-lg" title="Annuler">
                            <XCircle className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !factures.length && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">Aucune facture</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {data?.pagination && data.pagination.total > 15 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{data.pagination.total} factures</span>
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
