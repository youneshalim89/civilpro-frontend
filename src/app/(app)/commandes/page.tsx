'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Eye, Truck, X, CheckCircle, FileDown, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt, STATUTS_COMMANDE, exportCSV } from '@/lib/utils';
import { exportListPDF } from '@/lib/pdf';
import { Card, Badge, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import type { Commande } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

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

  const params = new URLSearchParams();
  if (marcheId) params.set('marche_id', marcheId);
  if (statut) params.set('statut', statut);
  params.set('page', String(page));
  params.set('limit', '15');

  const { data, isLoading } = useQuery({
    queryKey: ['commandes', { marcheId, statut, page }],
    queryFn:  () => apiFetch(`/commandes?${params.toString()}`),
  });

  const statutMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      apiFetch(`/commandes/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut: next }) })
        .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commandes'] }); toast.success('Statut mis à jour'); },
    onError:   () => toast.error('Erreur lors de la mise à jour'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/commandes/${id}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['commandes'] }); toast.success('Commande supprimée'); },
    onError:    (err: any) => toast.error(err.message || 'Erreur'),
  });

  const commandes: Commande[] = data?.data || [];

  // Totaux
  const totalHT  = commandes.reduce((s, c) => s + parseFloat(String(c.total_ht)),  0);
  const totalTTC = commandes.reduce((s, c) => s + parseFloat(String(c.total_ttc)), 0);
  const aConfirmer = commandes.filter((c) => c.statut === 'en_attente').length;
  const aLivrer = commandes.filter((c) => ['confirmee', 'en_cours_livraison'].includes(c.statut)).length;
  const enRetard = commandes.filter((c) => {
    const isLate = c.date_livraison_prevue && new Date(c.date_livraison_prevue) < new Date() && !['livree', 'annulee'].includes(c.statut);
    return isLate;
  }).length;

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

  const columns: TableColumn<Commande>[] = [
    { key: 'numero_commande', header: 'N° Commande', render: (c) => <span className="font-mono font-medium text-brand-600">{c.numero_commande}</span> },
    { key: 'numero_marche', header: 'Marché', render: (c) => <span className="text-xs text-gray-500">{(c as any).numero_marche || '—'}</span> },
    { key: 'fournisseur_nom', header: 'Fournisseur', render: (c) => <span className="text-gray-700">{c.fournisseur_nom || '—'}</span> },
    { key: 'date_commande', header: 'Date', render: (c) => fmt.date(c.date_commande) },
    {
      key: 'date_livraison_prevue', header: 'Livraison prévue',
      render: (c) => {
        const isLate = c.date_livraison_prevue && new Date(c.date_livraison_prevue) < new Date() && !['livree','annulee'].includes(c.statut);
        return <span className={isLate ? 'text-red-600 font-medium' : ''}>{fmt.date(c.date_livraison_prevue)}</span>;
      },
    },
    { key: 'total_ht', header: 'Total HT', align: 'right', render: (c) => fmt.currency(c.total_ht) },
    { key: 'total_ttc', header: 'Total TTC', align: 'right', render: (c) => <span className="font-semibold">{fmt.currency(c.total_ttc)}</span> },
    {
      key: 'statut', header: 'Statut',
      render: (c) => { const s = STATUTS_COMMANDE[c.statut]; return <Badge className={s?.color}>{s?.label}</Badge>; },
    },
    {
      key: 'actions', header: 'Actions',
      render: (c) => {
        const nextSteps = STATUTS_TRANSITION[c.statut] || [];
        return (
          <div className="flex items-center gap-1">
            <Link href={`/commandes/${c.id}`} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Voir">
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
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} commandes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExportCSV}>CSV</Button>
          <Button variant="secondary" size="sm" icon={<FileDown className="w-4 h-4" />} onClick={handleExportPDF}>PDF</Button>
          <Link href="/commandes/nouvelle">
            <Button size="sm" icon={<Plus className="w-4 h-4" />}>Nouvelle commande</Button>
          </Link>
        </div>
      </div>

      {/* KPIs rapides */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'À confirmer', value: aConfirmer },
          { label: 'À livrer', value: aLivrer },
          { label: 'En retard', value: enRetard },
          { label: 'Montant TTC', value: fmt.currency(totalTTC) },
        ].map(k => (
          <Card key={k.label} className="p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Filtre statut */}
      <Card className="p-4 flex gap-3">
        <select className="input text-sm w-52" value={statut} onChange={e => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS_COMMANDE).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
      </Card>

      {/* Tableau */}
      <Card padded={false}>
        <Table<Commande>
          columns={columns}
          data={commandes}
          rowKey={(c) => c.id}
          loading={isLoading}
          emptyMessage="Aucune commande"
        />
        {data?.pagination && data.pagination.total > 15 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{data.pagination.total} commandes</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Précédent</Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.pagination.total / 15)}>Suivant</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
