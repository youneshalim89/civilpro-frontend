'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Pencil, Plus, Truck, Package, Wrench, Fuel, Users, CalendarDays, CalendarRange, Calendar, Car, Route, ShoppingCart, HardHat } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { EnginsDatalist } from '@/components/marches/EnginsDatalist';
import { Card, CardHeader, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import NumberInput from '@/components/NumberInput';
import type { ChargeMensuelle, ChargeJournaliere } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

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

// Chantier Categories-Charges : "achat_materiaux" (matériaux consommables —
// ciment, agrégats...) et "achat_materiel" (outillage/équipement) coexistent
// volontairement — libellés distincts pour éviter la confusion à la saisie.
const CATEGORIES_JOUR: Record<string, { label: string; icon: any }> = {
  gasoil:             { label: 'Gasoil',                          icon: Fuel },
  main_oeuvre:        { label: "Main d'œuvre",                    icon: Users },
  achat_materiaux:    { label: 'Fournitures (matériaux)',         icon: Package },
  achat_materiel:     { label: 'Achat de matériel (outillage)',   icon: ShoppingCart },
  reparations:        { label: 'Réparations',                     icon: Wrench },
  location_materiel:  { label: 'Location matériel',               icon: Truck },
  frais_deplacement:  { label: 'Frais de déplacement',            icon: Car },
  frais_transport:    { label: 'Frais de transport',              icon: Route },
  sous_traitant:      { label: 'Sous-traitant',                   icon: HardHat },
  autre:              { label: 'Divers',                          icon: Calendar },
};

// Unité par défaut proposée à la sélection de la catégorie (reste modifiable manuellement).
const UNITE_DEFAUT_CATEGORIE: Record<string, string> = {
  achat_materiaux: 'm³', gasoil: 'L',
  frais_deplacement: 'forfait', frais_transport: 'forfait', achat_materiel: 'forfait', sous_traitant: 'forfait',
};

// Catégories à désignation libre (pas de sélecteur dédié type engin/matériau)
const CATEGORIES_DESIGNATION_LIBRE = ['autre', 'gasoil', 'main_oeuvre', 'reparations', 'frais_deplacement', 'frais_transport', 'achat_materiel', 'sous_traitant'];

// Composants de date locaux (pas toISOString) — évite le décalage d'un jour
// selon le fuseau horaire, même correctif que Fix-Pointage-TZ.
const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const todayLocal = () => toLocalDateStr(new Date());
const moisActuel = () => todayLocal().slice(0, 7);

// Lundi → dimanche de la semaine en cours (composants locaux)
const semaineEnCours = () => {
  const now = new Date();
  const jour = (now.getDay() + 6) % 7; // 0 = lundi
  const lundi = new Date(now); lundi.setDate(now.getDate() - jour);
  const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() + 6);
  return { debut: toLocalDateStr(lundi), fin: toLocalDateStr(dimanche) };
};

const emptyChargeJour = {
  date_jour: todayLocal(),
  categorie: 'gasoil' as ChargeJournaliere['categorie'],
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
    queryFn:  () => apiFetch(`/marches/${id}`).then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['charges', id],
    queryFn:  () => apiFetch(`/marches/${id}/charges`).then(r => r.data),
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
    mutationFn: () => apiFetch(`/marches/${id}/charges`, { method: 'POST', body: JSON.stringify({ mois, ...form, objectif_mensuel: objectif }) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['charges', id] }); toast.success('Charges enregistrées'); },
    onError:    () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const deleteMut = useMutation({
    mutationFn: (chargeId: string) => apiFetch(`/marches/${id}/charges/${chargeId}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['charges', id] }); toast.success('Supprimé'); },
  });

  // ── Charges journalières (saisie rapide des dépenses de chantier) ──
  const [showJourForm, setShowJourForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [jourForm, setJourForm] = useState(emptyChargeJour);

  const { data: chargesJourData, isLoading: loadingJour } = useQuery({
    queryKey: ['charges-jour', id, mois],
    queryFn:  () => apiFetch(`/marches/${id}/charges-journalieres?mois=${mois}`).then(r => r.data),
  });
  const chargesJour: ChargeJournaliere[] = chargesJourData || [];

  const resetJourForm = () => {
    setJourForm(emptyChargeJour);
    setEditingId(null);
    setShowJourForm(false);
  };

  const createJourMut = useMutation({
    mutationFn: () => apiFetch(`/marches/${id}/charges-journalieres`, { method: 'POST', body: JSON.stringify(jourForm) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['charges-jour', id, mois] });
      toast.success('Charge ajoutée');
      resetJourForm();
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const updateJourMut = useMutation({
    mutationFn: () => apiFetch(`/marches/${id}/charges-journalieres/${editingId}`, { method: 'PATCH', body: JSON.stringify(jourForm) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['charges-jour', id, mois] });
      toast.success('Charge modifiée');
      resetJourForm();
    },
    onError: () => toast.error('Erreur lors de la modification'),
  });

  const deleteJourMut = useMutation({
    mutationFn: (chargeId: string) => apiFetch(`/marches/${id}/charges-journalieres/${chargeId}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['charges-jour', id, mois] }); toast.success('Supprimé'); },
  });

  const startEdit = (c: ChargeJournaliere) => {
    setEditingId(c.id);
    setJourForm({
      date_jour: toLocalDateStr(new Date(c.date_jour)),
      categorie: c.categorie,
      designation: c.designation,
      quantite: Number(c.quantite),
      unite: c.unite,
      prix_unitaire: Number(c.prix_unitaire),
    });
    setShowJourForm(true);
  };

  const totalJour = chargesJour.reduce((s, c) => s + (Number(c.montant) || 0), 0);

  // Totaux par catégorie (mois affiché)
  const totauxParCategorie = Object.keys(CATEGORIES_JOUR).map(cat => ({
    cat,
    total: chargesJour.filter(c => c.categorie === cat).reduce((s, c) => s + Number(c.montant), 0),
  })).filter(t => t.total > 0);

  // Total du jour (aujourd'hui, date locale) — uniquement fiable si le mois affiché est le mois en cours
  const totalAujourdhui = chargesJour
    .filter(c => toLocalDateStr(new Date(c.date_jour)) === todayLocal())
    .reduce((s, c) => s + Number(c.montant), 0);

  // Total de la semaine en cours — limité aux données du mois affiché (documenté : si la semaine
  // chevauche deux mois, seule la partie du mois actuellement chargé est comptée).
  const { debut: semaineDebut, fin: semaineFin } = semaineEnCours();
  const totalSemaine = chargesJour
    .filter(c => { const d = toLocalDateStr(new Date(c.date_jour)); return d >= semaineDebut && d <= semaineFin; })
    .reduce((s, c) => s + Number(c.montant), 0);
  const semaineChevaucheMois = semaineDebut.slice(0, 7) !== semaineFin.slice(0, 7);

  const totalMensuelForm = CHAMPS.reduce((s, c) => s + (form[c.key] || 0), 0);
  const total = totalMensuelForm + totalJour;
  const marge = objectif - total;

  const chargeJourColumns: TableColumn<ChargeJournaliere>[] = [
    { key: 'date_jour', header: 'Date', render: (c) => fmt.date(c.date_jour) },
    {
      key: 'categorie', header: 'Catégorie',
      render: (c) => {
        const Icon = CATEGORIES_JOUR[c.categorie]?.icon;
        return (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {CATEGORIES_JOUR[c.categorie]?.label || c.categorie}
          </span>
        );
      },
    },
    { key: 'designation', header: 'Désignation', render: (c) => <span className="font-medium">{c.designation}</span> },
    { key: 'quantite', header: 'Qté', align: 'right', render: (c) => `${fmt.number(c.quantite)} ${c.unite}` },
    { key: 'prix_unitaire', header: 'Prix unit.', align: 'right', render: (c) => fmt.currency(c.prix_unitaire) },
    { key: 'montant', header: 'Montant', align: 'right', render: (c) => <span className="font-semibold">{fmt.currency(c.montant)}</span> },
    {
      key: 'actions', header: 'Actions',
      render: (c) => (
        <div className="flex items-center gap-1">
          <button onClick={() => startEdit(c)}
            className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-4 h-4 text-gray-400" /></button>
          <button onClick={() => { if (confirm('Supprimer cette charge ?')) deleteJourMut.mutate(c.id); }}
            className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
        </div>
      ),
    },
  ];

  const chargeJourFooter = chargesJour.length > 0 && (
    <tr className="border-t bg-brand-50">
      <td colSpan={5} className="px-4 py-3 text-right font-bold text-brand-700 text-sm">TOTAL JOURNALIER</td>
      <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(totalJour)}</td>
      <td></td>
    </tr>
  );

  const historiqueColumns: TableColumn<ChargeMensuelle>[] = [
    { key: 'mois', header: 'Mois', render: (c) => <span className="font-medium">{c.mois}</span> },
    {
      key: 'total', header: 'Total charges', align: 'right',
      render: (c) => fmt.currency(CHAMPS.reduce((s, ch) => s + (Number(c[ch.key]) || 0), 0)),
    },
    { key: 'objectif_mensuel', header: 'Objectif', align: 'right', render: (c) => <span className="text-gray-500">{fmt.currency(c.objectif_mensuel)}</span> },
    {
      key: 'marge', header: 'Marge', align: 'right',
      render: (c) => {
        const t = CHAMPS.reduce((s, ch) => s + (Number(c[ch.key]) || 0), 0);
        const m = (Number(c.objectif_mensuel) || 0) - t;
        return <span className={`font-semibold ${m >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt.currency(m)}</span>;
      },
    },
    {
      key: 'actions', header: 'Actions',
      render: (c) => (
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer ce mois ?')) deleteMut.mutate(c.id); }}
          className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Charges Mensuelles</h1>
            <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
          </div>
        </div>
        <Link href={`/marches/${id}/entretien-materiel`} className="btn-secondary text-sm flex items-center gap-2">
          <Wrench className="w-4 h-4" /> Entretien Matériel
        </Link>
      </div>

      {/* Sélecteur de mois */}
      <Card className="p-4 flex items-center gap-4">
        <label className="label mb-0 whitespace-nowrap">Mois</label>
        <input type="month" className="input text-sm w-48" value={mois} onChange={e => setMois(e.target.value)} />
        {current && (
          <span className="text-xs text-gray-400">Dernière mise à jour enregistrée pour ce mois</span>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Formulaire */}
        <Card className="xl:col-span-2">
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
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} icon={<Save className="w-4 h-4" />} className="mt-5">
            {saveMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </Card>

        {/* Récapitulatif */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-gray-800 mb-4">Récapitulatif — {mois}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Objectif mensuel</span><span className="font-semibold">{fmt.currency(objectif)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Charges fixes (formulaire)</span><span>{fmt.currency(totalMensuelForm)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Charges journalières (mois)</span><span>{fmt.currency(totalJour)}</span></div>
              <div className="flex justify-between border-t pt-3"><span className="text-gray-500 font-medium">Total charges</span><span className="font-bold text-red-600">{fmt.currency(total)}</span></div>
              <div className={`flex justify-between border-t pt-3 font-bold ${marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span>Marge brute</span><span>{fmt.currency(marge)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Charges journalières — saisie rapide des dépenses de chantier */}
      <Card padded={false}>
        <CardHeader
          title={`Charges journalières — ${mois}`}
          action={<Button onClick={() => { if (showJourForm) resetJourForm(); else setShowJourForm(true); }} icon={<Plus className="w-4 h-4" />}>{showJourForm ? 'Fermer' : 'Ajouter une charge'}</Button>}
        />

        {/* Totaux jour / semaine / mois */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 border-b">
          <Card className="p-4 border-l-4 border-brand-400">
            <p className="text-xs text-gray-500 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Aujourd'hui</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{fmt.currency(totalAujourdhui)}</p>
          </Card>
          <Card className="p-4 border-l-4 border-blue-400">
            <p className="text-xs text-gray-500 flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5" /> Semaine en cours{semaineChevaucheMois ? ' (mois affiché)' : ''}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{fmt.currency(totalSemaine)}</p>
          </Card>
          <Card className="p-4 border-l-4 border-red-400">
            <p className="text-xs text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Mois — {mois}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{fmt.currency(totalJour)}</p>
          </Card>
        </div>

        {/* Totaux par catégorie */}
        {totauxParCategorie.length > 0 && (
          <div className="flex flex-wrap gap-3 px-5 pb-5 border-b">
            {totauxParCategorie.map(({ cat, total: t }) => {
              const Icon = CATEGORIES_JOUR[cat]?.icon;
              return (
                <span key={cat} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-1.5">
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {CATEGORIES_JOUR[cat]?.label} : <strong>{fmt.currency(t)}</strong>
                </span>
              );
            })}
          </div>
        )}

        {showJourForm && (
          <div className="p-5 border-b bg-gray-50">
            {editingId && <p className="text-xs text-brand-600 font-medium mb-3">Modification d'une charge existante</p>}
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
                    designation: '', unite: UNITE_DEFAUT_CATEGORIE[e.target.value] || 'jour',
                  }))}>
                  {Object.entries(CATEGORIES_JOUR).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>

              {jourForm.categorie === 'location_materiel' && (
                <div className="xl:col-span-2">
                  <label className="label">Engin *</label>
                  <input className="input text-sm" list="engins-list-charges" placeholder="Sélectionner ou saisir..." value={jourForm.designation}
                    onChange={e => setJourForm(f => ({ ...f, designation: e.target.value }))} />
                  <EnginsDatalist id="engins-list-charges" />
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
              {CATEGORIES_DESIGNATION_LIBRE.includes(jourForm.categorie) && (
                <div className="xl:col-span-2">
                  <label className="label">Désignation *</label>
                  <input className="input text-sm" placeholder="Ex: Plein gasoil pelle, Journaliers coffrage..." value={jourForm.designation}
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
                <Button onClick={() => {
                  if (!jourForm.designation) { toast.error('Désignation requise'); return; }
                  if (editingId) updateJourMut.mutate(); else createJourMut.mutate();
                }} loading={createJourMut.isPending || updateJourMut.isPending}>
                  {editingId
                    ? (updateJourMut.isPending ? 'Enregistrement...' : 'Enregistrer les modifications')
                    : (createJourMut.isPending ? 'Ajout...' : 'Ajouter')}
                </Button>
                <Button variant="secondary" onClick={resetJourForm}>Annuler</Button>
              </div>
            </div>
          </div>
        )}

        <Table<ChargeJournaliere>
          columns={chargeJourColumns}
          data={chargesJour}
          rowKey={(c) => c.id}
          loading={loadingJour}
          emptyMessage="Aucune charge journalière pour ce mois"
          footer={chargeJourFooter}
        />
      </Card>

      {/* Historique */}
      <Card padded={false}>
        <CardHeader title="Historique des mois renseignés" />
        <Table<ChargeMensuelle>
          columns={historiqueColumns}
          data={charges}
          rowKey={(c) => c.id}
          loading={isLoading}
          emptyMessage="Aucune charge renseignée"
          onRowClick={(c) => setMois(c.mois)}
        />
      </Card>
    </div>
  );
}
