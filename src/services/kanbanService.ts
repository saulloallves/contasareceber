import { createClient } from '@supabase/supabase-js';
import { CardCobranca, ColunaKanban, MovimentacaoCard, FiltrosKanban, EstatisticasKanban, LogMovimentacao } from '../types/kanban';
import { TrativativasService } from './tratativasService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
   * Busca cards do Kanban com filtros
   */
  async buscarCards(filtros: FiltrosKanban = {}): Promise<CardCobranca[]> {
    try {
      // Busca dados das cobranças agrupadas por CNPJ
      let query = supabase
        .from('cobrancas_franqueados')
        .select(`
          cnpj,
          cliente,
          valor_original,
          valor_atualizado,
          data_vencimento,
          status,
          created_at,
          unidades_franqueadas (
            codigo_unidade,
            nome_franqueado
          )
        `)
        .neq('status', 'quitado');

      if (filtros.unidade) {
        query = query.ilike('cnpj', `%${filtros.unidade}%`);
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

      // Agrupa por CNPJ e cria cards
      const cardsMap = new Map<string, CardCobranca>();

      cobrancas?.forEach(cobranca => {
        const cnpj = cobranca.cnpj;
        
        if (!cardsMap.has(cnpj)) {
          const unidade = (cobranca as any).unidades_franqueadas;
          
          cardsMap.set(cnpj, {
            id: cnpj,
            codigo_unidade: unidade?.codigo_unidade || cnpj,
            nome_unidade: unidade?.nome_franqueado || cobranca.cliente,
            cnpj: cnpj,
            tipo_debito: this.determinarTipoDebito(cobrancas.filter(c => c.cnpj === cnpj)),
            valor_total: 0,
            data_vencimento_antiga: cobranca.data_vencimento,
            data_vencimento_recente: cobranca.data_vencimento,
            status_atual: this.determinarStatusKanban(cobranca.status),
            ultima_acao: 'Cobrança registrada no sistema',
            data_ultima_acao: cobranca.created_at || new Date().toISOString(),
            responsavel_atual: this.determinarResponsavel(cobranca.status),
            dias_parado: this.calcularDiasParado(cobranca.created_at || new Date().toISOString()),
            criticidade: 'normal',
            data_entrada_etapa: cobranca.created_at || new Date().toISOString()
          });
        }

        const card = cardsMap.get(cnpj)!;
        card.valor_total += cobranca.valor_atualizado || cobranca.valor_original;
        
        // Atualiza datas de vencimento
        if (new Date(cobranca.data_vencimento) < new Date(card.data_vencimento_antiga)) {
          card.data_vencimento_antiga = cobranca.data_vencimento;
        }
        if (new Date(cobranca.data_vencimento) > new Date(card.data_vencimento_recente)) {
          card.data_vencimento_recente = cobranca.data_vencimento;
        }
      });

      // Determina criticidade baseada no valor e tempo
      const cards = Array.from(cardsMap.values()).map(card => ({
        ...card,
        criticidade: this.determinarCriticidade(card)
      }));

      // Aplica filtros adicionais
      return cards.filter(card => {
        if (filtros.tipo_debito && card.tipo_debito !== filtros.tipo_debito) return false;
        if (filtros.responsavel && !card.responsavel_atual.toLowerCase().includes(filtros.responsavel.toLowerCase())) return false;
        if (filtros.criticidade && card.criticidade !== filtros.criticidade) return false;
        if (filtros.dias_parado_min && card.dias_parado < filtros.dias_parado_min) return false;
        return true;
      });
    } catch (error) {
      console.error('Erro ao buscar cards:', error);
      return [];
    }
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
      // Busca dados atuais do card
      const cards = await this.buscarCards();
      const card = cards.find(c => c.id === cardId);
      
      if (!card) {
        throw new Error('Card não encontrado');
      }

      // Atualiza status das cobranças relacionadas
      const novoStatusCobranca = this.mapearStatusKanbanParaCobranca(novoStatus);
      
      const { error } = await supabase
        .from('cobrancas_franqueados')
        .update({ status: novoStatusCobranca })
        .eq('cnpj', cardId);

      if (error) {
        throw new Error(`Erro ao atualizar status: ${error.message}`);
      }

      // Registra movimentação
      await this.registrarMovimentacao({
        card_id: cardId,
        status_origem: card.status_atual,
        status_destino: novoStatus,
        usuario,
        motivo,
        data_movimentacao: new Date().toISOString(),
        automatica: false
      });

      // Registra tratativa
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
          `Card movido no Kanban: ${card.status_atual} → ${novoStatus}. ${motivo}`,
          novoStatusCobranca
        );
      }
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
    usuario: string
  ): Promise<void> {
    try {
      const cards = await this.buscarCards();
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
        await this.moverCard(cardId, novoStatus, usuario, descricaoAcao);
      } else {
        // Apenas registra a ação
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
    usuario: string
  ): Promise<void> {
    try {
      // Em um sistema real, isso seria salvo em uma tabela específica
      // Por enquanto, registramos como log
      await this.registrarLog({
        card_id: cardId,
        acao: 'observacao',
        usuario: usuario,
        data_acao: new Date().toISOString(),
        detalhes: observacao
      });
    } catch (error) {
      console.error('Erro ao atualizar observação:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas do Kanban
   */
  async buscarEstatisticas(): Promise<EstatisticasKanban> {
    try {
      const cards = await this.buscarCards();
      
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
  async exportarKanban(filtros: FiltrosKanban = {}): Promise<string> {
    try {
      const cards = await this.buscarCards(filtros);
      
      const cabecalho = [
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
        'Criticidade'
      ].join(',');

      const linhas = cards.map(card => [
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
        card.criticidade
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
    // Lógica para determinar o tipo predominante
    const tipos = cobrancas.map(c => c.tipo_cobranca || 'royalties');
    const tipoMaisFrequente = tipos.reduce((a, b, i, arr) =>
      arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
    );
    return tipoMaisFrequente as any || 'royalties';
  }

  private determinarStatusKanban(statusCobranca: string): string {
    const mapeamento: Record<string, string> = {
      'novo': 'em_aberto',
      'em_aberto': 'em_aberto',
      'cobrado': 'notificado',
      'negociando': 'em_negociacao',
      'quitado': 'quitado',
      'em_tratativa_juridica': 'escalado_juridico'
    };
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

  private calcularTempoMedioResolucao(cards: CardCobranca[]): number {
    const cardsComTempo = cards.filter(c => c.dias_parado > 0);
    if (cardsComTempo.length === 0) return 0;
    
    const somaTempos = cardsComTempo.reduce((sum, c) => sum + c.dias_parado, 0);
    return somaTempos / cardsComTempo.length;
  }

  private async registrarMovimentacao(movimentacao: MovimentacaoCard): Promise<void> {
    try {
      // Em um sistema real, isso seria salvo em uma tabela específica
      console.log('Movimentação registrada:', movimentacao);
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
    }
  }

  private async registrarLog(log: LogMovimentacao): Promise<void> {
    try {
      // Em um sistema real, isso seria salvo em uma tabela específica
      console.log('Log registrado:', log);
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  }
}