/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CardCobranca {
  id: string;
  codigo_unidade: string;
  nome_unidade: string;
  cnpj: string;
  tipo_debito: 'royalties' | 'insumos' | 'aluguel' | 'multa';
  valor_total: number;
  data_vencimento_antiga: string;
  data_vencimento_recente: string;
  status_atual: string;
  ultima_acao: string;
  data_ultima_acao: string;
  responsavel_atual: string;
  dias_parado: number;
  observacoes?: string;
  criticidade: 'normal' | 'atencao' | 'critica';
  data_entrada_etapa: string;
  // Campos opcionais para cobranças individuais
  descricao_cobranca?: string;
  valor_recebido?: number;
  quantidade_titulos?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ColunaKanban {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  ordem: number;
  ativa: boolean;
  limite_dias?: number;
  acao_automatica?: string;
}

export interface MovimentacaoCard {
  id?: string;
  card_id: string;
  status_origem: string;
  status_destino: string;
  usuario: string;
  motivo: string;
  data_movimentacao: string;
  automatica: boolean;
  observacoes?: string;
}

export interface FiltrosKanban {
  unidade?: string;
  tipo_debito?: string;
  responsavel?: string;
  criticidade?: string;
  valor_min?: number;
  valor_max?: number;
  dias_parado_min?: number;
}

export interface EstatisticasKanban {
  total_cards: number;
  cards_criticos: number;
  cards_parados: number;
  tempo_medio_resolucao: number;
  valor_total_fluxo: number;
  // Novos campos para clarificar totais
  // Soma do valor_original de todas as cobranças com status diferente de 'quitado'
  valor_total_original_aberto?: number;
  // Soma do valor_atualizado (ou valor_original se não houver atualizado) das cobranças em aberto
  valor_total_atualizado_aberto?: number;
  distribuicao_por_status: Record<string, number>;
  tempo_medio_por_etapa: Record<string, number>;
}

export interface AcaoRapida {
  tipo: 'whatsapp' | 'email' | 'reuniao' | 'juridico' | 'observacao' | 'mover';
  parametros?: any;
}

export interface LogMovimentacao {
  id?: string;
  card_id: string;
  acao: string;
  usuario: string;
  data_acao: string;
  detalhes: string;
  status_anterior?: string;
  status_novo?: string;
}