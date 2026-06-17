// src/lib/utils.ts — Utilitaires communs
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistance } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = {
  currency: (n: number | string | null | undefined, suffix = 'MAD') => {
    const num = parseFloat(String(n || 0));
    return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`;
  },
  pct: (n: number | string | null | undefined) => {
    return `${parseFloat(String(n || 0)).toFixed(1)} %`;
  },
  date: (d: string | null | undefined) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy', { locale: fr }); }
    catch { return '—'; }
  },
  dateRelative: (d: string | null | undefined) => {
    if (!d) return '—';
    try { return formatDistance(new Date(d), new Date(), { addSuffix: true, locale: fr }); }
    catch { return '—'; }
  },
  number: (n: number | string | null | undefined) => {
    return parseFloat(String(n || 0)).toLocaleString('fr-FR');
  },
};

export function exportCSV(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv  = [header, ...rows].map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const STATUTS_MARCHE: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente',   color: 'bg-gray-100 text-gray-700' },
  en_cours:   { label: 'En cours',     color: 'bg-blue-100 text-blue-700' },
  acheve:     { label: 'Achevé',       color: 'bg-green-100 text-green-700' },
  en_retard:  { label: 'En retard',    color: 'bg-red-100 text-red-700' },
  resilie:    { label: 'Résilié',      color: 'bg-orange-100 text-orange-700' },
  suspendu:   { label: 'Suspendu',     color: 'bg-yellow-100 text-yellow-700' },
};

export const STATUTS_FACTURE: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon',   color: 'bg-gray-100 text-gray-700' },
  validee:   { label: 'Validée',     color: 'bg-blue-100 text-blue-700' },
  payee:     { label: 'Payée',       color: 'bg-green-100 text-green-700' },
  annulee:   { label: 'Annulée',     color: 'bg-red-100 text-red-700' },
  contestee: { label: 'Contestée',   color: 'bg-orange-100 text-orange-700' },
};

export const STATUTS_COMMANDE: Record<string, { label: string; color: string }> = {
  en_attente:           { label: 'En attente',       color: 'bg-gray-100 text-gray-700' },
  confirmee:            { label: 'Confirmée',         color: 'bg-blue-100 text-blue-700' },
  en_cours_livraison:   { label: 'En livraison',     color: 'bg-yellow-100 text-yellow-700' },
  livree:               { label: 'Livrée',            color: 'bg-green-100 text-green-700' },
  partiellement_livree: { label: 'Part. livrée',     color: 'bg-orange-100 text-orange-700' },
  annulee:              { label: 'Annulée',           color: 'bg-red-100 text-red-700' },
};

export const STATUTS_SITUATION: Record<string, { label: string; color: string }> = {
  en_cours: { label: 'En cours',    color: 'bg-gray-100 text-gray-700' },
  soumis:   { label: 'Soumis',      color: 'bg-blue-100 text-blue-700' },
  approuve: { label: 'Approuvé',    color: 'bg-green-100 text-green-700' },
  paye:     { label: 'Payé',        color: 'bg-emerald-100 text-emerald-700' },
  rejete:   { label: 'Rejeté',      color: 'bg-red-100 text-red-700' },
};

export const TYPES_DOCUMENT = [
  { value: 'contrat',          label: 'Contrat' },
  { value: 'ordre_de_service', label: 'Ordre de service' },
  { value: 'pv_chantier',      label: 'PV de chantier' },
  { value: 'rapport',          label: 'Rapport' },
  { value: 'plan',             label: 'Plan' },
  { value: 'attachement',      label: 'Attachement' },
  { value: 'photo',            label: 'Photo' },
  { value: 'autre',            label: 'Autre' },
];

export const ROLES_LABELS: Record<string, string> = {
  admin:         'Administrateur',
  directeur:     'Directeur',
  chef_projet:   'Chef de projet',
  ingenieur:     'Ingénieur suivi',
  comptable:     'Service financier',
  logisticien:   'Magasinier',
  chef_chantier: 'Chef de chantier',
  ouvrier:       'Consultation',
};
