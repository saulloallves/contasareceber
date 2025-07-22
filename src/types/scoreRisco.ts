export interface ScoreRisco {
  id?: string;
  cnpj_unidade: string;
  score_atual: number;
  nivel_risco: 'baixo' | 'medio' | 'alto';
  componentes_score: ComponentesScore;
  historico_score: HistoricoScore[];
  ultima_atualizacao?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ComponentesScore {
  atraso_medio: {
    valor: number;
    pontos: number;
    peso: number;
  };
  ocorrencias_90_dias: {
    valor: number;
    pontos: number;
    peso: number;
  };
  reincidencia: {
    quebrou_acordo: boolean;
    pontos: number;
    peso: number;
  };
  comparecimento_reunioes: {
    total_reunioes: number;
    faltas: number;
    pontos: number;
    peso: number;
  };
  tempo_regularizacao: {
    dias_ultima_regularizacao: number;
    pontos: number;
    peso: number;
  };
}

export interface HistoricoScore {
  data: string;
  score: number;
  nivel_risco: 'baixo' | 'medio' | 'alto';
  motivo_alteracao: string;
  componentes: ComponentesScore;
}

export interface ConfiguracaoScore {
  id: string;
  pesos: {
    atraso_medio: number;
    ocorrencias_90_dias: number;
    reincidencia: number;
    comparecimento_reunioes: number;
    tempo_regularizacao: number;
  };
  limites: {
    score_baixo_risco: number;
    score_medio_risco: number;
    score_alto_risco: number;
  };
  criterios_pontuacao: {
    atraso_medio: {
      ate_3_dias: number;
      de_4_a_10_dias: number;
      acima_10_dias: number;
    };
    ocorrencias: {
      ate_1: number;
      de_2_a_3: number;
      acima_4: number;
    };
    comparecimento: {
      todas_reunioes: number;
      faltou_1: number;
      faltou_2_ou_mais: number;
    };
    regularizacao: {
      ate_3_dias: number;
      de_4_a_7_dias: number;
      acima_8_dias: number;
    };
  };
  created_at?: string;
  updated_at?: string;
}

export interface FiltrosScore {
  nivel_risco?: string;
  score_min?: number;
  score_max?: number;
  cnpj?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface EstatisticasScore {
  total_unidades: number;
  distribuicao_risco: {
    baixo: number;
    medio: number;
    alto: number;
  };
  score_medio_geral: number;
  unidades_melhoraram: number;
  unidades_pioraram: number;
  ranking_piores: {
    cnpj: string;
    nome_franqueado: string;
    score: number;
    nivel_risco: string;
  }[];
}

export interface EventoScore {
  cnpj_unidade: string;
  tipo_evento: 'nova_cobranca' | 'pagamento' | 'acordo_quebrado' | 'reuniao_faltou' | 'regularizacao' | 'escalonamento';
  impacto_score: number;
  descricao: string;
  data_evento: string;
}