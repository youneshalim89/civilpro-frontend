'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, DollarSign, Trash2, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { situationsService } from '@/lib/api';
import { fmt, STATUTS_SITUATION } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  provisoire: 'Décompte provisoire',
  mensuel:    'Situation mensuelle',
  definitif:  'Décompte définitif',
};

export default function SituationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();

  const { data: situation, isLoading } = useQuery({
    queryKey: ['situation', id],
    queryFn:  () => situationsService.get(id).then(r => r.data.data),
    enabled:  !!id,
  });

  const statutMut = useMutation({
    mutationFn: (s: string) => situationsService.statut(id, { statut: s }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['situation', id] }); toast.success('Statut mis à jour'); },
    onError:    () => toast.error('Erreur lors de la mise à jour'),
  });

  const deleteMut = useMutation({
    mutationFn: () => situationsService.delete(id),
    onSuccess:  () => { toast.success('Décompte supprimé'); router.push('/situations'); },
    onError:    (err: any) => toast.error(err.response?.data?.message || 'Erreur lors de la suppression'),
  });

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="card p-6 h-64 bg-gray-100" />
    </div>
  );
  if (!situation) return <p className="text-gray-500">Décompte introuvable.</p>;

  const s  = situation;
  const st = STATUTS_SITUATION[s.statut];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/situations" className="p-2 hover:bg-gray-100 rounded-lg mt-1">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Décompte N°{s.numero_situation}</h1>
              <span className={`badge ${st?.color}`}>{st?.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {s.numero_marche} — {s.marche_objet}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {s.statut === 'en_cours' && (
            <button onClick={() => { if (confirm('Marquer ce décompte comme approuvé et payé ?')) statutMut.mutate('paye'); }}
              className="btn-primary text-sm flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              <DollarSign className="w-4 h-4" /> Marquer payé
            </button>
          )}
          <button onClick={() => {
            const msg = s.statut === 'paye'
              ? `⚠️ Ce décompte N°${s.numero_situation} est déjà PAYÉ. Le supprimer retirera son montant du "Montant Entrée". Continuer ?`
              : `Supprimer le décompte N°${s.numero_situation} ?`;
            if (confirm(msg)) deleteMut.mutate();
          }} className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
          <Link href={`/situations/recap/${s.marche_id}`} className="btn-secondary text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Récapitulatif
          </Link>
        </div>
      </div>

      {/* Infos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="card p-5 col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Détails du décompte</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow label="Type" value={TYPE_LABELS[s.type_situation] || s.type_situation} />
            <InfoRow label="Maître d'ouvrage" value={s.maitre_ouvrage || '—'} />
            <InfoRow label="Période" value={`${fmt.date(s.periode_debut)} → ${fmt.date(s.periode_fin)}`} />
            <InfoRow label="Avancement financier" value={fmt.pct(s.avancement_financier)} />
            <InfoRow label="Date soumission" value={s.date_soumission ? fmt.date(s.date_soumission) : '—'} />
            <InfoRow label="Date approbation" value={s.date_approbation ? fmt.date(s.date_approbation) : '—'} />
            <InfoRow label="Date paiement" value={s.date_paiement ? fmt.date(s.date_paiement) : '—'} />
            <InfoRow label="Observations" value={s.observations || '—'} />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Récapitulatif financier</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Montant brut</span><span className="font-medium">{fmt.currency(s.montant_brut)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Retenue de garantie</span><span className="font-medium text-red-600">- {fmt.currency(s.retenue_garantie)}</span></div>
            {Number(s.avances_anterieures) > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Avances antérieures</span><span className="font-medium text-red-600">- {fmt.currency(s.avances_anterieures)}</span></div>
            )}
            {Number(s.deductions_diverses) > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Déductions diverses</span><span className="font-medium text-red-600">- {fmt.currency(s.deductions_diverses)}</span></div>
            )}
            <div className="flex justify-between border-t pt-3 font-bold text-brand-700">
              <span>MONTANT NET</span><span>{fmt.currency(s.montant_net)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Lignes du décompte ({s.lignes?.length || 0})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Code</th>
                <th className="table-header">Désignation</th>
                <th className="table-header">U.</th>
                <th className="table-header text-right">Qté prévue</th>
                <th className="table-header text-right">Qté cumulée avant</th>
                <th className="table-header text-right bg-brand-50 text-brand-700">Qté période</th>
                <th className="table-header text-right">Qté cumulée</th>
                <th className="table-header text-right">P.U.</th>
                <th className="table-header text-right">Mt période</th>
                <th className="table-header text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(s.lignes || []).map((l: any, i: number) => (
                <tr key={l.article_id || i} className="hover:bg-gray-50">
                  <td className="table-cell font-mono text-xs text-brand-600">{l.code_article}</td>
                  <td className="table-cell max-w-xs"><p className="truncate">{l.designation}</p></td>
                  <td className="table-cell text-gray-500 text-xs">{l.unite}</td>
                  <td className="table-cell text-right text-gray-500">{fmt.number(l.quantite_prevue)}</td>
                  <td className="table-cell text-right text-gray-500">{fmt.number(l.quantite_cumulee_avant)}</td>
                  <td className="table-cell text-right font-medium bg-brand-50/30">{fmt.number(l.quantite_periode)}</td>
                  <td className="table-cell text-right">{fmt.number(l.quantite_cumulee)}</td>
                  <td className="table-cell text-right text-xs">{fmt.currency(l.prix_unitaire, '')}</td>
                  <td className="table-cell text-right font-semibold text-green-700">{fmt.currency(l.montant_periode, '')}</td>
                  <td className="table-cell text-right">
                    <span className={`text-xs font-medium ${l.pourcentage >= 100 ? 'text-green-600' : 'text-gray-600'}`}>
                      {fmt.pct(l.pourcentage)}
                    </span>
                  </td>
                </tr>
              ))}
              {!(s.lignes || []).length && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">Aucune ligne</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-brand-50">
              <tr>
                <td colSpan={8} className="px-4 py-3 text-right font-bold text-brand-700 text-sm">TOTAL MONTANT BRUT</td>
                <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(s.montant_brut, '')}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-gray-800 font-medium mt-0.5">{value}</p>
    </div>
  );
}
