// src/app/design-system/page.tsx — Vitrine CivilPro V2 (Phase 1)
//
// Page isolée, hors du groupe de routes (app) : n'hérite ni du garde
// d'authentification ni de l'ancienne sidebar. Sert uniquement à valider
// visuellement le nouveau Header, la nouvelle Sidebar et les composants
// du design system, sans toucher à une seule page existante.
//
// URL : /design-system — non liée depuis la navigation réelle.
'use client';
import { useState } from 'react';
import {
  FileText, DollarSign, TrendingUp, AlertTriangle, Package, Search,
  Plus, Download, Inbox,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { SidebarV2 } from '@/components/layout/sidebar-v2';
import { useUiStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  Button, Card, CardHeader, Badge, Input, Table, Modal,
  KpiCard, StatCard, EmptyState, Loading, LoadingSkeleton,
} from '@/components/ui';

type Ligne = { id: string; nom: string; statut: string; montant: number };

const DATA: Ligne[] = [
  { id: '1', nom: 'RN6-2024 — Route nationale Meknès', statut: 'en_cours', montant: 42000000 },
  { id: '2', nom: 'CAS-EP01 — Station épuration Casablanca', statut: 'en_retard', montant: 35000000 },
  { id: '3', nom: 'AGA-Z12 — Zone industrielle Agadir', statut: 'acheve', montant: 7000000 },
];

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <div className="flex min-h-screen">
      <SidebarV2 />
      <div className={cn(
        'flex-1 min-h-screen transition-all duration-200',
        sidebarOpen ? 'ml-[var(--sidebar-width)]' : 'ml-[76px]',
      )}>
        <Header />
        <main className="p-6 max-w-screen-2xl mx-auto space-y-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Design System — CivilPro V2</h1>
            <p className="text-sm text-gray-500 mt-1">
              Vitrine de tous les composants réutilisables (Phase 1). Page interne, non liée à la navigation réelle.
            </p>
          </div>

          {/* Boutons */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Button</h2>
            <Card>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" icon={<Plus className="w-4 h-4" />}>Primaire</Button>
                <Button variant="secondary" icon={<Download className="w-4 h-4" />}>Secondaire</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="primary" loading>Chargement</Button>
                <Button variant="primary" disabled>Désactivé</Button>
                <Button variant="primary" size="sm">Petit</Button>
                <Button variant="primary" size="lg">Grand</Button>
              </div>
            </Card>
          </section>

          {/* Badges */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Badge</h2>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">Résolue</Badge>
                <Badge tone="warning">Avertissement</Badge>
                <Badge tone="danger">Critique</Badge>
                <Badge tone="info">Info</Badge>
                <Badge tone="gray">Neutre</Badge>
                <Badge tone="brand">Golden Leader</Badge>
              </div>
            </Card>
          </section>

          {/* KPI Cards */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">KPI Card</h2>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="Total Marchés" value={12} icon={FileText} color="bg-blue-500" sub="8 en cours" />
              <KpiCard label="Montant Global" value="112 000 000 MAD" icon={DollarSign} color="bg-brand-500" sub="Actualisé : 118 M" />
              <KpiCard label="Avancement Moyen" value="64.2 %" icon={TrendingUp} color="bg-emerald-500" sub="4 marchés achevés" />
              <KpiCard label="Alertes actives" value={3} icon={AlertTriangle} color="bg-red-500" sub="1 critique" />
            </div>
          </section>

          {/* Stat Cards */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Stat Card</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Montant Entrée" value="8 400 000 MAD" icon={TrendingUp} tone="green" />
              <StatCard label="Montant Sortie" value="5 100 000 MAD" icon={Package} tone="red" />
              <StatCard label="Différence" value="3 300 000 MAD" icon={AlertTriangle} tone="blue" />
            </div>
          </section>

          {/* Input */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Input</h2>
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                <Input label="Nom du marché" placeholder="RN6-2024..." />
                <Input label="Recherche" placeholder="Rechercher..." icon={<Search className="w-4 h-4" />} />
                <Input label="Champ en erreur" defaultValue="valeur invalide" error="Ce champ est obligatoire" />
                <Input label="Désactivé" placeholder="Non modifiable" disabled />
              </div>
            </Card>
          </section>

          {/* Table */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Table</h2>
            <Card padded={false}>
              <CardHeader title="Marchés (exemple)" />
              <Table<Ligne>
                columns={[
                  { key: 'nom', header: 'Marché' },
                  {
                    key: 'statut', header: 'Statut',
                    render: (r) => (
                      <Badge tone={r.statut === 'en_cours' ? 'info' : r.statut === 'en_retard' ? 'danger' : 'success'}>
                        {r.statut}
                      </Badge>
                    ),
                  },
                  {
                    key: 'montant', header: 'Montant', align: 'right',
                    render: (r) => `${r.montant.toLocaleString('fr-FR')} MAD`,
                  },
                ]}
                data={DATA}
                rowKey={(r) => r.id}
              />
            </Card>
          </section>

          {/* Modal */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Modal</h2>
            <Card>
              <Button onClick={() => setModalOpen(true)}>Ouvrir la modale</Button>
              <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Exemple de modale">
                <p className="text-sm text-gray-600">Contenu de démonstration de la modale réutilisable.</p>
                <div className="flex gap-3 mt-6">
                  <Button variant="primary" className="flex-1" onClick={() => setModalOpen(false)}>Confirmer</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Annuler</Button>
                </div>
              </Modal>
            </Card>
          </section>

          {/* Empty state & Loading */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Empty State &amp; Loading</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmptyState icon={Inbox} title="Aucune donnée" description="Rien à afficher pour le moment." />
              <Card>
                <Button variant="secondary" onClick={() => setShowLoading((s) => !s)} className="mb-4">
                  {showLoading ? 'Masquer' : 'Afficher'} le chargement
                </Button>
                {showLoading ? <Loading label="Chargement des données..." /> : <LoadingSkeleton rows={3} />}
              </Card>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
