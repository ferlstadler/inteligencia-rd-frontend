import { Lead, BaseStatsSummary, LifecycleStage, FunnelStats, LifecycleStats, PersonaStats, LeadEngagementStats } from '../types';

// Helper to safely parse numbers
const parseNum = (val: any, defaultVal = 0): number => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const parsed = Number(val);
  return isNaN(parsed) ? defaultVal : parsed;
};

// Helper to safely parse booleans
const parseBool = (val: any): boolean => {
  if (val === undefined || val === null) return false;
  const str = String(val).trim().toUpperCase();
  return str === 'TRUE' || str === 'T' || str === 'Y' || str === 'YES' || str === '1';
};

// Simple, robust CSV Parser
// Handles fields enclosed in quotes with nested commas or newlines
export function parseCSV(csvText: string): Lead[] {
  if (!csvText || !csvText.trim()) return [];
  
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentField = '';
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // skip next char
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      row.push(currentField);
      lines.push(row);
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add last pending field and row
  if (currentField || row.length > 0) {
    row.push(currentField);
    lines.push(row);
  }
  
  if (lines.length < 2) return [];
  
  // Find header indices
  const headers = lines[0].map(h => h.trim().toLowerCase());
  
  const leads: Lead[] = [];
  
  for (let r = 1; r < lines.length; r++) {
    const values = lines[r];
    // Skip empty lines or rows with insufficient columns
    if (values.length < 2 || (values.length === 1 && values[0] === '')) {
      continue;
    }
    
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index] !== undefined ? values[index].trim() : '';
    });
    
    // Parse tags (comma separated or enclosed in quotes or brackets)
    const parseTags = (tagStr: string): string[] => {
      if (!tagStr) return [];
      let cleaned = tagStr.replace(/[\[\]"]/g, '').trim();
      if (!cleaned) return [];
      return cleaned.split(/[,;\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
    };
    
    // Check if critical fields exist
    const contactUuid = record['contact_uuid'] || `lead_${r}`;
    const name = record['contact_name'] || '';
    
    leads.push({
      contact_uuid: contactUuid,
      created_at: record['created_at'] || '',
      last_conversion_at: record['last_conversion_at'] || undefined,
      last_visit_at: record['last_visit_at'] || undefined,
      conversions_sum: parseNum(record['conversions_sum'], 1),
      contact_name: name,
      contact_job_title: record['contact_job_title'] || record['cargo'] || '',
      contact_origin: record['contact_origin'] || record['origem'] || '',
      traffic_campaign: record['traffic_campaign'] || '',
      traffic_source: record['traffic_source'] || '',
      traffic_medium: record['traffic_medium'] || '',
      pg_tags: parseTags(record['pg_tags'] || ''),
      company_tags: parseTags(record['company_tags'] || ''),
      company_size_factor: parseNum(record['company_size_factor'], 1),
      is_available_for_mailing: parseBool(record['is_available_for_mailing'] ?? 'true'),
      is_opportunity: parseBool(record['is_opportunity']),
      entry_level_score: parseNum(record['entry_level_score'] || record['score_entrada']),
      premium_score: parseNum(record['premium_score'] || record['score_pro']),
      crm_score: parseNum(record['crm_score'] || record['score_crm']),
      conversational_score: parseNum(record['conversational_score'] || record['score_conversas']),
      uf: record['uf'] || '',
      open_city: record['open_city'] || '',
      open_country: record['open_country'] || '',
      emails_recebidos_6m: parseNum(record['emails_recebidos_6m']),
      emails_abertos_6m: parseNum(record['emails_abertos_6m']),
      emails_clicados_6m: parseNum(record['emails_clicados_6m']),
      taxa_abertura_individual: parseNum(record['taxa_abertura_individual'] || record['taxa_abertura']),
      taxa_ctor_individual: parseNum(record['taxa_ctor_individual'] || record['taxa_ctor']),
      taxa_ctr_individual: parseNum(record['taxa_ctr_individual'] || record['taxa_ctr']),
      dias_desde_ultimo_open: record['dias_desde_ultimo_open'] !== undefined && record['dias_desde_ultimo_open'] !== '' 
        ? parseNum(record['dias_desde_ultimo_open']) 
        : undefined,
      dias_desde_ultimo_click: record['dias_desde_ultimo_click'] !== undefined && record['dias_desde_ultimo_click'] !== '' 
        ? parseNum(record['dias_desde_ultimo_click']) 
        : undefined,
      idade_lead_dias: parseNum(record['idade_lead_dias'] || record['idade_dias'], 30),
    });
  }
  
  return leads;
}

// Business Rules check for MQL Blockers
export function checkBlockers(lead: Lead): { isBlocked: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // 1. is_available_for_mailing = FALSE
  if (!lead.is_available_for_mailing) {
    reasons.push('Não aceita mailing (is_available_for_mailing = FALSE)');
  }
  
  // 2. contact_name vazio ou nulo
  if (!lead.contact_name || lead.contact_name.trim() === '') {
    reasons.push('Nome do contato vazio');
  }
  
  // 3. Already a customer active
  const hasCustomerTags = lead.pg_tags.some(tag => 
    tag.includes('cliente-rds-mkt') || 
    tag.includes('cliente-rds-crm') || 
    tag.includes('mdw-blk-already-customer')
  );
  if (hasCustomerTags) {
    reasons.push('Já é cliente ativo (Tag de cliente)');
  }
  
  // 4. is_opportunity = TRUE
  if (lead.is_opportunity) {
    reasons.push('Está em oportunidade aberta no CRM (is_opportunity = TRUE)');
  }
  
  // 5. company_size_factor = 1 ou nulo
  if (lead.company_size_factor <= 1) {
    reasons.push('Empresa muito pequena ou sem tamanho (fator <= 1)');
  }
  
  // 6. Recent churn
  const hasChurnTags = lead.pg_tags.some(tag => 
    tag.includes('churn-cliente-rds-mkt') || 
    tag.includes('churn-cliente-rds-crm')
  );
  if (hasChurnTags) {
    reasons.push('Churn recente (Tag de churn)');
  }
  
  // 7. Government or Public Sector
  const hasGovTags = lead.company_tags.some(tag => 
    tag.includes('governo') || 
    tag.includes('setor-publico') || 
    tag.includes('setor publico') || 
    tag.includes('publico')
  );
  if (hasGovTags) {
    reasons.push('Setor público ou governo');
  }
  
  return {
    isBlocked: reasons.length > 0,
    reasons
  };
}

// Evaluate MQL status and assign product category
export function checkMQL(lead: Lead): { isMQL: boolean; product?: string; blockers: string[] } {
  const { isBlocked, reasons } = checkBlockers(lead);
  
  // A lead is MQL when:
  // - Teve uma nova conversão (represented by last_conversion_at is present/not empty)
  // - Tem score de fit > 60 em pelo menos um produto
  // - Não tem nenhum bloqueio ativo
  
  const hasConversion = !!lead.last_conversion_at;
  
  const hasScore = 
    lead.entry_level_score > 60 || 
    lead.premium_score > 60 || 
    lead.crm_score > 60 || 
    lead.conversational_score > 60;
    
  const isMQL = hasConversion && hasScore && !isBlocked;
  
  if (!isMQL) {
    return { isMQL: false, blockers: reasons };
  }
  
  // Determine product classification
  const activeScores: string[] = [];
  if (lead.entry_level_score > 60) activeScores.push('MKT Entrada');
  if (lead.premium_score > 60) activeScores.push('MKT Pro');
  if (lead.crm_score > 60) activeScores.push('CRM');
  if (lead.conversational_score > 60) activeScores.push('Conversas');
  
  let product = 'Multi-produto';
  if (activeScores.length === 1) {
    product = activeScores[0];
  } else if (activeScores.length === 0) {
    product = 'Nenhum';
  }
  
  return {
    isMQL: true,
    product,
    blockers: []
  };
}

// Calculate lifecycle stage
// Reference Date: 2026-05-27
export function getLifecycleStage(lead: Lead, referenceDateStr = '2026-05-27'): LifecycleStage | 'Não Calculado' {
  if (!lead.last_visit_at && !lead.last_conversion_at) {
    return 'Não Calculado';
  }
  
  const refDate = new Date(referenceDateStr);
  
  let lastSignalDate: Date | null = null;
  
  if (lead.last_visit_at) {
    lastSignalDate = new Date(lead.last_visit_at);
  }
  
  if (lead.last_conversion_at) {
    const convDate = new Date(lead.last_conversion_at);
    if (!lastSignalDate || convDate > lastSignalDate) {
      lastSignalDate = convDate;
    }
  }
  
  if (!lastSignalDate) return 'Não Calculado';
  
  const diffTime = Math.abs(refDate.getTime() - lastSignalDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 15) return 'Ativo';
  if (diffDays <= 30) return 'Engajado';
  if (diffDays <= 60) return 'Dormindo';
  if (diffDays <= 90) return 'Frio';
  if (diffDays <= 180) return 'Inativo';
  return 'Perdido';
}

// Compute the complete statistics summary for a lead list
export function calculateStats(leads: Lead[], referenceDateStr = '2026-05-27'): BaseStatsSummary {
  const lifecycle: LifecycleStats = { ativo: 0, engajado: 0, dormindo: 0, frio: 0, inativo: 0, perdido: 0, notCalculated: 0 };
  const funnel: FunnelStats = {
    totalLeads: leads.length,
    mqls: { total: 0, mktEntrada: 0, mktPro: 0, crm: 0, conversas: 0, multiProduto: 0 },
    opps: 0,
    blocked: { total: 0, notAvailableForMailing: 0, emptyName: 0, alreadyCustomer: 0, alreadyOpportunity: 0, smallSizeFactor: 0, recentChurn: 0, publicSector: 0 }
  };
  
  const jobsMap: Record<string, number> = {};
  const originsMap: Record<string, number> = {};
  const segmentsMap: Record<string, number> = {};
  const ufsMap: Record<string, number> = {};
  
  let decisores = 0;
  let naoDecisores = 0;
  
  let emailsRecebidosTotal = 0;
  let numLeadsInReceivedEmails = 0;
  let neverReceivedWithHighScore = 0;
  let neverEvolvedHandRaiserTrial = 0;
  
  let totalOpenRate = 0;
  let totalClickRate = 0;
  let rateCount = 0;
  
  leads.forEach(lead => {
    // 1. Funnel Stats
    const mqlInfo = checkMQL(lead);
    if (mqlInfo.isMQL) {
      funnel.mqls.total++;
      if (mqlInfo.product === 'MKT Entrada') funnel.mqls.mktEntrada++;
      else if (mqlInfo.product === 'MKT Pro') funnel.mqls.mktPro++;
      else if (mqlInfo.product === 'CRM') funnel.mqls.crm++;
      else if (mqlInfo.product === 'Conversas') funnel.mqls.conversas++;
      else if (mqlInfo.product === 'Multi-produto') funnel.mqls.multiProduto++;
    }
    
    if (lead.is_opportunity) {
      funnel.opps++;
    }
    
    // Check specific blockers
    const blockersInfo = checkBlockers(lead);
    if (blockersInfo.isBlocked) {
      funnel.blocked.total++;
      
      if (!lead.is_available_for_mailing) funnel.blocked.notAvailableForMailing++;
      if (!lead.contact_name || lead.contact_name.trim() === '') funnel.blocked.emptyName++;
      
      const hasCustomerTags = lead.pg_tags.some(tag => tag.includes('cliente-rds-mkt') || tag.includes('cliente-rds-crm') || tag.includes('mdw-blk-already-customer'));
      if (hasCustomerTags) funnel.blocked.alreadyCustomer++;
      
      if (lead.is_opportunity) funnel.blocked.alreadyOpportunity++;
      if (lead.company_size_factor <= 1) funnel.blocked.smallSizeFactor++;
      
      const hasChurnTags = lead.pg_tags.some(tag => tag.includes('churn-cliente-rds-mkt') || tag.includes('churn-cliente-rds-crm'));
      if (hasChurnTags) funnel.blocked.recentChurn++;
      
      const hasGovTags = lead.company_tags.some(tag => tag.includes('governo') || tag.includes('setor-publico') || tag.includes('setor publico') || tag.includes('publico'));
      if (hasGovTags) funnel.blocked.publicSector++;
    }
    
    // 2. Lifecycle Stats
    const stage = getLifecycleStage(lead, referenceDateStr);
    if (stage === 'Ativo') lifecycle.ativo++;
    else if (stage === 'Engajado') lifecycle.engajado++;
    else if (stage === 'Dormindo') lifecycle.dormindo++;
    else if (stage === 'Frio') lifecycle.frio++;
    else if (stage === 'Inativo') lifecycle.inativo++;
    else if (stage === 'Perdido') lifecycle.perdido++;
    else lifecycle.notCalculated++;
    
    // 3. Personas
    const titleClean = (lead.contact_job_title || 'Não Definido').trim();
    jobsMap[titleClean] = (jobsMap[titleClean] || 0) + 1;
    
    const originClean = (lead.contact_origin || 'Desconhecida').trim();
    originsMap[originClean] = (originsMap[originClean] || 0) + 1;
    
    const ufClean = (lead.uf || 'Ignorado').trim().toUpperCase();
    ufsMap[ufClean] = (ufsMap[ufClean] || 0) + 1;
    
    lead.company_tags.forEach(tag => {
      // Find segments
      segmentsMap[tag] = (segmentsMap[tag] || 0) + 1;
    });
    
    // Decisor criteria: tag 'perfil-decisor' or cargo keyword
    const isDecisor = lead.pg_tags.includes('perfil-decisor') || 
      /diretor|gerente|vp|ceo|c-level|founder|proprietario|socio|co-ofundador/i.test(lead.contact_job_title);
    if (isDecisor) {
      decisores++;
    } else {
      naoDecisores++;
    }
    
    // 4. Engagement Stats
    emailsRecebidosTotal += lead.emails_recebidos_6m;
    if (lead.emails_recebidos_6m > 0) {
      numLeadsInReceivedEmails++;
      totalOpenRate += lead.taxa_abertura_individual;
      totalClickRate += lead.taxa_ctr_individual;
      rateCount++;
    }
    
    // Never received email but has high score (>60)
    const hasHighScore = lead.entry_level_score > 60 || lead.premium_score > 60 || lead.crm_score > 60 || lead.conversational_score > 60;
    if (lead.emails_recebidos_6m === 0 && hasHighScore && lead.is_available_for_mailing) {
      neverReceivedWithHighScore++;
    }
    
    // Hand Raiser / Trial not evolved (not won, not opportunity)
    const isHandRaiserOrTrial = /hand[\s-]*raiser|levantada[\s-]*de[\s-]*mao|trial|teste/i.test(lead.contact_origin);
    const hasEvolved = lead.is_opportunity || lead.pg_tags.some(tag => tag.includes('cliente') || tag.includes('already-customer'));
    if (isHandRaiserOrTrial && !hasEvolved) {
      neverEvolvedHandRaiserTrial++;
    }
  });
  
  // Sort and top distributions
  const getSortedArray = (map: Record<string, number>, limit = 5) => {
    return Object.entries(map)
      .map(([name, count]) => ({ cargo: name, count })) // using cargo alias
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  };
  
  const topCargos = getSortedArray(jobsMap, 5);
  const topOrigens = Object.entries(originsMap).map(([k, v]) => ({ origem: k, count: v })).sort((a,b)=>b.count-a.count).slice(0, 5);
  const topSegmentos = Object.entries(segmentsMap).map(([k, v]) => ({ segmento: k, count: v })).sort((a,b)=>b.count-a.count).slice(0, 5);
  const topUFs = Object.entries(ufsMap).map(([k, v]) => ({ uf: k, count: v })).sort((a,b)=>b.count-a.count).slice(0, 5);
  
  const persona: PersonaStats = {
    decisores,
    naoDecisores,
    topCargos,
    topOrigens,
    topSegmentos,
    topUFs
  };
  
  const engagement: LeadEngagementStats = {
    receivedEmails: leads.filter(l => l.emails_recebidos_6m > 0).length,
    neverReceivedWithHighScore,
    neverEvolvedHandRaiserTrial,
    avgOpenRate: rateCount > 0 ? (totalOpenRate / rateCount) : 0,
    avgClickRate: rateCount > 0 ? (totalClickRate / rateCount) : 0
  };
  
  return {
    funnel,
    lifecycle,
    persona,
    engagement,
    timestamp: referenceDateStr
  };
}

// Generate Raw Sample CSV text
export function generateSampleCSV(): string {
  const headers = [
    'contact_uuid', 'created_at', 'last_conversion_at', 'last_visit_at', 'conversions_sum',
    'contact_name', 'contact_job_title', 'contact_origin', 'traffic_campaign', 'traffic_source', 'traffic_medium',
    'pg_tags', 'company_tags', 'company_size_factor', 'is_available_for_mailing', 'is_opportunity',
    'entry_level_score', 'premium_score', 'crm_score', 'conversational_score', 'uf', 'open_city', 'open_country',
    'emails_recebidos_6m', 'emails_abertos_6m', 'emails_clicados_6m', 'taxa_abertura_individual', 'taxa_ctor_individual', 'taxa_ctr_individual',
    'dias_desde_ultimo_open', 'dias_desde_ultimo_click', 'idade_lead_dias'
  ];
  
  // High fidelity realistic leads matching rules
  const leadsRaw = [
    // --- ACTIVE MQL LEADS (No blocks, conversion within 15 days, score > 60) ---
    {
      contact_uuid: 'uuid-mql-1',
      created_at: '2026-04-10T10:00:00Z',
      last_conversion_at: '2026-05-20T14:30:00Z', // 7 days ago
      last_visit_at: '2026-05-24T16:00:00Z', // 3 days ago
      conversions_sum: '5',
      contact_name: 'Rodrigo Pinto Mendonça',
      contact_job_title: 'Diretor de Marketing',
      contact_origin: 'Hand Raiser - Levantada de Mao',
      traffic_campaign: 'br-display-leads-mkt',
      traffic_source: 'google',
      traffic_medium: 'cpc',
      pg_tags: 'perfil-decisor,base-rdsm,mdw-blk-ls-warm-lead',
      company_tags: 'tecnologia,segmento-b2b',
      company_size_factor: '3',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '85', // > 60
      premium_score: '10',
      crm_score: '15',
      conversational_score: '0',
      uf: 'SP',
      open_city: 'São Paulo',
      open_country: 'Brasil',
      emails_recebidos_6m: '12',
      emails_abertos_6m: '8',
      emails_clicados_6m: '4',
      taxa_abertura_individual: '0.66',
      taxa_ctor_individual: '0.50',
      taxa_ctr_individual: '0.33',
      dias_desde_ultimo_open: '3',
      dias_desde_ultimo_click: '4',
      idade_lead_dias: '47'
    },
    {
      contact_uuid: 'uuid-mql-2',
      created_at: '2026-03-01T08:00:00Z',
      last_conversion_at: '2026-05-25T11:00:00Z', // 2 days ago
      last_visit_at: '2026-05-25T11:15:00Z', // 2 days ago
      conversions_sum: '4',
      contact_name: 'Ana Souza Fonseca',
      contact_job_title: 'Gerente Comercial',
      contact_origin: 'Inbound - Trial Pro',
      traffic_campaign: 'trial-crm-leadgen',
      traffic_source: 'linkedin',
      traffic_medium: 'paid',
      pg_tags: 'perfil-decisor,base-crm,mdw-blk-ls-warm-lead',
      company_tags: 'varejo,e-commerce',
      company_size_factor: '4',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '20',
      premium_score: '25',
      crm_score: '92', // CRM MQL
      conversational_score: '30',
      uf: 'RJ',
      open_city: 'Rio de Janeiro',
      open_country: 'Brasil',
      emails_recebidos_6m: '22',
      emails_abertos_6m: '18',
      emails_clicados_6m: '10',
      taxa_abertura_individual: '0.81',
      taxa_ctor_individual: '0.55',
      taxa_ctr_individual: '0.45',
      dias_desde_ultimo_open: '2',
      dias_desde_ultimo_click: '2',
      idade_lead_dias: '87'
    },
    {
      contact_uuid: 'uuid-mql-3',
      created_at: '2026-05-10T12:00:00Z',
      last_conversion_at: '2026-05-18T10:00:00Z', // 9 days ago
      last_visit_at: '2026-05-18T10:05:00Z',
      conversions_sum: '2',
      contact_name: 'Fernanda Stadler Cabral',
      contact_job_title: 'Head de Growth',
      contact_origin: 'Inbound - Webinar',
      traffic_campaign: 'webinar-ia-lifecycle',
      traffic_source: 'organic',
      traffic_medium: 'social',
      pg_tags: 'base-rds-conversas,perfil-decisor',
      company_tags: 'saaS,tecnologia',
      company_size_factor: '5',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '75', // MKT Entrada
      premium_score: '80', // MKT Pro
      crm_score: '45',
      conversational_score: '85', // Conversas (Multi-produto!)
      uf: 'SC',
      open_city: 'Florianópolis',
      open_country: 'Brasil',
      emails_recebidos_6m: '4',
      emails_abertos_6m: '4',
      emails_clicados_6m: '2',
      taxa_abertura_individual: '1.0',
      taxa_ctor_individual: '0.50',
      taxa_ctr_individual: '0.50',
      dias_desde_ultimo_open: '9',
      dias_desde_ultimo_click: '9',
      idade_lead_dias: '17'
    },
    
    // --- COLD MQL LEADS (Opportunities Lost / Missed opportunity) ---
    // MQL but inactive (last signal > 60 or 90 days ago) - high score, no blocks
    {
      contact_uuid: 'uuid-mql-cold-1',
      created_at: '2025-11-20T10:00:00Z',
      last_conversion_at: '2026-03-10T12:00:00Z', // 78 days ago (Frio)
      last_visit_at: '2026-03-05T09:00:00Z',
      conversions_sum: '7',
      contact_name: 'Carlos Santos Reis',
      contact_job_title: 'Sócio-Diretor',
      contact_origin: 'Ebook Conversões',
      traffic_campaign: 'ebook-funil',
      traffic_source: 'google',
      traffic_medium: 'organic',
      pg_tags: 'perfil-decisor,base-rdsm',
      company_tags: 'educacao,escola',
      company_size_factor: '2',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '95', // High Score
      premium_score: '10',
      crm_score: '20',
      conversational_score: '0',
      uf: 'MG',
      open_city: 'Belo Horizonte',
      open_country: 'Brasil',
      emails_recebidos_6m: '30',
      emails_abertos_6m: '15',
      emails_clicados_6m: '5',
      taxa_abertura_individual: '0.50',
      taxa_ctor_individual: '0.33',
      taxa_ctr_individual: '0.16',
      dias_desde_ultimo_open: '40',
      dias_desde_ultimo_click: '60',
      idade_lead_dias: '188'
    },
    {
      contact_uuid: 'uuid-mql-cold-2',
      created_at: '2025-10-15T08:00:00Z',
      last_conversion_at: '2026-01-20T14:00:00Z', // 127 days ago (Inativo)
      last_visit_at: '2026-01-18T10:00:00Z',
      conversions_sum: '12',
      contact_name: 'Mariana Lima Barros',
      contact_job_title: 'Gerente Executiva',
      contact_origin: 'Trial Pro Marketing',
      traffic_campaign: 'trial-mkt-ads',
      traffic_source: 'facebook',
      traffic_medium: 'ads',
      pg_tags: 'perfil-decisor,base-rdsm,mdw-blk-ls-warm-lead',
      company_tags: 'saude,clinica',
      company_size_factor: '3',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '40',
      premium_score: '88', // High score
      crm_score: '30',
      conversational_score: '15',
      uf: 'RS',
      open_city: 'Porto Alegre',
      open_country: 'Brasil',
      emails_recebidos_6m: '50',
      emails_abertos_6m: '20',
      emails_clicados_6m: '2',
      taxa_abertura_individual: '0.40',
      taxa_ctor_individual: '0.10',
      taxa_ctr_individual: '0.04',
      dias_desde_ultimo_open: '120',
      dias_desde_ultimo_click: '125',
      idade_lead_dias: '224'
    },

    // --- BLOCKED LEADS (High score but blocked) ---
    {
      contact_uuid: 'uuid-blocked-1',
      created_at: '2026-04-12T09:00:00Z',
      last_conversion_at: '2026-05-22T10:00:00Z',
      last_visit_at: '2026-05-22T10:05:00Z',
      conversions_sum: '3',
      contact_name: 'Juliana Pires',
      contact_job_title: 'C-Level / Diretora',
      contact_origin: 'Inbound - Webinar',
      traffic_campaign: 'webinar-chat',
      traffic_source: 'google',
      traffic_medium: 'organic',
      pg_tags: 'cliente-rds-mkt,perfil-decisor', // BLOCKED: already customer of Marketing
      company_tags: 'tecnologia,software',
      company_size_factor: '3',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '99', // Fit is amazing
      premium_score: '85',
      crm_score: '10',
      conversational_score: '50',
      uf: 'PR',
      open_city: 'Curitiba',
      open_country: 'Brasil',
      emails_recebidos_6m: '15',
      emails_abertos_6m: '14',
      emails_clicados_6m: '8',
      taxa_abertura_individual: '0.93',
      taxa_ctor_individual: '0.57',
      taxa_ctr_individual: '0.53',
      dias_desde_ultimo_open: '1',
      dias_desde_ultimo_click: '1',
      idade_lead_dias: '45'
    },
    {
      contact_uuid: 'uuid-blocked-2',
      created_at: '2026-04-20T08:00:00Z',
      last_conversion_at: '2026-05-24T15:00:00Z',
      last_visit_at: '2026-05-24T15:10:00Z',
      conversions_sum: '6',
      contact_name: 'Eduardo Martins Braga',
      contact_job_title: 'Coordenador',
      contact_origin: 'Contate Vendas',
      traffic_campaign: 'direct-sales',
      traffic_source: 'direct',
      traffic_medium: 'none',
      pg_tags: 'base-crm,mdw-blk-ls-warm-lead',
      company_tags: 'servicos,consultoria',
      company_size_factor: '1', // BLOCKED: size factor = 1 (very small)
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '15',
      premium_score: '10',
      crm_score: '85', // fit score > 60
      conversational_score: '90',
      uf: 'DF',
      open_city: 'Brasília',
      open_country: 'Brasil',
      emails_recebidos_6m: '8',
      emails_abertos_6m: '5',
      emails_clicados_6m: '2',
      taxa_abertura_individual: '0.62',
      taxa_ctor_individual: '0.40',
      taxa_ctr_individual: '0.25',
      dias_desde_ultimo_open: '3',
      dias_desde_ultimo_click: '3',
      idade_lead_dias: '37'
    },
    {
      contact_uuid: 'uuid-blocked-3',
      created_at: '2026-04-01T10:00:00Z',
      last_conversion_at: '2026-05-25T09:00:00Z',
      last_visit_at: '2026-05-25T09:10:00Z',
      conversions_sum: '1',
      contact_name: '', // BLOCKED: Name is empty
      contact_job_title: 'Analista Pleno',
      contact_origin: 'Kit de Templates',
      traffic_campaign: 'kits-promocionais',
      traffic_source: 'newsletter',
      traffic_medium: 'email',
      pg_tags: 'base-rdsm',
      company_tags: 'agencia,marketing',
      company_size_factor: '2',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '65', // fit Score MKT Entrada
      premium_score: '20',
      crm_score: '20',
      conversational_score: '10',
      uf: 'BA',
      open_city: 'Salvador',
      open_country: 'Brasil',
      emails_recebidos_6m: '2',
      emails_abertos_6m: '1',
      emails_clicados_6m: '0',
      taxa_abertura_individual: '0.50',
      taxa_ctor_individual: '0.0',
      taxa_ctr_individual: '0.0',
      dias_desde_ultimo_open: '2',
      dias_desde_ultimo_click: '-1', // undefined basically
      idade_lead_dias: '56'
    },
    {
      contact_uuid: 'uuid-blocked-4',
      created_at: '2026-03-15T11:00:00Z',
      last_conversion_at: '2026-05-18T16:00:00Z',
      last_visit_at: '2026-05-18T16:15:00Z',
      conversions_sum: '4',
      contact_name: 'Aline de Oliveira Dias',
      contact_job_title: 'Gerente Tributária',
      contact_origin: 'Inbound - Webinar',
      traffic_campaign: 'webinar-mkt',
      traffic_source: 'organic',
      traffic_medium: 'seo',
      pg_tags: 'base-rdsm,churn-cliente-rds-mkt', // BLOCKED: churn-cliente-rds-mkt
      company_tags: 'governo,setor publico', // BLOCKED: public sector company
      company_size_factor: '4',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '70', // fit > 60
      premium_score: '72',
      crm_score: '30',
      conversational_score: '10',
      uf: 'GO',
      open_city: 'Goiânia',
      open_country: 'Brasil',
      emails_recebidos_6m: '14',
      emails_abertos_6m: '10',
      emails_clicados_6m: '3',
      taxa_abertura_individual: '0.71',
      taxa_ctor_individual: '0.30',
      taxa_ctr_individual: '0.21',
      dias_desde_ultimo_open: '9',
      dias_desde_ultimo_click: '10',
      idade_lead_dias: '73'
    },
    {
      contact_uuid: 'uuid-blocked-5',
      created_at: '2026-05-02T10:00:00Z',
      last_conversion_at: '2026-05-26T10:00:00Z',
      last_visit_at: '2026-05-26T10:10:00Z',
      conversions_sum: '3',
      contact_name: 'Gabriel Castro Nunes',
      contact_job_title: 'Supervisor CRM',
      contact_origin: 'Inbound - Trial CRM',
      traffic_campaign: 'trial-crm-search',
      traffic_source: 'google',
      traffic_medium: 'cpc',
      pg_tags: 'base-crm,mdw-blk-ls-warm-lead',
      company_tags: 'financas,banco',
      company_size_factor: '5',
      is_available_for_mailing: 'FALSE', // BLOCKED: unsubscribed / email bounce
      is_opportunity: 'FALSE',
      entry_level_score: '45',
      premium_score: '30',
      crm_score: '88', // High fit but unsubscribed
      conversational_score: '75',
      uf: 'SP',
      open_city: 'Campinas',
      open_country: 'Brasil',
      emails_recebidos_6m: '6',
      emails_abertos_6m: '0',
      emails_clicados_6m: '0',
      taxa_abertura_individual: '0.0',
      taxa_ctor_individual: '0.0',
      taxa_ctr_individual: '0.0',
      dias_desde_ultimo_open: '-1',
      dias_desde_ultimo_click: '-1',
      idade_lead_dias: '25'
    },

    // --- OPPORTUNITY STATE LEADS (MQL but is_opportunity = TRUE) ---
    {
      contact_uuid: 'uuid-opp-1',
      created_at: '2026-02-10T14:00:00Z',
      last_conversion_at: '2026-05-26T09:00:00Z',
      last_visit_at: '2026-05-26T09:20:00Z',
      conversions_sum: '9',
      contact_name: 'Patricia Guedes Ramos',
      contact_job_title: 'Diretora de Operações',
      contact_origin: 'Atendimento Consultivo',
      traffic_campaign: 'opp-generation-mkt',
      traffic_source: 'salesforce',
      traffic_medium: 'sales',
      pg_tags: 'perfil-decisor,base-rdsm,mdw-is-open-deal',
      company_tags: 'industria,manufatura',
      company_size_factor: '4',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'TRUE', // BLOCKED: Already in sales process
      entry_level_score: '40',
      premium_score: '90', // fit pro
      crm_score: '35',
      conversational_score: '30',
      uf: 'SC',
      open_city: 'Joinville',
      open_country: 'Brasil',
      emails_recebidos_6m: '28',
      emails_abertos_6m: '25',
      emails_clicados_6m: '18',
      taxa_abertura_individual: '0.89',
      taxa_ctor_individual: '0.72',
      taxa_ctr_individual: '0.64',
      dias_desde_ultimo_open: '1',
      dias_desde_ultimo_click: '1',
      idade_lead_dias: '106'
    },

    // --- LEADS WITH HIGH FIT BUT NO EMAIL ENGAGEMENT (Is Available for Mailing = TRUE, email receivedCount = 0) ---
    {
      contact_uuid: 'uuid-no-email-1',
      created_at: '2026-05-15T09:00:00Z',
      last_conversion_at: '2026-05-15T09:05:00Z', // 12 days ago (Ativo)
      last_visit_at: '2026-05-15T09:05:00Z',
      conversions_sum: '1',
      contact_name: 'Bruno Meireles',
      contact_job_title: 'CEO',
      contact_origin: 'Inbound - Trial Pro',
      traffic_campaign: 'trial-promo',
      traffic_source: 'direct',
      traffic_medium: 'direct',
      pg_tags: 'perfil-decisor,base-rdsm',
      company_tags: 'tecnologia',
      company_size_factor: '3',
      is_available_for_mailing: 'TRUE', // can receive email!
      is_opportunity: 'FALSE',
      entry_level_score: '75', // MQL
      premium_score: '65',
      crm_score: '30',
      conversational_score: '20',
      uf: 'SP',
      open_city: 'Santos',
      open_country: 'Brasil',
      emails_recebidos_6m: '0', // NEVER RECEIVED A SINGLE EMAIL!
      emails_abertos_6m: '0',
      emails_clicados_6m: '0',
      taxa_abertura_individual: '0.0',
      taxa_ctor_individual: '0.0',
      taxa_ctr_individual: '0.0',
      dias_desde_ultimo_open: '-1',
      dias_desde_ultimo_click: '-1',
      idade_lead_dias: '12'
    },

    // --- UNCONVERTED HAND RAISER / TRIAL (Origin matches but is_opportunity = FALSE and not customer) ---
    {
      contact_uuid: 'uuid-trial-stuck-1',
      created_at: '2026-04-20T10:00:00Z',
      last_conversion_at: '2026-04-20T10:30:00Z', // 37 days ago (Dormindo)
      last_visit_at: '2026-04-22T14:00:00Z', // 35 days ago (Dormindo)
      conversions_sum: '1',
      contact_name: 'Sabrina Gouveia Neves',
      contact_job_title: 'Analista de Inbound',
      contact_origin: 'Inbound - Trial Pro', // Trial but stuck!
      traffic_campaign: 'trial-acquisition',
      traffic_source: 'instagram',
      traffic_medium: 'ads',
      pg_tags: 'base-rdsm',
      company_tags: 'varejo',
      company_size_factor: '2',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE', // has not evolved into opportunities
      entry_level_score: '80', // Entry marketing high score!
      premium_score: '15',
      crm_score: '10',
      conversational_score: '10',
      uf: 'RJ',
      open_city: 'Niterói',
      open_country: 'Brasil',
      emails_recebidos_6m: '5',
      emails_abertos_6m: '2',
      emails_clicados_6m: '0',
      taxa_abertura_individual: '0.40',
      taxa_ctor_individual: '0.0',
      taxa_ctr_individual: '0.0',
      dias_desde_ultimo_open: '25',
      dias_desde_ultimo_click: '-1',
      idade_lead_dias: '37'
    },

    // --- NORMAL ENGAGED/DORMAN/LOST STANDARD LEADS (Score < 60, regular leads) ---
    {
      contact_uuid: 'uuid-std-1',
      created_at: '2026-05-10T11:00:00Z',
      last_conversion_at: '2026-05-11T16:00:00Z', // 16 days ago (Engajado / border active)
      last_visit_at: '2026-05-11T16:10:00Z',
      conversions_sum: '2',
      contact_name: 'Marcos Azevedo Toledo',
      contact_job_title: 'Autônomo',
      contact_origin: 'Pesquisa Google',
      traffic_campaign: 'institucional',
      traffic_source: 'google',
      traffic_medium: 'organic',
      pg_tags: 'base-rdsm',
      company_tags: 'servicos',
      company_size_factor: '2',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '35', // low score
      premium_score: '15',
      crm_score: '10',
      conversational_score: '5',
      uf: 'ES',
      open_city: 'Vitória',
      open_country: 'Brasil',
      emails_recebidos_6m: '2',
      emails_abertos_6m: '1',
      emails_clicados_6m: '1',
      taxa_abertura_individual: '0.50',
      taxa_ctor_individual: '1.0',
      taxa_ctr_individual: '0.50',
      dias_desde_ultimo_open: '14',
      dias_desde_ultimo_click: '14',
      idade_lead_dias: '17'
    },
    {
      contact_uuid: 'uuid-std-2',
      created_at: '2026-04-05T12:00:00Z',
      last_conversion_at: '2026-04-10T15:00:00Z', // 47 days ago (Dormindo)
      last_visit_at: '2026-04-12T10:00:00Z', // 45 days ago
      conversions_sum: '2',
      contact_name: 'Julio Cesar Peixoto',
      contact_job_title: 'Coordenador Comercial',
      contact_origin: 'Inbound - Webinar',
      traffic_campaign: 'webinar-vendas',
      traffic_source: 'google',
      traffic_medium: 'organic',
      pg_tags: 'base-crm',
      company_tags: 'constritora,imobiliaria',
      company_size_factor: '2',
      is_available_for_mailing: 'TRUE',
      is_opportunity: 'FALSE',
      entry_level_score: '20',
      premium_score: '15',
      crm_score: '45', // score < 60
      conversational_score: '10',
      uf: 'SP',
      open_city: 'Sorocaba',
      open_country: 'Brasil',
      emails_recebidos_6m: '8',
      emails_abertos_6m: '3',
      emails_clicados_6m: '1',
      taxa_abertura_individual: '0.375',
      taxa_ctor_individual: '0.33',
      taxa_ctr_individual: '0.125',
      dias_desde_ultimo_open: '30',
      dias_desde_ultimo_click: '35',
      idade_lead_dias: '52'
    }
  ];

  // Let's inflate it to 100 leads dynamically to make it a wonderful robust demo database!
  const cargoPool = ['Gerente de Marketing', 'Diretor Comercial', 'Coordenador de Vendas', 'Head of Sales', 'Analista de Marketing', 'CEO & Founder', 'Sócio Proprietário', 'Consultor Independente', 'Gerente Executivo', 'Analista CRM'];
  const origensPool = ['Google Pesquisa', 'Organic Social', 'Anúncios Meta', 'Newsletter', 'Webinar Co-marketing', 'Indicação Parcerias', 'Download Ebook', 'Youtube Canal', 'Levantada de Mão Pro', 'Inbound - Trial Pro'];
  const ufPool = ['SP', 'RJ', 'MG', 'SC', 'PR', 'RS', 'DF', 'BA', 'PE', 'CE', 'ES', 'GO'];
  const segmentPool = ['saas,tecnologia', 'varejo,e-commerce', 'agencia,marketing', 'servicos,consultoria', 'educacao,escola', 'industria,manufatura', 'saude,clinica', 'financas,banco'];
  
  const ufNames: Record<string, string> = {
    SP: 'São Paulo', RJ: 'Rio de Janeiro', MG: 'Belo Horizonte', SC: 'Florianópolis', PR: 'Curitiba',
    RS: 'Porto Alegre', DF: 'Brasília', BA: 'Salvador', PE: 'Recife', CE: 'Fortaleza', ES: 'Vitória', GO: 'Goiânia'
  };

  const leadsList: any[] = [...leadsRaw];
  
  // Add 100 more random but realistic records to reach 115+ leads
  for (let i = 1; i <= 100; i++) {
    const isMailing = Math.random() > 0.08; // 8% unsubscribe
    const ufSelected = ufPool[i % ufPool.length];
    const citySelected = ufNames[ufSelected];
    const rawCargo = cargoPool[i % cargoPool.length];
    const originSelected = origensPool[i % origensPool.length];
    
    // Scores
    const entryScore = Math.floor(Math.random() * 85);
    const premiumScoreVal = Math.floor(Math.random() * 75);
    const crmScoreVal = Math.floor(Math.random() * 80);
    const convScore = Math.floor(Math.random() * 65);
    
    // Decisor keyword or tag
    const isDecisorCargo = /diretor|gerente|head|ceo|socio/i.test(rawCargo);
    const ptags = ['base-rdsm'];
    if (isDecisorCargo && Math.random() > 0.3) {
      ptags.push('perfil-decisor');
    }
    
    // Some are customers (5% chance)
    if (Math.random() < 0.05) {
      ptags.push('cliente-rds-mkt');
    } else if (Math.random() < 0.03) {
      ptags.push('mdw-blk-already-customer');
    }
    
    // Size factor from 1 to 5
    const sizeFactor = Math.floor(Math.random() * 5) + 1;
    
    // Opportunity?
    const isOpp = Math.random() < 0.08; // 8% chance of open deal
    
    // Dates calculation for activity
    // Reference date: 2026-05-27
    // Create varying signals
    const daysAgo = Math.floor(Math.random() * 210); // up to 210 days ago (some lost)
    const createdDaysAgo = daysAgo + Math.floor(Math.random() * 100) + 10;
    
    const signalDate = new Date('2026-05-27');
    signalDate.setDate(signalDate.getDate() - daysAgo);
    const signalDateStr = signalDate.toISOString().split('T')[0] + 'T09:00:00Z';
    
    const createdDate = new Date('2026-05-27');
    createdDate.setDate(createdDate.getDate() - createdDaysAgo);
    const createdDateStr = createdDate.toISOString().split('T')[0] + 'T08:00:00Z';
    
    // conversions sum
    const conversionsSumVal = Math.floor(Math.random() * 4) + 1;
    
    // Emails
    const recv = Math.floor(Math.random() * 20);
    const open = Math.floor(Math.random() * (recv + 1));
    const click = Math.floor(Math.random() * (open + 1));
    
    const openRate = recv > 0 ? Number((open / recv).toFixed(2)) : 0;
    const ctrRate = recv > 0 ? Number((click / recv).toFixed(2)) : 0;
    const ctorRate = open > 0 ? Number((click / open).toFixed(2)) : 0;
    
    // Check if it will be an MQL
    // Under criteria:
    // - conversion date exists (it always does)
    // - score > 60 in at least one score
    // - no blockers:
    const hasScoreOver60 = entryScore > 60 || premiumScoreVal > 60 || crmScoreVal > 60 || convScore > 60;
    
    // Set public sector/government sector tag on companies occasionally (5% chance)
    const companyTag = segmentPool[i % segmentPool.length];
    const isGov = Math.random() < 0.05;
    const companyTagsFinal = isGov ? companyTag + ',governo,setor publico' : companyTag;
    
    leadsList.push({
      contact_uuid: `uuid-gen-${i}`,
      created_at: createdDateStr,
      last_conversion_at: signalDateStr,
      last_visit_at: signalDateStr,
      conversions_sum: conversionsSumVal,
      contact_name: `Lead Gen ${i}`,
      contact_job_title: rawCargo,
      contact_origin: originSelected,
      traffic_campaign: i % 2 === 0 ? 'lead-magnet-2026' : 'branding-awareness',
      traffic_source: i % 3 === 0 ? 'google' : (i % 3 === 1 ? 'linkedin' : 'newsletter_rd'),
      traffic_medium: i % 3 === 0 ? 'cpc' : (i % 3 === 1 ? 'paid' : 'email'),
      pg_tags: ptags,
      company_tags: companyTagsFinal.split(','),
      company_size_factor: sizeFactor,
      is_available_for_mailing: isMailing,
      is_opportunity: isOpp,
      entry_level_score: entryScore,
      premium_score: premiumScoreVal,
      crm_score: crmScoreVal,
      conversational_score: convScore,
      uf: ufSelected,
      open_city: citySelected,
      open_country: 'Brasil',
      emails_recebidos_6m: recv,
      emails_abertos_6m: open,
      emails_clicados_6m: click,
      taxa_abertura_individual: openRate,
      taxa_ctor_individual: ctorRate,
      taxa_ctr_individual: ctrRate,
      dias_desde_ultimo_open: recv > 0 ? Math.floor(Math.random() * daysAgo) : undefined,
      dias_desde_ultimo_click: click > 0 ? Math.floor(Math.random() * daysAgo) : undefined,
      idade_lead_dias: createdDaysAgo
    });
  }
  
  // Format to CSV string
  const csvLines = [headers.join(',')];
  leadsList.forEach((lead: any) => {
    const pgTagsStr = `"${Array.isArray(lead.pg_tags) ? lead.pg_tags.join(',') : String(lead.pg_tags || '')}"`;
    const companyTagsStr = `"${Array.isArray(lead.company_tags) ? lead.company_tags.join(',') : String(lead.company_tags || '')}"`;
    
    const row = [
      lead.contact_uuid,
      lead.created_at,
      lead.last_conversion_at || '',
      lead.last_visit_at || '',
      lead.conversions_sum,
      // escape name with quote if has comma
      String(lead.contact_name).includes(',') ? `"${lead.contact_name}"` : String(lead.contact_name || ''),
      String(lead.contact_job_title).includes(',') ? `"${lead.contact_job_title}"` : String(lead.contact_job_title || ''),
      String(lead.contact_origin).includes(',') ? `"${lead.contact_origin}"` : String(lead.contact_origin || ''),
      lead.traffic_campaign,
      lead.traffic_source,
      lead.traffic_medium,
      pgTagsStr,
      companyTagsStr,
      lead.company_size_factor,
      lead.is_available_for_mailing === true || String(lead.is_available_for_mailing).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
      lead.is_opportunity === true || String(lead.is_opportunity).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
      lead.entry_level_score,
      lead.premium_score,
      lead.crm_score,
      lead.conversational_score,
      lead.uf,
      lead.open_city,
      lead.open_country,
      lead.emails_recebidos_6m,
      lead.emails_abertos_6m,
      lead.emails_clicados_6m,
      lead.taxa_abertura_individual,
      lead.taxa_ctor_individual,
      lead.taxa_ctr_individual,
      lead.dias_desde_ultimo_open !== undefined ? lead.dias_desde_ultimo_open : '',
      lead.dias_desde_ultimo_click !== undefined ? lead.dias_desde_ultimo_click : '',
      lead.idade_lead_dias
    ];
    csvLines.push(row.join(','));
  });
  
  return csvLines.join('\n');
}
