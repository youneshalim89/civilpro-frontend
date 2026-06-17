'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, AlertTriangle, TrendingDown, Plus, ArrowDown, ArrowUp, FileDown, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt, exportCSV } from '@/lib/utils';
import { exportListPDF } from '@/lib/pdf';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '';
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

type Materiau = {
  id: string; designation: string; categorie_nom: string; categorie_type: string;
  unite_mesure: string; quantite_stock: number; quantite_min: number;
  prix_unitaire_ht: number; statut: string; niveau_stock: string;
};

const NIVEAU_COLOR: Record<string, string> = {
  rupture: 'bg-red-100 text-red-700',
  bas:     'bg-yellow-100 text-yellow-700',
  ok:      'bg-green-100 text-green-700',
};

export default function StockPage() {
  const qc     = useQueryClient();
  const [type,    setType]    = useState('');
  const [search,  setSearch]  = useState('');
  const [mouvement, setMouvement] = useState<{ materiau: Materiau; sens: 'entree' | 'sortie' } | null>(null);
  const [qte,    setQte]     = useState(0);
  const [motif,  setMotif]   = useState('');
  const [saving, setSaving]  = useState(false);

  const { data: mats, isLoading } = useQuery({
    queryKey: ['stock-materiaux', { type, search }],
    queryFn:  () => apiFetch(`/stock/materiaux?${new URLSearchParams({ type, search }).toString()}`).then(r => r.data || []),
  });

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => apiFetch('/stock/categories').then(r => r.data || []),
  });

  const materiaux: Materiau[] = mats || [];

  const alertes = materiaux.filter(m => m.niveau_stock !== 'ok');
  const valeurTotale = materiaux.reduce((s, m) => s + (m.quantite_stock * m.prix_unitaire_ht), 0);

  const handleMouvement = async () => {
    if (!mouvement || qte <= 0) { toast.error('Quantité invalide'); return; }
    setSaving(true);
    try {
      await apiFetch(`/stock/mouvements`, {
        method: 'POST',
        body: JSON.stringify({
          materiau_id: mouvement.materiau.id,
          type: mouvement.sens,
          quantite: qte,
          motif,
        }),
      });
      toast.success(`${mouvement.sens === 'entree' ? 'Entrée' : 'Sortie'} enregistrée`);
      qc.invalidateQueries({ queryKey: ['stock-materiaux'] });
      setMouvement(null); setQte(0); setMotif('');
    } catch { toast.error('Erreur lors du mouvement'); }
    finally { setSaving(false); }
  };

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Stocks</h1>
          <p className="text-sm text-gray-500">{materiaux.length} articles • Valeur totale : {fmt.currency(valeurTotale)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-sm flex items-center gap-2">
            <FileDown className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500">Total articles</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{materiaux.length}</p>
        </div>
        <div className="card p-4 border-l-4 border-red-400">
          <p className="text-xs text-gray-500">Ruptures de stock</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {materiaux.filter(m => m.niveau_stock === 'rupture').length}
          </p>
        </div>
        <div className="card p-4 border-l-4 border-yellow-400">
          <p className="text-xs text-gray-500">Stocks bas</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {materiaux.filter(m => m.niveau_stock === 'bas').length}
          </p>
        </div>
        <div className="card p-4 border-l-4 border-green-400">
          <p className="text-xs text-gray-500">Valeur totale stock</p>
          <p className="text-lg font-bold text-green-700 mt-1">{fmt.currency(valeurTotale)}</p>
        </div>
      </div>

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="card border-red-200 border">
          <div className="px-5 py-3 border-b border-red-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-red-700 text-sm">{alertes.length} alerte(s) de stock</span>
          </div>
          <div className="divide-y">
            {alertes.map(m => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-2.5">
                <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{m.designation}</p>
                  <p className="text-xs text-gray-400">{m.categorie_nom}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${NIVEAU_COLOR[m.niveau_stock]}`}>
                    {m.niveau_stock === 'rupture' ? 'RUPTURE' : 'BAS'}
                  </span>
                  <span className="text-sm font-mono">
                    {m.quantite_stock} {m.unite_mesure} / min {m.quantite_min}
                  </span>
                  <button onClick={() => { setMouvement({ materiau: m, sens: 'entree' }); setQte(m.quantite_min - m.quantite_stock); }}
                    className="btn-primary text-xs py-1 px-3 flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" /> Réappro.
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="card p-4 flex gap-3">
        <input className="input text-sm flex-1" placeholder="Rechercher..." value={search}
          onChange={e => setSearch(e.target.value)} />
        <select className="input text-sm w-48" value={type} onChange={e => setType(e.target.value)}>
          <option value="">Tous les types</option>
          {['materiau','consommable','equipement','outil'].map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Tableau stock */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Désignation</th>
                <th className="table-header">Catégorie</th>
                <th className="table-header">Type</th>
                <th className="table-header text-right">Stock</th>
                <th className="table-header text-right">Min</th>
                <th className="table-header text-right">P.U. HT</th>
                <th className="table-header text-right">Valeur</th>
                <th className="table-header">Niveau</th>
                <th className="table-header">Mouvement</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {materiaux.map((m) => (
                <tr key={m.id} className={`hover:bg-gray-50 ${m.niveau_stock === 'rupture' ? 'bg-red-50/30' : ''}`}>
                  <td className="table-cell font-medium text-gray-800">{m.designation}</td>
                  <td className="table-cell text-gray-500 text-sm">{m.categorie_nom}</td>
                  <td className="table-cell text-xs text-gray-400">{m.categorie_type}</td>
                  <td className="table-cell text-right font-mono font-semibold">
                    {fmt.number(m.quantite_stock)} {m.unite_mesure}
                  </td>
                  <td className="table-cell text-right text-gray-400 text-xs">
                    {m.quantite_min} {m.unite_mesure}
                  </td>
                  <td className="table-cell text-right">{fmt.currency(m.prix_unitaire_ht)}</td>
                  <td className="table-cell text-right font-medium">
                    {fmt.currency(m.quantite_stock * m.prix_unitaire_ht)}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${NIVEAU_COLOR[m.niveau_stock]}`}>
                      {m.niveau_stock === 'rupture' ? 'Rupture' : m.niveau_stock === 'bas' ? 'Bas' : 'OK'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => { setMouvement({ materiau: m, sens: 'entree' }); setQte(0); }}
                        className="p-1.5 hover:bg-green-50 rounded-lg" title="Entrée">
                        <ArrowDown className="w-4 h-4 text-green-500" />
                      </button>
                      <button onClick={() => { setMouvement({ materiau: m, sens: 'sortie' }); setQte(0); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg" title="Sortie"
                        disabled={m.quantite_stock <= 0}>
                        <ArrowUp className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !materiaux.length && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">Aucun article</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal mouvement */}
      {mouvement && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {mouvement.sens === 'entree' ? '⬇️ Entrée stock' : '⬆️ Sortie stock'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">{mouvement.materiau.designation}</p>
            <div className="space-y-4">
              <div>
                <label className="label">
                  Quantité ({mouvement.materiau.unite_mesure}) *
                  <span className="text-xs text-gray-400 ml-2">
                    Stock actuel : {mouvement.materiau.quantite_stock}
                  </span>
                </label>
                <input type="number" min={0.001} step={0.001} className="input"
                  value={qte} onChange={e => setQte(parseFloat(e.target.value) || 0)} autoFocus />
              </div>
              <div>
                <label className="label">Motif</label>
                <input className="input" value={motif} onChange={e => setMotif(e.target.value)}
                  placeholder="Approvisionnement, consommation chantier..." />
              </div>
              {mouvement.sens === 'entree' && qte > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  Nouveau stock : <strong>{mouvement.materiau.quantite_stock + qte} {mouvement.materiau.unite_mesure}</strong>
                </div>
              )}
              {mouvement.sens === 'sortie' && qte > mouvement.materiau.quantite_stock && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                  ⚠️ Quantité supérieure au stock disponible
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleMouvement} disabled={saving || qte <= 0}
                className={`btn-primary flex-1 ${mouvement.sens === 'sortie' ? 'bg-red-500 hover:bg-red-600' : ''}`}>
                {saving ? 'Enregistrement...' : mouvement.sens === 'entree' ? 'Valider l\'entrée' : 'Valider la sortie'}
              </button>
              <button onClick={() => setMouvement(null)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
