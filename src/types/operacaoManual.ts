export interface OperacaoManual {
  id?: string;
  tipo_operacao: 'cadastro_cobranca' | 'edicao_cobranca' | 'registro_tratativa' | 'geracao_notificacao' | 'cancelamento' | 'quitacao_manual';
  usuario: string;
  data_operacao?: string;
  cnpj_unidade: string;
  titulo_id?: string;
  dados_anteriores?: any;
  dados_novos?: any;
  justificativa: string;
  aprovado_por?: string;
  ip_origem?: string;
  created_at?: string;
}

export interface CobrancaManual {
  cnpj: string;
  codigo_unidade?: string;
  tipo_cobranca: 'royalties' | 'insumo' | 'multa' | 'taxa' | 'outros';
  descricao_cobranca: string;
  data_vencimento: string;
  valor_original: number;
  valor_atualizado?: number;
  status: 'em_aberto' | 'negociando' | 'quitado' | 'escalonado';
  motivo_cobranca: string;
  observacoes?: string;
}

export interface TrativativaManual {
  titulo_id: string;
  data_contato: string;
  tipo_contato: 'telefone' | 'email' | 'whatsapp' | 'presencial' | 'videoconferencia' | 'outros';
  resultado_contato: 'quitou' | 'renegociou' | 'prometeu_pagamento' | 'nao_respondeu' | 'reagendou' | 'contestou' | 'outros';
  observacoes_detalhadas: string;
  proximo_contato?: string;
  valor_negociado?: number;
  prazo_acordado?: string;
  anexos?: File[];
}

export interface NotificacaoManual {
  titulo_id: string;
  tipo_notificacao: 'advertencia' | 'reforco' | 'ultimo_aviso' | 'formal_juridica' | 'encerramento';
  modelo_template: string;
  canal_envio: 'email' | 'whatsapp' | 'correios' | 'todos';
  urgencia: 'baixa' | 'media' | 'alta' | 'critica';
  prazo_resposta_dias: number;
  observacoes?: string;
}

export interface CancelamentoManual {
  titulo_id: string;
  motivo_cancelamento: 'erro_sistema' | 'decisao_diretoria' | 'acordo_especial' | 'falha_contratual' | 'outros';
  justificativa_detalhada: string;
  aprovacao_necessaria: boolean;
  valor_cancelado: number;
  impacto_financeiro?: string;
}

export interface FiltrosOperacaoManual {
  tipo_operacao?: string;
  usuario?: string;
  dataInicio?: string;
  dataFim?: string;
  cnpj?: string;
  status_aprovacao?: string;
}

export interface EstatisticasOperacaoManual {
  total_operacoes: number;
  por_tipo: Record<string, number>;
  por_usuario: Record<string, number>;
  valor_total_impactado: number;
  operacoes_pendentes_aprovacao: number;
}