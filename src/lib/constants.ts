// src/lib/constants.ts — Constantes partagées du module Marchés
// Extrait de la duplication existante (Chantier B) : contenu identique à ce qui
// était précédemment recopié tel quel dans plusieurs pages. Aucune valeur modifiée.

export const ENGINS_PREDEFINIS = [
  'MAN 8x4', 'Pelle hydraulique sur pneu 318', 'JCB', 'Camion malaxeur 8x4',
  'Camion benne 7m³', 'Niveleuse', 'Compacteur 12T', 'Pick up A80', 'Dokker A48',
  'Camion-citerne', 'Chargeuse', 'Poclain 318',
];

export const FONCTIONS_POINTAGE = [
  'Chef de chantier', 'Conducteur engin', 'Chauffeur', 'Manœuvre',
  'Mécanicien', 'Gardien', 'Ingénieur', 'Autre',
];

// Tâches types des équipes de sous-traitance informelle (Chantier ST-K, mode
// simplifié) — suggestions de saisie, modifiables/extensibles librement,
// pas une liste fermée.
export const TACHES_TYPES_SOUS_TRAITANCE = [
  { designation: 'Maçonnerie gabion', unite: 'm³' },
  { designation: 'Fossé bétonné', unite: 'ml' },
  { designation: 'Accotement bétonné', unite: 'ml' },
  { designation: 'Seguia', unite: 'ml' },
  { designation: 'Maçonnerie de pierre', unite: 'm³' },
];
