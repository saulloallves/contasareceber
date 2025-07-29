import { supabase } from './databaseService';
import { ReuniaoNegociacao, RegistroInteracao, FiltrosReunioes, FiltrosInteracoes, EstatisticasReunioes, EstatisticasInteracoes, TimelineUnidade } from '../types/unidades';
import { TrativativasService } from './tratativasService';

export class ReunioesService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Busca reuniões com filtros
   */
  async buscarReunioes(filtros: FiltrosReunioes = {}) {
    try {
      let query = supabase
        .from('reunioes_negociacao')
        .select(`
          *,
          cobrancas_franqueados (
            cliente,
            cnpj,
            valor_original,
            valor_atualizado,
            status
          ),
          unidades_franqueadas (
            nome_franqueado,
            cidade,
            estado
          )
        `)
        .order('data_agendada', { ascending: false });

      if (filtros.status_reuniao) {
        query = query.eq('status_reuniao', filtros.status_reuniao);
      }

      if (filtros.responsavel) {
        query = query.ilike('responsavel_reuniao', `%${filtros.responsavel}%`);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_agendada', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_agendada', filtros.dataFim);
      }

      if (filtros.decisao_final) {
        query = query.eq('decisao_final', filtros.decisao_final);
      }

      if (filtros.codigo_unidade) {
        query = query.eq('codigo_unidade', filtros.codigo_unidade);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar reuniões: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar reuniões:', error);
      throw error;
    }
  }

  /**
   * Agenda nova reunião
   */
  async agendarReuniao(reuniao: Omit<ReuniaoNegociacao, 'id' | 'created_at' | 'updated_at'>): Promise<ReuniaoNegociacao> {
    try {
      // Valida dados obrigatórios
      if (!reuniao.titulo_id || !reuniao.data_agendada || !reuniao.responsavel_reuniao) {
        throw new Error('Título, data e responsável são obrigatórios');
      }

      // Verifica se já existe reunião agendada para este título
      const { data: reuniaoExistente } = await supabase
        .from('reunioes_negociacao')
        .select('id')
        .eq('titulo_id', reuniao.titulo_id)
        .eq('status_reuniao', 'agendada')
        .single();

      if (reuniaoExistente) {
        throw new Error('Já existe uma reunião agendada para esta cobrança');
      }

      const { data, error } = await supabase
        .from('reunioes_negociacao')
        .insert(reuniao)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao agendar reunião: ${error.message}`);
      }

      // Registra tratativa
      await this.tratativasService.registrarAgendamento(
        reuniao.titulo_id,
        reuniao.data_agendada,
        'sistema_interno',
        `Reunião agendada para ${new Date(reuniao.data_agendada).toLocaleString('pt-BR')} com ${reuniao.responsavel_reuniao}`
      );

      return data;
    } catch (error) {
      console.error('Erro ao agendar reunião:', error);
      throw error;
    }
  }

  /**
   * Registra nova interação com unidade
   */
  async registrarInteracao(interacao: Omit<RegistroInteracao, 'id' | 'created_at' | 'updated_at'>): Promise<RegistroInteracao> {
    try {
      // Valida dados obrigatórios
      if (!interacao.codigo_unidade || !interacao.data_interacao || !interacao.colaborador_responsavel) {
        throw new Error('Código da unidade, data e responsável são obrigatórios');
      }

      const { data, error } = await supabase
        .from('registro_interacoes')
        .insert(interacao)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao registrar interação: ${error.message}`);
      }

      // Registra tratativa automática se vinculada a cobrança
      if (interacao.motivo_contato !== 'outro') {
        await this.registrarTrativativaAutomatica(interacao);
      }

      // Atualiza status da cobrança se necessário
      await this.atualizarStatusCobranca(interacao);

      return data;
    } catch (error) {
      console.error('Erro ao registrar interação:', error);
      throw error;
    }
  }

  /**
   * Busca interações com filtros
   */
  async buscarInteracoes(filtros: FiltrosInteracoes = {}) {
    try {
      let query = supabase
        .from('registro_interacoes')
        .select(`
          *,
          unidades_franqueadas (
            nome_franqueado,
            cidade,
            estado,
            status_unidade
          )
        `)
        .order('data_interacao', { ascending: false });

      if (filtros.canal_contato) {
        query = query.eq('canal_contato', filtros.canal_contato);
      }

      if (filtros.motivo_contato) {
        query = query.eq('motivo_contato', filtros.motivo_contato);
      }

      if (filtros.resultado_contato) {
        query = query.eq('resultado_contato', filtros.resultado_contato);
      }

      if (filtros.colaborador) {
        query = query.ilike('colaborador_responsavel', `%${filtros.colaborador}%`);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_interacao', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_interacao', filtros.dataFim);
      }

      if (filtros.codigo_unidade) {
        query = query.eq('codigo_unidade', filtros.codigo_unidade);
      }

      if (filtros.cnpj) {
        query = query.ilike('cnpj_unidade', `%${filtros.cnpj}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar interações: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar interações:', error);
      throw error;
    }
  }

  /**
   * Busca timeline completa de uma unidade
   */
  async buscarTimelineUnidade(codigoUnidade: string): Promise<TimelineUnidade> {
    try {
      const [unidade, interacoes, reunioes, acordos, documentos] = await Promise.all([
        this.buscarUnidade(codigoUnidade),
        this.buscarInteracoesPorUnidade(codigoUnidade),
        this.buscarReunioesPorUnidade(codigoUnidade),
        this.buscarAcordosPorUnidade(codigoUnidade),
        this.buscarDocumentosPorUnidade(codigoUnidade)
      ]);

      return {
        unidade: unidade!,
        interacoes,
        reunioes,
        acordos,
        documentos
      };
    } catch (error) {
      console.error('Erro ao buscar timeline:', error);
      throw error;
    }
  }

  /**
   * Atualiza status da reunião
   */
  async atualizarStatusReuniao(
    id: string, 
    novoStatus: ReuniaoNegociacao['status_reuniao'],
    dadosAdicionais?: Partial<ReuniaoNegociacao>
  ): Promise<ReuniaoNegociacao> {
    try {
      const atualizacao: Partial<ReuniaoNegociacao> = {
        status_reuniao: novoStatus,
        ...dadosAdicionais
      };

      // Se está marcando como realizada, adiciona data
      if (novoStatus === 'realizada' && !atualizacao.data_realizada) {
        atualizacao.data_realizada = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('reunioes_negociacao')
        .update(atualizacao)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar reunião: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao atualizar status da reunião:', error);
      throw error;
    }
  }

  /**
   * Registra resultado da reunião
   */
  async registrarResultadoReuniao(
    id: string,
    decisao: ReuniaoNegociacao['decisao_final'],
    resumo: string,
    observacoes?: string
  ): Promise<void> {
    try {
      await this.atualizarStatusReuniao(id, 'realizada', {
        decisao_final: decisao,
        resumo_resultado: resumo,
        observacoes,
        data_realizada: new Date().toISOString()
      });

      // Registra interação automática
      const { data: reuniao } = await supabase
        .from('reunioes_negociacao')
        .select('codigo_unidade, cnpj_unidade, responsavel_reuniao')
        .eq('id', id)
        .single();

      if (reuniao) {
        await this.registrarInteracao({
          codigo_unidade: reuniao.codigo_unidade || '',
          cnpj_unidade: reuniao.cnpj_unidade || '',
          nome_franqueado: '',
          data_interacao: new Date().toISOString(),
          canal_contato: 'presencial',
          colaborador_responsavel: reuniao.responsavel_reuniao,
          motivo_contato: 'negociacao',
          resultado_contato: decisao === 'quitado' ? 'acordo_formalizado' : 
                           decisao === 'parcela_futura' ? 'negociacao_aceita' : 'sem_resposta',
          resumo_conversa: resumo,
          comentarios_internos: observacoes
        });
      }
    } catch (error) {
      console.error('Erro ao registrar resultado da reunião:', error);
      throw error;
    }
  }

  /**
   * Remarcar reunião
   */
  async remarcarReuniao(id: string, novaData: string, motivo?: string): Promise<void> {
    try {
      const { data: reuniao } = await supabase
        .from('reunioes_negociacao')
        .select('titulo_id, responsavel_reuniao')
        .eq('id', id)
        .single();

      if (!reuniao) {
        throw new Error('Reunião não encontrada');
      }

      // Atualiza a reunião atual como remarcada
      await this.atualizarStatusReuniao(id, 'remarcada', {
        observacoes: `Remarcada para ${new Date(novaData).toLocaleString('pt-BR')}. ${motivo || ''}`
      });

      // Cria nova reunião
      await this.agendarReuniao({
        titulo_id: reuniao.titulo_id,
        data_agendada: novaData,
        responsavel_reuniao: reuniao.responsavel_reuniao,
        observacoes: `Remarcação da reunião anterior. ${motivo || ''}`
      });
    } catch (error) {
      console.error('Erro ao remarcar reunião:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas das reuniões
   */
  async buscarEstatisticasReunioes(filtros: FiltrosReunioes = {}): Promise<EstatisticasReunioes> {
    try {
      let query = supabase
        .from('reunioes_negociacao')
        .select('status_reuniao, data_agendada');

      // Aplica filtros se fornecidos
      if (filtros.dataInicio) {
        query = query.gte('data_agendada', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data_agendada', filtros.dataFim);
      }
      if (filtros.responsavel) {
        query = query.ilike('responsavel_reuniao', `%${filtros.responsavel}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
      }

      const stats: EstatisticasReunioes = {
        total_agendadas: 0,
        total_realizadas: 0,
        total_nao_compareceu: 0,
        total_remarcadas: 0,
        taxa_comparecimento: 0,
        reunioes_pendentes: 0
      };

      const agora = new Date();

      data?.forEach(reuniao => {
        switch (reuniao.status_reuniao) {
          case 'agendada':
            stats.total_agendadas++;
            if (new Date(reuniao.data_agendada) < agora) {
              stats.reunioes_pendentes++;
            }
            break;
          case 'realizada':
            stats.total_realizadas++;
            break;
          case 'nao_compareceu':
            stats.total_nao_compareceu++;
            break;
          case 'remarcada':
            stats.total_remarcadas++;
            break;
        }
      });

      // Calcula taxa de comparecimento
      const totalFinalizadas = stats.total_realizadas + stats.total_nao_compareceu;
      if (totalFinalizadas > 0) {
        stats.taxa_comparecimento = (stats.total_realizadas / totalFinalizadas) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas das interações
   */
  async buscarEstatisticasInteracoes(filtros: FiltrosInteracoes = {}): Promise<EstatisticasInteracoes> {
    try {
      let query = supabase
        .from('registro_interacoes')
        .select('canal_contato, resultado_contato, data_interacao');

      // Aplica filtros
      if (filtros.dataInicio) {
        query = query.gte('data_interacao', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data_interacao', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
      }

      const stats: EstatisticasInteracoes = {
        total_interacoes: data?.length || 0,
        por_canal: {},
        por_resultado: {},
        taxa_sucesso: 0,
        tempo_medio_resposta: 0,
        interacoes_mes_atual: 0
      };

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      data?.forEach(interacao => {
        // Por canal
        stats.por_canal[interacao.canal_contato] = (stats.por_canal[interacao.canal_contato] || 0) + 1;
        
        // Por resultado
        stats.por_resultado[interacao.resultado_contato] = (stats.por_resultado[interacao.resultado_contato] || 0) + 1;
        
        // Interações do mês atual
        if (new Date(interacao.data_interacao) >= inicioMes) {
          stats.interacoes_mes_atual++;
        }
      });

      // Calcula taxa de sucesso
      const sucessos = (stats.por_resultado['compareceu'] || 0) + 
                      (stats.por_resultado['negociacao_aceita'] || 0) + 
                      (stats.por_resultado['acordo_formalizado'] || 0);
      
      if (stats.total_interacoes > 0) {
        stats.taxa_sucesso = (sucessos / stats.total_interacoes) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Verifica reuniões não realizadas (para automação)
   */
  async verificarReunioesPendentes(): Promise<void> {
    try {
      await supabase.rpc('verificar_reunioes_nao_realizadas');
    } catch (error) {
      console.error('Erro ao verificar reuniões pendentes:', error);
      throw error;
    }
  }

  /**
   * Busca reuniões de uma cobrança específica
   */
  async buscarReunioesPorCobranca(tituloId: string) {
    try {
      const { data, error } = await supabase
        .from('reunioes_negociacao')
        .select('*')
        .eq('titulo_id', tituloId)
        .order('data_agendada', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar reuniões: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar reuniões por cobrança:', error);
      throw error;
    }
  }

  /**
   * Exporta dados das reuniões
   */
  async exportarReunioes(filtros: FiltrosReunioes = {}): Promise<string> {
    try {
      const reunioes = await this.buscarReunioes(filtros);
      
      // Cabeçalho CSV
      const cabecalho = [
        'Data Agendada',
        'Data Realizada',
        'Status',
        'Cliente',
        'CNPJ',
        'Responsável',
        'Decisão',
        'Resumo',
        'Observações'
      ].join(',');

      // Dados
      const linhas = reunioes.map(reuniao => [
        new Date(reuniao.data_agendada).toLocaleString('pt-BR'),
        reuniao.data_realizada ? new Date(reuniao.data_realizada).toLocaleString('pt-BR') : '',
        reuniao.status_reuniao,
        (reuniao as any).cobrancas_franqueados?.cliente || '',
        (reuniao as any).cobrancas_franqueados?.cnpj || '',
        reuniao.responsavel_reuniao,
        reuniao.decisao_final || '',
        (reuniao.resumo_resultado || '').replace(/,/g, ';'),
        (reuniao.observacoes || '').replace(/,/g, ';')
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar reuniões:', error);
      throw error;
    }
  }

  /**
   * Exporta dados das interações
   */
  async exportarInteracoes(filtros: FiltrosInteracoes = {}): Promise<string> {
    try {
      const interacoes = await this.buscarInteracoes(filtros);
      
      // Cabeçalho CSV
      const cabecalho = [
        'Data Interação',
        'Código Unidade',
        'CNPJ',
        'Nome Franqueado',
        'Canal',
        'Motivo',
        'Resultado',
        'Colaborador',
        'Resumo',
        'Próximo Contato'
      ].join(',');

      // Dados
      const linhas = interacoes.map(interacao => [
        new Date(interacao.data_interacao).toLocaleString('pt-BR'),
        interacao.codigo_unidade,
        interacao.cnpj_unidade,
        interacao.nome_franqueado,
        interacao.canal_contato,
        interacao.motivo_contato,
        interacao.resultado_contato,
        interacao.colaborador_responsavel,
        (interacao.resumo_conversa || '').replace(/,/g, ';'),
        interacao.proximo_contato || ''
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar interações:', error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private async buscarUnidade(codigoUnidade: string) {
    const { data } = await supabase
      .from('unidades_franqueadas')
      .select('*')
      .eq('codigo_unidade', codigoUnidade)
      .single();
    return data;
  }

  private async buscarInteracoesPorUnidade(codigoUnidade: string) {
    const { data } = await supabase
      .from('registro_interacoes')
      .select('*')
      .eq('codigo_unidade', codigoUnidade)
      .order('data_interacao', { ascending: false });
    return data || [];
  }

  private async buscarReunioesPorUnidade(codigoUnidade: string) {
    const { data } = await supabase
      .from('reunioes_negociacao')
      .select('*')
      .eq('codigo_unidade', codigoUnidade)
      .order('data_agendada', { ascending: false });
    return data || [];
  }

  private async buscarAcordosPorUnidade(codigoUnidade: string) {
    const { data } = await supabase
      .from('acordos_parcelamento')
      .select('*')
      .eq('cnpj_unidade', codigoUnidade)
      .order('created_at', { ascending: false });
    return data || [];
  }

  private async buscarDocumentosPorUnidade(codigoUnidade: string) {
    const { data } = await supabase
      .from('documentos_cobranca')
      .select('*')
      .eq('codigo_unidade', codigoUnidade)
      .order('data_upload', { ascending: false });
    return data || [];
  }

  /**
   * Registra tratativa automática baseada na interação
   */
  private async registrarTrativativaAutomatica(interacao: RegistroInteracao): Promise<void> {
    try {
      // Busca cobrança ativa da unidade
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('id')
        .eq('cnpj', interacao.cnpj_unidade)
        .eq('status', 'em_aberto')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cobranca) {
        await this.tratativasService.registrarObservacao(
          cobranca.id,
          interacao.colaborador_responsavel,
          `${this.formatarMotivoContato(interacao.motivo_contato)} via ${this.formatarCanal(interacao.canal_contato)}. Resultado: ${this.formatarResultado(interacao.resultado_contato)}. ${interacao.resumo_conversa}`,
          this.mapearResultadoParaStatus(interacao.resultado_contato)
        );
      }
    } catch (error) {
      console.error('Erro ao registrar tratativa automática:', error);
    }
  }

  /**
   * Atualiza status da cobrança baseado no resultado da interação
   */
  private async atualizarStatusCobranca(interacao: RegistroInteracao): Promise<void> {
    try {
      const novoStatus = this.mapearResultadoParaStatus(interacao.resultado_contato);
      if (!novoStatus) return;

      // Busca cobrança ativa da unidade
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('id')
        .eq('cnpj', interacao.cnpj_unidade)
        .eq('status', 'em_aberto')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cobranca) {
        await supabase
          .from('cobrancas_franqueados')
          .update({ status: novoStatus })
          .eq('id', cobranca.id);
      }
    } catch (error) {
      console.error('Erro ao atualizar status da cobrança:', error);
    }
  }

  /**
   * Métodos de formatação e mapeamento
   */
  private formatarMotivoContato(motivo: string): string {
    const motivos: Record<string, string> = {
      'lembrete_vencimento': 'Lembrete de vencimento',
      'proposta_acordo': 'Proposta de acordo',
      'negociacao': 'Negociação',
      'notificacao_inadimplencia': 'Notificação de inadimplência',
      'acordo_descumprido': 'Acordo descumprido',
      'escalonamento_juridico': 'Escalonamento jurídico',
      'outro': 'Outro motivo'
    };
    return motivos[motivo] || motivo;
  }

  private formatarCanal(canal: string): string {
    const canais: Record<string, string> = {
      'ligacao': 'Ligação telefônica',
      'whatsapp': 'WhatsApp',
      'email': 'E-mail',
      'presencial': 'Reunião presencial',
      'videoconferencia': 'Videoconferência',
      'outro': 'Outro canal'
    };
    return canais[canal] || canal;
  }

  private formatarResultado(resultado: string): string {
    const resultados: Record<string, string> = {
      'compareceu': 'Compareceu',
      'nao_compareceu': 'Não compareceu',
      'remarcado': 'Remarcado',
      'sem_resposta': 'Sem resposta',
      'negociacao_aceita': 'Negociação aceita',
      'negociacao_recusada': 'Negociação recusada',
      'acordo_formalizado': 'Acordo formalizado',
      'outro': 'Outro resultado'
    };
    return resultados[resultado] || resultado;
  }

  private mapearResultadoParaStatus(resultado: string): string | undefined {
    const mapeamento: Record<string, string> = {
      'acordo_formalizado': 'negociando',
      'negociacao_aceita': 'negociando',
      'negociacao_recusada': 'em_aberto'
    };
    return mapeamento[resultado];
  }
}