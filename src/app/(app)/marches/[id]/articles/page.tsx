'use client';
// src/app/(app)/marches/[id]/articles/page.tsx — Bordereau des prix
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit2, Trash2, Download, Upload, X, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { articlesService, marchesService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import { Card, Table, Button, Modal } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import NumberInput from '@/components/NumberInput';
import type { ArticleMarche } from '@/lib/api';

type ImportRow = { code_article: string; designation: string; unite: string; quantite_prevue: number; prix_unitaire: number };

export default function ArticlesPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<ArticleMarche | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importing, setImporting]   = useState(false);
  const [importDebug, setImportDebug] = useState<{ header: string[]; mapped: (string|null)[]; sample: any[][] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: marchesRes } = useQuery({
    queryKey: ['marche', id],
    queryFn:  () => marchesService.get(id).then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['articles', id],
    queryFn:  () => articlesService.list(id).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (artId: string) => articlesService.delete(id, artId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['articles', id] }); toast.success('Article supprimé'); },
    onError:    () => toast.error('Erreur lors de la suppression'),
  });

  const exportCSV = () => {
    if (!data?.data) return;
    const header = ['Code','Désignation','Unité','Quantité prévue','Prix unitaire','Montant'];
    const rows   = data.data.map((a: ArticleMarche) =>
      [a.code_article, `"${a.designation}"`, a.unite, a.quantite_prevue, a.prix_unitaire, a.montant].join(','));
    const csv    = [header.join(','), ...rows].join('\n');
    const blob   = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url; a.download = `BQ-${marchesRes?.numero_marche}.csv`; a.click();
  };

  const totaux = (data as any)?.totaux;
  const articles: ArticleMarche[] = data?.data || [];

  // ── Import Excel/CSV du bordereau ─────────────────────────────
  const normKey = (k: string) => k.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

  const parseNum = (v: any): number => {
    if (typeof v === 'number') return v;
    if (v == null || v === '') return 0;
    let s = String(v).trim();
    if (/^[\d.\s]+,\d+$/.test(s)) s = s.replace(/[.\s]/g, '').replace(',', '.'); // format FR: 4.136,00
    else s = s.replace(/\s/g, '').replace(/,/g, ''); // format EN: 4,136.00
    return parseFloat(s) || 0;
  };

  // Classification des colonnes par mots-clés (tolère "N° prix", "PU HT", "Désignation"...)
  const classifyColumn = (key: string): keyof ImportRow | 'montant' | null => {
    if (key.includes('design') || key.includes('libelle') || key.includes('desc')) return 'designation';
    if (key.includes('quantit') || key.includes('qte') || key.includes('qty')) return 'quantite_prevue';
    if (key.includes('montant') || key.includes('total')) return 'montant';
    if (key.includes('code') || key.includes('nprix') || key.includes('nordre') || key.includes('numero') || key === 'n' || key === 'no') return 'code_article';
    if (key.includes('pu') || key.includes('prix')) return 'prix_unitaire';
    if (key.includes('unit')) return 'unite';
    return null;
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

        // Trouver la ligne d'en-tête : celle qui contient le plus de colonnes reconnues
        let headerIdx = -1, bestScore = 0;
        const maxScan = Math.min(grid.length, 15);
        for (let i = 0; i < maxScan; i++) {
          const score = grid[i].filter(cell => classifyColumn(normKey(String(cell)))).length;
          if (score > bestScore) { bestScore = score; headerIdx = i; }
        }

        if (headerIdx === -1 || bestScore < 2) {
          toast.error('En-têtes non reconnus. Colonnes attendues : Désignation, Unité, Quantité, Prix unitaire.');
          return;
        }

        const headerRow = grid[headerIdx].map((h: any) => classifyColumn(normKey(String(h))));
        const dataRows = grid.slice(headerIdx + 1);

        const parsed: ImportRow[] = dataRows.map((cells) => {
          const out: any = { code_article: '', designation: '', unite: '', quantite_prevue: 0, prix_unitaire: 0 };
          headerRow.forEach((field, ci) => {
            if (!field || field === 'montant') return;
            const val = cells[ci];
            if (field === 'quantite_prevue' || field === 'prix_unitaire') out[field] = parseNum(val);
            else out[field] = String(val ?? '').trim();
          });
          return out as ImportRow;
        }).filter(r => r.designation && (r.quantite_prevue > 0 || r.prix_unitaire > 0))
          .map((r, i) => ({ ...r, code_article: r.code_article || String(i + 1), unite: r.unite || 'u' }));

        if (!parsed.length) {
          setImportDebug({
            header: grid[headerIdx].map((h: any) => String(h)),
            mapped: headerRow,
            sample: dataRows.slice(0, 5),
          });
          toast.error('Aucune ligne valide détectée — voir le diagnostic ci-dessous.');
          return;
        }
        setImportDebug(null);
        setImportRows(parsed);
      } catch {
        toast.error('Impossible de lire ce fichier');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmImport = async () => {
    if (!importRows) return;
    setImporting(true);
    try {
      await articlesService.batch(id, importRows);
      toast.success(`${importRows.length} articles importés`);
      qc.invalidateQueries({ queryKey: ['articles', id] });
      setImportRows(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const articleColumns: TableColumn<ArticleMarche>[] = [
    { key: 'index', header: '#', render: (a) => <span className="text-gray-400 text-xs">{articles.indexOf(a) + 1}</span> },
    { key: 'code_article', header: 'Code', render: (a) => <span className="font-mono text-xs text-brand-600">{a.code_article}</span> },
    { key: 'designation', header: 'Désignation', render: (a) => <p className="truncate max-w-xs">{a.designation}</p> },
    { key: 'unite', header: 'Unité', align: 'right', render: (a) => <span className="text-gray-500">{a.unite}</span> },
    { key: 'quantite_prevue', header: 'Qté Prévue', align: 'right', render: (a) => fmt.number(a.quantite_prevue) },
    { key: 'prix_unitaire', header: 'Prix Unitaire', align: 'right', render: (a) => fmt.currency(a.prix_unitaire, '') },
    { key: 'montant', header: 'Montant', align: 'right', render: (a) => <span className="font-medium">{fmt.currency(a.montant, '')}</span> },
    {
      key: 'quantite_executee_totale', header: 'Qté Exécutée', align: 'right',
      render: (a) => <span className="text-blue-600">{a.quantite_executee_totale ? fmt.number(a.quantite_executee_totale) : '—'}</span>,
    },
    {
      key: 'actions', header: 'Actions',
      render: (a) => (
        <div className="flex gap-1">
          <button onClick={() => { setEditing(a); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <Edit2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={() => { if (confirm('Supprimer cet article ?')) deleteMut.mutate(a.id); }} className="p-1 hover:bg-red-50 rounded transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  const articlesFooter = totaux && (
    <tr>
      <td colSpan={6} className="px-4 py-3 text-sm font-bold text-right text-gray-700">TOTAL GÉNÉRAL</td>
      <td className="px-4 py-3 text-right font-bold text-brand-700">{fmt.currency(totaux.montant_total, '')}</td>
      <td colSpan={2} />
    </tr>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href={`/marches/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Bordereau des Prix</h1>
          <p className="text-sm text-gray-500">{marchesRes?.numero_marche} — {marchesRes?.objet}</p>
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<Upload className="w-4 h-4" />}>Importer Excel/CSV</Button>
        <Button variant="secondary" onClick={exportCSV} icon={<Download className="w-4 h-4" />}>Exporter CSV</Button>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} icon={<Plus className="w-4 h-4" />}>Ajouter article</Button>
      </div>

      {/* Diagnostic import (si aucune ligne valide) */}
      {importDebug && (
        <Card className="border-red-200 border-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-red-700">Diagnostic de l'import — aucune ligne valide trouvée</h3>
            <button onClick={() => setImportDebug(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Ligne d'en-tête détectée et colonnes reconnues (null = colonne ignorée) :
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="text-xs border">
              <tbody>
                <tr className="bg-gray-50">
                  {importDebug.header.map((h, i) => <td key={i} className="border px-2 py-1 font-medium">{h || '(vide)'}</td>)}
                </tr>
                <tr>
                  {importDebug.mapped.map((m, i) => <td key={i} className="border px-2 py-1 text-brand-600">{m || 'null'}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-600 mb-2">5 premières lignes de données lues sous cet en-tête :</p>
          <div className="overflow-x-auto">
            <table className="text-xs border">
              <tbody>
                {importDebug.sample.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((c: any, ci: number) => <td key={ci} className="border px-2 py-1">{String(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal prévisualisation import */}
      <Modal open={!!importRows} onClose={() => setImportRows(null)} maxWidth="2xl"
        title={importRows ? `Aperçu de l'import — ${importRows.length} ligne(s)` : ''}>
        <div className="-m-6">
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="table-header">Code</th>
                    <th className="table-header">Désignation</th>
                    <th className="table-header">Unité</th>
                    <th className="table-header text-right">Quantité</th>
                    <th className="table-header text-right">Prix unitaire</th>
                    <th className="table-header text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(importRows || []).map((r, i) => (
                    <tr key={i}>
                      <td className="table-cell font-mono text-xs">{r.code_article}</td>
                      <td className="table-cell">{r.designation}</td>
                      <td className="table-cell">{r.unite}</td>
                      <td className="table-cell text-right">{fmt.number(r.quantite_prevue)}</td>
                      <td className="table-cell text-right">{fmt.currency(r.prix_unitaire)}</td>
                      <td className="table-cell text-right font-medium">{fmt.currency(r.quantite_prevue * r.prix_unitaire)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setImportRows(null)}>Annuler</Button>
              <Button onClick={confirmImport} loading={importing} icon={<CheckCircle className="w-4 h-4" />}>
                {importing ? 'Import en cours...' : `Importer ${importRows?.length || 0} lignes`}
              </Button>
            </div>
        </div>
      </Modal>

      {/* Totaux */}
      {totaux && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <p className="text-xs text-gray-500">Nombre d'articles</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totaux.nb_articles}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-gray-500">Montant BQ Total</p>
            <p className="text-xl font-bold text-brand-600 mt-1">{fmt.currency(totaux.montant_total)}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-gray-500">Montant marché initial</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{fmt.currency(marchesRes?.montant_initial)}</p>
          </Card>
        </div>
      )}

      {/* Formulaire inline */}
      {showForm && (
        <ArticleForm
          marcheId={id}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['articles', id] }); setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Tableau BQ */}
      <Card padded={false}>
        <Table<ArticleMarche>
          columns={articleColumns}
          data={articles}
          rowKey={(a) => a.id}
          loading={isLoading}
          emptyMessage="Aucun article"
          rowClassName={(a) => a.is_sous_total ? 'bg-gray-50 font-semibold' : undefined}
          footer={articlesFooter}
        />
      </Card>
    </div>
  );
}

// ── Formulaire article inline ─────────────────────────────────
function ArticleForm({ marcheId, initial, onClose, onSaved }: {
  marcheId: string;
  initial: ArticleMarche | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code_article:    initial?.code_article    || '',
    designation:     initial?.designation     || '',
    unite:           initial?.unite           || '',
    quantite_prevue: initial?.quantite_prevue || 0,
    prix_unitaire:   initial?.prix_unitaire   || 0,
    ordre:           initial?.ordre           || 0,
  });
  const [saving, setSaving] = useState(false);

  const montant = (parseFloat(String(form.quantite_prevue)) * parseFloat(String(form.prix_unitaire))).toFixed(2);

  const handleSave = async () => {
    if (!form.code_article || !form.designation || !form.unite) {
      toast.error('Remplissez tous les champs obligatoires'); return;
    }
    setSaving(true);
    try {
      if (initial) {
        await articlesService.update(marcheId, initial.id, form);
        toast.success('Article modifié');
      } else {
        await articlesService.create(marcheId, form);
        toast.success('Article ajouté');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-brand-200 border-2">
      <h3 className="font-semibold text-gray-800 mb-4">{initial ? 'Modifier article' : 'Nouvel article'}</h3>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div>
          <label className="label">Code article *</label>
          <input className="input text-sm" value={form.code_article}
            onChange={e => setForm(f => ({ ...f, code_article: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="label">Désignation *</label>
          <input className="input text-sm" value={form.designation}
            onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
        </div>
        <div>
          <label className="label">Unité *</label>
          <input className="input text-sm" placeholder="m³, ml, u..." value={form.unite}
            onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} />
        </div>
        <div>
          <label className="label">Quantité prévue</label>
          <NumberInput className="input text-sm" value={form.quantite_prevue}
            onChange={v => setForm(f => ({ ...f, quantite_prevue: v }))} />
        </div>
        <div>
          <label className="label">Prix unitaire (MAD)</label>
          <NumberInput className="input text-sm" value={form.prix_unitaire}
            onChange={v => setForm(f => ({ ...f, prix_unitaire: v }))} />
        </div>
        <div>
          <label className="label">Montant calculé</label>
          <div className="input text-sm bg-gray-50 font-semibold text-brand-600">
            {parseFloat(montant).toLocaleString('fr-FR')} MAD
          </div>
        </div>
        <div>
          <label className="label">Ordre</label>
          <input className="input text-sm" type="number" value={form.ordre}
            onChange={e => setForm(f => ({ ...f, ordre: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <Button onClick={handleSave} loading={saving}>
          {saving ? 'Enregistrement...' : initial ? 'Mettre à jour' : 'Ajouter'}
        </Button>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
      </div>
    </Card>
  );
}
