export interface AcordoParcelamento {
  id?: string;
  parcelamento_master_id: string;
  cnpj_unidade: string;
  valor_original: number;
  valor_atualizado: number;
  valor_entrada: number;
  quantidade_parcelas: number;
  valor_parcela: number;
  valor_total_acordo: number;
  data_vencimento_entrada: string;
  data_primeiro_vencimento: string;
  status_acordo: 'proposto' | 'aceito' | 'cumprindo' | 'cumprido' | 'quebrado' | 'cancelado';
  aceito_em?: string;
  aceito_por?: string;
  ip_aceite?: string;
  observacoes?: string;
  acordo_anterior_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ParcelaAcordo {
  id?: string;
  acordo_id: string;
  numero_parcela: number;
  valor_parcela: number;
  data_vencimento: string;
  data_pagamento?: string;
  valor_pago?: number;
  status_parcela: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  boleto_url?: string;
  boleto_codigo?: string;
  dias_atraso?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SimulacaoParcelamento {
  valor_original: number;
  valor_atualizado: number;
  valor_entrada: number;
  quantidade_parcelas: number;
  valor_parcela: number;
  valor_total_acordo: number;
  data_entrada: string;
  data_primeira_parcela: string;
  parcelas: {
    numero: number;
    valor: number;
    vencimento: string;
  }[];
  economia_desconto?: number;
  juros_parcelamento?: number;
}

export interface ConfiguracaoAcordos {
  id: string;
  percentual_entrada_minimo: number;
  valor_parcela_minimo: number;
  quantidade_maxima_parcelas: number; // Agora suporta até 42 parcelas
  percentual_multa: number;
  percentual_juros_mes: number;
  percentual_desconto_entrada: number;
  dias_vencimento_entrada: number;
  dias_entre_parcelas: number;
  permite_renegociacao: boolean;
  max_acordos_quebrados: number;
  created_at?: string;
  updated_at?: string;
}

export interface HistoricoAceite {
  id?: string;
  acordo_id: string;
  cnpj_unidade: string;
  data_aceite: string;
  ip_aceite: string;
  user_agent?: string;
  metodo_aceite: 'whatsapp' | 'email' | 'painel' | 'presencial';
  documento_assinado?: string;
  testemunhas?: string[];
  created_at?: string;
}

export interface HistoricoRenegociacao {
  id?: string;
  acordo_anterior_id: string;
  acordo_novo_id: string;
  justificativa: string;
  aprovado_por: string;
  data_renegociacao: string;
  valor_anterior: number;
  valor_novo: number;
  created_at?: string;
}

export interface FiltrosAcordos {
  status_acordo?: string;
  cnpj?: string;
  dataInicio?: string;
  dataFim?: string;
  valor_min?: number;
  valor_max?: number;
}

export interface EstatisticasAcordos {
  total_acordos: number;
  acordos_ativos: number;
  acordos_cumpridos: number;
  acordos_quebrados: number;
  valor_total_acordado: number;
  valor_total_recebido: number;
  taxa_cumprimento: number;
  tempo_medio_cumprimento: number;
}

export interface ValidacaoAcordo {
  pode_fazer_acordo: boolean;
  motivo_bloqueio?: string;
  acordos_anteriores: number;
  acordos_quebrados: number;
  ultimo_acordo?: AcordoParcelamento;
}