import { supabase } from './databaseService';
import { ScoreRisco, ComponentesScore, HistoricoScore, ConfiguracaoScore, FiltrosScore, EstatisticasScore, EventoScore } from '../types/scoreRisco';

export interface CriteriosJuridico {
  valor_minimo: number;
  cobracas_ignoradas_periodo: number;
  periodo_dias_cobrancas: number;
  score_risco_maximo: number;
  reincidencia_meses: number;
  considera_acordo_descumprido: boolean;
}

export class ScoreRiscoService {
  /**
   * Calcula score de risco para uma unidade
   */
  async calcularScore(cnpjUnidade: string): Promise<ScoreRisco> {
    try {
      // Busca configuração
      const config = await this.buscarConfiguracao();
      
      // Busca dados para cálculo
      const [cobrancas, reunioes, acordos] = await Promise.all([
        this.buscarCobrancasUnidade(cnpjUnidade),
        this.buscarReunioes(cnpjUnidade),
        this.buscarAcordos(cnpjUnidade)
      ]);

      // 1. Atraso médio em dias (25%)
      const atrasosEmDias = cobrancas
        .filter(c => c.status === 'em_aberto' && c.dias_em_atraso > 0)
        .map(c => c.dias_em_atraso);
      
      const atrasoMedio = atrasosEmDias.length > 0 
        ? atrasosEmDias.reduce((sum, dias) => sum + dias, 0) / atrasosEmDias.length 
        : 0;

      let pontosAtraso = 0;
      if (atrasoMedio <= 3) pontosAtraso = config.criterios_pontuacao.atraso_medio.ate_3_dias;
      else if (atrasoMedio <= 10) pontosAtraso = config.criterios_pontuacao.atraso_medio.de_4_a_10_dias;
      else pontosAtraso = config.criterios_pontuacao.atraso_medio.acima_10_dias;

      // 2. Ocorrências nos últimos 90 dias (25%)
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 90);
      
      const ocorrenciasRecentes = cobrancas.filter(c => 
        new Date(c.created_at || c.data_vencimento) >= dataLimite
      ).length;

      let pontosOcorrencias = 0;
      if (ocorrenciasRecentes <= 1) pontosOcorrencias = config.criterios_pontuacao.ocorrencias.ate_1;
      else if (ocorrenciasRecentes <= 3) pontosOcorrencias = config.criterios_pontuacao.ocorrencias.de_2_a_3;
      else pontosOcorrencias = config.criterios_pontuacao.ocorrencias.acima_4;

      // 3. Reincidência - quebra de acordo (20%)
      const quebrouAcordo = acordos.some(a => a.status_acordo === 'quebrado');
      const pontosReincidencia = quebrouAcordo ? 0 : 10;

      // 4. Comparecimento a reuniões (15%)
      const totalReunioes = reunioes.length;
      const faltasReunioes = reunioes.filter(r => r.status_reuniao === 'nao_compareceu').length;

      let pontosComparecimento = 0;
      if (totalReunioes === 0) {
        pontosComparecimento = 5; // Neutro se não teve reuniões
      } else if (faltasReunioes === 0) {
        pontosComparecimento = config.criterios_pontuacao.comparecimento.todas_reunioes;
      } else if (faltasReunioes === 1) {
        pontosComparecimento = config.criterios_pontuacao.comparecimento.faltou_1;
      } else {
        pontosComparecimento = config.criterios_pontuacao.comparecimento.faltou_2_ou_mais;
      }

      // 5. Tempo de regularização (15%)
      const ultimaQuitacao = cobrancas
        .filter(c => c.status === 'quitado')
        .sort((a, b) => new Date(b.data_ultima_atualizacao || b.created_at || '').getTime() - 
                       new Date(a.data_ultima_atualizacao || a.created_at || '').getTime())[0];

      let diasRegularizacao = 0;
      let pontosRegularizacao = 5; // Neutro se não há histórico

      if (ultimaQuitacao) {
        const vencimento = new Date(ultimaQuitacao.data_vencimento);
        const quitacao = new Date(ultimaQuitacao.data_ultima_atualizacao || ultimaQuitacao.created_at || '');
        diasRegularizacao = Math.max(0, Math.floor((quitacao.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24)));

        if (diasRegularizacao <= 3) pontosRegularizacao = config.criterios_pontuacao.regularizacao.ate_3_dias;
        else if (diasRegularizacao <= 7) pontosRegularizacao = config.criterios_pontuacao.regularizacao.de_4_a_7_dias;
        else pontosRegularizacao = config.criterios_pontuacao.regularizacao.acima_8_dias;
      }

      // Calcula score final ponderado
      const componentes: ComponentesScore = {
        atraso_medio: {
          valor: atrasoMedio,
          pontos: pontosAtraso,
          peso: config.pesos.atraso_medio
        },
        ocorrencias_90_dias: {
          valor: ocorrenciasRecentes,
          pontos: pontosOcorrencias,
          peso: config.pesos.ocorrencias_90_dias
        },
        reincidencia: {
          quebrou_acordo: quebrouAcordo,
          pontos: pontosReincidencia,
          peso: config.pesos.reincidencia
        },
        comparecimento_reunioes: {
          total_reunioes: totalReunioes,
          faltas: faltasReunioes,
          pontos: pontosComparecimento,
          peso: config.pesos.comparecimento_reunioes
        },
        tempo_regularizacao: {
          dias_ultima_regularizacao: diasRegularizacao,
          pontos: pontosRegularizacao,
          peso: config.pesos.tempo_regularizacao
        }
      };

      const scoreFinal = Math.round(
        (componentes.atraso_medio.pontos * componentes.atraso_medio.peso / 100) +
        (componentes.ocorrencias_90_dias.pontos * componentes.ocorrencias_90_dias.peso / 100) +
        (componentes.reincidencia.pontos * componentes.reincidencia.peso / 100) +
        (componentes.comparecimento_reunioes.pontos * componentes.comparecimento_reunioes.peso / 100) +
        (componentes.tempo_regularizacao.pontos * componentes.tempo_regularizacao.peso / 100)
      );

      // Determina nível de risco
      let nivelRisco: 'baixo' | 'medio' | 'alto' = 'alto';
      if (scoreFinal >= config.limites.score_baixo_risco) {
        nivelRisco = 'baixo';
      } else if (scoreFinal >= config.limites.score_medio_risco) {
        nivelRisco = 'medio';
      }

      return {
        cnpj_unidade: cnpjUnidade,
        score_atual: scoreFinal,
        nivel_risco: nivelRisco,
        componentes_score: componentes,
        historico_score: [],
        ultima_atualizacao: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro ao calcular score:', error);
      throw error;
    }
  }

  /**
   * Atualiza score no banco de dados
   */
  async atualizarScore(cnpjUnidade: string, motivo?: string): Promise<ScoreRisco> {
    try {
      const novoScore = await this.calcularScore(cnpjUnidade);
      
      // Busca score anterior
      const { data: scoreAnterior } = await supabase
        .from('score_risco_unidades')
        .select('*')
        .eq('cnpj_unidade', cnpjUnidade)
        .single();

      // Adiciona ao histórico se houve mudança significativa
      if (scoreAnterior && Math.abs(scoreAnterior.score_atual - novoScore.score_atual) >= 5) {
        const novoHistorico: HistoricoScore = {
          data: new Date().toISOString(),
          score: novoScore.score_atual,
          nivel_risco: novoScore.nivel_risco,
          motivo_alteracao: motivo || 'Recálculo automático',
          componentes: novoScore.componentes_score
        };

        novoScore.historico_score = [
          ...(scoreAnterior.historico_score || []),
          novoHistorico
        ].slice(-12); // Mantém últimos 12 registros
      } else {
        novoScore.historico_score = scoreAnterior?.historico_score || [];
      }

      // Salva no banco
      const { data, error } = await supabase
        .from('score_risco_unidades')
        .upsert(novoScore)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao salvar score: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao atualizar score:', error);
      throw error;
    }
  }

  /**
   * Processa evento que impacta o score
   */
  async processarEvento(evento: EventoScore): Promise<void> {
    try {
      await this.atualizarScore(evento.cnpj_unidade, evento.descricao);
      
      // Registra o evento
      await supabase
        .from('eventos_score')
        .insert({
          cnpj_unidade: evento.cnpj_unidade,
          tipo_evento: evento.tipo_evento,
          impacto_score: evento.impacto_score,
          descricao: evento.descricao,
          data_evento: evento.data_evento
        });
    } catch (error) {
      console.error('Erro ao processar evento:', error);
      throw error;
    }
  }

  /**
   * Busca scores com filtros
   */
  async buscarScores(filtros: FiltrosScore = {}) {
    try {
      let query = supabase
        .from('score_risco_unidades')
        .select(`
          *,
          unidades_franqueadas (
            nome_franqueado,
            cidade,
            estado,
            status_unidade
          )
        `)
        .order('score_atual', { ascending: true });

      if (filtros.nivel_risco) {
        query = query.eq('nivel_risco', filtros.nivel_risco);
      }

      if (filtros.score_min !== undefined) {
        query = query.gte('score_atual', filtros.score_min);
      }

      if (filtros.score_max !== undefined) {
        query = query.lte('score_atual', filtros.score_max);
      }

      if (filtros.cnpj) {
        query = query.ilike('cnpj_unidade', `%${filtros.cnpj}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar scores: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar scores:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas dos scores
   */
  async buscarEstatisticas(): Promise<EstatisticasScore> {
    try {
      const { data: scores } = await supabase
        .from('score_risco_unidades')
        .select(`
          score_atual,
          nivel_risco,
          cnpj_unidade,
          historico_score,
          unidades_franqueadas (
            nome_franqueado
          )
        `);

      if (!scores) {
        return this.getEstatisticasVazias();
      }

      const stats: EstatisticasScore = {
        total_unidades: scores.length,
        distribuicao_risco: {
          baixo: scores.filter(s => s.nivel_risco === 'baixo').length,
          medio: scores.filter(s => s.nivel_risco === 'medio').length,
          alto: scores.filter(s => s.nivel_risco === 'alto').length
        },
        score_medio_geral: scores.reduce((sum, s) => sum + s.score_atual, 0) / scores.length,
        unidades_melhoraram: 0,
        unidades_pioraram: 0,
        ranking_piores: scores
          .sort((a, b) => a.score_atual - b.score_atual)
          .slice(0, 10)
          .map(s => ({
            cnpj: s.cnpj_unidade,
            nome_franqueado: (s as any).unidades_franqueadas?.nome_franqueado || 'N/A',
            score: s.score_atual,
            nivel_risco: s.nivel_risco
          }))
      };

      // Calcula tendências baseado no histórico
      scores.forEach(score => {
        if (score.historico_score && score.historico_score.length >= 2) {
          const ultimoScore = score.historico_score[score.historico_score.length - 1];
          const penultimoScore = score.historico_score[score.historico_score.length - 2];
          
          if (ultimoScore.score > penultimoScore.score) {
            stats.unidades_melhoraram++;
          } else if (ultimoScore.score < penultimoScore.score) {
            stats.unidades_pioraram++;
          }
        }
      });

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return this.getEstatisticasVazias();
    }
  }

  /**
   * Atualiza scores em lote
   */
  async atualizarScoresLote(): Promise<number> {
    try {
      // Busca todas as unidades ativas
      const { data: unidades } = await supabase
        .from('unidades_franqueadas')
        .select('codigo_unidade')
        .eq('status_unidade', 'ativa');

      if (!unidades) return 0;

      let atualizados = 0;
      for (const unidade of unidades) {
        try {
          await this.atualizarScore(unidade.codigo_unidade, 'Atualização em lote');
          atualizados++;
        } catch (error) {
          console.error(`Erro ao atualizar score da unidade ${unidade.codigo_unidade}:`, error);
        }
      }

      return atualizados;
    } catch (error) {
      console.error('Erro na atualização em lote:', error);
      throw error;
    }
  }

  /**
   * Busca configuração do score
   */
  private async buscarConfiguracao(): Promise<ConfiguracaoScore> {
    const { data, error } = await supabase
      .from('configuracao_score')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      // Retorna configuração padrão
      return {
        id: 'default',
        pesos: {
          atraso_medio: 25,
          ocorrencias_90_dias: 25,
          reincidencia: 20,
          comparecimento_reunioes: 15,
          tempo_regularizacao: 15
        },
        limites: {
          score_baixo_risco: 80,
          score_medio_risco: 50,
          score_alto_risco: 0
        },
        criterios_pontuacao: {
          atraso_medio: {
            ate_3_dias: 10,
            de_4_a_10_dias: 5,
            acima_10_dias: 0
          },
          ocorrencias: {
            ate_1: 10,
            de_2_a_3: 5,
            acima_4: 0
          },
          comparecimento: {
            todas_reunioes: 10,
            faltou_1: 5,
            faltou_2_ou_mais: 0
          },
          regularizacao: {
            ate_3_dias: 10,
            de_4_a_7_dias: 5,
            acima_8_dias: 0
          }
        }
      };
    }

    return data;
  }

  /**
   * Busca dados da unidade para cálculo
   */
  private async buscarCobrancasUnidade(cnpjUnidade: string) {
    const { data } = await supabase
      .from('cobrancas_franqueados')
      .select('*')
      .eq('cnpj', cnpjUnidade);
    return data || [];
  }

  private async buscarReunioes(cnpjUnidade: string) {
    const { data } = await supabase
      .from('reunioes_negociacao')
      .select('*')
      .eq('cnpj_unidade', cnpjUnidade);
    return data || [];
  }

  private async buscarAcordos(cnpjUnidade: string) {
    const { data } = await supabase
      .from('acordos_parcelamento')
      .select('*')
      .eq('cnpj_unidade', cnpjUnidade);
    return data || [];
  }

  private getEstatisticasVazias(): EstatisticasScore {
    return {
      total_unidades: 0,
      distribuicao_risco: { baixo: 0, medio: 0, alto: 0 },
      score_medio_geral: 0,
      unidades_melhoraram: 0,
      unidades_pioraram: 0,
      ranking_piores: []
    };
  }

  /**
   * Exporta dados dos scores
   */
  async exportarScores(filtros: FiltrosScore = {}): Promise<string> {
    try {
      const scores = await this.buscarScores(filtros);
      
      // Cabeçalho CSV
      const cabecalho = [
        'CNPJ',
        'Nome Franqueado',
        'Score Atual',
        'Nível Risco',
        'Atraso Médio',
        'Ocorrências 90d',
        'Quebrou Acordo',
        'Faltas Reunião',
        'Dias Regularização',
        'Última Atualização'
      ].join(',');

      // Dados
      const linhas = scores.map(score => [
        score.cnpj_unidade,
        (score as any).unidades_franqueadas?.nome_franqueado || '',
        score.score_atual,
        score.nivel_risco,
        score.componentes_score.atraso_medio.valor.toFixed(1),
        score.componentes_score.ocorrencias_90_dias.valor,
        score.componentes_score.reincidencia.quebrou_acordo ? 'Sim' : 'Não',
        score.componentes_score.comparecimento_reunioes.faltas,
        score.componentes_score.tempo_regularizacao.dias_ultima_regularizacao,
        new Date(score.ultima_atualizacao!).toLocaleDateString('pt-BR')
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar scores:', error);
      throw error;
    }
  }

  /**
   * Verifica se uma unidade atende aos novos critérios para acionamento jurídico
   * Critérios definidos pelo chefe:
   * 1. Valor em aberto superior a R$ 5.000
   * 2. 3 ou mais cobranças ignoradas em 15 dias
   * 3. Score de risco igual a zero
   * 4. Acordo firmado e descumprido
   * 5. Reincidência em período de 6 meses
   */
  async verificarCriteriosJuridico(cnpjUnidade: string): Promise<{
    atende: boolean;
    criterios: {
      valorSuperior5k: boolean;
      cobrancasIgnoradas: boolean;
      scoreZero: boolean;
      acordoDescumprido: boolean;
      reincidencia: boolean;
    };
    detalhes: {
      valorTotal: number;
      numeroCobrancasIgnoradas: number;
      scoreAtual: number;
      temAcordoDescumprido: boolean;
      temReincidencia: boolean;
    };
  }> {
    try {
      // 1. Verifica valor total em aberto
      const { data: cobrancasAbertas } = await supabase
        .from("cobrancas_franqueados")
        .select("valor_original, valor_atualizado")
        .eq("cnpj", cnpjUnidade)
        .eq("status", "em_aberto");

      const valorTotal = (cobrancasAbertas || []).reduce(
        (total, cobranca) => total + (cobranca.valor_atualizado || cobranca.valor_original),
        0
      );

      // 2. Verifica cobranças ignoradas nos últimos 15 dias
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 15);

      const { data: cobrancasIgnoradas } = await supabase
        .from("cobrancas_franqueados")
        .select("id")
        .eq("cnpj", cnpjUnidade)
        .eq("status", "em_aberto")
        .eq("aviso_de_debito_enviado", true)
        .is("resposta_cliente", null)
        .gte("data_ultimo_envio", dataLimite.toISOString());

      // 3. Verifica score de risco atual
      const { data: scoreRisco } = await supabase
        .from("score_risco_unidades")
        .select("score_atual")
        .eq("cnpj_unidade", cnpjUnidade)
        .single();

      // 4. Verifica acordos descumpridos
      const { data: acordosDescumpridos } = await supabase
        .from("acordos_parcelamento")
        .select("id")
        .eq("cnpj_cliente", cnpjUnidade)
        .eq("status", "descumprido");

      // 5. Verifica reincidência nos últimos 6 meses
      const dataReincidencia = new Date();
      dataReincidencia.setMonth(dataReincidencia.getMonth() - 6);

      const { data: escalonamentosAnteriores } = await supabase
        .from("escalonamentos_cobranca")
        .select("id")
        .eq("cnpj_unidade", cnpjUnidade)
        .eq("nivel", "juridico")
        .gte("created_at", dataReincidencia.toISOString());

      // Avalia critérios
      const criterios = {
        valorSuperior5k: valorTotal > 5000,
        cobrancasIgnoradas: (cobrancasIgnoradas?.length || 0) >= 3,
        scoreZero: scoreRisco?.score_atual === 0,
        acordoDescumprido: (acordosDescumpridos?.length || 0) > 0,
        reincidencia: (escalonamentosAnteriores?.length || 0) > 0,
      };

      const detalhes = {
        valorTotal,
        numeroCobrancasIgnoradas: cobrancasIgnoradas?.length || 0,
        scoreAtual: scoreRisco?.score_atual || -1,
        temAcordoDescumprido: criterios.acordoDescumprido,
        temReincidencia: criterios.reincidencia,
      };

      // Para atender aos critérios, deve ter TODOS os critérios básicos:
      // - Valor superior a 5k
      // - 3+ cobranças ignoradas
      // - Score zero
      // E pelo menos UM dos critérios adicionais:
      // - Acordo descumprido OU reincidência
      const atende = 
        criterios.valorSuperior5k &&
        criterios.cobrancasIgnoradas &&
        criterios.scoreZero &&
        (criterios.acordoDescumprido || criterios.reincidencia);

      return { atende, criterios, detalhes };
    } catch (error) {
      console.error("Erro ao verificar critérios jurídico:", error);
      return {
        atende: false,
        criterios: {
          valorSuperior5k: false,
          cobrancasIgnoradas: false,
          scoreZero: false,
          acordoDescumprido: false,
          reincidencia: false,
        },
        detalhes: {
          valorTotal: 0,
          numeroCobrancasIgnoradas: 0,
          scoreAtual: -1,
          temAcordoDescumprido: false,
          temReincidencia: false,
        },
      };
    }
  }

  /**
   * Lista unidades que atendem aos critérios de acionamento jurídico
   */
  async listarUnidadesElegiveis(): Promise<Array<{
    cnpj: string;
    nome_franqueado: string;
    valor_total_aberto: number;
    score_atual: number;
    cobrancas_ignoradas: number;
    tem_acordo_descumprido: boolean;
    tem_reincidencia: boolean;
    atende_criterios: boolean;
  }>> {
    try {
      // Busca unidades com score zero primeiro (pré-requisito)
      const { data: unidadesComScoreZero } = await supabase
        .from("score_risco_unidades")
        .select("cnpj_unidade")
        .eq("score_atual", 0);

      if (!unidadesComScoreZero) return [];

      const resultados = [];
      
      // Limita a verificação a 50 unidades para não sobrecarregar
      for (const unidade of unidadesComScoreZero.slice(0, 50)) {
        const criterios = await this.verificarCriteriosJuridico(unidade.cnpj_unidade);
        
        // Busca nome da unidade
        const { data: dadosUnidade } = await supabase
          .from("unidades_franqueadas")
          .select("nome_franqueado")
          .eq("cnpj", unidade.cnpj_unidade)
          .single();

        resultados.push({
          cnpj: unidade.cnpj_unidade,
          nome_franqueado: dadosUnidade?.nome_franqueado || "Não informado",
          valor_total_aberto: criterios.detalhes.valorTotal,
          score_atual: criterios.detalhes.scoreAtual,
          cobrancas_ignoradas: criterios.detalhes.numeroCobrancasIgnoradas,
          tem_acordo_descumprido: criterios.detalhes.temAcordoDescumprido,
          tem_reincidencia: criterios.detalhes.temReincidencia,
          atende_criterios: criterios.atende,
        });
      }

      // Ordena por critérios atendidos primeiro, depois por valor
      return resultados.sort((a, b) => {
        if (a.atende_criterios && !b.atende_criterios) return -1;
        if (!a.atende_criterios && b.atende_criterios) return 1;
        return b.valor_total_aberto - a.valor_total_aberto;
      });
    } catch (error) {
      console.error("Erro ao listar unidades elegíveis:", error);
      return [];
    }
  }

  /**
   * Busca unidades com score zero (primeiro critério para jurídico)
   */
  async listarUnidadesScoreZero(): Promise<Array<{
    cnpj_unidade: string;
    nome_franqueado: string;
    score_atual: number;
    nivel_risco: string;
    ultima_atualizacao: string;
  }>> {
    try {
      const { data: unidades, error } = await supabase
        .from("score_risco_unidades")
        .select(`
          cnpj_unidade,
          score_atual,
          nivel_risco,
          ultima_atualizacao,
          unidades_franqueadas!score_risco_unidades_cnpj_unidade_fkey (
            nome_franqueado
          )
        `)
        .eq("score_atual", 0)
        .order("ultima_atualizacao", { ascending: false });

      if (error) {
        console.error("Erro ao buscar unidades com score zero:", error);
        return [];
      }

      return (unidades || []).map(u => ({
        cnpj_unidade: u.cnpj_unidade,
        nome_franqueado: (u as any).unidades_franqueadas?.nome_franqueado || "Não informado",
        score_atual: u.score_atual,
        nivel_risco: u.nivel_risco,
        ultima_atualizacao: u.ultima_atualizacao,
      }));
    } catch (error) {
      console.error("Erro ao listar unidades com score zero:", error);
      return [];
    }
  }
}