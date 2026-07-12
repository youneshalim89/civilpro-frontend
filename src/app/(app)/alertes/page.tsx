'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Info, Check, ShieldCheck, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '';
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers },
  }).then(r => r.json());

type Alerte = {
  id: string;
  type: string;
  niveau: 'info' | 'warning' | 'critique';
  source_module: string | null;
  titre: string;
  message: string | null;
  statut: 'active' | 'resolue' | 'ignoree';
  lue: boolean;
  created_at: string;
};

// Chantier Fusion-4 : libellé d'affichage du module source (données réelles
// de `alertes.source_module`, jamais renommées en base) — "projets" reste la
// valeur stockée, seul l'affichage devient "Marchés".
const SOURCE_MODULE_LABEL: Record<string, string> = {
  projets: 'Marchés',
};

const NIVEAU_COLOR: Record<string, string> = {
  info:     'bg-blue-100 text-blue-700',
  warning:  'bg-yellow-100 text-yellow-700',
  critique: 'bg-red-100 text-red-700',
};

const NIVEAU_ICON: Record<string, React.ReactNode> = {
  info:     <Info className="w-5 h-5 text-blue-500" />,
  warning:  <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  critique: <AlertTriangle className="w-5 h-5 text-red-500" />,
};

const NIVEAU_BORDER: Record<string, string> = {
  info:     'border-l-blue-400 bg-blue-50/30',
  warning:  'border-l-yellow-400 bg-yellow-50/30',
  critique: 'border-l-red-400 bg-red-50/30',
};

const STATUT_COLOR: Record<string, string> = {
  active:  'bg-orange-100 text-orange-700',
  resolue: 'bg-green-100 text-green-700',
  ignoree: 'bg-gray-100 text-gray-700',
};

const CAN_RESOLVE_ROLES = ['admin', 'directeur', 'chef_projet'];

export default function AlertesPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canResolve = CAN_RESOLVE_ROLES.includes(user?.role || '');

  const [filtreStatut, setFiltreStatut] = useState<'active' | 'resolue'>('active');
  const [filtreNiveau, setFiltreNiveau] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['alertes', { filtreStatut, filtreNiveau }],
    queryFn: () => {
      const params = new URLSearchParams({ statut: filtreStatut });
      if (filtreNiveau) params.set('niveau', filtreNiveau);
      return apiFetch(`/alertes?${params.toString()}`).then(r => r.data || []);
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['alertes-summary'],
    queryFn: () => apiFetch('/alertes/summary').then(r => r.data),
    refetchInterval: 30000,
  });

  const lireMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/alertes/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertes'] });
      qc.invalidateQueries({ queryKey: ['alertes-summary'] });
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/alertes/${id}/resolve`, { method: 'PATCH' }),
    onSuccess: (r) => {
      if (r?.success === false) { toast.error(r.message || 'Action non autorisée'); return; }
      qc.invalidateQueries({ queryKey: ['alertes'] });
      qc.invalidateQueries({ queryKey: ['alertes-summary'] });
      toast.success('Alerte résolue');
    },
  });

  const alertes: Alerte[] = data || [];
  const totalActives = summary?.total_actives ? parseInt(summary.total_actives, 10) : 0;
  const totalCritiques = alertes.filter((a) => a.niveau === 'critique').length;
  const totalWarning = alertes.filter((a) => a.niveau === 'warning').length;
  const unreadCount = alertes.filter((a) => !a.lue).length;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-brand-500" /> Centre d&apos;alertes
            {totalActives > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold rounded-full px-2.5 py-0.5">
                {totalActives}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{alertes.length} alerte(s) affichée(s)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700">Critiques</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{totalCritiques}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700">Non lues</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{unreadCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700">Avertissements</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{totalWarning}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {(['active', 'resolue'] as const).map(f => (
            <button key={f} onClick={() => setFiltreStatut(f)}
              className={`px-3 py-1.5 transition-colors ${filtreStatut === f ? 'bg-brand-500 text-white' : 'hover:bg-gray-50 text-gray-600'}`}>
              {f === 'active' ? 'Actives' : 'Résolues'}
            </button>
          ))}
        </div>
        <select className="input text-sm w-48" value={filtreNiveau} onChange={e => setFiltreNiveau(e.target.value)}>
          <option value="">Tous les niveaux</option>
          <option value="info">Info</option>
          <option value="warning">Avertissement</option>
          <option value="critique">Critique</option>
        </select>
      </div>

      {/* Chargement */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vide */}
      {!isLoading && alertes.length === 0 && (
        <div className="card p-16 text-center">
          <ShieldCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Aucune alerte</p>
          <p className="text-xs text-gray-300 mt-1">
            {filtreStatut === 'active' ? 'Aucune alerte active pour le moment.' : 'Aucune alerte résolue pour le moment.'}
          </p>
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        {alertes.map(a => (
          <div key={a.id}
            className={`card p-4 border-l-4 transition-all ${NIVEAU_BORDER[a.niveau] || 'border-l-gray-200'} ${!a.lue ? 'shadow-sm' : 'opacity-80'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {NIVEAU_ICON[a.niveau] || <Bell className="w-5 h-5 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm ${!a.lue ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                        {a.titre}
                      </p>
                      <span className={`badge ${NIVEAU_COLOR[a.niveau] || 'bg-gray-100 text-gray-700'}`}>{a.niveau}</span>
                      {a.source_module && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{SOURCE_MODULE_LABEL[a.source_module] || a.source_module}</span>
                      )}
                    </div>
                    {a.message && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{a.message}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">{fmt.dateRelative(a.created_at)}</span>
                      <span className={`badge ${STATUT_COLOR[a.statut] || 'bg-gray-100 text-gray-700'}`}>{a.statut}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!a.lue && (
                      <button onClick={() => lireMut.mutate(a.id)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg" title="Marquer comme lue">
                        <Check className="w-4 h-4 text-blue-500" />
                      </button>
                    )}
                    {canResolve && a.statut === 'active' && (
                      <button onClick={() => resolveMut.mutate(a.id)}
                        disabled={resolveMut.isPending}
                        className="btn-primary text-xs py-1 px-3">
                        Résoudre
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
