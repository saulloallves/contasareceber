import { supabase } from './databaseService';
import { UnidadeCentral, CobrancaUnidade, ReuniaoUnidade, ComunicacaoUnidade, DashboardUnidade, FiltrosUnidadeCentral, VinculoFranqueado } from '../types/unidadeCentral';
import { TrativativasService } from './tratativasService';

export class UnidadeCentralService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Busca dados completos da unidade
   */
  async buscarUnidadeCompleta(codigoUnidade: string): Promise<{
    unidade: UnidadeCentral;
    cobrancas: CobrancaUnidade[];
    reunioes: ReuniaoUnidade[];
    comunicacoes: ComunicacaoUnidade[];
    dashboard: DashboardUnidade;
    vinculos: VinculoFranqueado;
  } | null> {
    try {
      // Busca dados da unidade
      const { data: unidade, error: errorUnidade } = await supabase
        .from('unidades_franqueadas')
        .select('*')
        .eq('codigo_unidade', codigoUnidade)
        .single();

      if (errorUnidade || !unidade) {
        throw new Error('Unidade não encontrada');
      }

      // Busca cobranças
      const cobrancas = await this.buscarCobrancasUnidade(codigoUnidade);
      
      // Busca reuniões
      const reunioes = await this.buscarReunioes(codigoUnidade);
      
      // Busca comunicações
      const comunicacoes = await this.buscarComunicacoes(codigoUnidade);
      
      // Calcula dashboard
      const dashboard = await this.calcularDashboardUnidade(codigoUnidade);
      
      // Busca vínculos
      const vinculos = await this.buscarVinculosFranqueado(unidade.nome_franqueado);

      return {
        unidade: this.mapearUnidade(unidade),
        cobrancas,
        reunioes,
        comunicacoes,
        dashboard,
        vinculos
      };
    } catch (error) {
      console.error('Erro ao buscar unidade completa:', error);
      return null;
    }
  }

  /**
   * Busca cobranças da unidade com filtros
   */
  async buscarCobrancasUnidade(codigoUnidade: string, filtros: FiltrosUnidadeCentral = {}): Promise<CobrancaUnidade[]> {
    try {
      let query = supabase
        .from('cobrancas_franqueados')
        .select('*')
        .eq('cnpj', codigoUnidade)
        .order('data_vencimento', { ascending: false });

      if (filtros.tipo_cobranca) {
        query = query.eq('tipo_cobranca', filtros.tipo_cobranca);
      }

      if (filtros.status_cobranca) {
        query = query.eq('status', filtros.status_cobranca);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_vencimento', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_vencimento', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar cobranças: ${error.message}`);
      }

      return data?.map(c => ({
        id: c.id,
        valor_original: c.valor_original,
        valor_atualizado: c.valor_atualizado || c.valor_original,
        data_vencimento: c.data_vencimento,
        status: c.status,
        tipo: c.tipo_cobranca || 'outros',
        dias_atraso: c.dias_em_atraso || 0,
        created_at: c.created_at
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar cobranças da unidade:', error);
      return [];
    }
  }

  /**
   * Busca reuniões da unidade
   */
  async buscarReunioes(codigoUnidade: string): Promise<ReuniaoUnidade[]> {
    try {
      const { data, error } = await supabase
        .from('reunioes_negociacao')
        .select('*')
        .eq('codigo_unidade', codigoUnidade)
        .order('data_agendada', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar reuniões: ${error.message}`);
      }

      return data?.map(r => ({
        id: r.id,
        data_hora: r.data_agendada,
        participantes: r.responsavel_reuniao,
        status: r.status_reuniao,
        acoes_realizadas: r.resumo_resultado,
        observacoes: r.observacoes,
        created_at: r.created_at
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar reuniões:', error);
      return [];
    }
  }

  /**
   * Busca comunicações da unidade
   */
  async buscarComunicacoes(codigoUnidade: string): Promise<ComunicacaoUnidade[]> {
    try {
      const { data, error } = await supabase
        .from('envios_mensagem')
        .select('*')
        .eq('cnpj', codigoUnidade)
        .order('data_envio', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar comunicações: ${error.message}`);
      }

      return data?.map(c => ({
        id: c.id,
        tipo: 'whatsapp',
        conteudo: c.mensagem_enviada,
        data_envio: c.data_envio,
        status_leitura: c.status_envio === 'sucesso' ? 'entregue' : 'enviado',
        created_at: c.created_at
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar comunicações:', error);
      return [];
    }
  }

  /**
   * Calcula dashboard específico da unidade
   */
  async calcularDashboardUnidade(codigoUnidade: string): Promise<DashboardUnidade> {
    try {
      const cobrancas = await this.buscarCobrancasUnidade(codigoUnidade);
      const reunioes = await this.buscarReunioes(codigoUnidade);

      const totalEmAberto = cobrancas
        .filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + c.valor_atualizado, 0);

      const totalPago = cobrancas
        .filter(c => c.status === 'pago')
        .reduce((sum, c) => sum + c.valor_original, 0);

      const totalGeral = totalEmAberto + totalPago;
      const percentualInadimplencia = totalGeral > 0 ? (totalEmAberto / totalGeral) * 100 : 0;

      // Calcula tendência dos últimos 6 meses
      const tendencia = await this.calcularTendenciaRegularizacao(codigoUnidade);

      const reunioesMes = reunioes.filter(r => {
        const dataReuniao = new Date(r.data_hora);
        const agora = new Date();
        return dataReuniao.getMonth() === agora.getMonth() && 
               dataReuniao.getFullYear() === agora.getFullYear();
      }).length;

      const acordosFirmados = cobrancas.filter(c => c.status === 'acordo').length;
      const cobrancasJuridico = cobrancas.filter(c => c.status === 'escalonado').length;

      return {
        total_em_aberto: totalEmAberto,
        total_pago: totalPago,
        percentual_inadimplencia: percentualInadimplencia,
        tendencia_regularizacao: tendencia,
        reunioes_mes: reunioesMes,
        acordos_firmados: acordosFirmados,
        cobrancas_juridico: cobrancasJuridico
      };
    } catch (error) {
      console.error('Erro ao calcular dashboard:', error);
      return {
        total_em_aberto: 0,
        total_pago: 0,
        percentual_inadimplencia: 0,
        tendencia_regularizacao: [],
        reunioes_mes: 0,
        acordos_firmados: 0,
        cobrancas_juridico: 0
      };
    }
  }

  /**
   * Busca vínculos do franqueado
   */
  async buscarVinculosFranqueado(nomeFranqueado: string): Promise<VinculoFranqueado> {
    try {
      const { data: unidades, error } = await supabase
        .from('unidades_franqueadas')
        .select(`
          codigo_unidade,
          nome_franqueado,
          status_unidade,
          cobrancas_franqueados (
            valor_atualizado,
            valor_original,
            status
          )
        `)
        .eq('nome_franqueado', nomeFranqueado);

      if (error) {
        throw new Error(`Erro ao buscar vínculos: ${error.message}`);
      }

      const outrasUnidades = unidades?.map(u => {
        const valorEmAberto = (u as any).cobrancas_franqueados
          ?.filter((c: any) => c.status === 'em_aberto')
          .reduce((sum: number, c: any) => sum + (c.valor_atualizado || c.valor_original), 0) || 0;

        return {
          codigo_unidade: u.codigo_unidade,
          nome_unidade: u.nome_franqueado,
          status: u.status_unidade,
          valor_em_aberto: valorEmAberto
        };
      }) || [];

      const valorTotalGrupo = outrasUnidades.reduce((sum, u) => sum + u.valor_em_aberto, 0);

      return {
        franqueado_principal: nomeFranqueado,
        outras_unidades: outrasUnidades,
        total_unidades: outrasUnidades.length,
        valor_total_grupo: valorTotalGrupo
      };
    } catch (error) {
      console.error('Erro ao buscar vínculos:', error);
      return {
        franqueado_principal: nomeFranqueado,
        outras_unidades: [],
        total_unidades: 0,
        valor_total_grupo: 0
      };
    }
  }

  /**
   * Agenda nova reunião
   */
  async agendarReuniao(
    codigoUnidade: string,
    dataHora: string,
    participantes: string,
    observacoes?: string
  ): Promise<void> {
    try {
      // Busca cobrança ativa para vincular
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('id')
        .eq('cnpj', codigoUnidade)
        .eq('status', 'em_aberto')
        .limit(1)
        .single();

      const { error } = await supabase
        .from('reunioes_negociacao')
        .insert({
          titulo_id: cobranca?.id,
          codigo_unidade: codigoUnidade,
          cnpj_unidade: codigoUnidade,
          data_agendada: dataHora,
          responsavel_reuniao: participantes,
          observacoes,
          status_reuniao: 'agendada'
        });

      if (error) {
        throw new Error(`Erro ao agendar reunião: ${error.message}`);
      }

      // Registra tratativa
      if (cobranca) {
        await this.tratativasService.registrarObservacao(
          cobranca.id,
          'usuario_atual',
          `Reunião agendada para ${new Date(dataHora).toLocaleString('pt-BR')} com ${participantes}`,
          'negociando'
        );
      }
    } catch (error) {
      console.error('Erro ao agendar reunião:', error);
      throw error;
    }
  }

  /**
   * Envia mensagem personalizada
   */
  async enviarMensagemPersonalizada(
    codigoUnidade: string,
    tipo: 'whatsapp' | 'email',
    conteudo: string
  ): Promise<void> {
    try {
      // Busca dados da unidade
      const { data: unidade } = await supabase
        .from('unidades_franqueadas')
        .select('nome_franqueado, whatsapp_comercial, email_comercial')
        .eq('codigo_unidade', codigoUnidade)
        .single();

      if (!unidade) {
        throw new Error('Unidade não encontrada');
      }

      const destinatario = tipo === 'whatsapp' ? unidade.whatsapp_comercial : unidade.email_comercial;

      if (!destinatario) {
        throw new Error(`${tipo} não cadastrado para esta unidade`);
      }

      // Registra envio
      await supabase
        .from('envios_mensagem')
        .insert({
          titulo_id: null,
          cliente: unidade.nome_franqueado,
          cnpj: codigoUnidade,
          telefone: tipo === 'whatsapp' ? destinatario : '',
          mensagem_enviada: conteudo,
          status_envio: 'sucesso'
        });

      // Em produção, integrar com APIs reais de envio
      console.log(`Enviando ${tipo} para ${destinatario}:`, conteudo);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  /**
   * Gera notificação formal
   */
  async gerarNotificacaoFormal(
    codigoUnidade: string,
    tipoNotificacao: string,
    observacoes?: string
  ): Promise<void> {
    try {
      // Busca cobrança principal
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('id')
        .eq('cnpj', codigoUnidade)
        .eq('status', 'em_aberto')
        .order('dias_em_atraso', { ascending: false })
        .limit(1)
        .single();

      if (!cobranca) {
        throw new Error('Nenhuma cobrança em aberto encontrada');
      }

      // Gera documento
      await supabase
        .from('documentos_gerados')
        .insert({
          tipo_documento: tipoNotificacao,
          titulo_id: cobranca.id,
          conteudo_html: `Notificação ${tipoNotificacao} gerada para unidade ${codigoUnidade}`,
          gerado_por: 'usuario_atual'
        });

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        cobranca.id,
        'usuario_atual',
        `Notificação formal gerada: ${tipoNotificacao}. ${observacoes || ''}`,
        'em_tratativa_juridica'
      );
    } catch (error) {
      console.error('Erro ao gerar notificação:', error);
      throw error;
    }
  }

  /**
   * Escala para jurídico
   */
  async escalarParaJuridico(
    codigoUnidade: string,
    motivo: string,
    valorEnvolvido: number
  ): Promise<void> {
    try {
      // Busca cobrança principal
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('id')
        .eq('cnpj', codigoUnidade)
        .eq('status', 'em_aberto')
        .order('valor_atualizado', { ascending: false })
        .limit(1)
        .single();

      if (!cobranca) {
        throw new Error('Nenhuma cobrança em aberto encontrada');
      }

      // Cria escalonamento
      await supabase
        .from('escalonamentos_cobranca')
        .insert({
          titulo_id: cobranca.id,
          cnpj_unidade: codigoUnidade,
          motivo_escalonamento: motivo,
          enviado_para: 'juridico@crescieperdi.com',
          nivel: 'juridico',
          valor_total_envolvido: valorEnvolvido,
          quantidade_titulos: 1,
          status: 'pendente'
        });

      // Atualiza status da cobrança
      await supabase
        .from('cobrancas_franqueados')
        .update({ status: 'em_tratativa_juridica' })
        .eq('id', cobranca.id);

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        cobranca.id,
        'usuario_atual',
        `Escalonado para jurídico: ${motivo}`,
        'em_tratativa_juridica'
      );
    } catch (error) {
      console.error('Erro ao escalar para jurídico:', error);
      throw error;
    }
  }

  /**
   * Atualiza dados cadastrais da unidade
   */
  async atualizarDadosCadastrais(
    codigoUnidade: string,
    dadosAtualizacao: Partial<UnidadeCentral>
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('unidades_franqueadas')
        .update(dadosAtualizacao)
        .eq('codigo_unidade', codigoUnidade);

      if (error) {
        throw new Error(`Erro ao atualizar dados: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar dados cadastrais:', error);
      throw error;
    }
  }

  /**
   * Exporta dados da unidade
   */
  async exportarDadosUnidade(codigoUnidade: string): Promise<Blob> {
    try {
      const dados = await this.buscarUnidadeCompleta(codigoUnidade);
      if (!dados) throw new Error('Unidade não encontrada');

      const dadosExport = {
        unidade: dados.unidade,
        cobrancas: dados.cobrancas,
        reunioes: dados.reunioes,
        comunicacoes: dados.comunicacoes,
        dashboard: dados.dashboard,
        vinculos: dados.vinculos,
        exportado_em: new Date().toISOString()
      };

      const json = JSON.stringify(dadosExport, null, 2);
      return new Blob([json], { type: 'application/json' });
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private mapearUnidade(unidadeRaw: any): UnidadeCentral {
    return {
      id: unidadeRaw.id,
      codigo_unidade: unidadeRaw.codigo_unidade,
      codigo_oficial_franquia: unidadeRaw.codigo_interno || unidadeRaw.codigo_unidade,
      nome_unidade: unidadeRaw.nome_franqueado,
      cnpj: unidadeRaw.codigo_unidade,
      razao_social: unidadeRaw.nome_franqueado,
      nome_franqueado_responsavel: unidadeRaw.nome_franqueado,
      nome_franqueado_principal: unidadeRaw.franqueado_principal ? unidadeRaw.nome_franqueado : undefined,
      endereco_completo: unidadeRaw.endereco_completo || `${unidadeRaw.cidade}, ${unidadeRaw.estado}`,
      whatsapp_comercial: unidadeRaw.telefone_franqueado,
      email_comercial: unidadeRaw.email_franqueado,
      responsavel_financeiro: unidadeRaw.nome_franqueado,
      status_unidade: unidadeRaw.status_unidade,
      data_abertura: unidadeRaw.data_abertura,
      observacoes: unidadeRaw.observacoes_unidade,
      created_at: unidadeRaw.created_at,
      updated_at: unidadeRaw.updated_at
    };
  }

  private async calcularTendenciaRegularizacao(codigoUnidade: string): Promise<number[]> {
    try {
      const tendencia = [];
      
      for (let i = 5; i >= 0; i--) {
        const dataRef = new Date();
        dataRef.setMonth(dataRef.getMonth() - i);
        
        const { data } = await supabase
          .from('cobrancas_franqueados')
          .select('valor_original, status')
          .eq('cnpj', codigoUnidade)
          .gte('created_at', new Date(dataRef.getFullYear(), dataRef.getMonth(), 1).toISOString())
          .lt('created_at', new Date(dataRef.getFullYear(), dataRef.getMonth() + 1, 1).toISOString());

        const totalEmitido = data?.reduce((sum, c) => sum + c.valor_original, 0) || 0;
        const totalPago = data?.filter(c => c.status === 'pago').reduce((sum, c) => sum + c.valor_original, 0) || 0;
        
        const percentualRegularizacao = totalEmitido > 0 ? (totalPago / totalEmitido) * 100 : 0;
        tendencia.push(percentualRegularizacao);
      }
      
      return tendencia;
    } catch (error) {
      console.error('Erro ao calcular tendência:', error);
      return [0, 0, 0, 0, 0, 0];
    }
  }
}