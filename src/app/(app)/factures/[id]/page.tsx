'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileDown, CheckCircle, XCircle, CreditCard, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt, STATUTS_FACTURE } from '@/lib/utils';
import { exportFacturePDF } from '@/lib/pdf';
import { Card, Badge, Button, Modal, Loading } from '@/components/ui';
import NumberInput from '@/components/NumberInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

export default function FactureDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const qc      = useQueryClient();
  const [paiementModal, setPaiementModal] = useState(false);
  const [montantPaye,   setMontantPaye]   = useState(0);
  const [reference,     setReference]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['facture', id],
    queryFn:  () => apiFetch(`/factures/${id}`).then(r => r.data),
    enabled:  !!id,
  });

  const validerMut = useMutation({
    mutationFn: () => apiFetch(`/factures/${id}/valider`, { method: 'PATCH' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['facture', id] }); toast.success('Facture validée'); },
    onError:    () => toast.error('Erreur lors de la validation'),
  });

  const annulerMut = useMutation({
    mutationFn: () => apiFetch(`/factures/${id}/annuler`, { method: 'PATCH' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['facture', id] }); toast.success('Facture annulée'); },
    onError:    () => toast.error('Erreur lors de l\'annulation'),
  });

  const paiementMut = useMutation({
    mutationFn: (payload: any) => apiFetch(`/factures/${id}/paiement`, { method: 'PATCH', body: JSON.stringify(payload) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['facture', id] });
      toast.success('Paiement enregistré');
      setPaiementModal(false);
    },
    onError: () => toast.error('Erreur lors du paiement'),
  });

  if (isLoading) return <Loading />;
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
                <Badge className={`text-sm px-3 py-1 ${statut.color}`}>{statut.label}</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Marché: {f.marche_numero} · Date: {fmt.date(f.date_facture)} · Échéance: {fmt.date(f.date_echeance)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<FileDown className="w-4 h-4" />} onClick={() => exportFacturePDF(f)}>
            PDF
          </Button>
          {f.statut === 'brouillon' && (
            <Button size="sm" icon={<CheckCircle className="w-4 h-4" />}
              onClick={() => { if (confirm('Valider cette facture ?')) validerMut.mutate(); }}>
              Valider
            </Button>
          )}
          {f.statut === 'validee' && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" icon={<CreditCard className="w-4 h-4" />}
              onClick={() => { setPaiementModal(true); setMontantPaye(solde); }}>
              Paiement
            </Button>
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
        <Card className="p-4 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500">Montant HT</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmt.currency(f.montant_ht)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-gray-300">
          <p className="text-xs text-gray-500">TVA ({f.taux_tva}%)</p>
          <p className="text-xl font-bold text-gray-700 mt-1">{fmt.currency(f.montant_tva)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-brand-400">
          <p className="text-xs text-gray-500">Montant TTC</p>
          <p className="text-xl font-bold text-brand-700 mt-1">{fmt.currency(f.montant_ttc)}</p>
        </Card>
        <Card className={`p-4 border-l-4 ${solde <= 0 ? 'border-green-400' : 'border-red-400'}`}>
          <p className="text-xs text-gray-500">Solde restant</p>
          <p className={`text-xl font-bold mt-1 ${solde <= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt.currency(Math.max(0, solde))}
          </p>
        </Card>
      </div>

      {/* Lignes */}
      {(f.lignes?.length ?? 0) > 0 && (
        <Card padded={false}>
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
        </Card>
      )}

      {/* Infos complémentaires */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card>
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
        </Card>

        <Card>
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
        </Card>
      </div>

      {/* Modal paiement */}
      <Modal open={paiementModal} onClose={() => setPaiementModal(false)} title="Enregistrer un paiement">
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
          <Button disabled={paiementMut.isPending || montantPaye <= 0} loading={paiementMut.isPending} className="flex-1"
            onClick={() => paiementMut.mutate({ montant_paye: montantPaye, reference_paiement: reference, date_paiement: new Date().toISOString().slice(0, 10) })}>
            {paiementMut.isPending ? 'Enregistrement...' : 'Valider le paiement'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setPaiementModal(false)}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}
