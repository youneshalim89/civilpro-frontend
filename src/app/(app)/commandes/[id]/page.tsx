'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Truck, Receipt, CheckCircle, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt, STATUTS_COMMANDE } from '@/lib/utils';
import { exportCommandePDF } from '@/lib/pdf';
import { Card, Badge, Button, Loading } from '@/components/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

const NEXT_STATUTS: Record<string, string[]> = {
  en_attente:         ['confirmee', 'annulee'],
  confirmee:          ['en_cours_livraison', 'annulee'],
  en_cours_livraison: ['livree', 'partiellement_livree'],
};

const STATUT_LABELS: Record<string, string> = {
  confirmee: 'Confirmer', en_cours_livraison: 'En livraison',
  livree: 'Marquer livrée', partiellement_livree: 'Part. livrée', annulee: 'Annuler',
};

export default function CommandeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();

  const { data: commande, isLoading } = useQuery({
    queryKey: ['commande', id],
    queryFn:  () => apiFetch(`/commandes/${id}`).then(r => r.data),
    enabled:  !!id,
  });

  const statutMut = useMutation({
    mutationFn: (next: string) => apiFetch(`/commandes/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut: next }) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['commande', id] }); toast.success('Statut mis à jour'); },
    onError:    () => toast.error('Erreur'),
  });

  const genFactureMut = useMutation({
    mutationFn: () => apiFetch(`/factures/from-commande/${id}`, { method: 'POST' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { toast.success('Facture générée'); router.push('/factures'); },
    onError:    () => toast.error('Erreur lors de la génération de la facture'),
  });

  if (isLoading) return <Loading />;
  if (!commande) return <p className="text-gray-500">Commande introuvable.</p>;

  const s = STATUTS_COMMANDE[commande.statut];
  const nextSteps = NEXT_STATUTS[commande.statut] || [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/commandes" className="p-2 hover:bg-gray-100 rounded-lg mt-1">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{commande.numero_commande}</h1>
              <Badge className={s?.color}>{s?.label}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Marché : {commande.numero_marche} — {commande.marche_objet}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<FileDown className="w-4 h-4" />} onClick={() => exportCommandePDF(commande)}>
            PDF
          </Button>
          {nextSteps.map(next => (
            <Button key={next} variant="secondary" size="sm" className={next === 'annulee' ? 'text-red-600' : ''}
              icon={next === 'livree' ? <CheckCircle className="w-4 h-4 text-green-500" /> : next === 'en_cours_livraison' ? <Truck className="w-4 h-4 text-blue-500" /> : undefined}
              onClick={() => statutMut.mutate(next)}>
              {STATUT_LABELS[next]}
            </Button>
          ))}
          {commande.statut === 'livree' && (
            <Button size="sm" icon={<Receipt className="w-4 h-4" />} disabled={genFactureMut.isPending}
              onClick={() => genFactureMut.mutate()}>
              Générer facture
            </Button>
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Détails de la commande</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Fournisseur',      commande.fournisseur_nom || '—'],
              ['Email fournisseur',commande.fournisseur_email || '—'],
              ['Date commande',    fmt.date(commande.date_commande)],
              ['Livraison prévue', fmt.date(commande.date_livraison_prevue)],
              ['Livraison réelle', fmt.date((commande as any).date_livraison_reelle)],
              ['Notes',            (commande as any).notes || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-gray-400 text-xs">{k}</p>
                <p className="text-gray-800 font-medium mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Totaux */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Récapitulatif financier</h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Total HT',     value: commande.total_ht,   bold: false },
              { label: `TVA ${commande.taux_tva}%`, value: commande.montant_tva, bold: false },
              { label: 'Total TTC',    value: commande.total_ttc,  bold: true },
            ].map(r => (
              <div key={r.label} className={`flex justify-between ${r.bold ? 'border-t pt-3 font-bold text-brand-700' : ''}`}>
                <span className={r.bold ? '' : 'text-gray-500'}>{r.label}</span>
                <span>{fmt.currency(r.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Lignes */}
      <Card padded={false}>
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Lignes de commande ({commande.lignes?.length || 0})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs">
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">Désignation</th>
                <th className="table-header">Unité</th>
                <th className="table-header text-right">Quantité</th>
                <th className="table-header text-right">Prix U.</th>
                <th className="table-header text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {commande.lignes?.map((l: any, i: number) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="table-cell text-gray-400 text-xs">{i + 1}</td>
                  <td className="table-cell font-medium">{l.designation}</td>
                  <td className="table-cell text-gray-500">{l.unite}</td>
                  <td className="table-cell text-right">{fmt.number(l.quantite)}</td>
                  <td className="table-cell text-right">{fmt.currency(l.prix_unitaire, '')}</td>
                  <td className="table-cell text-right font-semibold">{fmt.currency(l.montant, '')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-brand-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right font-bold text-brand-700 text-sm">TOTAL TTC</td>
                <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(commande.total_ttc)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
