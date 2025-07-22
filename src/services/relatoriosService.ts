import { supabase } from './databaseService';
import { RelatorioMensal, DadosConsolidados, FiltroRelatorio } from '../types/relatorios';

export class RelatoriosService {
  // Gerar relatório mensal consolidado
  static async gerarRelatorioMensal(referenciaMes: string): Promise<RelatorioMensal> {
    try {
      const dadosConsolidados = await this.obterDadosConsolidados(referenciaMes);
      
      const relatorio: RelatorioMensal = {
        id: crypto.randomUUID(),
        referencia_mes: referenciaMes,
        dados_consolidados: dadosConsolidados,
        gerado_em: new Date().toISOString(),
        gerado_por: 'sistema',
        status_envio: 'gerado',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

  // Obter dados consolidados para o relatório
  static async obterDadosConsolidados(referenciaMes: string): Promise<DadosConsolidados> {
    try {
      // Calcular período do mês
      const [ano, mes] = referenciaMes.split('-');
      const inicioMes = new Date(parseInt(ano), parseInt(mes) - 1, 1);
      const fimMes = new Date(parseInt(ano), parseInt(mes), 0);

      // Buscar cobranças do período
      const { data: cobrancas, error: cobrancasError } = await supabase
        .from('cobrancas_franqueados')
        .select(`
          *,
          unidades_franqueadas!inner(nome_franqueado, estado, cidade)
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

      // Calcular métricas
      const totalCobrancas = cobrancas?.length || 0;
      const valorTotalEmAberto = cobrancas?.reduce((sum, c) => sum + Number(c.valor_atualizado || c.valor_original), 0) || 0;
      const cobrancasVencidas = cobrancas?.filter(c => c.status === 'em_aberto' && c.dias_em_atraso > 0) || [];
      const valorVencido = cobrancasVencidas.reduce((sum, c) => sum + Number(c.valor_atualizado || c.valor_original), 0);
      
      const totalAcordos = acordos?.length || 0;
      const valorTotalAcordos = acordos?.reduce((sum, a) => sum + Number(a.valor_total_acordo), 0) || 0;
      const acordosAtivos = acordos?.filter(a => ['aceito', 'cumprindo'].includes(a.status_acordo)) || [];

      // Agrupar por estado
      const porEstado = cobrancas?.reduce((acc, cobranca) => {
        const estado = cobranca.unidades_franqueadas?.estado || 'N/A';
        if (!acc[estado]) {
          acc[estado] = { total: 0, valor: 0 };
        }
        acc[estado].total += 1;
        acc[estado].valor += Number(cobranca.valor_atualizado || cobranca.valor_original);
        return acc;
      }, {} as Record<string, { total: number; valor: number }>) || {};

      return {
        total_cobrancas: totalCobrancas,
        valor_total_em_aberto: valorTotalEmAberto,
        cobrancas_vencidas: cobrancasVencidas.length,
        valor_vencido: valorVencido,
        percentual_inadimplencia: totalCobrancas > 0 ? (cobrancasVencidas.length / totalCobrancas) * 100 : 0,
        total_acordos: totalAcordos,
        valor_total_acordos: valorTotalAcordos,
        acordos_ativos: acordosAtivos.length,
        taxa_cumprimento_acordos: totalAcordos > 0 ? (acordosAtivos.length / totalAcordos) * 100 : 0,
        distribuicao_por_estado: porEstado,
        unidades_criticas: cobrancasVencidas.length,
        valor_recuperado: 0, // Calcular com base em pagamentos
        projecao_proximos_30_dias: valorTotalAcordos * 0.3 // Estimativa
      };
    } catch (error) {
      console.error('Erro ao obter dados consolidados:', error);
      throw error;
    }
  }

  // Listar relatórios mensais
  static async listarRelatorios(filtros?: FiltroRelatorio) {
    try {
      let query = supabase
        .from('relatorios_mensais')
        .select('*')
        .order('gerado_em', { ascending: false });

      if (filtros?.dataInicio) {
        query = query.gte('gerado_em', filtros.dataInicio);
      }

      if (filtros?.dataFim) {
        query = query.lte('gerado_em', filtros.dataFim);
      }

      if (filtros?.status) {
        query = query.eq('status_envio', filtros.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao listar relatórios:', error);
      throw error;
    }
  }

  // Exportar relatório para PDF
  static async exportarPDF(relatorioId: string): Promise<string> {
    try {
      const { data: relatorio, error } = await supabase
        .from('relatorios_mensais')
        .select('*')
        .eq('id', relatorioId)
        .single();

      if (error) throw error;

      // Gerar HTML do relatório
      const htmlContent = this.gerarHTMLRelatorio(relatorio);
      
      // Aqui você integraria com uma biblioteca de PDF como jsPDF ou Puppeteer
      // Por enquanto, retornamos uma URL simulada
      const pdfUrl = `data:text/html;base64,${btoa(htmlContent)}`;
      
      // Atualizar URL do PDF no banco
      await supabase
        .from('relatorios_mensais')
        .update({ url_pdf: pdfUrl })
        .eq('id', relatorioId);

      return pdfUrl;
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      throw error;
    }
  }

  // Gerar HTML do relatório
  private static gerarHTMLRelatorio(relatorio: RelatorioMensal): string {
    const dados = relatorio.dados_consolidados;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório Mensal - ${relatorio.referencia_mes}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .metric { margin: 10px 0; padding: 10px; border-left: 4px solid #3b82f6; }
          .section { margin: 20px 0; }
          .table { width: 100%; border-collapse: collapse; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .table th { background-color: #f2f2f2; }
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
          <div class="metric">
            <strong>Total de Cobranças:</strong> ${dados.total_cobrancas}
          </div>
          <div class="metric">
            <strong>Valor Total em Aberto:</strong> R$ ${dados.valor_total_em_aberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div class="metric">
            <strong>Percentual de Inadimplência:</strong> ${dados.percentual_inadimplencia.toFixed(2)}%
          </div>
          <div class="metric">
            <strong>Total de Acordos:</strong> ${dados.total_acordos}
          </div>
          <div class="metric">
            <strong>Taxa de Cumprimento de Acordos:</strong> ${dados.taxa_cumprimento_acordos.toFixed(2)}%
          </div>
        </div>

        <div class="section">
          <h3>Distribuição por Estado</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Quantidade</th>
                <th>Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(dados.distribuicao_por_estado).map(([estado, info]) => `
                <tr>
                  <td>${estado}</td>
                  <td>${info.total}</td>
                  <td>R$ ${info.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  // Enviar relatório por email
  static async enviarRelatorio(relatorioId: string, destinatarios: string[]): Promise<void> {
    try {
      // Aqui você integraria com um serviço de email
      // Por enquanto, apenas atualizamos o status
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

  // Obter estatísticas rápidas
  static async obterEstatisticasRapidas() {
    try {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      
      const { data: cobrancas, error } = await supabase
        .from('cobrancas_franqueados')
        .select('status, valor_original, valor_atualizado, dias_em_atraso')
        .gte('created_at', inicioMes.toISOString());

      if (error) throw error;

      const total = cobrancas?.length || 0;
      const emAberto = cobrancas?.filter(c => c.status === 'em_aberto').length || 0;
      const vencidas = cobrancas?.filter(c => c.dias_em_atraso > 0).length || 0;
      const valorTotal = cobrancas?.reduce((sum, c) => sum + Number(c.valor_atualizado || c.valor_original), 0) || 0;

      return {
        total_cobrancas: total,
        cobrancas_em_aberto: emAberto,
        cobrancas_vencidas: vencidas,
        valor_total: valorTotal,
        percentual_inadimplencia: total > 0 ? (vencidas / total) * 100 : 0
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas rápidas:', error);
      throw error;
    }
  }
}