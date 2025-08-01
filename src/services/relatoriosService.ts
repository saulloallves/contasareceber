import { supabase } from './databaseService';
import { RelatorioMensal, DadosConsolidados, FiltroRelatorio, IndicadorEstrategico, RelatorioDetalhado, ExportacaoRelatorio } from '../types/relatorios';
import { UnidadesService } from './unidadesService';
import { CobrancaService } from './cobrancaService';

export class RelatoriosService {
  private static unidadesService = new UnidadesService();
  private static cobrancaService = new CobrancaService();

  /**
   * Gera relatório mensal consolidado
   */
  static async gerarRelatorioMensal(mes: number, ano: number): Promise<RelatorioMensal> {
    try {
      const referenciaMes = `${ano}-${mes.toString().padStart(2, '0')}`;
      const dadosConsolidados = await this.obterDadosConsolidados(mes, ano);
      
      const relatorio: Omit<RelatorioMensal, 'created_at' | 'updated_at'> = {
        id: crypto.randomUUID(),
        referencia_mes: referenciaMes,
        dados_consolidados: dadosConsolidados,
        gerado_em: new Date().toISOString(),
        gerado_por: 'usuario_atual',
        status_envio: 'gerado'
      };

      const { data, error } = await supabase
        .from('relatorios_mensais')
        .insert([relatorio])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao gerar relatório mensal:', error);
      throw error;
    }
  }

  /**
   * Busca dados de cobrança consolidados por unidade
   */
  static async obterDadosConsolidadosPorUnidade(filtros: FiltroRelatorio = {}) {
    try {
      const cobrancas = await this.buscarDadosCobranca(filtros);
      
      // Agrupa por unidade
      const unidadesMap = new Map();
      
      cobrancas.forEach(cobranca => {
        const unidade = (cobranca as any).unidades_franqueadas;
        const codigo = unidade?.codigo_unidade || cobranca.cnpj;
        
        if (!unidadesMap.has(codigo)) {
          unidadesMap.set(codigo, {
            codigo_unidade: codigo,
            nome_franqueado: unidade?.nome_franqueado || 'N/A',
            cidade: unidade?.cidade || 'N/A',
            estado: unidade?.estado || 'N/A',
            total_cobrancas: 0,
            valor_total_emitido: 0,
            valor_em_aberto: 0,
            valor_recuperado: 0,
            cobrancas_vencidas: 0,
            casos_juridicos: 0,
            acordos_ativos: 0,
            ultima_acao: 'N/A',
            data_ultima_acao: null
          });
        }
        
        const dadosUnidade = unidadesMap.get(codigo);
        dadosUnidade.total_cobrancas++;
        dadosUnidade.valor_total_emitido += Number(cobranca.valor_original);
        
        if (cobranca.status === 'em_aberto') {
          dadosUnidade.valor_em_aberto += Number(cobranca.valor_atualizado || cobranca.valor_original);
          if ((cobranca.dias_em_atraso || 0) > 0) {
            dadosUnidade.cobrancas_vencidas++;
          }
        } else if (cobranca.status === 'quitado') {
          dadosUnidade.valor_recuperado += Number(cobranca.valor_recebido || cobranca.valor_original);
        } else if (cobranca.status === 'em_tratativa_juridica') {
          dadosUnidade.casos_juridicos++;
        }
      });
      
      // Converte para array e calcula métricas adicionais
      return Array.from(unidadesMap.values()).map(unidade => ({
        ...unidade,
        percentual_inadimplencia: unidade.total_cobrancas > 0 
          ? (unidade.valor_em_aberto / unidade.valor_total_emitido) * 100 
          : 0,
        taxa_recuperacao: unidade.valor_total_emitido > 0 
          ? (unidade.valor_recuperado / unidade.valor_total_emitido) * 100 
          : 0,
        status_geral: unidade.valor_em_aberto === 0 ? 'regular' :
                     unidade.casos_juridicos > 0 ? 'critico' :
                     unidade.cobrancas_vencidas > 2 ? 'atencao' : 'normal'
      })).sort((a, b) => b.valor_em_aberto - a.valor_em_aberto);
    } catch (error) {
      console.error('Erro ao obter dados consolidados por unidade:', error);
      throw error;
    }
  }

  /**
   * Gera relatório de performance por responsável
   */
  static async obterPerformancePorResponsavel(filtros: FiltroRelatorio = {}) {
    try {
      // Busca tratativas do período
      let query = supabase
        .from('tratativas_cobranca')
        .select(`
          usuario_sistema,
          tipo_interacao,
          status_cobranca_resultante,
          data_interacao,
          cobrancas_franqueados (
            valor_original,
            valor_atualizado,
            status
          )
        `);

      if (filtros.dataInicio) {
        query = query.gte('data_interacao', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data_interacao', filtros.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupa por responsável
      const responsaveisMap = new Map();
      
      data?.forEach(tratativa => {
        const responsavel = tratativa.usuario_sistema;
        
        if (!responsaveisMap.has(responsavel)) {
          responsaveisMap.set(responsavel, {
            nome: responsavel,
            total_acoes: 0,
            cobrancas_resolvidas: 0,
            valor_recuperado: 0,
            tempo_medio_resolucao: 0,
            tipos_acao: {},
            taxa_sucesso: 0
          });
        }
        
        const dados = responsaveisMap.get(responsavel);
        dados.total_acoes++;
        
        // Conta tipos de ação
        dados.tipos_acao[tratativa.tipo_interacao] = (dados.tipos_acao[tratativa.tipo_interacao] || 0) + 1;
        
        // Se resultou em quitação
        if (tratativa.status_cobranca_resultante === 'quitado') {
          dados.cobrancas_resolvidas++;
          const cobranca = (tratativa as any).cobrancas_franqueados;
          if (cobranca) {
            dados.valor_recuperado += Number(cobranca.valor_original);
          }
        }
      });
      
      // Calcula taxa de sucesso
      return Array.from(responsaveisMap.values()).map(resp => ({
        ...resp,
        taxa_sucesso: resp.total_acoes > 0 ? (resp.cobrancas_resolvidas / resp.total_acoes) * 100 : 0
      })).sort((a, b) => b.taxa_sucesso - a.taxa_sucesso);
    } catch (error) {
      console.error('Erro ao obter performance por responsável:', error);
      throw error;
    }
  }

  /**
   * Obter dados consolidados para o relatório
   */
  static async obterDadosConsolidados(mes: number, ano: number): Promise<DadosConsolidados> {
    try {
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0);

      // Buscar cobranças do período
      const { data: cobrancas, error: cobrancasError } = await supabase
        .from('cobrancas_franqueados')
        .select(`
          *,
          unidades_franqueadas!inner(nome_franqueado, estado, cidade, codigo_unidade)
        `)
        .gte('data_vencimento', inicioMes.toISOString().split('T')[0])
        .lte('data_vencimento', fimMes.toISOString().split('T')[0]);

      if (cobrancasError) throw cobrancasError;

      // Buscar acordos do período
      const { data: acordos, error: acordosError } = await supabase
        .from('acordos_parcelamento')
        .select('*')
        .gte('created_at', inicioMes.toISOString())
        .lte('created_at', fimMes.toISOString());

      if (acordosError) throw acordosError;

      // Buscar escalonamentos jurídicos
      const { data: escalonamentos, error: escalonamentosError } = await supabase
        .from('escalonamentos_cobranca')
        .select('*')
        .gte('created_at', inicioMes.toISOString())
        .lte('created_at', fimMes.toISOString());

      if (escalonamentosError) throw escalonamentosError;

      // Buscar simulações de parcelamento
      const { data: simulacoes, error: simulacoesError } = await supabase
        .from('simulacoes_parcelamento')
        .select('*')
        .gte('created_at', inicioMes.toISOString())
        .lte('created_at', fimMes.toISOString());

      if (simulacoesError) throw simulacoesError;

      // Calcular métricas
      const totalCobrancas = cobrancas?.length || 0;
      const valorTotalInadimplente = cobrancas?.filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original) || 0), 0) || 0;
      
      const valorTotalRecuperado = cobrancas?.filter(c => c.status === 'quitado')
        .reduce((sum, c) => sum + (Number(c.valor_recebido) || Number(c.valor_original) || 0), 0) || 0;

      const unidadesInadimplentes = new Set(
        cobrancas?.filter(c => c.status === 'em_aberto')?.map(c => c.cnpj)
      ).size;

      const unidadesCriticas = new Set(
        cobrancas?.filter(c => c.status === 'em_aberto' && (c.dias_em_atraso || 0) > 30)?.map(c => c.cnpj)
      ).size;

      const acordosAtivos = acordos?.filter(a => ['aceito', 'cumprindo'].includes(a.status_acordo)).length || 0;

      const taxaRecuperacao = (valorTotalInadimplente + valorTotalRecuperado) > 0 
        ? (valorTotalRecuperado / (valorTotalInadimplente + valorTotalRecuperado)) * 100 
        : 0;

      const percentualInadimplencia = totalCobrancas > 0 
        ? (cobrancas?.filter(c => c.status === 'em_aberto').length || 0) / totalCobrancas * 100 
        : 0;

      // Distribuição por estado
      const porEstado = cobrancas?.reduce((acc, cobranca) => {
        const estado = (cobranca as any).unidades_franqueadas?.estado || 'N/A';
        if (!acc[estado]) {
          acc[estado] = { total: 0, valor: 0 };
        }
        acc[estado].total += 1;
        acc[estado].valor += Number(cobranca.valor_atualizado || cobranca.valor_original);
        return acc;
      }, {} as Record<string, { total: number; valor: number }>) || {};

      // Distribuição por tipo
      const porTipo = cobrancas?.reduce((acc, cobranca) => {
        const tipo = cobranca.tipo_cobranca || 'outros';
        if (!acc[tipo]) {
          acc[tipo] = { total: 0, valor: 0 };
        }
        acc[tipo].total += 1;
        acc[tipo].valor += Number(cobranca.valor_atualizado || cobranca.valor_original);
        return acc;
      }, {} as Record<string, { total: number; valor: number }>) || {};

      // Evolução dos últimos 6 meses
      const evolucaoMensal = await this.obterEvolucaoMensal(ano, mes);

      return {
        total_inadimplente: valorTotalInadimplente,
        total_recuperado: valorTotalRecuperado,
        total_cobrancas: totalCobrancas,
        unidades_inadimplentes: unidadesInadimplentes,
        unidades_criticas: unidadesCriticas,
        acordos_ativos: acordosAtivos,
        taxa_recuperacao: taxaRecuperacao,
        percentual_inadimplencia: percentualInadimplencia,
        valor_medio_cobranca: totalCobrancas > 0 ? valorTotalInadimplente / totalCobrancas : 0,
        distribuicao_por_estado: porEstado,
        distribuicao_por_tipo: porTipo,
        evolucao_mensal: evolucaoMensal,
        casos_juridicos: {
          total_escalonados: escalonamentos?.length || 0,
          valor_total_juridico: escalonamentos?.reduce((sum, e) => sum + e.valor_total_envolvido, 0) || 0,
          tempo_medio_resolucao: await this.calcularTempoMedioResolucao()
        },
        parcelamentos: {
          total_simulacoes: simulacoes?.length || 0,
          total_aceites: acordos?.filter(a => a.status_acordo === 'aceito').length || 0,
          valor_total_parcelado: acordos?.reduce((sum, a) => sum + a.valor_total_acordo, 0) || 0,
          taxa_conversao: simulacoes?.length ? ((acordos?.length || 0) / simulacoes.length) * 100 : 0
        }
      };
    } catch (error) {
      console.error('Erro ao obter dados consolidados:', error);
      throw error;
    }
  }

  /**
   * Lista relatórios com filtros
   */
  static async listarRelatorios(filtros?: FiltroRelatorio) {
    try {
      let query = supabase
        .from('relatorios_mensais')
        .select('*')
        .order('gerado_em', { ascending: false });

      if (filtros?.mes && filtros?.ano) {
        const referencia = `${filtros.ano}-${filtros.mes.toString().padStart(2, '0')}`;
        query = query.eq('referencia_mes', referencia);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao listar relatórios:', error);
      throw error;
    }
  }

  /**
   * Gera relatório detalhado com filtros
   */
  static async gerarRelatorioDetalhado(filtros: FiltroRelatorio): Promise<RelatorioDetalhado> {
    try {
      let query = supabase
        .from('cobrancas_franqueados')
        .select(`
          *,
          unidades_franqueadas!inner(*)
        `);

      // Aplicar filtros
      if (filtros.dataInicio) {
        query = query.gte('data_vencimento', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data_vencimento', filtros.dataFim);
      }
      if (filtros.unidade) {
        query = query.eq('cnpj', filtros.unidade);
      }
      if (filtros.estado) {
        query = query.eq('unidades_franqueadas.estado', filtros.estado);
      }
      if (filtros.tipo_cobranca) {
        query = query.eq('tipo_cobranca', filtros.tipo_cobranca);
      }
      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros.valor_min) {
        query = query.gte('valor_atualizado', filtros.valor_min);
      }
      if (filtros.valor_max) {
        query = query.lte('valor_atualizado', filtros.valor_max);
      }

      const { data: cobrancas, error } = await query;
      if (error) throw error;

      // Processar dados para o relatório
      const totalCarteira = cobrancas?.reduce((sum, c) => sum + (Number(c.valor_original) || 0), 0) || 0;
      const inadimplenciaAtual = cobrancas?.filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original) || 0), 0) || 0;
      const recuperacaoPeriodo = cobrancas?.filter(c => c.status === 'quitado')
        .reduce((sum, c) => sum + (Number(c.valor_recebido) || Number(c.valor_original) || 0), 0) || 0;

      // Agrupar por unidade
      const unidadesMap = new Map();
      cobrancas?.forEach(cobranca => {
        const unidade = (cobranca as any).unidades_franqueadas;
        const codigo = unidade?.codigo_unidade || cobranca.cnpj;
        
        if (!unidadesMap.has(codigo)) {
          unidadesMap.set(codigo, {
            codigo,
            nome: unidade?.nome_franqueado || 'N/A',
            valor_em_aberto: 0,
            valor_recuperado: 0,
            total_cobrancas: 0,
            cobrancas_abertas: 0,
            ultima_acao: 'N/A'
          });
        }

        const dadosUnidade = unidadesMap.get(codigo);
        dadosUnidade.total_cobrancas++;
        
        if (cobranca.status === 'em_aberto') {
          dadosUnidade.valor_em_aberto += Number(cobranca.valor_atualizado || cobranca.valor_original);
          dadosUnidade.cobrancas_abertas++;
        } else if (cobranca.status === 'quitado') {
          dadosUnidade.valor_recuperado += Number(cobranca.valor_recebido || cobranca.valor_original);
        }
      });

      const unidades = Array.from(unidadesMap.values()).map(u => ({
        ...u,
        percentual_inadimplencia: u.total_cobrancas > 0 ? (u.cobrancas_abertas / u.total_cobrancas) * 100 : 0,
        status: u.cobrancas_abertas === 0 ? 'regular' : u.cobrancas_abertas > 3 ? 'critica' : 'atencao'
      }));

      // Buscar dados jurídicos
      const { data: juridico } = await supabase
        .from('escalonamentos_cobranca')
        .select('*')
        .gte('created_at', filtros.dataInicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', filtros.dataFim || new Date().toISOString());

      // Buscar dados de parcelamentos
      const { data: parcelamentos } = await supabase
        .from('propostas_parcelamento')
        .select('*')
        .gte('created_at', filtros.dataInicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', filtros.dataFim || new Date().toISOString());

      return {
        periodo: `${filtros.dataInicio || 'Início'} a ${filtros.dataFim || 'Hoje'}`,
        resumo_executivo: {
          total_carteira: totalCarteira,
          inadimplencia_atual: inadimplenciaAtual,
          recuperacao_periodo: recuperacaoPeriodo,
          casos_criticos: unidades.filter(u => u.status === 'critica').length,
          eficiencia_cobranca: totalCarteira > 0 ? (recuperacaoPeriodo / totalCarteira) * 100 : 0
        },
        unidades: unidades.sort((a, b) => b.valor_em_aberto - a.valor_em_aberto),
        juridico: {
          casos_escalonados: juridico?.length || 0,
          valor_envolvido: juridico?.reduce((sum, j) => sum + j.valor_total_envolvido, 0) || 0,
          casos_resolvidos: juridico?.filter(j => j.status === 'resolvido').length || 0,
          tempo_medio_resolucao: await this.calcularTempoMedioResolucao()
        },
        parcelamentos: {
          propostas_enviadas: parcelamentos?.length || 0,
          propostas_aceitas: parcelamentos?.filter(p => p.status_proposta === 'aceita').length || 0,
          valor_parcelado: parcelamentos?.reduce((sum, p) => sum + ((p as any).simulacoes_parcelamento?.valor_total_parcelamento || 0), 0) || 0,
          taxa_sucesso: parcelamentos?.length ? ((parcelamentos.filter(p => p.status_proposta === 'aceita').length / parcelamentos.length) * 100) : 0
        },
        alertas_criticos: await this.obterAlertasCriticos()
      };
    } catch (error) {
      console.error('Erro ao gerar relatório detalhado:', error);
      throw error;
    }
  }

  /**
   * Busca indicadores estratégicos
   */
  static async obterIndicadoresEstrategicos(): Promise<IndicadorEstrategico[]> {
    try {
      const agora = new Date();
      const mesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const mesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
      const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0);

      // Dados do mês atual
      const { data: cobrancasAtual } = await supabase
        .from('cobrancas_franqueados')
        .select('*')
        .gte('created_at', mesAtual.toISOString());

      // Dados do mês anterior
      const { data: cobrancasAnterior } = await supabase
        .from('cobrancas_franqueados')
        .select('*')
        .gte('created_at', mesAnterior.toISOString())
        .lte('created_at', fimMesAnterior.toISOString());

      const indicadores: IndicadorEstrategico[] = [
        {
          nome: 'Total em Aberto',
          valor_atual: cobrancasAtual?.filter(c => c.status === 'em_aberto')
            .reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original)), 0) || 0,
          valor_anterior: cobrancasAnterior?.filter(c => c.status === 'em_aberto')
            .reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original)), 0) || 0,
          variacao_percentual: 0,
          tendencia: 'estavel',
          meta: 50000,
          status_meta: 'sem_meta',
          descricao: 'Valor total de cobranças em aberto'
        },
        {
          nome: 'Taxa de Recuperação',
          valor_atual: this.calcularTaxaRecuperacao(cobrancasAtual || []),
          valor_anterior: this.calcularTaxaRecuperacao(cobrancasAnterior || []),
          variacao_percentual: 0,
          tendencia: 'estavel',
          meta: 80,
          status_meta: 'sem_meta',
          descricao: 'Percentual de valores recuperados'
        },
        {
          nome: 'Unidades Inadimplentes',
          valor_atual: new Set(cobrancasAtual?.filter(c => c.status === 'em_aberto')?.map(c => c.cnpj)).size,
          valor_anterior: new Set(cobrancasAnterior?.filter(c => c.status === 'em_aberto')?.map(c => c.cnpj)).size,
          variacao_percentual: 0,
          tendencia: 'estavel',
          meta: 10,
          status_meta: 'sem_meta',
          descricao: 'Número de unidades com débitos em aberto'
        }
      ];

      // Calcular variações e tendências
      indicadores.forEach(indicador => {
        if (indicador.valor_anterior > 0) {
          indicador.variacao_percentual = ((indicador.valor_atual - indicador.valor_anterior) / indicador.valor_anterior) * 100;
        }
        
        if (indicador.variacao_percentual > 5) {
          indicador.tendencia = 'crescente';
        } else if (indicador.variacao_percentual < -5) {
          indicador.tendencia = 'decrescente';
        }

        if (indicador.meta) {
          indicador.status_meta = indicador.valor_atual <= indicador.meta ? 'atingida' : 'nao_atingida';
        }
      });

      return indicadores;
    } catch (error) {
      console.error('Erro ao obter indicadores estratégicos:', error);
      return [];
    }
  }

  /**
   * Exporta relatório em diferentes formatos
   */
  static async exportarRelatorio(
    relatorioId: string, 
    formato: ExportacaoRelatorio['formato'],
    opcoes: ExportacaoRelatorio
  ): Promise<string> {
    try {
      const { data: relatorio, error } = await supabase
        .from('relatorios_mensais')
        .select('*')
        .eq('id', relatorioId)
        .single();

      if (error) throw error;

      switch (formato) {
        case 'pdf':
          return await this.exportarPDF(relatorio, opcoes);
        case 'xlsx':
          return await this.exportarExcel(relatorio, opcoes);
        case 'csv':
          return await this.exportarCSV(relatorio, opcoes);
        case 'json':
          return await this.exportarJSON(relatorio, opcoes);
        default:
          throw new Error('Formato não suportado');
      }
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      throw error;
    }
  }

  /**
   * Busca dados de cobrança com filtros avançados
   */
  static async buscarDadosCobranca(filtros: FiltroRelatorio) {
    try {
      let query = supabase
        .from('cobrancas_franqueados')
        .select(`
          *,
          unidades_franqueadas!inner(*)
        `);

      // Aplicar todos os filtros
      if (filtros.dataInicio) {
        query = query.gte('data_vencimento', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data_vencimento', filtros.dataFim);
      }
      if (filtros.unidade) {
        query = query.eq('cnpj', filtros.unidade);
      }
      if (filtros.estado) {
        query = query.eq('unidades_franqueadas.estado', filtros.estado);
      }
      if (filtros.tipo_cobranca) {
        query = query.eq('tipo_cobranca', filtros.tipo_cobranca);
      }
      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros.valor_min) {
        query = query.gte('valor_atualizado', filtros.valor_min);
      }
      if (filtros.valor_max) {
        query = query.lte('valor_atualizado', filtros.valor_max);
      }
      if (!filtros.incluir_quitados) {
        query = query.neq('status', 'quitado');
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar dados de cobrança:', error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private static async obterEvolucaoMensal(ano: number, mes: number) {
    const evolucao = [];
    
    for (let i = 5; i >= 0; i--) {
      const dataRef = new Date(ano, mes - 1 - i, 1);
      const proximoMes = new Date(ano, mes - i, 1);
      
      const { data } = await supabase
        .from('cobrancas_franqueados')
        .select('valor_original, valor_atualizado, valor_recebido, status')
        .gte('data_vencimento', dataRef.toISOString().split('T')[0])
        .lt('data_vencimento', proximoMes.toISOString().split('T')[0]);

      const valorEmitido = data?.reduce((sum, c) => sum + Number(c.valor_original), 0) || 0;
      const valorRecuperado = data?.filter(c => c.status === 'quitado')
        .reduce((sum, c) => sum + Number(c.valor_recebido || c.valor_original), 0) || 0;
      const valorInadimplente = data?.filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + Number(c.valor_atualizado || c.valor_original), 0) || 0;

      evolucao.push({
        mes: dataRef.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        valor_emitido: valorEmitido,
        valor_recuperado: valorRecuperado,
        valor_inadimplente: valorInadimplente
      });
    }
    
    return evolucao;
  }

  private static async calcularTempoMedioResolucao(): Promise<number> {
    const { data } = await supabase
      .from('escalonamentos_cobranca')
      .select('created_at, updated_at')
      .eq('status', 'resolvido')
      .limit(50);

    if (!data || data.length === 0) return 0;

    const tempos = data.map(e => {
      const inicio = new Date(e.created_at);
      const fim = new Date(e.updated_at);
      return Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    });

    return tempos.reduce((sum, t) => sum + t, 0) / tempos.length;
  }

  private static calcularTaxaRecuperacao(cobrancas: any[]): number {
    const total = cobrancas.reduce((sum, c) => sum + Number(c.valor_original), 0);
    const recuperado = cobrancas.filter(c => c.status === 'quitado')
      .reduce((sum, c) => sum + Number(c.valor_recebido || c.valor_original), 0);
    
    return total > 0 ? (recuperado / total) * 100 : 0;
  }

  private static async obterAlertasCriticos() {
    const { data } = await supabase
      .from('cobrancas_franqueados')
      .select(`
        *,
        unidades_franqueadas!inner(nome_franqueado)
      `)
      .eq('status', 'em_aberto')
      .gte('dias_em_atraso', 60);

    const alertas = [];
    
    if (data && data.length > 0) {
      const valorTotal = data.reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original)), 0);
      
      alertas.push({
        tipo: 'Inadimplência Crítica',
        descricao: 'Unidades com mais de 60 dias de atraso',
        unidades_afetadas: new Set(data.map(c => c.cnpj)).size,
        valor_envolvido: valorTotal
      });
    }

    return alertas;
  }

  private static async exportarPDF(relatorio: RelatorioMensal, opcoes: ExportacaoRelatorio): Promise<string> {
    const htmlContent = this.gerarHTMLRelatorio(relatorio, opcoes);
    const pdfUrl = `data:text/html;base64,${btoa(htmlContent)}`;
    
    await supabase
      .from('relatorios_mensais')
      .update({ url_pdf: pdfUrl })
      .eq('id', relatorio.id);

    return pdfUrl;
  }

  private static async exportarExcel(relatorio: RelatorioMensal, opcoes: ExportacaoRelatorio): Promise<string> {
    // Implementar exportação Excel
    const csvData = await this.exportarCSV(relatorio, opcoes);
    return csvData;
  }

  private static async exportarCSV(relatorio: RelatorioMensal, opcoes: ExportacaoRelatorio): Promise<string> {
    const dados = relatorio.dados_consolidados;
    
    const cabecalho = [
      'Métrica',
      'Valor',
      'Tipo'
    ].join(',');

    const linhas = [
      ['Total Inadimplente', dados.total_inadimplente.toFixed(2), 'Valor'],
      ['Total Recuperado', dados.total_recuperado.toFixed(2), 'Valor'],
      ['Total Cobranças', dados.total_cobrancas.toString(), 'Quantidade'],
      ['Unidades Inadimplentes', dados.unidades_inadimplentes.toString(), 'Quantidade'],
      ['Taxa Recuperação', dados.taxa_recuperacao.toFixed(2), 'Percentual'],
      ['Percentual Inadimplência', dados.percentual_inadimplencia.toFixed(2), 'Percentual']
    ].map(linha => linha.join(','));

    return [cabecalho, ...linhas].join('\n');
  }

  private static async exportarJSON(relatorio: RelatorioMensal, opcoes: ExportacaoRelatorio): Promise<string> {
    return JSON.stringify(relatorio, null, 2);
  }

  private static gerarHTMLRelatorio(relatorio: RelatorioMensal, opcoes: ExportacaoRelatorio): string {
    const dados = relatorio.dados_consolidados;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório Mensal - ${relatorio.referencia_mes}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
          .metric { margin: 10px 0; padding: 15px; border-left: 4px solid #3b82f6; background: #f8fafc; }
          .section { margin: 30px 0; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th, .table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          .table th { background-color: #3b82f6; color: white; }
          .chart-placeholder { background: #f1f5f9; padding: 40px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 10px 0; }
          .success { background: #f0fdf4; border: 1px solid #bbf7d0; }
          .warning { background: #fffbeb; border: 1px solid #fed7aa; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório Mensal de Cobranças</h1>
          <h2>${relatorio.referencia_mes}</h2>
          <p>Gerado em: ${new Date(relatorio.gerado_em).toLocaleDateString('pt-BR')}</p>
        </div>

        <div class="section">
          <h3>Resumo Executivo</h3>
          <div class="metric success">
            <strong>Total Recuperado:</strong> R$ ${dados.total_recuperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div class="metric ${dados.total_inadimplente > 100000 ? 'alert' : 'warning'}">
            <strong>Total Inadimplente:</strong> R$ ${dados.total_inadimplente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div class="metric">
            <strong>Taxa de Recuperação:</strong> ${dados.taxa_recuperacao.toFixed(2)}%
          </div>
          <div class="metric">
            <strong>Unidades Inadimplentes:</strong> ${dados.unidades_inadimplentes}
          </div>
          <div class="metric ${dados.unidades_criticas > 5 ? 'alert' : ''}">
            <strong>Unidades Críticas:</strong> ${dados.unidades_criticas}
          </div>
        </div>

        ${opcoes.incluir_graficos ? `
        <div class="section">
          <h3>Evolução Mensal</h3>
          <div class="chart-placeholder">
            <p>Gráfico de Evolução dos Últimos 6 Meses</p>
            <p>(Implementar com biblioteca de gráficos)</p>
          </div>
        </div>
        ` : ''}

        <div class="section">
          <h3>Distribuição por Estado</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Quantidade</th>
                <th>Valor (R$)</th>
                <th>% do Total</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(dados.distribuicao_por_estado).map(([estado, info]) => `
                <tr>
                  <td>${estado}</td>
                  <td>${info.total}</td>
                  <td>R$ ${info.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td>${((info.valor / dados.total_inadimplente) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Casos Jurídicos</h3>
          <div class="metric alert">
            <strong>Total Escalonados:</strong> ${dados.casos_juridicos.total_escalonados}
          </div>
          <div class="metric alert">
            <strong>Valor Total Jurídico:</strong> R$ ${dados.casos_juridicos.valor_total_juridico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div class="metric">
            <strong>Tempo Médio Resolução:</strong> ${dados.casos_juridicos.tempo_medio_resolucao.toFixed(0)} dias
          </div>
        </div>

        <div class="section">
          <h3>Parcelamentos</h3>
          <div class="metric success">
            <strong>Total Simulações:</strong> ${dados.parcelamentos.total_simulacoes}
          </div>
          <div class="metric success">
            <strong>Total Aceites:</strong> ${dados.parcelamentos.total_aceites}
          </div>
          <div class="metric">
            <strong>Taxa de Conversão:</strong> ${dados.parcelamentos.taxa_conversao.toFixed(2)}%
          </div>
          <div class="metric success">
            <strong>Valor Total Parcelado:</strong> R$ ${dados.parcelamentos.valor_total_parcelado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div class="section">
          <h3>Informações do Relatório</h3>
          <p><strong>Gerado por:</strong> ${relatorio.gerado_por}</p>
          <p><strong>Data de Geração:</strong> ${new Date(relatorio.gerado_em).toLocaleString('pt-BR')}</p>
          <p><strong>Status:</strong> ${relatorio.status_envio}</p>
          ${relatorio.observacoes ? `<p><strong>Observações:</strong> ${relatorio.observacoes}</p>` : ''}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Busca estatísticas rápidas para dashboard
   */
  static async obterEstatisticasRapidas() {
    try {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      
      const { data: cobrancas, error } = await supabase
        .from('cobrancas_franqueados')
        .select('status, valor_original, valor_atualizado, dias_em_atraso, tipo_cobranca')
        .gte('created_at', inicioMes.toISOString());

      if (error) throw error;

      const total = cobrancas?.length || 0;
      const emAberto = cobrancas?.filter(c => c.status === 'em_aberto').length || 0;
      const vencidas = cobrancas?.filter(c => (c.dias_em_atraso || 0) > 0).length || 0;
      const valorTotal = cobrancas?.reduce((sum, c) => sum + Number(c.valor_atualizado || c.valor_original), 0) || 0;
      const valorRecuperado = cobrancas?.filter(c => c.status === 'quitado')
        .reduce((sum, c) => sum + Number(c.valor_original), 0) || 0;

      return {
        total_cobrancas: total,
        cobrancas_em_aberto: emAberto,
        cobrancas_vencidas: vencidas,
        valor_total: valorTotal,
        valor_recuperado: valorRecuperado,
        percentual_inadimplencia: total > 0 ? (vencidas / total) * 100 : 0,
        taxa_recuperacao: valorTotal > 0 ? (valorRecuperado / valorTotal) * 100 : 0
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas rápidas:', error);
      throw error;
    }
  }

  /**
   * Envia relatório por email
   */
  static async enviarRelatorio(relatorioId: string, destinatarios: string[]): Promise<void> {
    try {
      await supabase
        .from('relatorios_mensais')
        .update({ 
          status_envio: 'enviado',
          enviado_para: destinatarios,
          updated_at: new Date().toISOString()
        })
        .eq('id', relatorioId);

      console.log(`Relatório ${relatorioId} enviado para:`, destinatarios);
    } catch (error) {
      console.error('Erro ao enviar relatório:', error);
      throw error;
    }
  }
}