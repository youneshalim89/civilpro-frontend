'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, CheckCircle, Clock, AlertTriangle, GanttChartSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService, articlesService, avancementPhysiqueService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import { Card, Badge, Table, Button } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';

type Tab = 'planning' | 'gantt';

// Rendements indicatifs (unités/jour) par type d'unité et mots-clés de désignation —
// estimation par défaut, modifiable plus tard si des rendements réels sont disponibles.
function getRendement(unite: string, designation: string): number {
  const u = (unite || '').toLowerCase().trim();
  const d = (designation || '').toLowerCase();
  if (u === 'm3' || u === 'm³') {
    if (d.includes('beton') || d.includes('béton')) return 40;
    if (d.includes('gabion') || d.includes('enroch')) return 60;
    if (d.includes('deblai') || d.includes('déblai') || d.includes('remblai') || d.includes('fouille')) return 300;
    return 250; // terrassement / couches de chaussée génériques
  }
  if (u === 'm2' || u === 'm²') return 800;
  if (u === 'kg') return 500;
  if (u === 'ml' || u === 'm') return 80;
  if (u === 'u' || u === 'unite' || u === 'unité') return 8;
  return 100;
}

const STATUT_PHASE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  planifie:   { label: 'Planifié',   color: 'bg-gray-100 text-gray-600',   icon: <Clock className="w-3 h-3" /> },
  en_cours:   { label: 'En cours',   color: 'bg-blue-100 text-blue-700',   icon: <Clock className="w-3 h-3" /> },
  termine:    { label: 'Terminé',    color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
  en_retard:  { label: 'En retard',  color: 'bg-red-100 text-red-700',     icon: <AlertTriangle className="w-3 h-3" /> },
  suspendu:   { label: 'Suspendu',   color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> },
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

  const { data: articlesData, isLoading: loadingArt } = useQuery({
    queryKey: ['articles', id],
    queryFn:  () => articlesService.list(id).then(r => r.data),
    enabled:  tab === 'gantt',
  });

  const { data: relevesPhysique } = useQuery({
    queryKey: ['avancement-physique', id],
    queryFn:  () => avancementPhysiqueService.list(id).then(r => r.data.data),
    enabled:  tab === 'gantt',
  });

  const { data: dernierReleve } = useQuery({
    queryKey: ['avancement-physique-detail', id, relevesPhysique?.[0]?.id],
    queryFn:  () => avancementPhysiqueService.get(id, relevesPhysique![0].id).then(r => r.data.data),
    enabled:  tab === 'gantt' && !!relevesPhysique?.[0]?.id,
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

  // ── Calcul du planning Gantt prévisionnel (rendements + avancement réel) ──
  const articles = (articlesData?.data || []).filter((a: any) => !a.is_sous_total);
  const progressParArticle = new Map<string, number>(
    (dernierReleve?.lignes || []).map((l: any) => [l.article_id, parseFloat(l.quantite_executee_cumul) || 0])
  );

  const dateDebut = marche?.date_commencement ? new Date(marche.date_commencement) : null;
  let curOffset = 0;
  const ganttTasks = articles.map((a: any) => {
    const qPrev = parseFloat(a.quantite_prevue) || 0;
    const rendement = getRendement(a.unite, a.designation);
    const dureeJours = Math.max(1, Math.ceil(qPrev / rendement));
    const startOffset = curOffset;
    curOffset += dureeJours;
    const qExec = progressParArticle.get(a.id) || 0;
    const pct = qPrev > 0 ? Math.min(100, (qExec / qPrev) * 100) : 0;
    return {
      code: a.code_article, designation: a.designation, unite: a.unite,
      quantite_prevue: qPrev, rendement, dureeJours, startOffset, pct,
    };
  });
  const totalJoursGantt = Math.max(curOffset, marche?.delai_contractuel || 0, 1);
  const dateFinPrevue = dateDebut ? new Date(dateDebut.getTime() + totalJoursGantt * 86400000) : null;
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const phaseColumns: TableColumn<any>[] = [
    { key: 'phase', header: 'Phase', render: (p) => <span className="font-medium">{p.phase}</span> },
    {
      key: 'date_prevue', header: 'Date prévue',
      render: (p) => <span className="text-sm text-gray-500">{fmt.date(p.date_debut_prevue)} → {fmt.date(p.date_fin_prevue)}</span>,
    },
    {
      key: 'date_reelle', header: 'Date réelle',
      render: (p) => <span className="text-sm">{p.date_debut_reelle ? `${fmt.date(p.date_debut_reelle)} → ${fmt.date(p.date_fin_reelle) || '...'}` : '—'}</span>,
    },
    {
      key: 'avancement', header: 'Avancement', align: 'right',
      render: (p) => (
        <div className="flex items-center gap-2 justify-end w-36">
          <div className="w-20 bg-gray-200 rounded-full h-1.5">
            <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${p.avancement}%` }} />
          </div>
          <span className="text-xs w-10 text-right">{p.avancement}%</span>
        </div>
      ),
    },
    {
      key: 'statut', header: 'Statut',
      render: (p) => {
        const sp = STATUT_PHASE[p.statut] || STATUT_PHASE.planifie;
        return <Badge tone="gray" className={`${sp.color} flex items-center gap-1 w-fit`}>{sp.icon} {sp.label}</Badge>;
      },
    },
    { key: 'responsable_nom', header: 'Responsable', render: (p) => <span className="text-sm text-gray-500">{p.responsable_nom || '—'}</span> },
    {
      key: 'actions', header: 'Actions',
      render: (p) => <AvancementInput phase={p} onUpdate={(data) => updatePhaseMut.mutate({ phaseId: p.id, data })} />,
    },
  ];

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
          { key: 'gantt',     label: 'Gantt Prévisionnel', icon: GanttChartSquare },
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
        {tab !== 'gantt' && (
          <div className="ml-auto pb-2">
            <Button onClick={() => setShowForm(!showForm)} icon={<Plus className="w-4 h-4" />}>Ajouter phase</Button>
          </div>
        )}
      </div>

      {/* ── PLANNING ── */}
      {tab === 'planning' && (
        <div className="space-y-4">
          {phases.length > 0 && (
            <Card className="space-y-4">
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
            </Card>
          )}

          {showForm && <PhaseForm marcheId={id} onSaved={() => { qc.invalidateQueries({ queryKey: ['planning', id] }); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

          <Card padded={false}>
            <Table<any>
              columns={phaseColumns}
              data={phases}
              rowKey={(p) => p.id}
              loading={loadingP}
              emptyMessage="Aucune phase définie"
            />
          </Card>
        </div>
      )}

      {/* ── GANTT PRÉVISIONNEL ── */}
      {tab === 'gantt' && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-500">Début : <strong className="text-gray-800">{fmt.date(marche?.date_commencement)}</strong></span>
            <span className="text-gray-500">Fin prévisionnelle (rendements) : <strong className="text-gray-800">{dateFinPrevue ? fmt.date(dateFinPrevue.toISOString()) : '—'}</strong></span>
            <span className="text-gray-500">Délai contractuel : <strong className="text-gray-800">{marche?.delai_contractuel} j</strong></span>
            <Badge tone="gray" className={`ml-auto ${totalJoursGantt > (marche?.delai_contractuel || Infinity) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {totalJoursGantt > (marche?.delai_contractuel || Infinity) ? `Dépassement de ${totalJoursGantt - (marche?.delai_contractuel || 0)} j` : 'Dans les délais'}
            </Badge>
          </Card>

          <Card className="bg-blue-50 border-blue-200 border text-xs text-blue-700">
            Planning indicatif généré automatiquement à partir de rendements estimés par type de prestation
            (terrassement ≈ 250-300 m³/j, béton ≈ 40 m³/j, revêtement ≈ 800 m²/j, aciers ≈ 500 kg/j...) et ordonnancé séquentiellement.
            La portion foncée de chaque barre reflète l'avancement réel saisi dans le module <Link href={`/marches/${id}/avancement-physique`} className="underline font-medium">Avancement Physique</Link>.
          </Card>

          {(loadingArt) ? (
            <Card className="p-8 text-center text-gray-400 text-sm">Chargement des prestations...</Card>
          ) : (
            <Card padded={false}>
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  {/* En-tête timeline */}
                  <div className="flex border-b bg-gray-50">
                    <div className="w-64 flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Prestation</div>
                    <div className="w-20 flex-shrink-0 px-2 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Durée</div>
                    <div className="flex-1 px-3 py-2 text-xs font-semibold text-gray-500 uppercase flex justify-between">
                      <span>{fmt.date(marche?.date_commencement)}</span>
                      <span>{dateFinPrevue ? fmt.date(dateFinPrevue.toISOString()) : ''}</span>
                    </div>
                  </div>
                  {/* Lignes Gantt */}
                  <div className="divide-y">
                    {ganttTasks.map((t, i) => (
                      <div key={i} className="flex items-center hover:bg-gray-50">
                        <div className="w-64 flex-shrink-0 px-3 py-2.5">
                          <p className="text-xs font-mono text-brand-600">{t.code}</p>
                          <p className="text-sm text-gray-700 truncate">{t.designation}</p>
                        </div>
                        <div className="w-20 flex-shrink-0 px-2 py-2.5 text-right text-xs text-gray-500">{t.dureeJours} j</div>
                        <div className="flex-1 px-3 py-2.5 relative h-9">
                          <div
                            className="absolute top-2 bottom-2 bg-brand-200 rounded overflow-hidden"
                            style={{
                              left: `${(t.startOffset / totalJoursGantt) * 100}%`,
                              width: `${Math.max((t.dureeJours / totalJoursGantt) * 100, 1)}%`,
                            }}
                          >
                            <div className="h-full bg-brand-500" style={{ width: `${t.pct}%` }} />
                          </div>
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{t.pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                    {!ganttTasks.length && (
                      <div className="px-4 py-10 text-center text-gray-400 text-sm">Aucune prestation dans le bordereau</div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
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
    <Card className="p-4 border-brand-200 border-2">
      <h4 className="font-semibold text-sm text-gray-800 mb-3">Nouvelle phase</h4>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="col-span-2"><label className="label">Nom de la phase *</label><input className="input text-sm" value={f.phase} onChange={e => setF(p => ({ ...p, phase: e.target.value }))} /></div>
        <div><label className="label">Début prévu</label><input type="date" className="input text-sm" value={f.date_debut_prevue} onChange={e => setF(p => ({ ...p, date_debut_prevue: e.target.value }))} /></div>
        <div><label className="label">Fin prévue</label><input type="date" className="input text-sm" value={f.date_fin_prevue} onChange={e => setF(p => ({ ...p, date_fin_prevue: e.target.value }))} /></div>
        <div className="col-span-2 xl:col-span-4"><label className="label">Description</label><input className="input text-sm" value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button onClick={save} loading={saving} size="sm">{saving ? 'Ajout...' : 'Ajouter'}</Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>Annuler</Button>
      </div>
    </Card>
  );
}

