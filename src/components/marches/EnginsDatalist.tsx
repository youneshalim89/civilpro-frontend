// src/components/marches/EnginsDatalist.tsx — Liste de suggestion d'engins
// Extrait de la duplication existante (Chantier B) entre pointage, materiel,
// entretien-materiel et charges. Rendu identique à ce qui était recopié dans
// chaque page (mêmes options, même comportement de saisie libre + suggestion).
import { ENGINS_PREDEFINIS } from '@/lib/constants';

export function EnginsDatalist({ id, items = ENGINS_PREDEFINIS }: { id: string; items?: string[] }) {
  return (
    <datalist id={id}>
      {items.map(e => <option key={e} value={e}>{e}</option>)}
    </datalist>
  );
}
