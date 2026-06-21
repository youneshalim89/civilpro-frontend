'use client';
// src/app/(app)/marches/page.tsx — Liste des marchés
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Search, Filter, Eye, Edit2, TrendingUp, FileDown, Download } from 'lucide-react';
import { marchesService } from '@/lib/api';
import { fmt, STATUTS_MARCHE, exportCSV } from '@/lib/utils';
import { exportListPDF } from '@/lib/pdf';
import type { Marche } from '@/lib/api';

export default function MarchesPage() {
  const [search,  setSearch]  = useState('');
  const [statut,  setStatut]  = useState('');
  const [page,    setPage]    = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['marches', { search, statut, page }],
    queryFn:  () => marchesService.list({ search, statut, page, limit: 15 }).then(r => r.data),
  });

  const marches: Marche[] = data?.data || [];

  const handleExportCSV = () => {
    exportCSV('Marches.csv',
      ['N° Marché','Objet','Maître d\'ouvrage','Montant initial','Avancement %','Échéance','Statut'],
      marches.map(m => [m.numero_marche, m.objet, m.maitre_ouvrage, m.montant_initial, m.avancement_physique, fmt.date(m.date_fin_prevue), STATUTS_MARCHE[m.statut]?.label || m.statut]));
  };

  const handleExportPDF = () => {
    exportListPDF({
      title: 'MARCHÉS', subtitle: `${marches.length} marché(s)`, filename: 'Marches.pdf',
      head: ['N° Marché','Objet','Maître d\'ouvrage','Montant initial','Avancement','Échéance','Statut'],
      body: marches.map(m => [m.numero_marche, m.objet, m.maitre_ouvrage, fmt.currency(m.montant_initial), fmt.pct(m.avancement_physique), fmt.date(m.date_fin_prevue), STATUTS_MARCHE[m.statut]?.label || m.statut]),
      rightAlignCols: [3, 4],
    });
  };

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marchés</h1>
          <p className="text-sm text-gray-500">
            {data?.pagination?.total ?? 0} marchés au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-sm flex items-center gap-2">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <Link href="/marches/nouveau" className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau marché
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Rechercher un marché..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input text-sm w-44"
          value={statut}
          onChange={e => { setStatut(e.target.value); setPage(1); }}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS_MARCHE).map(([v, s]) => (
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
                <th className="table-header">N° Marché / Caisse</th>
                <th className="table-header">Objet</th>
                <th className="table-header">Maître d'ouvrage</th>
                <th className="table-header">Montant</th>
                <th className="table-header">Avancement</th>
                <th className="table-header">Échéance</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && data?.data?.map((m: Marche) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <p className="font-mono font-medium text-brand-600">{m.numero_marche}</p>
                    <p className={`text-xs font-semibold ${Number(m.solde_caisse) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Caisse : {fmt.currency(m.solde_caisse || 0)}
                    </p>
                  </td>
                  <td className="table-cell max-w-[200px]">
                    <p className="truncate font-medium text-gray-800">{m.objet}</p>
                  </td>
                  <td className="table-cell text-gray-600">{m.maitre_ouvrage}</td>
                  <td className="table-cell font-semibold">{fmt.currency(m.montant_initial)}</td>
                  <td className="table-cell w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-brand-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${m.avancement_physique}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">
                        {fmt.pct(m.avancement_physique)}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell text-sm">
                    {m.date_fin_prevue ? (
                      <span className={typeof m.jours_restants === 'number' && m.jours_restants < 30 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {fmt.date(m.date_fin_prevue)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${STATUTS_MARCHE[m.statut]?.color}`}>
                      {STATUTS_MARCHE[m.statut]?.label}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <Link href={`/marches/${m.id}`}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Voir">
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Link>
                      <Link href={`/marches/${m.id}/modifier`}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Modifier">
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </Link>
                      <Link href={`/situations/recap/${m.id}`}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Récapitulatif">
                        <TrendingUp className="w-4 h-4 text-gray-500" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.data?.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Aucun marché trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pagination && (data.pagination.pages ?? 0) > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{data.pagination.total} marchés</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
              >Précédent</button>
              <span className="px-3 py-1.5">{page} / {data.pagination.pages}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= (data.pagination.pages ?? page + 1)}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
              >Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
