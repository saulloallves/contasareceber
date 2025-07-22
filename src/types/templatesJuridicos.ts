export interface TemplateJuridico {
  id?: string;
  nome: string;
  tipo_debito: 'royalty' | 'aluguel' | 'insumo' | 'multa';
  categoria: 'notificacao' | 'advertencia' | 'proposta_acordo' | 'intimacao_juridica';
  corpo_mensagem: string;
  canal_envio: 'whatsapp' | 'email' | 'painel';
  prazo_resposta_dias: number;
  acoes_apos_resposta?: string[];
  anexo_documento_url?: string;
  ativo: boolean;
  total_disparos?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GatilhoAutomatico {
  id?: string;
  nome: string;
  condicoes: string[];
  template_id: string;
  template_nome?: string;
  ativo: boolean;
  prioridade: 'baixa' | 'media' | 'alta';
  total_execucoes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface HistoricoDisparo {
  id?: string;
  template_id: string;
  template_nome?: string;
  gatilho_id?: string;
  cnpj_unidade: string;
  unidade_nome?: string;
  canal_utilizado: string;
  mensagem_enviada: string;
  data_envio: string;
  visualizado: boolean;
  data_visualizacao?: string;
  resultado?: 'aceito' | 'recusado' | 'ignorado' | 'respondido';
  observacoes?: string;
  created_at?: string;
}

export interface VariaveisTemplate {
  nome_unidade: string;
  codigo_unidade: string;
  cnpj: string;
  valor_total_em_aberto: number;
  dias_em_atraso: number;
  tipo_debito: string;
  data_vencimento: string;
  link_acordo?: string;
  data_reuniao_marcada?: string;
  nome_franqueado_principal: string;
}

export interface FiltrosTemplates {
  tipo_debito?: string;
  categoria?: string;
  ativo?: boolean;
  busca?: string;
  data_inicio?: string;
  data_fim?: string;
}

export interface EstatisticasTemplates {
  total_templates: number;
  gatilhos_ativos: number;
  disparos_mes: number;
  taxa_resposta: number;
}

export interface ConfiguracaoTemplates {
  id: string;
  valor_limite_gatilho: number;
  dias_reincidencia: number;
  backup_automatico: boolean;
  notificacao_disparos: boolean;
  horario_envio_inicio: string;
  horario_envio_fim: string;
  created_at?: string;
  updated_at?: string;
}

export interface CondicaoGatilho {
  tipo: 'valor_alto' | 'boletos_vencidos' | 'reuniao_perdida' | 'sem_resposta' | 'reincidencia';
  parametros: {
    valor_minimo?: number;
    quantidade_boletos?: number;
    dias_sem_resposta?: number;
    periodo_reincidencia?: number;
  };
}

export interface ResultadoGatilho {
  gatilho_executado: boolean;
  template_usado?: string;
  mensagem_enviada?: string;
  canal_utilizado?: string;
  motivo_nao_execucao?: string;
}