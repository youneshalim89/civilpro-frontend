'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileDown, TrendingUp } from 'lucide-react';
import { fmt, STATUTS_SITUATION } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { exportSituationRecapPDF } from '@/lib/pdf';
import { Card, Badge, Button, Loading } from '@/components/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

export default function SituationRecapPage() {
  const { marcheId } = useParams<{ marcheId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['situation-recap', marcheId],
    queryFn:  () => apiFetch(`/situations/recap/${marcheId}`).then(r => r.data),
    enabled:  !!marcheId,
  });

  if (isLoading) return <Loading />;
  if (!data) return <p className="text-gray-500">Récapitulatif introuvable.</p>;

  const { marche, situations, par_article, recapitulatif: r } = data;

  // TVA/TTC informatifs — taux du marché (jamais codé en dur)
  const tauxTva    = parseFloat(marche.taux_tva ?? 20);
  const montantTva = parseFloat(r.total_situation) * (tauxTva / 100);
  const montantTtc = parseFloat(r.total_situation) + montantTva;

  // Données graphique progression
  const chartData = situations.map((s: any) => ({
    name:              `N°${s.numero_situation}`,
    avancement:        parseFloat(s.avancement_financier),
    montant_net:       parseFloat(s.montant_net),
    montant_brut:      parseFloat(s.montant_brut),
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/situations" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Récapitulatif Financier</h1>
            <p className="text-sm text-gray-500">{marche.numero_marche} — {marche.objet}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<FileDown className="w-4 h-4" />} onClick={() => exportSituationRecapPDF(data)}>
          Exporter PDF
        </Button>
      </div>

      {/* Synthèse financière */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Montant marché',    value: fmt.currency(r.montant_marche),    color: 'text-gray-900' },
          { label: 'Total situations',  value: fmt.currency(r.total_situation),   color: 'text-blue-600' },
          { label: 'Total payé',        value: fmt.currency(r.total_paye),        color: 'text-green-600' },
          { label: 'Solde restant',     value: fmt.currency(r.solde_restant),     color: r.solde_restant > 0 ? 'text-orange-600' : 'text-red-600' },
          { label: 'Total RG',          value: fmt.currency(r.total_rg),          color: 'text-red-500' },
          { label: 'Total net',         value: fmt.currency(r.total_net),         color: 'text-emerald-600' },
          { label: 'Avancement phys.',  value: fmt.pct(r.avancement_physique),    color: 'text-blue-600' },
          { label: 'Avancement fin.',   value: fmt.pct(r.avancement_financier),   color: 'text-brand-600' },
        ].map(k => (
          <Card key={k.label} className="p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold mt-1 ${k.color}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Graphique évolution */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Card>
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-500" /> Progression financière
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: any) => `${parseFloat(v).toFixed(1)} %`} />
                <Line type="monotone" dataKey="avancement" stroke="#f08c0a" strokeWidth={2} dot={{ r: 4 }} name="Avancement %" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 className="font-semibold text-gray-800 mb-4">Montants par situation (MAD)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmt.currency(v)} />
                <Legend />
                <Bar dataKey="montant_brut" fill="#93c5fd" name="Brut" radius={[3,3,0,0]} />
                <Bar dataKey="montant_net"  fill="#10b981" name="Net"  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Tableau récap décomptes */}
      <Card padded={false}>
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Historique des décomptes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header whitespace-nowrap">N°</th>
                <th className="table-header whitespace-nowrap">Type</th>
                <th className="table-header whitespace-nowrap">Période</th>
                <th className="table-header text-right whitespace-nowrap">Av. financier</th>
                <th className="table-header text-right whitespace-nowrap">Montant brut</th>
                <th className="table-header text-right whitespace-nowrap">RG</th>
                <th className="table-header text-right whitespace-nowrap">Montant net</th>
                <th className="table-header whitespace-nowrap">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {situations.map((s: any) => (
                <tr key={s.numero_situation} className="hover:bg-gray-50">
                  <td className="table-cell font-bold text-brand-600 whitespace-nowrap">N°{s.numero_situation}</td>
                  <td className="table-cell text-xs text-gray-500 whitespace-nowrap">{s.type_situation}</td>
                  <td className="table-cell text-xs whitespace-nowrap">{fmt.date(s.periode_debut)} → {fmt.date(s.periode_fin)}</td>
                  <td className="table-cell text-right whitespace-nowrap">{fmt.pct(s.avancement_financier)}</td>
                  <td className="table-cell text-right whitespace-nowrap">{fmt.currency(s.montant_brut)}</td>
                  <td className="table-cell text-right text-red-500 whitespace-nowrap">{fmt.currency(s.retenue_garantie)}</td>
                  <td className="table-cell text-right font-semibold text-green-700 whitespace-nowrap">{fmt.currency(s.montant_net)}</td>
                  <td className="table-cell">
                    <Badge className={STATUTS_SITUATION[s.statut]?.color}>
                      {STATUTS_SITUATION[s.statut]?.label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t">
              <tr className="bg-brand-50 font-bold">
                <td colSpan={4} className="px-4 py-3 text-right text-brand-700">TOTAL GÉNÉRAL (HT)</td>
                <td className="px-4 py-3 text-right text-brand-700 whitespace-nowrap">{fmt.currency(r.total_situation)}</td>
                <td className="px-4 py-3 text-right text-red-600 whitespace-nowrap">{fmt.currency(r.total_rg)}</td>
                <td className="px-4 py-3 text-right text-emerald-700 whitespace-nowrap">{fmt.currency(r.total_net)}</td>
                <td />
              </tr>
              <tr className="bg-gray-50 text-xs">
                <td colSpan={4} className="px-4 py-2 text-right text-gray-500">TVA ({tauxTva.toFixed(0)} %)</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{fmt.currency(montantTva)}</td>
                <td colSpan={2} />
              </tr>
              <tr className="bg-gray-100 text-sm font-semibold">
                <td colSpan={4} className="px-4 py-2 text-right text-gray-700">TOTAL TTC</td>
                <td className="px-4 py-2 text-right text-gray-800 whitespace-nowrap">{fmt.currency(montantTtc)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Tableau par article */}
      <Card padded={false}>
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Avancement financier par article (basé sur les décomptes)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header whitespace-nowrap">N° prix</th>
                <th className="table-header">Désignation</th>
                <th className="table-header whitespace-nowrap">U.</th>
                <th className="table-header text-right whitespace-nowrap">Qté prévue</th>
                <th className="table-header text-right whitespace-nowrap">Qté cumulée</th>
                <th className="table-header text-right whitespace-nowrap">Montant prévu</th>
                <th className="table-header text-right whitespace-nowrap">Montant cumulé</th>
                <th className="table-header text-right whitespace-nowrap">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {par_article.map((a: any) => (
                <tr key={a.code_article} className="hover:bg-gray-50">
                  <td className="table-cell font-mono text-xs text-brand-600 whitespace-nowrap">{a.code_article}</td>
                  <td className="table-cell max-w-xs">{a.designation}</td>
                  <td className="table-cell text-gray-500 text-xs whitespace-nowrap">{a.unite}</td>
                  <td className="table-cell text-right whitespace-nowrap">{fmt.number(a.quantite_prevue)}</td>
                  <td className="table-cell text-right font-medium whitespace-nowrap">{fmt.number(a.quantite_cumulee)}</td>
                  <td className="table-cell text-right whitespace-nowrap">{fmt.currency(a.montant, '')}</td>
                  <td className="table-cell text-right font-semibold whitespace-nowrap">{fmt.currency(a.montant_cumule, '')}</td>
                  <td className="table-cell text-right whitespace-nowrap">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${parseFloat(a.pourcentage) >= 100 ? 'bg-green-500' : 'bg-brand-500'}`}
                          style={{ width: `${Math.min(parseFloat(a.pourcentage), 100)}%` }} />
                      </div>
                      <span className={`text-xs w-10 text-right font-medium ${parseFloat(a.pourcentage) >= 100 ? 'text-green-600' : ''}`}>
                        {fmt.pct(a.pourcentage)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
