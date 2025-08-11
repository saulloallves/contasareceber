/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './databaseService';
import { CardCobranca, ColunaKanban, MovimentacaoCard, FiltrosKanban, EstatisticasKanban, LogMovimentacao } from '../types/kanban';
import { TrativativasService } from './tratativasService';

export class KanbanService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Busca todas as colunas do Kanban
   */
  async buscarColunas(): Promise<ColunaKanban[]> {
    try {
      // Retorna colunas padrão do sistema
      return [
        { id: 'em_aberto', nome: '📥 Em Aberto', descricao: 'Não notificado', cor: '#6B7280', ordem: 1, ativa: true },
        { id: 'notificado', nome: '📤 Notificado', descricao: 'Aguardando resposta', cor: '#3B82F6', ordem: 2, ativa: true, limite_dias: 7 },
        { id: 'reuniao_agendada', nome: '📅 Reunião Agendada', descricao: 'Reunião marcada', cor: '#8B5CF6', ordem: 3, ativa: true },
        { id: 'em_negociacao', nome: '🤝 Em Negociação', descricao: 'Negociando acordo', cor: '#F59E0B', ordem: 4, ativa: true },
        { id: 'proposta_enviada', nome: '📨 Proposta Enviada', descricao: 'Aguardando aceite', cor: '#F97316', ordem: 5, ativa: true, limite_dias: 5 },
        { id: 'aguardando_pagamento', nome: '📌 Aguardando Pagamento', descricao: 'Acordo aceito', cor: '#06B6D4', ordem: 6, ativa: true },
        { id: 'pagamento_parcial', nome: '💰 Pagamento Parcial', descricao: 'Pagamento em andamento', cor: '#10B981', ordem: 7, ativa: true },
        { id: 'quitado', nome: '✅ Débito Quitado', descricao: 'Totalmente quitado', cor: '#059669', ordem: 8, ativa: true },
        { id: 'ignorado', nome: '⚠️ Ignorado', descricao: 'Não respondeu', cor: '#DC2626', ordem: 9, ativa: true },
        { id: 'notificacao_formal', nome: '📨 Notificação Formal', descricao: 'Notificação enviada', cor: '#7C3AED', ordem: 10, ativa: true },
        { id: 'escalado_juridico', nome: '📁 Escalado Jurídico', descricao: 'Com o jurídico', cor: '#B91C1C', ordem: 11, ativa: true },
        { id: 'inadimplencia_critica', nome: '❌ Inadimplência Crítica', descricao: 'Situação crítica', cor: '#7F1D1D', ordem: 12, ativa: true }
      ];
    } catch (error) {
      console.error('Erro ao buscar colunas:', error);
      return [];
    }
  }

  /**
   * Busca cards do Kanban com opção de agrupamento
   */
  async buscarCards(filtros: FiltrosKanban = {}, agruparPorUnidade: boolean = false): Promise<CardCobranca[]> {
    try {
      // Busca dados das cobranças com join correto
      let query = supabase
        .from('cobrancas_franqueados')
        .select(`
          id,
          cnpj,
          cliente,
          valor_original,
          valor_atualizado,
          valor_recebido,
          data_vencimento,
          status,
          tipo_cobranca,
          descricao,
          created_at,
          dias_em_atraso,
          unidade_id_fk,
          unidades_franqueadas!unidade_id_fk (
            id,
            codigo_unidade,
            nome_franqueado,
            cidade,
            estado
          )
        `)
        .neq('status', 'quitado')
        .order('created_at', { ascending: false });

      // Aplica filtros
      if (filtros.unidade) {
        query = query.or(`cnpj.ilike.%${filtros.unidade}%,unidades_franqueadas.codigo_unidade.ilike.%${filtros.unidade}%`);
      }

      if (filtros.tipo_debito) {
        query = query.eq('tipo_cobranca', filtros.tipo_debito);
      }

      if (filtros.valor_min) {
        query = query.gte('valor_atualizado', filtros.valor_min);
      }

      if (filtros.valor_max) {
        query = query.lte('valor_atualizado', filtros.valor_max);
      }

      const { data: cobrancas, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar cobranças: ${error.message}`);
      }

      if (!cobrancas || cobrancas.length === 0) {
        return [];
      }

      console.log(`Encontradas ${cobrancas.length} cobranças para o Kanban`);

      if (agruparPorUnidade) {
        return this.agruparCobrancasPorUnidade(cobrancas, filtros);
      } else {
        return this.criarCardsIndividuais(cobrancas, filtros);
      }
    } catch (error) {
      console.error('Erro ao buscar cards:', error);
      return [];
    }
  }

  /**
   * Cria cards individuais para cada cobrança
   */
  private criarCardsIndividuais(cobrancas: any[], filtros: FiltrosKanban): CardCobranca[] {
    return cobrancas
      .map(cobranca => {
        const unidade = cobranca.unidades_franqueadas;
        const valorAtual = cobranca.valor_atualizado || cobranca.valor_original;
        
        const card: CardCobranca = {
          id: cobranca.id, // Usa o ID real da cobrança (UUID)
          codigo_unidade: unidade?.codigo_unidade || cobranca.cnpj,
          nome_unidade: unidade?.nome_franqueado || cobranca.cliente,
          cnpj: cobranca.cnpj,
          tipo_debito: this.determinarTipoDebito([cobranca]),
          valor_total: valorAtual,
          data_vencimento_antiga: cobranca.data_vencimento,
          data_vencimento_recente: cobranca.data_vencimento,
          status_atual: this.determinarStatusKanban(cobranca.status),
          ultima_acao: this.determinarUltimaAcao(cobranca),
          data_ultima_acao: cobranca.created_at || new Date().toISOString(),
          responsavel_atual: this.determinarResponsavel(cobranca.status),
          dias_parado: cobranca.dias_em_atraso || this.calcularDiasParado(cobranca.created_at || new Date().toISOString()),
          criticidade: this.determinarCriticidadeIndividual(valorAtual, cobranca.data_vencimento),
          data_entrada_etapa: cobranca.created_at || new Date().toISOString(),
          // Dados específicos da cobrança individual
          descricao_cobranca: cobranca.descricao,
          valor_recebido: cobranca.valor_recebido || 0,
          quantidade_titulos: 1
        };

        return card;
      })
      .filter(card => this.aplicarFiltrosCard(card, filtros));
  }

  /**
   * Agrupa cobranças por unidade
   */
  private agruparCobrancasPorUnidade(cobrancas: any[], filtros: FiltrosKanban): CardCobranca[] {
    const cardsMap = new Map<string, CardCobranca>();

    cobrancas.forEach(cobranca => {
      const cnpj = cobranca.cnpj;
      
      if (!cardsMap.has(cnpj)) {
        const unidade = cobranca.unidades_franqueadas;
        
        cardsMap.set(cnpj, {
          id: cnpj,
          codigo_unidade: unidade?.codigo_unidade || cnpj,
          nome_unidade: unidade?.nome_franqueado || cobranca.cliente,
          cnpj: cnpj,
          tipo_debito: 'royalties',
          valor_total: 0,
          data_vencimento_antiga: cobranca.data_vencimento,
          data_vencimento_recente: cobranca.data_vencimento,
          status_atual: 'em_aberto',
          ultima_acao: 'Cobranças agrupadas',
          data_ultima_acao: cobranca.created_at || new Date().toISOString(),
          responsavel_atual: 'Equipe Cobrança',
          dias_parado: 0,
          criticidade: 'normal',
          data_entrada_etapa: cobranca.created_at || new Date().toISOString(),
          quantidade_titulos: 0
        });
      }

      const card = cardsMap.get(cnpj)!;
      const valorAtual = cobranca.valor_atualizado || cobranca.valor_original;
      
      // Atualiza valores agregados
      card.valor_total += valorAtual;
      card.quantidade_titulos = (card.quantidade_titulos || 0) + 1;
      
      // Atualiza datas de vencimento
      if (new Date(cobranca.data_vencimento) < new Date(card.data_vencimento_antiga)) {
        card.data_vencimento_antiga = cobranca.data_vencimento;
      }
      if (new Date(cobranca.data_vencimento) > new Date(card.data_vencimento_recente)) {
        card.data_vencimento_recente = cobranca.data_vencimento;
      }

      // Atualiza status baseado na cobrança mais crítica
      const statusAtual = this.determinarStatusKanban(cobranca.status);
      if (this.compararCriticidadeStatus(statusAtual, card.status_atual) > 0) {
        card.status_atual = statusAtual;
        card.responsavel_atual = this.determinarResponsavel(cobranca.status);
      }

      // Atualiza última ação se for mais recente
      if (new Date(cobranca.created_at) > new Date(card.data_ultima_acao)) {
        card.data_ultima_acao = cobranca.created_at;
        card.ultima_acao = this.determinarUltimaAcao(cobranca);
      }
      
      // Adiciona a cobrança individual ao card da unidade para referência
      if (!card.charges) {
        (card as any).charges = [];
      }
      (card as any).charges.push({
        id: cobranca.id,
        valor_total: valorAtual,
        status_atual: this.determinarStatusKanban(cobranca.status),
        tipo_debito: cobranca.tipo_cobranca || 'royalties',
        data_vencimento_antiga: cobranca.data_vencimento,
        observacoes: cobranca.observacoes
      });
    });

    // Finaliza processamento dos cards agrupados
    const cards = Array.from(cardsMap.values()).map(card => ({
      ...card,
      tipo_debito: this.determinarTipoDebito(
        cobrancas.filter(c => c.cnpj === card.cnpj)
      ),
      dias_parado: Math.max(...cobrancas.filter(c => c.cnpj === card.cnpj).map(c => c.dias_em_atraso || 0), 0),
      criticidade: this.determinarCriticidade(card)
    }));

    return cards.filter(card => this.aplicarFiltrosCard(card, filtros));
  }

  /**
   * Move um card para nova coluna
   */
  async moverCard(
    cardId: string,
    novoStatus: string,
    usuario: string,
    motivo: string
  ): Promise<void> {
    try {
      // Busca a cobrança pelo ID (que é UUID)
      const { data: cobranca, error: fetchError } = await supabase
        .from('cobrancas_franqueados')
        .select('id, status, cnpj')
        .eq('id', cardId)
        .single();

      if (fetchError || !cobranca) {
        throw new Error(`Cobrança com ID ${cardId} não encontrada: ${fetchError?.message}`);
      }

      const statusOrigem = this.determinarStatusKanban(cobranca.status);
      const novoStatusCobranca = this.mapearStatusKanbanParaCobranca(novoStatus);

      console.log(`Movendo card ${cardId}: ${statusOrigem} -> ${novoStatus} (DB: ${cobranca.status} -> ${novoStatusCobranca})`);

      // Atualiza o status na tabela principal
      const { error: updateError } = await supabase
        .from('cobrancas_franqueados')
        .update({ 
          status: novoStatusCobranca,
          data_ultima_atualizacao: new Date().toISOString()
        })
        .eq('id', cardId);

      if (updateError) {
        throw new Error(`Erro ao atualizar status da cobrança: ${updateError.message}`);
      }

      // Registra a movimentação
      await this.registrarMovimentacao({
        card_id: cardId,
        status_origem: statusOrigem,
        status_destino: novoStatus,
        usuario,
        motivo,
        data_movimentacao: new Date().toISOString(),
        automatica: false,
      });

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        cardId,
        usuario,
        `Card movido no Kanban de '${statusOrigem}' para '${novoStatus}'. Motivo: ${motivo}`,
        novoStatusCobranca
      );

      console.log(`Card ${cardId} movido com sucesso para ${novoStatus}`);

    } catch (error) {
      console.error('Erro ao mover card:', error);
      throw error;
    }
  }

  /**
   * Executa ação rápida em um card
   */
  async executarAcaoRapida(
    cardId: string,
    acao: string,
    usuario: string,
  ): Promise<void> {
    try {
      const cards = await this.buscarCards({}, false);
      const card = cards.find(c => c.id === cardId);
      
      if (!card) {
        throw new Error('Card não encontrado');
      }

      let novoStatus = card.status_atual;
      let descricaoAcao = '';

      switch (acao) {
        case 'whatsapp':
          descricaoAcao = 'Mensagem WhatsApp enviada';
          if (card.status_atual === 'em_aberto') {
            novoStatus = 'notificado';
          }
          break;
        case 'reuniao':
          descricaoAcao = 'Reunião agendada';
          novoStatus = 'reuniao_agendada';
          break;
        case 'juridico':
          descricaoAcao = 'Escalado para jurídico';
          novoStatus = 'escalado_juridico';
          break;
        default:
          descricaoAcao = `Ação ${acao} executada`;
      }

      // Se mudou o status, move o card
      if (novoStatus !== card.status_atual) {
        await this.registrarLog({
          card_id: cardId,
          acao: acao,
          usuario: usuario,
          data_acao: new Date().toISOString(),
          detalhes: descricaoAcao
        });
      }
    } catch (error) {
      console.error('Erro ao executar ação rápida:', error);
      throw error;
    }
  }

  /**
   * Atualiza observação de um card
   */
  async atualizarObservacao(
    cardId: string,
    observacao: string,
    usuario: string,
    agrupadoPorUnidade: boolean = false
  ): Promise<void> {
    try {
      if (agrupadoPorUnidade) {
        // Para unidades agrupadas, registra na primeira cobrança
        const { data: cobranca } = await supabase
          .from('cobrancas_franqueados')
          .select('id')
          .eq('cnpj', cardId)
          .limit(1)
          .single();

        if (cobranca) {
          await this.tratativasService.registrarObservacao(
            cobranca.id,
            usuario,
            observacao,
            undefined
          );
        }
      } else {
        // Para cobranças individuais
        await this.tratativasService.registrarObservacao(
          cardId,
          usuario,
          observacao,
          undefined
        );
      }
    } catch (error) {
      console.error('Erro ao atualizar observação:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas do Kanban
  async buscarEstatisticas(agrupadoPorUnidade: boolean = false): Promise<EstatisticasKanban> {
    try {
      const cards = await this.buscarCards({}, false);
      
      const stats: EstatisticasKanban = {
        total_cards: cards.length,
        cards_criticos: cards.filter(c => c.criticidade === 'critica').length,
        cards_parados: cards.filter(c => c.dias_parado > 7).length,
        tempo_medio_resolucao: this.calcularTempoMedioResolucao(cards),
        valor_total_fluxo: cards.reduce((sum, c) => sum + c.valor_total, 0),
        distribuicao_por_status: {},
        tempo_medio_por_etapa: {}
      };

      // Calcula distribuição por status
      cards.forEach(card => {
        stats.distribuicao_por_status[card.status_atual] = 
          (stats.distribuicao_por_status[card.status_atual] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return {
        total_cards: 0,
        cards_criticos: 0,
        cards_parados: 0,
        tempo_medio_resolucao: 0,
        valor_total_fluxo: 0,
        distribuicao_por_status: {},
        tempo_medio_por_etapa: {}
      };
    }
  }

  /**
   * Exporta dados do Kanban
   */
  async exportarKanban(filtros: FiltrosKanban = {}, agrupadoPorUnidade: boolean = false): Promise<string> {
    try {
      const cards = await this.buscarCards(filtros, agrupadoPorUnidade);
      
      const cabecalho = [
        'ID',
        'Código Unidade',
        'Nome Unidade',
        'CNPJ',
        'Tipo Débito',
        'Valor Total',
        'Status Atual',
        'Responsável',
        'Dias Parado',
        'Última Ação',
        'Data Última Ação',
        'Criticidade',
        agrupadoPorUnidade ? 'Qtd Títulos' : 'Descrição'
      ].join(',');

      const linhas = cards.map(card => [
        card.id,
        card.codigo_unidade,
        card.nome_unidade,
        card.cnpj,
        card.tipo_debito,
        card.valor_total.toFixed(2),
        card.status_atual,
        card.responsavel_atual,
        card.dias_parado,
        card.ultima_acao.replace(/,/g, ';'),
        new Date(card.data_ultima_acao).toLocaleDateString('pt-BR'),
        card.criticidade,
        agrupadoPorUnidade ? (card.quantidade_titulos || 1) : (card.descricao_cobranca || '')
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar Kanban:', error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private determinarTipoDebito(cobrancas: any[]): 'royalties' | 'insumos' | 'aluguel' | 'multa' {
    if (!cobrancas || cobrancas.length === 0) return 'royalties';
    
    const tipos = cobrancas.map(c => c.tipo_cobranca || 'royalties');
    const contagem = tipos.reduce((acc: Record<string, number>, tipo: string) => {
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tipoMaisFrequente = Object.entries(contagem)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0];
    
    return (tipoMaisFrequente as any) || 'royalties';
  }

  private determinarStatusKanban(statusCobranca: string): string {
    const mapeamento: Record<string, string> = {
      'novo': 'em_aberto',
      'em_aberto': 'em_aberto',
      'cobrado': 'notificado',
      'negociando': 'em_negociacao',
      'quitado': 'quitado',
      'em_tratativa_juridica': 'escalado_juridico',
      'em_tratativa_critica': 'inadimplencia_critica'
    };
    
    console.log(`Determinando status Kanban para '${statusCobranca}': '${mapeamento[statusCobranca] || 'em_aberto'}'`);
    return mapeamento[statusCobranca] || 'em_aberto';
  }

  private mapearStatusKanbanParaCobranca(statusKanban: string): string {
    const mapeamento: Record<string, string> = {
      'em_aberto': 'em_aberto',
      'notificado': 'cobrado',
      'reuniao_agendada': 'negociando',
      'em_negociacao': 'negociando',
      'proposta_enviada': 'negociando',
      'aguardando_pagamento': 'negociando',
      'pagamento_parcial': 'negociando',
      'quitado': 'quitado',
      'ignorado': 'em_aberto',
      'notificacao_formal': 'cobrado',
      'escalado_juridico': 'em_tratativa_juridica',
      'inadimplencia_critica': 'em_tratativa_critica'
    };
    
    console.log(`Mapeando status Kanban '${statusKanban}' para status DB '${mapeamento[statusKanban] || 'em_aberto'}'`);
    return mapeamento[statusKanban] || 'em_aberto';
  }

  private determinarResponsavel(status: string): string {
    const responsaveis: Record<string, string> = {
      'em_aberto': 'Equipe Cobrança',
      'cobrado': 'Equipe Cobrança',
      'negociando': 'Equipe Cobrança',
      'em_tratativa_juridica': 'Jurídico',
      'em_tratativa_critica': 'Jurídico'
    };
    return responsaveis[status] || 'Equipe Cobrança';
  }

  private determinarUltimaAcao(cobranca: any): string {
    const acoes: Record<string, string> = {
      'novo': 'Cobrança registrada',
      'em_aberto': 'Aguardando primeira ação',
      'cobrado': 'Notificação enviada',
      'negociando': 'Em processo de negociação',
      'quitado': 'Débito quitado',
      'em_tratativa_juridica': 'Escalado para jurídico',
      'em_tratativa_critica': 'Situação crítica identificada'
    };
    return acoes[cobranca.status] || 'Cobrança registrada no sistema';
  }

  private calcularDiasParado(dataUltimaAcao: string): number {
    const hoje = new Date();
    const ultimaAcao = new Date(dataUltimaAcao);
    return Math.floor((hoje.getTime() - ultimaAcao.getTime()) / (1000 * 60 * 60 * 24));
  }

  private determinarCriticidade(card: CardCobranca): 'normal' | 'atencao' | 'critica' {
    if (card.valor_total > 10000 || card.dias_parado > 15) return 'critica';
    if (card.valor_total > 5000 || card.dias_parado > 7) return 'atencao';
    return 'normal';
  }

  private determinarCriticidadeIndividual(valor: number, dataVencimento: string): 'normal' | 'atencao' | 'critica' {
    const diasAtraso = this.calcularDiasAtraso(dataVencimento);
    
    if (valor > 10000 || diasAtraso > 30) return 'critica';
    if (valor > 5000 || diasAtraso > 15) return 'atencao';
    return 'normal';
  }

  private calcularDiasAtraso(dataVencimento: string): number {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diferenca = hoje.getTime() - vencimento.getTime();
    return Math.max(0, Math.floor(diferenca / (1000 * 60 * 60 * 24)));
  }

  private compararCriticidadeStatus(status1: string, status2: string): number {
    const prioridades: Record<string, number> = {
      'inadimplencia_critica': 12,
      'escalado_juridico': 11,
      'notificacao_formal': 10,
      'ignorado': 9,
      'quitado': 8,
      'pagamento_parcial': 7,
      'aguardando_pagamento': 6,
      'proposta_enviada': 5,
      'em_negociacao': 4,
      'reuniao_agendada': 3,
      'notificado': 2,
      'em_aberto': 1
    };
    
    return (prioridades[status1] || 0) - (prioridades[status2] || 0);
  }

  private aplicarFiltrosCard(card: CardCobranca, filtros: FiltrosKanban): boolean {
    if (filtros.tipo_debito && card.tipo_debito !== filtros.tipo_debito) return false;
    if (filtros.responsavel && !card.responsavel_atual.toLowerCase().includes(filtros.responsavel.toLowerCase())) return false;
    if (filtros.criticidade && card.criticidade !== filtros.criticidade) return false;
    if (filtros.dias_parado_min && card.dias_parado < filtros.dias_parado_min) return false;
    return true;
  }

  private calcularTempoMedioResolucao(cards: CardCobranca[]): number {
    const cardsComTempo = cards.filter(c => c.dias_parado > 0);
    if (cardsComTempo.length === 0) return 0;
    
    const somaTempos = cardsComTempo.reduce((sum, c) => sum + c.dias_parado, 0);
    return somaTempos / cardsComTempo.length;
  }

  private async registrarMovimentacao(movimentacao: MovimentacaoCard): Promise<void> {
    try {
      // Registra no log do sistema
      await supabase
        .from('logs_sistema')
        .insert({
          usuario_id: movimentacao.usuario,
          acao: 'mover_card_kanban',
          tabela_afetada: 'cobrancas_franqueados',
          registro_id: movimentacao.card_id,
          dados_anteriores: { status: movimentacao.status_origem },
          dados_novos: { status: movimentacao.status_destino },
          ip_origem: 'kanban_interface',
          user_agent: navigator.userAgent
        });
      
      console.log('Movimentação registrada no log:', movimentacao);
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      // Não falha a operação principal se o log falhar
    }
  }

  private async registrarLog(log: LogMovimentacao): Promise<void> {
    try {
      // Registra ação no log do sistema
      await supabase
        .from('logs_sistema')
        .insert({
          usuario_id: log.usuario,
          acao: log.acao,
          tabela_afetada: 'cobrancas_franqueados',
          registro_id: log.card_id,
          dados_novos: { detalhes: log.detalhes },
          ip_origem: 'kanban_interface',
          user_agent: navigator.userAgent
        });
      
      console.log('Log de ação registrado:', log);
    } catch (error) {
      console.error('Erro ao registrar log:', error);
      // Não falha a operação principal se o log falhar
    }
  }
}