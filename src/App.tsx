import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Terminal, 
  Search, 
  Filter, 
  Cpu, 
  Users, 
  ArrowRight, 
  UserCheck, 
  Calendar, 
  Volume2, 
  FileCheck, 
  Sliders, 
  Mail, 
  HelpCircle, 
  AlertTriangle, 
  Layers, 
  BarChart4, 
  CheckCircle,
  Database,
  RefreshCw,
  Send
} from 'lucide-react';
import { Lead, BaseStatsSummary, ChatMessage, LifecycleStage } from './types';
import { parseCSV, calculateStats, generateSampleCSV, checkMQL, checkBlockers, getLifecycleStage } from './utils/dataEngine';

export default function App() {
  const [csvRaw, setCsvRaw] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<BaseStatsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'funnel' | 'lifecycle' | 'audience' | 'email' | 'table'>('funnel');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLifecycleFilter, setSelectedLifecycleFilter] = useState<string>('All');
  const [selectedMqlFilter, setSelectedMqlFilter] = useState<string>('All');
  
  // Table pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Client configuration Status
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean>(false);
  const [checkingApi, setCheckingApi] = useState<boolean>(true);

  // Chat/Terminal states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputCommand, setInputCommand] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sample database immediately on startup
  useEffect(() => {
    const sample = generateSampleCSV();
    setCsvRaw(sample);
    const parsed = parseCSV(sample);
    setLeads(parsed);
    const calculatedStats = calculateStats(parsed);
    setStats(calculatedStats);

    // Initial helpful boot messages
    const welcomeMsgs: ChatMessage[] = [
      {
        id: 'bootsign-1',
        sender: 'agent',
        text: 'SISTEMA OPERACIONAL INICIALIZADO // AGENTE DE INTELIGÊNCIA DE BASE.',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      },
      {
        id: 'bootsign-2',
        sender: 'agent',
        text: 'Carreguei uma base de alta fidelidade com 115 contatos de lead para você explorar o Lifecycle Marketing imediatamente. Você também pode arrastar ou carregar o seu próprio CSV de exportação do RD Station no botão superior ⚡.',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      },
      {
        id: 'bootsign-3',
        sender: 'agent',
        text: 'Escolha uma das perguntas rápidas na automação lateral ou digite sua consulta na linha de comando para fazer uma análise estruturada com insights imediatos (formato 📊, 💡, ⚡) baseada na lógica de funil!',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      }
    ];
    setMessages(welcomeMsgs);

    // Check backend config
    checkApiStatus();
  }, []);

  // Autoscroll chat terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const checkApiStatus = async () => {
    try {
      const res = await fetch('/api/config-status');
      if (res.ok) {
        const data = await res.json();
        setApiKeyConfigured(data.hasApiKey);
      }
    } catch (e) {
      console.warn("Could not check backend API key status. Assuming fallback mode.");
    } finally {
      setCheckingApi(false);
    }
  };

  // CSV file uploader handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvRaw(text);
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          addTerminalMessage('agent', '⚠️ ERRO: O arquivo carregado está vazio ou não pôde ser analisado como CSV válido.');
          return;
        }
        setLeads(parsed);
        const calculatedStats = calculateStats(parsed);
        setStats(calculatedStats);
        setCurrentPage(1);

        addTerminalMessage('agent', `📂 BASE DETECTADA COM SUCESSO: ${parsed.length} leads importados. Novas estatísticas geradas.`);
      }
    };
    reader.readAsText(file);
  };

  // Drag and drop handles
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setCsvRaw(text);
          const parsed = parseCSV(text);
          if (parsed.length === 0) {
            addTerminalMessage('agent', '⚠️ ERRO: Arquivo inválido.');
            return;
          }
          setLeads(parsed);
          const calculatedStats = calculateStats(parsed);
          setStats(calculatedStats);
          setCurrentPage(1);
          addTerminalMessage('agent', `⚡ ARRASTO DE ARQUIVO DETECTADO: ${parsed.length} leads importados.`);
        }
      };
      reader.readAsText(file);
    }
  };

  const addTerminalMessage = (sender: 'user' | 'agent', text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    };
    setMessages(prev => [...prev, newMsg]);
  };

  // Run dynamic analysis (Calls Gemini API backend, and uses highly accurate local database engine statistics as backup)
  const handleQuery = async (promptText: string) => {
    if (!promptText.trim()) return;

    // Save query
    addTerminalMessage('user', promptText);
    setInputCommand('');
    setIsTyping(true);

    try {
      // Setup payload sending current stats summary context to Gemini
      const statsPayload = stats ? stats : calculateStats(leads);

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          statsSummary: statsPayload
        })
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      const data = await response.json();

      if (data.isFallback || !apiKeyConfigured) {
        // Run locally generated robust data analytic response matches specs exactly
        setTimeout(() => {
          const fallbackResponse = computeLocalIntelligence(promptText, leads, statsPayload);
          addTerminalMessage('agent', fallbackResponse);
          setIsTyping(false);
        }, 800);
      } else {
        addTerminalMessage('agent', data.text);
        setIsTyping(false);
      }

    } catch (err) {
      console.error(err);
      // Fail proof fallback
      setTimeout(() => {
        const fallbackResponse = computeLocalIntelligence(promptText, leads, stats ? stats : calculateStats(leads));
        addTerminalMessage('agent', "⚠️ [Aviso de Conectividade Local: Rodando Inteligência Local Integrada]\n\n" + fallbackResponse);
        setIsTyping(false);
      }, 500);
    }
  };

  // Highly robust local rule-based intelligence that returns beautiful exact statistics matching the user rules
  const computeLocalIntelligence = (prompt: string, currentLeads: Lead[], summary: BaseStatsSummary): string => {
    const lowerPrompt = prompt.toLowerCase();

    // 1. QUESTION: Distribuição de ciclo de vida
    if (lowerPrompt.includes('ciclo de vida') || lowerPrompt.includes('saúde da base') || lowerPrompt.includes('saude')) {
      const l = summary.lifecycle;
      const total = currentLeads.length;
      
      const pAtivo = ((l.ativo / total) * 100).toFixed(1);
      const pEngajado = ((l.engajado / total) * 100).toFixed(1);
      const pDormindo = ((l.dormindo / total) * 100).toFixed(1);
      const pFrio = ((l.frio / total) * 100).toFixed(1);
      const pInativo = ((l.inativo / total) * 100).toFixed(1);
      const pPerdido = ((l.perdido / total) * 100).toFixed(1);

      return `📊 Distribuição atual de Ciclo de Vida:
• 🟢 **Ativos (≤ 15 dias)**: ${l.ativo} contatos (${pAtivo}%)
• 🔵 **Engajados (16-30 dias)**: ${l.engajado} contatos (${pEngajado}%)
• 🟡 **Dormindo (31-60 dias)**: ${l.dormindo} contatos (${pDormindo}%)
• 🟠 **Frios (61-90 dias)**: ${l.frio} contatos (${pFrio}%)
• 🔴 **Inativos (91-180 dias)**: ${l.inativo} contatos (${pInativo}%)
• ⚫ **Perdidos (> 180 dias ou nulo)**: ${l.perdido} contatos (${pPerdido}%)

💡 **O insight por trás do número**: 
Mais de ${((l.dormindo + l.frio + l.inativo + l.perdido) / total * 100).toFixed(0)}% da base acumulada está atualmente acima de 30 dias sem nova conversão ou visita. Isso indica que a base esfria rapidamente após o cadastro inicial. Temos fit disponível, mas falta régua de aquecimento automatizada de longo prazo.

⚡ **Uma sugestão de próxima ação concreta**:
Crie um segmento no RD Station chamado **"Recuperação de Oportunidades Dormentes"** filtrando contatos em estágio 'Dormindo/Frio' (última atividade entre 31 e 90 dias) que possuem score de produto > 50. Dispare hoje uma campanha de conteúdo prático / case de cliente do setor correspondente para re-engajar esses contatos antes que caiam em Perdido.`;
    }

    // 2. QUESTION: Prontos para Vendas / MQLs por produto
    if (lowerPrompt.includes('vendas') || lowerPrompt.includes('prontos') || lowerPrompt.includes('mql') || lowerPrompt.includes('mqls')) {
      const m = summary.funnel.mqls;
      const total = currentLeads.length;
      const activeAndEngagedMQLs = currentLeads.filter(l => {
        const isM = checkMQL(l).isMQL;
        const stage = getLifecycleStage(l, '2026-05-27');
        return isM && (stage === 'Ativo' || stage === 'Engajado');
      }).length;

      const pSDR = ((activeAndEngagedMQLs / (m.total || 1)) * 100).toFixed(0);

      return `📊 Contabilizados **${m.total} MQLs qualificados** prontos para passagem comercial (score > 60 em pelo menos uma categoria, e-mail autorizado e sem bloqueios ativos).
Distribuição por produto:
• 📱 **MKT Entrada**: ${m.mktEntrada} leads qualificados
• 🏢 **MKT Pro**: ${m.mktPro} leads qualificados
• 🤝 **CRM**: ${m.crm} leads qualificados
• 💬 **Conversas**: ${m.conversas} leads qualificados
• 📦 **Multi-produto**: ${m.multiProduto} leads qualificados

💡 **O insight por trás do número**: 
Desses ${m.total} leads ideais, apenas **${activeAndEngagedMQLs} (${pSDR}%)** estão no ciclo de atividade 'Ativo' ou 'Engajado'. Os outros já estão dormentes ou frios, o que significa que o time de vendas vai ligar para leads que esqueceram que converteram recentemente. A janela quente de conversão está aberta agora para somente ${pSDR}% da lista estruturada.

⚡ **Uma sugestão de próxima ação concreta**:
Abra o RD Station, faça a exportação imediata de leads com filtro de score > 60 e que visitaram ou converteram nos últimos 15 dias (estágio Ativo). Distribua esses contatos manualmente nas primeiras posições de SDRs agora para abordagem com discurso personalizado focado no produto correspondente.`;
    }

    // 3. QUESTION: Bloqueios ativos na base
    if (lowerPrompt.includes('bloqueio') || lowerPrompt.includes('bloqueado') || lowerPrompt.includes('impedem')) {
      const b = summary.funnel.blocked;
      const total = currentLeads.length;
      
      // Sort blockers to find most common
      const bList = [
        { name: 'Opt-out (is_available_for_mailing = FALSE)', count: b.notAvailableForMailing },
        { name: 'Nome de contato vazio', count: b.emptyName },
        { name: 'Já é cliente ativo', count: b.alreadyCustomer },
        { name: 'Oportunidade aberta no CRM', count: b.alreadyOpportunity },
        { name: 'Empresa muito pequena (tamanho <= 1)', count: b.smallSizeFactor },
        { name: 'Churn Recente', count: b.recentChurn },
        { name: 'Segmento Público / Governo', count: b.publicSector }
      ].sort((a,b) => b.count - a.count);

      return `📊 **${b.total} contatos possuem algum bloqueio de MQL ativo** de acordo com as regras de governança de base.
O bloqueio mais comum é: **"${bList[0].name}"** com **${bList[0].count} leads**.

O ranking completo de impedimentos detectados:
1. 🛑 **${bList[0].name}**: ${bList[0].count} contatos
2. 🛑 **${bList[1].name}**: ${bList[1].count} contatos
3. 🛑 **${bList[2].name}**: ${bList[2].count} contatos
4. 🛑 **${bList[3].name}**: ${bList[3].count} contatos
5. 🛑 **${bList[4].name}**: ${bList[4].count} contatos

💡 **O insight por trás do número**:
Muitas vezes, atribuímos um volume de leads menor para vendas por causa de restrições de tamanho de empresa factor (${b.smallSizeFactor} leads bloqueados) ou opt-outs (${b.notAvailableForMailing} leads). Ter um nome vazio (${b.emptyName} contatos) representa falha de captura em formulários que pode ser corrigida de forma estrutural, pois esses leads possuem interesse ideal.

⚡ **Uma sugestão de próxima ação concreta**:
Para os contatos ideais bloqueados com nome vazio, configure um enriquecimento inteligente ou adicione um campo progressivo obrigatório de "Nome Completo" em materiais ricos futuros. Faça um split de teste no RD Station para leads com size factor 1 excluindo-os de vendas diretas, mas direcionando no CRM para fluxos de auto-atendimento de menor custo de CAC.`;
    }

    // 4. QUESTION: Scores altos dormindo (oportunidade perdida)
    if (lowerPrompt.includes('frio') || lowerPrompt.includes('alto') || lowerPrompt.includes('dormente') || lowerPrompt.includes('perdida')) {
      const coldHighScoreCount = currentLeads.filter(l => {
        const hasScore = l.entry_level_score > 60 || l.premium_score > 60 || l.crm_score > 60 || l.conversational_score > 60;
        const stage = getLifecycleStage(l, '2026-05-27');
        const mqlInfo = checkMQL(l);
        return hasScore && mqlInfo.blockers.length === 0 && (stage === 'Dormindo' || stage === 'Frio' || stage === 'Inativo');
      }).length;

      return `📊 **${coldHighScoreCount} Leads de alto valor (score > 60)** estão atualmente "Dormindo", "Frios" ou "Inativos".
Eles não interagem com nossos canais digitais há mais de 30 dias, mas têm o perfil perfeito e nenhuma trava ativa de marketing.

💡 **O insight por trás do número**:
Isso representa um vazamento direto de receita no pipeline de marketing. Investimos orçamento de aquisição em Ads, SEO e webinars para qualificar esses leads de alto fit (com pontuações expressivas de CRM ou MKT Pro), mas eles caíram na "zona morta" por falta de fluxos persistentes pós-leadscoring.

⚡ **Uma sugestão de próxima ação concreta**:
Crie imediatamente no RD Station uma régua de marketing específica chamada **"Reaquecimento High Score"**. Dispare um convite assinado pelo VP de Vendas da RD para uma demonstração exclusiva de 15 minutos do produto em que o lead tem o maior score. Essa abordagem mais pessoal tem taxas médias de abertura 4x maiores em bases dormentes.`;
    }

    // 5. QUESTION: Quem nunca recebeu e-mail
    if (lowerPrompt.includes('nunca') || lowerPrompt.includes('e-mail') || lowerPrompt.includes('sem receber') || lowerPrompt.includes('engajamento')) {
      const neverEmailHighScore = summary.engagement.neverReceivedWithHighScore;
      const averageOpen = (summary.engagement.avgOpenRate * 100).toFixed(1);
      const averageClick = (summary.engagement.avgClickRate * 100).toFixed(1);

      return `📊 **${neverEmailHighScore} leads com score alto (> 60) e disponíveis para mailing** nunca receberam um único e-mail de marketing nos últimos 6 meses.
A taxa média de abertura geral dos e-mails disparados para o restante da base de leads engajada é de **${averageOpen}%** com taxa média de clique de **${averageClick}%**.

💡 **O insight por trás do número**:
 leads com excelente fit que autorizaram o contato por e-mail estão sendo ignorados pelas réguas ativas por um provável erro de configuração de tag de entrada no fluxo ou limitação estrutural de envio de e-mails em lote. Isso reduz nossa taxa potencial de SQLs sem motivos técnicos.

⚡ **Uma sugestão de próxima ação concreta**:
Verifique os fluxos de nutrição de entrada no RD Marketing e certifique-se de que não haja filtros de tags excludentes genéricos que estejam retendo lead scoring alto. Configure um disparo emergencial focado nesses leads contendo o kit de templates mais baixado do produto correspondente à sua maior pontuação.`;
    }

    // 6. QUESTION: Leads de origem Hand Raiser ou Trial que não evoluíram
    if (lowerPrompt.includes('origem') || lowerPrompt.includes('trial') || lowerPrompt.includes('hand raiser') || lowerPrompt.includes('stuck') || lowerPrompt.includes('encontrado')) {
      const stuckCount = summary.engagement.neverEvolvedHandRaiserTrial;

      return `📊 Existem **${stuckCount} leads com origem "Hand Raiser" (Levantada de Mão) ou "Trial"** que não progrediram para oportunidade aberta no CRM ou cliente.
Eles preencheram um pedido de contato comercial direto ou ativaram testes de produto, mas continuam estagnados em funil.

💡 **O insight por trás do número**:
Esse grupo representa o lead de maior valor absoluto da base de leads de Lifecycle marketing. Se um usuário pediu contato direto e não foi classificado como oportunidade, ocorreu um erro de sincronização operacional (falha no Webhook) ou o time de pré-vendas (SDR) desistiu da abordagem após poucas tentativas sem recolocar o lead em nutrição.

⚡ **Uma sugestão de próxima ação concreta**:
Extraia estes leads que preencheram levantada de mão, cruze as informações com a ferramenta de CRM do RD Station para auditar se houve tentativa real de ligação e configure um fluxo de repescagem com o gancho: *"Identificamos que você tentou testar/falar conosco recentemente. Como podemos facilitar seu atendimento hoje?"* enviando para canal direto de WhatsApp.`;
    }

    // General Answer fallback
    return `📊 Análise consolidada sobre a base deleads (${currentLeads.length} registros ativos):
• Leads MQL Atuais: ${summary.funnel.mqls.total} qualificados
• Leads classificados como Decisores: ${summary.persona.decisores} contatos (${((summary.persona.decisores / currentLeads.length) * 100).toFixed(0)}%)
• Estado Ativos / Engajados na base: ${((summary.lifecycle.ativo + summary.lifecycle.engajado) / currentLeads.length * 100).toFixed(0)}%

💡 **O insight por trás do número**: 
Sua base apresenta alta aderência de fit (decisores executivos representam fatia significativa de ${((summary.persona.decisores / currentLeads.length) * 100).toFixed(0)}%), o que demonstra maturidade no tráfego de atração e qualidade. No entanto, o tempo de inatividade prolongado dilui o potencial e diminui a retenção desses leads que poderiam virar oportunidades comerciais no CRM.

⚡ **Uma sugestão de próxima ação concreta**:
Defina um calendário quinzenal de envio de newsletter de curadoria de hacks e insights de marketing focado na persona de decisores (Diretor, CEO, VP). Melhore a taxa de conversão adicionando botões explícitos e de fácil clique para "Testar CRM Gratuitamente" ou "Conectar com Especialista de WhatsApp".`;
  };

  // Quick prompt buttons triggers
  const triggerQuickQuestion = (question: string) => {
    handleQuery(question);
  };

  // Pagination filters computed listed leads
  const filteredLeads = leads.filter(lead => {
    // Search
    const searchLow = searchQuery.toLowerCase();
    const matchesSearch = 
      lead.contact_name.toLowerCase().includes(searchLow) ||
      lead.contact_job_title.toLowerCase().includes(searchLow) ||
      lead.contact_origin.toLowerCase().includes(searchLow) ||
      lead.contact_uuid.toLowerCase().includes(searchLow);
    
    // Lifecycle Filter
    const stage = getLifecycleStage(lead, '2026-05-27');
    const matchesLifecycle = selectedLifecycleFilter === 'All' || stage === selectedLifecycleFilter;

    // MQL filter
    const mqlInfo = checkMQL(lead);
    const matchesMql = selectedMqlFilter === 'All' || 
      (selectedMqlFilter === 'MQL' && mqlInfo.isMQL) || 
      (selectedMqlFilter === 'Blocked' && !mqlInfo.isMQL && checkBlockers(lead).isBlocked) ||
      (selectedMqlFilter === 'NotMQL' && !mqlInfo.isMQL && !checkBlockers(lead).isBlocked);

    return matchesSearch && matchesLifecycle && matchesMql;
  });

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeadsToDisplay = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="bg-[#0a0c10] text-slate-300 font-sans min-h-screen flex flex-col overflow-x-hidden selection:bg-orange-500/35 selection:text-white" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Top Header Rail */}
      <header className="border-b border-slate-800 bg-[#0d1117] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.85)] animate-pulse"></div>
          <div>
            <h1 className="text-sm font-mono tracking-widest text-slate-100 uppercase font-semibold">
              Agente de Inteligência de Base // Lifecycle Marketing
            </h1>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              RD station lead database analysis terminal v1.4
            </p>
          </div>
        </div>
        
        {/* Quick controls and actions */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button 
            id="btn-load-sample"
            onClick={() => {
              const sample = generateSampleCSV();
              setCsvRaw(sample);
              const parsed = parseCSV(sample);
              setLeads(parsed);
              const calculatedStats = calculateStats(parsed);
              setStats(calculatedStats);
              setCurrentPage(1);
              addTerminalMessage('agent', '⚡ RENOVAÇÃO DE BASE CONCENTRADA: Carregados 115 contatos de lead na máquina analítica.');
            }}
            className="px-3 py-1.5 bg-[#161b22] border border-slate-700 hover:border-orange-500 hover:bg-[#1f242c] text-slate-200 rounded font-mono transition text-[11px] flex items-center gap-1.5 cursor-pointer"
            title="Resetar para a base completa de treinamento"
          >
            <RefreshCw size={12} className="text-orange-500 animate-spin-slow" />
            Base Modelo Pro
          </button>

          <button 
            id="btn-upload-trigger"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded font-mono font-bold transition text-[11px] flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(234,88,12,0.2)]"
          >
            <Upload size={12} />
            Importar CSV Leads
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv" 
            className="hidden" 
          />

          <div className="hidden sm:flex gap-4 text-[10px] font-mono text-slate-500 uppercase ml-2 border-l border-slate-800 pl-4">
            <span>Ref: {stats?.timestamp || '2026-05-27'}</span>
            <span className="text-orange-500/80 font-bold">TERMINAL ATIVO</span>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-[1700px] mx-auto w-full">
        
        {/* Left Column: Metrics and Interactive Stats Tabs (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-6 w-full">
          
          {/* Diagnostic Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#161b22] border border-slate-800 p-4 rounded-lg shadow-inner relative overflow-hidden group hover:border-slate-700 transition">
              <div className="absolute right-3 top-3 text-slate-700 pointer-events-none group-hover:text-slate-600 transition">
                <Database size={16} />
              </div>
              <div className="text-[10px] text-slate-500 uppercase mb-1 font-bold font-mono">Total Base</div>
              <div className="text-2xl font-mono text-slate-100 font-bold">{leads.length}</div>
              <div className="text-[9px] text-slate-400 font-mono mt-1">leads carregados</div>
            </div>

            <div className="bg-[#161b22] border border-slate-800 p-4 rounded-lg shadow-inner relative overflow-hidden group hover:border-[#f97316]/30 transition">
              <div className="absolute right-3 top-3 text-slate-700 pointer-events-none group-hover:text-amber-500/20 transition">
                <Cpu size={16} />
              </div>
              <div className="text-[10px] text-orange-500/90 uppercase mb-1 font-bold font-mono">MQLs Potenciais</div>
              <div className="text-2xl font-mono text-orange-400 font-bold">
                {stats?.funnel.mqls.total ?? 0}
              </div>
              <div className="text-[9px] text-[#33DB95] font-mono mt-1">
                {leads.length > 0 ? (((stats?.funnel.mqls.total ?? 0) / leads.length) * 100).toFixed(0) : 0}% de conversão fit
              </div>
            </div>

            <div className="bg-[#161b22] border border-slate-800 p-4 rounded-lg shadow-inner relative overflow-hidden group hover:border-emerald-500/30 transition">
              <div className="absolute right-3 top-3 text-slate-700 pointer-events-none group-hover:text-emerald-500/20 transition">
                <Users size={16} />
              </div>
              <div className="text-[10px] text-emerald-500/90 uppercase mb-1 font-bold font-mono">Ativos (15d)</div>
              <div className="text-2xl font-mono text-emerald-400 font-bold">
                {stats?.lifecycle.ativo ?? 0}
              </div>
              <div className="text-[9px] text-emerald-500/70 font-mono mt-1">engajamento quente</div>
            </div>

            <div className="bg-[#161b22] border border-slate-800 p-4 rounded-lg shadow-inner relative overflow-hidden group hover:border-blue-500/30 transition">
              <div className="absolute right-3 top-3 text-slate-700 pointer-events-none group-hover:text-blue-500/20 transition">
                <FileCheck size={16} />
              </div>
              <div className="text-[10px] text-blue-500/95 uppercase mb-1 font-bold font-mono">Oportunidades (CRM)</div>
              <div className="text-2xl font-mono text-blue-400 font-bold">
                {stats?.funnel.opps ?? 0}
              </div>
              <div className="text-[9px] text-blue-500/70 font-mono mt-1">em negociação ativa</div>
            </div>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="bg-[#0d1117] border border-slate-800 rounded-xl p-5 lg:p-6 flex flex-col min-h-[480px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-orange-600 block"></span>
                <h2 className="text-xs font-bold uppercase text-slate-300 font-mono tracking-wider">
                  Painel de Inteligência Operacional RD Station
                </h2>
              </div>
              
              {/* Tab Selector */}
              <div className="flex flex-wrap gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800 text-[11px] font-mono select-none">
                <button 
                  id="tab-funnel"
                  onClick={() => setActiveTab('funnel')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${activeTab === 'funnel' ? 'bg-[#161b22] text-orange-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Funil MQL
                </button>
                <button 
                  id="tab-lifecycle"
                  onClick={() => setActiveTab('lifecycle')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${activeTab === 'lifecycle' ? 'bg-[#161b22] text-orange-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Ciclo de Vida
                </button>
                <button 
                  id="tab-audience"
                  onClick={() => setActiveTab('audience')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${activeTab === 'audience' ? 'bg-[#161b22] text-orange-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Personas & Fit
                </button>
                <button 
                  id="tab-email"
                  onClick={() => setActiveTab('email')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${activeTab === 'email' ? 'bg-[#161b22] text-orange-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Auditoria de E-mail
                </button>
                <button 
                  id="tab-table"
                  onClick={() => setActiveTab('table')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${activeTab === 'table' ? 'bg-[#161b22] text-orange-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Explorer ({leads.length})
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: FUNNEL & BLOCKERS */}
            {activeTab === 'funnel' && stats && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-2">
                    <span>⚡ Classificação do Pipeline MQL Potencial</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-[#161b22] px-2 py-0.5 rounded">Score de Fit {`>`} 60</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-5">
                    Visão analítica dos contatos qualificados com pontuação superior a 60, discriminados por categoria de produto. Um lead é MQL quando tem nova conversão recente, pontuação alta em alguma vertente de produto e nenhum bloqueio ativo de mailing ou regras de CRM.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left: Product distribution list */}
                    <div className="bg-[#161b22] border border-slate-800 rounded-lg p-4 space-y-4">
                      <h4 className="text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Distribuição por Categoria</h4>
                      
                      {/* Entry score item */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300">MKT Entrada</span>
                          <span className="text-orange-400 font-bold">{stats.funnel.mqls.mktEntrada}</span>
                        </div>
                        <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                          <div className="bg-orange-500 h-full" style={{ width: `${stats.funnel.mqls.total > 0 ? (stats.funnel.mqls.mktEntrada / stats.funnel.mqls.total * 100) : 0}%` }}></div>
                        </div>
                      </div>

                      {/* Pro score item */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300">MKT Pro</span>
                          <span className="text-orange-400 font-bold">{stats.funnel.mqls.mktPro}</span>
                        </div>
                        <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full" style={{ width: `${stats.funnel.mqls.total > 0 ? (stats.funnel.mqls.mktPro / stats.funnel.mqls.total * 100) : 0}%` }}></div>
                        </div>
                      </div>

                      {/* CRM score item */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300">CRM de Vendas</span>
                          <span className="text-orange-400 font-bold">{stats.funnel.mqls.crm}</span>
                        </div>
                        <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full" style={{ width: `${stats.funnel.mqls.total > 0 ? (stats.funnel.mqls.crm / stats.funnel.mqls.total * 100) : 0}%` }}></div>
                        </div>
                      </div>

                      {/* Conversas score item */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300">Conversas inteligente</span>
                          <span className="text-orange-400 font-bold">{stats.funnel.mqls.conversas}</span>
                        </div>
                        <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${stats.funnel.mqls.total > 0 ? (stats.funnel.mqls.conversas / stats.funnel.mqls.total * 100) : 0}%` }}></div>
                        </div>
                      </div>

                      {/* Multi score item */}
                      <div className="space-y-1 text-slate-400">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300">Multi-produto (Alto Fit Geral)</span>
                          <span className="text-orange-400 font-bold">{stats.funnel.mqls.multiProduto}</span>
                        </div>
                        <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                          <div className="bg-slate-400 h-full" style={{ width: `${stats.funnel.mqls.total > 0 ? (stats.funnel.mqls.multiProduto / stats.funnel.mqls.total * 100) : 0}%` }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Blocker stats */}
                    <div className="bg-[#161b22] border border-slate-800 rounded-lg p-4 space-y-3">
                      <h4 className="text-[11px] font-mono text-red-400 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
                        <span>Filtros Governança de Base</span>
                        <span className="bg-red-950 text-red-400 font-bold border border-red-900 px-1.5 py-0.5 rounded text-[9px]">{stats.funnel.blocked.total} Bloqueados</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        Contatos que pontuaram idealmente mas foram contidos de ir para o comercial ativo pelos critérios protetores de mailing.
                      </p>

                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between items-center py-1 border-b border-slate-900">
                          <span className="text-slate-400">Restrição de Mailing (Opt-out/Bounce)</span>
                          <span className="text-slate-200 font-bold">{stats.funnel.blocked.notAvailableForMailing}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-900">
                          <span className="text-slate-400">Nome de contato ausente/inválido</span>
                          <span className="text-slate-200 font-bold">{stats.funnel.blocked.emptyName}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-900">
                          <span className="text-slate-400">Já é Cliente Atativo (Marketing ou CRM)</span>
                          <span className="text-indigo-400 font-bold">{stats.funnel.blocked.alreadyCustomer}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-900">
                          <span className="text-slate-400">Negociação Ativa no CRM (Opportunity)</span>
                          <span className="text-blue-400 font-bold">{stats.funnel.blocked.alreadyOpportunity}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-900">
                          <span className="text-slate-400">Fator de Tamanho Reduzido (Microempresa)</span>
                          <span className="text-slate-200 font-bold">{stats.funnel.blocked.smallSizeFactor}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-900">
                          <span className="text-slate-400">Churn de Cliente RD recente</span>
                          <span className="text-orange-400 font-bold">{stats.funnel.blocked.recentChurn}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-400">Contas do Governo ou Setor Público</span>
                          <span className="text-yellow-600 font-bold">{stats.funnel.blocked.publicSector}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1c2128] border border-orange-500/10 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-mono text-orange-400 uppercase font-bold flex items-center gap-1.5">
                      <HelpCircle size={14} className="text-orange-500" />
                      Auditoria Pronta de SQLs
                    </span>
                    <p className="text-[11px] text-slate-400 max-w-xl">
                      Para saber exatamente quantos contatos estão aptos para SDR sem receber bloqueios e qualificados, dispare a pergunta rápida de automação lateral em nosso terminal clínico.
                    </p>
                  </div>
                  <button 
                    onClick={() => triggerQuickQuestion("Quantos leads estão prontos para vendas?")}
                    className="px-3 py-1.5 bg-[#0a0c10] hover:bg-orange-600/20 text-slate-200 hover:text-white border border-slate-800 rounded font-mono text-[11px] transition shrink-0 cursor-pointer"
                  >
                    Auditar Vendas &gt;
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: LIFECYCLE HEALTH MAPPING */}
            {activeTab === 'lifecycle' && stats && (
              <div className="space-y-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-2">
                    <span>📈 Mapeamento de Ciclo de Vida (Recência de Atividade)</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-[#161b22] px-2 py-0.5 rounded">Data Base: 2026-05-27</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-5">
                    Classificação analítica baseada no tempo decorrido desde o último sinal de engajamento digital detectado (maior data histórica entre última conversão em página e última visita ao site).
                  </p>

                  <div className="bg-[#161b22] border border-slate-800 rounded-lg p-5 flex flex-col justify-around flex-grow space-y-5 max-w-3xl">
                    
                    {/* Active */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                          Ativo (último sinal ≤ 15 dias)
                        </span>
                        <span className="text-emerald-400 font-bold">{stats.lifecycle.ativo} contatos ({leads.length > 0 ? ((stats.lifecycle.ativo / leads.length) * 100).toFixed(1) : 0}%)</span>
                      </div>
                      <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${leads.length > 0 ? (stats.lifecycle.ativo / leads.length * 100) : 0}%` }}></div>
                      </div>
                    </div>

                    {/* Engaged */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                          Engajado (último sinal entre 16 e 30 dias)
                        </span>
                        <span className="text-emerald-600 font-bold">{stats.lifecycle.engajado} contatos ({leads.length > 0 ? ((stats.lifecycle.engajado / leads.length) * 100).toFixed(1) : 0}%)</span>
                      </div>
                      <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-700 h-full" style={{ width: `${leads.length > 0 ? (stats.lifecycle.engajado / leads.length * 100) : 0}%` }}></div>
                      </div>
                    </div>

                    {/* Dormindo */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block shadow-[0_0_8px_rgba(234,179,8,0.4)]"></span>
                          Dormindo (último sinal entre 31 e 60 dias)
                        </span>
                        <span className="text-yellow-500 font-bold">{stats.lifecycle.dormindo} contatos ({leads.length > 0 ? ((stats.lifecycle.dormindo / leads.length) * 100).toFixed(1) : 0}%)</span>
                      </div>
                      <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                        <div className="bg-yellow-600 h-full" style={{ width: `${leads.length > 0 ? (stats.lifecycle.dormindo / leads.length * 100) : 0}%` }}></div>
                      </div>
                    </div>

                    {/* Frio */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
                          Frio (último sinal entre 61 e 90 dias)
                        </span>
                        <span className="text-orange-500 font-bold">{stats.lifecycle.frio} contatos ({leads.length > 0 ? ((stats.lifecycle.frio / leads.length) * 100).toFixed(1) : 0}%)</span>
                      </div>
                      <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                        <div className="bg-orange-600 h-full" style={{ width: `${leads.length > 0 ? (stats.lifecycle.frio / leads.length * 100) : 0}%` }}></div>
                      </div>
                    </div>

                    {/* Inativo */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-800 inline-block"></span>
                          Inativo (último sinal entre 91 e 180 dias)
                        </span>
                        <span className="text-red-400 font-bold">{stats.lifecycle.inativo} contatos ({leads.length > 0 ? ((stats.lifecycle.inativo / leads.length) * 100).toFixed(1) : 0}%)</span>
                      </div>
                      <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                        <div className="bg-red-800 h-full" style={{ width: `${leads.length > 0 ? (stats.lifecycle.inativo / leads.length * 100) : 0}%` }}></div>
                      </div>
                    </div>

                    {/* Perdido */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-500">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-700 inline-block animate-pulse"></span>
                          Perdido (último sinal &gt; 180 dias ou nulo)
                        </span>
                        <span>{stats.lifecycle.perdido} contatos ({leads.length > 0 ? ((stats.lifecycle.perdido / leads.length) * 100).toFixed(1) : 0}%)</span>
                      </div>
                      <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden">
                        <div className="bg-slate-700 h-full" style={{ width: `${leads.length > 0 ? (stats.lifecycle.perdido / leads.length * 100) : 0}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#161b22] border border-slate-800 rounded-lg p-4 flex items-center gap-3">
                  <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0" />
                  <p className="text-[11px] text-slate-400 leading-normal">
                    <strong className="text-slate-200">Atenção Lifecycle Manager:</strong> Um lead qualificado (MQL) que se tornou <span className="text-slate-200 font-bold">"Frio" ou "Inativo"</span> necessita de abordagem diferenciada em relação a um lead em estado ativo. Dispare hoje um fluxo estratégico de aquecimento para reativar essa base perdida.
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: PERSONAS, CARGOS & ORIGEM */}
            {activeTab === 'audience' && stats && (
              <div className="space-y-6 flex-grow">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-2">
                    <span>👑 Inteligência de ICP: Decisores & Demografia</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-[#161b22] px-2 py-0.5 rounded">Índice Computado do CSV</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-5">
                    Classificação demográfica baseada na identificação automática de cargos de tomada de decisão (tags de perfil decisor, cargos de gerência, direção, sócios ou diretoria executiva).
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Radial stats for Decisores / Nao decisores */}
                    <div className="md:col-span-4 bg-[#161b22] border border-slate-800 rounded-lg p-4 flex flex-col justify-center items-center text-center">
                      <span className="text-slate-400 text-xs font-mono uppercase font-bold mb-4">Maturidade da Base (ICP)</span>
                      
                      <div className="relative w-28 h-28 flex items-center justify-center rounded-full border-4 border-slate-800">
                        <div className="text-center">
                          <span className="text-3xl font-mono text-emerald-400 font-bold mb-0.5 block">
                            {leads.length > 0 ? ((stats.persona.decisores / leads.length) * 100).toFixed(0) : 0}%
                          </span>
                          <span className="text-[9px] text-slate-500 uppercase font-mono tracking-tight">Decisores</span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1.5 text-[11px] text-slate-300 font-mono w-full text-left">
                        <div className="flex justify-between">
                          <span>Total de Decisores:</span>
                          <span className="text-emerald-400 font-bold">{stats.persona.decisores}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Não Decisores:</span>
                          <span className="text-slate-500">{stats.persona.naoDecisores}</span>
                        </div>
                      </div>
                    </div>

                    {/* Top cargos / Top Origens / Top Segmentos lists */}
                    <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#161b22] border border-slate-800 rounded-lg p-4 font-mono">
                        <span className="text-[10px] text-orange-400/80 uppercase font-bold tracking-wider block mb-3 pb-1 border-b border-slate-800">Cargos Dominantes</span>
                        <ul className="space-y-2 text-xs">
                          {stats.persona.topCargos.map((item, id) => (
                            <li key={`cargo-${id}`} className="flex justify-between py-1 border-b border-slate-900 last:border-0">
                              <span className="text-slate-300 truncate max-w-[150px]" title={item.cargo}>{item.cargo}</span>
                              <span className="text-slate-400 font-bold bg-[#0d1117] px-1.5 rounded">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-[#161b22] border border-slate-800 rounded-lg p-4 font-mono">
                        <span className="text-[10px] text-orange-400/80 uppercase font-bold tracking-wider block mb-3 pb-1 border-b border-slate-800">Canais de Tráfego Importantes</span>
                        <ul className="space-y-2 text-xs">
                          {stats.persona.topOrigens.map((item, id) => (
                            <li key={`origem-${id}`} className="flex justify-between py-1 border-b border-slate-900 last:border-0">
                              <span className="text-slate-300 truncate max-w-[150px]" title={item.origem}>{item.origem}</span>
                              <span className="text-slate-400 font-bold bg-[#0d1117] px-1.5 rounded">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#161b22] border border-slate-800 rounded-lg p-4 space-y-2 font-mono text-[11px]">
                  <span className="text-orange-400 font-bold uppercase tracking-wider block">Regiões em Destaque (Origem por UF):</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {stats.persona.topUFs.map((item, id) => (
                      <span key={`uf-${id}`} className="bg-[#0d1117] px-3 py-1 rounded border border-slate-800 text-slate-300 font-bold">
                        {item.uf}: <span className="text-orange-400 font-normal">{item.count} leads</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: EMAIL AUDITING */}
            {activeTab === 'email' && stats && (
              <div className="space-y-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-2">
                    <span>✉️ Auditoria de Engajamento de Campanhas de E-mail (6m)</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-[#161b22] px-2 py-0.5 rounded">Estudos Recentes</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-5">
                    Insights e auditoria sobre e-mails entregues, abertos ou clicados. Entenda vazamentos e oportunidades na régua.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-[#161b22] border border-slate-800 rounded-lg p-5 space-y-4">
                      <span className="text-xs font-mono uppercase font-bold text-slate-400 tracking-wider block border-b border-slate-800 pb-2">Estatísticas Gerais de Abertura</span>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0d1117] p-3 rounded border border-slate-850 text-center">
                          <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Taxa Média Abertura</span>
                          <span className="text-xl font-mono text-emerald-400 font-bold">
                            {(stats.engagement.avgOpenRate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="bg-[#0d1117] p-3 rounded border border-slate-850 text-center">
                          <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Taxa Média Clique</span>
                          <span className="text-xl font-mono text-emerald-400 font-bold">
                            {(stats.engagement.avgClickRate * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs font-mono text-slate-300 pt-1">
                        <div className="flex justify-between">
                          <span>Leads que receberam e-mails nos últimos 6 meses:</span>
                          <span className="font-bold text-slate-100">{stats.engagement.receivedEmails} contatos</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Não engajados / Não receberam:</span>
                          <span className="font-bold text-slate-400">{leads.length - stats.engagement.receivedEmails} contatos</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#161b22] border border-slate-800 rounded-lg p-5 space-y-4">
                      <span className="text-xs font-mono uppercase font-bold text-red-400 tracking-wider block border-b border-slate-800 pb-2 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-red-400" />
                        Vazamentos Operacionais Emergentes
                      </span>

                      <div className="space-y-4 font-mono">
                        <div className="bg-[#0d1117] border border-red-950/40 p-3 rounded relative">
                          <span className="text-red-400 text-lg font-bold block mb-1">
                            {stats.engagement.neverReceivedWithHighScore} Leads
                          </span>
                          <p className="text-[11px] text-slate-400 leading-normal">
                            Contatos com score alto e autorizados para mailing que <strong className="text-slate-300">nunca receberam um único e-mail</strong> nos últimos 6 meses.
                          </p>
                        </div>

                        <div className="bg-[#0d1117] border border-amber-950/40 p-3 rounded relative">
                          <span className="text-amber-400 text-lg font-bold block mb-1">
                            {stats.engagement.neverEvolvedHandRaiserTrial} Leads
                          </span>
                          <p className="text-[11px] text-slate-400 leading-normal">
                            Contatos de origem <strong className="text-slate-300">"Levantada de Mão" ou "Trial"</strong> que continuam atados no funil sem evoluir para venda ativa.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1c2128] border border-red-500/10 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-mono text-red-400 uppercase font-bold flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Auditoria de Gargalos & Vazamentos de Receita
                    </span>
                    <p className="text-[11px] text-slate-400 max-w-xl">
                      Para entender o perfil de leads que possuem score alto de fit de produto, mas nunca receberam e-mails, ou leads trial que não evoluíram, dispare a automação investigativa.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => triggerQuickQuestion("Leads com score alto e nunca receberam e-mail de marketing?")}
                      className="px-3 py-1.5 bg-[#0a0c10] hover:bg-orange-600/20 text-slate-200 hover:text-white border border-slate-800 rounded font-mono text-[11px] transition cursor-pointer"
                    >
                      Auditar Sem Envio
                    </button>
                    <button 
                      onClick={() => triggerQuickQuestion("Leads com origem Hand Raiser ou Trial que não evoluíram?")}
                      className="px-3 py-1.5 bg-[#0a0c10] hover:bg-orange-600/20 text-slate-200 hover:text-white border border-slate-800 rounded font-mono text-[11px] transition cursor-pointer"
                    >
                      Auditar Trials Presos
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 5: LEADS EXPLORER DATABASE TABLE */}
            {activeTab === 'table' && (
              <div className="space-y-4 flex-grow flex flex-col justify-between">
                
                {/* Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs font-mono">
                  
                  {/* Search */}
                  <div className="md:col-span-5 relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="Filtrar por nome, cargo ou origem..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-[#0d1117] border border-slate-800 rounded px-8 py-2 text-slate-200 focus:outline-none focus:border-orange-500 transition text-[11px]"
                    />
                  </div>

                  {/* Lifecycle Filter dropdown */}
                  <div className="md:col-span-3 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Status:</span>
                    <select
                      value={selectedLifecycleFilter}
                      onChange={(e) => {
                        setSelectedLifecycleFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="flex-1 bg-[#0d1117] border border-slate-800 rounded p-1.5 py-1 text-slate-300 focus:outline-none cursor-pointer text-[11px]"
                    >
                      <option value="All">Todos Ciclos</option>
                      <option value="Ativo">Ativo (≤15d)</option>
                      <option value="Engajado">Engajado (16-30d)</option>
                      <option value="Dormindo">Dormindo (31-60d)</option>
                      <option value="Frio">Frio (61-90d)</option>
                      <option value="Inativo">Inativo (91-180d)</option>
                      <option value="Perdido">Perdido (&gt;180d)</option>
                    </select>
                  </div>

                  {/* MQL state filter */}
                  <div className="md:col-span-4 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Filtro:</span>
                    <select
                      value={selectedMqlFilter}
                      onChange={(e) => {
                        setSelectedMqlFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="flex-1 bg-[#0d1117] border border-slate-800 rounded p-1.5 py-1 text-slate-300 focus:outline-none cursor-pointer text-[11px]"
                    >
                      <option value="All">Qualificações</option>
                      <option value="MQL">MQLs Confirmados</option>
                      <option value="Blocked">Com Bloqueios</option>
                      <option value="NotMQL">Sem score / Sem conversão</option>
                    </select>
                  </div>
                </div>

                {/* Database leads results table list */}
                <div className="flex-1 overflow-x-auto border border-slate-800 rounded-lg bg-[#0a0c10]">
                  <table className="w-full text-left font-mono text-[11px] select-text">
                    <thead className="bg-[#161b22] text-slate-400 border-b border-slate-800 sticky top-0 uppercase tracking-tighter">
                      <tr>
                        <th className="p-3 w-12 text-center">MQL?</th>
                        <th className="p-3">Nome / Cargo</th>
                        <th className="p-3">Origem</th>
                        <th className="p-3 text-center">Score Entrada</th>
                        <th className="p-3 text-center">Score Pro</th>
                        <th className="p-3 text-center">Score CRM</th>
                        <th className="p-3 text-center">Emails Recb.</th>
                        <th className="p-3 text-right">Ciclo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {currentLeadsToDisplay.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-mono">
                            Nenhum lead localizado com esses filtros analíticos ativos.
                          </td>
                        </tr>
                      ) : (
                        currentLeadsToDisplay.map((lead, idx) => {
                          const mqlInfo = checkMQL(lead);
                          const lifeStage = getLifecycleStage(lead, '2026-05-27');
                          
                          // badge styling
                          let mqlBadge = <span className="text-slate-600">⚪</span>;
                          if (mqlInfo.isMQL) {
                            mqlBadge = <span className="text-emerald-400 font-bold" title={`MQL por fit em '${mqlInfo.product}'`}>🟢 MQL</span>;
                          } else if (checkBlockers(lead).isBlocked) {
                            mqlBadge = <span className="text-red-500 font-medium" title={`Bloqueio ativo: ${mqlInfo.blockers.join(', ')}`}>🛑 Block</span>;
                          }

                          let cycleColor = 'text-slate-400';
                          if (lifeStage === 'Ativo') cycleColor = 'bg-emerald-950 text-emerald-400 border border-emerald-900';
                          else if (lifeStage === 'Engajado') cycleColor = 'bg-emerald-950/40 text-emerald-500 border border-emerald-950';
                          else if (lifeStage === 'Dormindo') cycleColor = 'bg-yellow-950/40 text-yellow-500 border border-yellow-950';
                          else if (lifeStage === 'Frio') cycleColor = 'bg-orange-950/40 text-orange-400 border border-orange-950';
                          else if (lifeStage === 'Inativo') cycleColor = 'bg-red-950/40 text-red-400 border border-red-950';
                          else if (lifeStage === 'Perdido') cycleColor = 'bg-slate-900 text-slate-500 border border-slate-800';

                          return (
                            <tr key={lead.contact_uuid} className="hover:bg-[#161b22]/30 transition group select-text">
                              <td className="p-3 text-center border-r border-slate-900 font-bold">{mqlBadge}</td>
                              <td className="p-3">
                                <div className="font-semibold text-slate-200 group-hover:text-slate-100 transition truncate max-w-[170px]" title={lead.contact_name}>
                                  {lead.contact_name || <em className="text-slate-600">(Nome Ausente)</em>}
                                </div>
                                <div className="text-[9px] text-slate-500 truncate max-w-[150px]" title={lead.contact_job_title}>{lead.contact_job_title || 'Não Informado'}</div>
                              </td>
                              <td className="p-3 text-slate-400 truncate max-w-[120px]" title={lead.contact_origin}>{lead.contact_origin || 'Direto'}</td>
                              <td className="p-3 text-center font-bold text-slate-300">{lead.entry_level_score}</td>
                              <td className="p-3 text-center font-bold text-slate-300">{lead.premium_score}</td>
                              <td className="p-3 text-center font-bold text-slate-300">{lead.crm_score}</td>
                              <td className="p-3 text-center text-slate-400">{lead.emails_recebidos_6m}</td>
                              <td className="p-3 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cycleColor}`}>
                                  {lifeStage}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center text-xs font-mono select-none px-1">
                  <span className="text-slate-500">
                    Exibindo contatos {filteredLeads.length > 0 ? indexOfFirstItem + 1 : 0} a {Math.min(indexOfLastItem, filteredLeads.length)} de a {filteredLeads.length} leads correspondentes.
                  </span>
                  
                  <div className="flex gap-1">
                    <button 
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-2 py-1 border border-slate-800 bg-[#161b22] hover:bg-[#1f242c] text-slate-300 rounded disabled:opacity-30 disabled:hover:bg-[#161b22] cursor-pointer"
                    >
                      &lt; Anterior
                    </button>
                    <span className="px-3 py-1 bg-slate-900 border border-slate-800 text-slate-300 rounded">
                      Página {currentPage} de {Math.max(totalPages, 1)}
                    </span>
                    <button 
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-2 py-1 border border-slate-800 bg-[#161b22] hover:bg-[#1f242c] text-slate-300 rounded disabled:opacity-30 disabled:hover:bg-[#161b22] cursor-pointer"
                    >
                      Próxima &gt;
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </section>

        {/* Right Column: AI terminal query workspace (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-6 w-full">
          <div className="bg-[#1c2128] border border-orange-500/25 rounded-xl p-5 lg:p-6 flex flex-col min-h-[610px] shadow-[0_0_25px_rgba(249,115,22,0.06)] relative overflow-hidden">
            
            {/* Header branding info */}
            <div className="mb-4">
              <div className="flex justify-between items-center text-[10px] font-mono mb-2">
                <span className="text-orange-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal size={12} className="animate-pulse" />
                  QUERY_WORKSPACE: DEEP_ANALYSIS
                </span>
                <span className="text-slate-500 italic decoration-orange-500/30">Mapeamento Clínico</span>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-orange-500/50 via-orange-500/20 to-transparent"></div>
            </div>

            {/* Quick Playbook Questions Automation Panel */}
            <div className="mb-4">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2 font-bold select-none text-right">
                Perguntas do Playbook RD Station:
              </span>
              <div className="flex flex-col gap-2 font-mono scroll-py-2 max-h-36 overflow-y-auto">
                <button 
                  onClick={() => triggerQuickQuestion("Como está o ciclo de vida da base?")}
                  className="w-full text-[10px] py-1.5 px-2 bg-[#0d1117] text-left text-slate-300 hover:text-white border border-slate-800 hover:border-orange-500/50 rounded transition truncate cursor-pointer text-ellipsis block"
                >
                  ⚡ Saúde de Ciclo de Vida da Base
                </button>
                <button 
                  onClick={() => triggerQuickQuestion("Quantos leads estão prontos para vendas?")}
                  className="w-full text-[10px] py-1.5 px-2 bg-[#0d1117] text-left text-slate-300 hover:text-white border border-slate-800 hover:border-orange-500/50 rounded transition truncate cursor-pointer text-ellipsis block"
                >
                  ⚡ leads Qualificados MQL Livres
                </button>
                <button 
                  onClick={() => triggerQuickQuestion("Quantos leads têm bloqueios ativos no funil?")}
                  className="w-full text-[10px] py-1.5 px-2 bg-[#0d1117] text-left text-slate-300 hover:text-white border border-slate-800 hover:border-orange-500/50 rounded transition truncate cursor-pointer text-ellipsis block"
                >
                  ⚡ Principais Impedimentos / Bloqueios
                </button>
                <button 
                  onClick={() => triggerQuickQuestion("Quais os leads com score alto e ciclo de vida frio?")}
                  className="w-full text-[10px] py-1.5 px-2 bg-[#0d1117] text-left text-slate-300 hover:text-white border border-slate-800 hover:border-orange-500/50 rounded transition truncate cursor-pointer text-ellipsis block"
                >
                  ⚡ High Score Frios (Gargalos)
                </button>
                <button 
                  onClick={() => triggerQuickQuestion("Leads com score alto e nunca receberam e-mail de marketing?")}
                  className="w-full text-[10px] py-1.5 px-2 bg-[#0d1117] text-left text-slate-300 hover:text-white border border-slate-800 hover:border-orange-500/50 rounded transition truncate cursor-pointer text-ellipsis block"
                >
                  ⚡ High Score Sem E-mail Recebido
                </button>
                <button 
                  onClick={() => triggerQuickQuestion("Leads com origem Hand Raiser ou Trial que não evoluíram?")}
                  className="w-full text-[10px] py-1.5 px-2 bg-[#0d1117] text-left text-slate-300 hover:text-white border border-slate-800 hover:border-orange-500/50 rounded transition truncate cursor-pointer text-ellipsis block"
                >
                  ⚡ Levantada de Mão / Trials Travados
                </button>
              </div>
            </div>

            {/* Chat view terminal scroll space */}
            <div className="flex-1 bg-[#0d1117]/95 border border-slate-800 rounded-lg p-3 overflow-y-auto mb-4 font-mono text-xs flex flex-col gap-4 max-h-[360px] min-h-[220px]">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500 uppercase mb-1">
                      <span>{isUser ? 'Comando Admin' : 'Inteligência de Base'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div className={`p-3 rounded-lg select-text leading-relaxed whitespace-pre-wrap max-w-[95%] border ${
                      isUser 
                        ? 'bg-slate-900 border-slate-800 text-slate-200' 
                        : 'bg-[#161b22] border-slate-800 text-slate-150'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 uppercase mb-1">
                    <span>Processando banco de dados de leads...</span>
                  </div>
                  <div className="bg-[#161b22] border border-slate-800 p-3 rounded-lg flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    <span className="text-[10px] text-slate-500 font-mono pl-1">COMPUTING_ICP_LIFECYCLE</span>
                  </div>
                </div>
              )}
              
              <div ref={terminalEndRef} />
            </div>

            {/* Interactive console inputs */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleQuery(inputCommand);
              }}
              className="mt-auto space-y-2"
            >
              <div className="relative flex items-center border border-slate-800 focus-within:border-orange-500 rounded-lg bg-[#0d1117] transition overflow-hidden">
                <span className="pl-3 text-orange-500 font-mono font-bold text-xs shrink-0 select-none">&gt;&gt;</span>
                <input 
                  type="text"
                  placeholder="Escreva sua pergunta ou código do lead..."
                  value={inputCommand}
                  onChange={(e) => setInputCommand(e.target.value)}
                  className="w-full bg-transparent border-0 px-2 py-3 text-slate-200 focus:outline-none focus:ring-0 font-mono text-xs"
                />
                <button 
                  type="submit"
                  disabled={!inputCommand.trim() || isTyping}
                  className="px-3 py-3 text-orange-500 hover:text-orange-400 disabled:text-slate-700 bg-slate-900 border-l border-slate-850 hover:bg-slate-850 transition cursor-pointer"
                >
                  <Send size={14} />
                </button>
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-1">
                <span className="flex items-center gap-1">
                  <Database size={10} className="text-orange-500/70" />
                  Leads: <strong className="text-slate-400">{leads.length}</strong>
                </span>
                
                {checkingApi ? (
                  <span>verificando api...</span>
                ) : apiKeyConfigured ? (
                  <span className="text-emerald-500/80 font-bold flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                    Gemini 3.5 Ativo
                  </span>
                ) : (
                  <span className="text-[#33DB95]/90 font-semibold flex items-center gap-1" title="Rodando cálculos estatísticos em tempo real de forma local e inteligente">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#33DB95] inline-block shadow-[0_0_5px_#33DB95]"></span>
                    Análise Local Ligada
                  </span>
                )}
              </div>
            </form>

          </div>
        </section>

      </main>

      {/* Persistent Static Status Bar */}
      <footer className="h-8 bg-[#0d1117] border-t border-slate-850 flex items-center px-6 justify-between text-[10px] font-mono text-slate-500 select-none">
        <div>
          SYS_LOG: ANALYSIS_COMPLETE // CODESIG: ACTIVE // REFERENCE_DATE: 2026-05-27
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] uppercase hidden sm:inline text-slate-600">Base: Exclusivo Lifecycle RD Station</span>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]"></div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
