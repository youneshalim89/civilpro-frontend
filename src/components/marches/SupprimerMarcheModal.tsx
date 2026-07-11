'use client';
// src/components/marches/SupprimerMarcheModal.tsx — Chantier Marches-Delete
// Confirmation renforcée (saisie du numéro requise) partagée entre la liste
// /marches et la fiche /marches/[id]. La suppression n'est autorisée
// backend-side que si le marché n'a strictement aucune donnée liée — sinon
// le backend renvoie la liste précise de ce qui bloque (voir marches.js).
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { marchesService } from '@/lib/api';
import { Modal, Button } from '@/components/ui';

interface Blocage { label: string; count: number }

interface Props {
  marche: { id: string; numero_marche: string } | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function SupprimerMarcheModal({ marche, onClose, onDeleted }: Props) {
  const [saisie, setSaisie] = useState('');
  const [blocages, setBlocages] = useState<Blocage[] | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setSaisie(''); setBlocages(null); setLoading(false); };
  const handleClose = () => { reset(); onClose(); };

  const confirmer = async () => {
    if (!marche) return;
    setLoading(true);
    try {
      await marchesService.delete(marche.id);
      toast.success(`Marché ${marche.numero_marche} supprimé`);
      reset();
      onDeleted();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocages?.length) {
        setBlocages(data.blocages);
      } else {
        toast.error(data?.message || 'Erreur lors de la suppression');
      }
      setLoading(false);
    }
  };

  if (!marche) return null;

  return (
    <Modal open={!!marche} onClose={handleClose} title="Supprimer le marché">
      {!blocages ? (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                ⚠️ ATTENTION — Vous allez supprimer définitivement le marché {marche.numero_marche}
              </p>
              <p className="text-xs text-red-600 mt-1">Cette action est irréversible.</p>
            </div>
          </div>
          <div>
            <label className="label">
              Tapez <span className="font-mono font-semibold">{marche.numero_marche}</span> pour confirmer
            </label>
            <input
              className="input"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="danger"
              disabled={saisie !== marche.numero_marche}
              loading={loading}
              onClick={confirmer}
            >
              Supprimer définitivement
            </Button>
            <Button variant="secondary" onClick={handleClose}>Annuler</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Suppression impossible : ce marché a des données liées.</p>
          <div className="divide-y border rounded-xl">
            {blocages.map((b) => (
              <div key={b.label} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-gray-600 capitalize">{b.label}</span>
                <span className="font-semibold text-gray-900">{b.count}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Un marché avec historique doit être passé en statut <strong>Achevé</strong> ou <strong>Résilié</strong>, pas supprimé.
          </p>
          <Button variant="secondary" onClick={handleClose}>Fermer</Button>
        </div>
      )}
    </Modal>
  );
}
