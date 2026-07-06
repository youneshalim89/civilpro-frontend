'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Users, Truck, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { FONCTIONS_POINTAGE as FONCTIONS } from '@/lib/constants';
import { EnginsDatalist } from '@/components/marches/EnginsDatalist';
import { Card, CardHeader, Badge, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import NumberInput from '@/components/NumberInput';
import type { PointagePersonnel, JournalMateriel } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '');
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers } }).then(r => r.json());

// Formate une date en "YYYY-MM-DD" à partir de ses composants LOCAUX (pas UTC).
// `date_jour` (colonne DATE PostgreSQL) revient sérialisé en chaîne ISO UTC
// (ex. "2026-07-05T23:00:00.000Z" pour un 6 juillet stocké tel quel) — une
// comparaison naïve par découpage de chaîne (`.slice(0, 10)`) décale donc le
// jour d'un pointage "aujourd'hui" selon le fuseau horaire. En reconstruisant
// la date locale des deux côtés de la comparaison, le décalage disparaît,
// sans toucher au backend ni au schéma.
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const today = () => toLocalDateStr(new Date());

export default function PointagePage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [date, setDate] = useState(today());
  const [showPersForm, setShowPersForm] = useState(false);
  const [showMatForm, setShowMatForm] = useState(false);

  const [persForm, setPersForm] = useState({ nom_personnel: '', fonction: 'Manœuvre', present: true, heures_travaillees: 8, taux_horaire: 0, observation: '' });
  const [matForm, setMatForm]   = useState({ engin: '', heures_travaillees: 0, gasoil_consomme: 0, taux_horaire: 0, statut: 'operationnel', observation: '' });

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => apiFetch(`/marches/${id}`).then(r => r.data),
  });

  const { data: persData, isLoading: loadingPers } = useQuery({
    queryKey: ['pointage', id, date],
    queryFn:  () => apiFetch(`/marches/${id}/pointage?date=${date}`).then(r => r.data),
  });
  const personnel: PointagePersonnel[] = persData || [];

  const { data: matData, isLoading: loadingMat } = useQuery({
    queryKey: ['materiel', id],
    queryFn:  () => apiFetch(`/marches/${id}/materiel`).then(r => r.data),
  });
  const materielJour: JournalMateriel[] = (matData || []).filter((j: JournalMateriel) => j.date_jour && toLocalDateStr(new Date(j.date_jour)) === date);

  const createPersMut = useMutation({
    mutationFn: () => apiFetch(`/marches/${id}/pointage`, { method: 'POST', body: JSON.stringify({ ...persForm, date_jour: date }) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['pointage', id, date] });
      toast.success('Personnel pointé');
      setPersForm({ nom_personnel: '', fonction: persForm.fonction, present: true, heures_travaillees: 8, taux_horaire: 0, observation: '' });
      setShowPersForm(false);
    },
    onError: () => toast.error('Erreur'),
  });

  const deletePersMut = useMutation({
    mutationFn: (pid: string) => apiFetch(`/marches/${id}/pointage/${pid}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['pointage', id, date] }); toast.success('Supprimé'); },
  });

  const createMatMut = useMutation({
    mutationFn: () => apiFetch(`/marches/${id}/materiel`, { method: 'POST', body: JSON.stringify({ ...matForm, date_jour: date }) })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['materiel', id] });
      toast.success('Engin pointé');
      setMatForm({ engin: '', heures_travaillees: 0, gasoil_consomme: 0, taux_horaire: 0, statut: 'operationnel', observation: '' });
      setShowMatForm(false);
    },
    onError: () => toast.error('Erreur'),
  });

  const deleteMatMut = useMutation({
    mutationFn: (mid: string) => apiFetch(`/marches/${id}/materiel/${mid}`, { method: 'DELETE' })
      .then(r => { if (!r.success) throw new Error(r.message || 'Erreur'); return r; }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['materiel', id] }); toast.success('Supprimé'); },
  });

  const presents     = personnel.filter(p => p.present).length;
  const totalHeuresP  = personnel.reduce((s, p) => s + (Number(p.heures_travaillees) || 0), 0);
  const totalHeuresM  = materielJour.reduce((s, j) => s + (Number(j.heures_travaillees) || 0), 0);

  const exportCSV = () => {
    const header = ['Type','Nom/Engin','Détail','Heures','Observation'];
    const rows = [
      ...personnel.map(p => ['Personnel', p.nom_personnel, p.fonction || '', p.heures_travaillees, p.observation || '']),
      ...materielJour.map(j => ['Matériel', j.engin, j.statut, j.heures_travaillees, j.observation || '']),
    ];
    const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Pointage_${marche?.numero_marche}_${date}.csv`; a.click();
  };

  const personnelColumns: TableColumn<PointagePersonnel>[] = [
    { key: 'nom_personnel', header: 'Nom', render: (p) => <span className="font-medium">{p.nom_personnel}</span> },
    { key: 'fonction', header: 'Fonction', render: (p) => <span className="text-gray-500">{p.fonction || '—'}</span> },
    { key: 'heures_travaillees', header: 'Heures', align: 'right', render: (p) => <span className="font-mono">{p.heures_travaillees} h</span> },
    {
      key: 'cout', header: 'Coût', align: 'right',
      render: (p) => <span className="font-mono text-brand-600">{Number(p.taux_horaire) > 0 ? fmt.currency(p.heures_travaillees * p.taux_horaire) : '—'}</span>,
    },
    {
      key: 'present', header: 'Présent',
      render: (p) => <Badge tone="gray" className={p.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{p.present ? 'Présent' : 'Absent'}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: (p) => (
        <button onClick={() => { if (confirm('Supprimer ?')) deletePersMut.mutate(p.id); }}
          className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
      ),
    },
  ];

  const materielColumns: TableColumn<JournalMateriel>[] = [
    { key: 'engin', header: 'Engin', render: (j) => <span className="font-medium">{j.engin}</span> },
    { key: 'heures_travaillees', header: 'Heures', align: 'right', render: (j) => <span className="font-mono">{j.heures_travaillees} h</span> },
    { key: 'gasoil_consomme', header: 'Gasoil', align: 'right', render: (j) => <span className="font-mono">{j.gasoil_consomme} L</span> },
    {
      key: 'cout', header: 'Coût', align: 'right',
      render: (j) => <span className="font-mono text-brand-600">{Number(j.taux_horaire) > 0 ? fmt.currency(j.heures_travaillees * j.taux_horaire) : '—'}</span>,
    },
    {
      key: 'statut', header: 'Statut',
      render: (j) => (
        <Badge tone="gray" className={j.statut === 'panne' ? 'bg-red-100 text-red-700' : j.statut === 'entretien' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
          {j.statut}
        </Badge>
      ),
    },
    {
      key: 'actions', header: '',
      render: (j) => (
        <button onClick={() => { if (confirm('Supprimer ?')) deleteMatMut.mutate(j.id); }}
          className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
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
            <h1 className="text-2xl font-bold text-gray-900">Feuille de Pointage</h1>
            <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={exportCSV} icon={<FileDown className="w-4 h-4" />}>Exporter</Button>
      </div>

      {/* Sélecteur de date */}
      <Card className="p-4 flex items-center gap-4">
        <label className="label mb-0 whitespace-nowrap">Date</label>
        <input type="date" className="input text-sm w-48" value={date} onChange={e => setDate(e.target.value)} />
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500">Personnel présent</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{presents} / {personnel.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Heures personnel</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt.number(totalHeuresP)} h</p>
        </Card>
        <Card className="p-4 border-l-4 border-amber-400">
          <p className="text-xs text-gray-500">Engins sur site</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{materielJour.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Heures matériel</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt.number(totalHeuresM)} h</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* ── Personnel ── */}
        <Card padded={false}>
          <CardHeader
            title={<span className="flex items-center gap-2"><Users className="w-4 h-4 text-brand-500" /> Personnel — {date}</span>}
            action={<Button size="sm" onClick={() => setShowPersForm(!showPersForm)} icon={<Plus className="w-3.5 h-3.5" />}>Ajouter</Button>}
          />

          {showPersForm && (
            <div className="p-4 border-b bg-gray-50 space-y-3">
              <input className="input text-sm" placeholder="Nom du personnel *" value={persForm.nom_personnel}
                onChange={e => setPersForm(f => ({ ...f, nom_personnel: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <select className="input text-sm" value={persForm.fonction}
                  onChange={e => setPersForm(f => ({ ...f, fonction: e.target.value }))}>
                  {FONCTIONS.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                </select>
                <NumberInput className="input text-sm" placeholder="Heures" value={persForm.heures_travaillees}
                  onChange={v => setPersForm(f => ({ ...f, heures_travaillees: v }))} />
              </div>
              <NumberInput className="input text-sm" placeholder="Taux horaire (DH/h)" value={persForm.taux_horaire}
                onChange={v => setPersForm(f => ({ ...f, taux_horaire: v }))} />
              {persForm.taux_horaire > 0 && (
                <p className="text-xs text-gray-500">
                  Charge générée : <strong className="text-brand-600">{fmt.currency(persForm.heures_travaillees * persForm.taux_horaire)}</strong> (ajoutée automatiquement aux charges journalières)
                </p>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={persForm.present} onChange={e => setPersForm(f => ({ ...f, present: e.target.checked }))} />
                Présent
              </label>
              <input className="input text-sm" placeholder="Observation" value={persForm.observation}
                onChange={e => setPersForm(f => ({ ...f, observation: e.target.value }))} />
              <div className="flex gap-2">
                <Button onClick={() => { if (!persForm.nom_personnel) { toast.error('Nom requis'); return; } createPersMut.mutate(); }}
                  loading={createPersMut.isPending} size="sm">
                  {createPersMut.isPending ? 'Ajout...' : 'Enregistrer'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowPersForm(false)}>Annuler</Button>
              </div>
            </div>
          )}

          <Table<PointagePersonnel>
            columns={personnelColumns}
            data={personnel}
            rowKey={(p) => p.id}
            loading={loadingPers}
            emptyMessage="Aucun pointage pour ce jour"
          />
        </Card>

        {/* ── Matériel ── */}
        <Card padded={false}>
          <CardHeader
            title={<span className="flex items-center gap-2"><Truck className="w-4 h-4 text-brand-500" /> Matériel — {date}</span>}
            action={<Button size="sm" onClick={() => setShowMatForm(!showMatForm)} icon={<Plus className="w-3.5 h-3.5" />}>Ajouter</Button>}
          />

          {showMatForm && (
            <div className="p-4 border-b bg-gray-50 space-y-3">
              <input className="input text-sm" list="engins-pointage" placeholder="Engin *" value={matForm.engin}
                onChange={e => setMatForm(f => ({ ...f, engin: e.target.value }))} />
              <EnginsDatalist id="engins-pointage" />
              <div className="grid grid-cols-2 gap-3">
                <NumberInput className="input text-sm" placeholder="Heures travaillées" value={matForm.heures_travaillees}
                  onChange={v => setMatForm(f => ({ ...f, heures_travaillees: v }))} />
                <NumberInput className="input text-sm" placeholder="Gasoil (L)" value={matForm.gasoil_consomme}
                  onChange={v => setMatForm(f => ({ ...f, gasoil_consomme: v }))} />
              </div>
              <NumberInput className="input text-sm" placeholder="Taux horaire (DH/h)" value={matForm.taux_horaire}
                onChange={v => setMatForm(f => ({ ...f, taux_horaire: v }))} />
              {matForm.taux_horaire > 0 && (
                <p className="text-xs text-gray-500">
                  Charge générée : <strong className="text-brand-600">{fmt.currency(matForm.heures_travaillees * matForm.taux_horaire)}</strong> (ajoutée automatiquement aux charges journalières)
                </p>
              )}
              <select className="input text-sm" value={matForm.statut} onChange={e => setMatForm(f => ({ ...f, statut: e.target.value }))}>
                <option value="operationnel">Opérationnel</option>
                <option value="panne">Panne</option>
                <option value="entretien">Entretien</option>
                <option value="arret">Arrêt</option>
              </select>
              <input className="input text-sm" placeholder="Observation" value={matForm.observation}
                onChange={e => setMatForm(f => ({ ...f, observation: e.target.value }))} />
              <div className="flex gap-2">
                <Button onClick={() => { if (!matForm.engin) { toast.error('Engin requis'); return; } createMatMut.mutate(); }}
                  loading={createMatMut.isPending} size="sm">
                  {createMatMut.isPending ? 'Ajout...' : 'Enregistrer'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowMatForm(false)}>Annuler</Button>
              </div>
            </div>
          )}

          <Table<JournalMateriel>
            columns={materielColumns}
            data={materielJour}
            rowKey={(j) => j.id}
            loading={loadingMat}
            emptyMessage="Aucun engin pointé ce jour"
          />
        </Card>
      </div>
    </div>
  );
}
