import { supabase } from './databaseService';
import { EscalonamentoCobranca, CriterioEscalonamento, FiltrosEscalonamento, EstatisticasEscalonamento, PontuacaoRisco, EventoRisco, ConfiguracaoRisco, AlertaAtivo, MonitoramentoRisco, GatilhoAutomatico, AcaoPendente, RegistroGatilho, DashboardRiscos } from '../types/escalonamento';
import { TrativativasService } from './tratativasService';

export class EscalonamentoService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Monitora sinais de risco em tempo real
   */
  async monitorarSinaisRisco(): Promise<MonitoramentoRisco[]> {
    try {
      const config = await this.buscarConfiguracaoRisco();
      const unidadesRisco: MonitoramentoRisco[] = [];

      // Busca unidades com cobranças ativas
      const { data: unidades } = await supabase
        .from('unidades_franqueadas')
        .select(`
          codigo_unidade,
          nome_franqueado,
          cobrancas_franqueados (
            valor_original,
            valor_atualizado,
            status,
            dias_em_atraso,
            created_at
          )
        `)
        .eq('status_unidade', 'ativa');

      if (!unidades) return [];

      for (const unidade of unidades) {
        const cobrancas = (unidade as any).cobrancas_franqueados || [];
        const cobrancasAbertas = cobrancas.filter((c: any) => c.status === 'em_aberto');
        
        if (cobrancasAbertas.length === 0) continue;

        const sinaisDetectados = [];
        let grauRisco: 'baixo' | 'medio' | 'alto' | 'critico' = 'baixo';
        let pontuacaoRisco = 0;

        // 1. Múltiplas cobranças nos últimos 90 dias
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 90);
        const cobrancasRecentes = cobrancas.filter((c: any) => 
          new Date(c.created_at) >= dataLimite
        );

        if (cobrancasRecentes.length >= 2) {
          sinaisDetectados.push(`${cobrancasRecentes.length} cobranças nos últimos 90 dias`);
          pontuacaoRisco += 2;
        }

        // 2. Valores altos em aberto há mais de 30 dias
        const cobrancasAltas = cobrancasAbertas.filter((c: any) => 
          (c.valor_atualizado || c.valor_original) >= 2000 && 
          c.dias_em_atraso > 30
        );

        if (cobrancasAltas.length > 0) {
          const valorTotal = cobrancasAltas.reduce((sum: number, c: any) => 
            sum + (c.valor_atualizado || c.valor_original), 0
          );
          sinaisDetectados.push(`R$ ${valorTotal.toFixed(2)} em aberto há 30+ dias`);
          pontuacaoRisco += 3;
        }

        // 3. Verificar acordos vencidos
        const acordosVencidos = await this.verificarAcordosVencidos(unidade.codigo_unidade);
        if (acordosVencidos > 0) {
          sinaisDetectados.push(`${acordosVencidos} acordo(s) vencido(s)`);
          pontuacaoRisco += 4;
        }

        // 4. Verificar ausência de resposta
        const diasSemResposta = await this.verificarAusenciaResposta(unidade.codigo_unidade);
        if (diasSemResposta > 7) {
          sinaisDetectados.push(`${diasSemResposta} dias sem resposta`);
          pontuacaoRisco += 2;
        }

        // 5. Verificar reincidência
        const reincidencia = await this.verificarReincidencia(unidade.codigo_unidade);
        if (reincidencia) {
          sinaisDetectados.push('Histórico de reincidência');
          pontuacaoRisco += 3;
        }

        // Determinar grau de risco
        if (pontuacaoRisco >= 8) grauRisco = 'critico';
        else if (pontuacaoRisco >= 5) grauRisco = 'alto';
        else if (pontuacaoRisco >= 3) grauRisco = 'medio';

        if (sinaisDetectados.length > 0) {
          const valorEmRisco = cobrancasAbertas.reduce((sum: number, c: any) => 
            sum + (c.valor_atualizado || c.valor_original), 0
          );

          const ultimaAcao = await this.buscarUltimaAcao(unidade.codigo_unidade);

          unidadesRisco.push({
            cnpj_unidade: unidade.codigo_unidade,
            nome_franqueado: unidade.nome_franqueado,
            codigo_unidade: unidade.codigo_unidade,
            valor_em_risco: valorEmRisco,
            grau_risco: grauRisco,
            sinais_detectados: sinaisDetectados,
            ultima_acao: ultimaAcao.acao || 'Nenhuma ação registrada',
            data_ultima_acao: ultimaAcao.data || '',
            proxima_acao_sugerida: this.sugerirProximaAcao(grauRisco, sinaisDetectados),
            prazo_acao: this.calcularPrazoAcao(grauRisco),
            responsavel_designado: this.designarResponsavel(grauRisco)
          });
        }
      }

      return unidadesRisco.sort((a, b) => {
        const ordemRisco = { 'critico': 4, 'alto': 3, 'medio': 2, 'baixo': 1 };
        return ordemRisco[b.grau_risco] - ordemRisco[a.grau_risco];
      });
    } catch (error) {
      console.error('Erro ao monitorar sinais de risco:', error);
      throw error;
    }
  }

  /**
   * Executa gatilhos automáticos de ação
   */
  async executarGatilhosAutomaticos(): Promise<number> {
    try {
      const unidadesRisco = await this.monitorarSinaisRisco();
      const gatilhos = await this.buscarGatilhosAtivos();
      let gatilhosExecutados = 0;

      for (const unidade of unidadesRisco) {
        for (const gatilho of gatilhos) {
          if (this.avaliarCondicoesGatilho(unidade, gatilho)) {
            await this.executarAcoesGatilho(unidade, gatilho);
            gatilhosExecutados++;
          }
        }
      }

      return gatilhosExecutados;
    } catch (error) {
      console.error('Erro ao executar gatilhos automáticos:', error);
      throw error;
    }
  }

  /**
   * Busca ações pendentes
   */
  async buscarAcoesPendentes(): Promise<AcaoPendente[]> {
    try {
      const { data, error } = await supabase
        .from('acoes_pendentes')
        .select(`
          *,
          unidades_franqueadas (
            nome_franqueado
          )
        `)
        .eq('status', 'pendente')
        .order('prioridade', { ascending: false })
        .order('data_limite', { ascending: true });

      if (error) {
        throw new Error(`Erro ao buscar ações pendentes: ${error.message}`);
      }

      return data?.map(acao => ({
        ...acao,
        nome_franqueado: (acao as any).unidades_franqueadas?.nome_franqueado || 'N/A'
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar ações pendentes:', error);
      throw error;
    }
  }

  /**
   * Busca dashboard de riscos
   */
  async buscarDashboardRiscos(): Promise<DashboardRiscos> {
    try {
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      // Busca dados do mês atual
      const [unidadesRisco, gatilhosAcionados, acoesPendentes] = await Promise.all([
        this.monitorarSinaisRisco(),
        this.contarGatilhosAcionados(inicioMes),
        this.buscarAcoesPendentes()
      ]);

      const unidadesCriticas = unidadesRisco.filter(u => u.grau_risco === 'critico').length;
      
      // Calcula evolução do risco médio (últimos 6 meses)
      const evolucaoRisco = await this.calcularEvolucaoRisco();

      return {
        unidades_em_risco_mes: unidadesRisco.length,
        evolucao_risco_medio: evolucaoRisco,
        unidades_criticas: unidadesCriticas,
        tempo_medio_resposta: await this.calcularTempoMedioResposta(),
        gatilhos_acionados_mes: gatilhosAcionados,
        acoes_pendentes: acoesPendentes.length,
        taxa_resolucao: await this.calcularTaxaResolucao(),
        distribuicao_por_tipo: this.calcularDistribuicaoPorTipo(unidadesRisco)
      };
    } catch (error) {
      console.error('Erro ao buscar dashboard de riscos:', error);
      throw error;
    }
  }

  /**
   * Cria ação pendente
   */
  async criarAcaoPendente(acao: Omit<AcaoPendente, 'id' | 'data_criacao'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('acoes_pendentes')
        .insert({
          ...acao,
          data_criacao: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Erro ao criar ação pendente: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao criar ação pendente:', error);
      throw error;
    }
  }

  /**
   * Marca ação como concluída
   */
  async concluirAcao(id: string, observacoes?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('acoes_pendentes')
        .update({
          status: 'concluida',
          observacoes: observacoes
        })
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao concluir ação: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao concluir ação:', error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private async verificarAcordosVencidos(cnpjUnidade: string): Promise<number> {
    const { data } = await supabase
      .from('acordos_parcelamento')
      .select('id')
      .eq('cnpj_unidade', cnpjUnidade)
      .eq('status_acordo', 'quebrado');
    return data?.length || 0;
  }

  private async verificarAusenciaResposta(cnpjUnidade: string): Promise<number> {
    const { data } = await supabase
      .from('envios_mensagem')
      .select('data_envio')
      .eq('cnpj', cnpjUnidade)
      .eq('status_envio', 'sucesso')
      .order('data_envio', { ascending: false })
      .limit(1)
      .single();

    if (!data) return 0;

    const diasSemResposta = Math.floor(
      (new Date().getTime() - new Date(data.data_envio).getTime()) / (1000 * 60 * 60 * 24)
    );

    return diasSemResposta;
  }

  private async verificarReincidencia(cnpjUnidade: string): Promise<boolean> {
    const dataLimite = new Date();
    dataLimite.setMonth(dataLimite.getMonth() - 6);

    const { data } = await supabase
      .from('cobrancas_franqueados')
      .select('id')
      .eq('cnpj', cnpjUnidade)
      .gte('created_at', dataLimite.toISOString());

    return (data?.length || 0) >= 3;
  }

  private async buscarUltimaAcao(cnpjUnidade: string): Promise<{ acao: string; data: string }> {
    const { data } = await supabase
      .from('tratativas_cobranca')
      .select(`
        descricao,
        data_interacao,
        cobrancas_franqueados!inner(cnpj)
      `)
      .eq('cobrancas_franqueados.cnpj', cnpjUnidade)
      .order('data_interacao', { ascending: false })
      .limit(1)
      .single();

    return {
      acao: data?.descricao || '',
      data: data?.data_interacao || ''
    };
  }

  private sugerirProximaAcao(grauRisco: string, sinais: string[]): string {
    if (grauRisco === 'critico') {
      return 'Escalonamento jurídico imediato';
    } else if (grauRisco === 'alto') {
      return 'Reunião presencial obrigatória';
    } else if (grauRisco === 'medio') {
      return 'Contato telefônico urgente';
    }
    return 'Monitoramento ativo';
  }

  private calcularPrazoAcao(grauRisco: string): string {
    switch (grauRisco) {
      case 'critico': return '24 horas';
      case 'alto': return '3 dias';
      case 'medio': return '7 dias';
      default: return '15 dias';
    }
  }

  private designarResponsavel(grauRisco: string): string {
    switch (grauRisco) {
      case 'critico': return 'juridico@crescieperdi.com';
      case 'alto': return 'cobranca@crescieperdi.com';
      default: return 'financeiro@crescieperdi.com';
    }
  }

  private async buscarGatilhosAtivos(): Promise<GatilhoAutomatico[]> {
    const { data } = await supabase
      .from('gatilhos_automaticos')
      .select('*')
      .eq('ativo', true);
    return data || [];
  }

  private avaliarCondicoesGatilho(unidade: MonitoramentoRisco, gatilho: GatilhoAutomatico): boolean {
    // Implementar lógica de avaliação baseada no tipo de gatilho
    return unidade.grau_risco === 'critico' || unidade.valor_em_risco > 5000;
  }

  private async executarAcoesGatilho(unidade: MonitoramentoRisco, gatilho: GatilhoAutomatico): Promise<void> {
    const registro: Omit<RegistroGatilho, 'id'> = {
      cnpj_unidade: unidade.cnpj_unidade,
      tipo_gatilho: gatilho.tipo_gatilho,
      condicoes_atendidas: { grau_risco: unidade.grau_risco, valor: unidade.valor_em_risco },
      acoes_executadas: [],
      responsaveis_notificados: [],
      data_execucao: new Date().toISOString(),
      sucesso: true
    };

    try {
      // Executar ações configuradas
      if (gatilho.acoes_automaticas.enviar_alerta_responsavel) {
        await this.enviarAlertaResponsavel(unidade);
        registro.acoes_executadas.push('alerta_responsavel');
        registro.responsaveis_notificados.push(unidade.responsavel_designado || 'sistema');
      }

      if (gatilho.acoes_automaticas.enviar_mensagem_franqueado) {
        await this.enviarMensagemFranqueado(unidade, gatilho.acoes_automaticas.template_mensagem);
        registro.acoes_executadas.push('mensagem_franqueado');
      }

      if (gatilho.acoes_automaticas.marcar_prioridade) {
        await this.marcarPrioridade(unidade);
        registro.acoes_executadas.push('marcar_prioridade');
      }

      if (gatilho.acoes_automaticas.escalar_juridico) {
        await this.escalarJuridico(unidade);
        registro.acoes_executadas.push('escalar_juridico');
      }

      // Registrar execução
      await supabase
        .from('registros_gatilhos')
        .insert(registro);

    } catch (error) {
      registro.sucesso = false;
      registro.detalhes_erro = String(error);
      
      await supabase
        .from('registros_gatilhos')
        .insert(registro);
    }
  }

  private async enviarAlertaResponsavel(unidade: MonitoramentoRisco): Promise<void> {
    // Em produção, integrar com sistema de notificação real
    console.log(`🚨 ALERTA: Unidade ${unidade.codigo_unidade} em risco ${unidade.grau_risco}`);
  }

  private async enviarMensagemFranqueado(unidade: MonitoramentoRisco, template?: string): Promise<void> {
    // Em produção, integrar com WhatsApp API
    console.log(`📱 Mensagem enviada para ${unidade.nome_franqueado}`);
  }

  private async marcarPrioridade(unidade: MonitoramentoRisco): Promise<void> {
    await this.criarAcaoPendente({
      cnpj_unidade: unidade.cnpj_unidade,
      nome_franqueado: unidade.nome_franqueado,
      tipo_acao: 'aguardando_contato',
      descricao: `Unidade em risco ${unidade.grau_risco} - contato prioritário`,
      prazo_limite: unidade.prazo_acao,
      prioridade: unidade.grau_risco === 'critico' ? 'critica' : 'alta',
      responsavel: unidade.responsavel_designado || 'equipe_cobranca',
      valor_envolvido: unidade.valor_em_risco,
      data_limite: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'pendente'
    });
  }

  private async escalarJuridico(unidade: MonitoramentoRisco): Promise<void> {
    // Buscar cobrança principal para escalar
    const { data: cobranca } = await supabase
      .from('cobrancas_franqueados')
      .select('id')
      .eq('cnpj', unidade.cnpj_unidade)
      .eq('status', 'em_aberto')
      .order('valor_atualizado', { ascending: false })
      .limit(1)
      .single();

    if (cobranca) {
      await supabase
        .from('escalonamentos_cobranca')
        .insert({
          titulo_id: cobranca.id,
          cnpj_unidade: unidade.cnpj_unidade,
          motivo_escalonamento: `Escalonamento automático por risco ${unidade.grau_risco}`,
          enviado_para: 'juridico@crescieperdi.com',
          nivel: 'juridico',
          valor_total_envolvido: unidade.valor_em_risco,
          quantidade_titulos: 1,
          status: 'pendente',
          documento_gerado: false
        });
    }
  }

  private async contarGatilhosAcionados(dataInicio: Date): Promise<number> {
    const { data } = await supabase
      .from('registros_gatilhos')
      .select('id', { count: 'exact' })
      .gte('data_execucao', dataInicio.toISOString());
    return data?.length || 0;
  }

  private async calcularEvolucaoRisco(): Promise<number[]> {
    // Simular evolução dos últimos 6 meses
    return [15, 18, 22, 19, 25, 23];
  }

  private async calcularTempoMedioResposta(): Promise<number> {
    // Em produção, calcular baseado em dados reais
    return 2.5; // dias
  }

  private async calcularTaxaResolucao(): Promise<number> {
    // Em produção, calcular baseado em dados reais
    return 78.5; // %
  }

  private calcularDistribuicaoPorTipo(unidades: MonitoramentoRisco[]): Record<string, number> {
    const distribuicao: Record<string, number> = {};
    
    unidades.forEach(u => {
      u.sinais_detectados.forEach(sinal => {
        const tipo = this.categorizarSinal(sinal);
        distribuicao[tipo] = (distribuicao[tipo] || 0) + 1;
      });
    });

    return distribuicao;
  }

  private categorizarSinal(sinal: string): string {
    if (sinal.includes('cobranças')) return 'Múltiplas Cobranças';
    if (sinal.includes('acordo')) return 'Acordo Vencido';
    if (sinal.includes('resposta')) return 'Sem Resposta';
    if (sinal.includes('R$')) return 'Valor Alto';
    if (sinal.includes('reincidência')) return 'Reincidência';
    return 'Outros';
  }

  private async buscarConfiguracaoRisco(): Promise<ConfiguracaoRisco> {
    const { data, error } = await supabase
      .from('configuracao_risco')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      // Retorna configuração padrão
      return {
        id: 'default',
        atraso_10_dias: 1,
        nao_comparecimento: 1,
        nao_resposta_consecutiva: 1,
        notificacao_anterior: 2,
        parcelamento_nao_cumprido: 2,
        acionamento_juridico_anterior: 3,
        reincidencia_valor_alto: 5,
        limite_risco_baixo: 2,
        limite_risco_moderado: 5,
        limite_risco_critico: 6,
        valor_minimo_reincidencia: 1500,
        max_alertas_por_dia: 5,
        max_acoes_automaticas_semana: 10
      };
    }

    return data;
  }

  /**
   * Exporta dados de monitoramento
   */
  async exportarMonitoramento(): Promise<string> {
    try {
      const unidadesRisco = await this.monitorarSinaisRisco();
      
      const cabecalho = [
        'Código Unidade',
        'Nome Franqueado',
        'Grau de Risco',
        'Valor em Risco',
        'Sinais Detectados',
        'Última Ação',
        'Próxima Ação',
        'Prazo'
      ].join(',');

      const linhas = unidadesRisco.map(u => [
        u.codigo_unidade,
        u.nome_franqueado,
        u.grau_risco,
        u.valor_em_risco.toFixed(2),
        u.sinais_detectados.join('; '),
        u.ultima_acao,
        u.proxima_acao_sugerida,
        u.prazo_acao
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar monitoramento:', error);
      throw error;
    }
  }
}