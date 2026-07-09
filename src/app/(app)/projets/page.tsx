// src/app/(app)/projets/page.tsx — Liste des projets (module Projets/Chantiers, Phase 3)
//
// Page minimale : liste + recherche + filtre statut. Consomme GET /api/projets
// (déjà existant, jamais utilisé par aucune page jusqu'ici). Aucune logique
// métier ajoutée — uniquement l'interface.
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Search } from 'lucide-react';
import Link from 'next/link';
import { fmt } from '@/lib/utils';
import { Card, Badge, Table, Loading, EmptyState, Input } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string) =>
  fetch(`${API}/api${url}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => r.json());

type Projet = {
  id: string;
  nom: string;
  code_projet: string;
  statut: string;
  chef_projet_nom: string | null;
  budget_total: string;
  total_depenses: string;
  avancement_global: number;
  localisation: string | null;
};

const STATUT_COLOR: Record<string, string> = {
  nouveau: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-emerald-100 text-emerald-700',
  annule: 'bg-red-100 text-red-700',
};

export default function ProjetsPage() {
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projets', { search, statut }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (statut) params.set('statut', statut);
      return apiFetch(`/projets?${params.toString()}`);
    },
  });

  const projets: Projet[] = data?.data || [];

  const columns: TableColumn<Projet>[] = [
    {
      key: 'nom', header: 'Projet',
      render: (p) => (
        <div>
          <Link href={`/projets/${p.id}`} className="font-medium text-brand-600 hover:underline">{p.nom}</Link>
          <p className="text-xs text-gray-400">{p.code_projet}</p>
        </div>
      ),
    },
    {
      key: 'statut', header: 'Statut',
      render: (p) => <Badge tone="gray" className={STATUT_COLOR[p.statut] || 'bg-gray-100 text-gray-700'}>{p.statut}</Badge>,
    },
    { key: 'chef_projet_nom', header: 'Chef de projet', render: (p) => p.chef_projet_nom || '—' },
    { key: 'avancement_global', header: 'Avancement', align: 'right', render: (p) => fmt.pct(p.avancement_global) },
    { key: 'budget_total', header: 'Budget', align: 'right', render: (p) => fmt.currency(p.budget_total) },
    { key: 'total_depenses', header: 'Dépenses', align: 'right', render: (p) => fmt.currency(p.total_depenses) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FolderKanban className="w-6 h-6 text-brand-500" /> Projets
          </h1>
          <p className="text-sm text-gray-500 mt-1">{projets.length} projet(s)</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Rechercher un projet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            className="flex-1 min-w-[200px]"
          />
          <select className="input text-sm w-48" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="nouveau">Nouveau</option>
            <option value="en_cours">En cours</option>
            <option value="annule">Annulé</option>
          </select>
        </div>
      </Card>

      {isLoading && <Loading label="Chargement des projets..." />}

      {!isLoading && !projets.length && (
        <EmptyState icon={FolderKanban} title="Aucun projet" description="Aucun projet ne correspond à ces filtres." />
      )}

      {!isLoading && !!projets.length && (
        <Card padded={false}>
          <Table<Projet> columns={columns} data={projets} rowKey={(p) => p.id} />
        </Card>
      )}
    </div>
  );
}
