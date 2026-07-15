'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { Card, Button } from '@/components/ui';
import NumberInput from '@/components/NumberInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

// Montant TTC du marché — même règle 3 étapes que le backend (situations.js,
// getMontantTtcMarche) : TTC direct si disponible, sinon dérivé du HT
// (montant_actualise ?? montant_initial) × (1 + taux_tva/100), jamais d'hypothèse
// silencieuse. Ici purement pour l'aperçu client avant soumission.
function montantTtcMarche(marche: any): number | null {
  if (!marche) return null;
  if (marche.montant_ttc != null) return parseFloat(marche.montant_ttc);
  const montantHt = marche.montant_actualise ?? marche.montant_initial;
  if (montantHt == null) return null;
  const tauxTva = parseFloat(marche.taux_tva ?? 20);
  return parseFloat(montantHt) * (1 + tauxTva / 100);
}

export default function NouvelleSituationPage() {
  const router = useRouter();

  const [marcheId,    setMarcheId]    = useState('');
  const [type,        setType]        = useState('provisoire');
  const [periodeDebut,setPeriodeDebut]= useState('');
  const [periodeFin,  setPeriodeFin]  = useState('');
  const [observations,setObservations]= useState('');
  const [lignes,      setLignes]      = useState<any[]>([]);
  const [saving,      setSaving]      = useState(false);

  const { data: marchesData } = useQuery({
    queryKey: ['marches-list'],
    queryFn:  () => apiFetch('/marches?limit=100&statut=en_cours').then(r => r.data),
  });

  const { data: initData, isFetching: loadingInit } = useQuery({
    queryKey: ['situation-init', marcheId],
    queryFn:  () => apiFetch(`/situations/init/${marcheId}`).then(r => r.data),
    enabled:  !!marcheId,
  });

  const { data: situationsPrecedentes } = useQuery({
    queryKey: ['situations-marche', marcheId],
    queryFn:  () => apiFetch(`/situations?marche_id=${marcheId}&limit=100`).then(r => r.data),
    enabled:  !!marcheId,
  });

  useEffect(() => {
    if (initData?.articles) {
      setLignes(initData.articles.map((a: any) => ({
        article_id:            a.article_id,
        code_article:          a.code_article,
        designation:           a.designation,
        unite:                 a.unite,
        quantite_prevue:       parseFloat(a.quantite_prevue),
        prix_unitaire:         parseFloat(a.prix_unitaire),
        quantite_cumulee_avant:parseFloat(a.quantite_cumulee_avant),
        quantite_periode:      0,
      })));
    }
  }, [initData]);

  const setQtePeriode = (i: number, val: number) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, quantite_periode: val } : l));

  const marche   = initData?.marche;

  const montantBrut = lignes.reduce((sum, l) => {
    return sum + (parseFloat(String(l.quantite_periode)) * parseFloat(String(l.prix_unitaire)));
  }, 0);

  // TVA/TTC de la période — taux réel du marché, jamais codé en dur
  const tauxTva  = parseFloat(marche?.taux_tva ?? 20);
  const montantTva  = montantBrut * (tauxTva / 100);
  const montantTtc  = montantBrut + montantTva;

  // RG (règle CCAG-T, Chantier Decompte-RG) : 10% du TTC de ce décompte, plafonné
  // au cumul de taux_retenue_garantie % du montant TTC du marché (dérivé du HT si
  // aucun TTC direct n'est stocké).
  const rgDejaRetenue = (situationsPrecedentes || []).reduce((s: number, st: any) => s + (parseFloat(st.retenue_garantie) || 0), 0);
  const marcheTtc      = montantTtcMarche(marche);
  const plafondRG      = marcheTtc !== null ? marcheTtc * (parseFloat(marche?.taux_retenue_garantie || 7) / 100) : 0;
  const rgPotentielle  = montantTtc * 0.10;
  const rgRestante     = Math.max(0, plafondRG - rgDejaRetenue);
  const retenue     = Math.min(rgPotentielle, rgRestante);
  const montantNet  = montantTtc - retenue;
  const rgCumuleeApres = rgDejaRetenue + retenue;

  // Avancement physique calculé automatiquement à partir des prestations
  const montantTotalBQ = lignes.reduce((s, l) => s + (l.quantite_prevue * l.prix_unitaire), 0);
  const montantCumuleTotalBQ = lignes.reduce((s, l) => {
    const qCumulee = l.quantite_cumulee_avant + parseFloat(String(l.quantite_periode || 0));
    return s + (qCumulee * l.prix_unitaire);
  }, 0);
  const avancementCalcule = montantTotalBQ > 0 ? Math.min(100, (montantCumuleTotalBQ / montantTotalBQ) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marcheId) { toast.error('Sélectionnez un marché'); return; }
    if (!periodeDebut || !periodeFin) { toast.error('Renseignez la période'); return; }
    setSaving(true);
    try {
      const res = await apiFetch('/situations', {
        method: 'POST',
        body: JSON.stringify({
          marche_id:           marcheId,
          type_situation:      type,
          periode_debut:       periodeDebut,
          periode_fin:         periodeFin,
          observations,
          lignes: lignes.filter(l => l.quantite_periode > 0).map(l => ({
            article_id:            l.article_id,
            quantite_cumulee_avant:l.quantite_cumulee_avant,
            quantite_periode:      l.quantite_periode,
          })),
        }),
      });
      if (!res.success) throw new Error(res.message || 'Erreur lors de la création');
      toast.success('Décompte créé avec succès');
      router.push('/situations');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <Link href="/situations" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau Décompte de Travaux</h1>
          <p className="text-sm text-gray-500">
            {initData ? `Décompte N°${initData.numero_situation}` : 'Sélectionnez un marché'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Entête */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Informations du décompte</h3>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="label">Marché *</label>
              <select className="input text-sm" value={marcheId}
                onChange={e => { setMarcheId(e.target.value); setLignes([]); }} required>
                <option value="">Sélectionner un marché</option>
                {marchesData?.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.numero_marche} — {m.objet}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type de décompte</label>
              <select className="input text-sm" value={type} onChange={e => setType(e.target.value)}>
                <option value="provisoire">Décompte provisoire</option>
                <option value="mensuel">Situation mensuelle</option>
                <option value="definitif">Décompte définitif</option>
              </select>
            </div>
            <div>
              <label className="label">Avancement financier (calculé)</label>
              <div className="input text-sm bg-gray-50 font-semibold text-brand-600">
                {avancementCalcule.toFixed(1)} %
              </div>
            </div>
            <div>
              <label className="label">Période du *</label>
              <input type="date" className="input text-sm" value={periodeDebut}
                onChange={e => setPeriodeDebut(e.target.value)} required />
            </div>
            <div>
              <label className="label">Période au *</label>
              <input type="date" className="input text-sm" value={periodeFin}
                onChange={e => setPeriodeFin(e.target.value)} required />
            </div>
            <div className="col-span-2 xl:col-span-4">
              <label className="label">Observations</label>
              <textarea className="input text-sm" rows={2} value={observations}
                onChange={e => setObservations(e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Tableau BQ / Situation */}
        {marcheId && (
          <Card padded={false}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Bordereau des quantités</h3>
              {marche && (
                <span className="text-sm text-gray-500">
                  RG : 10% du TTC par décompte, plafonné à {marche.taux_retenue_garantie}% du marché TTC
                </span>
              )}
            </div>
            {loadingInit ? (
              <div className="p-8 text-center text-gray-400 text-sm">Chargement des articles...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="table-header whitespace-nowrap">N° prix</th>
                      <th className="table-header">Désignation</th>
                      <th className="table-header whitespace-nowrap">U.</th>
                      <th className="table-header text-right whitespace-nowrap">Qté prévue</th>
                      <th className="table-header text-right whitespace-nowrap">Qté cumulée avant</th>
                      <th className="table-header text-right whitespace-nowrap bg-brand-50 text-brand-700">Qté période *</th>
                      <th className="table-header text-right whitespace-nowrap">Qté cumulée</th>
                      <th className="table-header text-right whitespace-nowrap">P.U.</th>
                      <th className="table-header text-right whitespace-nowrap bg-green-50 text-green-700">Prix HT</th>
                      <th className="table-header text-right whitespace-nowrap">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lignes.map((l, i) => {
                      const qCumulee  = l.quantite_cumulee_avant + parseFloat(String(l.quantite_periode));
                      const montant   = parseFloat(String(l.quantite_periode)) * l.prix_unitaire;
                      const pct       = l.quantite_prevue > 0 ? (qCumulee / l.quantite_prevue) * 100 : 0;
                      return (
                        <tr key={l.article_id} className={`hover:bg-gray-50 ${l.quantite_periode > 0 ? 'bg-green-50/30' : ''}`}>
                          <td className="table-cell font-mono text-xs text-brand-600 whitespace-nowrap">{l.code_article}</td>
                          <td className="table-cell max-w-xs">{l.designation}</td>
                          <td className="table-cell text-gray-500 text-xs whitespace-nowrap">{l.unite}</td>
                          <td className="table-cell text-right text-gray-500 whitespace-nowrap">{fmt.number(l.quantite_prevue)}</td>
                          <td className="table-cell text-right text-gray-500 whitespace-nowrap">{fmt.number(l.quantite_cumulee_avant)}</td>
                          <td className="table-cell bg-brand-50/30 whitespace-nowrap">
                            <NumberInput min={0}
                              className="input text-xs py-1 text-right w-28 border-brand-300"
                              value={l.quantite_periode}
                              onChange={v => setQtePeriode(i, v)} />
                          </td>
                          <td className="table-cell text-right font-medium whitespace-nowrap">{fmt.number(qCumulee)}</td>
                          <td className="table-cell text-right text-gray-500 text-xs whitespace-nowrap">{fmt.currency(l.prix_unitaire, '')}</td>
                          <td className="table-cell text-right font-semibold text-green-700 bg-green-50/20 whitespace-nowrap">
                            {montant > 0 ? fmt.currency(montant, '') : '—'}
                          </td>
                          <td className="table-cell text-right whitespace-nowrap">
                            <span className={`text-xs font-medium ${pct > 100 ? 'text-red-600' : pct >= 80 ? 'text-green-600' : 'text-gray-600'}`}>
                              {pct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t">
                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td colSpan={8} className="px-4 py-3 text-right text-gray-600">MONTANT BRUT (HT)</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{fmt.currency(montantBrut)}</td>
                      <td />
                    </tr>
                    <tr className="bg-gray-50/60 text-sm">
                      <td colSpan={8} className="px-4 py-3 text-right text-gray-500">TVA ({tauxTva.toFixed(0)} %)</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-gray-600">{fmt.currency(montantTva)}</td>
                      <td />
                    </tr>
                    <tr className="bg-gray-100 text-sm font-semibold">
                      <td colSpan={8} className="px-4 py-3 text-right text-gray-700">TOTAL TTC</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-gray-800">{fmt.currency(montantTtc)}</td>
                      <td />
                    </tr>
                    <tr className="bg-red-50/50 text-sm">
                      <td colSpan={8} className="px-4 py-3 text-right text-red-600">
                        Retenue de garantie (10% du TTC, plafond cumulé {marche?.taux_retenue_garantie}% du marché TTC)
                        <span className="block text-xs text-gray-400">
                          RG cumulée : {fmt.currency(rgCumuleeApres)} / plafond {marcheTtc !== null ? fmt.currency(plafondRG) : '—'}
                          {rgRestante <= 0 && montantBrut > 0 && ' — plafond déjà atteint, aucune retenue supplémentaire'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-red-600 font-semibold">- {fmt.currency(retenue)}</td>
                      <td />
                    </tr>
                    <tr className="bg-brand-50 text-base font-bold">
                      <td colSpan={8} className="px-4 py-3 text-right text-brand-700">MONTANT NET À PAYER</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-brand-700">{fmt.currency(montantNet)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving || !marcheId || lignes.every(l => l.quantite_periode === 0)} loading={saving}>
            {saving ? 'Création...' : 'Créer le décompte'}
          </Button>
          <Link href="/situations">
            <Button type="button" variant="secondary">Annuler</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
