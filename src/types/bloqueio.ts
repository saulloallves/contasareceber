export interface BloqueioUnidade {
  id?: string;
  cnpj_unidade: string;
  status_bloqueio: 'ativo' | 'pendente' | 'desbloqueado' | 'em_analise';
  motivo_bloqueio: 'inadimplencia' | 'score_baixo' | 'nao_comparecimento' | 'quebra_acordo' | 'recusa_negociacao';
  valor_em_aberto: number;
  score_risco?: number;
  data_bloqueio?: string;
  data_desbloqueio?: string;
  notificacoes_enviadas: number;
  acessos_bloqueados: TipoAcesso[];
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export type TipoAcesso = 'solutto' | 'giragrama' | 'campanhas' | 'eventos' | 'girabot' | 'painel_franqueado';

export interface ConfiguracaoBloqueio {
  id: string;
  valor_minimo_bloqueio: number;
  score_minimo_bloqueio: number;
  dias_carencia: number;
  notificacoes_antes_bloqueio: number;
  acessos_bloqueados_padrao: TipoAcesso[];
  template_notificacao_bloqueio: string;
  template_notificacao_desbloqueio: string;
  webhook_solutto_url?: string;
  webhook_giragrama_url?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HistoricoBloqueio {
  id?: string;
  cnpj_unidade: string;
  acao: 'bloqueio' | 'desbloqueio' | 'notificacao' | 'tentativa_acesso';
  motivo: string;
  usuario_responsavel?: string;
  detalhes?: any;
  data_acao: string;
  created_at?: string;
}

export interface FiltrosBloqueio {
  status_bloqueio?: string;
  motivo_bloqueio?: string;
  dataInicio?: string;
  dataFim?: string;
  cnpj?: string;
  valor_min?: number;
  score_max?: number;
}

export interface EstatisticasBloqueio {
  total_bloqueados: number;
  total_pendentes: number;
  total_desbloqueados_mes: number;
  valor_total_bloqueado: number;
  por_motivo: Record<string, number>;
  por_tipo_acesso: Record<string, number>;
  tempo_medio_desbloqueio: number;
  efetividade_bloqueio: number;
}

export interface CriterioBloqueio {
  deve_bloquear: boolean;
  motivo: string;
  acessos_bloquear: TipoAcesso[];
  urgencia: 'baixa' | 'media' | 'alta' | 'critica';
}

export interface NotificacaoBloqueio {
  destinatario: string;
  assunto: string;
  mensagem: string;
  canal: 'email' | 'whatsapp' | 'ambos';
  template_usado: string;
}