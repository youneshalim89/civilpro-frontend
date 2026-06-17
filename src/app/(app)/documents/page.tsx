'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Upload, Download, Trash2, FileText, Image, FileArchive, File, Filter, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentsService, marchesService } from '@/lib/api';
import { fmt, TYPES_DOCUMENT } from '@/lib/utils';

const FILE_ICON: Record<string, React.ReactNode> = {
  'application/pdf':   <FileText className="w-6 h-6 text-red-500" />,
  'image/jpeg':        <Image className="w-6 h-6 text-blue-500" />,
  'image/png':         <Image className="w-6 h-6 text-blue-500" />,
  'application/zip':   <FileArchive className="w-6 h-6 text-yellow-500" />,
};

const getIcon = (mime: string) => FILE_ICON[mime] || <File className="w-6 h-6 text-gray-400" />;

const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const qc           = useQueryClient();
  const fileRef      = useRef<HTMLInputElement>(null);
  const marcheIdParam= searchParams.get('marche_id') || '';

  const [marcheId,    setMarcheId]    = useState(marcheIdParam);
  const [typeFilter,  setTypeFilter]  = useState('');
  const [search,      setSearch]      = useState('');
  const [typeUpload,  setTypeUpload]  = useState('autre');
  const [desc,        setDesc]        = useState('');
  const [uploading,   setUploading]   = useState(false);

  const { data: marchesData } = useQuery({
    queryKey: ['marches-list'],
    queryFn:  () => marchesService.list({ limit: 100 }).then(r => r.data.data),
  });

  const { data: docs, isLoading } = useQuery({
    queryKey: ['documents', { marcheId, typeFilter, search }],
    queryFn:  () => marcheId
      ? documentsService.byMarche(marcheId, { type_document: typeFilter }).then(r => r.data.data)
      : documentsService.list({ type_document: typeFilter, search }).then(r => r.data.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => documentsService.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document supprimé'); },
    onError:    () => toast.error('Erreur lors de la suppression'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !marcheId) { if (!marcheId) toast.error('Sélectionnez un marché'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      fd.append('type_document', typeUpload);
      fd.append('description', desc);
      await documentsService.upload(marcheId, fd);
      toast.success(`${file.name} uploadé avec succès`);
      qc.invalidateQueries({ queryKey: ['documents'] });
      setDesc('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const documents = docs || [];

  // Grouper par type
  const grouped = documents.reduce((acc: Record<string, any[]>, d: any) => {
    if (!acc[d.type_document]) acc[d.type_document] = [];
    acc[d.type_document].push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion Documentaire</h1>
          <p className="text-sm text-gray-500">{documents.length} documents</p>
        </div>
      </div>

      {/* Zone upload */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-500" /> Ajouter un document
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div>
            <label className="label">Marché *</label>
            <select className="input text-sm" value={marcheId} onChange={e => setMarcheId(e.target.value)}>
              <option value="">Sélectionner</option>
              {marchesData?.map((m: any) => (
                <option key={m.id} value={m.id}>{m.numero_marche}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type de document</label>
            <select className="input text-sm" value={typeUpload} onChange={e => setTypeUpload(e.target.value)}>
              {TYPES_DOCUMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input text-sm" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Description optionnelle..." />
          </div>
          <div>
            <label className="label">Fichier (PDF, image, Word, Excel, ZIP)</label>
            <label className={`flex items-center gap-2 input cursor-pointer hover:border-brand-400 transition-colors ${uploading ? 'opacity-60' : ''}`}>
              <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500">
                {uploading ? 'Upload en cours...' : 'Cliquer pour sélectionner'}
              </span>
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.zip"
                onChange={handleUpload} disabled={uploading || !marcheId} />
            </label>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Rechercher..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm w-52" value={marcheId}
          onChange={e => setMarcheId(e.target.value)}>
          <option value="">Tous les marchés</option>
          {marchesData?.map((m: any) => (
            <option key={m.id} value={m.id}>{m.numero_marche}</option>
          ))}
        </select>
        <select className="input text-sm w-52" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Tous les types</option>
          {TYPES_DOCUMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Affichage par type */}
      {isLoading && <div className="card p-12 text-center text-gray-400 animate-pulse">Chargement...</div>}

      {!isLoading && documents.length === 0 && (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Aucun document trouvé</p>
          <p className="text-xs text-gray-300 mt-1">Sélectionnez un marché et uploadez un fichier</p>
        </div>
      )}

      {Object.entries(grouped).map(([type, items]) => {
        const typeLabel = TYPES_DOCUMENT.find(t => t.value === type)?.label || type;
        return (
          <div key={type} className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="font-semibold text-gray-700 text-sm">{typeLabel}</h3>
              <span className="badge bg-gray-200 text-gray-600 ml-1">{(items as any[]).length}</span>
            </div>
            <div className="divide-y">
              {(items as any[]).map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
                  <div className="flex-shrink-0">{getIcon(doc.mime_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {doc.nom_original || doc.nom_fichier}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {doc.description || '—'} · {formatBytes(doc.taille_fichier)} · {fmt.date(doc.created_at)} · {doc.uploaded_by_nom}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={documentsService.download(doc.id)} target="_blank" rel="noreferrer"
                      className="p-1.5 hover:bg-blue-50 rounded-lg" title="Télécharger">
                      <Download className="w-4 h-4 text-blue-500" />
                    </a>
                    <button onClick={() => { if (confirm('Supprimer ce document ?')) deleteMut.mutate(doc.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg" title="Supprimer">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
