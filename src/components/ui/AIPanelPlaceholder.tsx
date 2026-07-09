// src/components/ui/AIPanelPlaceholder.tsx — Panneau "Assistant CivilPro AI"
//
// Placeholder uniquement (module IA — voir src/services/ai/* côté backend,
// non implémenté). Aucune logique, aucun appel réseau : sert à réserver
// la place dans l'interface en attendant le développement du module IA
// (Groupe C de la feuille de route).
import { Sparkles, Send } from 'lucide-react';

export function AIPanelPlaceholder() {
  return (
    <div className="card p-5 border-2 border-dashed border-gray-200 bg-gray-50/50">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Assistant CivilPro AI</h3>
          <p className="text-xs text-gray-400">Bientôt disponible</p>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        Un assistant intelligent pour interroger vos données, générer des rapports et anticiper les risques arrive prochainement.
      </p>
      <div className="relative">
        <input
          disabled
          placeholder="Posez une question sur vos chantiers..."
          className="input pr-10 bg-white cursor-not-allowed opacity-70"
        />
        <Send className="w-4 h-4 text-gray-300 absolute right-3 top-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}
