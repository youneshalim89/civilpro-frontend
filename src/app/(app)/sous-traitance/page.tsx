'use client';
// src/app/(app)/sous-traitance/page.tsx — Sous-traitants (Chantier ST-B)
// Module autonome (séparé de RH et Marchés) — voir docs/modules/SOUS_TRAITANCE_ARCHITECTURE.md
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Ban, RotateCcw, Handshake } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, Table, Badge, Button, Modal, Input, EmptyState, Loading, Tabs } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

type SousTraitant = {
  id: string; raison_sociale: string; nom_commercial: string | null; ice: string | null;
  identifiant_fiscal: string | null; registre_commerce: string | null;
  contact: string | null; telephone: string | null; email: string | null;
  adresse: string | null; ville: string | null; statut: string;
};

const emptyForm = {
  raison_sociale: '', nom_commercial: '', ice: '', identifiant_fiscal: '', registre_commerce: '',
  contact: '', telephone: '', email: '', adresse: '', ville: '',
};

export default function SousTraitantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [avecInactifs, setAvecInactifs] = useState(false);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edite, setEdite] = useState<SousTraitant | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['sous-traitants', avecInactifs],
    queryFn: () => apiFetch(`/sous-traitants?avec_inactifs=${avecInactifs}`).then(r => r.data || []),
  });
  const sousTraitants: SousTraitant[] = data || [];

  const filtered = sousTraitants.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${s.raison_sociale} ${s.ville || ''} ${s.ice || ''}`.toLowerCase().includes(q);
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sous-traitants'] });

  const creerMut = useMutation({
    mutationFn: () => apiFetch('/sous-traitants', { method: 'POST', body: JSON.stringify(form) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidate(); toast.success('Sous-traitant créé'); setModalOuvert(false); setForm(emptyForm); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la création'),
  });

  const modifierMut = useMutation({
    mutationFn: () => apiFetch(`/sous-traitants/${edite!.id}`, { method: 'PUT', body: JSON.stringify(form) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidate(); toast.success('Sous-traitant modifié'); setModalOuvert(false); setEdite(null); setForm(emptyForm); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la modification'),
  });

  const toggleStatutMut = useMutation({
    mutationFn: (s: SousTraitant) => apiFetch(`/sous-traitants/${s.id}`, {
      method: 'PUT', body: JSON.stringify({ statut: s.statut === 'actif' ? 'inactif' : 'actif' }),
    }).then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: (_r, s) => { invalidate(); toast.success(s.statut === 'actif' ? 'Sous-traitant désactivé' : 'Sous-traitant réactivé'); },
    onError: (err: any) => toast.error(err.message || 'Erreur'),
  });

  const ouvrirCreation = () => { setEdite(null); setForm(emptyForm); setModalOuvert(true); };
  const ouvrirModification = (s: SousTraitant) => {
    setEdite(s);
    setForm({
      raison_sociale: s.raison_sociale || '', nom_commercial: s.nom_commercial || '', ice: s.ice || '',
      identifiant_fiscal: s.identifiant_fiscal || '', registre_commerce: s.registre_commerce || '',
      contact: s.contact || '', telephone: s.telephone || '', email: s.email || '',
      adresse: s.adresse || '', ville: s.ville || '',
    });
    setModalOuvert(true);
  };

  const columns: TableColumn<SousTraitant>[] = [
    { key: 'raison_sociale', header: 'Raison sociale', render: s => <span className="font-medium text-gray-800">{s.raison_sociale}</span> },
    { key: 'ville', header: 'Ville', render: s => s.ville || <span className="text-gray-300">—</span> },
    { key: 'telephone', header: 'Téléphone', render: s => s.telephone || <span className="text-gray-300">—</span> },
    { key: 'ice', header: 'ICE', render: s => <span className="font-mono text-xs">{s.ice || '—'}</span> },
    { key: 'contact', header: 'Contact', render: s => s.contact || <span className="text-gray-300">—</span> },
    { key: 'statut', header: 'Statut', render: s => (
      <Badge tone="gray" className={s.statut === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
        {s.statut === 'actif' ? 'Actif' : 'Inactif'}
      </Badge>
    ) },
    { key: 'actions', header: 'Actions', render: s => (
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />}
          data-testid={`modifier-st-${s.id}`} onClick={() => ouvrirModification(s)}>Modifier</Button>
        <Button size="sm" variant="ghost" icon={s.statut === 'actif' ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
          data-testid={`toggle-statut-st-${s.id}`} loading={toggleStatutMut.isPending}
          onClick={() => toggleStatutMut.mutate(s)}>
          {s.statut === 'actif' ? 'Désactiver' : 'Réactiver'}
        </Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sous-traitance</h1>
          <p className="text-sm text-gray-500">{sousTraitants.length} sous-traitant(s)</p>
        </div>
        <Button data-testid="ouvrir-creation-st" onClick={ouvrirCreation} icon={<Plus className="w-4 h-4" />}>Nouveau sous-traitant</Button>
      </div>

      <Tabs items={[
        { label: 'Sous-traitants', href: '/sous-traitance' },
        { label: 'Contrats', href: '/sous-traitance/contrats' },
      ]} />

      <Card className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Rechercher (raison sociale, ville, ICE)..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
          <input type="checkbox" checked={avecInactifs} onChange={e => setAvecInactifs(e.target.checked)} />
          Afficher les sous-traitants désactivés
        </label>
      </Card>

      {isLoading ? <Loading label="Chargement des sous-traitants..." /> : filtered.length === 0 ? (
        <EmptyState icon={Handshake} title="Aucun sous-traitant" description="Aucun sous-traitant ne correspond aux filtres actuels." />
      ) : (
        <Card padded={false}>
          <Table<SousTraitant> columns={columns} data={filtered} rowKey={s => s.id} loading={isLoading} emptyMessage="Aucun sous-traitant" />
        </Card>
      )}

      <Modal open={modalOuvert} onClose={() => { setModalOuvert(false); setEdite(null); }}
        title={edite ? `Modifier — ${edite.raison_sociale}` : 'Nouveau sous-traitant'}>
        <div className="space-y-4">
          <div>
            <label className="label">Raison sociale *</label>
            <input className="input" data-testid="st-form-raison-sociale" value={form.raison_sociale}
              onChange={e => setForm(f => ({ ...f, raison_sociale: e.target.value }))} placeholder="Ex: Étanchéité Atlas SARL" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nom commercial</label>
              <input className="input" value={form.nom_commercial} onChange={e => setForm(f => ({ ...f, nom_commercial: e.target.value }))} />
            </div>
            <div>
              <label className="label">Ville</label>
              <input className="input" value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">ICE</label>
              <input className="input" value={form.ice} onChange={e => setForm(f => ({ ...f, ice: e.target.value }))} />
            </div>
            <div>
              <label className="label">Identifiant fiscal</label>
              <input className="input" value={form.identifiant_fiscal} onChange={e => setForm(f => ({ ...f, identifiant_fiscal: e.target.value }))} />
            </div>
            <div>
              <label className="label">Registre de commerce</label>
              <input className="input" value={form.registre_commerce} onChange={e => setForm(f => ({ ...f, registre_commerce: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Contact</label>
              <input className="input" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="confirmer-st-form"
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
