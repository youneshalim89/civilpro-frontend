'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService } from '@/lib/api';
import { STATUTS_MARCHE } from '@/lib/utils';
import { Card, Input, Button } from '@/components/ui';
import NumberInput from '@/components/NumberInput';

const fieldClassName = 'w-full';

const STATUTS = Object.keys(STATUTS_MARCHE);

export default function ModifierMarchePage() {
  const router         = useRouter();
  const { id }         = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    marchesService.get(id).then(r => {
      const m = r.data.data;
      setForm({
        numero_marche:           m.numero_marche || '',
        objet:                   m.objet || '',
        maitre_ouvrage:          m.maitre_ouvrage || '',
        entreprise_attributaire: m.entreprise_attributaire || '',
        montant_initial:         Number(m.montant_initial) || 0,
        date_commencement:       m.date_commencement?.split('T')[0] || '',
        delai_contractuel:       m.delai_contractuel || 365,
        taux_tva:                Number(m.taux_tva) || 20,
        taux_retenue_garantie:   Number(m.taux_retenue_garantie) || 7,
        statut:                  m.statut || 'en_cours',
        avancement_physique:     Number(m.avancement_physique) || 0,
      });
    }).catch(() => toast.error('Marché introuvable'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }));

  const dateFin = () => {
    if (!form.date_commencement || !form.delai_contractuel) return '—';
    const d = new Date(form.date_commencement);
    d.setDate(d.getDate() + Number(form.delai_contractuel));
    return d.toLocaleDateString('fr-FR');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await marchesService.update(id, form);
      toast.success('Marché mis à jour');
      router.push(`/marches/${id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/3" /><div className="card h-64 bg-gray-100" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modifier le marché</h1>
          <p className="text-sm text-gray-500">{form.numero_marche}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identification */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Identification</h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Input label="Numéro du marché *" value={form.numero_marche || ''} onChange={set('numero_marche')} required className={fieldClassName} />
            <Input label="Maître d'ouvrage *" value={form.maitre_ouvrage || ''} onChange={set('maitre_ouvrage')} required className={fieldClassName} />
            <div className="xl:col-span-2">
              <label className="label" htmlFor="marche-objet">Objet *</label>
              <textarea id="marche-objet" className="input w-full" rows={3} value={form.objet || ''} onChange={set('objet')} required />
            </div>
            <Input label="Entreprise attributaire" value={form.entreprise_attributaire || ''} onChange={set('entreprise_attributaire')} className={fieldClassName} />
            <div>
              <label className="label" htmlFor="marche-statut">Statut</label>
              <select id="marche-statut" className="input w-full" value={form.statut || ''} onChange={set('statut')}>
                {STATUTS.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Financier */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Données financières</h3>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div>
              <label className="label">Montant HT (MAD)</label>
              <NumberInput min={0} className="input w-full"
                value={form.montant_initial || 0} onChange={v => setForm((f: any) => ({ ...f, montant_initial: v }))} />
            </div>
            <div>
              <label className="label">Taux TVA (%)</label>
              <NumberInput min={0} max={100} className="input w-full"
                value={form.taux_tva || 0} onChange={v => setForm((f: any) => ({ ...f, taux_tva: v }))} />
            </div>
            <div>
              <label className="label">Retenue de garantie (%)</label>
              <NumberInput min={0} max={100} className="input w-full"
                value={form.taux_retenue_garantie || 0} onChange={v => setForm((f: any) => ({ ...f, taux_retenue_garantie: v }))} />
            </div>
          </div>
        </Card>

        {/* Délais + Avancement */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Délais & Avancement</h3>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Input type="date" label="Date de commencement" value={form.date_commencement || ''}
              onChange={set('date_commencement')} className={fieldClassName} />
            <div>
              <label className="label">Délai contractuel (jours)</label>
              <NumberInput min={1} className="input w-full"
                value={form.delai_contractuel || 365} onChange={v => setForm((f: any) => ({ ...f, delai_contractuel: v }))} />
            </div>
            <div>
              <label className="label">Date fin prévue (calculée)</label>
              <div className="input bg-gray-50 text-gray-700 w-full">{dateFin()}</div>
            </div>
            <div className="xl:col-span-3">
              <label className="label" htmlFor="marche-avancement">
                Avancement physique : <span className="font-bold text-brand-600">{form.avancement_physique || 0}%</span>
              </label>
              <input id="marche-avancement" type="range" min={0} max={100} step={0.5} className="w-full accent-brand-500"
                value={form.avancement_physique || 0} onChange={set('avancement_physique')} />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" loading={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
          <Link href={`/marches/${id}`} className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
