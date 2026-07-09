'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Check, CheckCheck, AlertTriangle, Info, XCircle, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmt } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('gl_token') || '' : '';
const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}/api${url}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts?.headers },
  }).then(r => r.json());

type Notif = {
  id: string; titre?: string; message: string; type: string;
  lue: boolean; created_at: string; projet_id?: string; code_projet?: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  alerte:      <AlertTriangle className="w-5 h-5 text-red-500" />,
  info:        <Info className="w-5 h-5 text-blue-500" />,
  succes:      <Check className="w-5 h-5 text-green-500" />,
  avertissement: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  financier:   <TrendingUp className="w-5 h-5 text-brand-500" />,
};

const TYPE_BG: Record<string, string> = {
  alerte:        'border-l-red-400 bg-red-50/30',
  info:          'border-l-blue-400 bg-blue-50/30',
  succes:        'border-l-green-400 bg-green-50/30',
  avertissement: 'border-l-yellow-400 bg-yellow-50/30',
  financier:     'border-l-brand-400 bg-brand-50/20',
};

export default function NotificationsPage() {
  const qc              = useQueryClient();
  const [filtreLu,   setFiltreLu]   = useState<'all' | 'unread' | 'read'>('all');
  const [filtreType, setFiltreType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { filtreLu, filtreType }],
    queryFn:  () => apiFetch('/notifications').then(r => {
      let rows: Notif[] = r.data || [];
      if (filtreLu === 'unread') rows = rows.filter(n => !n.lue);
      if (filtreLu === 'read')   rows = rows.filter(n => n.lue);
      if (filtreType)            rows = rows.filter(n => n.type === filtreType);
      return rows;
    }),
    refetchInterval: 30000,
  });

  const lireMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/lire`, { method: 'PATCH' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const lireToutesMut = useMutation({
    mutationFn: () => apiFetch('/notifications/tout-lire', { method: 'PATCH' }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success('Toutes les notifications marquées comme lues'); },
  });

  const supprimerMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}`, { method: 'DELETE' }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success('Notification supprimée'); },
  });

  const notifs: Notif[] = data || [];
  const nonLues = notifs.filter(n => !n.lue).length;
  const alertesCount = notifs.filter(n => n.type === 'alerte').length;
  const financiersCount = notifs.filter(n => n.type === 'financier').length;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-6 h-6 text-brand-500" /> Notifications
            {nonLues > 0 && (
              <span className="bg-brand-500 text-white text-sm font-bold rounded-full px-2.5 py-0.5">
                {nonLues}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{notifs.length} notifications</p>
        </div>
        {nonLues > 0 && (
          <button onClick={() => lireToutesMut.mutate()}
            disabled={lireToutesMut.isPending}
            className="btn-secondary text-sm flex items-center gap-2">
            <CheckCheck className="w-4 h-4" /> Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700">Non lues</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{nonLues}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700">Alertes</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{alertesCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700">Financières</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{financiersCount}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {(['all','unread','read'] as const).map(f => (
            <button key={f} onClick={() => setFiltreLu(f)}
              className={`px-3 py-1.5 transition-colors ${filtreLu === f ? 'bg-brand-500 text-white' : 'hover:bg-gray-50 text-gray-600'}`}>
              {f === 'all' ? 'Toutes' : f === 'unread' ? 'Non lues' : 'Lues'}
            </button>
          ))}
        </div>
        <select className="input text-sm w-48" value={filtreType} onChange={e => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          {['alerte','info','succes','avertissement','financier'].map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Liste */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
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

      {!isLoading && notifs.length === 0 && (
        <div className="card p-16 text-center">
          <BellOff className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Aucune notification</p>
          <p className="text-xs text-gray-300 mt-1">
            {filtreLu === 'unread' ? 'Toutes vos notifications sont lues !' : 'Rien à afficher pour ces filtres.'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {notifs.map(n => (
          <div key={n.id}
            className={`card p-4 border-l-4 transition-all ${TYPE_BG[n.type] || 'border-l-gray-200'} ${!n.lue ? 'shadow-sm' : 'opacity-70'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {TYPE_ICON[n.type] || <Bell className="w-5 h-5 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm ${!n.lue ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                      {n.titre || n.message.slice(0, 60)}
                      {!n.lue && <span className="ml-2 w-2 h-2 bg-brand-500 rounded-full inline-block align-middle" />}
                    </p>
                    {n.titre && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">{fmt.dateRelative(n.created_at)}</span>
                      {n.code_projet && (
                        <span className="text-xs text-brand-600 font-medium bg-brand-50 px-2 py-0.5 rounded">
                          {n.code_projet}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.lue && (
                      <button onClick={() => lireMut.mutate(n.id)}
                        className="p-1.5 hover:bg-green-50 rounded-lg" title="Marquer comme lu">
                        <Check className="w-4 h-4 text-green-500" />
                      </button>
                    )}
                    <button onClick={() => { if (confirm('Supprimer cette notification ?')) supprimerMut.mutate(n.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg" title="Supprimer">
                      <XCircle className="w-4 h-4 text-red-400" />
                    </button>
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
