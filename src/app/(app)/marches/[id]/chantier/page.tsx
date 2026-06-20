'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, CheckCircle, Clock, AlertTriangle, Beaker } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService } from '@/lib/api';
import { fmt } from '@/lib/utils';

type Tab = 'planning' | 'controles' | 'essais';

const STATUT_PHASE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  planifie:   { label: 'Planifié',   color: 'bg-gray-100 text-gray-600',   icon: <Clock className="w-3 h-3" /> },
  en_cours:   { label: 'En cours',   color: 'bg-blue-100 text-blue-700',   icon: <Clock className="w-3 h-3" /> },
  termine:    { label: 'Terminé',    color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
  en_retard:  { label: 'En retard',  color: 'bg-red-100 text-red-700',     icon: <AlertTriangle className="w-3 h-3" /> },
  suspendu:   { label: 'Suspendu',   color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> },
};

const RESULTAT_CONTROLE: Record<string, string> = {
  conforme:     'bg-green-100 text-green-700',
  non_conforme: 'bg-red-100 text-red-700',
  en_attente:   'bg-gray-100 text-gray-600',
  avec_reserve: 'bg-yellow-100 text-yellow-700',
};

export default function ChantierPage() {
  const { id }  = useParams<{ id: string }>();
  const qc      = useQueryClient();
  const [tab, setTab] = useState<Tab>('planning');
  const [showForm, setShowForm] = useState(false);

  const { data: marche } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data: planning, isLoading: loadingP } = useQuery({
    queryKey: ['planning', id],
    queryFn:  () => marchesService.planning(id).then(r => r.data.data),
    enabled:  tab === 'planning',
  });

  const { data: controles, isLoading: loadingC } = useQuery({
    queryKey: ['controles', id],
    queryFn:  () => marchesService.controles(id).then(r => r.data.data),
    enabled:  tab === 'controles',
  });

  const { data: essais, isLoading: loadingE } = useQuery({
    queryKey: ['essais', id],
    queryFn:  () => marchesService.essais(id).then(r => r.data.data),
    enabled:  tab === 'essais',
  });

  const updatePhaseMut = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: any }) =>
      marchesService.updatePhase(id, phaseId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['planning', id] }); toast.success('Phase mise à jour'); },
  });

  const phases = planning || [];
  const avancementMoyen = phases.length > 0
    ? phases.reduce((s: number, p: any) => s + parseFloat(p.avancement), 0) / phases.length
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suivi de Chantier</h1>
          <p className="text-sm text-gray-500">{marche?.numero_marche} — {marche?.objet}</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b">
        {([
          { key: 'planning',  label: 'Planning & Phases', icon: Clock },
          { key: 'controles', label: 'Contrôles Qualité', icon: CheckCircle },
          { key: 'essais',    label: 'Essais Laboratoire', icon: Beaker },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
        <div className="ml-auto pb-2">
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {tab === 'planning' ? 'Ajouter phase' : tab === 'controles' ? 'Ajouter contrôle' : 'Ajouter essai'}
          </button>
        </div>
      </div>

      {/* ── PLANNING ── */}
      {tab === 'planning' && (
        <div className="space-y-4">
          {phases.length > 0 && (
            <div className="card p-4 space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Avancement physique du marché (réf. — basé sur les prestations)</span>
                  <span className="text-sm font-bold text-blue-600">{fmt.pct(marche?.avancement_physique || 0)}</span>
                </div>
                <div className="bg-gray-200 rounded-full h-3">
                  <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${marche?.avancement_physique || 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Avancement moyen du planning (phases)</span>
                  <span className="text-sm font-bold">{avancementMoyen.toFixed(1)}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-3">
                  <div className="bg-brand-500 h-3 rounded-full transition-all" style={{ width: `${avancementMoyen}%` }} />
                </div>
              </div>
              {Math.abs(avancementMoyen - (marche?.avancement_physique || 0)) > 5 && (
                <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Écart de {Math.abs(avancementMoyen - (marche?.avancement_physique || 0)).toFixed(1)} points entre le planning et l'avancement physique réel.
                  <Link href={`/marches/${id}/avancement-physique`} className="underline font-medium ml-auto whitespace-nowrap">Mettre à jour →</Link>
                </div>
              )}
            </div>
          )}

          {showForm && <PhaseForm marcheId={id} onSaved={() => { qc.invalidateQueries({ queryKey: ['planning', id] }); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="table-header">Phase</th>
                    <th className="table-header">Date prévue</th>
                    <th className="table-header">Date réelle</th>
                    <th className="table-header text-right">Avancement</th>
                    <th className="table-header">Statut</th>
                    <th className="table-header">Responsable</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingP && Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))}
                  {phases.map((p: any) => {
                    const sp = STATUT_PHASE[p.statut] || STATUT_PHASE.planifie;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">{p.phase}</td>
                        <td className="table-cell text-sm text-gray-500">
                          {fmt.date(p.date_debut_prevue)} → {fmt.date(p.date_fin_prevue)}
                        </td>
                        <td className="table-cell text-sm">
                          {p.date_debut_reelle ? `${fmt.date(p.date_debut_reelle)} → ${fmt.date(p.date_fin_reelle) || '...'}` : '—'}
                        </td>
                        <td className="table-cell text-right w-36">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-20 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${p.avancement}%` }} />
                            </div>
                            <span className="text-xs w-10 text-right">{p.avancement}%</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${sp.color} flex items-center gap-1 w-fit`}>
                            {sp.icon} {sp.label}
                          </span>
                        </td>
                        <td className="table-cell text-sm text-gray-500">{p.responsable_nom || '—'}</td>
                        <td className="table-cell">
                          <AvancementInput phase={p} onUpdate={(data) => updatePhaseMut.mutate({ phaseId: p.id, data })} />
                        </td>
                      </tr>
                    );
                  })}
                  {!loadingP && !phases.length && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">Aucune phase définie</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTRÔLES QUALITÉ ── */}
      {tab === 'controles' && (
        <div className="space-y-4">
          {showForm && (
            <ControleForm marcheId={id}
              onSaved={() => { qc.invalidateQueries({ queryKey: ['controles', id] }); setShowForm(false); }}
              onCancel={() => setShowForm(false)} />
          )}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="table-header">Type</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Contrôleur</th>
                    <th className="table-header">Résultat</th>
                    <th className="table-header">Observations</th>
                    <th className="table-header">Actions requises</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingC && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
                  {(controles || []).map((c: any) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{c.type_controle || '—'}</td>
                      <td className="table-cell">{fmt.date(c.date_controle)}</td>
                      <td className="table-cell text-sm text-gray-500">{c.controleur_nom || '—'}</td>
                      <td className="table-cell">
                        {c.resultat ? (
                          <span className={`badge ${RESULTAT_CONTROLE[c.resultat]}`}>
                            {c.resultat.replace('_', ' ')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="table-cell text-sm text-gray-600 max-w-xs">
                        <p className="truncate">{c.observations || '—'}</p>
                      </td>
                      <td className="table-cell text-sm text-orange-600 max-w-xs">
                        <p className="truncate">{c.actions_requises || '—'}</p>
                      </td>
                    </tr>
                  ))}
                  {!loadingC && !(controles || []).length && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">Aucun contrôle</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ESSAIS ── */}
      {tab === 'essais' && (
        <div className="space-y-4">
          {showForm && (
            <EssaiForm marcheId={id}
              onSaved={() => { qc.invalidateQueries({ queryKey: ['essais', id] }); setShowForm(false); }}
              onCancel={() => setShowForm(false)} />
          )}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="table-header">Type d'essai</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Laboratoire</th>
                    <th className="table-header">Norme</th>
                    <th className="table-header text-right">Résultat</th>
                    <th className="table-header">Conformité</th>
                    <th className="table-header">Observations</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingE && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm animate-pulse">Chargement...</td></tr>}
                  {(essais || []).map((e: any) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{e.type_essai}</td>
                      <td className="table-cell">{fmt.date(e.date_essai)}</td>
                      <td className="table-cell text-sm text-gray-500">{e.laboratoire || '—'}</td>
                      <td className="table-cell text-xs text-gray-400">{e.norme || '—'}</td>
                      <td className="table-cell text-right">
                        {e.resultat_chiffre != null ? (
                          <span className="font-mono font-medium">
                            {e.resultat_chiffre} {e.unite_resultat}
                          </span>
                        ) : e.resultat_brut || '—'}
                      </td>
                      <td className="table-cell">
                        {e.conformite == null ? '—' : (
                          <span className={`badge ${e.conformite ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {e.conformite ? 'Conforme' : 'Non conforme'}
                          </span>
                        )}
                      </td>
                      <td className="table-cell text-sm text-gray-500 max-w-xs">
                        <p className="truncate">{e.observations || '—'}</p>
                      </td>
                    </tr>
                  ))}
                  {!loadingE && !(essais || []).length && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">Aucun essai</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────

function AvancementInput({ phase, onUpdate }: { phase: any; onUpdate: (d: any) => void }) {
  const [v, setV] = useState(phase.avancement);
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={0} max={100} step={5} value={v}
        onChange={e => setV(parseInt(e.target.value))}
        className="w-20 accent-brand-500" />
      <span className="text-xs w-8">{v}%</span>
      <button onClick={() => onUpdate({ avancement: v, statut: v >= 100 ? 'termine' : 'en_cours' })}
        className="text-xs text-brand-600 hover:underline">OK</button>
    </div>
  );
}

function PhaseForm({ marcheId, onSaved, onCancel }: { marcheId: string; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ phase: '', description: '', date_debut_prevue: '', date_fin_prevue: '', ordre: 0 });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.phase) { toast.error('Nom de phase requis'); return; }
    setSaving(true);
    try { await marchesService.addPhase(marcheId, f); toast.success('Phase ajoutée'); onSaved(); }
    catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };
  return (
    <div className="card p-4 border-brand-200 border-2">
      <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouvelle phase</h4>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="col-span-2"><label className="label">Nom de la phase *</label><input className="input text-sm" value={f.phase} onChange={e => setF(p => ({ ...p, phase: e.target.value }))} /></div>
        <div><label className="label">Début prévu</label><input type="date" className="input text-sm" value={f.date_debut_prevue} onChange={e => setF(p => ({ ...p, date_debut_prevue: e.target.value }))} /></div>
        <div><label className="label">Fin prévue</label><input type="date" className="input text-sm" value={f.date_fin_prevue} onChange={e => setF(p => ({ ...p, date_fin_prevue: e.target.value }))} /></div>
        <div className="col-span-2 xl:col-span-4"><label className="label">Description</label><input className="input text-sm" value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? 'Ajout...' : 'Ajouter'}</button>
        <button onClick={onCancel} className="btn-secondary text-sm">Annuler</button>
      </div>
    </div>
  );
}

function ControleForm({ marcheId, onSaved, onCancel }: { marcheId: string; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ type_controle: '', date_controle: new Date().toISOString().split('T')[0], resultat: '', observations: '', actions_requises: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await marchesService.addControle(marcheId, f); toast.success('Contrôle ajouté'); onSaved(); }
    catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };
  return (
    <div className="card p-4 border-brand-200 border-2">
      <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouveau contrôle qualité</h4>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div><label className="label">Type</label><input className="input text-sm" value={f.type_controle} onChange={e => setF(p => ({ ...p, type_controle: e.target.value }))} /></div>
        <div><label className="label">Date *</label><input type="date" className="input text-sm" value={f.date_controle} onChange={e => setF(p => ({ ...p, date_controle: e.target.value }))} /></div>
        <div><label className="label">Résultat</label>
          <select className="input text-sm" value={f.resultat} onChange={e => setF(p => ({ ...p, resultat: e.target.value }))}>
            <option value="">—</option>
            <option value="conforme">Conforme</option>
            <option value="non_conforme">Non conforme</option>
            <option value="avec_reserve">Avec réserve</option>
            <option value="en_attente">En attente</option>
          </select>
        </div>
        <div className="col-span-2"><label className="label">Observations</label><input className="input text-sm" value={f.observations} onChange={e => setF(p => ({ ...p, observations: e.target.value }))} /></div>
        <div className="col-span-2"><label className="label">Actions requises</label><input className="input text-sm" value={f.actions_requises} onChange={e => setF(p => ({ ...p, actions_requises: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? 'Ajout...' : 'Ajouter'}</button>
        <button onClick={onCancel} className="btn-secondary text-sm">Annuler</button>
      </div>
    </div>
  );
}

function EssaiForm({ marcheId, onSaved, onCancel }: { marcheId: string; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ type_essai: '', date_essai: new Date().toISOString().split('T')[0], laboratoire: '', norme: '', resultat_chiffre: '', unite_resultat: '', conformite: '', observations: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.type_essai) { toast.error('Type d\'essai requis'); return; }
    setSaving(true);
    try {
      await marchesService.addEssai(marcheId, {
        ...f,
        resultat_chiffre: f.resultat_chiffre ? parseFloat(f.resultat_chiffre) : undefined,
        conformite: f.conformite === '' ? undefined : f.conformite === 'true',
      });
      toast.success('Essai ajouté'); onSaved();
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };
  return (
    <div className="card p-4 border-brand-200 border-2">
      <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouvel essai laboratoire</h4>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div><label className="label">Type d'essai *</label><input className="input text-sm" value={f.type_essai} onChange={e => setF(p => ({ ...p, type_essai: e.target.value }))} placeholder="Ex: Essai Proctor, Marshall..." /></div>
        <div><label className="label">Date *</label><input type="date" className="input text-sm" value={f.date_essai} onChange={e => setF(p => ({ ...p, date_essai: e.target.value }))} /></div>
        <div><label className="label">Laboratoire</label><input className="input text-sm" value={f.laboratoire} onChange={e => setF(p => ({ ...p, laboratoire: e.target.value }))} /></div>
        <div><label className="label">Norme</label><input className="input text-sm" value={f.norme} onChange={e => setF(p => ({ ...p, norme: e.target.value }))} placeholder="NM, EN, ISO..." /></div>
        <div><label className="label">Résultat (valeur)</label><input type="number" step="0.001" className="input text-sm" value={f.resultat_chiffre} onChange={e => setF(p => ({ ...p, resultat_chiffre: e.target.value }))} /></div>
        <div><label className="label">Unité résultat</label><input className="input text-sm" value={f.unite_resultat} onChange={e => setF(p => ({ ...p, unite_resultat: e.target.value }))} placeholder="MPa, %, kg/m³..." /></div>
        <div><label className="label">Conformité</label>
          <select className="input text-sm" value={f.conformite} onChange={e => setF(p => ({ ...p, conformite: e.target.value }))}>
            <option value="">Non renseignée</option>
            <option value="true">Conforme</option>
            <option value="false">Non conforme</option>
          </select>
        </div>
        <div><label className="label">Observations</label><input className="input text-sm" value={f.observations} onChange={e => setF(p => ({ ...p, observations: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? 'Ajout...' : 'Ajouter'}</button>
        <button onClick={onCancel} className="btn-secondary text-sm">Annuler</button>
      </div>
    </div>
  );
}
