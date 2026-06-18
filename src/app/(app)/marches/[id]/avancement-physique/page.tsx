'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, AlertTriangle, HardHat } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, avancementPhysiqueService } from '@/lib/api';
import { fmt } from '@/lib/utils';

export default function AvancementPhysiquePage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [dateReleve, setDateReleve] = useState(new Date().toISOString().split('T')[0]);
  const [observations, setObservations] = useState('');
  const [lignes, setLignes] = useState<any[]>([]);

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data: releves, isLoading } = useQuery({
    queryKey: ['avancement-physique', id],
    queryFn:  () => avancementPhysiqueService.list(id).then(r => r.data.data),
  });

  const { data: preparerData, isFetching: loadingPrep } = useQuery({
    queryKey: ['avancement-physique-prep', id],
    queryFn:  () => avancementPhysiqueService.preparer(id).then(r => r.data.data),
    enabled:  showForm,
  });

  useEffect(() => {
    if (preparerData?.articles) {
      setLignes(preparerData.articles.map((a: any) => ({
        article_id:                  a.article_id,
        code_article:                a.code_article,
        designation:                 a.designation,
        unite:                       a.unite,
        quantite_prevue:             parseFloat(a.quantite_prevue),
        prix_unitaire:               parseFloat(a.prix_unitaire),
        quantite_executee_cumul:     parseFloat(a.quantite_executee_cumul_avant) || 0,
      })));
    }
  }, [preparerData]);

  const setQte = (i: number, val: number) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, quantite_executee_cumul: val } : l));

  const montantTotalBQ = lignes.reduce((s, l) => s + (l.quantite_prevue * l.prix_unitaire), 0);
  const montantCumule  = lignes.reduce((s, l) => s + (l.quantite_executee_cumul * l.prix_unitaire), 0);
  const avancementPreview = montantTotalBQ > 0 ? Math.min(100, (montantCumule / montantTotalBQ) * 100) : 0;

  const createMut = useMutation({
    mutationFn: () => avancementPhysiqueService.create(id, {
      date_releve: dateReleve,
      observations,
      lignes: lignes.map(l => ({ article_id: l.article_id, quantite_executee_cumul: l.quantite_executee_cumul })),
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['avancement-physique', id] });
      qc.invalidateQueries({ queryKey: ['marche', id] });
      toast.success('Relevé enregistré');
      if (res.data?.alerte) toast.error(res.data.alerte, { duration: 6000 });
      setShowForm(false);
      setObservations('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const deleteMut = useMutation({
    mutationFn: (releveId: string) => avancementPhysiqueService.delete(id, releveId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avancement-physique', id] });
      qc.invalidateQueries({ queryKey: ['marche', id] });
      toast.success('Relevé supprimé');
    },
  });

  const releveList: any[] = releves || [];
  const avancementFinancierMarche = Number(marche?.avancement_financier) || 0;
  const avancementPhysiqueMarche  = Number(marche?.avancement_physique) || 0;
  const incoherent = avancementPhysiqueMarche < avancementFinancierMarche;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Avancement Physique</h1>
            <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouveau relevé
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="card p-4 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500">Avancement physique (travaux exécutés)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt.pct(avancementPhysiqueMarche)}</p>
        </div>
        <div className="card p-4 border-l-4 border-brand-400">
          <p className="text-xs text-gray-500">Avancement financier (décomptes)</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{fmt.pct(avancementFinancierMarche)}</p>
        </div>
        <div className={`card p-4 border-l-4 ${incoherent ? 'border-red-400' : 'border-green-400'}`}>
          <p className="text-xs text-gray-500">Cohérence</p>
          <p className={`text-sm font-semibold mt-1 flex items-center gap-1 ${incoherent ? 'text-red-600' : 'text-green-600'}`}>
            {incoherent ? <><AlertTriangle className="w-4 h-4" /> Physique &lt; Financier</> : <>Physique ≥ Financier ✓</>}
          </p>
        </div>
      </div>

      {showForm && (
        <div className="card overflow-hidden border-brand-200 border-2">
          <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <HardHat className="w-4 h-4 text-brand-500" /> Nouveau relevé d'avancement physique
            </h3>
            <div className="flex items-center gap-3">
              <input type="date" className="input text-sm w-44" value={dateReleve} onChange={e => setDateReleve(e.target.value)} />
              <span className="text-sm text-gray-500">Avancement calculé : <strong className="text-blue-600">{avancementPreview.toFixed(1)}%</strong></span>
            </div>
          </div>

          {loadingPrep ? (
            <div className="p-8 text-center text-gray-400 text-sm">Chargement des prestations...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="table-header">Code</th>
                    <th className="table-header">Désignation</th>
                    <th className="table-header">U.</th>
                    <th className="table-header text-right">Qté prévue</th>
                    <th className="table-header text-right bg-blue-50 text-blue-700">Qté exécutée cumulée *</th>
                    <th className="table-header text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lignes.map((l, i) => {
                    const pct = l.quantite_prevue > 0 ? Math.min(100, (l.quantite_executee_cumul / l.quantite_prevue) * 100) : 0;
                    return (
                      <tr key={l.article_id} className="hover:bg-gray-50">
                        <td className="table-cell font-mono text-xs text-brand-600">{l.code_article}</td>
                        <td className="table-cell max-w-xs"><p className="truncate">{l.designation}</p></td>
                        <td className="table-cell text-gray-500 text-xs">{l.unite}</td>
                        <td className="table-cell text-right text-gray-500">{fmt.number(l.quantite_prevue)}</td>
                        <td className="table-cell bg-blue-50/30">
                          <input type="number" min={0} step="0.001"
                            className="input text-xs py-1 text-right w-32 border-blue-300"
                            value={l.quantite_executee_cumul}
                            onChange={e => setQte(i, parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="table-cell text-right">
                          <span className={`text-xs font-medium ${pct >= 100 ? 'text-green-600' : 'text-gray-600'}`}>{pct.toFixed(1)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t bg-gray-50">
            <label className="label">Observations</label>
            <input className="input text-sm" value={observations} onChange={e => setObservations(e.target.value)} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || loadingPrep}
                className="btn-primary text-sm">{createMut.isPending ? 'Enregistrement...' : 'Enregistrer le relevé'}</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Historique des relevés */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Historique des relevés</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header text-right">Avancement physique</th>
                <th className="table-header">Observations</th>
                <th className="table-header">Saisi par</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
              {releveList.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="table-cell">{fmt.date(r.date_releve)}</td>
                  <td className="table-cell text-right font-semibold text-blue-600">{fmt.pct(r.avancement_physique)}</td>
                  <td className="table-cell text-gray-500 text-xs max-w-xs"><p className="truncate">{r.observations || '—'}</p></td>
                  <td className="table-cell text-xs text-gray-400">{r.created_by_nom || '—'}</td>
                  <td className="table-cell">
                    <button onClick={() => { if (confirm('Supprimer ce relevé ?')) deleteMut.mutate(r.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </td>
                </tr>
              ))}
              {!isLoading && !releveList.length && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">Aucun relevé pour ce marché</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
