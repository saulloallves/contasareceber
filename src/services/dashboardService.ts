import { supabase } from './databaseService';
import { IndicadoresMensais, UnidadeRisco, AlertaAutomatico, DashboardData } from '../types/dashboard';

type Cobranca = {
  status: string;
  valor_atualizado?: number | null;
  valor_original?: number | null;
  valor_recebido?: number | null;
  cnpj?: string | null;
  dias_em_atraso?: number | null;
  data_vencimento?: string | null;
  data_ultima_atualizacao?: string | null;
  created_at?: string | null;
};

export class DashboardService {
  async buscarIndicadoresMensais(): Promise<IndicadoresMensais> {
    try {
      // Buscar dados de cobranças
      const { data: cobrancas, error: cobrancasError } = await supabase
        .from('cobrancas_franqueados')
        .select('*');

      if (cobrancasError) throw cobrancasError;

      // Calcular indicadores
      const abertas = (cobrancas as Cobranca[] | null)
        ?.filter(c => !['quitado', 'perda'].includes(c.status)) || [];

      const totalEmAbertoOriginal = (cobrancas as Cobranca[] | null)
        ?.filter(c => !['quitado', 'perda'].includes(c.status))
        .reduce((sum, c) => sum + (Number(c.valor_original) || 0), 0);

      const totalEmAbertoAtualizado = (cobrancas as Cobranca[] | null)
        ?.filter(c => !['quitado', 'perda'].includes(c.status))
        .reduce((sum, c) => sum + (Number(c.valor_atualizado ?? c.valor_original) || 0), 0);

      // Mantém campo legado (totalEmAberto) como ATUALIZADO para compatibilidade visual anterior
      const totalEmAberto = totalEmAbertoAtualizado;

      const totalQuitado = (cobrancas as Cobranca[] | null)
        ?.filter(c => c.status === 'quitado')
        ?.reduce((sum, c) => sum + (Number(c.valor_recebido) || Number(c.valor_original) || 0), 0) || 0;

      const totalNegociando = (cobrancas as Cobranca[] | null)
        ?.filter(c => ['negociando', 'cobrado', 'em_tratativa_juridica', 'em_tratativa_critica', 'em_negociacao'].includes(c.status))
        ?.reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original) || 0), 0) || 0;

      const unidadesInadimplentes = new Set(
        (cobrancas as Cobranca[] | null)?.filter(c => !['quitado', 'perda'].includes(c.status))?.map(c => c.cnpj || '')
      ).size;

      const ticketMedio = unidadesInadimplentes > 0 ? totalEmAberto / unidadesInadimplentes : 0;

      const totalBase = totalEmAberto + totalQuitado + totalNegociando;
      const percentualInadimplencia = totalBase > 0 ? (totalEmAberto / totalBase) * 100 : 0;
      const percentualRecuperacao = totalBase > 0 ? (totalQuitado / totalBase) * 100 : 0;

      // ===== Cálculo real de variações mês a mês =====
      // Definição de mês por data_vencimento; para quitados usamos data_ultima_atualizacao ou created_at como aproximação.
      const now = new Date();
      const currStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const parseDate = (s?: string | null) => {
        if (!s) return null;
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      };

      const inRange = (d: Date | null, start: Date, end: Date) => {
        if (!d) return false;
        return d >= start && d < end;
      };

      const OPEN_STATUSES = ['em_aberto', 'em_atraso', 'negociando', 'cobrado', 'em_tratativa_juridica', 'em_tratativa_critica'];
      const NEGOTIATING_STATUSES = ['negociando', 'cobrado', 'em_tratativa_juridica', 'em_tratativa_critica'];

      const currByVenc = (cobrancas as Cobranca[] | null)?.filter(c => inRange(parseDate(c.data_vencimento || null), currStart, nextStart)) || [];
      const prevByVenc = (cobrancas as Cobranca[] | null)?.filter(c => inRange(parseDate(c.data_vencimento || null), prevStart, currStart)) || [];

      const sum = (arr: Cobranca[], pick: (c: Cobranca) => number) => arr.reduce((acc, c) => acc + pick(c), 0);

      // Em aberto (atualizado) por mês de vencimento
      const currEmAberto = sum(currByVenc.filter(c => OPEN_STATUSES.includes(c.status)), c => Number(c.valor_atualizado ?? c.valor_original) || 0);
      const prevEmAberto = sum(prevByVenc.filter(c => OPEN_STATUSES.includes(c.status)), c => Number(c.valor_atualizado ?? c.valor_original) || 0);

      // Quitado por "data da quitação" aproximada (data_ultima_atualizacao || created_at)
      const getQuitDate = (c: Cobranca) => parseDate(c.data_ultima_atualizacao || c.created_at || null);
      const currQuitados = (cobrancas as Cobranca[] | null)?.filter(c => c.status === 'quitado' && inRange(getQuitDate(c), currStart, nextStart)) || [];
      const prevQuitados = (cobrancas as Cobranca[] | null)?.filter(c => c.status === 'quitado' && inRange(getQuitDate(c), prevStart, currStart)) || [];
      const currQuitadoVal = sum(currQuitados, c => Number(c.valor_recebido) || Number(c.valor_original) || 0);
      const prevQuitadoVal = sum(prevQuitados, c => Number(c.valor_recebido) || Number(c.valor_original) || 0);

      // Negociando por mês de vencimento
      const currNegociando = sum(currByVenc.filter(c => NEGOTIATING_STATUSES.includes(c.status)), c => Number(c.valor_atualizado) || Number(c.valor_original) || 0);
      const prevNegociando = sum(prevByVenc.filter(c => NEGOTIATING_STATUSES.includes(c.status)), c => Number(c.valor_atualizado) || Number(c.valor_original) || 0);

      // Unidades inadimplentes por mês (distintas por CNPJ) usando mês de vencimento para status em aberto
      const currUnidades = new Set(currByVenc.filter(c => OPEN_STATUSES.includes(c.status)).map(c => c.cnpj || '')).size;
      const prevUnidades = new Set(prevByVenc.filter(c => OPEN_STATUSES.includes(c.status)).map(c => c.cnpj || '')).size;

      const pctChange = (curr: number, prev: number) => {
        if (!prev && !curr) return 0;
        if (!prev && curr > 0) return 100; // crescimento a partir de zero
        if (prev === 0 && curr > 0) return 100; // crescimento a partir de zero
        if (prev > 0) return ((curr - prev) / prev) * 100;
        return 0;
      };

      const variacaoEmAberto = pctChange(currEmAberto, prevEmAberto);
      const variacaoQuitado = pctChange(currQuitadoVal, prevQuitadoVal);
      const variacaoNegociando = pctChange(currNegociando, prevNegociando);
      const variacaoUnidades = pctChange(currUnidades, prevUnidades);

      console.log('Debug variação negociando:', {
        currNegociando,
        prevNegociando,
        variacaoNegociando,
        totalNegociando
      });

      return {
        total_em_aberto_mes: totalEmAberto,
        total_em_aberto_original_mes: totalEmAbertoOriginal,
        total_em_aberto_atualizado_mes: totalEmAbertoAtualizado,
        total_pago_mes: totalQuitado,
        total_negociando_mes: totalNegociando,
        percentual_inadimplencia: percentualInadimplencia,
        unidades_inadimplentes: unidadesInadimplentes,
        ticket_medio_dividas: ticketMedio,
  percentual_recuperacao: percentualRecuperacao,
  variacao_unidades: variacaoUnidades,
        comparativo_mes_anterior: {
          variacao_em_aberto: variacaoEmAberto,
          variacao_pago: variacaoQuitado,
          variacao_negociando: variacaoNegociando
        }
      };
    } catch (error) {
      console.error('Erro ao buscar indicadores mensais:', error);
      throw error;
    }
  }

  // Stubs seguros para compatibilidade com o componente Dashboard
  async buscarUnidadesRisco(_limite: number): Promise<UnidadeRisco[]> {
    void _limite;
    // TODO: implementar busca real; por ora retorna vazio para não quebrar UI
    return [];
  }

  async buscarAlertasAutomaticos(): Promise<AlertaAutomatico[]> {
    // TODO: implementar busca real; por ora retorna vazio para não quebrar UI
    return [];
  }

  async exportarParaExcel(dados: DashboardData): Promise<Blob> {
    // Gera um CSV simples com alguns campos principais
    const linhas: string[] = [];
    linhas.push('Metricas,Valor');
    linhas.push(`Total Em Aberto,${dados.visaoGeral.totalEmAberto}`);
    linhas.push(`Total Quitado,${dados.visaoGeral.totalQuitado}`);
    linhas.push(`Total Negociando,${dados.visaoGeral.totalNegociando}`);
    const conteudo = linhas.join('\n');
    return new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  }

  async gerarAlertasAutomaticos(): Promise<number> {
    // TODO: implementar geração real; por ora retorna 0
    return 0;
  }

  async resolverAlerta(_alertaId: string, _observacoes?: string): Promise<void> {
    void _alertaId; void _observacoes;
    // TODO: implementar resolução real; por ora é no-op
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async buscarDadosDashboard(filtros: any) {
    try {
      let query = supabase
        .from('cobrancas_franqueados')
        .select('*');

      // Aplicar filtros
      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }

      if (filtros.tipo) {
        query = query.eq('tipo_cobranca', filtros.tipo);
      }

      // Filtro de período
      if (filtros.periodo) {
        const diasAtras = parseInt(filtros.periodo);
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - diasAtras);
        query = query.gte('created_at', dataLimite.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const result = {
        cobrancas: data,
  visaoGeral: this.calcularVisaoGeral((data || []) as Cobranca[])
      };
      // Completa campos mínimos esperados pelo componente com estruturas vazias
      const dashboardData = {
        ...result,
        rankingInadimplentes: [],
        evolucaoMensal: [],
        eficienciaCobrancas: {
          totalMensagens: 0,
          totalAgendamentos: 0,
          conversaoAgendamento: 0,
          tempoMedioResolucao: 0,
          taxaConversao: 0
        }
      } as unknown as DashboardData;
      return dashboardData;
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      throw error;
    }
  }

  private calcularVisaoGeral(cobrancas: Cobranca[]) {
    return {
      totalEmAberto: cobrancas
        .filter(c => ['em_aberto', 'em_atraso'].includes(c.status))
        .reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original) || 0), 0),
      
      totalQuitado: cobrancas
        .filter(c => c.status === 'quitado')
        .reduce((sum, c) => sum + (Number(c.valor_recebido) || Number(c.valor_original) || 0), 0),
      
      totalNegociando: cobrancas
        .filter(c => ['negociando', 'cobrado', 'em_tratativa_juridica', 'em_tratativa_critica'].includes(c.status))
        .reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original) || 0), 0)
    };
  }

  // Métodos auxiliares removidos (não utilizados na versão atual)
}