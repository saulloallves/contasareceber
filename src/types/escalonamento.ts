export interface EscalonamentoCobranca {
  id?: string;
  titulo_id: string;
  cnpj_unidade?: string;
  data_escalonamento?: string;
  motivo_escalonamento: string;
  enviado_para: string;
  nivel: 'juridico' | 'diretoria' | 'auditoria';
  documento_gerado: boolean;
  responsavel_designado?: string;
  status: 'pendente' | 'em_analise' | 'encerrado' | 'resolvido';
  valor_total_envolvido: number;
  quantidade_titulos: number;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CriterioEscalonamento {
  deve_escalar: boolean;
  motivo: string;
  nivel: 'juridico' | 'diretoria' | 'auditoria';
  valor_envolvido: number;
}

export interface FiltrosEscalonamento {
  status?: string;
  nivel?: string;
  responsavel?: string;
  dataInicio?: string;
  dataFim?: string;
  cnpj?: string;
}

export interface EstatisticasEscalonamento {
  total_pendentes: number;
  total_em_analise: number;
  total_encerrados: number;
  total_resolvidos: number;
  valor_total_envolvido: number;
  tempo_medio_resolucao: number;
}

export interface NotificacaoEscalonamento {
  id: string;
  escalonamento_id: string;
  tipo: 'email' | 'slack' | 'whatsapp';
  destinatario: string;
  enviado_em: string;
  status: 'enviado' | 'falha' | 'pendente';
}

export interface PontuacaoRisco {
  id?: string;
  cnpj_unidade: string;
  pontuacao_atual: number;
  nivel_risco: 'baixo' | 'moderado' | 'critico';
  ultima_atualizacao?: string;
  historico_pontos: HistoricoPonto[];
  alertas_ativos: AlertaAtivo[];
}

export interface HistoricoPonto {
  data: string;
  motivo: string;
  pontos_adicionados: number;
  pontuacao_total: number;
  usuario?: string;
}

export interface AlertaAtivo {
  id?: string;
  tipo: 'interno' | 'equipe' | 'juridico';
  titulo: string;
  descricao: string;
  nivel_urgencia: 'baixa' | 'media' | 'alta' | 'critica';
  data_criacao: string;
  data_resolucao?: string;
  resolvido: boolean;
  acao_automatica?: string;
}

export interface ConfiguracaoRisco {
  id: string;
  atraso_10_dias: number;
  nao_comparecimento: number;
  nao_resposta_consecutiva: number;
  notificacao_anterior: number;
  parcelamento_nao_cumprido: number;
  acionamento_juridico_anterior: number;
  reincidencia_valor_alto: number;
  limite_risco_baixo: number;
  limite_risco_moderado: number;
  limite_risco_critico: number;
  valor_minimo_reincidencia: number;
  max_alertas_por_dia: number;
  max_acoes_automaticas_semana: number;
}

export interface EventoRisco {
  cnpj_unidade: string;
  tipo_evento: 'atraso' | 'nao_comparecimento' | 'nao_resposta' | 'notificacao' | 'parcelamento_quebrado' | 'acionamento_juridico' | 'reincidencia';
  pontos: number;
  descricao: string;
  titulo_id?: string;
  reuniao_id?: string;
  data_evento: string;
}

export interface MonitoramentoRisco {
  cnpj_unidade: string;
  nome_franqueado: string;
  codigo_unidade: string;
  valor_em_risco: number;
  grau_risco: 'baixo' | 'medio' | 'alto' | 'critico';
  sinais_detectados: string[];
  ultima_acao: string;
  data_ultima_acao: string;
  proxima_acao_sugerida: string;
  prazo_acao: string;
  responsavel_designado?: string;
}

export interface GatilhoAutomatico {
  id?: string;
  tipo_gatilho: 'cobranca_multipla' | 'acordo_vencido' | 'sem_resposta' | 'valor_alto' | 'reincidencia';
  condicoes: {
    dias_limite?: number;
    valor_minimo?: number;
    quantidade_ocorrencias?: number;
    periodo_analise_dias?: number;
  };
  acoes_automaticas: {
    enviar_alerta_responsavel: boolean;
    enviar_mensagem_franqueado: boolean;
    marcar_prioridade: boolean;
    escalar_juridico: boolean;
    template_mensagem?: string;
  };
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AcaoPendente {
  id?: string;
  cnpj_unidade: string;
  nome_franqueado: string;
  tipo_acao: 'aguardando_contato' | 'gerar_notificacao' | 'aguardando_reuniao' | 'reescalar' | 'acompanhar_acordo';
  descricao: string;
  prazo_limite: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  responsavel: string;
  valor_envolvido: number;
  data_criacao: string;
  data_limite: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'vencida';
}

export interface RegistroGatilho {
  id?: string;
  cnpj_unidade: string;
  tipo_gatilho: string;
  condicoes_atendidas: any;
  acoes_executadas: string[];
  responsaveis_notificados: string[];
  data_execucao: string;
  sucesso: boolean;
  detalhes_erro?: string;
  visualizado_por?: string[];
  acao_tomada?: string;
  usuario_acao?: string;
  data_acao?: string;
}

export interface DashboardRiscos {
  unidades_em_risco_mes: number;
  evolucao_risco_medio: number[];
  unidades_criticas: number;
  tempo_medio_resposta: number;
  gatilhos_acionados_mes: number;
  acoes_pendentes: number;
  taxa_resolucao: number;
  distribuicao_por_tipo: Record<string, number>;
}