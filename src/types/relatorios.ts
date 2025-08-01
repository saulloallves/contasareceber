export interface RelatorioMensal {
  id: string;
  referencia_mes: string;
  dados_consolidados: DadosConsolidados;
  url_pdf?: string;
  url_xlsx?: string;
  gerado_em: string;
  gerado_por: string;
  enviado_para?: string[];
  status_envio: 'gerado' | 'enviado' | 'erro';
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface RelatorioUnidade {
  codigo_unidade: string;
  nome_franqueado: string;
  cidade: string;
  estado: string;
  total_cobrancas: number;
  valor_total_emitido: number;
  valor_em_aberto: number;
  valor_recuperado: number;
  cobrancas_vencidas: number;
  casos_juridicos: number;
  acordos_ativos: number;
  percentual_inadimplencia: number;
  taxa_recuperacao: number;
  status_geral: 'regular' | 'normal' | 'atencao' | 'critico';
  ultima_acao: string;
  data_ultima_acao?: string;
}

export interface PerformanceResponsavel {
  nome: string;
  total_acoes: number;
  cobrancas_resolvidas: number;
  valor_recuperado: number;
  tempo_medio_resolucao: number;
  tipos_acao: Record<string, number>;
  taxa_sucesso: number;
}

export interface DadosConsolidados {
  total_inadimplente: number;
  total_recuperado: number;
  total_cobrancas: number;
  unidades_inadimplentes: number;
  unidades_criticas: number;
  acordos_ativos: number;
  taxa_recuperacao: number;
  percentual_inadimplencia: number;
  valor_medio_cobranca: number;
  distribuicao_por_estado: Record<string, { total: number; valor: number }>;
  distribuicao_por_tipo: Record<string, { total: number; valor: number }>;
  evolucao_mensal: {
    mes: string;
    valor_emitido: number;
    valor_recuperado: number;
    valor_inadimplente: number;
  }[];
  casos_juridicos: {
    total_escalonados: number;
    valor_total_juridico: number;
    tempo_medio_resolucao: number;
  };
  parcelamentos: {
    total_simulacoes: number;
    total_aceites: number;
    valor_total_parcelado: number;
    taxa_conversao: number;
  };
}

export interface FiltroRelatorio {
  mes?: number;
  ano?: number;
  unidade?: string;
  estado?: string;
  tipo_cobranca?: string;
  status?: string;
  valor_min?: number;
  valor_max?: number;
  dataInicio?: string;
  dataFim?: string;
  incluir_quitados?: boolean;
}

export interface IndicadorEstrategico {
  nome: string;
  valor_atual: number;
  valor_anterior: number;
  variacao_percentual: number;
  tendencia: 'crescente' | 'decrescente' | 'estavel';
  meta?: number;
  status_meta: 'atingida' | 'nao_atingida' | 'sem_meta';
  descricao: string;
}

export interface RelatorioDetalhado {
  periodo: string;
  resumo_executivo: {
    total_carteira: number;
    inadimplencia_atual: number;
    recuperacao_periodo: number;
    casos_criticos: number;
    eficiencia_cobranca: number;
  };
  unidades: {
    codigo: string;
    nome: string;
    valor_em_aberto: number;
    valor_recuperado: number;
    percentual_inadimplencia: number;
    status: string;
    ultima_acao: string;
  }[];
  juridico: {
    casos_escalonados: number;
    valor_envolvido: number;
    casos_resolvidos: number;
    tempo_medio_resolucao: number;
  };
  parcelamentos: {
    propostas_enviadas: number;
    propostas_aceitas: number;
    valor_parcelado: number;
    taxa_sucesso: number;
  };
  alertas_criticos: {
    tipo: string;
    descricao: string;
    unidades_afetadas: number;
    valor_envolvido: number;
  }[];
}

export interface ExportacaoRelatorio {
  formato: 'pdf' | 'xlsx' | 'csv' | 'json';
  incluir_graficos: boolean;
  incluir_detalhes: boolean;
  incluir_historico: boolean;
  periodo_historico_meses: number;
}