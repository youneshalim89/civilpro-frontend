'use client';
// src/app/(app)/marches/[id]/page.tsx — Détail d'un marché (Chantier UI-2 : en-tête riche + onglets)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit2, FileText, AlertCircle, FileDown, Trash2,
  HardHat, Truck, ChevronDown, Wrench, Activity, ClipboardCheck,
} from 'lucide-react';
import { marchesService, chargesService, chargesJournalieresService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import { exportMarchePDF } from '@/lib/pdf';
import { useAuthStore } from '@/lib/store';
import { MarcheStatutBadge } from '@/components/marches/MarcheStatutBadge';
import { SupprimerMarcheModal } from '@/components/marches/SupprimerMarcheModal';
import { Card, StatCard, Button, Loading, EmptyState, Tabs } from '@/components/ui';
import type { TabItem } from '@/components/ui/Tabs';
import type { ChargeMensuelle } from '@/lib/api';

const CHAMPS_CHARGE: (keyof ChargeMensuelle)[] = [
  'masse_salariale', 'carburant', 'hebergement', 'restauration',
  'reparations', 'pneumatiques', 'transport', 'sous_traitance', 'divers',
];

export default function MarcheDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [showInfos, setShowInfos] = useState(false);
  const [showIndicateurs, setShowIndicateurs] = useState(false);
  const [aSupprimer, setASupprimer] = useState<{ id: string; numero_marche: string } | null>(null);

  const { data: marche, isLoading } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
    enabled:  !!id,
  });

  const { data: chargesMensuelles } = useQuery({
    queryKey: ['charges', id],
    queryFn:  () => chargesService.list(id).then(r => r.data.data),
    enabled:  !!id,
  });

  const { data: chargesJourTous } = useQuery({
    queryKey: ['charges-jour-all', id],
    queryFn:  () => chargesJournalieresService.list(id).then(r => r.data.data),
    enabled:  !!id,
  });

  if (isLoading) return <Loading label="Chargement du marché..." />;
  if (!marche) return <EmptyState icon={FileText} title="Marché introuvable" />;

  const totalChargesFixes = (chargesMensuelles || []).reduce(
    (s, c) => s + CHAMPS_CHARGE.reduce((s2, k) => s2 + (Number(c[k]) || 0), 0), 0);
  const totalChargesJour  = (chargesJourTous || []).reduce((s, c) => s + (Number(c.montant) || 0), 0);
  const montantSortie = totalChargesFixes + totalChargesJour;
  // montant_actualise revient en NUMERIC PostgreSQL sérialisé en chaîne ("0.00" par
  // exemple) : une chaîne non vide est toujours "truthy" en JS, donc un `||` classique
  // ne retombe jamais sur montant_initial même quand l'actualisation vaut 0 (non définie
  // en pratique). On ne retient l'actualisé que s'il est réellement positif.
  const montantMarche = Number(marche.montant_actualise) > 0 ? Number(marche.montant_actualise) : Number(marche.montant_initial);

  const tabItems: TabItem[] = [
    { label: 'Vue générale', href: `/marches/${id}` },
    { label: 'Bordereau (BQ)', href: `/marches/${id}/articles` },
    { label: 'Commandes',     href: `/commandes?marche_id=${id}` },
    { label: 'Situations',    href: `/situations?marche_id=${id}` },
    { label: 'Factures',      href: `/factures?marche_id=${id}` },
    { label: 'Charges',       href: `/marches/${id}/charges` },
    { label: 'Caisse',        href: `/marches/${id}/caisse` },
    { label: 'Documents',     href: `/documents?marche_id=${id}` },
  ];

  const modulesComplementaires = [
    { label: 'Planning / Chantier', href: `/marches/${id}/chantier`,           icon: HardHat },
    { label: 'Journal matériel',    href: `/marches/${id}/materiel`,          icon: Truck },
    { label: 'Entretien Matériel',  href: `/marches/${id}/entretien-materiel`, icon: Wrench },
    { label: 'Avancement physique', href: `/marches/${id}/avancement-physique`, icon: Activity },
    { label: 'Feuille de Pointage', href: `/marches/${id}/pointage`,          icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête riche */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link href="/marches" className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{marche.numero_marche}</h1>
                <MarcheStatutBadge statut={marche.statut} />
                {marche.jours_restants != null && marche.jours_restants <= 30 && (
                  <span className="badge bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {marche.jours_restants}j restants
                  </span>
                )}
                {marche.projet_id && (
                  <Link href={`/projets/${marche.projet_id}`} className="badge bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors">
                    Projet : {marche.projet_code || marche.projet_nom}
                  </Link>
                )}
              </div>
              <p className="text-gray-600 mt-1">{marche.objet}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => exportMarchePDF(marche)} icon={<FileDown className="w-4 h-4" />}>PDF</Button>
            <Link href={`/marches/${id}/modifier`} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              <Edit2 className="w-4 h-4" /> Modifier
            </Link>
            {user?.role === 'admin' && (
              <Button variant="danger" onClick={() => setASupprimer({ id: id!, numero_marche: marche.numero_marche })} icon={<Trash2 className="w-4 h-4" />}>
                Supprimer
              </Button>
            )}
          </div>
        </div>

        {/* Avancement physique */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-sm text-gray-600">Avancement physique</span>
            <span className="text-sm font-semibold">{fmt.pct(marche.avancement_physique)}</span>
          </div>
          <div className="bg-gray-100 rounded-full h-2.5">
            <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${marche.avancement_physique}%` }} />
          </div>
        </div>

        {/* 3 chiffres clés */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Montant marché" tone="gray"  value={fmt.currency(montantMarche)} />
          <StatCard label="Facturé"        tone="blue"  value={fmt.currency(marche.total_facture || 0)} />
          <StatCard label="Payé"           tone="green" value={fmt.currency(marche.total_paye || 0)} />
        </div>
      </div>

      {/* Onglets */}
      <Tabs items={tabItems} />

      {/* Contenu de l'onglet "Vue générale" */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Identité */}
          <Card className="col-span-2">
            <button onClick={() => setShowInfos(v => !v)} className="w-full flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Informations générales du projet</h3>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showInfos ? 'rotate-180' : ''}`} />
            </button>
            {showInfos && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mt-4">
                <InfoRow label="Maître d'ouvrage"         value={marche.maitre_ouvrage} />
                <InfoRow label="Projet lié"                value={marche.projet_id ? `${marche.projet_code || ''} ${marche.projet_nom ? '— ' + marche.projet_nom : ''}`.trim() : 'Aucun'} />
                <InfoRow label="Entreprise attributaire"  value={marche.entreprise_attributaire} />
                <InfoRow label="Chef de marché"           value={marche.chef_marche_nom || '—'} />
                <InfoRow label="Date commencement"        value={fmt.date(marche.date_commencement)} />
                <InfoRow label="Délai contractuel"        value={`${marche.delai_contractuel} jours`} />
                <InfoRow label="Date fin prévue"          value={fmt.date(marche.date_fin_prevue)} />
                <InfoRow label="Jours écoulés"            value={`${marche.jours_ecoules || 0} j`} />
                <InfoRow label="Taux TVA"                 value={`${marche.taux_tva} %`} />
                <InfoRow label="Retenue de garantie"      value={`${marche.taux_retenue_garantie} %`} />
              </div>
            )}
          </Card>

          {/* Indicateurs financiers (hors Facturé/Payé, déjà dans l'en-tête) */}
          <Card>
            <button onClick={() => setShowIndicateurs(v => !v)} className="w-full flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Indicateurs financiers</h3>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showIndicateurs ? 'rotate-180' : ''}`} />
            </button>
            {showIndicateurs && (
              <div className="space-y-4 mt-4">
                <FinIndicator label="Montant initial"    value={marche.montant_initial} />
                <FinIndicator label="Montant actualisé"  value={montantMarche} />
                <FinIndicator label="Total commandé"     value={marche.total_commandes || 0} color="blue" />
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-500">Avancement financier</span>
                    <span className="text-sm font-semibold">{fmt.pct(marche.avancement_financier)}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${marche.avancement_financier}%` }} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Synthèse Sortie (charges), pour mémoire — Entrée est désormais "Payé" dans l'en-tête */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-1">Charges (sorties)</h3>
          <p className="text-xs text-gray-400 mb-3">Charges fixes mensuelles + charges journalières</p>
          <p className="text-2xl font-bold text-red-600">{fmt.currency(montantSortie)}</p>
        </Card>

        {/* Modules complémentaires */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Modules complémentaires</h3>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {modulesComplementaires.map((m) => (
              <Link key={m.href} href={m.href}
                className="card p-4 flex items-center gap-3 hover:border-brand-400 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <m.icon className="w-5 h-5 text-brand-600" />
                </div>
                <p className="font-medium text-gray-800 text-sm">{m.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <SupprimerMarcheModal
        marche={aSupprimer}
        onClose={() => setASupprimer(null)}
        onDeleted={() => router.push('/marches')}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-gray-800 font-medium mt-0.5">{value}</p>
    </div>
  );
}

function FinIndicator({ label, value, color = 'gray' }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'text-gray-900', blue: 'text-blue-600', purple: 'text-purple-600',
    green: 'text-green-600', orange: 'text-orange-600',
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${colors[color]}`}>{fmt.currency(value)}</span>
    </div>
  );
}
