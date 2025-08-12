export interface CobrancaFranqueado {
  id?: string;
  cnpj: string;
  cliente: string;
  cliente_codigo?: string;
  tipo_cobranca?: string;
  email_cobranca?: string;
  descricao?: string;
  valor_original: number;
  valor_recebido?: number;
  data_vencimento: string;
  data_vencimento_original?: string;
  dias_em_atraso?: number;
  valor_atualizado?: number;
  status: string;
  data_ultima_atualizacao?: string;
  referencia_importacao?: string;
  hash_titulo?: string;
  telefone?: string;
  created_at?: string;
  nivel_criticidade?: string;
  unidades_franqueadas?: {
    id: string;
    codigo_unidade: string;
    nome_unidade: string;
    cidade: string;
    estado: string;
  };
}

export interface DadosPlanilha {
  cnpj: string;
  cliente: string;
  cliente_codigo?: string;
  tipo_cobranca?: string;
  valor_original: number;
  valor_recebido?: number;
  data_vencimento: string;
  data_vencimento_original?: string;
  descricao?: string;
  email_cobranca?: string;
  status: string;
}

export interface QuitacaoCobranca {
  cobrancaId: string;
  valorPago: number;
  formaPagamento: string;
  dataRecebimento: string;
  observacoes?: string;
  usuario: string;
}

export interface ResultadoQuitacao {
  sucesso: boolean;
  mensagem: string;
  isQuitacaoTotal?: boolean;
  valorRestante?: number;
}

export interface ConfiguracaoMensagemQuitacao {
  template_whatsapp: string;
  instance_name: string;
  enviar_automatico: boolean;
}

export interface TrativativaCobranca {
  id?: string;
  titulo_id: string;
  data_interacao?: string;
  tipo_interacao: 'mensagem_automatica' | 'resposta_franqueado' | 'agendamento' | 'observacao_manual' | 'proposta_enviada' | 'proposta_aceita' | 'marcado_como_quitado' | 'negociacao_iniciada' | 'pagamento_parcial' | 'acordo_fechado' | 'escalonamento';
  canal: 'whatsapp' | 'calendly' | 'interno' | 'email' | 'telefone' | 'presencial' | 'outro';
  usuario_sistema: string;
  descricao: string;
  status_cobranca_resultante?: string;
  anexos?: string;
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

export interface ResultadoImportacao {
  nome_arquivo?: string;
  usuario?: string;
  data_importacao?: string;
  total_linhas?: number;
  linhas_processadas?: number;
  linhas_falha?: number;
  linhas_sucesso?: number;
  detalhes_falha?: string[];
  sucesso: boolean;
  mensagem?: string;
  erros: string[];
  estatisticas?: {
    total_registros: number;
    novos_registros: number;
    registros_atualizados: number;
    registros_quitados: number;
    [key: string]: number;
  };
  importacao_id?: string;
}

export interface HistoricoTratativas {
  cobranca: CobrancaFranqueado;
  tratativas: TrativativaCobranca[];
}