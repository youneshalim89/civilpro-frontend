'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileDown, CheckCircle, XCircle, CreditCard, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { facturesService } from '@/lib/api';
import { fmt, STATUTS_FACTURE } from '@/lib/utils';
import { exportFacturePDF } from '@/lib/pdf';
import NumberInput from '@/components/NumberInput';

export default function FactureDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const qc      = useQueryClient();
  const [paiementModal, setPaiementModal] = useState(false);
  const [montantPaye,   setMontantPaye]   = useState(0);
  const [reference,     setReference]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['facture', id],
    queryFn:  () => facturesService.get(id).then(r => r.data.data),
    enabled:  !!id,
  });

  const validerMut = useMutation({
    mutationFn: () => facturesService.valider(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['facture', id] }); toast.success('Facture validée'); },
    onError:    () => toast.error('Erreur lors de la validation'),
  });

  const annulerMut = useMutation({
    mutationFn: () => facturesService.annuler(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['facture', id] }); toast.success('Facture annulée'); },
    onError:    () => toast.error('Erreur lors de l\'annulation'),
  });

  const paiementMut = useMutation({
    mutationFn: (payload: any) => facturesService.paiement(id, payload),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['facture', id] });
      toast.success('Paiement enregistré');
      setPaiementModal(false);
    },
    onError: () => toast.error('Erreur lors du paiement'),
  });

  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="card h-64 bg-gray-100" />
    </div>
  );
  if (!data) return <p className="text-gray-500">Facture introuvable.</p>;

  const f       = data;
  const statut  = STATUTS_FACTURE[f.statut];
  const solde   = (Number(f.montant_ttc)||0) - (Number(f.montant_paye)||0);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/factures" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{f.numero_facture}</h1>
              {statut && (
                <span className={`badge text-sm px-3 py-1 ${statut.color}`}>{statut.label}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Marché: {f.marche_numero} · Date: {fmt.date(f.date_facture)} · Échéance: {fmt.date(f.date_echeance)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportFacturePDF(f)}
            className="btn-secondary text-sm flex items-center gap-2">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {f.statut === 'brouillon' && (
            <button onClick={() => { if (confirm('Valider cette facture ?')) validerMut.mutate(); }}
              className="btn-primary text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Valider
            </button>
          )}
          {f.statut === 'validee' && (
            <button onClick={() => { setPaiementModal(true); setMontantPaye(solde); }}
              className="btn-primary text-sm flex items-center gap-2 bg-green-600 hover:bg-green-700">
              <CreditCard className="w-4 h-4" /> Paiement
            </button>
          )}
          {['brouillon','validee'].includes(f.statut) && (
            <button onClick={() => { if (confirm('Annuler définitivement cette facture ?')) annulerMut.mutate(); }}
              className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Annuler
            </button>
          )}
        </div>
      </div>

      {/* Indicateurs financiers */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500">Montant HT</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmt.currency(f.montant_ht)}</p>
        </div>
        <div className="card p-4 border-l-4 border-gray-300">
          <p className="text-xs text-gray-500">TVA ({f.taux_tva}%)</p>
          <p className="text-xl font-bold text-gray-700 mt-1">{fmt.currency(f.montant_tva)}</p>
        </div>
        <div className="card p-4 border-l-4 border-brand-400">
          <p className="text-xs text-gray-500">Montant TTC</p>
          <p className="text-xl font-bold text-brand-700 mt-1">{fmt.currency(f.montant_ttc)}</p>
        </div>
        <div className={`card p-4 border-l-4 ${solde <= 0 ? 'border-green-400' : 'border-red-400'}`}>
          <p className="text-xs text-gray-500">Solde restant</p>
          <p className={`text-xl font-bold mt-1 ${solde <= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt.currency(Math.max(0, solde))}
          </p>
        </div>
      </div>

      {/* Lignes */}
      {(f.lignes?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-gray-800">Lignes de facturation</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="table-header">Désignation</th>
                  <th className="table-header">Unité</th>
                  <th className="table-header text-right">Qté exec.</th>
                  <th className="table-header text-right">P.U. HT</th>
                  <th className="table-header text-right">Montant HT</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(f.lignes ?? []).map((l: any, i: number) => (
                  <tr key={l.id || i} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{l.designation}</td>
                    <td className="table-cell text-gray-500">{l.unite || '—'}</td>
                    <td className="table-cell text-right font-mono">{fmt.number(l.quantite_executee)}</td>
                    <td className="table-cell text-right">{fmt.currency(l.prix_unitaire)}</td>
                    <td className="table-cell text-right font-semibold">{fmt.currency(l.montant)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-brand-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-brand-700">TOTAL HT</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(f.montant_ht)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Infos complémentaires */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-500" /> Suivi paiement
          </h3>
          <div className="space-y-3">
            {[
              ['Montant TTC', fmt.currency(f.montant_ttc)],
              ['Montant payé', fmt.currency(f.montant_paye)],
              ['Solde', fmt.currency(Math.max(0, solde))],
              ['Date paiement', f.date_paiement ? fmt.date(f.date_paiement) : '—'],
              ['Référence paiement', f.reference_paiement || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
            {/* Barre progression paiement */}
            {Number(f.montant_ttc) > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Progression paiement</span>
                  <span>{fmt.pct((Number(f.montant_paye)||0) / Number(f.montant_ttc) * 100)}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (Number(f.montant_paye)||0) / Number(f.montant_ttc) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Validation</h3>
          <div className="space-y-3">
            {[
              ['Validée par', f.validated_by_nom || '—'],
              ['Date validation', f.date_validation ? fmt.date(f.date_validation) : '—'],
              ['Commande liée', f.commande_numero || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal paiement */}
      {paiementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Enregistrer un paiement</h3>
            <p className="text-sm text-gray-500 mb-5">Facture {f.numero_facture} — Solde: {fmt.currency(solde)}</p>
            <div className="space-y-4">
              <div>
                <label className="label">Montant payé (MAD) *</label>
                <NumberInput min={0.01} max={solde + 0.01} className="input"
                  value={montantPaye} onChange={setMontantPaye} autoFocus />
              </div>
              <div>
                <label className="label">Référence de paiement</label>
                <input className="input" value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="N° virement, chèque..." />
              </div>
              {montantPaye >= solde && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  Ce paiement soldra entièrement la facture.
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button disabled={paiementMut.isPending || montantPaye <= 0}
                onClick={() => paiementMut.mutate({ montant_paye: montantPaye, reference_paiement: reference })}
                className="btn-primary flex-1">
                {paiementMut.isPending ? 'Enregistrement...' : 'Valider le paiement'}
              </button>
              <button onClick={() => setPaiementModal(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
