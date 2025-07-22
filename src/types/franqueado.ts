export interface AuthFranqueado {
  id?: string;
  cnpj: string;
  token_acesso?: string;
  token_expira_em?: string;
  ultimo_acesso?: string;
  ip_ultimo_acesso?: string;
  tentativas_login: number;
  bloqueado_ate?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LogAcessoFranqueado {
  id?: string;
  cnpj: string;
  ip_acesso?: string;
  user_agent?: string;
  acao: string;
  sucesso: boolean;
  detalhes?: any;
  data_acesso?: string;
}

export interface DadosFranqueado {
  unidade: {
    codigo_unidade: string;
    nome_franqueado: string;
    email_franqueado?: string;
    telefone_franqueado?: string;
    cidade?: string;
    estado?: string;
    status_unidade: string;
  };
  resumo_financeiro: {
    valor_total_em_aberto: number;
    quantidade_titulos_vencidos: number;
    data_vencimento_mais_antiga: string;
    status_geral: string;
    ultima_tratativa: string;
  };
  cobrancas: {
    id: string;
    valor_original: number;
    valor_atualizado: number;
    data_vencimento: string;
    dias_em_atraso: number;
    status: string;
  }[];
  reunioes: {
    id: string;
    data_agendada: string;
    data_realizada?: string;
    status_reuniao: string;
    decisao_final?: string;
    resumo_resultado?: string;
  }[];
  documentos: {
    id: string;
    tipo_documento: string;
    data_criacao: string;
    arquivo_pdf_url?: string;
  }[];
}

export interface SolicitacaoAuth {
  cnpj: string;
  email?: string;
  telefone?: string;
}

export interface RespostaAuth {
  sucesso: boolean;
  mensagem: string;
  token?: string;
  expira_em?: string;
}