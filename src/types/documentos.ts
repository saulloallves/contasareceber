export interface DocumentoGerado {
  id?: string;
  tipo_documento: 'notificacao_inadimplencia' | 'notificacao_ausencia_tratativas' | 'notificacao_vencimento' | 'notificacao_quebra_acordo' | 'notificacao_preventiva' | 'carta_encerramento';
  titulo_id: string;
  unidade_id?: string;
  conteudo_html: string;
  arquivo_pdf_url?: string;
  data_criacao?: string;
  gerado_por: string;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentoCobranca {
  id?: string;
  titulo_id: string;
  cnpj_unidade: string;
  codigo_unidade?: string;
  nome_unidade: string;
  tipo_documento: 'notificacao_institucional' | 'comprovante_pagamento' | 'termo_acordo' | 'planilha_atualizada' | 'print_comunicacao' | 'resumo_reuniao' | 'documento_juridico' | 'outros';
  nome_arquivo: string;
  arquivo_url: string;
  tamanho_arquivo: number;
  formato_arquivo: string;
  data_upload?: string;
  usuario_responsavel: string;
  observacoes?: string;
  status_cobranca_vinculado: string;
  obrigatorio: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface VariaveisNotificacao {
  cliente: string;
  cnpj: string;
  codigo_unidade: string;
  endereco_completo?: string;
  responsavel_legal: string;
  valor_total_em_aberto: number;
  dias_em_atraso_max: number;
  data_vencimento_mais_antiga: string;
  qtd_reunioes_agendadas: number;
  ultima_tratativa_resumida: string;
  status_cobranca: string;
  tipo_notificacao: string;
  data_atual: string;
  prazo_regularizacao: number;
}

export interface TemplateNotificacao {
  tipo: DocumentoGerado['tipo_documento'];
  titulo: string;
  conteudo: string;
  prazo_dias: number;
  consequencia: string;
}

export interface FiltrosDocumentos {
  tipo_documento?: string;
  status_cobranca?: string;
  cnpj?: string;
  dataInicio?: string;
  dataFim?: string;
  usuario_responsavel?: string;
  obrigatorio?: boolean;
}

export interface EstatisticasDocumentos {
  total_documentos: number;
  por_tipo: Record<string, number>;
  documentos_pendentes: number;
  tamanho_total_mb: number;
  uploads_mes_atual: number;
}

export interface ChecklistDocumentos {
  status_cobranca: string;
  documentos_obrigatorios: {
    tipo: string;
    descricao: string;
    presente: boolean;
  }[];
  percentual_completude: number;
}