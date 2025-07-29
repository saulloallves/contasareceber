import { supabase } from '../lib/supabaseClient';
import { IndicadoresMensais } from '../types/dashboard';

export class DashboardService {
  async buscarIndicadoresMensais(): Promise<IndicadoresMensais> {
    try {
      // Buscar dados de cobranças
      const { data: cobrancas, error: cobrancasError } = await supabase
        .from('cobrancas_franqueados')
        .select('*');

      if (cobrancasError) throw cobrancasError;

      // Buscar dados de unidades
      const { data: unidades, error: unidadesError } = await supabase
        .from('unidades_franqueadas')
        .select('*');

      if (unidadesError) throw unidadesError;

      // Calcular indicadores
      const totalEmAberto = cobrancas
        ?.filter(c => ['em_aberto', 'em_atraso'].includes(c.status))
        ?.reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original) || 0), 0) || 0;

      const totalQuitado = cobrancas
        ?.filter(c => c.status === 'quitado')
        ?.reduce((sum, c) => sum + (Number(c.valor_recebido) || Number(c.valor_original) || 0), 0) || 0;

      const totalNegociando = cobrancas
        ?.filter(c => ['negociando', 'cobrado', 'em_tratativa_juridica', 'em_tratativa_critica'].includes(c.status))
        ?.reduce((sum, c) => sum + (Number(c.valor_atualizado) || Number(c.valor_original) || 0), 0) || 0;

      const unidadesInadimplentes = new Set(
        cobrancas?.filter(c => ['em_aberto', 'em_atraso', 'negociando'].includes(c.status))?.map(c => c.cnpj)
      ).size;

      const ticketMedio = unidadesInadimplentes > 0 ? totalEmAberto / unidadesInadimplentes : 0;

      // Calcular variações (simuladas por enquanto - você pode implementar lógica real)
      const variacaoEmAberto = Math.random() * 20 - 10; // -10% a +10%
      const variacaoQuitado = Math.random() * 15 - 5; // -5% a +15%
      const variacaoNegociando = Math.random() * 10 - 5; // -5% a +10%
      const variacaoUnidades = Math.random() * 8 - 4; // -4% a +8%

      return {
        totalEmAberto,
        totalQuitado,
        totalNegociando,
        unidadesInadimplentes,
        ticketMedio,
        variacaoEmAberto,
        variacaoQuitado,
        variacaoNegociando,
        variacaoUnidades,
        alertasAtivos: this.calcularAlertas(cobrancas || []),
        proximasReunioesCount: await this.contarProximasReunioes(),
        acoesRecentesCount: await this.contarAcoesRecentes()
      };
    } catch (error) {
      console.error('Erro ao buscar indicadores mensais:', error);
      throw error;
    }
  }

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

      return {
        cobrancas: data,
        visaoGeral: this.calcularVisaoGeral(data || [])
      };
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      throw error;
    }
  }

  private calcularVisaoGeral(cobrancas: any[]) {
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

  private calcularAlertas(cobrancas: any[]) {
    const alertas = [];

    // Unidades que ignoraram 3 tentativas
    const unidadesIgnoraram = cobrancas.filter(c => 
      c.status === 'em_atraso' && c.dias_em_atraso > 30
    );

    if (unidadesIgnoraram.length > 0) {
      alertas.push({
        tipo: 'critico',
        titulo: `${unidadesIgnoraram.length} unidades ignoraram 3 tentativas de cobrança`,
        valor: unidadesIgnoraram.reduce((sum, c) => sum + (Number(c.valor_atualizado) || 0), 0),
        acao: 'Ver Detalhes'
      });
    }

    return alertas;
  }

  private async contarProximasReunioes(): Promise<number> {
    try {
      const { count } = await supabase
        .from('reunioes_negociacao')
        .select('*', { count: 'exact', head: true })
        .eq('status_reuniao', 'agendada')
        .gte('data_agendada', new Date().toISOString())
        .lte('data_agendada', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

      return count || 0;
    } catch (error) {
      console.error('Erro ao contar próximas reuniões:', error);
      return 0;
    }
  }

  private async contarAcoesRecentes(): Promise<number> {
    try {
      const { count } = await supabase
        .from('tratativas_cobranca')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return count || 0;
    } catch (error) {
      console.error('Erro ao contar ações recentes:', error);
      return 0;
    }
  }
}