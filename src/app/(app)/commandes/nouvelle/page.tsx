'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { commandesService, marchesService, articlesService } from '@/lib/api';
import { fmt } from '@/lib/utils';

interface Ligne {
  article_id:    string;
  materiau_id:   string;
  designation:   string;
  unite:         string;
  quantite:      number;
  prix_unitaire: number;
}

export default function NouvelleCommandePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    marche_id:            '',
    fournisseur_id:       '',
    date_commande:        new Date().toISOString().split('T')[0],
    date_livraison_prevue:'',
    taux_tva:             20,
    notes:                '',
  });
  const [lignes, setLignes] = useState<Ligne[]>([
    { article_id: '', materiau_id: '', designation: '', unite: 'u', quantite: 1, prix_unitaire: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const { data: marchesData } = useQuery({
    queryKey: ['marches-list'],
    queryFn:  () => marchesService.list({ limit: 100 }).then(r => r.data.data),
  });

  const { data: articlesData } = useQuery({
    queryKey: ['articles-for-commande', form.marche_id],
    queryFn:  () => articlesService.list(form.marche_id).then(r => r.data.data),
    enabled:  !!form.marche_id,
  });

  const { data: fournsData } = useQuery({
    queryKey: ['fournisseurs'],
    queryFn:  () => fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stock/fournisseurs`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('gl_token')}` },
    }).then(r => r.json()).then(r => r.data || []),
  });

  const totalHT  = lignes.reduce((s, l) => s + (l.quantite * l.prix_unitaire), 0);
  const totalTVA = totalHT * (form.taux_tva / 100);
  const totalTTC = totalHT + totalTVA;

  const addLigne = () =>
    setLignes(prev => [...prev, { article_id: '', materiau_id: '', designation: '', unite: 'u', quantite: 1, prix_unitaire: 0 }]);

  const removeLigne = (i: number) =>
    setLignes(prev => prev.filter((_, idx) => idx !== i));

  const setLigneField = (i: number, key: keyof Ligne, val: any) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));

  const onArticleSelect = (i: number, articleId: string) => {
    const art = articlesData?.find((a: any) => a.id === articleId);
    if (art) {
      setLignes(prev => prev.map((l, idx) => idx === i ? {
        ...l,
        article_id:    articleId,
        designation:   art.designation,
        unite:         art.unite,
        prix_unitaire: parseFloat(art.prix_unitaire),
      } : l));
    } else {
      setLigneField(i, 'article_id', articleId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.marche_id) { toast.error('Sélectionnez un marché'); return; }
    if (lignes.some(l => !l.designation)) { toast.error('Remplissez toutes les désignations'); return; }
    setSaving(true);
    try {
      await commandesService.create({ ...form, lignes });
      toast.success('Commande créée avec succès');
      router.push('/commandes');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/commandes" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle Commande</h1>
          <p className="text-sm text-gray-500">Créer une commande liée à un marché</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Informations générales */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Informations générales</h3>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="col-span-2 xl:col-span-1">
              <label className="label">Marché *</label>
              <select className="input text-sm" value={form.marche_id}
                onChange={e => setForm(f => ({ ...f, marche_id: e.target.value }))} required>
                <option value="">Sélectionner un marché</option>
                {marchesData?.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.numero_marche} — {m.objet}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fournisseur</label>
              <select className="input text-sm" value={form.fournisseur_id}
                onChange={e => setForm(f => ({ ...f, fournisseur_id: e.target.value }))}>
                <option value="">Sans fournisseur</option>
                {fournsData?.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.raison_sociale}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date de commande *</label>
              <input type="date" className="input text-sm" value={form.date_commande}
                onChange={e => setForm(f => ({ ...f, date_commande: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Livraison prévue</label>
              <input type="date" className="input text-sm" value={form.date_livraison_prevue}
                onChange={e => setForm(f => ({ ...f, date_livraison_prevue: e.target.value }))} />
            </div>
            <div>
              <label className="label">Taux TVA (%)</label>
              <input type="number" className="input text-sm" value={form.taux_tva}
                onChange={e => setForm(f => ({ ...f, taux_tva: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="col-span-2 xl:col-span-3">
              <label className="label">Notes</label>
              <textarea className="input text-sm" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Lignes de commande */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Lignes de commande</h3>
            <button type="button" onClick={addLigne} className="btn-secondary text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Ajouter ligne
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b text-xs">
                <tr>
                  <th className="table-header">Article BQ</th>
                  <th className="table-header">Désignation *</th>
                  <th className="table-header">Unité</th>
                  <th className="table-header text-right">Quantité</th>
                  <th className="table-header text-right">Prix unitaire</th>
                  <th className="table-header text-right">Montant</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td className="table-cell w-52">
                      <select className="input text-xs py-1.5" value={l.article_id}
                        onChange={e => onArticleSelect(i, e.target.value)}
                        disabled={!form.marche_id}>
                        <option value="">— libre —</option>
                        {articlesData?.map((a: any) => (
                          <option key={a.id} value={a.id}>{a.code_article} — {a.designation.slice(0, 30)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell">
                      <input className="input text-xs py-1.5" value={l.designation}
                        onChange={e => setLigneField(i, 'designation', e.target.value)} required />
                    </td>
                    <td className="table-cell w-20">
                      <input className="input text-xs py-1.5" value={l.unite}
                        onChange={e => setLigneField(i, 'unite', e.target.value)} />
                    </td>
                    <td className="table-cell w-28">
                      <input type="number" step="0.001" className="input text-xs py-1.5 text-right" value={l.quantite}
                        onChange={e => setLigneField(i, 'quantite', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="table-cell w-36">
                      <input type="number" step="0.01" className="input text-xs py-1.5 text-right" value={l.prix_unitaire}
                        onChange={e => setLigneField(i, 'prix_unitaire', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="table-cell w-36 text-right font-medium text-sm">
                      {fmt.currency(l.quantite * l.prix_unitaire, '')}
                    </td>
                    <td className="table-cell">
                      <button type="button" onClick={() => removeLigne(i)} disabled={lignes.length === 1}
                        className="p-1 hover:bg-red-50 rounded disabled:opacity-30">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50 text-sm font-semibold">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-gray-600">Total HT</td>
                  <td className="px-4 py-3 text-right">{fmt.currency(totalHT, '')}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-right text-gray-500 text-xs font-normal">
                    TVA {form.taux_tva} %
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500 text-xs font-normal">{fmt.currency(totalTVA, '')}</td>
                  <td />
                </tr>
                <tr className="bg-brand-50">
                  <td colSpan={5} className="px-4 py-3 text-right text-brand-700">Total TTC</td>
                  <td className="px-4 py-3 text-right text-brand-700 text-base">{fmt.currency(totalTTC)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Création...' : 'Créer la commande'}
          </button>
          <Link href="/commandes" className="btn-secondary">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
