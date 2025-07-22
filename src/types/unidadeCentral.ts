export interface UnidadeCentral {
  id?: string;
  codigo_unidade: string;
  codigo_oficial_franquia: string;
  nome_unidade: string;
  cnpj: string;
  razao_social: string;
  nome_franqueado_responsavel: string;
  nome_franqueado_principal?: string;
  endereco_completo: string;
  whatsapp_comercial?: string;
  email_comercial?: string;
  responsavel_financeiro?: string;
  instagram?: string;
  status_unidade: 'ativa' | 'inaugurando' | 'fechada' | 'em_tratativa';
  data_abertura?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CobrancaUnidade {
  id: string;
  valor_original: number;
  valor_atualizado: number;
  data_vencimento: string;
  status: 'em_aberto' | 'pago' | 'acordo' | 'negociacao' | 'escalonado';
  tipo: 'royalty' | 'insumo' | 'taxa_marketing' | 'outros';
  dias_atraso: number;
  created_at: string;
}

export interface ReuniaoUnidade {
  id: string;
  data_hora: string;
  participantes: string;
  status: 'confirmada' | 'realizada' | 'remarcada' | 'perdida';
  acoes_realizadas?: string;
  observacoes?: string;
  created_at: string;
}

export interface ComunicacaoUnidade {
  id: string;
  tipo: 'whatsapp' | 'email' | 'notificacao_formal';
  conteudo: string;
  data_envio: string;
  status_leitura: 'enviado' | 'entregue' | 'lido' | 'respondido';
  resposta?: string;
  created_at: string;
}

export interface DashboardUnidade {
  total_em_aberto: number;
  total_pago: number;
  percentual_inadimplencia: number;
  tendencia_regularizacao: number[];
  reunioes_mes: number;
  acordos_firmados: number;
  cobrancas_juridico: number;
}

export interface FiltrosUnidadeCentral {
  tipo_cobranca?: string;
  status_cobranca?: string;
  mes?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface VinculoFranqueado {
  franqueado_principal: string;
  outras_unidades: {
    codigo_unidade: string;
    nome_unidade: string;
    status: string;
    valor_em_aberto: number;
  }[];
  total_unidades: number;
  valor_total_grupo: number;
}