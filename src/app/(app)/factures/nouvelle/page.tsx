'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { facturesService, marchesService, articlesService } from '@/lib/api';
import NumberInput from '@/components/NumberInput';

type Ligne = { designation: string; unite: string; quantite_executee: number; prix_unitaire: number; article_id?: string; };
const emptyLigne = (): Ligne => ({ designation: '', unite: '', quantite_executee: 0, prix_unitaire: 0 });

export default function NouvelleFacturePage() {
  const router = useRouter();
  const [marches,   setMarches]  = useState<any[]>([]);
  const [articles,  setArticles] = useState<any[]>([]);
  const [form, setForm] = useState({
    marche_id:       '',
    date_facture:    new Date().toISOString().split('T')[0],
    date_echeance:   '',
    taux_tva:        20,
    notes:           '',
  });
  const [lignes,  setLignes]  = useState<Ligne[]>([emptyLigne()]);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    marchesService.list({ limit: 100 }).then(r => setMarches(r.data.data || []));
  }, []);

  useEffect(() => {
    if (form.marche_id) {
      articlesService.list(form.marche_id).then(r => setArticles(r.data.data || []));
    } else {
      setArticles([]);
    }
  }, [form.marche_id]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }));

  const setLigne = (i: number, k: keyof Ligne) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v: any = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  };

  const fillFromArticle = (i: number, artId: string) => {
    const art = articles.find((a: any) => a.id === artId);
    if (!art) return;
    setLignes(ls => ls.map((l, idx) => idx === i ? {
      ...l,
      article_id:       art.id,
      designation:      art.designation,
      unite:            art.unite,
      prix_unitaire:    parseFloat(art.prix_unitaire) || 0,
    } : l));
  };

  const addLigne = () => setLignes(ls => [...ls, emptyLigne()]);
  const removeLigne = (i: number) => setLignes(ls => ls.filter((_, idx) => idx !== i));

  const montantHT  = lignes.reduce((s, l) => s + l.quantite_executee * l.prix_unitaire, 0);
  const montantTVA = montantHT * (form.taux_tva / 100);
  const montantTTC = montantHT + montantTVA;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.marche_id) { toast.error('Sélectionnez un marché'); return; }
    const validLignes = lignes.filter(l => l.designation && l.quantite_executee > 0 && l.prix_unitaire > 0);
    if (!validLignes.length) { toast.error('Ajoutez au moins une ligne valide'); return; }

    setSaving(true);
    try {
      const res = await facturesService.create({ ...form, lignes: validLignes });
      toast.success('Facture créée avec succès');
      router.push(`/factures/${res.data.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/factures" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle Facture</h1>
          <p className="text-sm text-gray-500">Créer une facture manuelle</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* En-tête */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Informations générales</h3>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-1">
              <label className="label">Marché *</label>
              <select className="input" value={form.marche_id} onChange={set('marche_id')} required>
                <option value="">Sélectionner un marché</option>
                {marches.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.numero_marche} — {m.objet?.slice(0, 40)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date de facture *</label>
              <input type="date" className="input" value={form.date_facture} onChange={set('date_facture')} required />
            </div>
            <div>
              <label className="label">Date d'échéance</label>
              <input type="date" className="input" value={form.date_echeance} onChange={set('date_echeance')} />
            </div>
            <div>
              <label className="label">Taux TVA (%)</label>
              <NumberInput min={0} max={100} className="input"
                value={form.taux_tva} onChange={v => setForm(f => ({ ...f, taux_tva: v }))} />
            </div>
            <div className="xl:col-span-2">
              <label className="label">Notes / Observations</label>
              <textarea className="input" rows={2} value={form.notes} onChange={set('notes')}
                placeholder="Observations éventuelles..." />
            </div>
          </div>
        </div>

        {/* Lignes */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Lignes de facturation</h3>
            <button type="button" onClick={addLigne}
              className="btn-secondary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Ajouter une ligne
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {articles.length > 0 && <th className="table-header w-36">Article BQ</th>}
                  <th className="table-header">Désignation *</th>
                  <th className="table-header w-20">Unité</th>
                  <th className="table-header w-28">Qté exec. *</th>
                  <th className="table-header w-32">P.U. HT *</th>
                  <th className="table-header w-32 text-right">Montant HT</th>
                  <th className="table-header w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lignes.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {articles.length > 0 && (
                      <td className="table-cell">
                        <select className="input text-xs py-1"
                          onChange={e => fillFromArticle(i, e.target.value)} defaultValue="">
                          <option value="">— Choisir —</option>
                          {articles.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.code_article} {a.designation?.slice(0, 25)}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="table-cell">
                      <input className="input text-sm py-1" value={l.designation}
                        onChange={setLigne(i, 'designation')} placeholder="Désignation..." required />
                    </td>
                    <td className="table-cell">
                      <input className="input text-sm py-1 w-16" value={l.unite}
                        onChange={setLigne(i, 'unite')} placeholder="m³" />
                    </td>
                    <td className="table-cell">
                      <NumberInput min={0} className="input text-sm py-1"
                        value={l.quantite_executee} onChange={v => setLignes(ls => ls.map((ll, idx) => idx === i ? { ...ll, quantite_executee: v } : ll))} />
                    </td>
                    <td className="table-cell">
                      <NumberInput min={0} className="input text-sm py-1"
                        value={l.prix_unitaire} onChange={v => setLignes(ls => ls.map((ll, idx) => idx === i ? { ...ll, prix_unitaire: v } : ll))} />
                    </td>
                    <td className="table-cell text-right font-semibold text-brand-700">
                      {(l.quantite_executee * l.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="table-cell">
                      <button type="button" onClick={() => removeLigne(i)}
                        className="p-1 hover:bg-red-50 rounded" disabled={lignes.length === 1}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-brand-50">
                <tr>
                  <td colSpan={articles.length > 0 ? 5 : 4} className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                    Sous-total HT
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-brand-700">
                    {montantHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={articles.length > 0 ? 5 : 4} className="px-4 py-1 text-right text-sm text-gray-500">
                    TVA ({form.taux_tva}%)
                  </td>
                  <td className="px-4 py-1 text-right text-gray-600">
                    {montantTVA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </td>
                  <td />
                </tr>
                <tr className="border-t">
                  <td colSpan={articles.length > 0 ? 5 : 4} className="px-4 py-3 text-right font-bold text-gray-800">
                    TOTAL TTC
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-xl text-brand-700">
                    {montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Création...' : 'Créer la facture'}
          </button>
          <Link href="/factures" className="btn-secondary">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
