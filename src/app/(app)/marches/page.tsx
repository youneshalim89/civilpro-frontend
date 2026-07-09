'use client';
// src/app/(app)/marches/page.tsx — Liste des marchés (Chantier C : migration Design System V2)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, Eye, Edit2, TrendingUp, FileDown, Download } from 'lucide-react';
import { marchesService } from '@/lib/api';
import { fmt, STATUTS_MARCHE, exportCSV } from '@/lib/utils';
import { exportListPDF } from '@/lib/pdf';
import { MarcheStatutBadge } from '@/components/marches/MarcheStatutBadge';
import { Card, Table, Input, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import type { Marche } from '@/lib/api';

export default function MarchesPage() {
  const searchParams = useSearchParams();
  const projetId     = searchParams.get('projet_id') || '';
  const [search,  setSearch]  = useState('');
  const [statut,  setStatut]  = useState('');
  const [page,    setPage]    = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['marches', { search, statut, page, projetId }],
    queryFn:  () => marchesService.list({ search, statut, page, limit: 15, projet_id: projetId || undefined }).then(r => r.data),
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

  const columns: TableColumn<Marche>[] = [
    {
      key: 'numero_marche', header: 'N° Marché / Caisse',
      render: (m) => (
        <>
          <p className="font-mono font-medium text-brand-600">{m.numero_marche}</p>
          <p className={`text-xs font-semibold ${Number(m.solde_caisse) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Caisse : {fmt.currency(m.solde_caisse || 0)}
          </p>
        </>
      ),
    },
    {
      key: 'objet', header: 'Objet',
      render: (m) => <p className="truncate max-w-[200px] font-medium text-gray-800">{m.objet}</p>,
    },
    {
      key: 'maitre_ouvrage', header: "Maître d'ouvrage",
      render: (m) => <span className="text-gray-600">{m.maitre_ouvrage}</span>,
    },
    {
      key: 'projet_lie', header: 'Projet lié',
      render: (m) => m.projet_id ? (
        <Link href={`/projets/${m.projet_id}`} className="text-brand-600 hover:underline font-medium text-sm">
          {m.projet_code || m.projet_nom}
        </Link>
      ) : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: 'montant_initial', header: 'Montant',
      render: (m) => <span className="font-semibold">{fmt.currency(m.montant_initial)}</span>,
    },
    {
      key: 'avancement_physique', header: 'Avancement',
      render: (m) => (
        <div className="w-40 flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{ width: `${m.avancement_physique}%` }} />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right">{fmt.pct(m.avancement_physique)}</span>
        </div>
      ),
    },
    {
      key: 'date_fin_prevue', header: 'Échéance',
      render: (m) => m.date_fin_prevue ? (
        <span className={`text-sm ${typeof m.jours_restants === 'number' && m.jours_restants < 30 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
          {fmt.date(m.date_fin_prevue)}
        </span>
      ) : <span className="text-sm">—</span>,
    },
    {
      key: 'statut', header: 'Statut',
      render: (m) => <MarcheStatutBadge statut={m.statut} />,
    },
    {
      key: 'actions', header: 'Actions',
      render: (m) => (
        <div className="flex items-center gap-1">
          <Link href={`/marches/${m.id}`} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Voir">
            <Eye className="w-4 h-4 text-gray-500" />
          </Link>
          <Link href={`/marches/${m.id}/modifier`} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Modifier">
            <Edit2 className="w-4 h-4 text-gray-500" />
          </Link>
          <Link href={`/situations/recap/${m.id}`} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Récapitulatif">
            <TrendingUp className="w-4 h-4 text-gray-500" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marchés</h1>
          <p className="text-sm text-gray-500">
            {data?.pagination?.total ?? 0} marché{(data?.pagination?.total ?? 0) > 1 ? 's' : ''} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExportCSV} icon={<Download className="w-4 h-4" />}>CSV</Button>
          <Button variant="secondary" onClick={handleExportPDF} icon={<FileDown className="w-4 h-4" />}>PDF</Button>
          <Link href="/marches/nouveau" className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau marché
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Rechercher un marché..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              icon={<Search className="w-4 h-4" />}
              className="text-sm"
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
      </Card>

      {/* Tableau */}
      <Card padded={false}>
        <Table<Marche>
          columns={columns}
          data={marches}
          rowKey={(m) => m.id}
          loading={isLoading}
          emptyMessage="Aucun marché trouvé"
        />

        {/* Pagination */}
        {data?.pagination && (data.pagination.pages ?? 0) > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{data.pagination.total} marchés</span>
            <div className="flex gap-2">
              <Button
                variant="secondary" size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >Précédent</Button>
              <span className="px-3 py-1.5">{page} / {data.pagination.pages}</span>
              <Button
                variant="secondary" size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= (data.pagination.pages ?? page + 1)}
              >Suivant</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
