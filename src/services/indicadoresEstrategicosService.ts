import { supabase } from './databaseService';
import type { 
  IndicadorEstrategico, 
  DashboardEstrategico, 
  FiltroIndicadores,
  SugestaoAutomatica,
  AlertaEstrategico
} from '../types/indicadoresEstrategicos';

class IndicadoresEstrategicosService {
  async obterDashboardEstrategico(filtros?: FiltroIndicadores): Promise<DashboardEstrategico> {
    try {
      // Construir query base
      let query = supabase
        .from('cobrancas_franqueados')
        .select(`
          *,
          unidades_franqueadas!inner(*)
        `);

      // Aplicar filtros
      if (filtros?.dataInicio) {
        query = query.gte('data_vencimento', filtros.dataInicio);
      }
      if (filtros?.dataFim) {
        query = query.lte('data_vencimento', filtros.dataFim);
      }
      if (filtros?.regiao) {
        query = query.eq('unidades_franqueadas.estado', filtros.regiao);
      }
      if (filtros?.tipoCobranca) {
        query = query.eq('tipo_cobranca', filtros.tipoCobranca);
      }

      const { data: cobrancas, error } = await query;

      if (error) throw error;

      // Calcular indicadores
      const totalDevido = cobrancas?.reduce((sum, c) => sum + Number(c.valor_original), 0) || 0;
      const totalInadimplente = cobrancas?.filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + Number(c.valor_atualizado || c.valor_original), 0) || 0;

      const percentualInadimplencia = totalDevido > 0 ? (totalInadimplente / totalDevido) * 100 : 0;

      // Obter dados de acordos
      const { data: acordos } = await supabase
        .from('acordos_parcelamento')
        .select('*');

      const valorTotalAcordos = acordos?.reduce((sum, a) => sum + Number(a.valor_total_acordo), 0) || 0;
      const valorRecebidoAcordos = acordos?.filter(a => a.status_acordo === 'cumprido')
        .reduce((sum, a) => sum + Number(a.valor_total_acordo), 0) || 0;

      const taxaRecuperacaoAcordos = valorTotalAcordos > 0 ? (valorRecebidoAcordos / valorTotalAcordos) * 100 : 0;

      // Unidades com risco crítico
      const unidadesCriticas = await this.obterUnidadesCriticas();

      // Previsão de receita
      const previsaoReceita = await this.calcularPrevisaoReceita();

      // Evolução mensal
      const evolucaoMensal = await this.obterEvolucaoMensal();

      return {
        percentualInadimplencia,
        valorTotalInadimplente: totalInadimplente,
        evolucaoMensal,
        taxaRecuperacaoAcordos,
        taxaReincidencia: await this.calcularTaxaReincidencia(),
        unidadesCriticas: unidadesCriticas.length,
        previsaoReceitaMes: previsaoReceita,
        unidadesRegularizadas: await this.obterUnidadesRegularizadas(),
        sugestoesAutomaticas: await this.gerarSugestoesAutomaticas(),
        alertasEstrategicos: await this.gerarAlertasEstrategicos()
      };
    } catch (error) {
      console.error('Erro ao obter dashboard estratégico:', error);
      throw error;
    }
  }

  async obterIndicadoresPorPeriodo(
    dataInicio: string, 
    dataFim: string
  ): Promise<IndicadorEstrategico[]> {
    try {
      const { data, error } = await supabase
        .from('cobrancas_franqueados')
        .select(`
          *,
          unidades_franqueadas!inner(*)
        `)
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim);

      if (error) throw error;

      // Processar dados por mês
      const indicadoresPorMes = new Map<string, IndicadorEstrategico>();

      data?.forEach(cobranca => {
        const mes = new Date(cobranca.data_vencimento).toISOString().substring(0, 7);
        
        if (!indicadoresPorMes.has(mes)) {
          indicadoresPorMes.set(mes, {
            periodo: mes,
            valorTotal: 0,
            valorInadimplente: 0,
            percentualInadimplencia: 0,
            quantidadeUnidades: new Set(),
            quantidadeCobrancas: 0
          });
        }

        const indicador = indicadoresPorMes.get(mes)!;
        indicador.valorTotal += Number(cobranca.valor_original);
        indicador.quantidadeCobrancas++;
        indicador.quantidadeUnidades.add(cobranca.cnpj);

        if (cobranca.status === 'em_aberto') {
          indicador.valorInadimplente += Number(cobranca.valor_atualizado || cobranca.valor_original);
        }
      });

      // Calcular percentuais
      const indicadores = Array.from(indicadoresPorMes.values()).map(indicador => ({
        ...indicador,
        percentualInadimplencia: indicador.valorTotal > 0 
          ? (indicador.valorInadimplente / indicador.valorTotal) * 100 
          : 0,
        quantidadeUnidades: indicador.quantidadeUnidades.size
      }));

      return indicadores.sort((a, b) => a.periodo.localeCompare(b.periodo));
    } catch (error) {
      console.error('Erro ao obter indicadores por período:', error);
      throw error;
    }
  }

  private async obterUnidadesCriticas(): Promise<any[]> {
    const { data, error } = await supabase
      .from('cobrancas_franqueados')
      .select(`
        cnpj,
        unidades_franqueadas!inner(nome_franqueado)
      `)
      .eq('status', 'em_aberto')
      .gte('dias_em_atraso', 30);

    if (error) throw error;

    // Agrupar por CNPJ e contar cobranças
    const unidadesMap = new Map();
    data?.forEach(cobranca => {
      const cnpj = cobranca.cnpj;
      if (!unidadesMap.has(cnpj)) {
        unidadesMap.set(cnpj, {
          cnpj,
          nome: cobranca.unidades_franqueadas?.nome_franqueado,
          quantidadeCobrancas: 0
        });
      }
      unidadesMap.get(cnpj).quantidadeCobrancas++;
    });

    // Filtrar unidades com 3+ cobranças
    return Array.from(unidadesMap.values())
      .filter(unidade => unidade.quantidadeCobrancas >= 3);
  }

  private async calcularPrevisaoReceita(): Promise<number> {
    const proximoMes = new Date();
    proximoMes.setMonth(proximoMes.getMonth() + 1);
    const mesString = proximoMes.toISOString().substring(0, 7);

    const { data, error } = await supabase
      .from('parcelas_acordo')
      .select('valor_parcela')
      .eq('status_parcela', 'pendente')
      .like('data_vencimento', `${mesString}%`);

    if (error) throw error;

    return data?.reduce((sum, parcela) => sum + Number(parcela.valor_parcela), 0) || 0;
  }

  private async obterEvolucaoMensal(): Promise<Array<{ mes: string; valor: number }>> {
    const { data, error } = await supabase
      .from('cobrancas_franqueados')
      .select('data_vencimento, valor_atualizado, valor_original, status')
      .gte('data_vencimento', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    const evolucaoMap = new Map<string, number>();

    data?.forEach(cobranca => {
      if (cobranca.status === 'em_aberto') {
        const mes = new Date(cobranca.data_vencimento).toISOString().substring(0, 7);
        const valor = Number(cobranca.valor_atualizado || cobranca.valor_original);
        evolucaoMap.set(mes, (evolucaoMap.get(mes) || 0) + valor);
      }
    });

    return Array.from(evolucaoMap.entries())
      .map(([mes, valor]) => ({ mes, valor }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }

  private async calcularTaxaReincidencia(): Promise<number> {
    // Lógica para calcular taxa de reincidência
    // Unidades que regularizaram e voltaram a atrasar
    return 15.5; // Placeholder
  }

  private async obterUnidadesRegularizadas(): Promise<string[]> {
    const { data, error } = await supabase
      .from('cobrancas_franqueados')
      .select('cnpj, unidades_franqueadas!inner(nome_franqueado)')
      .eq('status', 'quitado')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    const unidadesRegularizadas = new Set();
    data?.forEach(cobranca => {
      unidadesRegularizadas.add(cobranca.unidades_franqueadas?.nome_franqueado);
    });

    return Array.from(unidadesRegularizadas) as string[];
  }

  private async gerarSugestoesAutomaticas(): Promise<SugestaoAutomatica[]> {
    const sugestoes: SugestaoAutomatica[] = [];

    // Sugestão baseada em queda de recuperação
    const { data: unidadesComQueda } = await supabase
      .from('score_risco_unidades')
      .select('cnpj_unidade, score_atual')
      .lt('score_atual', 30);

    unidadesComQueda?.forEach(unidade => {
      sugestoes.push({
        tipo: 'acao_recomendada',
        titulo: 'Unidade com baixo score',
        descricao: `Unidade ${unidade.cnpj_unidade} com score ${unidade.score_atual} - sugerir nova negociação`,
        prioridade: 'alta',
        unidadeAfetada: unidade.cnpj_unidade
      });
    });

    return sugestoes;
  }

  private async gerarAlertasEstrategicos(): Promise<AlertaEstrategico[]> {
    const alertas: AlertaEstrategico[] = [];

    // Alerta de reincidência
    const { data: reincidentes } = await supabase
      .from('cobrancas_franqueados')
      .select('cnpj')
      .eq('status', 'em_aberto')
      .gte('dias_em_atraso', 15);

    if (reincidentes && reincidentes.length > 5) {
      alertas.push({
        tipo: 'reincidencia',
        titulo: 'Alto número de reincidentes',
        descricao: `${reincidentes.length} unidades com atraso superior a 15 dias`,
        nivel: 'critico',
        dataDeteccao: new Date().toISOString(),
        unidadesAfetadas: reincidentes.map(r => r.cnpj)
      });
    }

    return alertas;
  }

  async exportarRelatorioEstrategico(
    filtros: FiltroIndicadores,
    formato: 'pdf' | 'xlsx'
  ): Promise<string> {
    try {
      const dashboard = await this.obterDashboardEstrategico(filtros);
      
      // Aqui seria implementada a lógica de geração do arquivo
      // Por enquanto, retornamos uma URL simulada
      const timestamp = new Date().getTime();
      return `relatorio-estrategico-${timestamp}.${formato}`;
    } catch (error) {
      console.error('Erro ao exportar relatório estratégico:', error);
      throw error;
    }
  }
}

export const indicadoresEstrategicosService = new IndicadoresEstrategicosService();

export { IndicadoresEstrategicosService }