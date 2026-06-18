'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Users, Truck, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, pointageService, materielService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { PointagePersonnel, JournalMateriel } from '@/lib/api';

const FONCTIONS = ['Chef de chantier', 'Conducteur engin', 'Chauffeur', 'Manœuvre', 'Mécanicien', 'Gardien', 'Ingénieur', 'Autre'];

const ENGINS_PREDEFINIS = [
  'MAN 8x4', 'Pelle hydraulique sur pneu 318', 'JCB', 'Camion malaxeur 8x4',
  'Camion benne 7m³', 'Niveleuse', 'Compacteur 12T', 'Pick up A80', 'Dokker A48',
  'Camion-citerne', 'Chargeuse', 'Poclain 318',
];

const today = () => new Date().toISOString().split('T')[0];

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
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data: persData, isLoading: loadingPers } = useQuery({
    queryKey: ['pointage', id, date],
    queryFn:  () => pointageService.list(id, date).then(r => r.data.data),
  });
  const personnel: PointagePersonnel[] = persData || [];

  const { data: matData, isLoading: loadingMat } = useQuery({
    queryKey: ['materiel', id],
    queryFn:  () => materielService.list(id).then(r => r.data.data),
  });
  const materielJour: JournalMateriel[] = (matData || []).filter(j => j.date_jour?.slice(0, 10) === date);

  const createPersMut = useMutation({
    mutationFn: () => pointageService.create(id, { ...persForm, date_jour: date }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['pointage', id, date] });
      toast.success('Personnel pointé');
      setPersForm({ nom_personnel: '', fonction: persForm.fonction, present: true, heures_travaillees: 8, taux_horaire: 0, observation: '' });
      setShowPersForm(false);
    },
    onError: () => toast.error('Erreur'),
  });

  const deletePersMut = useMutation({
    mutationFn: (pid: string) => pointageService.delete(id, pid),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['pointage', id, date] }); toast.success('Supprimé'); },
  });

  const createMatMut = useMutation({
    mutationFn: () => materielService.create(id, { ...matForm, date_jour: date }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['materiel', id] });
      toast.success('Engin pointé');
      setMatForm({ engin: '', heures_travaillees: 0, gasoil_consomme: 0, taux_horaire: 0, statut: 'operationnel', observation: '' });
      setShowMatForm(false);
    },
    onError: () => toast.error('Erreur'),
  });

  const deleteMatMut = useMutation({
    mutationFn: (mid: string) => materielService.delete(id, mid),
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
        <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-2">
          <FileDown className="w-4 h-4" /> Exporter
        </button>
      </div>

      {/* Sélecteur de date */}
      <div className="card p-4 flex items-center gap-4">
        <label className="label mb-0 whitespace-nowrap">Date</label>
        <input type="date" className="input text-sm w-48" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500">Personnel présent</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{presents} / {personnel.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Heures personnel</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt.number(totalHeuresP)} h</p>
        </div>
        <div className="card p-4 border-l-4 border-amber-400">
          <p className="text-xs text-gray-500">Engins sur site</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{materielJour.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Heures matériel</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt.number(totalHeuresM)} h</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* ── Personnel ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500" /> Personnel — {date}
            </h3>
            <button onClick={() => setShowPersForm(!showPersForm)} className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          {showPersForm && (
            <div className="p-4 border-b bg-gray-50 space-y-3">
              <input className="input text-sm" placeholder="Nom du personnel *" value={persForm.nom_personnel}
                onChange={e => setPersForm(f => ({ ...f, nom_personnel: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <select className="input text-sm" value={persForm.fonction}
                  onChange={e => setPersForm(f => ({ ...f, fonction: e.target.value }))}>
                  {FONCTIONS.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                </select>
                <input type="number" step="0.5" className="input text-sm" placeholder="Heures" value={persForm.heures_travaillees}
                  onChange={e => setPersForm(f => ({ ...f, heures_travaillees: parseFloat(e.target.value) || 0 }))} />
              </div>
              <input type="number" step="0.5" className="input text-sm" placeholder="Taux horaire (DH/h)" value={persForm.taux_horaire}
                onChange={e => setPersForm(f => ({ ...f, taux_horaire: parseFloat(e.target.value) || 0 }))} />
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
                <button onClick={() => { if (!persForm.nom_personnel) { toast.error('Nom requis'); return; } createPersMut.mutate(); }}
                  disabled={createPersMut.isPending} className="btn-primary text-xs py-1.5">
                  {createPersMut.isPending ? 'Ajout...' : 'Enregistrer'}
                </button>
                <button onClick={() => setShowPersForm(false)} className="btn-secondary text-xs py-1.5">Annuler</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs">
                <tr>
                  <th className="table-header">Nom</th>
                  <th className="table-header">Fonction</th>
                  <th className="table-header text-right">Heures</th>
                  <th className="table-header text-right">Coût</th>
                  <th className="table-header">Présent</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingPers && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-xs animate-pulse">Chargement...</td></tr>}
                {personnel.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{p.nom_personnel}</td>
                    <td className="table-cell text-gray-500">{p.fonction || '—'}</td>
                    <td className="table-cell text-right font-mono">{p.heures_travaillees} h</td>
                    <td className="table-cell text-right font-mono text-brand-600">
                      {Number(p.taux_horaire) > 0 ? fmt.currency(p.heures_travaillees * p.taux_horaire) : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${p.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.present ? 'Présent' : 'Absent'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => { if (confirm('Supprimer ?')) deletePersMut.mutate(p.id); }}
                        className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </td>
                  </tr>
                ))}
                {!loadingPers && !personnel.length && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">Aucun pointage pour ce jour</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Matériel ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-500" /> Matériel — {date}
            </h3>
            <button onClick={() => setShowMatForm(!showMatForm)} className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          {showMatForm && (
            <div className="p-4 border-b bg-gray-50 space-y-3">
              <input className="input text-sm" list="engins-pointage" placeholder="Engin *" value={matForm.engin}
                onChange={e => setMatForm(f => ({ ...f, engin: e.target.value }))} />
              <datalist id="engins-pointage">
                {ENGINS_PREDEFINIS.map(e => <option key={e} value={e} />)}
              </datalist>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.5" className="input text-sm" placeholder="Heures travaillées" value={matForm.heures_travaillees}
                  onChange={e => setMatForm(f => ({ ...f, heures_travaillees: parseFloat(e.target.value) || 0 }))} />
                <input type="number" step="0.1" className="input text-sm" placeholder="Gasoil (L)" value={matForm.gasoil_consomme}
                  onChange={e => setMatForm(f => ({ ...f, gasoil_consomme: parseFloat(e.target.value) || 0 }))} />
              </div>
              <input type="number" step="0.5" className="input text-sm" placeholder="Taux horaire (DH/h)" value={matForm.taux_horaire}
                onChange={e => setMatForm(f => ({ ...f, taux_horaire: parseFloat(e.target.value) || 0 }))} />
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
                <button onClick={() => { if (!matForm.engin) { toast.error('Engin requis'); return; } createMatMut.mutate(); }}
                  disabled={createMatMut.isPending} className="btn-primary text-xs py-1.5">
                  {createMatMut.isPending ? 'Ajout...' : 'Enregistrer'}
                </button>
                <button onClick={() => setShowMatForm(false)} className="btn-secondary text-xs py-1.5">Annuler</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs">
                <tr>
                  <th className="table-header">Engin</th>
                  <th className="table-header text-right">Heures</th>
                  <th className="table-header text-right">Gasoil</th>
                  <th className="table-header text-right">Coût</th>
                  <th className="table-header">Statut</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingMat && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-xs animate-pulse">Chargement...</td></tr>}
                {materielJour.map(j => (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{j.engin}</td>
                    <td className="table-cell text-right font-mono">{j.heures_travaillees} h</td>
                    <td className="table-cell text-right font-mono">{j.gasoil_consomme} L</td>
                    <td className="table-cell text-right font-mono text-brand-600">
                      {Number(j.taux_horaire) > 0 ? fmt.currency(j.heures_travaillees * j.taux_horaire) : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${j.statut === 'panne' ? 'bg-red-100 text-red-700' : j.statut === 'entretien' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {j.statut}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => { if (confirm('Supprimer ?')) deleteMatMut.mutate(j.id); }}
                        className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </td>
                  </tr>
                ))}
                {!loadingMat && !materielJour.length && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">Aucun engin pointé ce jour</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
