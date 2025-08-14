/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UnidadeFranqueada {
  id?: string;
  codigo_unidade: string;
  codigo_interno?: string;
  nome_franqueado: string;
  franqueado_principal: boolean;
  email_franqueado?: string;
  telefone_franqueado?: string;
  cidade?: string;
  estado?: string;
  endereco_completo?: string;
  status_unidade: 'ativa' | 'inaugurando' | 'fechada' | 'em_tratativa';
  data_abertura?: string;
  observacoes_unidade?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReuniaoNegociacao {
  id?: string;
  titulo_id: string;
  cnpj_unidade?: string;
  codigo_unidade?: string;
  data_agendada: string;
  data_realizada?: string;
  status_reuniao: 'agendada' | 'realizada' | 'remarcada' | 'nao_compareceu' | 'cancelada';
  responsavel_reuniao: string;
  resumo_resultado?: string;
  decisao_final?: 'quitado' | 'parcela_futura' | 'sem_acordo' | 'rever';
  disparo_aviso?: boolean;
  link_reuniao?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RegistroInteracao {
  id?: string;
  codigo_unidade: string;
  cnpj_unidade: string;
  nome_franqueado: string;
  data_interacao: string;
  canal_contato: 'ligacao' | 'whatsapp' | 'email' | 'presencial' | 'videoconferencia' | 'outro';
  colaborador_responsavel: string;
  motivo_contato: 'lembrete_vencimento' | 'proposta_acordo' | 'negociacao' | 'notificacao_inadimplencia' | 'acordo_descumprido' | 'escalonamento_juridico' | 'outro';
  resultado_contato: 'compareceu' | 'nao_compareceu' | 'remarcado' | 'sem_resposta' | 'negociacao_aceita' | 'negociacao_recusada' | 'acordo_formalizado' | 'outro';
  resumo_conversa: string;
  documento_anexado?: string;
  link_acordo?: string;
  comentarios_internos?: string;
  proximo_contato?: string;
  valor_negociado?: number;
  prazo_acordado?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FiltrosUnidades {
  status?: string;
  estado?: string;
  franqueado_principal?: boolean;
  busca?: string;
}

export interface FiltrosReunioes {
  status_reuniao?: string;
  responsavel?: string;
  dataInicio?: string;
  dataFim?: string;
  decisao_final?: string;
  codigo_unidade?: string;
}

export interface FiltrosInteracoes {
  canal_contato?: string;
  motivo_contato?: string;
  resultado_contato?: string;
  colaborador?: string;
  dataInicio?: string;
  dataFim?: string;
  codigo_unidade?: string;
  cnpj?: string;
}

export interface EstatisticasReunioes {
  total_agendadas: number;
  total_realizadas: number;
  total_nao_compareceu: number;
  total_remarcadas: number;
  taxa_comparecimento: number;
  reunioes_pendentes: number;
}

export interface EstatisticasInteracoes {
  total_interacoes: number;
  por_canal: Record<string, number>;
  por_resultado: Record<string, number>;
  taxa_sucesso: number;
  tempo_medio_resposta: number;
  interacoes_mes_atual: number;
}

export interface TimelineUnidade {
  unidade: UnidadeFranqueada;
  interacoes: RegistroInteracao[];
  reunioes: ReuniaoNegociacao[];
  acordos: any[];
  documentos: any[];
}