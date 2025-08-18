// Tipos TypeScript para o dashboard

export interface DashboardData {
  visaoGeral: {
    totalEmAberto: number;
    totalQuitado: number;
    totalNegociando: number;
    faixasAtraso: {
      ate30: number;
      de31a90: number;
      de91a180: number;
      mais180: number;
    };
    percentuais: {
      quitados: number;
      emAberto: number;
      negociando: number;
    };
  };
  rankingInadimplentes: {
    cliente: string;
    cnpj: string;
    quantidadeTitulos: number;
    valorTotal: number;
  }[];
  evolucaoMensal: {
    mes: string;
    valorRecebido: number;
    valorInadimplente: number;
    valorRecuperado: number;
  }[];
  eficienciaCobrancas: {
    totalMensagens: number;
    totalAgendamentos: number;
    conversaoAgendamento: number;
    tempoMedioResolucao: number;
    taxaConversao: number;
  };
}

export interface IndicadoresMensais {
  total_em_aberto_mes: number;
  // Soma do valor_original das cobranças não quitadas
  total_em_aberto_original_mes?: number;
  // Soma do valor_atualizado (ou original) das cobranças não quitadas
  total_em_aberto_atualizado_mes?: number;
  total_pago_mes: number;
  total_negociando_mes: number;
  percentual_inadimplencia: number;
  unidades_inadimplentes: number;
  ticket_medio_dividas: number;
  percentual_recuperacao: number;
  comparativo_mes_anterior: {
    variacao_em_aberto: number;
    variacao_pago: number;
    variacao_inadimplencia: number;
  };
}

export interface UnidadeRisco {
  cnpj: string;
  codigo_unidade: string;
  nome_unidade: string;
  valor_em_aberto: number;
  dias_sem_pagamento: number;
  ultimo_contato: string;
  status_atual: string;
  tentativas_contato: number;
  acao_recomendada: string;
  nivel_risco: 'baixo' | 'medio' | 'alto' | 'critico';
  score_risco: number;
}

export interface EvolucaoTemporal {
  periodo: string;
  valor_emitido: number;
  valor_recebido: number;
  valor_em_aberto: number;
  percentual_inadimplencia: number;
  unidades_inadimplentes: number;
}

export interface AlertaAutomatico {
  id: string;
  tipo: 'sem_pagamento_30_dias' | 'cobrancas_ignoradas' | 'reincidencia' | 'negociacao_pendente';
  titulo: string;
  descricao: string;
  cnpj_unidade: string;
  nome_unidade: string;
  valor_envolvido: number;
  data_criacao: string;
  urgencia: 'baixa' | 'media' | 'alta' | 'critica';
  acao_sugerida: string;
  resolvido: boolean;
}

export interface FiltrosDashboard {
  dataInicio?: string;
  dataFim?: string;
  status?: string;
  cnpj?: string;
  faixaAtraso?: string;
  valorMinimo?: number;
  valorMaximo?: number;
  franqueadoPrincipal?: boolean;
  tipoCobranca?: string;
  regiao?: string;
}

export interface UsuarioDashboard {
  id: string;
  email: string;
  perfil: 'diretor' | 'financeiro' | 'gestor_regional' | 'juridico' | 'administrativo';
  cnpjs_permitidos?: string[];
  regioes_permitidas?: string[];
}

export interface ConfiguracaoAlerta {
  tipo: string;
  ativo: boolean;
  valor_limite?: number;
  dias_limite?: number;
  frequencia_verificacao: 'diaria' | 'semanal';
  destinatarios: string[];
}

export interface RelatorioExecutivo {
  periodo: string;
  resumo_executivo: {
    total_carteira: number;
    inadimplencia_atual: number;
    recuperacao_mes: number;
    casos_criticos: number;
  };
  principais_indicadores: IndicadoresMensais;
  unidades_atencao: UnidadeRisco[];
  evolucao_6_meses: EvolucaoTemporal[];
  alertas_ativos: AlertaAutomatico[];
  recomendacoes: string[];
}