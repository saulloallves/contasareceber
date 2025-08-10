/* eslint-disable @typescript-eslint/no-explicit-any */
// Tipos mínimos para compatibilidade com componentes e serviços atuais.
// Objetivo: sanar erro de parsing e permitir evolução gradual dos tipos.

export interface FiltroIndicadores {
  dataInicio?: string;
  dataFim?: string;
  regiao?: string;
  tipoCobranca?: string;
}

// Alias para manter compatibilidade com componentes que usam o plural
export type FiltrosIndicadores = FiltroIndicadores;

export interface IndicadorEstrategico {
  periodo: string;
  valorTotal: number;
  valorInadimplente: number;
  percentualInadimplencia: number;
  quantidadeUnidades: number | Set<string> | any; // compat
  quantidadeCobrancas: number;
}

export interface DashboardEstrategico {
  percentualInadimplencia: number;
  valorTotalInadimplente: number;
  evolucaoMensal: Array<{ mes: string; valor: number }>;
  taxaRecuperacaoAcordos: number;
  taxaReincidencia: number;
  unidadesCriticas: number;
  previsaoReceitaMes: number;
  unidadesRegularizadas: string[];
  sugestoesAutomaticas: SugestaoAutomatica[];
  alertasEstrategicos: AlertaEstrategico[];
}

export interface SugestaoAutomatica {
  tipo: 'acao_recomendada' | 'observacao' | string;
  titulo: string;
  descricao: string;
  prioridade: 'baixa' | 'media' | 'alta' | string;
  unidadeAfetada?: string;
}

export interface AlertaEstrategico {
  tipo: 'reincidencia' | 'inadimplencia' | string;
  titulo: string;
  descricao: string;
  nivel: 'info' | 'atencao' | 'critico' | string;
  dataDeteccao: string;
  unidadesAfetadas?: string[];
}

// Tipo abrangente usado pelo componente de Painel para exibição rica.
// Mantemos campos usados no componente e permitimos extensão por índice.
export interface IndicadoresEstrategicos {
  visao_geral_mensal: {
    total_devido: number;
    total_recuperado: number;
    percentual_inadimplencia: number;
    variacao_mes_anterior: {
      devido: number;
      recuperado: number;
      inadimplencia: number;
    };
  };
  reincidencia_criticos: {
    unidades_criticas: number;
    indicador_reincidencia_global: number;
  };
  [chave: string]: any; // permitir propriedades adicionais consumidas pelo componente
}
