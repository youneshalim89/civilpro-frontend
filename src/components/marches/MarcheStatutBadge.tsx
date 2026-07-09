// src/components/marches/MarcheStatutBadge.tsx — Badge de statut d'un marché
// Extrait de la duplication existante (Chantier B) entre la liste et la fiche
// marché. Rendu identique à ce qui était recopié dans chaque page.
// Chantier C : s'appuie sur le composant Badge du Design System (même pattern
// que STATUT_COLOR sur /projets — tone="gray" en base, couleur réelle via
// className, car la palette de statuts marché ne rentre pas dans les 6 tons
// fixes de Badge, ex. "résilié" en orange).
import { Badge } from '@/components/ui';
import { STATUTS_MARCHE } from '@/lib/utils';

export function MarcheStatutBadge({ statut }: { statut: string }) {
  const s = STATUTS_MARCHE[statut];
  return <Badge tone="gray" className={s?.color}>{s?.label}</Badge>;
}
