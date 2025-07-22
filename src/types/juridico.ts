export interface JuridicoLog {
  id?: string;
  cnpj_unidade: string;
  data_acao?: string;
  tipo_acao: string;
  motivo_acionamento: 'valor_alto' | 'cobrancas_ignoradas' | 'acordo_descumprido' | 'score_zero' | 'reincidencia_6_meses';
  valor_em_aberto: number;
  responsavel: string;
  documento_gerado_url?: string;
  observacoes?: string;
  status_anterior?: JuridicoStatus;
  status_novo?: JuridicoStatus;
  created_at?: string;
}

export interface NotificacaoExtrajudicial {
  id?: string;
  cnpj_unidade: string;
  tipo_notificacao: 'extrajudicial' | 'formal' | 'ultima_chance' | 'pre_judicial' | 'judicial';
  data_envio?: string;
  destinatario_email?: string;
  destinatario_whatsapp?: string;
  conteudo_notificacao: string;
  documento_pdf_url?: string;
  status_envio: 'pendente' | 'enviado' | 'entregue' | 'falha';
  data_prazo_resposta?: string;
  respondido: boolean;
  data_resposta?: string;
  observacoes_resposta?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CriteriosJuridico {
  id: string;
  valor_minimo_acionamento: number;
  dias_sem_retorno_limite: number;
  quantidade_cobrancas_ignoradas: number;
  score_minimo_acionamento: number;
  meses_reincidencia_limite: number;
  prazo_resposta_notificacao_dias: number;
  template_notificacao_extrajudicial: string;
  email_responsavel_juridico: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type JuridicoStatus = 'regular' | 'pendente_grave' | 'notificado' | 'em_analise' | 'pre_processo' | 'acionado' | 'resolvido';

export interface CriteriosVerificacao {
  deve_acionar: boolean;
  motivos: string[];
  valor_total: number;
  dias_atraso_max: number;
  cobrancas_ignoradas: number;
  acordos_quebrados: number;
  score_atual: number;
  reincidencia_meses: number;
}

export interface FiltrosJuridico {
  juridico_status?: string;
  motivo_acionamento?: string;
  dataInicio?: string;
  dataFim?: string;
  cnpj?: string;
  responsavel?: string;
  tipo_notificacao?: string;
}

export interface EstatisticasJuridico {
  total_notificados: number;
  total_em_analise: number;
  total_resolvidos: number;
  valor_total_acionado: number;
  tempo_medio_resolucao: number;
  taxa_resposta_notificacoes: number;
  por_motivo: Record<string, number>;
  evolucao_mensal: {
    mes: string;
    acionamentos: number;
    resolucoes: number;
  }[];
}

export interface AcionamentoJuridico {
  cnpj_unidade: string;
  motivo_principal: string;
  valor_envolvido: number;
  dias_atraso: number;
  historico_tratativas: number;
  score_risco: number;
  urgencia: 'baixa' | 'media' | 'alta' | 'critica';
}

export interface DocumentoJuridico {
  id?: string;
  tipo_documento: 'notificacao_extrajudicial' | 'termo_acordo' | 'carta_cobranca' | 'intimacao' | 'outros';
  cnpj_unidade: string;
  titulo: string;
  conteudo_html: string;
  arquivo_pdf_url?: string;
  data_geracao: string;
  gerado_por: string;
  status_documento: 'rascunho' | 'finalizado' | 'enviado' | 'respondido';
  prazo_resposta_dias?: number;
  data_prazo?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TermoAcordo {
  id?: string;
  cnpj_unidade: string;
  valor_original: number;
  valor_acordado: number;
  forma_pagamento: 'vista' | 'parcelado';
  quantidade_parcelas?: number;
  valor_parcela?: number;
  data_primeiro_vencimento?: string;
  multa_descumprimento: number;
  condicoes_especiais?: string;
  status_acordo: 'proposto' | 'aceito' | 'cumprindo' | 'cumprido' | 'descumprido';
  data_assinatura?: string;
  testemunhas?: string[];
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}