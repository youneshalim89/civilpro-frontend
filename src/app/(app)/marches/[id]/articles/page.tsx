'use client';
// src/app/(app)/marches/[id]/articles/page.tsx — Bordereau des prix
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit2, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { articlesService, marchesService } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { ArticleMarche } from '@/lib/api';

export default function ArticlesPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<ArticleMarche | null>(null);

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

  const totaux = data?.totaux;
  const articles: ArticleMarche[] = data?.data || [];

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
        <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-2">
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter article
        </button>
      </div>

      {/* Totaux */}
      {totaux && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500">Nombre d'articles</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totaux.nb_articles}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500">Montant BQ Total</p>
            <p className="text-xl font-bold text-brand-600 mt-1">{fmt.currency(totaux.montant_total)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500">Montant marché initial</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{fmt.currency(marchesRes?.montant_initial)}</p>
          </div>
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
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header w-8">#</th>
                <th className="table-header">Code</th>
                <th className="table-header">Désignation</th>
                <th className="table-header text-right">Unité</th>
                <th className="table-header text-right">Qté Prévue</th>
                <th className="table-header text-right">Prix Unitaire</th>
                <th className="table-header text-right">Montant</th>
                <th className="table-header text-right">Qté Exécutée</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {articles.map((a, i) => (
                <tr key={a.id} className={`hover:bg-gray-50 ${a.is_sous_total ? 'bg-gray-50 font-semibold' : ''}`}>
                  <td className="table-cell text-gray-400 text-xs">{i + 1}</td>
                  <td className="table-cell font-mono text-xs text-brand-600">{a.code_article}</td>
                  <td className="table-cell max-w-xs">
                    <p className="truncate">{a.designation}</p>
                  </td>
                  <td className="table-cell text-right text-gray-500">{a.unite}</td>
                  <td className="table-cell text-right">{fmt.number(a.quantite_prevue)}</td>
                  <td className="table-cell text-right">{fmt.currency(a.prix_unitaire, '')}</td>
                  <td className="table-cell text-right font-medium">{fmt.currency(a.montant, '')}</td>
                  <td className="table-cell text-right text-blue-600">
                    {a.quantite_executee_totale ? fmt.number(a.quantite_executee_totale) : '—'}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(a); setShowForm(true); }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button onClick={() => { if (confirm('Supprimer cet article ?')) deleteMut.mutate(a.id); }}
                        className="p-1 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {totaux && (
              <tfoot className="border-t bg-brand-50">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm font-bold text-right text-gray-700">
                    TOTAL GÉNÉRAL
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">
                    {fmt.currency(totaux.montant_total, '')}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
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
    <div className="card p-5 border-brand-200 border-2">
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
          <input className="input text-sm" type="number" step="0.001" value={form.quantite_prevue}
            onChange={e => setForm(f => ({ ...f, quantite_prevue: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div>
          <label className="label">Prix unitaire (MAD)</label>
          <input className="input text-sm" type="number" step="0.01" value={form.prix_unitaire}
            onChange={e => setForm(f => ({ ...f, prix_unitaire: parseFloat(e.target.value) || 0 }))} />
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
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Enregistrement...' : initial ? 'Mettre à jour' : 'Ajouter'}
        </button>
        <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
      </div>
    </div>
  );
}
