export interface CobrancaFranqueado {
  id?: string;
  cnpj: string;
  cliente: string;
  valor_original: number;
  valor_recebido: number;
  data_vencimento: string;
  dias_em_atraso?: number;
  valor_atualizado?: number;
  status: string;
  data_ultima_atualizacao?: string;
  referencia_importacao?: string;
  hash_titulo?: string;
  telefone?: string;
  created_at?: string;
  nivel_criticidade?: string;
}

export interface TrativativaCobranca {
  id?: string;
  titulo_id: string;
  data_interacao?: string;
  tipo_interacao: 'mensagem_automatica' | 'resposta_franqueado' | 'agendamento' | 'observacao_manual' | 'proposta_enviada' | 'proposta_aceita' | 'marcado_como_quitado' | 'negociacao_iniciada' | 'pagamento_parcial' | 'acordo_fechado';
  canal: 'whatsapp' | 'calendly' | 'interno' | 'email' | 'telefone' | 'presencial' | 'outro';
  usuario_sistema: string;
  descricao: string;
  status_cobranca_resultante?: string;
  anexos?: any;
  created_at?: string;
}

export interface EnvioMensagem {
  id?: string;
  titulo_id: string;
  cliente: string;
  cnpj: string;
  telefone: string;
  data_envio?: string;
  mensagem_enviada: string;
  status_envio: string;
  erro_detalhes?: string;
  referencia_importacao?: string;
  created_at?: string;
}

export interface ConfiguracaoWhatsApp {
  token: string;
  phone_number_id: string;
  link_negociacao?: string;
}

export interface ResultadoEnvioCobranca {
  sucesso: boolean;
  total_envios: number;
  envios_sucesso: number;
  envios_falha: number;
  detalhes: {
    titulo_id: string;
    cliente: string;
    status: 'sucesso' | 'falha';
    erro?: string;
  }[];
}

export interface HistoricoTratativas {
  cobranca: CobrancaFranqueado;
  tratativas: TrativativaCobranca[];
}