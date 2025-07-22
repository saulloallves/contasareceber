import { createClient } from '@supabase/supabase-js';
import { TrativativaCobranca, HistoricoTratativas, CobrancaFranqueado } from '../types/cobranca';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class TrativativasService {
  /**
   * Registra uma nova tratativa de cobrança
   */
  async registrarTratativa(tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'>): Promise<TrativativaCobranca | null> {
    try {
      const { data, error } = await supabase
        .from('tratativas_cobranca')
        .insert(tratativa)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao registrar tratativa: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao registrar tratativa:', error);
      throw error;
    }
  }

  /**
   * Busca histórico completo de tratativas para uma cobrança
   */
  async buscarHistoricoCobranca(tituloId: string): Promise<HistoricoTratativas | null> {
    try {
      // Busca a cobrança
      const { data: cobranca, error: errorCobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('*')
        .eq('id', tituloId)
        .single();

      if (errorCobranca) {
        throw new Error(`Erro ao buscar cobrança: ${errorCobranca.message}`);
      }

      // Busca as tratativas
      const { data: tratativas, error: errorTratativas } = await supabase
        .from('tratativas_cobranca')
        .select('*')
        .eq('titulo_id', tituloId)
        .order('data_interacao', { ascending: false });

      if (errorTratativas) {
        throw new Error(`Erro ao buscar tratativas: ${errorTratativas.message}`);
      }

      return {
        cobranca,
        tratativas: tratativas || []
      };
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      throw error;
    }
  }

  /**
   * Busca todas as tratativas com filtros
   */
  async buscarTratativas(filtros: {
    tituloId?: string;
    tipoInteracao?: string;
    canal?: string;
    dataInicio?: string;
    dataFim?: string;
    usuario?: string;
  } = {}) {
    try {
      let query = supabase
        .from('tratativas_cobranca')
        .select(`
          *,
          cobrancas_franqueados (
            cliente,
            cnpj,
            valor_original,
            valor_atualizado,
            status
          )
        `)
        .order('data_interacao', { ascending: false });

      if (filtros.tituloId) {
        query = query.eq('titulo_id', filtros.tituloId);
      }

      if (filtros.tipoInteracao) {
        query = query.eq('tipo_interacao', filtros.tipoInteracao);
      }

      if (filtros.canal) {
        query = query.eq('canal', filtros.canal);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_interacao', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_interacao', filtros.dataFim);
      }

      if (filtros.usuario) {
        query = query.ilike('usuario_sistema', `%${filtros.usuario}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar tratativas: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar tratativas:', error);
      throw error;
    }
  }

  /**
   * Registra tratativa automática para envio de mensagem
   */
  async registrarEnvioMensagem(
    tituloId: string,
    mensagem: string,
    statusEnvio: 'sucesso' | 'falha',
    erro?: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'mensagem_automatica',
      canal: 'whatsapp',
      usuario_sistema: 'sistema_automatico',
      descricao: statusEnvio === 'sucesso' 
        ? `Mensagem enviada automaticamente: "${mensagem.substring(0, 100)}..."`
        : `Falha no envio da mensagem: ${erro || 'Erro desconhecido'}`,
      status_cobranca_resultante: statusEnvio === 'sucesso' ? 'cobrado' : undefined
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra agendamento via Calendly ou similar
   */
  async registrarAgendamento(
    tituloId: string,
    dataAgendamento: string,
    plataforma: string,
    observacoes?: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'agendamento',
      canal: plataforma.toLowerCase().includes('calendly') ? 'calendly' : 'outro',
      usuario_sistema: 'sistema_agendamento',
      descricao: `Agendamento realizado para ${new Date(dataAgendamento).toLocaleString('pt-BR')} via ${plataforma}. ${observacoes || ''}`,
      status_cobranca_resultante: 'negociando'
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra observação manual do usuário
   */
  async registrarObservacao(
    tituloId: string,
    usuario: string,
    observacao: string,
    novoStatus?: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'observacao_manual',
      canal: 'interno',
      usuario_sistema: usuario,
      descricao: observacao,
      status_cobranca_resultante: novoStatus
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra proposta de negociação
   */
  async registrarProposta(
    tituloId: string,
    usuario: string,
    valorProposta: number,
    condicoes: string,
    aceita: boolean = false
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: aceita ? 'proposta_aceita' : 'proposta_enviada',
      canal: 'interno',
      usuario_sistema: usuario,
      descricao: `Proposta ${aceita ? 'aceita' : 'enviada'}: R$ ${valorProposta.toFixed(2)}. Condições: ${condicoes}`,
      status_cobranca_resultante: aceita ? 'negociando' : undefined
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Marca cobrança como quitada
   */
  async marcarComoQuitado(
    tituloId: string,
    usuario: string,
    valorPago: number,
    formaPagamento: string,
    observacoes?: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'marcado_como_quitado',
      canal: 'interno',
      usuario_sistema: usuario,
      descricao: `Cobrança quitada. Valor pago: R$ ${valorPago.toFixed(2)}. Forma: ${formaPagamento}. ${observacoes || ''}`,
      status_cobranca_resultante: 'quitado'
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra importação de planilha
   */
  async registrarImportacaoPlanilha(
    tituloId: string,
    referenciaImportacao: string,
    statusAnterior: string,
    statusNovo: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: statusNovo === 'novo' ? 'novo_titulo' : 'atualizacao_automatica',
      canal: 'interno',
      usuario_sistema: 'sistema_importacao',
      descricao: `Planilha importada (${referenciaImportacao}). Status: ${statusAnterior} → ${statusNovo}`,
      status_cobranca_resultante: statusNovo
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra criação de acordo
   */
  async registrarCriacaoAcordo(
    tituloId: string,
    valorTotal: number,
    quantidadeParcelas: number,
    valorEntrada: number
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'acordo_fechado',
      canal: 'interno',
      usuario_sistema: 'sistema_acordos',
      descricao: `Acordo de parcelamento criado: ${quantidadeParcelas}x + entrada R$ ${valorEntrada.toFixed(2)}. Total: R$ ${valorTotal.toFixed(2)}`,
      status_cobranca_resultante: 'negociando'
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra pagamento de parcela
   */
  async registrarPagamentoParcela(
    tituloId: string,
    numeroParcela: number,
    valorPago: number,
    dataPagamento: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'pagamento_parcial',
      canal: 'interno',
      usuario_sistema: 'sistema_acordos',
      descricao: `Parcela ${numeroParcela} paga: R$ ${valorPago.toFixed(2)} em ${new Date(dataPagamento).toLocaleDateString('pt-BR')}`,
      status_cobranca_resultante: undefined
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra quebra de acordo
   */
  async registrarQuebraAcordo(
    tituloId: string,
    motivo: string,
    parcelaAtrasada: number
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'quebra_acordo',
      canal: 'interno',
      usuario_sistema: 'sistema_acordos',
      descricao: `Acordo quebrado: ${motivo}. Parcela ${parcelaAtrasada} em atraso.`,
      status_cobranca_resultante: 'em_aberto'
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra escalonamento
   */
  async registrarEscalonamento(
    tituloId: string,
    nivel: string,
    motivo: string,
    responsavel: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'escalonamento',
      canal: 'interno',
      usuario_sistema: 'sistema_escalonamento',
      descricao: `Escalonamento para ${nivel}: ${motivo}. Responsável: ${responsavel}`,
      status_cobranca_resultante: nivel === 'juridico' ? 'em_tratativa_juridica' : 'em_tratativa_critica'
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra geração de documento
   */
  async registrarGeracaoDocumento(
    tituloId: string,
    tipoDocumento: string,
    usuario: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'documento_gerado',
      canal: 'interno',
      usuario_sistema: usuario,
      descricao: `Documento gerado: ${tipoDocumento}`,
      status_cobranca_resultante: undefined
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Registra reunião realizada
   */
  async registrarReuniaoRealizada(
    tituloId: string,
    dataReuniao: string,
    resultado: string,
    decisao: string,
    responsavel: string
  ): Promise<void> {
    const tratativa: Omit<TrativativaCobranca, 'id' | 'created_at'> = {
      titulo_id: tituloId,
      tipo_interacao: 'reuniao_realizada',
      canal: 'presencial',
      usuario_sistema: responsavel,
      descricao: `Reunião realizada em ${new Date(dataReuniao).toLocaleDateString('pt-BR')}. Resultado: ${resultado}. Decisão: ${decisao}`,
      status_cobranca_resultante: decisao === 'quitado' ? 'quitado' : decisao === 'parcela_futura' ? 'negociando' : undefined
    };

    await this.registrarTratativa(tratativa);
  }

  /**
   * Busca estatísticas de tratativas
   */
  async buscarEstatisticas(filtros: {
    dataInicio?: string;
    dataFim?: string;
  } = {}) {
    try {
      let query = supabase
        .from('tratativas_cobranca')
        .select('tipo_interacao, canal, status_cobranca_resultante');

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

      // Processa estatísticas
      const stats = {
        totalTratativas: data?.length || 0,
        porTipo: {} as Record<string, number>,
        porCanal: {} as Record<string, number>,
        porStatus: {} as Record<string, number>
      };

      data?.forEach(item => {
        // Por tipo
        stats.porTipo[item.tipo_interacao] = (stats.porTipo[item.tipo_interacao] || 0) + 1;
        
        // Por canal
        stats.porCanal[item.canal] = (stats.porCanal[item.canal] || 0) + 1;
        
        // Por status resultante
        if (item.status_cobranca_resultante) {
          stats.porStatus[item.status_cobranca_resultante] = (stats.porStatus[item.status_cobranca_resultante] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Busca histórico por CNPJ (todas as cobranças da unidade)
   */
  async buscarHistoricoPorCNPJ(cnpj: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('tratativas_cobranca')
        .select(`
          *,
          cobrancas_franqueados!inner (
            id,
            cliente,
            cnpj,
            valor_original,
            valor_atualizado,
            status,
            data_vencimento
          )
        `)
        .eq('cobrancas_franqueados.cnpj', cnpj)
        .order('data_interacao', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar histórico por CNPJ: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar histórico por CNPJ:', error);
      throw error;
    }
  }

  /**
   * Busca resumo de atividades por unidade
   */
  async buscarResumoAtividades(cnpj: string): Promise<{
    ultima_acao: any;
    total_acoes: number;
    status_atual: string;
    ultimo_acordo: any;
    tentativas_negociacao: number;
  }> {
    try {
      const historico = await this.buscarHistoricoPorCNPJ(cnpj);
      
      const ultimaAcao = historico[0] || null;
      const totalAcoes = historico.length;
      
      // Busca status atual da unidade (da cobrança mais recente)
      const { data: cobrancaRecente } = await supabase
        .from('cobrancas_franqueados')
        .select('status')
        .eq('cnpj', cnpj)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Conta tentativas de negociação
      const tentativasNegociacao = historico.filter(h => 
        ['agendamento', 'proposta_enviada', 'reuniao_realizada'].includes(h.tipo_interacao)
      ).length;

      // Busca último acordo
      const { data: ultimoAcordo } = await supabase
        .from('acordos_parcelamento')
        .select('*')
        .eq('cnpj_unidade', cnpj)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        ultima_acao: ultimaAcao,
        total_acoes: totalAcoes,
        status_atual: cobrancaRecente?.status || 'desconhecido',
        ultimo_acordo: ultimoAcordo,
        tentativas_negociacao: tentativasNegociacao
      };
    } catch (error) {
      console.error('Erro ao buscar resumo de atividades:', error);
      return {
        ultima_acao: null,
        total_acoes: 0,
        status_atual: 'desconhecido',
        ultimo_acordo: null,
        tentativas_negociacao: 0
      };
    }
  }

  /**
   * Exporta histórico de tratativas
   */
  async exportarHistorico(tituloId: string): Promise<Blob> {
    try {
      const historico = await this.buscarHistoricoCobranca(tituloId);
      if (!historico) throw new Error('Histórico não encontrado');

      const dados = {
        cobranca: historico.cobranca,
        tratativas: historico.tratativas,
        exportado_em: new Date().toISOString()
      };

      const json = JSON.stringify(dados, null, 2);
      return new Blob([json], { type: 'application/json' });
    } catch (error) {
      console.error('Erro ao exportar histórico:', error);
      throw error;
    }
  }

  /**
   * Exporta histórico por CNPJ
   */
  async exportarHistoricoCNPJ(cnpj: string): Promise<Blob> {
    try {
      const historico = await this.buscarHistoricoPorCNPJ(cnpj);
      const resumo = await this.buscarResumoAtividades(cnpj);

      const dados = {
        cnpj,
        resumo,
        historico_completo: historico,
        exportado_em: new Date().toISOString()
      };

      const json = JSON.stringify(dados, null, 2);
      return new Blob([json], { type: 'application/json' });
    } catch (error) {
      console.error('Erro ao exportar histórico por CNPJ:', error);
      throw error;
    }
  }
}