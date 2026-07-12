'use client';
// src/app/(app)/parc-materiel/page.tsx — Gestion du parc matériel (engins), Design System V2
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Wrench, Fuel, AlertTriangle, Download, MapPin, History, Ban, Plus, Edit2, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { fmt, exportCSV } from '@/lib/utils';
import { Card, CardHeader, Table, Badge, Button, Modal, StatCard, Input, EmptyState, Loading } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import NumberInput from '@/components/NumberInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

type Engin = {
  id: string; code: string | null; designation: string; marque: string | null; modele: string | null;
  immatriculation: string | null; type_engin: string | null; categorie_id: string | null; categorie_nom: string | null;
  statut: string; projet_id: string | null; projet_nom: string | null; code_projet: string | null;
  maintenances_actives: string | number;
};

type Maintenance = {
  id: string; engin_id: string; type_maintenance: 'preventive' | 'corrective' | 'inspection';
  description: string | null; date_prevue: string; prestataire: string | null;
  cout_prevu: number | null; date_prochaine_maintenance: string | null; statut: string;
  date_realisee: string | null; cout_reel: number | null;
};

type Projet = { id: string; nom: string; code_projet: string };
type Categorie = { id: string; nom: string };
type Materiau = { id: string; designation: string; quantite_stock: number; quantite_min: number; unite_mesure: string; statut: string; prix_unitaire_ht: number };
type CarburantMois = { mois: string; litres: number; montant: number; heures: number; l_par_h: number | null; anomalie_pct: number | null };

const STATUT_ENGIN_COLOR: Record<string, string> = {
  disponible:  'bg-green-100 text-green-700',
  en_service:  'bg-blue-100 text-blue-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  en_panne:    'bg-red-100 text-red-700',
  retire:      'bg-gray-200 text-gray-600',
};
const STATUT_ENGIN_LABEL: Record<string, string> = {
  disponible: 'Disponible', en_service: 'En service', maintenance: 'Maintenance', en_panne: 'En panne', retire: 'Retiré',
};

// Chantier PM-2 : statuts sélectionnables depuis le formulaire d'édition —
// "retire" n'y figure jamais, atteignable uniquement via l'action dédiée
// "Retirer" (confirmation requise), jamais par un simple changement de statut.
const STATUTS_ENGIN_EDITABLES = ['disponible', 'en_service', 'maintenance', 'en_panne'];

const emptyEnginForm = {
  designation: '', code: '', marque: '', modele: '', immatriculation: '', type_engin: '', categorie_id: '', statut: 'disponible',
};

const TYPE_MAINT_LABEL: Record<string, string> = {
  preventive: 'Préventive', corrective: 'Corrective', inspection: 'Inspection',
};
const STATUT_MAINT_COLOR: Record<string, string> = {
  planifiee: 'bg-gray-100 text-gray-700', en_cours: 'bg-yellow-100 text-yellow-700', terminee: 'bg-green-100 text-green-700',
};
const STATUT_MAINT_LABEL: Record<string, string> = {
  planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée',
};

const emptyMaintenanceForm = {
  type_maintenance: 'preventive' as Maintenance['type_maintenance'],
  description: '', date_prevue: '', prestataire: '', cout_prevu: 0, date_prochaine_maintenance: '',
};

export default function ParcMaterielPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFiltre, setTypeFiltre] = useState('');
  const [projetFiltre, setProjetFiltre] = useState('');

  const [affectationEngin, setAffectationEngin] = useState<Engin | null>(null);
  const [projetChoisi, setProjetChoisi] = useState('');
  const [maintenanceEngin, setMaintenanceEngin] = useState<Engin | null>(null);
  const [maintForm, setMaintForm] = useState(emptyMaintenanceForm);
  const [historiqueEngin, setHistoriqueEngin] = useState<Engin | null>(null);
  const [cloture, setCloture] = useState<{ maintenance: Maintenance; coutReel: number } | null>(null);
  const [carburantEngin, setCarburantEngin] = useState<Engin | null>(null);
  const [avecRetires, setAvecRetires] = useState(false);
  const [enginEdite, setEnginEdite] = useState<Engin | null>(null);
  const [enginModalOuvert, setEnginModalOuvert] = useState(false);
  const [enginForm, setEnginForm] = useState(emptyEnginForm);
  const [retraitEngin, setRetraitEngin] = useState<Engin | null>(null);

  const { data: enginsData, isLoading } = useQuery({
    queryKey: ['parc-engins', projetFiltre, avecRetires],
    queryFn: () => apiFetch(`/stock/engins?${projetFiltre ? `projet_id=${projetFiltre}&` : ''}avec_retires=${avecRetires}`).then(r => r.data || []),
  });

  const { data: projetsData } = useQuery({
    queryKey: ['parc-projets'],
    queryFn: () => apiFetch('/projets?limit=100').then(r => r.data || []),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['parc-categories'],
    queryFn: () => apiFetch('/stock/categories').then(r => r.data || []),
  });

  const { data: materiauxData } = useQuery({
    queryKey: ['parc-materiaux-carburant'],
    queryFn: () => apiFetch('/stock/materiaux?search=Gasoil').then(r => r.data || []),
  });

  const { data: maintenancesEngin, isLoading: loadingMaintenances } = useQuery({
    queryKey: ['parc-maintenances', historiqueEngin?.id],
    queryFn: () => apiFetch(`/stock/engins/${historiqueEngin!.id}/maintenances`).then(r => r.data || []),
    enabled: !!historiqueEngin,
  });

  const { data: carburantData, isLoading: loadingCarburant } = useQuery({
    queryKey: ['parc-carburant', carburantEngin?.id],
    queryFn: () => apiFetch(`/stock/engins/${carburantEngin!.id}/carburant`).then(r => r.data || []),
    enabled: !!carburantEngin,
  });

  const engins: Engin[] = enginsData || [];
  const projets: Projet[] = projetsData || [];
  const categories: Categorie[] = categoriesData || [];
  const gasoil: Materiau | undefined = (materiauxData || [])[0];
  const maintenances: Maintenance[] = maintenancesEngin || [];
  const carburantMois: CarburantMois[] = carburantData || [];

  const types = Array.from(new Set(engins.map(e => e.categorie_nom).filter(Boolean))) as string[];

  const filtered = engins.filter(e => {
    if (typeFiltre && e.categorie_nom !== typeFiltre) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${e.designation} ${e.code || ''} ${e.immatriculation || ''}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const totalEngins = engins.length;
  const enServiceCount = engins.filter(e => e.statut === 'en_service' || e.statut === 'disponible').length;
  const maintenanceCount = engins.filter(e => e.statut === 'maintenance').length;
  const nonAffectesCount = engins.filter(e => !e.projet_id).length;

  const gasoilNiveau = gasoil ? (Number(gasoil.quantite_stock) <= 0 ? 'rupture' : Number(gasoil.quantite_stock) <= Number(gasoil.quantite_min) ? 'bas' : 'ok') : null;

  const invalidateEngins = () => {
    qc.invalidateQueries({ queryKey: ['parc-engins'] });
  };

  const affecterMut = useMutation({
    mutationFn: () => apiFetch(`/stock/engins/${affectationEngin!.id}/affectation`, {
      method: 'POST', body: JSON.stringify({ projet_id: projetChoisi }),
    }).then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      invalidateEngins();
      toast.success('Engin affecté au marché');
      setAffectationEngin(null); setProjetChoisi('');
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'affectation"),
  });

  const libererMut = useMutation({
    mutationFn: (engin: Engin) => apiFetch(`/stock/engins/${engin.id}/liberer`, { method: 'POST' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidateEngins(); toast.success('Engin libéré du marché'); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la libération'),
  });

  const creerEnginMut = useMutation({
    mutationFn: () => apiFetch('/stock/engins', { method: 'POST', body: JSON.stringify(enginForm) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      invalidateEngins();
      toast.success('Engin créé');
      setEnginModalOuvert(false); setEnginForm(emptyEnginForm);
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la création'),
  });

  const modifierEnginMut = useMutation({
    mutationFn: () => apiFetch(`/stock/engins/${enginEdite!.id}`, { method: 'PUT', body: JSON.stringify(enginForm) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      invalidateEngins();
      toast.success('Engin modifié');
      setEnginModalOuvert(false); setEnginEdite(null); setEnginForm(emptyEnginForm);
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la modification'),
  });

  const retirerEnginMut = useMutation({
    mutationFn: (engin: Engin) => apiFetch(`/stock/engins/${engin.id}/retirer`, { method: 'POST' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidateEngins(); toast.success('Engin retiré du parc'); setRetraitEngin(null); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors du retrait'),
  });

  const reactiverEnginMut = useMutation({
    mutationFn: (engin: Engin) => apiFetch(`/stock/engins/${engin.id}`, { method: 'PUT', body: JSON.stringify({ statut: 'disponible' }) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidateEngins(); toast.success('Engin réactivé'); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la réactivation'),
  });

  const ouvrirCreation = () => { setEnginEdite(null); setEnginForm(emptyEnginForm); setEnginModalOuvert(true); };
  const ouvrirModification = (e: Engin) => {
    setEnginEdite(e);
    setEnginForm({
      designation: e.designation || '', code: e.code || '', marque: e.marque || '', modele: e.modele || '',
      immatriculation: e.immatriculation || '', type_engin: e.type_engin || '',
      categorie_id: e.categorie_id || '', statut: e.statut,
    });
    setEnginModalOuvert(true);
  };

  const planifierMut = useMutation({
    mutationFn: () => apiFetch(`/stock/engins/${maintenanceEngin!.id}/maintenance`, {
      method: 'POST',
      body: JSON.stringify({
        type_maintenance: maintForm.type_maintenance,
        description: maintForm.description || undefined,
        date_prevue: maintForm.date_prevue,
        prestataire: maintForm.prestataire || undefined,
        cout_prevu: maintForm.cout_prevu || undefined,
        date_prochaine_maintenance: maintForm.date_prochaine_maintenance || undefined,
      }),
    }).then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      invalidateEngins();
      toast.success('Maintenance planifiée');
      setMaintenanceEngin(null); setMaintForm(emptyMaintenanceForm);
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la planification'),
  });

  const cloturerMut = useMutation({
    mutationFn: () => apiFetch(`/stock/maintenances/${cloture!.maintenance.id}/cloturer`, {
      method: 'PATCH',
      body: JSON.stringify({ cout_reel: cloture!.coutReel || undefined }),
    }).then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => {
      invalidateEngins();
      qc.invalidateQueries({ queryKey: ['parc-maintenances'] });
      toast.success('Maintenance clôturée');
      setCloture(null);
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la clôture'),
  });

  const handleExportCSV = () => {
    exportCSV('ParcMateriel.csv',
      ['Désignation', 'Code', 'Catégorie', 'Immatriculation', 'Statut', 'Marché affecté', 'Maintenances actives'],
      filtered.map(e => [e.designation, e.code || '', e.categorie_nom || '', e.immatriculation || '', e.statut, e.projet_nom || 'Non affecté', e.maintenances_actives]));
  };

  const columns: TableColumn<Engin>[] = [
    { key: 'designation', header: 'Désignation', render: e => (
      <div>
        <span className="font-medium text-gray-800">{e.designation}</span>
        {e.code && <span className="text-xs text-gray-400 ml-2">{e.code}</span>}
      </div>
    ) },
    { key: 'categorie_nom', header: 'Catégorie', render: e => <span className="text-gray-500 text-sm">{e.categorie_nom || '—'}</span> },
    { key: 'immatriculation', header: 'Immatriculation', render: e => <span className="font-mono text-xs">{e.immatriculation || '—'}</span> },
    { key: 'statut', header: 'Statut', render: e => (
      <Badge tone="gray" className={STATUT_ENGIN_COLOR[e.statut] || 'bg-gray-100 text-gray-700'}>
        {STATUT_ENGIN_LABEL[e.statut] || e.statut}
      </Badge>
    ) },
    { key: 'projet', header: 'Marché affecté', render: e => e.projet_nom
      ? <span className="text-sm text-gray-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" />{e.projet_nom}</span>
      : <span className="text-xs text-gray-400 italic">Non affecté</span>,
    },
    { key: 'maintenances_actives', header: 'Maintenances', align: 'center', render: e => Number(e.maintenances_actives) > 0
      ? <Badge tone="warning">{e.maintenances_actives}</Badge>
      : <span className="text-gray-300 text-xs">—</span>,
    },
    { key: 'actions', header: 'Actions', render: e => e.statut === 'retire' ? (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button size="sm" variant="secondary" icon={<Edit2 className="w-3.5 h-3.5" />}
          data-testid={`modifier-engin-${e.id}`} onClick={() => ouvrirModification(e)}>Modifier</Button>
        <Button size="sm" variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />}
          data-testid={`reactiver-engin-${e.id}`} loading={reactiverEnginMut.isPending}
          onClick={() => reactiverEnginMut.mutate(e)}>Réactiver</Button>
      </div>
    ) : (
      <div className="flex items-center gap-1.5 flex-wrap">
        {e.projet_id ? (
          <Button size="sm" variant="secondary" icon={<Ban className="w-3.5 h-3.5" />}
            data-testid={`liberer-engin-${e.id}`} onClick={() => libererMut.mutate(e)} loading={libererMut.isPending}>Libérer</Button>
        ) : (
          <Button size="sm" variant="secondary" icon={<MapPin className="w-3.5 h-3.5" />}
            data-testid={`affecter-engin-${e.id}`} onClick={() => { setAffectationEngin(e); setProjetChoisi(''); }}>Affecter</Button>
        )}
        <Button size="sm" variant="secondary" icon={<Wrench className="w-3.5 h-3.5" />}
          onClick={() => { setMaintenanceEngin(e); setMaintForm(emptyMaintenanceForm); }}>Entretien</Button>
        <Button size="sm" variant="ghost" icon={<History className="w-3.5 h-3.5" />}
          onClick={() => setHistoriqueEngin(e)}>Historique</Button>
        <Button size="sm" variant="ghost" icon={<Fuel className="w-3.5 h-3.5" />}
          onClick={() => setCarburantEngin(e)}>Carburant</Button>
        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />}
          data-testid={`modifier-engin-${e.id}`} onClick={() => ouvrirModification(e)}>Modifier</Button>
        <Button size="sm" variant="ghost" icon={<XCircle className="w-3.5 h-3.5" />}
          data-testid={`retirer-engin-${e.id}`} onClick={() => setRetraitEngin(e)}>Retirer</Button>
      </div>
    ) },
  ];

  const maintenanceColumns: TableColumn<Maintenance>[] = [
    { key: 'date_prevue', header: 'Prévue', render: m => fmt.date(m.date_prevue) },
    { key: 'type_maintenance', header: 'Type', render: m => <Badge tone="gray">{TYPE_MAINT_LABEL[m.type_maintenance]}</Badge> },
    { key: 'description', header: 'Description', render: m => <span className="text-sm text-gray-600">{m.description || '—'}</span> },
    { key: 'prestataire', header: 'Prestataire', render: m => m.prestataire || '—' },
    { key: 'cout', header: 'Coût prévu / réel', align: 'right', render: m => (
      <span className="text-sm">{m.cout_prevu ? fmt.currency(m.cout_prevu) : '—'}{m.cout_reel ? <> / <strong>{fmt.currency(m.cout_reel)}</strong></> : ''}</span>
    ) },
    { key: 'statut', header: 'Statut', render: m => (
      <Badge tone="gray" className={STATUT_MAINT_COLOR[m.statut]}>{STATUT_MAINT_LABEL[m.statut] || m.statut}</Badge>
    ) },
    { key: 'actions', header: 'Actions', render: m => (m.statut === 'planifiee' || m.statut === 'en_cours') ? (
      <Button size="sm" onClick={() => setCloture({ maintenance: m, coutReel: m.cout_prevu || 0 })}>Clôturer</Button>
    ) : <span className="text-xs text-gray-400">{fmt.date(m.date_realisee)}</span>,
    },
  ];

  const carburantColumns: TableColumn<CarburantMois>[] = [
    { key: 'mois', header: 'Mois', render: c => <span className="font-medium">{c.mois}</span> },
    { key: 'litres', header: 'Litres', align: 'right', render: c => `${fmt.number(c.litres)} L` },
    { key: 'montant', header: 'Coût', align: 'right', render: c => fmt.currency(c.montant) },
    { key: 'heures', header: 'Heures', align: 'right', render: c => c.heures ? `${fmt.number(c.heures)} h` : '—' },
    { key: 'l_par_h', header: 'L/h', align: 'right', render: c => c.l_par_h !== null ? fmt.number(c.l_par_h) : '—' },
    { key: 'anomalie', header: 'Anomalie', render: c => c.anomalie_pct !== null ? (
      <Badge tone="danger">L/h {c.anomalie_pct > 0 ? '+' : ''}{c.anomalie_pct}% vs mois dernier</Badge>
    ) : <span className="text-gray-300 text-xs">—</span> },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parc Matériel</h1>
          <p className="text-sm text-gray-500">{totalEngins} engin(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExportCSV} icon={<Download className="w-4 h-4" />}>CSV</Button>
          <Button data-testid="ouvrir-creation-engin" onClick={ouvrirCreation} icon={<Plus className="w-4 h-4" />}>Nouvel engin</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total engins" value={totalEngins} icon={Truck} tone="blue" />
        <StatCard label="En service" value={enServiceCount} icon={Truck} tone="green" />
        <StatCard label="En maintenance" value={maintenanceCount} icon={Wrench} tone="yellow" />
        <StatCard label="Non affectés" value={nonAffectesCount} icon={MapPin} tone="gray" />
      </div>

      {/* Carburant + Alertes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Fuel className="w-4 h-4 text-gray-400" /> Carburant</h3>
            <Link href="/stock" className="text-xs text-brand-600 hover:underline">Gérer dans Stock →</Link>
          </div>
          {gasoil ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-800">{fmt.number(gasoil.quantite_stock)} <span className="text-sm font-normal text-gray-400">{gasoil.unite_mesure}</span></p>
                <p className="text-xs text-gray-400">Seuil d'alerte : {fmt.number(gasoil.quantite_min)} {gasoil.unite_mesure}</p>
              </div>
              <Badge tone="gray" className={gasoilNiveau === 'rupture' ? 'bg-red-100 text-red-700' : gasoilNiveau === 'bas' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                {gasoilNiveau === 'rupture' ? 'Rupture' : gasoilNiveau === 'bas' ? 'Bas' : 'OK'}
              </Badge>
            </div>
          ) : <p className="text-sm text-gray-400">Aucune donnée carburant</p>}
        </Card>

        <Card>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-gray-400" /> Alertes Parc</h3>
          <div className="space-y-1.5 text-sm">
            {maintenanceCount === 0 && gasoilNiveau !== 'bas' && gasoilNiveau !== 'rupture' && (
              <p className="text-gray-400">Aucune alerte</p>
            )}
            {maintenanceCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Engins en maintenance</span>
                <Badge tone="warning">{maintenanceCount}</Badge>
              </div>
            )}
            {(gasoilNiveau === 'bas' || gasoilNiveau === 'rupture') && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Carburant {gasoilNiveau === 'rupture' ? 'en rupture' : 'bas'}</span>
                <Badge tone="danger">Gasoil</Badge>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm w-56" value={typeFiltre} onChange={e => setTypeFiltre(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input text-sm w-56" value={projetFiltre} onChange={e => setProjetFiltre(e.target.value)}>
          <option value="">Tous les marchés</option>
          {projets.map(p => <option key={p.id} value={p.id}>{p.code_projet} — {p.nom}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
          <input type="checkbox" checked={avecRetires} onChange={e => setAvecRetires(e.target.checked)} />
          Afficher les engins retirés
        </label>
      </Card>

      {/* Tableau engins */}
      {isLoading ? <Loading label="Chargement du parc..." /> : filtered.length === 0 ? (
        <EmptyState icon={Truck} title="Aucun engin" description="Aucun engin ne correspond aux filtres actuels." />
      ) : (
        <Card padded={false}>
          <Table<Engin>
            columns={columns}
            data={filtered}
            rowKey={e => e.id}
            loading={isLoading}
            emptyMessage="Aucun engin"
            rowClassName={e => e.statut === 'maintenance' ? 'bg-yellow-50/30' : undefined}
          />
        </Card>
      )}

      {/* Modal Affectation */}
      <Modal open={!!affectationEngin} onClose={() => setAffectationEngin(null)}
        title={affectationEngin ? `Affecter — ${affectationEngin.designation}` : ''}>
        <div className="space-y-4">
          <div>
            <label className="label">Marché *</label>
            <select className="input" value={projetChoisi} onChange={e => setProjetChoisi(e.target.value)}>
              <option value="">Sélectionner un marché</option>
              {projets.map(p => <option key={p.id} value={p.id}>{p.code_projet} — {p.nom}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => affecterMut.mutate()} loading={affecterMut.isPending} disabled={!projetChoisi}>
            Affecter
          </Button>
          <Button variant="secondary" onClick={() => setAffectationEngin(null)}>Annuler</Button>
        </div>
      </Modal>

      {/* Modal Planification maintenance */}
      <Modal open={!!maintenanceEngin} onClose={() => setMaintenanceEngin(null)}
        title={maintenanceEngin ? `Planifier un entretien — ${maintenanceEngin.designation}` : ''}>
        <div className="space-y-4">
          <div>
            <label className="label">Type de maintenance *</label>
            <select className="input" value={maintForm.type_maintenance}
              onChange={e => setMaintForm(f => ({ ...f, type_maintenance: e.target.value as Maintenance['type_maintenance'] }))}>
              <option value="preventive">Préventive</option>
              <option value="corrective">Corrective</option>
              <option value="inspection">Inspection</option>
            </select>
          </div>
          <div>
            <label className="label">Date prévue *</label>
            <input type="date" className="input" value={maintForm.date_prevue}
              onChange={e => setMaintForm(f => ({ ...f, date_prevue: e.target.value }))} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={maintForm.description}
              onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Vidange, révision, réparation..." />
          </div>
          <div>
            <label className="label">Prestataire</label>
            <input className="input" value={maintForm.prestataire}
              onChange={e => setMaintForm(f => ({ ...f, prestataire: e.target.value }))} />
          </div>
          <div>
            <label className="label">Coût prévu (MAD)</label>
            <NumberInput min={0} className="input" value={maintForm.cout_prevu}
              onChange={(v) => setMaintForm(f => ({ ...f, cout_prevu: v }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => planifierMut.mutate()} loading={planifierMut.isPending} disabled={!maintForm.date_prevue}>
            Planifier
          </Button>
          <Button variant="secondary" onClick={() => setMaintenanceEngin(null)}>Annuler</Button>
        </div>
      </Modal>

      {/* Modal Historique des maintenances */}
      <Modal open={!!historiqueEngin} onClose={() => setHistoriqueEngin(null)} maxWidth="2xl"
        title={historiqueEngin ? `Historique d'entretien — ${historiqueEngin.designation}` : ''}>
        {loadingMaintenances ? <Loading label="Chargement..." /> : maintenances.length === 0 ? (
          <EmptyState icon={Wrench} title="Aucune maintenance enregistrée" />
        ) : (
          <Table<Maintenance> columns={maintenanceColumns} data={maintenances} rowKey={m => m.id} emptyMessage="Aucune maintenance" />
        )}
      </Modal>

      {/* Modal Carburant par engin (tous marchés confondus) */}
      <Modal open={!!carburantEngin} onClose={() => setCarburantEngin(null)} maxWidth="2xl"
        title={carburantEngin ? `Carburant — ${carburantEngin.designation}` : ''}>
        {loadingCarburant ? <Loading label="Chargement..." /> : carburantMois.length === 0 ? (
          <EmptyState icon={Fuel} title="Aucun plein enregistré" description="Saisir un plein depuis le Journal Matériel d'un marché." />
        ) : (
          <Table<CarburantMois> columns={carburantColumns} data={carburantMois} rowKey={c => c.mois} emptyMessage="Aucune donnée" />
        )}
      </Modal>

      {/* Modal Clôture maintenance */}
      <Modal open={!!cloture} onClose={() => setCloture(null)} title="Clôturer la maintenance">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {cloture?.maintenance.description || TYPE_MAINT_LABEL[cloture?.maintenance.type_maintenance || 'preventive']}
          </p>
          <div>
            <label className="label">Coût réel constaté (MAD)</label>
            <NumberInput min={0} className="input" value={cloture?.coutReel || 0}
              onChange={(v) => setCloture(c => c ? { ...c, coutReel: v } : c)} autoFocus />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => cloturerMut.mutate()} loading={cloturerMut.isPending}>Clôturer</Button>
          <Button variant="secondary" onClick={() => setCloture(null)}>Annuler</Button>
        </div>
      </Modal>

      {/* Modal Nouvel engin / Modifier un engin (Chantier PM-2) */}
      <Modal open={enginModalOuvert} onClose={() => { setEnginModalOuvert(false); setEnginEdite(null); }}
        title={enginEdite ? `Modifier — ${enginEdite.designation}` : 'Nouvel engin'}>
        <div className="space-y-4">
          <div>
            <label className="label">Désignation *</label>
            <input className="input" data-testid="engin-form-designation" value={enginForm.designation}
              onChange={e => setEnginForm(f => ({ ...f, designation: e.target.value }))} placeholder="Ex: Camion 8x4" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Code</label>
              <input className="input" value={enginForm.code}
                onChange={e => setEnginForm(f => ({ ...f, code: e.target.value }))} placeholder="Ex: ENG-001" />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={enginForm.categorie_id}
                onChange={e => setEnginForm(f => ({ ...f, categorie_id: e.target.value }))}>
                <option value="">Aucune</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Marque</label>
              <input className="input" value={enginForm.marque}
                onChange={e => setEnginForm(f => ({ ...f, marque: e.target.value }))} />
            </div>
            <div>
              <label className="label">Modèle</label>
              <input className="input" value={enginForm.modele}
                onChange={e => setEnginForm(f => ({ ...f, modele: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <input className="input" value={enginForm.type_engin}
                onChange={e => setEnginForm(f => ({ ...f, type_engin: e.target.value }))} placeholder="Ex: Camion benne 8x4" />
            </div>
            <div>
              <label className="label">Immatriculation</label>
              <input className="input" value={enginForm.immatriculation}
                onChange={e => setEnginForm(f => ({ ...f, immatriculation: e.target.value }))} />
            </div>
          </div>
          {enginEdite && (
            <div>
              <label className="label">Statut</label>
              <select className="input" value={enginForm.statut}
                onChange={e => setEnginForm(f => ({ ...f, statut: e.target.value }))}>
                {STATUTS_ENGIN_EDITABLES.map(s => <option key={s} value={s}>{STATUT_ENGIN_LABEL[s]}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="confirmer-engin-form"
            onClick={() => enginEdite ? modifierEnginMut.mutate() : creerEnginMut.mutate()}
            loading={creerEnginMut.isPending || modifierEnginMut.isPending} disabled={!enginForm.designation}>
            {enginEdite ? 'Enregistrer' : 'Créer'}
          </Button>
          <Button variant="secondary" onClick={() => { setEnginModalOuvert(false); setEnginEdite(null); }}>Annuler</Button>
        </div>
      </Modal>

      {/* Modal Retirer un engin (Chantier PM-2) — désactivation logique, jamais de suppression physique */}
      <Modal open={!!retraitEngin} onClose={() => setRetraitEngin(null)} title="Retirer un engin">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Retirer <strong>{retraitEngin?.designation}</strong> du parc actif ? L'engin ne sera plus proposé pour affectation,
            mais son historique (affectations, maintenances, carburant) reste conservé. Cette action est réversible (bouton "Réactiver").
          </p>
          {retraitEngin?.projet_id && (
            <p className="text-sm text-red-600">Cet engin est actuellement affecté — libérez-le d'abord.</p>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="danger" data-testid="confirmer-retrait-engin"
            onClick={() => retirerEnginMut.mutate(retraitEngin!)} loading={retirerEnginMut.isPending}
            disabled={!!retraitEngin?.projet_id}>
            Retirer
          </Button>
          <Button variant="secondary" onClick={() => setRetraitEngin(null)}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}
