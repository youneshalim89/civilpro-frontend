'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Eye, DollarSign, BarChart3, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt, STATUTS_SITUATION } from '@/lib/utils';
import { Card, Badge, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import type { Situation } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

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

  const params = new URLSearchParams();
  if (marcheId) params.set('marche_id', marcheId);
  if (statut) params.set('statut', statut);
  params.set('page', String(page));
  params.set('limit', '15');

  const { data, isLoading } = useQuery({
    queryKey: ['situations', { marcheId, statut, page }],
    queryFn:  () => apiFetch(`/situations?${params.toString()}`),
  });

  const statutMut = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) =>
      apiFetch(`/situations/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut: s }) })
        .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['situations'] }); toast.success('Statut mis à jour'); },
    onError:    () => toast.error('Erreur'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/situations/${id}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['situations'] }); toast.success('Décompte supprimé'); },
    onError:    (err: any) => toast.error(err.message || 'Erreur lors de la suppression'),
  });

  const situations: Situation[] = data?.data || [];

  const columns: TableColumn<Situation>[] = [
    { key: 'numero_situation', header: 'N°', render: (s) => <span className="font-bold text-brand-600">N°{s.numero_situation}</span> },
    { key: 'numero_marche', header: 'Marché', render: (s) => <span className="text-xs text-gray-500">{(s as any).numero_marche || '—'}</span> },
    { key: 'type_situation', header: 'Type', render: (s) => <span className="text-xs">{TYPE_LABELS[s.type_situation]}</span> },
    {
      key: 'periode', header: 'Période',
      render: (s) => <span className="text-xs">{fmt.date(s.periode_debut)} → {fmt.date(s.periode_fin)}</span>,
    },
    {
      key: 'avancement_financier', header: 'Av. financier', align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${s.avancement_financier}%` }} />
          </div>
          <span className="text-xs w-10 text-right">{fmt.pct(s.avancement_financier)}</span>
        </div>
      ),
    },
    { key: 'montant_brut', header: 'Montant brut', align: 'right', render: (s) => fmt.currency(s.montant_brut) },
    { key: 'retenue_garantie', header: 'Retenue G.', align: 'right', render: (s) => <span className="text-red-500">{fmt.currency(s.retenue_garantie)}</span> },
    { key: 'montant_net', header: 'Montant net', align: 'right', render: (s) => <span className="font-semibold text-green-700">{fmt.currency(s.montant_net)}</span> },
    {
      key: 'statut', header: 'Statut',
      render: (s) => { const st = STATUTS_SITUATION[s.statut]; return <Badge className={st?.color}>{st?.label}</Badge>; },
    },
    {
      key: 'actions', header: 'Actions',
      render: (s) => (
        <div className="flex items-center gap-1">
          <Link href={`/situations/${s.id}`} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Voir">
            <Eye className="w-4 h-4 text-gray-500" />
          </Link>
          {s.statut === 'en_cours' && (
            <button onClick={() => { if (confirm('Marquer ce décompte comme approuvé et payé ?')) statutMut.mutate({ id: s.id, s: 'paye' }); }}
              className="p-1.5 hover:bg-emerald-50 rounded-lg" title="Marquer payé">
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </button>
          )}
          <button onClick={() => {
            const msg = s.statut === 'paye'
              ? `⚠️ Ce décompte N°${s.numero_situation} est déjà PAYÉ. Le supprimer retirera son montant du "Montant Entrée". Continuer ?`
              : `Supprimer le décompte N°${s.numero_situation} ?`;
            if (confirm(msg)) deleteMut.mutate(s.id);
          }} className="p-1.5 hover:bg-red-50 rounded-lg" title="Supprimer (erreur de saisie)">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
          <Link href={`/situations/recap/${(s as any).marche_id}`} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Récapitulatif">
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Situations & Décomptes</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} décomptes</p>
        </div>
        <Link href="/situations/nouvelle">
          <Button size="sm" icon={<Plus className="w-4 h-4" />}>Nouveau décompte</Button>
        </Link>
      </div>

      {/* Filtres */}
      <Card className="p-4 flex gap-3">
        <select className="input text-sm w-48" value={statut} onChange={e => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS_SITUATION).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
      </Card>

      <Card padded={false}>
        <Table<Situation>
          columns={columns}
          data={situations}
          rowKey={(s) => s.id}
          loading={isLoading}
          emptyMessage="Aucun décompte"
        />
        {data?.pagination && data.pagination.total > 15 && (
          <div className="px-4 py-3 border-t flex justify-between text-sm text-gray-500">
            <span>{data.pagination.total} décomptes</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Précédent</Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)}>Suivant</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
