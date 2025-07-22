import { createClient } from '@supabase/supabase-js';
import { CriterioPriorizacao, PriorizacaoUnidade, HistoricoEscalonamento, FilaCobranca, EstatisticasPriorizacao, AcaoAutomatica } from '../types/priorizacao';
import { TrativativasService } from './tratativasService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class PriorizacaoService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Calcula score de priorização para uma unidade
   */
  async calcularScorePriorizacao(cnpjUnidade: string): Promise<PriorizacaoUnidade> {
    try {
      const criterios = await this.buscarCriteriosPriorizacao();
      
      // Busca dados da unidade
      const [cobrancas, unidade, tratativas, acordos] = await Promise.all([
        this.buscarCobrancasUnidade(cnpjUnidade),
        this.buscarDadosUnidade(cnpjUnidade),
        this.buscarTratativasRecentes(cnpjUnidade),
        this.buscarAcordosAtivos(cnpjUnidade)
      ]);

      if (!unidade) {
        throw new Error('Unidade não encontrada');
      }

      // 1. Calcula valor total em aberto
      const valorTotalEmAberto = cobrancas
        .filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);

      // 2. Calcula dias de inadimplência máxima
      const diasInadimplenciaMax = Math.max(
        ...cobrancas.filter(c => c.status === 'em_aberto').map(c => c.dias_em_atraso || 0),
        0
      );

      // 3. Conta quantidade de débitos
      const quantidadeDebitos = cobrancas.filter(c => c.status === 'em_aberto').length;

      // 4. Identifica tipos de débito
      const tiposDebito = [...new Set(cobrancas.map(c => c.tipo_cobranca || 'outros'))];

      // 5. Determina status da unidade
      const statusUnidade = this.determinarStatusUnidade(cobrancas, tratativas, acordos);

      // 6. Calcula score de priorização
      let score = 0;

      // Peso por valor em aberto
      const pesoValor = valorTotalEmAberto >= criterios.valor_minimo_alta_prioridade ? 100 : 
                       (valorTotalEmAberto / criterios.valor_minimo_alta_prioridade) * 100;
      score += pesoValor * (criterios.peso_valor_em_aberto / 100);

      // Peso por tempo de inadimplência
      const pesoTempo = Math.min(diasInadimplenciaMax / 90, 1) * 100; // Máximo 90 dias = 100%
      score += pesoTempo * (criterios.peso_tempo_inadimplencia / 100);

      // Peso por multiplicidade de débitos
      const pesoMultiplicidade = Math.min(quantidadeDebitos / 5, 1) * 100; // Máximo 5 débitos = 100%
      score += pesoMultiplicidade * (criterios.peso_multiplicidade_debitos / 100);

      // Peso por tipo de débito (prioriza royalties e aluguel)
      const pesoTipoDebito = tiposDebito.reduce((sum, tipo) => {
        return sum + (criterios.peso_tipo_debito[tipo] || 0);
      }, 0) / tiposDebito.length;
      score += pesoTipoDebito;

      // Peso por status da unidade
      score += criterios.peso_status_unidade[statusUnidade] || 0;

      // 7. Determina nível de escalonamento
      const nivelEscalonamento = this.determinarNivelEscalonamento(diasInadimplenciaMax, criterios);

      // 8. Busca tentativas de contato no nível atual
      const tentativasNivel = await this.contarTentativasNivel(cnpjUnidade, nivelEscalonamento);

      return {
        cnpj_unidade: cnpjUnidade,
        codigo_unidade: unidade.codigo_unidade,
        nome_franqueado: unidade.nome_franqueado,
        score_priorizacao: Math.round(score),
        nivel_escalonamento: nivelEscalonamento,
        valor_total_em_aberto: valorTotalEmAberto,
        dias_inadimplencia_max: diasInadimplenciaMax,
        quantidade_debitos: quantidadeDebitos,
        tipos_debito: tiposDebito,
        status_unidade: statusUnidade,
        tentativas_contato_nivel: tentativasNivel,
        data_ultimo_contato: tratativas[0]?.data_interacao,
        data_proximo_escalonamento: this.calcularProximoEscalonamento(nivelEscalonamento, criterios)
      };
    } catch (error) {
      console.error('Erro ao calcular score de priorização:', error);
      throw error;
    }
  }

  /**
   * Atualiza priorização de todas as unidades
   */
  async atualizarPriorizacaoGeral(): Promise<number> {
    try {
      // Busca todas as unidades com débitos em aberto
      const { data: unidadesComDebito } = await supabase
        .from('cobrancas_franqueados')
        .select('cnpj')
        .eq('status', 'em_aberto')
        .group('cnpj');

      if (!unidadesComDebito) return 0;

      let unidadesAtualizadas = 0;

      for (const unidade of unidadesComDebito) {
        try {
          const priorizacao = await this.calcularScorePriorizacao(unidade.cnpj);
          
          // Salva ou atualiza no banco
          await supabase
            .from('priorizacao_unidades')
            .upsert(priorizacao);

          unidadesAtualizadas++;
        } catch (error) {
          console.error(`Erro ao atualizar priorização da unidade ${unidade.cnpj}:`, error);
        }
      }

      return unidadesAtualizadas;
    } catch (error) {
      console.error('Erro na atualização geral:', error);
      throw error;
    }
  }

  /**
   * Gera fila de cobrança priorizada
   */
  async gerarFilaCobranca(limite: number = 50): Promise<FilaCobranca[]> {
    try {
      const { data: priorizacoes, error } = await supabase
        .from('priorizacao_unidades')
        .select('*')
        .order('score_priorizacao', { ascending: false })
        .order('nivel_escalonamento', { ascending: false })
        .limit(limite);

      if (error) {
        throw new Error(`Erro ao buscar fila: ${error.message}`);
      }

      return priorizacoes?.map((p, index) => ({
        posicao: index + 1,
        cnpj_unidade: p.cnpj_unidade,
        nome_franqueado: p.nome_franqueado,
        score_priorizacao: p.score_priorizacao,
        nivel_escalonamento: p.nivel_escalonamento,
        valor_total: p.valor_total_em_aberto,
        dias_atraso: p.dias_inadimplencia_max,
        proxima_acao: this.determinarProximaAcao(p),
        data_proxima_acao: p.data_proximo_escalonamento || new Date().toISOString(),
        status_atual: p.status_unidade
      })) || [];
    } catch (error) {
      console.error('Erro ao gerar fila de cobrança:', error);
      throw error;
    }
  }

  /**
   * Executa ações automáticas baseadas na priorização
   */
  async executarAcoesAutomaticas(): Promise<AcaoAutomatica[]> {
    try {
      const criterios = await this.buscarCriteriosPriorizacao();
      const fila = await this.gerarFilaCobranca(100);
      const acoesExecutadas: AcaoAutomatica[] = [];

      for (const item of fila) {
        const acao = await this.determinarAcaoAutomatica(item, criterios);
        
        if (acao.automatica) {
          await this.executarAcao(acao);
          acoesExecutadas.push(acao);
        }
      }

      return acoesExecutadas;
    } catch (error) {
      console.error('Erro ao executar ações automáticas:', error);
      throw error;
    }
  }

  /**
   * Força escalonamento de nível
   */
  async forcarEscalonamento(
    cnpjUnidade: string,
    novoNivel: number,
    motivo: string,
    usuario: string
  ): Promise<void> {
    try {
      // Busca priorização atual
      const { data: priorizacaoAtual } = await supabase
        .from('priorizacao_unidades')
        .select('*')
        .eq('cnpj_unidade', cnpjUnidade)
        .single();

      if (!priorizacaoAtual) {
        throw new Error('Priorização não encontrada');
      }

      // Registra histórico
      await supabase
        .from('historico_escalonamento')
        .insert({
          cnpj_unidade: cnpjUnidade,
          nivel_anterior: priorizacaoAtual.nivel_escalonamento,
          nivel_novo: novoNivel,
          motivo_escalonamento: motivo,
          score_anterior: priorizacaoAtual.score_priorizacao,
          score_novo: priorizacaoAtual.score_priorizacao,
          acao_automatica: false,
          usuario_responsavel: usuario,
          data_escalonamento: new Date().toISOString()
        });

      // Atualiza nível
      await supabase
        .from('priorizacao_unidades')
        .update({
          nivel_escalonamento: novoNivel,
          tentativas_contato_nivel: 0, // Reset tentativas
          observacoes_priorizacao: `Escalonamento manual: ${motivo}`
        })
        .eq('cnpj_unidade', cnpjUnidade);

      // Registra tratativa
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('id')
        .eq('cnpj', cnpjUnidade)
        .eq('status', 'em_aberto')
        .limit(1)
        .single();

      if (cobranca) {
        await this.tratativasService.registrarObservacao(
          cobranca.id,
          usuario,
          `Escalonamento manual para nível ${novoNivel}: ${motivo}`,
          this.mapearNivelParaStatus(novoNivel)
        );
      }
    } catch (error) {
      console.error('Erro ao forçar escalonamento:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas da priorização
   */
  async buscarEstatisticasPriorizacao(): Promise<EstatisticasPriorizacao> {
    try {
      const { data: priorizacoes } = await supabase
        .from('priorizacao_unidades')
        .select('*');

      if (!priorizacoes) {
        return this.getEstatisticasVazias();
      }

      const stats: EstatisticasPriorizacao = {
        total_unidades_fila: priorizacoes.length,
        por_nivel: {},
        valor_total_priorizado: 0,
        tempo_medio_resolucao: 0,
        taxa_escalonamento_automatico: 0,
        unidades_criticas: 0
      };

      priorizacoes.forEach(p => {
        // Por nível
        stats.por_nivel[p.nivel_escalonamento] = (stats.por_nivel[p.nivel_escalonamento] || 0) + 1;
        
        // Valor total
        stats.valor_total_priorizado += p.valor_total_em_aberto;
        
        // Unidades críticas (nível 4 e 5)
        if (p.nivel_escalonamento >= 4) {
          stats.unidades_criticas++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return this.getEstatisticasVazias();
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private async buscarCriteriosPriorizacao(): Promise<CriterioPriorizacao> {
    const { data, error } = await supabase
      .from('criterios_priorizacao')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      // Retorna critérios padrão
      return {
        valor_minimo_alta_prioridade: 5000,
        peso_valor_em_aberto: 40,
        peso_tempo_inadimplencia: 30,
        peso_multiplicidade_debitos: 15,
        peso_tipo_debito: {
          'royalties': 25,
          'aluguel': 20,
          'insumos': 10,
          'multa': 15,
          'outros': 5
        },
        peso_status_unidade: {
          'critica': 25,
          'ativa_atraso': 15,
          'negociacao': 5,
          'acordo': 0
        },
        dias_nivel_1: 5,
        dias_nivel_2: 15,
        dias_nivel_3: 30,
        dias_nivel_4: 45,
        dias_nivel_5: 60,
        max_tentativas_por_nivel: 3,
        ativo: true
      };
    }

    return data;
  }

  private async buscarCobrancasUnidade(cnpjUnidade: string) {
    const { data } = await supabase
      .from('cobrancas_franqueados')
      .select('*')
      .eq('cnpj', cnpjUnidade);
    return data || [];
  }

  private async buscarDadosUnidade(cnpjUnidade: string) {
    const { data } = await supabase
      .from('unidades_franqueadas')
      .select('*')
      .eq('codigo_unidade', cnpjUnidade)
      .single();
    return data;
  }

  private async buscarTratativasRecentes(cnpjUnidade: string) {
    const { data } = await supabase
      .from('tratativas_cobranca')
      .select(`
        *,
        cobrancas_franqueados!inner(cnpj)
      `)
      .eq('cobrancas_franqueados.cnpj', cnpjUnidade)
      .order('data_interacao', { ascending: false })
      .limit(10);
    return data || [];
  }

  private async buscarAcordosAtivos(cnpjUnidade: string) {
    const { data } = await supabase
      .from('acordos_parcelamento')
      .select('*')
      .eq('cnpj_unidade', cnpjUnidade)
      .in('status_acordo', ['aceito', 'cumprindo']);
    return data || [];
  }

  private determinarStatusUnidade(cobrancas: any[], tratativas: any[], acordos: any[]): 'critica' | 'ativa_atraso' | 'negociacao' | 'acordo' {
    // Tem acordo ativo
    if (acordos.length > 0) {
      return 'acordo';
    }

    // Tem tratativas recentes de negociação
    const tratativasNegociacao = tratativas.filter(t => 
      ['agendamento', 'proposta_enviada', 'negociacao_iniciada'].includes(t.tipo_interacao)
    );
    if (tratativasNegociacao.length > 0) {
      return 'negociacao';
    }

    // Verifica se é crítica (múltiplas cobranças ignoradas)
    const mensagensIgnoradas = tratativas.filter(t => 
      t.tipo_interacao === 'mensagem_automatica' && 
      !tratativas.some(tr => tr.tipo_interacao === 'resposta_franqueado' && tr.data_interacao > t.data_interacao)
    );

    if (mensagensIgnoradas.length >= 3) {
      return 'critica';
    }

    return 'ativa_atraso';
  }

  private determinarNivelEscalonamento(diasAtraso: number, criterios: CriterioPriorizacao): 1 | 2 | 3 | 4 | 5 {
    if (diasAtraso <= criterios.dias_nivel_1) return 1;
    if (diasAtraso <= criterios.dias_nivel_2) return 2;
    if (diasAtraso <= criterios.dias_nivel_3) return 3;
    if (diasAtraso <= criterios.dias_nivel_4) return 4;
    return 5;
  }

  private async contarTentativasNivel(cnpjUnidade: string, nivel: number): Promise<number> {
    // Busca tentativas de contato no nível atual
    const { data } = await supabase
      .from('historico_escalonamento')
      .select('id')
      .eq('cnpj_unidade', cnpjUnidade)
      .eq('nivel_novo', nivel)
      .gte('data_escalonamento', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 30 dias

    return data?.length || 0;
  }

  private calcularProximoEscalonamento(nivelAtual: number, criterios: CriterioPriorizacao): string {
    const diasParaProximo = this.getDiasParaNivel(nivelAtual + 1, criterios);
    const proximaData = new Date();
    proximaData.setDate(proximaData.getDate() + diasParaProximo);
    return proximaData.toISOString();
  }

  private getDiasParaNivel(nivel: number, criterios: CriterioPriorizacao): number {
    switch (nivel) {
      case 2: return criterios.dias_nivel_2 - criterios.dias_nivel_1;
      case 3: return criterios.dias_nivel_3 - criterios.dias_nivel_2;
      case 4: return criterios.dias_nivel_4 - criterios.dias_nivel_3;
      case 5: return criterios.dias_nivel_5 - criterios.dias_nivel_4;
      default: return 7; // Padrão 7 dias
    }
  }

  private determinarProximaAcao(priorizacao: PriorizacaoUnidade): string {
    switch (priorizacao.nivel_escalonamento) {
      case 1: return 'Enviar aviso amistoso';
      case 2: return 'Cobrança formal com juros';
      case 3: return 'Agendar reunião obrigatória';
      case 4: return 'Propor acordo final';
      case 5: return 'Escalonamento jurídico';
      default: return 'Avaliar situação';
    }
  }

  private async determinarAcaoAutomatica(item: FilaCobranca, criterios: CriterioPriorizacao): Promise<AcaoAutomatica> {
    // Busca dados completos da priorização
    const { data: priorizacao } = await supabase
      .from('priorizacao_unidades')
      .select('*')
      .eq('cnpj_unidade', item.cnpj_unidade)
      .single();

    if (!priorizacao) {
      return {
        cnpj_unidade: item.cnpj_unidade,
        nivel_atual: item.nivel_escalonamento,
        acao_recomendada: 'aguardar',
        prazo_execucao: new Date().toISOString(),
        automatica: false,
        justificativa: 'Dados insuficientes'
      };
    }

    // Verifica se deve escalar automaticamente
    const deveEscalar = priorizacao.tentativas_contato_nivel >= criterios.max_tentativas_por_nivel;
    const proximoNivel = Math.min(priorizacao.nivel_escalonamento + 1, 5);

    if (deveEscalar && priorizacao.nivel_escalonamento < 5) {
      return {
        cnpj_unidade: item.cnpj_unidade,
        nivel_atual: priorizacao.nivel_escalonamento,
        acao_recomendada: 'escalar_juridico',
        prazo_execucao: new Date().toISOString(),
        automatica: true,
        justificativa: `Máximo de tentativas atingido no nível ${priorizacao.nivel_escalonamento}`
      };
    }

    // Determina ação baseada no nível atual
    let acaoRecomendada: AcaoAutomatica['acao_recomendada'] = 'aguardar';
    let automatica = false;

    switch (priorizacao.nivel_escalonamento) {
      case 1:
      case 2:
        acaoRecomendada = 'enviar_aviso';
        automatica = true;
        break;
      case 3:
        acaoRecomendada = 'agendar_reuniao';
        automatica = false; // Requer intervenção humana
        break;
      case 4:
        acaoRecomendada = 'gerar_acordo';
        automatica = false;
        break;
      case 5:
        acaoRecomendada = 'escalar_juridico';
        automatica = true;
        break;
    }

    return {
      cnpj_unidade: item.cnpj_unidade,
      nivel_atual: priorizacao.nivel_escalonamento,
      acao_recomendada: acaoRecomendada,
      prazo_execucao: priorizacao.data_proximo_escalonamento || new Date().toISOString(),
      automatica,
      justificativa: `Ação baseada no nível ${priorizacao.nivel_escalonamento} de escalonamento`
    };
  }

  private async executarAcao(acao: AcaoAutomatica): Promise<void> {
    try {
      switch (acao.acao_recomendada) {
        case 'enviar_aviso':
          await this.enviarAvisoAutomatico(acao.cnpj_unidade);
          break;
        case 'escalar_juridico':
          await this.escalarParaJuridico(acao.cnpj_unidade, acao.justificativa);
          break;
        // Outras ações seriam implementadas conforme necessário
      }

      // Incrementa tentativas
      await supabase
        .from('priorizacao_unidades')
        .update({
          tentativas_contato_nivel: supabase.rpc('increment_tentativas', { cnpj: acao.cnpj_unidade })
        })
        .eq('cnpj_unidade', acao.cnpj_unidade);
    } catch (error) {
      console.error('Erro ao executar ação automática:', error);
    }
  }

  private async enviarAvisoAutomatico(cnpjUnidade: string): Promise<void> {
    // Integração com sistema de mensagens
    console.log(`Enviando aviso automático para ${cnpjUnidade}`);
  }

  private async escalarParaJuridico(cnpjUnidade: string, motivo: string): Promise<void> {
    // Integração com sistema jurídico
    console.log(`Escalando ${cnpjUnidade} para jurídico: ${motivo}`);
  }

  private mapearNivelParaStatus(nivel: number): string {
    switch (nivel) {
      case 1: return 'em_aberto';
      case 2: return 'cobrado';
      case 3: return 'negociando';
      case 4: return 'em_tratativa_critica';
      case 5: return 'em_tratativa_juridica';
      default: return 'em_aberto';
    }
  }

  private getEstatisticasVazias(): EstatisticasPriorizacao {
    return {
      total_unidades_fila: 0,
      por_nivel: {},
      valor_total_priorizado: 0,
      tempo_medio_resolucao: 0,
      taxa_escalonamento_automatico: 0,
      unidades_criticas: 0
    };
  }

  /**
   * Exporta fila de priorização
   */
  async exportarFilaPriorizacao(): Promise<string> {
    try {
      const fila = await this.gerarFilaCobranca(200);
      
      // Cabeçalho CSV
      const cabecalho = [
        'Posição',
        'CNPJ',
        'Nome Franqueado',
        'Score',
        'Nível',
        'Valor Total',
        'Dias Atraso',
        'Status',
        'Próxima Ação',
        'Data Próxima Ação'
      ].join(',');

      // Dados
      const linhas = fila.map(item => [
        item.posicao,
        item.cnpj_unidade,
        item.nome_franqueado,
        item.score_priorizacao,
        item.nivel_escalonamento,
        item.valor_total.toFixed(2),
        item.dias_atraso,
        item.status_atual,
        item.proxima_acao,
        new Date(item.data_proxima_acao).toLocaleDateString('pt-BR')
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar fila:', error);
      throw error;
    }
  }
}