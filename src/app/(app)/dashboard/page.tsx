'use client';
// src/app/(app)/dashboard/page.tsx — Tableau de bord principal
import { useQuery } from '@tanstack/react-query';
import {
  FileText, TrendingUp, TrendingDown, Scale, AlertTriangle, CheckCircle2,
  Clock, Package, DollarSign, Building2,
} from 'lucide-react';
import { marchesService } from '@/lib/api';
import { fmt, STATUTS_MARCHE } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import Link from 'next/link';

const COLORS = ['#3b82f6','#10b981','#ef4444','#f59e0b','#8b5cf6','#ec4899'];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  () => marchesService.dashboard().then(r => r.data.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (!data)     return null;

  const { stats, par_statut, alertes_echeance, financiers, alertes_stock, synthese_projets = [] } = data;

  const totalEntreeGlobal = synthese_projets.reduce((s: number, p: any) => s + (Number(p.montant_entree) || 0), 0);
  const totalSortieGlobal = synthese_projets.reduce((s: number, p: any) => s + (Number(p.montant_sortie) || 0), 0);
  const differenceGlobale = totalEntreeGlobal - totalSortieGlobal;

  const kpis = [
    {
      label: 'Total Marchés',
      value: stats.total,
      icon: FileText,
      color: 'bg-blue-500',
      sub: `${stats.en_cours} en cours`,
    },
    {
      label: 'Montant Global',
      value: fmt.currency(stats.montant_total),
      icon: DollarSign,
      color: 'bg-brand-500',
      sub: `Actualisé : ${fmt.currency(stats.montant_actualise_total)}`,
    },
    {
      label: 'Avancement Moyen',
      value: fmt.pct(stats.avancement_moyen),
      icon: TrendingUp,
      color: 'bg-emerald-500',
      sub: `${stats.acheves} marchés achevés`,
    },
    {
      label: 'En Retard',
      value: stats.en_retard,
      icon: AlertTriangle,
      color: 'bg-red-500',
      sub: `${stats.suspendus} suspendus`,
    },
    {
      label: 'Facturé (TTC)',
      value: fmt.currency(financiers.total_facture),
      icon: Building2,
      color: 'bg-purple-500',
      sub: `Payé : ${fmt.currency(financiers.total_paye)}`,
    },
    {
      label: 'En Attente Paiement',
      value: fmt.currency(financiers.en_attente_paiement),
      icon: Clock,
      color: 'bg-orange-500',
      sub: `${financiers.factures_a_payer} factures validées`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">Vue d'ensemble des marchés Golden Leader</p>
        </div>
        <Link href="/marches/nouveau" className="btn-primary text-sm">
          + Nouveau Marché
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5 flex items-start gap-4">
            <div className={`${k.color} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}>
              <k.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-tight">{k.value}</p>
              <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Synthèse financière globale — tous projets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-green-400">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Montant Entrée (tous projets)</p>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-2">{fmt.currency(totalEntreeGlobal)}</p>
          <p className="text-xs text-gray-400 mt-1">Total facturé encaissé</p>
        </div>
        <div className="card p-5 border-l-4 border-red-400">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Montant Sortie (tous projets)</p>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">{fmt.currency(totalSortieGlobal)}</p>
          <p className="text-xs text-gray-400 mt-1">Charges fixes + journalières</p>
        </div>
        <div className={`card p-5 border-l-4 ${differenceGlobale >= 0 ? 'border-blue-400' : 'border-orange-400'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Différence (tous projets)</p>
            <Scale className={`w-4 h-4 ${differenceGlobale >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
          </div>
          <p className={`text-2xl font-bold mt-2 ${differenceGlobale >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt.currency(differenceGlobale)}</p>
          <p className="text-xs text-gray-400 mt-1">Résultat net global</p>
        </div>
      </div>

      {/* Synthèse par projet */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Synthèse par projet</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Marché</th>
                <th className="table-header">Statut</th>
                <th className="table-header text-right">Entrée</th>
                <th className="table-header text-right">Sortie</th>
                <th className="table-header text-right">Différence</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {synthese_projets.map((p: any) => {
                const diff = (Number(p.montant_entree) || 0) - (Number(p.montant_sortie) || 0);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <Link href={`/marches/${p.id}`} className="font-medium text-brand-600 hover:underline">{p.numero_marche}</Link>
                      <p className="text-xs text-gray-400 truncate max-w-xs">{p.objet}</p>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${STATUTS_MARCHE[p.statut]?.color}`}>{STATUTS_MARCHE[p.statut]?.label}</span>
                    </td>
                    <td className="table-cell text-right text-green-600 font-medium">{fmt.currency(p.montant_entree)}</td>
                    <td className="table-cell text-right text-red-600 font-medium">{fmt.currency(p.montant_sortie)}</td>
                    <td className={`table-cell text-right font-semibold ${diff >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt.currency(diff)}</td>
                  </tr>
                );
              })}
              {!synthese_projets.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Aucun projet</td></tr>
              )}
            </tbody>
            {synthese_projets.length > 0 && (
              <tfoot className="border-t bg-brand-50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-brand-700 text-sm">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{fmt.currency(totalEntreeGlobal)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-700">{fmt.currency(totalSortieGlobal)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${differenceGlobale >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt.currency(differenceGlobale)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Répartition par statut */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Répartition par statut</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={par_statut} dataKey="nb" nameKey="statut" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                {par_statut.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val: any, name: any) => [val, STATUTS_MARCHE[name]?.label || name]} />
              <Legend formatter={(val) => STATUTS_MARCHE[val]?.label || val} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Montants par statut */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Montants par statut (MAD)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={par_statut} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="statut" tickFormatter={(v) => STATUTS_MARCHE[v]?.label?.slice(0, 8) || v} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => fmt.currency(v)} labelFormatter={(v) => STATUTS_MARCHE[v]?.label || v} />
              <Bar dataKey="montant" fill="#f08c0a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alertes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Échéances proches */}
        <div className="card">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Échéances dans 30 jours
            </h3>
            <span className="badge bg-orange-100 text-orange-700">{alertes_echeance.length}</span>
          </div>
          <div className="divide-y">
            {alertes_echeance.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune échéance imminente</p>
            )}
            {alertes_echeance.slice(0, 5).map((m: any) => (
              <Link key={m.id} href={`/marches/${m.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.jours_restants <= 7 ? 'bg-red-500' : 'bg-orange-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.numero_marche}</p>
                  <p className="text-xs text-gray-500 truncate">{m.objet}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-orange-600">{m.jours_restants}j</p>
                  <p className="text-xs text-gray-400">{fmt.date(m.date_fin_prevue)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Alertes stock */}
        <div className="card">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-red-500" />
              Alertes Stock
            </h3>
            <span className="badge bg-red-100 text-red-700">{alertes_stock.length}</span>
          </div>
          <div className="divide-y">
            {alertes_stock.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune alerte stock</p>
            )}
            {alertes_stock.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-2 h-2 rounded-full ${s.niveau === 'rupture' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{s.designation}</p>
                  <p className="text-xs text-gray-400">{s.categorie}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${s.niveau === 'rupture' ? 'text-red-600' : 'text-yellow-600'}`}>
                    {s.niveau === 'rupture' ? 'RUPTURE' : 'BAS'}
                  </p>
                  <p className="text-xs text-gray-400">{s.quantite_stock} / min {s.quantite_min}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5 h-24 bg-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="card h-64 bg-gray-100" />
        <div className="card h-64 bg-gray-100" />
      </div>
    </div>
  );
}
