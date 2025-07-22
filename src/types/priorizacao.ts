export interface CriterioPriorizacao {
  id?: string;
  valor_minimo_alta_prioridade: number;
  peso_valor_em_aberto: number;
  peso_tempo_inadimplencia: number;
  peso_multiplicidade_debitos: number;
  peso_tipo_debito: Record<string, number>;
  peso_status_unidade: Record<string, number>;
  dias_nivel_1: number; // Aviso amistoso
  dias_nivel_2: number; // Cobrança formal
  dias_nivel_3: number; // Reunião obrigatória
  dias_nivel_4: number; // Acordo última instância
  dias_nivel_5: number; // Escalonamento jurídico
  max_tentativas_por_nivel: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PriorizacaoUnidade {
  id?: string;
  cnpj_unidade: string;
  codigo_unidade: string;
  nome_franqueado: string;
  score_priorizacao: number;
  nivel_escalonamento: 1 | 2 | 3 | 4 | 5;
  valor_total_em_aberto: number;
  dias_inadimplencia_max: number;
  quantidade_debitos: number;
  tipos_debito: string[];
  status_unidade: 'critica' | 'ativa_atraso' | 'negociacao' | 'acordo';
  tentativas_contato_nivel: number;
  data_ultimo_contato?: string;
  data_proximo_escalonamento?: string;
  observacoes_priorizacao?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HistoricoEscalonamento {
  id?: string;
  cnpj_unidade: string;
  nivel_anterior: number;
  nivel_novo: number;
  motivo_escalonamento: string;
  score_anterior: number;
  score_novo: number;
  acao_automatica: boolean;
  usuario_responsavel?: string;
  data_escalonamento: string;
  created_at?: string;
}

export interface FilaCobranca {
  posicao: number;
  cnpj_unidade: string;
  nome_franqueado: string;
  score_priorizacao: number;
  nivel_escalonamento: number;
  valor_total: number;
  dias_atraso: number;
  proxima_acao: string;
  data_proxima_acao: string;
  status_atual: string;
}

export interface ConfiguracaoTipoDebito {
  tipo: string;
  peso: number;
  descricao: string;
  prioridade_alta: boolean;
}

export interface EstatisticasPriorizacao {
  total_unidades_fila: number;
  por_nivel: Record<number, number>;
  valor_total_priorizado: number;
  tempo_medio_resolucao: number;
  taxa_escalonamento_automatico: number;
  unidades_criticas: number;
}

export interface AcaoAutomatica {
  cnpj_unidade: string;
  nivel_atual: number;
  acao_recomendada: 'enviar_aviso' | 'agendar_reuniao' | 'gerar_acordo' | 'escalar_juridico' | 'aguardar';
  prazo_execucao: string;
  automatica: boolean;
  justificativa: string;
}