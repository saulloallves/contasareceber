import { createClient } from '@supabase/supabase-js';
import { DashboardData, FiltrosDashboard, IndicadoresMensais, UnidadeRisco, EvolucaoTemporal, AlertaAutomatico, RelatorioExecutivo } from '../types/dashboard';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class DashboardService {
  /**
   * Busca indicadores mensais estratégicos
   */
  async buscarIndicadoresMensais(): Promise<IndicadoresMensais> {
    try {
      const agora = new Date();
      const inicioMes = startOfMonth(agora);
      const fimMes = endOfMonth(agora);
      
      const mesAnterior = subMonths(agora, 1);
      const inicioMesAnterior = startOfMonth(mesAnterior);
      const fimMesAnterior = endOfMonth(mesAnterior);

      // Busca dados do mês atual
      const { data: dadosAtual } = await supabase
        .from('cobrancas_franqueados')
        .select('valor_original, valor_recebido, valor_atualizado, status, cnpj')
        .gte('created_at', inicioMes.toISOString())
        .lte('created_at', fimMes.toISOString());

      // Busca dados do mês anterior
      const { data: dadosAnterior } = await supabase
        .from('cobrancas_franqueados')
        .select('valor_original, valor_recebido, valor_atualizado, status, cnpj')
        .gte('created_at', inicioMesAnterior.toISOString())
        .lte('created_at', fimMesAnterior.toISOString());

      // Calcula indicadores do mês atual
      const totalEmAbertoMes = dadosAtual?.filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0) || 0;
      
      const totalPagoMes = dadosAtual?.filter(c => c.status === 'quitado')
        .reduce((sum, c) => sum + c.valor_recebido, 0) || 0;
      
      const totalEmitidoMes = dadosAtual?.reduce((sum, c) => sum + c.valor_original, 0) || 0;
      
      const percentualInadimplencia = totalEmitidoMes > 0 ? (totalEmAbertoMes / totalEmitidoMes) * 100 : 0;
      
      const unidadesInadimplentes = new Set(
        dadosAtual?.filter(c => c.status === 'em_aberto').map(c => c.cnpj) || []
      ).size;

      const ticketMedioDividas = unidadesInadimplentes > 0 ? totalEmAbertoMes / unidadesInadimplentes : 0;

      // Calcula indicadores do mês anterior para comparação
      const totalEmAbertoAnterior = dadosAnterior?.filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0) || 0;
      
      const totalPagoAnterior = dadosAnterior?.filter(c => c.status === 'quitado')
        .reduce((sum, c) => sum + c.valor_recebido, 0) || 0;

      const totalEmitidoAnterior = dadosAnterior?.reduce((sum, c) => sum + c.valor_original, 0) || 0;

      // Calcula variações
      const variacaoEmAberto = totalEmAbertoAnterior > 0 
        ? ((totalEmAbertoMes - totalEmAbertoAnterior) / totalEmAbertoAnterior) * 100 
        : 0;
      
      const variacaoPago = totalPagoAnterior > 0 
        ? ((totalPagoMes - totalPagoAnterior) / totalPagoAnterior) * 100 
        : 0;

      const percentualRecuperacao = totalPagoMes > 0 && totalPagoAnterior > 0 
        ? ((totalPagoMes - totalPagoAnterior) / totalPagoAnterior) * 100 
        : 0;

      return {
        total_em_aberto_mes: totalEmAbertoMes,
        total_pago_mes: totalPagoMes,
        percentual_inadimplencia: percentualInadimplencia,
        unidades_inadimplentes: unidadesInadimplentes,
        ticket_medio_dividas: ticketMedioDividas,
        percentual_recuperacao: percentualRecuperacao,
        comparativo_mes_anterior: {
          variacao_em_aberto: variacaoEmAberto,
          variacao_pago: variacaoPago,
          variacao_inadimplencia: percentualInadimplencia - (totalEmitidoAnterior > 0 ? (totalEmAbertoAnterior / totalEmitidoAnterior) * 100 : 0)
        }
      };
    } catch (error) {
      console.error('Erro ao buscar indicadores mensais:', error);
      throw error;
    }
  }

  /**
   * Busca unidades em maior risco
   */
  async buscarUnidadesRisco(limite: number = 10): Promise<UnidadeRisco[]> {
    try {
      const { data, error } = await supabase
        .rpc('buscar_unidades_maior_risco', { p_limite: limite });

      if (error) {
        throw new Error(`Erro ao buscar unidades de risco: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar unidades de risco:', error);
      throw error;
    }
  }

  /**
   * Busca evolução temporal dos últimos 6 meses
   */
  async buscarEvolucaoTemporal(): Promise<EvolucaoTemporal[]> {
    try {
      const evolucao = [];
      
      for (let i = 5; i >= 0; i--) {
        const dataRef = subMonths(new Date(), i);
        const inicioMes = startOfMonth(dataRef);
        const fimMes = endOfMonth(dataRef);

        const { data } = await supabase
          .from('cobrancas_franqueados')
          .select('valor_original, valor_recebido, valor_atualizado, status, cnpj')
          .gte('created_at', inicioMes.toISOString())
          .lte('created_at', fimMes.toISOString());

        const valorEmitido = data?.reduce((sum, c) => sum + c.valor_original, 0) || 0;
        const valorRecebido = data?.filter(c => c.status === 'quitado')
          .reduce((sum, c) => sum + c.valor_recebido, 0) || 0;
        const valorEmAberto = data?.filter(c => c.status === 'em_aberto')
          .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0) || 0;
        
        const percentualInadimplencia = valorEmitido > 0 ? (valorEmAberto / valorEmitido) * 100 : 0;
        const unidadesInadimplentes = new Set(
          data?.filter(c => c.status === 'em_aberto').map(c => c.cnpj) || []
        ).size;

        evolucao.push({
          periodo: format(dataRef, 'MMM/yy', { locale: ptBR }),
          valor_emitido: valorEmitido,
          valor_recebido: valorRecebido,
          valor_em_aberto: valorEmAberto,
          percentual_inadimplencia: percentualInadimplencia,
          unidades_inadimplentes: unidadesInadimplentes
        });
      }

      return evolucao;
    } catch (error) {
      console.error('Erro ao buscar evolução temporal:', error);
      throw error;
    }
  }

  /**
   * Busca alertas automáticos ativos
   */
  async buscarAlertasAutomaticos(): Promise<AlertaAutomatico[]> {
    try {
      const { data, error } = await supabase
        .from('alertas_sistema')
        .select(`
          *,
          unidades_franqueadas (
            nome_franqueado
          )
        `)
        .eq('resolvido', false)
        .order('data_criacao', { ascending: false })
        .limit(20);

      if (error) {
        throw new Error(`Erro ao buscar alertas: ${error.message}`);
      }

      return data?.map(alerta => ({
        id: alerta.id,
        tipo: alerta.tipo_alerta as any,
        titulo: alerta.titulo,
        descricao: alerta.descricao,
        cnpj_unidade: alerta.cnpj_unidade,
        nome_unidade: (alerta as any).unidades_franqueadas?.nome_franqueado || 'N/A',
        valor_envolvido: 0, // Seria calculado baseado no contexto
        data_criacao: alerta.data_criacao,
        urgencia: alerta.nivel_urgencia as any,
        acao_sugerida: alerta.acao_automatica || 'Verificar situação',
        resolvido: alerta.resolvido
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar alertas automáticos:', error);
      throw error;
    }
  }

  /**
   * Gera alertas automáticos baseado em critérios
   */
  async gerarAlertasAutomaticos(): Promise<number> {
    try {
      let alertasGerados = 0;

      // 1. Unidades com mais de 30 dias sem pagamento
      const { data: semPagamento } = await supabase
        .from('cobrancas_franqueados')
        .select('cnpj, cliente, dias_em_atraso, valor_atualizado')
        .eq('status', 'em_aberto')
        .gte('dias_em_atraso', 30);

      for (const cobranca of semPagamento || []) {
        await this.criarAlerta({
          tipo: 'sem_pagamento_30_dias',
          titulo: 'Unidade sem pagamento há 30+ dias',
          descricao: `Unidade ${cobranca.cliente} está há ${cobranca.dias_em_atraso} dias sem pagamento`,
          cnpj_unidade: cobranca.cnpj,
          urgencia: cobranca.dias_em_atraso > 60 ? 'alta' : 'media',
          acao_sugerida: 'Verificar situação e considerar escalonamento'
        });
        alertasGerados++;
      }

      // 2. Cobranças não respondidas após 3 tentativas
      const { data: naoRespondidas } = await supabase
        .from('envios_mensagem')
        .select(`
          cnpj,
          count(*),
          cobrancas_franqueados (
            cliente
          )
        `)
        .eq('status_envio', 'sucesso')
        .gte('data_envio', subMonths(new Date(), 1).toISOString())
        .group('cnpj')
        .having('count(*)', 'gte', 3);

      for (const envio of naoRespondidas || []) {
        await this.criarAlerta({
          tipo: 'cobrancas_ignoradas',
          titulo: 'Múltiplas cobranças ignoradas',
          descricao: `Unidade não responde após ${envio.count} tentativas de cobrança`,
          cnpj_unidade: envio.cnpj,
          urgencia: 'alta',
          acao_sugerida: 'Considerar escalonamento jurídico'
        });
        alertasGerados++;
      }

      return alertasGerados;
    } catch (error) {
      console.error('Erro ao gerar alertas automáticos:', error);
      throw error;
    }
  }

  /**
   * Cria um novo alerta no sistema
   */
  private async criarAlerta(alerta: Omit<AlertaAutomatico, 'id' | 'nome_unidade' | 'valor_envolvido' | 'data_criacao' | 'resolvido'>) {
    try {
      // Verifica se já existe alerta similar recente
      const { data: alertaExistente } = await supabase
        .from('alertas_sistema')
        .select('id')
        .eq('cnpj_unidade', alerta.cnpj_unidade)
        .eq('tipo_alerta', alerta.tipo)
        .eq('resolvido', false)
        .gte('data_criacao', subMonths(new Date(), 1).toISOString())
        .single();

      if (alertaExistente) return; // Não duplica alertas

      await supabase
        .from('alertas_sistema')
        .insert({
          cnpj_unidade: alerta.cnpj_unidade,
          tipo_alerta: alerta.tipo,
          titulo: alerta.titulo,
          descricao: alerta.descricao,
          nivel_urgencia: alerta.urgencia,
          acao_automatica: alerta.acao_sugerida,
          resolvido: false
        });
    } catch (error) {
      console.error('Erro ao criar alerta:', error);
    }
  }

  /**
   * Gera relatório executivo completo
   */
  async gerarRelatorioExecutivo(): Promise<RelatorioExecutivo> {
    try {
      const [indicadores, unidadesRisco, evolucao, alertas] = await Promise.all([
        this.buscarIndicadoresMensais(),
        this.buscarUnidadesRisco(5),
        this.buscarEvolucaoTemporal(),
        this.buscarAlertasAutomaticos()
      ]);

      const recomendacoes = this.gerarRecomendacoes(indicadores, unidadesRisco, alertas);

      return {
        periodo: format(new Date(), 'MMMM/yyyy', { locale: ptBR }),
        resumo_executivo: {
          total_carteira: indicadores.total_em_aberto_mes + indicadores.total_pago_mes,
          inadimplencia_atual: indicadores.total_em_aberto_mes,
          recuperacao_mes: indicadores.total_pago_mes,
          casos_criticos: unidadesRisco.filter(u => u.nivel_risco === 'critico').length
        },
        principais_indicadores: indicadores,
        unidades_atencao: unidadesRisco,
        evolucao_6_meses: evolucao,
        alertas_ativos: alertas.slice(0, 10),
        recomendacoes
      };
    } catch (error) {
      console.error('Erro ao gerar relatório executivo:', error);
      throw error;
    }
  }

  /**
   * Gera recomendações baseadas nos dados
   */
  private gerarRecomendacoes(
    indicadores: IndicadoresMensais,
    unidadesRisco: UnidadeRisco[],
    alertas: AlertaAutomatico[]
  ): string[] {
    const recomendacoes: string[] = [];

    // Análise de inadimplência
    if (indicadores.percentual_inadimplencia > 15) {
      recomendacoes.push('Taxa de inadimplência acima de 15% - Revisar política de cobrança');
    }

    // Análise de recuperação
    if (indicadores.percentual_recuperacao < 0) {
      recomendacoes.push('Queda na recuperação - Intensificar ações de cobrança');
    }

    // Análise de unidades críticas
    const unidadesCriticas = unidadesRisco.filter(u => u.nivel_risco === 'critico').length;
    if (unidadesCriticas > 3) {
      recomendacoes.push(`${unidadesCriticas} unidades em risco crítico - Priorizar escalonamento jurídico`);
    }

    // Análise de alertas
    const alertasCriticos = alertas.filter(a => a.urgencia === 'critica').length;
    if (alertasCriticos > 5) {
      recomendacoes.push('Múltiplos alertas críticos - Revisar processos de acompanhamento');
    }

    // Análise de ticket médio
    if (indicadores.ticket_medio_dividas > 5000) {
      recomendacoes.push('Ticket médio alto - Focar em acordos de parcelamento');
    }

    return recomendacoes;
  }

  /**
   * Busca dados completos para o dashboard
   */
  async buscarDadosDashboard(filtros: FiltrosDashboard = {}): Promise<DashboardData> {
    try {
      const [visaoGeral, rankingInadimplentes, evolucaoMensal, eficienciaCobrancas] = await Promise.all([
        this.buscarVisaoGeral(filtros),
        this.buscarRankingInadimplentes(filtros),
        this.buscarEvolucaoMensal(filtros),
        this.buscarEficienciaCobrancas(filtros)
      ]);

      return {
        visaoGeral,
        rankingInadimplentes,
        evolucaoMensal,
        eficienciaCobrancas
      };
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      throw error;
    }
  }

  /**
   * Busca dados da visão geral
   */
  private async buscarVisaoGeral(filtros: FiltrosDashboard) {
    let query = supabase
      .from('cobrancas_franqueados')
      .select('valor_atualizado, valor_original, status, dias_em_atraso');

    // Aplica filtros
    query = this.aplicarFiltros(query, filtros);

    const { data: cobrancas, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar visão geral: ${error.message}`);
    }

    if (!cobrancas) return this.getVisaoGeralVazia();

    // Calcula totais por status
    const totalEmAberto = cobrancas
      .filter(c => c.status === 'em_aberto')
      .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);

    const totalQuitado = cobrancas
      .filter(c => c.status === 'quitado')
      .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);

    const totalNegociando = cobrancas
      .filter(c => c.status === 'negociando')
      .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);

    // Calcula faixas de atraso
    const cobrancasEmAberto = cobrancas.filter(c => c.status === 'em_aberto');
    const faixasAtraso = {
      ate30: cobrancasEmAberto
        .filter(c => c.dias_em_atraso <= 30)
        .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0),
      de31a90: cobrancasEmAberto
        .filter(c => c.dias_em_atraso > 30 && c.dias_em_atraso <= 90)
        .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0),
      de91a180: cobrancasEmAberto
        .filter(c => c.dias_em_atraso > 90 && c.dias_em_atraso <= 180)
        .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0),
      mais180: cobrancasEmAberto
        .filter(c => c.dias_em_atraso > 180)
        .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0)
    };

    // Calcula percentuais
    const totalGeral = totalEmAberto + totalQuitado + totalNegociando;
    const percentuais = {
      quitados: totalGeral > 0 ? (totalQuitado / totalGeral) * 100 : 0,
      emAberto: totalGeral > 0 ? (totalEmAberto / totalGeral) * 100 : 0,
      negociando: totalGeral > 0 ? (totalNegociando / totalGeral) * 100 : 0
    };

    return {
      totalEmAberto,
      totalQuitado,
      totalNegociando,
      faixasAtraso,
      percentuais
    };
  }

  /**
   * Busca ranking de unidades inadimplentes
   */
  private async buscarRankingInadimplentes(filtros: FiltrosDashboard) {
    let query = supabase
      .from('cobrancas_franqueados')
      .select('cliente, cnpj, valor_atualizado, valor_original')
      .eq('status', 'em_aberto');

    query = this.aplicarFiltros(query, filtros);

    const { data: cobrancas, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar ranking: ${error.message}`);
    }

    if (!cobrancas) return [];

    // Agrupa por cliente/CNPJ
    const agrupados = cobrancas.reduce((acc, cobranca) => {
      const key = `${cobranca.cnpj}-${cobranca.cliente}`;
      if (!acc[key]) {
        acc[key] = {
          cliente: cobranca.cliente,
          cnpj: cobranca.cnpj,
          quantidadeTitulos: 0,
          valorTotal: 0
        };
      }
      acc[key].quantidadeTitulos++;
      acc[key].valorTotal += cobranca.valor_atualizado || cobranca.valor_original;
      return acc;
    }, {} as Record<string, any>);

    // Ordena por valor total e pega top 10
    return Object.values(agrupados)
      .sort((a: any, b: any) => b.valorTotal - a.valorTotal)
      .slice(0, 10);
  }

  /**
   * Busca evolução mensal
   */
  private async buscarEvolucaoMensal(filtros: FiltrosDashboard) {
    const mesesAtras = 12;
    const evolucao = [];

    for (let i = mesesAtras - 1; i >= 0; i--) {
      const dataRef = subMonths(new Date(), i);
      const inicioMes = startOfMonth(dataRef);
      const fimMes = endOfMonth(dataRef);

      // Busca valores recebidos no mês
      const { data: recebidos } = await supabase
        .from('cobrancas_franqueados')
        .select('valor_recebido')
        .gte('data_ultima_atualizacao', inicioMes.toISOString())
        .lte('data_ultima_atualizacao', fimMes.toISOString())
        .gt('valor_recebido', 0);

      // Busca valores inadimplentes no final do mês
      const { data: inadimplentes } = await supabase
        .from('cobrancas_franqueados')
        .select('valor_atualizado, valor_original')
        .eq('status', 'em_aberto')
        .lte('data_vencimento', fimMes.toISOString());

      // Busca valores recuperados (quitados no mês)
      const { data: recuperados } = await supabase
        .from('cobrancas_franqueados')
        .select('valor_atualizado, valor_original')
        .eq('status', 'quitado')
        .gte('data_ultima_atualizacao', inicioMes.toISOString())
        .lte('data_ultima_atualizacao', fimMes.toISOString());

      evolucao.push({
        mes: format(dataRef, 'MMM/yy', { locale: ptBR }),
        valorRecebido: recebidos?.reduce((sum, r) => sum + r.valor_recebido, 0) || 0,
        valorInadimplente: inadimplentes?.reduce((sum, i) => sum + (i.valor_atualizado || i.valor_original), 0) || 0,
        valorRecuperado: recuperados?.reduce((sum, r) => sum + (r.valor_atualizado || r.valor_original), 0) || 0
      });
    }

    return evolucao;
  }

  /**
   * Busca eficiência das cobranças
   */
  private async buscarEficienciaCobrancas(filtros: FiltrosDashboard) {
    // Total de mensagens enviadas
    let queryMensagens = supabase
      .from('envios_mensagem')
      .select('id', { count: 'exact' });

    if (filtros.dataInicio) {
      queryMensagens = queryMensagens.gte('data_envio', filtros.dataInicio);
    }
    if (filtros.dataFim) {
      queryMensagens = queryMensagens.lte('data_envio', filtros.dataFim);
    }

    const { count: totalMensagens } = await queryMensagens;

    // Simula agendamentos (seria uma tabela real em produção)
    const totalAgendamentos = Math.floor((totalMensagens || 0) * 0.3); // 30% de conversão

    // Títulos quitados após cobrança
    const { data: quitados } = await supabase
      .from('cobrancas_franqueados')
      .select('data_ultima_atualizacao, data_vencimento')
      .eq('status', 'quitado');

    // Calcula tempo médio de resolução (em dias)
    const temposResolucao = quitados?.map(q => {
      const vencimento = new Date(q.data_vencimento);
      const resolucao = new Date(q.data_ultima_atualizacao);
      return Math.max(0, Math.floor((resolucao.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24)));
    }) || [];

    const tempoMedioResolucao = temposResolucao.length > 0
      ? temposResolucao.reduce((sum, t) => sum + t, 0) / temposResolucao.length
      : 0;

    return {
      totalMensagens: totalMensagens || 0,
      totalAgendamentos,
      conversaoAgendamento: totalMensagens ? (totalAgendamentos / totalMensagens) * 100 : 0,
      tempoMedioResolucao,
      taxaConversao: totalAgendamentos > 0 ? (quitados?.length || 0) / totalAgendamentos * 100 : 0
    };
  }

  /**
   * Aplica filtros à query
   */
  private aplicarFiltros(query: any, filtros: FiltrosDashboard) {
    if (filtros.dataInicio) {
      query = query.gte('data_vencimento', filtros.dataInicio);
    }
    if (filtros.dataFim) {
      query = query.lte('data_vencimento', filtros.dataFim);
    }
    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }
    if (filtros.cnpj) {
      query = query.ilike('cnpj', `%${filtros.cnpj}%`);
    }
    return query;
  }

  /**
   * Retorna estrutura vazia para visão geral
   */
  private getVisaoGeralVazia() {
    return {
      totalEmAberto: 0,
      totalQuitado: 0,
      totalNegociando: 0,
      faixasAtraso: { ate30: 0, de31a90: 0, de91a180: 0, mais180: 0 },
      percentuais: { quitados: 0, emAberto: 0, negociando: 0 }
    };
  }

  /**
   * Exporta dados para Excel
   */
  async exportarParaExcel(dados: DashboardData): Promise<Blob> {
    // Implementação básica - em produção usar biblioteca como xlsx
    const csvContent = this.converterParaCSV(dados);
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Converte dados para CSV
   */
  private converterParaCSV(dados: DashboardData): string {
    let csv = 'Dashboard de Inadimplência\n\n';
    
    // Visão Geral
    csv += 'VISÃO GERAL\n';
    csv += `Total em Aberto,${dados.visaoGeral.totalEmAberto.toFixed(2)}\n`;
    csv += `Total Quitado,${dados.visaoGeral.totalQuitado.toFixed(2)}\n`;
    csv += `Total Negociando,${dados.visaoGeral.totalNegociando.toFixed(2)}\n\n`;

    // Ranking
    csv += 'RANKING INADIMPLENTES\n';
    csv += 'Cliente,CNPJ,Quantidade Títulos,Valor Total\n';
    dados.rankingInadimplentes.forEach(item => {
      csv += `${item.cliente},${item.cnpj},${item.quantidadeTitulos},${item.valorTotal.toFixed(2)}\n`;
    });

    return csv;
  }

  /**
   * Resolve alerta automático
   */
  async resolverAlerta(alertaId: string, observacoes?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alertas_sistema')
        .update({
          resolvido: true,
          data_resolucao: new Date().toISOString(),
          acao_automatica: observacoes
        })
        .eq('id', alertaId);

      if (error) {
        throw new Error(`Erro ao resolver alerta: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
      throw error;
    }
  }

  /**
   * Agenda envio automático de relatório
   */
  async agendarRelatorioSemanal(destinatarios: string[]): Promise<void> {
    try {
      // Em produção, integrar com sistema de agendamento (cron job, n8n, etc.)
      console.log('Agendando relatório semanal para:', destinatarios);
      
      // Simula agendamento
      const relatorio = await this.gerarRelatorioExecutivo();
      
      // Em produção, enviar por email
      console.log('Relatório gerado:', relatorio);
    } catch (error) {
      console.error('Erro ao agendar relatório:', error);
      throw error;
    }
  }
}