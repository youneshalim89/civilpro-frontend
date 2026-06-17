'use client';
// src/app/(app)/marches/[id]/page.tsx — Détail d'un marché
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit2, FileText, ShoppingCart, Receipt,
  BarChart3, Package, FolderOpen, HardHat, AlertCircle,
} from 'lucide-react';
import { marchesService } from '@/lib/api';
import { fmt, STATUTS_MARCHE } from '@/lib/utils';

export default function MarcheDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: marche, isLoading } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
    enabled:  !!id,
  });

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="card p-6 h-64 bg-gray-100" />
    </div>
  );
  if (!marche) return <p className="text-gray-500">Marché introuvable.</p>;

  const statut = STATUTS_MARCHE[marche.statut];

  const tabs = [
    { label: 'Bordereau des prix',  href: `/marches/${id}/articles`,   icon: FileText,    count: marche.nb_articles },
    { label: 'Commandes',           href: `/commandes?marche_id=${id}`, icon: ShoppingCart, count: marche.nb_commandes },
    { label: 'Factures',            href: `/factures?marche_id=${id}`,  icon: Receipt,      count: marche.nb_factures },
    { label: 'Situations',          href: `/situations?marche_id=${id}`,icon: BarChart3,    count: marche.dernier_decompte },
    { label: 'Documents',           href: `/documents?marche_id=${id}`, icon: FolderOpen,   count: marche.nb_documents },
    { label: 'Planning / Chantier', href: `/marches/${id}/chantier`,    icon: HardHat,      count: null },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/marches" className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{marche.numero_marche}</h1>
              <span className={`badge ${statut?.color}`}>{statut?.label}</span>
              {marche.jours_restants !== null && marche.jours_restants <= 30 && (
                <span className="badge bg-red-100 text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {marche.jours_restants}j restants
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">{marche.objet}</p>
          </div>
        </div>
        <Link href={`/marches/${id}/modifier`} className="btn-secondary text-sm flex items-center gap-2">
          <Edit2 className="w-4 h-4" /> Modifier
        </Link>
      </div>

      {/* Infos principales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Identité */}
        <div className="card p-5 col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Informations générales</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow label="Maître d'ouvrage"         value={marche.maitre_ouvrage} />
            <InfoRow label="Entreprise attributaire"  value={marche.entreprise_attributaire} />
            <InfoRow label="Chef de marché"           value={marche.chef_marche_nom || '—'} />
            <InfoRow label="Date commencement"        value={fmt.date(marche.date_commencement)} />
            <InfoRow label="Délai contractuel"        value={`${marche.delai_contractuel} jours`} />
            <InfoRow label="Date fin prévue"          value={fmt.date(marche.date_fin_prevue)} />
            <InfoRow label="Jours écoulés"            value={`${marche.jours_ecoules || 0} j`} />
            <InfoRow label="Taux TVA"                 value={`${marche.taux_tva} %`} />
            <InfoRow label="Retenue de garantie"      value={`${marche.taux_retenue_garantie} %`} />
          </div>
        </div>

        {/* Indicateurs financiers */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Indicateurs financiers</h3>
          <div className="space-y-4">
            <FinIndicator label="Montant initial"    value={marche.montant_initial} />
            <FinIndicator label="Montant actualisé"  value={marche.montant_actualise || marche.montant_initial} />
            <FinIndicator label="Total commandé"     value={marche.total_commandes || 0} color="blue" />
            <FinIndicator label="Total facturé"      value={marche.total_facture || 0} color="purple" />
            <FinIndicator label="Total payé"         value={marche.total_paye || 0} color="green" />
          </div>
        </div>
      </div>

      {/* Avancement */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Avancement</h3>
        <div className="grid grid-cols-2 gap-6">
          <ProgressBar label="Avancement physique"   value={marche.avancement_physique}  color="bg-blue-500" />
          <ProgressBar label="Avancement financier"  value={marche.avancement_financier} color="bg-brand-500" />
        </div>
      </div>

      {/* Modules rapides */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Modules</h3>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href}
              className="card p-4 flex items-center gap-3 hover:border-brand-400 hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                <t.icon className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">{t.label}</p>
                {t.count !== null && t.count !== undefined && (
                  <p className="text-xs text-gray-400">{t.count} éléments</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
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

function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-semibold">{fmt.pct(value)}</span>
      </div>
      <div className="bg-gray-100 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
