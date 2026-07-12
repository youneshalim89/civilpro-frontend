'use client';
// src/app/(app)/stock/page.tsx — Gestion des stocks (matériaux), Design System V2
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, AlertTriangle, Download, FileDown, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt, exportCSV } from '@/lib/utils';
import { exportListPDF } from '@/lib/pdf';
import { Card, CardHeader, Table, Badge, Button, Modal, StatCard, Input, Tabs } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import NumberInput from '@/components/NumberInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '';
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

type Materiau = {
  id: string; designation: string; categorie_nom: string; categorie_type: string;
  unite_mesure: string; quantite_stock: number; quantite_min: number;
  prix_unitaire_ht: number; statut: string; niveau_stock: string;
};

type Alerte = {
  id: string; designation: string; reference: string | null;
  quantite_stock: number; seuil_alerte: number; unite_mesure: string; statut: string;
};

type MouvementRow = {
  id: string; materiau_id: string; materiau_nom: string; unite_mesure: string;
  type_mouvement: 'entree' | 'sortie' | 'retour' | 'ajustement';
  quantite: number; quantite_avant: number | null; quantite_apres: number | null;
  raison: string | null; effectue_par_nom: string | null; created_at: string;
  projet_nom?: string | null;
};

const NIVEAU_COLOR: Record<string, string> = {
  rupture: 'bg-red-100 text-red-700',
  bas:     'bg-yellow-100 text-yellow-700',
  ok:      'bg-green-100 text-green-700',
};

const TYPE_MOUVEMENT_LABEL: Record<string, string> = {
  entree: 'Entrée', sortie: 'Sortie', retour: 'Retour', ajustement: 'Ajustement',
};
const TYPE_MOUVEMENT_COLOR: Record<string, string> = {
  entree: 'bg-green-100 text-green-700', sortie: 'bg-red-100 text-red-700',
  retour: 'bg-blue-100 text-blue-700', ajustement: 'bg-purple-100 text-purple-700',
};

const emptyMouvementForm = { type_mouvement: 'entree' as MouvementRow['type_mouvement'], quantite: 0, raison: '' };

export default function StockPage() {
  const qc = useQueryClient();
  const [type,   setType]   = useState('');
  const [search, setSearch] = useState('');
  const [mouvementMateriau, setMouvementMateriau] = useState<Materiau | null>(null);
  const [form, setForm] = useState(emptyMouvementForm);

  const { data: mats, isLoading } = useQuery({
    queryKey: ['stock-materiaux', { type, search }],
    queryFn:  () => apiFetch(`/stock/materiaux?${new URLSearchParams({ type, search }).toString()}`).then(r => r.data || []),
  });

  const { data: cats } = useQuery({
    queryKey: ['stock-categories'],
    queryFn:  () => apiFetch('/stock/categories').then(r => r.data || []),
  });

  const { data: alertesData, isLoading: loadingAlertes } = useQuery({
    queryKey: ['stock-alertes'],
    queryFn:  () => apiFetch('/stock/alertes').then(r => r.data || []),
  });

  const { data: historiqueData, isLoading: loadingHistorique } = useQuery({
    queryKey: ['stock-mouvements'],
    queryFn:  () => apiFetch('/stock/mouvements?limit=20').then(r => r.data || []),
  });

  const materiaux: Materiau[] = mats || [];
  const alertes: Alerte[] = alertesData || [];
  const historique: MouvementRow[] = historiqueData || [];
  const types = Array.from(new Set((cats || []).map((c: any) => c.type).filter(Boolean))) as string[];

  const valeurTotale = materiaux.reduce((s, m) => s + (m.quantite_stock * m.prix_unitaire_ht), 0);
  const ruptureCount = materiaux.filter((m) => m.niveau_stock === 'rupture').length;
  const basCount = materiaux.filter((m) => m.niveau_stock === 'bas').length;
  const recentMovements = historique.slice(0, 5);

  const createMouvementMut = useMutation({
    mutationFn: () => apiFetch('/stock/mouvements', {
      method: 'POST',
      body: JSON.stringify({
        materiau_id: mouvementMateriau!.id,
        type_mouvement: form.type_mouvement,
        quantite: form.quantite,
        raison: form.raison || undefined,
      }),
    }).then(r => {
      if (!r.success) throw new Error(r.message || 'Erreur');
      return r;
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-materiaux'] });
      qc.invalidateQueries({ queryKey: ['stock-alertes'] });
      qc.invalidateQueries({ queryKey: ['stock-mouvements'] });
      toast.success('Mouvement enregistré');
      setMouvementMateriau(null);
      setForm(emptyMouvementForm);
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors du mouvement'),
  });

  const handleExportCSV = () => {
    exportCSV('Stock.csv',
      ['Désignation','Catégorie','Type','Stock','Min','P.U. HT','Valeur','Niveau'],
      materiaux.map(m => [m.designation, m.categorie_nom, m.categorie_type, m.quantite_stock, m.quantite_min, m.prix_unitaire_ht, m.quantite_stock * m.prix_unitaire_ht, m.niveau_stock]));
  };

  const handleExportPDF = () => {
    exportListPDF({
      title: 'STOCK', subtitle: `${materiaux.length} article(s)`, filename: 'Stock.pdf',
      head: ['Désignation','Catégorie','Type','Stock','Min','P.U. HT','Valeur','Niveau'],
      body: materiaux.map(m => [m.designation, m.categorie_nom, m.categorie_type, `${fmt.number(m.quantite_stock)} ${m.unite_mesure}`, `${m.quantite_min} ${m.unite_mesure}`, fmt.currency(m.prix_unitaire_ht), fmt.currency(m.quantite_stock * m.prix_unitaire_ht), m.niveau_stock]),
      rightAlignCols: [3, 4, 5, 6],
    });
  };

  const materiauxColumns: TableColumn<Materiau>[] = [
    { key: 'designation', header: 'Désignation', render: (m) => <span className="font-medium text-gray-800">{m.designation}</span> },
    { key: 'categorie_nom', header: 'Catégorie', render: (m) => <span className="text-gray-500 text-sm">{m.categorie_nom}</span> },
    { key: 'categorie_type', header: 'Type', render: (m) => <span className="text-xs text-gray-400">{m.categorie_type}</span> },
    {
      key: 'quantite_stock', header: 'Stock', align: 'right',
      render: (m) => <span className="font-mono font-semibold">{fmt.number(m.quantite_stock)} {m.unite_mesure}</span>,
    },
    {
      key: 'quantite_min', header: 'Min', align: 'right',
      render: (m) => <span className="text-gray-400 text-xs">{m.quantite_min} {m.unite_mesure}</span>,
    },
    { key: 'prix_unitaire_ht', header: 'P.U. HT', align: 'right', render: (m) => fmt.currency(m.prix_unitaire_ht) },
    {
      key: 'valeur', header: 'Valeur', align: 'right',
      render: (m) => <span className="font-medium">{fmt.currency(m.quantite_stock * m.prix_unitaire_ht)}</span>,
    },
    {
      key: 'niveau_stock', header: 'Niveau',
      render: (m) => <Badge tone="gray" className={NIVEAU_COLOR[m.niveau_stock]}>{m.niveau_stock === 'rupture' ? 'Rupture' : m.niveau_stock === 'bas' ? 'Bas' : 'OK'}</Badge>,
    },
    {
      key: 'actions', header: 'Mouvement',
      render: (m) => (
        <Button size="sm" variant="secondary" icon={<Repeat className="w-3.5 h-3.5" />}
          onClick={() => { setMouvementMateriau(m); setForm(emptyMouvementForm); }}>
          Mouvement
        </Button>
      ),
    },
  ];

  const historiqueColumns: TableColumn<MouvementRow>[] = [
    { key: 'created_at', header: 'Date', render: (r) => fmt.date(r.created_at) },
    { key: 'materiau_nom', header: 'Matériau', render: (r) => <span className="font-medium">{r.materiau_nom}</span> },
    {
      key: 'type_mouvement', header: 'Type',
      render: (r) => <Badge tone="gray" className={TYPE_MOUVEMENT_COLOR[r.type_mouvement]}>{TYPE_MOUVEMENT_LABEL[r.type_mouvement]}</Badge>,
    },
    { key: 'quantite', header: 'Quantité', align: 'right', render: (r) => `${fmt.number(r.quantite)} ${r.unite_mesure || ''}` },
    {
      key: 'avant_apres', header: 'Avant → Après', align: 'right',
      render: (r) => r.quantite_avant != null ? <span className="font-mono text-xs">{fmt.number(r.quantite_avant)} → {fmt.number(r.quantite_apres ?? 0)}</span> : '—',
    },
    { key: 'raison', header: 'Motif', render: (r) => <span className="text-sm text-gray-500">{r.raison || '—'}</span> },
    { key: 'effectue_par_nom', header: 'Par', render: (r) => <span className="text-xs text-gray-400">{r.effectue_par_nom || '—'}</span> },
  ];

  const qteNum = Number(form.quantite) || 0;
  const stockActuel = mouvementMateriau ? Number(mouvementMateriau.quantite_stock) : 0;
  const previewApres =
    form.type_mouvement === 'ajustement' ? qteNum :
    form.type_mouvement === 'sortie' ? stockActuel - qteNum :
    stockActuel + qteNum;

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Stocks</h1>
          <p className="text-sm text-gray-500">{materiaux.length} articles • Valeur totale : {fmt.currency(valeurTotale)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExportCSV} icon={<Download className="w-4 h-4" />}>CSV</Button>
          <Button variant="secondary" onClick={handleExportPDF} icon={<FileDown className="w-4 h-4" />}>PDF</Button>
        </div>
      </div>

      <Tabs items={[
        { label: 'Matériaux', href: '/stock' },
        { label: 'Fournisseurs', href: '/stock/fournisseurs' },
      ]} />

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total articles" value={materiaux.length} tone="blue" />
        <StatCard label="Ruptures de stock" value={ruptureCount} tone="red" />
        <StatCard label="Stocks bas" value={basCount} tone="yellow" />
        <StatCard label="Valeur totale stock" value={fmt.currency(valeurTotale)} tone="green" />
      </div>

      <Card padded={false}>
        <CardHeader title="Vue rapide d’activité" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">Derniers mouvements</p>
            <div className="mt-3 space-y-2">
              {recentMovements.length === 0 && <p className="text-sm text-gray-400">Aucun mouvement récent</p>}
              {recentMovements.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{item.materiau_nom}</span>
                  <span className="font-medium text-gray-800">{TYPE_MOUVEMENT_LABEL[item.type_mouvement]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">Priorités</p>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between"><span>Articles en rupture</span><strong>{ruptureCount}</strong></div>
              <div className="flex items-center justify-between"><span>Articles à surveiller</span><strong>{basCount}</strong></div>
              <div className="flex items-center justify-between"><span>Mouvements récents</span><strong>{recentMovements.length}</strong></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Alertes stock (source : GET /api/stock/alertes) */}
      {!loadingAlertes && alertes.length > 0 && (
        <Card padded={false} className="border-red-200 border">
          <CardHeader
            title={<span className="flex items-center gap-2 text-red-700"><AlertTriangle className="w-4 h-4" /> {alertes.length} alerte(s) de stock</span>}
          />
          <div className="divide-y">
            {alertes.map(a => {
              const niveau = Number(a.quantite_stock) <= 0 ? 'rupture' : 'bas';
              const materiauComplet = materiaux.find(m => m.id === a.id);
              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-2.5">
                  <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{a.designation}</p>
                    {a.reference && <p className="text-xs text-gray-400">{a.reference}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone="gray" className={NIVEAU_COLOR[niveau]}>{niveau === 'rupture' ? 'RUPTURE' : 'BAS'}</Badge>
                    <span className="text-sm font-mono">{fmt.number(a.quantite_stock)} {a.unite_mesure} / min {fmt.number(a.seuil_alerte)}</span>
                    {materiauComplet && (
                      <Button size="sm" onClick={() => {
                        setMouvementMateriau(materiauComplet);
                        setForm({ type_mouvement: 'entree', quantite: Math.max(0, Number(a.seuil_alerte) - Number(a.quantite_stock)), raison: 'Réapprovisionnement' });
                      }}>Réappro.</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filtres */}
      <Card className="flex gap-3">
        <div className="flex-1">
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm w-48" value={type} onChange={e => setType(e.target.value)}>
          <option value="">Tous les types</option>
          {types.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </Card>

      {/* Tableau matériaux */}
      <Card padded={false}>
        <Table<Materiau>
          columns={materiauxColumns}
          data={materiaux}
          rowKey={(m) => m.id}
          loading={isLoading}
          emptyMessage="Aucun article"
          rowClassName={(m) => m.niveau_stock === 'rupture' ? 'bg-red-50/30' : undefined}
        />
      </Card>

      {/* Historique des mouvements (GET /api/stock/mouvements) */}
      <Card padded={false}>
        <CardHeader title="Historique des mouvements" />
        <Table<MouvementRow>
          columns={historiqueColumns}
          data={historique}
          rowKey={(r) => r.id}
          loading={loadingHistorique}
          emptyMessage="Aucun mouvement enregistré"
        />
      </Card>

      {/* Modal mouvement de stock */}
      <Modal open={!!mouvementMateriau} onClose={() => setMouvementMateriau(null)}
        title={mouvementMateriau ? `Mouvement de stock — ${mouvementMateriau.designation}` : ''}>
        <div className="space-y-4">
          <div>
            <label className="label">Type de mouvement *</label>
            <select className="input" value={form.type_mouvement}
              onChange={e => setForm(f => ({ ...f, type_mouvement: e.target.value as MouvementRow['type_mouvement'] }))}>
              <option value="entree">Entrée</option>
              <option value="sortie">Sortie</option>
              <option value="retour">Retour</option>
              <option value="ajustement">Ajustement (inventaire physique)</option>
            </select>
          </div>
          <div>
            <label className="label">
              {form.type_mouvement === 'ajustement' ? 'Nouvelle quantité constatée' : 'Quantité'}
              {mouvementMateriau && <span className="text-xs text-gray-400 ml-2">({mouvementMateriau.unite_mesure}) — stock actuel : {fmt.number(mouvementMateriau.quantite_stock)}</span>}
            </label>
            <NumberInput min={0.001} className="input" value={form.quantite}
              onChange={(v) => setForm(f => ({ ...f, quantite: v }))} autoFocus />
          </div>
          <div>
            <label className="label">Motif</label>
            <input className="input" value={form.raison} onChange={e => setForm(f => ({ ...f, raison: e.target.value }))}
              placeholder="Approvisionnement, consommation chantier, inventaire..." />
          </div>
          {qteNum > 0 && form.type_mouvement !== 'sortie' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Nouveau stock : <strong>{fmt.number(previewApres)} {mouvementMateriau?.unite_mesure}</strong>
            </div>
          )}
          {form.type_mouvement === 'sortie' && qteNum > stockActuel && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              ⚠️ Quantité supérieure au stock disponible ({fmt.number(stockActuel)}) — le mouvement sera rejeté.
            </div>
          )}
          {form.type_mouvement === 'sortie' && qteNum > 0 && qteNum <= stockActuel && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Nouveau stock : <strong>{fmt.number(previewApres)} {mouvementMateriau?.unite_mesure}</strong>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => createMouvementMut.mutate()}
            loading={createMouvementMut.isPending}
            disabled={qteNum <= 0}
            className={form.type_mouvement === 'sortie' ? 'bg-red-500 hover:bg-red-600' : ''}
          >
            {createMouvementMut.isPending ? 'Enregistrement...' : 'Valider le mouvement'}
          </Button>
          <Button variant="secondary" onClick={() => setMouvementMateriau(null)}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}
