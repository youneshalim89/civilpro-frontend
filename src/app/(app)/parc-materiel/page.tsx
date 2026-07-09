'use client';
// src/app/(app)/parc-materiel/page.tsx — Gestion du parc matériel (engins), Design System V2
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Wrench, Fuel, AlertTriangle, Download, MapPin, History, Ban } from 'lucide-react';
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
  immatriculation: string | null; type_engin: string | null; categorie_nom: string | null;
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
type Materiau = { id: string; designation: string; quantite_stock: number; quantite_min: number; unite_mesure: string; statut: string };

const STATUT_ENGIN_COLOR: Record<string, string> = {
  disponible:  'bg-green-100 text-green-700',
  en_service:  'bg-blue-100 text-blue-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  en_panne:    'bg-red-100 text-red-700',
};
const STATUT_ENGIN_LABEL: Record<string, string> = {
  disponible: 'Disponible', en_service: 'En service', maintenance: 'Maintenance', en_panne: 'En panne',
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

  const { data: enginsData, isLoading } = useQuery({
    queryKey: ['parc-engins', projetFiltre],
    queryFn: () => apiFetch(`/stock/engins${projetFiltre ? `?projet_id=${projetFiltre}` : ''}`).then(r => r.data || []),
  });

  const { data: projetsData } = useQuery({
    queryKey: ['parc-projets'],
    queryFn: () => apiFetch('/projets?limit=100').then(r => r.data || []),
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

  const engins: Engin[] = enginsData || [];
  const projets: Projet[] = projetsData || [];
  const gasoil: Materiau | undefined = (materiauxData || [])[0];
  const maintenances: Maintenance[] = maintenancesEngin || [];

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
      toast.success('Engin affecté au projet');
      setAffectationEngin(null); setProjetChoisi('');
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'affectation"),
  });

  const libererMut = useMutation({
    mutationFn: (engin: Engin) => apiFetch(`/stock/engins/${engin.id}/liberer`, { method: 'POST' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess: () => { invalidateEngins(); toast.success('Engin libéré du projet'); },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la libération'),
  });

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
      ['Désignation', 'Code', 'Catégorie', 'Immatriculation', 'Statut', 'Projet affecté', 'Maintenances actives'],
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
    { key: 'projet', header: 'Projet affecté', render: e => e.projet_nom
      ? <span className="text-sm text-gray-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" />{e.projet_nom}</span>
      : <span className="text-xs text-gray-400 italic">Non affecté</span>,
    },
    { key: 'maintenances_actives', header: 'Maintenances', align: 'center', render: e => Number(e.maintenances_actives) > 0
      ? <Badge tone="warning">{e.maintenances_actives}</Badge>
      : <span className="text-gray-300 text-xs">—</span>,
    },
    { key: 'actions', header: 'Actions', render: e => (
      <div className="flex items-center gap-1.5 flex-wrap">
        {e.projet_id ? (
          <Button size="sm" variant="secondary" icon={<Ban className="w-3.5 h-3.5" />}
            onClick={() => libererMut.mutate(e)} loading={libererMut.isPending}>Libérer</Button>
        ) : (
          <Button size="sm" variant="secondary" icon={<MapPin className="w-3.5 h-3.5" />}
            onClick={() => { setAffectationEngin(e); setProjetChoisi(''); }}>Affecter</Button>
        )}
        <Button size="sm" variant="secondary" icon={<Wrench className="w-3.5 h-3.5" />}
          onClick={() => { setMaintenanceEngin(e); setMaintForm(emptyMaintenanceForm); }}>Entretien</Button>
        <Button size="sm" variant="ghost" icon={<History className="w-3.5 h-3.5" />}
          onClick={() => setHistoriqueEngin(e)}>Historique</Button>
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

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parc Matériel</h1>
          <p className="text-sm text-gray-500">{totalEngins} engin(s)</p>
        </div>
        <Button variant="secondary" onClick={handleExportCSV} icon={<Download className="w-4 h-4" />}>CSV</Button>
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
          <option value="">Tous les projets</option>
          {projets.map(p => <option key={p.id} value={p.id}>{p.code_projet} — {p.nom}</option>)}
        </select>
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
            <label className="label">Projet *</label>
            <select className="input" value={projetChoisi} onChange={e => setProjetChoisi(e.target.value)}>
              <option value="">Sélectionner un projet</option>
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
    </div>
  );
}
