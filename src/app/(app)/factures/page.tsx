'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Eye, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt, STATUTS_FACTURE } from '@/lib/utils';
import { Card, Badge, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import type { Facture } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

export default function FacturesPage() {
  const searchParams = useSearchParams();
  const marcheId     = searchParams.get('marche_id') || '';
  const qc           = useQueryClient();

  const [statut,     setStatut]     = useState('');
  const [date_debut, setDateDebut]  = useState('');
  const [date_fin,   setDateFin]    = useState('');
  const [page,       setPage]       = useState(1);

  const params = new URLSearchParams();
  if (marcheId) params.set('marche_id', marcheId);
  if (statut) params.set('statut', statut);
  if (date_debut) params.set('date_debut', date_debut);
  if (date_fin) params.set('date_fin', date_fin);
  params.set('page', String(page));
  params.set('limit', '15');

  const { data, isLoading } = useQuery({
    queryKey: ['factures', { marcheId, statut, date_debut, date_fin, page }],
    queryFn:  () => apiFetch(`/factures?${params.toString()}`),
  });

  const validerMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/factures/${id}/valider`, { method: 'PATCH' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['factures'] }); toast.success('Facture validée'); },
    onError:    () => toast.error('Erreur lors de la validation'),
  });

  const annulerMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/factures/${id}/annuler`, { method: 'PATCH' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['factures'] }); toast.success('Facture annulée'); },
    onError:    () => toast.error('Erreur lors de l\'annulation'),
  });

  const totaux = (data as any)?.totaux;
  const factures: Facture[] = data?.data || [];
  const pendingCount = factures.filter((f) => f.statut === 'validee').length;
  const overdueCount = factures.filter((f) => f.date_echeance && new Date(f.date_echeance) < new Date() && f.statut !== 'payee').length;

  const columns: TableColumn<Facture>[] = [
    { key: 'numero_facture', header: 'N° Facture', render: (f) => <span className="font-mono text-brand-600 font-medium">{f.numero_facture}</span> },
    { key: 'numero_marche', header: 'Marché', render: (f) => <p className="truncate max-w-[150px] text-xs text-gray-500">{(f as any).numero_marche}</p> },
    { key: 'date_facture', header: 'Date', render: (f) => fmt.date(f.date_facture) },
    {
      key: 'date_echeance', header: 'Échéance',
      render: (f) => f.date_echeance ? (
        <span className={new Date(f.date_echeance) < new Date() && f.statut !== 'payee' ? 'text-red-600 font-medium' : ''}>
          {fmt.date(f.date_echeance)}
        </span>
      ) : '—',
    },
    { key: 'montant_ht', header: 'HT', align: 'right', render: (f) => fmt.currency(f.montant_ht) },
    { key: 'montant_ttc', header: 'TTC', align: 'right', render: (f) => <span className="font-semibold">{fmt.currency(f.montant_ttc)}</span> },
    { key: 'montant_paye', header: 'Payé', align: 'right', render: (f) => <span className="text-green-600">{fmt.currency(f.montant_paye)}</span> },
    {
      key: 'statut', header: 'Statut',
      render: (f) => { const s = STATUTS_FACTURE[f.statut]; return <Badge className={s?.color}>{s?.label}</Badge>; },
    },
    {
      key: 'actions', header: 'Actions',
      render: (f) => (
        <div className="flex items-center gap-1">
          <Link href={`/factures/${f.id}`} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Voir">
            <Eye className="w-4 h-4 text-gray-500" />
          </Link>
          {f.statut === 'brouillon' && (
            <button onClick={() => { if (confirm('Valider cette facture ?')) validerMut.mutate(f.id); }}
              className="p-1.5 hover:bg-green-50 rounded-lg" title="Valider">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </button>
          )}
          {f.statut === 'validee' && (
            <Link href={`/factures/${f.id}`} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Enregistrer paiement">
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
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} factures</p>
        </div>
        <Link href="/factures/nouvelle">
          <Button size="sm" icon={<Plus className="w-4 h-4" />}>Nouvelle facture</Button>
        </Link>
      </div>

      {/* KPIs */}
      {totaux && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Total HT',              value: totaux.total_ht,   color: 'text-gray-900' },
            { label: 'Total TTC',              value: totaux.total_ttc,  color: 'text-brand-600 font-bold' },
            { label: 'Total payé',             value: totaux.payee,     color: 'text-green-600' },
            { label: 'En attente paiement',    value: totaux.validee,   color: 'text-orange-600' },
          ].map(k => (
            <Card key={k.label} className="p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className={`text-lg font-semibold mt-1 ${k.color}`}>{fmt.currency(k.value)}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-700">En attente</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{pendingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-700">Échéances dépassées</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{overdueCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-700">Montant TTC</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{fmt.currency(totaux?.total_ttc ?? 0)}</p>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="p-4 flex flex-wrap gap-3">
        <select className="input text-sm w-44" value={statut} onChange={e => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS_FACTURE).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
        <input type="date" className="input text-sm" value={date_debut} onChange={e => setDateDebut(e.target.value)} placeholder="Date début" />
        <input type="date" className="input text-sm" value={date_fin} onChange={e => setDateFin(e.target.value)} placeholder="Date fin" />
      </Card>

      {/* Tableau */}
      <Card padded={false}>
        <Table<Facture>
          columns={columns}
          data={factures}
          rowKey={(f) => f.id}
          loading={isLoading}
          emptyMessage="Aucune facture"
        />
        {data?.pagination && data.pagination.total > 15 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{data.pagination.total} factures</span>
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
