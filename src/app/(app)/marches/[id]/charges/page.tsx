'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Plus, Truck, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, chargesService, chargesJournalieresService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import NumberInput from '@/components/NumberInput';
import type { ChargeMensuelle, ChargeJournaliere } from '@/lib/api';

const CHAMPS: { key: keyof ChargeMensuelle; label: string }[] = [
  { key: 'masse_salariale', label: 'Masse salariale' },
  { key: 'carburant',       label: 'Carburant' },
  { key: 'hebergement',     label: 'Hébergement équipe' },
  { key: 'restauration',    label: 'Restauration' },
  { key: 'reparations',     label: 'Réparations / pièces' },
  { key: 'pneumatiques',    label: 'Pneumatiques / lubrifiants' },
  { key: 'transport',       label: 'Transport / déplacement' },
  { key: 'sous_traitance',  label: 'Sous-traitance' },
  { key: 'divers',          label: 'Divers / imprévus' },
];

const TYPES_MATERIAUX = ['G1', 'G2', 'G3', 'Sable', 'Tout-venant', 'Gravette', 'Grave concassée', 'Ciment', 'Autre'];

const UNITE_PAR_MATERIAU: Record<string, string> = {
  'Ciment': 'tonnes',
  'G1': 'm³', 'G2': 'm³', 'G3': 'm³',
  'Sable': 'm³', 'Tout-venant': 'm³', 'Gravette': 'm³', 'Grave concassée': 'm³',
};

const ENGINS_PREDEFINIS = [
  'MAN 8x4',
  'Pelle hydraulique sur pneu 318',
  'JCB',
  'Camion malaxeur 8x4',
  'Camion benne 7m³',
  'Niveleuse',
  'Compacteur 12T',
  'Pick up A80',
  'Dokker A48',
  'Camion-citerne',
  'Chargeuse',
  'Poclain 318',
];

const CATEGORIES_JOUR: Record<string, string> = {
  location_materiel: 'Location matériel',
  achat_materiaux:   'Achat matériaux',
  autre:             'Autre',
};

const moisActuel = () => new Date().toISOString().slice(0, 7);

const emptyChargeJour = {
  date_jour: new Date().toISOString().split('T')[0],
  categorie: 'location_materiel' as ChargeJournaliere['categorie'],
  designation: '',
  quantite: 1,
  unite: 'jour',
  prix_unitaire: 0,
};

export default function ChargesPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [mois, setMois] = useState(moisActuel());
  const [form, setForm] = useState<Record<string, number>>(
    Object.fromEntries(CHAMPS.map(c => [c.key, 0])) as Record<string, number>
  );
  const [objectif, setObjectif] = useState(0);

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['charges', id],
    queryFn:  () => chargesService.list(id).then(r => r.data.data),
  });

  const charges: ChargeMensuelle[] = data || [];
  const current = charges.find(c => c.mois === mois);

  useEffect(() => {
    if (current) {
      setForm(Object.fromEntries(CHAMPS.map(c => [c.key, Number(current[c.key]) || 0])) as Record<string, number>);
      setObjectif(Number(current.objectif_mensuel) || 0);
    } else {
      setForm(Object.fromEntries(CHAMPS.map(c => [c.key, 0])) as Record<string, number>);
      setObjectif(0);
    }
  }, [mois, current]);

  const saveMut = useMutation({
    mutationFn: () => chargesService.save(id, { mois, ...form, objectif_mensuel: objectif }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['charges', id] }); toast.success('Charges enregistrées'); },
    onError:    () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const deleteMut = useMutation({
    mutationFn: (chargeId: string) => chargesService.delete(id, chargeId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['charges', id] }); toast.success('Supprimé'); },
  });

  // ── Charges journalières (location matériel / achat matériaux) ──
  const [showJourForm, setShowJourForm] = useState(false);
  const [jourForm, setJourForm] = useState(emptyChargeJour);

  const { data: chargesJourData, isLoading: loadingJour } = useQuery({
    queryKey: ['charges-jour', id, mois],
    queryFn:  () => chargesJournalieresService.list(id, mois).then(r => r.data.data),
  });
  const chargesJour: ChargeJournaliere[] = chargesJourData || [];

  const createJourMut = useMutation({
    mutationFn: () => chargesJournalieresService.create(id, jourForm),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['charges-jour', id, mois] });
      toast.success('Charge ajoutée');
      setJourForm({ ...emptyChargeJour, categorie: jourForm.categorie });
      setShowJourForm(false);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const deleteJourMut = useMutation({
    mutationFn: (chargeId: string) => chargesJournalieresService.delete(id, chargeId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['charges-jour', id, mois] }); toast.success('Supprimé'); },
  });

  const totalJour = chargesJour.reduce((s, c) => s + (Number(c.montant) || 0), 0);
  const totalLocation = chargesJour.filter(c => c.categorie === 'location_materiel').reduce((s, c) => s + Number(c.montant), 0);
  const totalAchatMateriaux = chargesJour.filter(c => c.categorie === 'achat_materiaux').reduce((s, c) => s + Number(c.montant), 0);

  const totalMensuelForm = CHAMPS.reduce((s, c) => s + (form[c.key] || 0), 0);
  const total = totalMensuelForm + totalJour;
  const marge = objectif - total;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charges Mensuelles</h1>
          <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
        </div>
      </div>

      {/* Sélecteur de mois */}
      <div className="card p-4 flex items-center gap-4">
        <label className="label mb-0 whitespace-nowrap">Mois</label>
        <input type="month" className="input text-sm w-48" value={mois} onChange={e => setMois(e.target.value)} />
        {current && (
          <span className="text-xs text-gray-400">Dernière mise à jour enregistrée pour ce mois</span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Formulaire */}
        <div className="card p-5 xl:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Détail des charges — {mois}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Objectif mensuel (DH)</label>
              <NumberInput className="input text-sm" value={objectif} onChange={setObjectif} />
            </div>
            <div />
            {CHAMPS.map(c => (
              <div key={c.key}>
                <label className="label">{c.label} (DH)</label>
                <NumberInput className="input text-sm" value={form[c.key] || 0}
                  onChange={v => setForm(f => ({ ...f, [c.key]: v }))} />
              </div>
            ))}
          </div>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="btn-primary text-sm flex items-center gap-2 mt-5">
            <Save className="w-4 h-4" /> {saveMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        {/* Récapitulatif */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Récapitulatif — {mois}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Objectif mensuel</span><span className="font-semibold">{fmt.currency(objectif)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Charges fixes (formulaire)</span><span>{fmt.currency(totalMensuelForm)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Location matériel (jour)</span><span>{fmt.currency(totalLocation)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Achat matériaux (jour)</span><span>{fmt.currency(totalAchatMateriaux)}</span></div>
              <div className="flex justify-between border-t pt-3"><span className="text-gray-500 font-medium">Total charges</span><span className="font-bold text-red-600">{fmt.currency(total)}</span></div>
              <div className={`flex justify-between border-t pt-3 font-bold ${marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span>Marge brute</span><span>{fmt.currency(marge)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charges journalières */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Charges journalières — {mois}</h3>
          <button onClick={() => setShowJourForm(!showJourForm)} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>

        {showJourForm && (
          <div className="p-5 border-b bg-gray-50">
            <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
              <div>
                <label className="label">Date *</label>
                <input type="date" className="input text-sm" value={jourForm.date_jour}
                  onChange={e => setJourForm(f => ({ ...f, date_jour: e.target.value }))} />
              </div>
              <div>
                <label className="label">Catégorie *</label>
                <select className="input text-sm" value={jourForm.categorie}
                  onChange={e => setJourForm(f => ({
                    ...f, categorie: e.target.value as ChargeJournaliere['categorie'],
                    designation: '', unite: e.target.value === 'achat_materiaux' ? 'm³' : 'jour',
                  }))}>
                  {Object.entries(CATEGORIES_JOUR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {jourForm.categorie === 'location_materiel' && (
                <div className="xl:col-span-2">
                  <label className="label">Engin *</label>
                  <input className="input text-sm" list="engins-list-charges" placeholder="Sélectionner ou saisir..." value={jourForm.designation}
                    onChange={e => setJourForm(f => ({ ...f, designation: e.target.value }))} />
                  <datalist id="engins-list-charges">
                    {ENGINS_PREDEFINIS.map(e => <option key={e} value={e} />)}
                  </datalist>
                </div>
              )}
              {jourForm.categorie === 'achat_materiaux' && (
                <div className="xl:col-span-2">
                  <label className="label">Type matériau *</label>
                  <input className="input text-sm" list="types-materiaux" placeholder="G1, G2, Sable..." value={jourForm.designation}
                    onChange={e => setJourForm(f => ({
                      ...f, designation: e.target.value,
                      unite: UNITE_PAR_MATERIAU[e.target.value] || f.unite,
                    }))} />
                  <datalist id="types-materiaux">
                    {TYPES_MATERIAUX.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              )}
              {jourForm.categorie === 'autre' && (
                <div className="xl:col-span-2">
                  <label className="label">Désignation *</label>
                  <input className="input text-sm" value={jourForm.designation}
                    onChange={e => setJourForm(f => ({ ...f, designation: e.target.value }))} />
                </div>
              )}

              <div>
                <label className="label">{jourForm.categorie === 'location_materiel' ? 'Nb jours' : 'Quantité'}</label>
                <NumberInput className="input text-sm" value={jourForm.quantite}
                  onChange={v => setJourForm(f => ({ ...f, quantite: v }))} />
              </div>
              <div>
                <label className="label">Unité</label>
                <input className="input text-sm" value={jourForm.unite}
                  onChange={e => setJourForm(f => ({ ...f, unite: e.target.value }))} />
              </div>
              <div>
                <label className="label">{jourForm.categorie === 'location_materiel' ? 'Prix / jour' : 'Prix unitaire'}</label>
                <NumberInput className="input text-sm" value={jourForm.prix_unitaire}
                  onChange={v => setJourForm(f => ({ ...f, prix_unitaire: v }))} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                Montant : <strong className="text-gray-800">{fmt.currency(jourForm.quantite * jourForm.prix_unitaire)}</strong>
              </span>
              <div className="flex gap-2">
                <button onClick={() => { if (!jourForm.designation) { toast.error('Désignation requise'); return; } createJourMut.mutate(); }}
                  disabled={createJourMut.isPending} className="btn-primary text-sm">
                  {createJourMut.isPending ? 'Ajout...' : 'Ajouter'}
                </button>
                <button onClick={() => setShowJourForm(false)} className="btn-secondary text-sm">Annuler</button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Catégorie</th>
                <th className="table-header">Désignation</th>
                <th className="table-header text-right">Qté</th>
                <th className="table-header text-right">Prix unit.</th>
                <th className="table-header text-right">Montant</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingJour && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
              {chargesJour.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="table-cell">{fmt.date(c.date_jour)}</td>
                  <td className="table-cell">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      {c.categorie === 'location_materiel' ? <Truck className="w-3.5 h-3.5" /> : c.categorie === 'achat_materiaux' ? <Package className="w-3.5 h-3.5" /> : null}
                      {CATEGORIES_JOUR[c.categorie]}
                    </span>
                  </td>
                  <td className="table-cell font-medium">{c.designation}</td>
                  <td className="table-cell text-right">{fmt.number(c.quantite)} {c.unite}</td>
                  <td className="table-cell text-right">{fmt.currency(c.prix_unitaire)}</td>
                  <td className="table-cell text-right font-semibold">{fmt.currency(c.montant)}</td>
                  <td className="table-cell">
                    <button onClick={() => { if (confirm('Supprimer cette charge ?')) deleteJourMut.mutate(c.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </td>
                </tr>
              ))}
              {!loadingJour && !chargesJour.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">Aucune charge journalière pour ce mois</td></tr>
              )}
            </tbody>
            {chargesJour.length > 0 && (
              <tfoot className="border-t bg-brand-50">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-brand-700 text-sm">TOTAL JOURNALIER</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(totalJour)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Historique */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Historique des mois renseignés</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Mois</th>
                <th className="table-header text-right">Total charges</th>
                <th className="table-header text-right">Objectif</th>
                <th className="table-header text-right">Marge</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
              {charges.map(c => {
                const t = CHAMPS.reduce((s, ch) => s + (Number(c[ch.key]) || 0), 0);
                const m = (Number(c.objectif_mensuel) || 0) - t;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setMois(c.mois)}>
                    <td className="table-cell font-medium">{c.mois}</td>
                    <td className="table-cell text-right">{fmt.currency(t)}</td>
                    <td className="table-cell text-right text-gray-500">{fmt.currency(c.objectif_mensuel)}</td>
                    <td className={`table-cell text-right font-semibold ${m >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt.currency(m)}</td>
                    <td className="table-cell">
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer ce mois ?')) deleteMut.mutate(c.id); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !charges.length && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">Aucune charge renseignée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
