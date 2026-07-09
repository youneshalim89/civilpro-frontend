'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, projetsService, type ProjetLite } from '@/lib/api';
import { Card, Input, Button } from '@/components/ui';
import NumberInput from '@/components/NumberInput';

const fieldClassName = 'w-full';

export default function NouveauMarchePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    numero_marche:           '',
    objet:                   '',
    maitre_ouvrage:          '',
    entreprise_attributaire: 'Golden Leader SARL',
    montant_initial:         0,
    date_commencement:       new Date().toISOString().split('T')[0],
    delai_contractuel:       365,
    taux_tva:                20,
    taux_retenue_garantie:   7,
    chef_marche_id:          '',
    projet_id:               '',
  });
  const [saving, setSaving] = useState(false);
  const [projets, setProjets] = useState<ProjetLite[]>([]);

  useEffect(() => {
    projetsService.list().then(r => setProjets(r.data.data || [])).catch(() => {});
  }, []);

  const dateFin = () => {
    const d = new Date(form.date_commencement);
    d.setDate(d.getDate() + form.delai_contractuel);
    return d.toLocaleDateString('fr-FR');
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero_marche || !form.objet || !form.maitre_ouvrage) {
      toast.error('Remplissez tous les champs obligatoires'); return;
    }
    setSaving(true);
    try {
      const res = await marchesService.create({ ...form, projet_id: form.projet_id || undefined });
      toast.success(`Marché ${form.numero_marche} créé avec succès`);
      router.push(`/marches/${res.data.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/marches" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau Marché</h1>
          <p className="text-sm text-gray-500">Créer un nouveau contrat de marché</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identification */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-500" /> Identification du marché
          </h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Input label="Numéro du marché *" value={form.numero_marche} onChange={set('numero_marche')}
              placeholder="Ex: M-2026-001" required className={fieldClassName} />
            <Input label="Maître d'ouvrage *" value={form.maitre_ouvrage} onChange={set('maitre_ouvrage')}
              placeholder="Ex: Ministère de l'Équipement" required className={fieldClassName} />
            <div className="xl:col-span-2">
              <label className="label">Objet du marché *</label>
              <textarea className="input w-full" rows={3} value={form.objet} onChange={set('objet')}
                placeholder="Description complète de l'objet du marché..." required />
            </div>
            <Input label="Entreprise attributaire" value={form.entreprise_attributaire} onChange={set('entreprise_attributaire')} className={fieldClassName} />
            <div>
              <label className="label">Projet lié</label>
              <select className="input w-full" value={form.projet_id} onChange={set('projet_id')}>
                <option value="">Aucun projet</option>
                {projets.map(p => (
                  <option key={p.id} value={p.id}>{p.code_projet} — {p.nom}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Données financières */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Données financières</h3>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div>
              <label className="label">Montant du marché (MAD HT) *</label>
              <NumberInput min={0} className="input w-full" value={form.montant_initial}
                onChange={v => setForm(f => ({ ...f, montant_initial: v }))} />
            </div>
            <div>
              <label className="label">Taux TVA (%)</label>
              <NumberInput min={0} max={100} className="input w-full" value={form.taux_tva}
                onChange={v => setForm(f => ({ ...f, taux_tva: v }))} />
            </div>
            <div>
              <label className="label">Retenue de garantie (%)</label>
              <NumberInput min={0} max={100} className="input w-full" value={form.taux_retenue_garantie}
                onChange={v => setForm(f => ({ ...f, taux_retenue_garantie: v }))} />
            </div>
            {form.montant_initial > 0 && (
              <div className="xl:col-span-3 bg-brand-50 border border-brand-200 rounded-lg p-3 grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-gray-500">Montant HT</p><p className="font-bold text-brand-700">{form.montant_initial.toLocaleString('fr-FR')} MAD</p></div>
                <div><p className="text-gray-500">TVA ({form.taux_tva}%)</p><p className="font-bold text-gray-700">{(form.montant_initial * form.taux_tva / 100).toLocaleString('fr-FR')} MAD</p></div>
                <div><p className="text-gray-500">Montant TTC</p><p className="font-bold text-gray-700">{(form.montant_initial * (1 + form.taux_tva / 100)).toLocaleString('fr-FR')} MAD</p></div>
              </div>
            )}
          </div>
        </Card>

        {/* Délais */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Délais contractuels</h3>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Input type="date" label="Date de commencement *" value={form.date_commencement}
              onChange={set('date_commencement')} required className={fieldClassName} />
            <div>
              <label className="label">Délai contractuel (jours) *</label>
              <NumberInput min={1} className="input w-full" value={form.delai_contractuel}
                onChange={v => setForm(f => ({ ...f, delai_contractuel: v }))} />
            </div>
            <div>
              <label className="label">Date fin prévue (calculée)</label>
              <div className="input bg-gray-50 text-gray-700 font-medium w-full">{dateFin()}</div>
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" loading={saving}>
            {saving ? 'Création en cours...' : 'Créer le marché'}
          </Button>
          <Link href="/marches" className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
