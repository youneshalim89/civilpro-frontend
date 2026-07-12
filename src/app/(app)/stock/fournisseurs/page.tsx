'use client';
// src/app/(app)/stock/fournisseurs/page.tsx — Gestion des fournisseurs (Chantier Fournisseurs-1)
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Ban, RotateCcw, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, Table, Badge, Button, Modal, Input, EmptyState, Loading, Tabs } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

type Fournisseur = {
  id: string; raison_sociale: string; ville: string | null; telephone: string | null;
  ice: string | null; contact: string | null; email: string | null; statut: string;
};

const emptyForm = { raison_sociale: '', ville: '', telephone: '', ice: '', contact: '', email: '' };

export default function FournisseursPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [avecInactifs, setAvecInactifs] = useState(false);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edite, setEdite] = useState<Fournisseur | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['fournisseurs', avecInactifs],
    queryFn: () => apiFetch(`/stock/fournisseurs?avec_inactifs=${avecInactifs}`).then(r => r.data || []),
  });
  const fournisseurs: Fournisseur[] = data || [];

  const filtered = fournisseurs.filter(f => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${f.raison_sociale} ${f.ville || ''} ${f.ice || ''}`.toLowerCase().includes(s);
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['fournisseurs'] });

  const creerMut = useMutation({
    mutationFn: () => apiFetch('/stock/fournisseurs', { method: 'POST', body: JSON.stringify(form) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidate(); toast.success('Fournisseur créé'); setModalOuvert(false); setForm(emptyForm); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la création'),
  });

  const modifierMut = useMutation({
    mutationFn: () => apiFetch(`/stock/fournisseurs/${edite!.id}`, { method: 'PUT', body: JSON.stringify(form) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidate(); toast.success('Fournisseur modifié'); setModalOuvert(false); setEdite(null); setForm(emptyForm); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la modification'),
  });

  const toggleStatutMut = useMutation({
    mutationFn: (f: Fournisseur) => apiFetch(`/stock/fournisseurs/${f.id}`, {
      method: 'PUT', body: JSON.stringify({ statut: f.statut === 'actif' ? 'inactif' : 'actif' }),
    }).then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: (_r, f) => { invalidate(); toast.success(f.statut === 'actif' ? 'Fournisseur désactivé' : 'Fournisseur réactivé'); },
    onError: (err: any) => toast.error(err.message || 'Erreur'),
  });

  const ouvrirCreation = () => { setEdite(null); setForm(emptyForm); setModalOuvert(true); };
  const ouvrirModification = (f: Fournisseur) => {
    setEdite(f);
    setForm({
      raison_sociale: f.raison_sociale || '', ville: f.ville || '', telephone: f.telephone || '',
      ice: f.ice || '', contact: f.contact || '', email: f.email || '',
    });
    setModalOuvert(true);
  };

  const columns: TableColumn<Fournisseur>[] = [
    { key: 'raison_sociale', header: 'Raison sociale', render: f => <span className="font-medium text-gray-800">{f.raison_sociale}</span> },
    { key: 'ville', header: 'Ville', render: f => f.ville || <span className="text-gray-300">—</span> },
    { key: 'telephone', header: 'Téléphone', render: f => f.telephone || <span className="text-gray-300">—</span> },
    { key: 'ice', header: 'ICE', render: f => <span className="font-mono text-xs">{f.ice || '—'}</span> },
    { key: 'contact', header: 'Contact', render: f => f.contact || <span className="text-gray-300">—</span> },
    { key: 'statut', header: 'Statut', render: f => (
      <Badge tone="gray" className={f.statut === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
        {f.statut === 'actif' ? 'Actif' : 'Inactif'}
      </Badge>
    ) },
    { key: 'actions', header: 'Actions', render: f => (
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />}
          data-testid={`modifier-fournisseur-${f.id}`} onClick={() => ouvrirModification(f)}>Modifier</Button>
        <Button size="sm" variant="ghost" icon={f.statut === 'actif' ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
          data-testid={`toggle-statut-fournisseur-${f.id}`} loading={toggleStatutMut.isPending}
          onClick={() => toggleStatutMut.mutate(f)}>
          {f.statut === 'actif' ? 'Désactiver' : 'Réactiver'}
        </Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fournisseurs</h1>
          <p className="text-sm text-gray-500">{fournisseurs.length} fournisseur(s)</p>
        </div>
        <Button data-testid="ouvrir-creation-fournisseur" onClick={ouvrirCreation} icon={<Plus className="w-4 h-4" />}>Nouveau fournisseur</Button>
      </div>

      <Tabs items={[
        { label: 'Matériaux', href: '/stock' },
        { label: 'Fournisseurs', href: '/stock/fournisseurs' },
      ]} />

      <Card className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Rechercher (raison sociale, ville, ICE)..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
          <input type="checkbox" checked={avecInactifs} onChange={e => setAvecInactifs(e.target.checked)} />
          Afficher les fournisseurs désactivés
        </label>
      </Card>

      {isLoading ? <Loading label="Chargement des fournisseurs..." /> : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Aucun fournisseur" description="Aucun fournisseur ne correspond aux filtres actuels." />
      ) : (
        <Card padded={false}>
          <Table<Fournisseur> columns={columns} data={filtered} rowKey={f => f.id} loading={isLoading} emptyMessage="Aucun fournisseur" />
        </Card>
      )}

      <Modal open={modalOuvert} onClose={() => { setModalOuvert(false); setEdite(null); }}
        title={edite ? `Modifier — ${edite.raison_sociale}` : 'Nouveau fournisseur'}>
        <div className="space-y-4">
          <div>
            <label className="label">Raison sociale *</label>
            <input className="input" data-testid="fournisseur-form-raison-sociale" value={form.raison_sociale}
              onChange={e => setForm(f => ({ ...f, raison_sociale: e.target.value }))} placeholder="Ex: Ciment du Maroc SARL" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ville</label>
              <input className="input" value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ICE</label>
              <input className="input" value={form.ice} onChange={e => setForm(f => ({ ...f, ice: e.target.value }))} placeholder="Identifiant Commun de l'Entreprise" />
            </div>
            <div>
              <label className="label">Contact</label>
              <input className="input" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="confirmer-fournisseur-form"
            onClick={() => edite ? modifierMut.mutate() : creerMut.mutate()}
            loading={creerMut.isPending || modifierMut.isPending} disabled={!form.raison_sociale}>
            {edite ? 'Enregistrer' : 'Créer'}
          </Button>
          <Button variant="secondary" onClick={() => { setModalOuvert(false); setEdite(null); }}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}
