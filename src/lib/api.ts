// src/lib/api.ts — Client API centralisé
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Injection du token JWT ────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gl_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Gestion des erreurs / refresh ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gl_token');
        localStorage.removeItem('gl_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ── Types de base ─────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: { total: number; page: number; limit: number; pages?: number };
}

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  avatar_url?: string;
}

export interface Marche {
  id: string;
  numero_marche: string;
  objet: string;
  maitre_ouvrage: string;
  entreprise_attributaire: string;
  montant_initial: number;
  montant_actualise?: number;
  date_commencement: string;
  delai_contractuel: number;
  date_fin_prevue?: string;
  statut: 'en_attente' | 'en_cours' | 'acheve' | 'en_retard' | 'resilie' | 'suspendu';
  avancement_physique: number;
  avancement_financier: number;
  taux_tva: number;
  taux_retenue_garantie: number;
  chef_marche_id?: string;
  chef_marche_nom?: string;
  bq_total?: number;
  nb_articles?: number;
  nb_commandes?: number;
  nb_factures?: number;
  nb_documents?: number;
  dernier_decompte?: string;
  total_commandes?: number;
  total_facture?: number;
  total_paye?: number;
  jours_restants?: number;
  jours_ecoules?: number;
  created_at: string;
}

export interface ArticleMarche {
  id: string;
  marche_id: string;
  code_article: string;
  designation: string;
  unite: string;
  quantite_prevue: number;
  prix_unitaire: number;
  montant: number;
  ordre: number;
  is_sous_total: boolean;
  quantite_executee_totale?: number;
}

export interface Commande {
  id: string;
  numero_commande: string;
  marche_id: string;
  fournisseur_id?: string;
  fournisseur_nom?: string;
  fournisseur_email?: string;
  numero_marche?: string;
  marche_objet?: string;
  date_commande: string;
  date_livraison_prevue?: string;
  statut: string;
  total_ht: number;
  taux_tva: number;
  montant_tva: number;
  total_ttc: number;
  lignes?: LigneCommande[];
}

export interface LigneCommande {
  id: string;
  commande_id: string;
  article_id?: string;
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  montant: number;
}

export interface Facture {
  id: string;
  numero_facture: string;
  marche_id: string;
  commande_id?: string;
  commande_numero?: string;
  marche_numero?: string;
  date_facture: string;
  date_echeance?: string;
  date_paiement?: string;
  reference_paiement?: string;
  date_validation?: string;
  validated_by_nom?: string;
  statut: 'brouillon' | 'validee' | 'payee' | 'annulee' | 'contestee';
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  montant_paye: number;
  lignes?: LigneFacture[];
}

export interface LigneFacture {
  id: string;
  facture_id: string;
  article_id?: string;
  designation: string;
  unite: string;
  quantite_executee: number;
  prix_unitaire: number;
  montant: number;
}

export interface Situation {
  id: string;
  numero_situation: number;
  marche_id: string;
  type_situation: 'provisoire' | 'mensuel' | 'definitif';
  periode_debut: string;
  periode_fin: string;
  avancement_physique: number;
  montant_brut: number;
  retenue_garantie: number;
  avances_anterieures?: number;
  deductions_diverses?: number;
  montant_net: number;
  statut: 'en_cours' | 'soumis' | 'approuve' | 'paye' | 'rejete';
  observations?: string;
  date_soumission?: string;
  date_approbation?: string;
  date_paiement?: string;
  numero_marche?: string;
  marche_objet?: string;
  maitre_ouvrage?: string;
  entreprise_attributaire?: string;
  taux_retenue_garantie?: number;
  lignes?: LigneSituation[];
}

export interface LigneSituation {
  article_id: string;
  code_article: string;
  designation: string;
  unite: string;
  quantite_prevue: number;
  quantite_cumulee_avant: number;
  quantite_periode: number;
  quantite_cumulee: number;
  prix_unitaire: number;
  montant_periode: number;
  montant_cumule: number;
  pourcentage: number;
}

export interface ChargeMensuelle {
  id: string;
  marche_id: string;
  mois: string;
  masse_salariale: number;
  carburant: number;
  hebergement: number;
  restauration: number;
  reparations: number;
  pneumatiques: number;
  transport: number;
  sous_traitance: number;
  divers: number;
  objectif_mensuel: number;
  notes?: string;
}

export interface ChargeJournaliere {
  id: string;
  marche_id: string;
  date_jour: string;
  categorie: 'location_materiel' | 'achat_materiaux' | 'autre';
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  montant: number;
  notes?: string;
}

export interface PointagePersonnel {
  id: string;
  marche_id: string;
  date_jour: string;
  nom_personnel: string;
  fonction?: string;
  present: boolean;
  heures_travaillees: number;
  taux_horaire: number;
  observation?: string;
  created_by_nom?: string;
}

export interface JournalMateriel {
  id: string;
  marche_id: string;
  date_jour: string;
  engin: string;
  heures_travaillees: number;
  gasoil_consomme: number;
  taux_horaire: number;
  statut: 'operationnel' | 'panne' | 'entretien' | 'arret';
  observation?: string;
  created_by_nom?: string;
}

// ── Services API ──────────────────────────────────────────────

export const authService = {
  login:  (email: string, mot_de_passe: string) =>
    api.post<ApiResponse<{ token: string; user: User; expires_at: string }>>('/auth/login', { email, mot_de_passe }),
  logout: () => api.post('/auth/logout'),
  me:     () => api.get<ApiResponse<User>>('/auth/me'),
};

export const marchesService = {
  dashboard: ()                          => api.get<ApiResponse<any>>('/marches/dashboard'),
  list:      (params?: any)              => api.get<ApiResponse<Marche[]>>('/marches', { params }),
  get:       (id: string)                => api.get<ApiResponse<Marche>>(`/marches/${id}`),
  create:    (data: Partial<Marche>)     => api.post<ApiResponse<Marche>>('/marches', data),
  update:    (id: string, data: Partial<Marche>) => api.put<ApiResponse<Marche>>(`/marches/${id}`, data),
  delete:    (id: string)                => api.delete(`/marches/${id}`),
  planning:  (id: string)               => api.get(`/marches/${id}/planning`),
  addPhase:  (id: string, data: any)    => api.post(`/marches/${id}/planning`, data),
  updatePhase: (id: string, phaseId: string, data: any) => api.patch(`/marches/${id}/planning/${phaseId}`, data),
  controles: (id: string)               => api.get(`/marches/${id}/controles`),
  addControle: (id: string, data: any)  => api.post(`/marches/${id}/controles`, data),
  essais:    (id: string)               => api.get(`/marches/${id}/essais`),
  addEssai:  (id: string, data: any)    => api.post(`/marches/${id}/essais`, data),
};

export const articlesService = {
  list:   (marcheId: string)                        => api.get<ApiResponse<ArticleMarche[]>>(`/marches/${marcheId}/articles`),
  get:    (marcheId: string, id: string)            => api.get(`/marches/${marcheId}/articles/${id}`),
  create: (marcheId: string, data: Partial<ArticleMarche>) => api.post(`/marches/${marcheId}/articles`, data),
  batch:  (marcheId: string, articles: any[])       => api.post(`/marches/${marcheId}/articles/batch`, { articles }),
  update: (marcheId: string, id: string, data: any) => api.put(`/marches/${marcheId}/articles/${id}`, data),
  delete: (marcheId: string, id: string)            => api.delete(`/marches/${marcheId}/articles/${id}`),
};

export const commandesService = {
  list:          (params?: any)         => api.get<ApiResponse<Commande[]>>('/commandes', { params }),
  get:           (id: string)           => api.get<ApiResponse<Commande>>(`/commandes/${id}`),
  create:        (data: any)            => api.post<ApiResponse<Commande>>('/commandes', data),
  updateStatut:  (id: string, data: any) => api.patch(`/commandes/${id}/statut`, data),
  delete:        (id: string)           => api.delete(`/commandes/${id}`),
};

export const facturesService = {
  list:          (params?: any)          => api.get<ApiResponse<Facture[]>>('/factures', { params }),
  get:           (id: string)            => api.get<ApiResponse<Facture>>(`/factures/${id}`),
  create:        (data: any)             => api.post<ApiResponse<Facture>>('/factures', data),
  fromCommande:  (commandeId: string)    => api.post(`/factures/from-commande/${commandeId}`),
  valider:       (id: string)            => api.patch(`/factures/${id}/valider`),
  paiement:      (id: string, data: any) => api.patch(`/factures/${id}/paiement`, data),
  annuler:       (id: string)            => api.patch(`/factures/${id}/annuler`),
};

export const situationsService = {
  list:     (params?: any)              => api.get<ApiResponse<Situation[]>>('/situations', { params }),
  get:      (id: string)                => api.get<ApiResponse<Situation>>(`/situations/${id}`),
  init:     (marcheId: string)          => api.get(`/situations/init/${marcheId}`),
  create:   (data: any)                 => api.post<ApiResponse<Situation>>('/situations', data),
  statut:   (id: string, data: any)     => api.patch(`/situations/${id}/statut`, data),
  recap:    (marcheId: string)          => api.get(`/situations/recap/${marcheId}`),
  delete:   (id: string)                => api.delete(`/situations/${id}`),
};

export const chargesService = {
  list:   (marcheId: string)            => api.get<ApiResponse<ChargeMensuelle[]>>(`/marches/${marcheId}/charges`),
  save:   (marcheId: string, data: any) => api.post<ApiResponse<ChargeMensuelle>>(`/marches/${marcheId}/charges`, data),
  delete: (marcheId: string, id: string) => api.delete(`/marches/${marcheId}/charges/${id}`),
};

export const chargesJournalieresService = {
  list:   (marcheId: string, mois?: string) =>
    api.get<ApiResponse<ChargeJournaliere[]>>(`/marches/${marcheId}/charges-journalieres`, { params: mois ? { mois } : {} }),
  create: (marcheId: string, data: any) => api.post<ApiResponse<ChargeJournaliere>>(`/marches/${marcheId}/charges-journalieres`, data),
  delete: (marcheId: string, id: string) => api.delete(`/marches/${marcheId}/charges-journalieres/${id}`),
};

export const pointageService = {
  list:   (marcheId: string, date?: string) =>
    api.get<ApiResponse<PointagePersonnel[]>>(`/marches/${marcheId}/pointage`, { params: date ? { date } : {} }),
  create: (marcheId: string, data: any) => api.post<ApiResponse<PointagePersonnel>>(`/marches/${marcheId}/pointage`, data),
  delete: (marcheId: string, id: string) => api.delete(`/marches/${marcheId}/pointage/${id}`),
};

export const materielService = {
  list:   (marcheId: string)            => api.get<ApiResponse<JournalMateriel[]>>(`/marches/${marcheId}/materiel`),
  create: (marcheId: string, data: any) => api.post<ApiResponse<JournalMateriel>>(`/marches/${marcheId}/materiel`, data),
  delete: (marcheId: string, id: string) => api.delete(`/marches/${marcheId}/materiel/${id}`),
};

export const documentsService = {
  list:       (params?: any)             => api.get('/documents', { params }),
  byMarche:   (marcheId: string, params?: any) => api.get(`/documents/marche/${marcheId}`, { params }),
  upload:     (marcheId: string, formData: FormData) =>
    api.post(`/documents/marche/${marcheId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  download:   (id: string)              => `${BASE_URL}/api/documents/${id}/download`,
  update:     (id: string, data: any)   => api.patch(`/documents/${id}`, data),
  delete:     (id: string)              => api.delete(`/documents/${id}`),
};

export const stockService = {
  list:       (params?: any)            => api.get('/stock/materiaux', { params }),
  alertes:    ()                        => api.get('/stock/materiaux?statut=rupture'),
};
