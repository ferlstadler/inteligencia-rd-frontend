export interface Lead {
  contact_uuid: string;
  created_at: string; // ISO or date string
  last_conversion_at?: string;
  last_visit_at?: string;
  conversions_sum: number;
  contact_name: string;
  contact_job_title: string;
  contact_origin: string;
  traffic_campaign: string;
  traffic_source: string;
  traffic_medium: string;
  pg_tags: string[]; // parsed from comma-separated string
  company_tags: string[]; // parsed from comma-separated string
  company_size_factor: number; // 1 to 5 e.g.
  is_available_for_mailing: boolean;
  is_opportunity: boolean;
  entry_level_score: number; // 0-100
  premium_score: number; // 0-100
  crm_score: number; // 0-100
  conversational_score: number; // 0-100
  uf: string;
  open_city: string;
  open_country: string;
  emails_recebidos_6m: number;
  emails_abertos_6m: number;
  emails_clicados_6m: number;
  taxa_abertura_individual: number; // e.g. 0.45 for 45%
  taxa_ctor_individual: number;
  taxa_ctr_individual: number;
  dias_desde_ultimo_open?: number;
  dias_desde_ultimo_click?: number;
  idade_lead_dias: number;
}

export type LifecycleStage = 'Ativo' | 'Engajado' | 'Dormindo' | 'Frio' | 'Inativo' | 'Perdido';

export interface FunnelStats {
  totalLeads: number;
  mqls: {
    total: number;
    mktEntrada: number;
    mktPro: number;
    crm: number;
    conversas: number;
    multiProduto: number;
  };
  opps: number;
  blocked: {
    total: number;
    notAvailableForMailing: number;
    emptyName: number;
    alreadyCustomer: number;
    alreadyOpportunity: number;
    smallSizeFactor: number;
    recentChurn: number;
    publicSector: number;
  };
}

export interface LifecycleStats {
  ativo: number;
  engajado: number;
  dormindo: number;
  frio: number;
  inativo: number;
  perdido: number;
  notCalculated: number; // if last_visit_at and last_conversion_at are missing
}

export interface PersonaStats {
  decisores: number;
  naoDecisores: number;
  topCargos: { cargo: string; count: number }[];
  topOrigens: { origem: string; count: number }[];
  topSegmentos: { segmento: string; count: number }[];
  topUFs: { uf: string; count: number }[];
}

export interface LeadEngagementStats {
  receivedEmails: number;
  neverReceivedWithHighScore: number; // score > 60, zero emails
  neverEvolvedHandRaiserTrial: number; // trial/hand-raiser but not opportunity
  avgOpenRate: number;
  avgClickRate: number;
}

export interface BaseStatsSummary {
  funnel: FunnelStats;
  lifecycle: LifecycleStats;
  persona: PersonaStats;
  engagement: LeadEngagementStats;
  timestamp: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  uploadedAt: string;
  rowCount: number;
  sizeBytes: number;
  isActive?: boolean;
  stats?: BaseStatsSummary & { rowCount: number } | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  // If the message contains structured metadata response
  formattedResponse?: {
    rawText: string;
    metrics?: string;
    insight?: string;
    suggestedAction?: string;
  };
}
