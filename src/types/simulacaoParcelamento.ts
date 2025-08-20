export interface ISimulacaoParcelamento {
  id?: string;
  titulo_id: string;
  cnpj_unidade: string;
  valor_original: number;
  valor_atualizado: number;
  quantidade_parcelas: number;
  valor_entrada?: number;
  percentual_multa: number;
  percentual_juros_mora: number;
  data_primeira_parcela: string;
  parcelas: ParcelaSimulacao[];
  valor_total_parcelamento: number;
  economia_total?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ParcelaSimulacao {
  numero: number;
  valor: number;
  data_vencimento: string;
  juros_aplicado: number;
  multa: number;
  juros_mora: number;
}

export interface PropostaParcelamento {
  id?: string;
  simulacao_id: string;
  titulo_id: string;
  cnpj_unidade: string;
  mensagem_proposta: string;
  canais_envio: ('whatsapp' | 'email')[];
  data_envio?: string;
  enviado_por: string;
  status_proposta: 'enviada' | 'aceita' | 'recusada' | 'expirada';
  data_expiracao: string;
  aceito_em?: string;
  aceito_por?: string;
  ip_aceite?: string;
  observacoes_aceite?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RegistroAceite {
  id?: string;
  proposta_id: string;
  titulo_id: string;
  cnpj_unidade: string;
  data_aceite: string;
  ip_aceite: string;
  user_agent?: string;
  metodo_aceite: 'whatsapp' | 'email' | 'painel' | 'telefone';
  dados_proposta: any;
  observacoes?: string;
  created_at?: string;
}

export interface ConfiguracaoParcelamento {
  id: string;
  percentual_juros_parcela: number;
  valor_minimo_parcela: number;
  quantidade_maxima_parcelas: number;
  percentual_entrada_minimo?: number;
  dias_entre_parcelas: number;
  prazo_validade_proposta_dias: number;
  template_whatsapp: string;
  template_email_assunto: string;
  template_email_corpo: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FiltrosSimulacao {
  cnpj?: string;
  status_proposta?: string;
  data_inicio?: string;
  data_fim?: string;
  enviado_por?: string;
}

export interface EstatisticasParcelamento {
  total_simulacoes: number;
  propostas_enviadas: number;
  propostas_aceitas: number;
  propostas_recusadas: number;
  taxa_conversao: number;
  valor_total_parcelado: number;
  tempo_medio_resposta: number;
}