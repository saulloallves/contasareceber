import { createClient } from '@supabase/supabase-js';
import { OperacaoManual, CobrancaManual, TrativativaManual, NotificacaoManual, CancelamentoManual, FiltrosOperacaoManual, EstatisticasOperacaoManual } from '../types/operacaoManual';
import { CobrancaService } from './cobrancaService';
import { TrativativasService } from './tratativasService';
import { DocumentosService } from './documentosService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class OperacaoManualService {
  private cobrancaService: CobrancaService;
  private tratativasService: TrativativasService;
  private documentosService: DocumentosService;

  constructor() {
    this.cobrancaService = new CobrancaService();
    this.tratativasService = new TrativativasService();
    this.documentosService = new DocumentosService();
  }

  /**
   * Cadastra nova cobrança manualmente
   */
  async cadastrarCobrancaManual(
    dados: CobrancaManual,
    usuario: string,
    justificativa: string
  ): Promise<string> {
    try {
      // Valida dados obrigatórios
      if (!dados.cnpj || !dados.data_vencimento || !dados.valor_original) {
        throw new Error('CNPJ, data de vencimento e valor são obrigatórios');
      }

      // Calcula valor atualizado se não fornecido
      if (!dados.valor_atualizado) {
        const diasAtraso = this.calcularDiasAtraso(dados.data_vencimento);
        dados.valor_atualizado = this.calcularValorAtualizado(dados.valor_original, diasAtraso);
      }

      // Cria a cobrança
      const { data: cobranca, error } = await supabase
        .from('cobrancas_franqueados')
        .insert({
          cnpj: dados.cnpj,
          cliente: dados.codigo_unidade || 'Cadastro Manual',
          valor_original: dados.valor_original,
          valor_atualizado: dados.valor_atualizado,
          data_vencimento: dados.data_vencimento,
          status: dados.status,
          referencia_importacao: `MANUAL_${Date.now()}`,
          hash_titulo: await this.gerarHashManual(dados)
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar cobrança: ${error.message}`);
      }

      // Registra operação manual
      await this.registrarOperacaoManual({
        tipo_operacao: 'cadastro_cobranca',
        usuario,
        cnpj_unidade: dados.cnpj,
        titulo_id: cobranca.id,
        dados_novos: dados,
        justificativa
      });

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        cobranca.id,
        usuario,
        `Cobrança cadastrada manualmente: ${dados.tipo_cobranca} - ${dados.descricao_cobranca}. Justificativa: ${justificativa}`
      );

      return cobranca.id;
    } catch (error) {
      console.error('Erro ao cadastrar cobrança manual:', error);
      throw error;
    }
  }

  /**
   * Edita cobrança existente
   */
  async editarCobranca(
    tituloId: string,
    dadosNovos: Partial<CobrancaManual>,
    usuario: string,
    justificativa: string
  ): Promise<void> {
    try {
      // Busca dados atuais
      const { data: cobrancaAtual, error: errorBusca } = await supabase
        .from('cobrancas_franqueados')
        .select('*')
        .eq('id', tituloId)
        .single();

      if (errorBusca || !cobrancaAtual) {
        throw new Error('Cobrança não encontrada');
      }

      // Atualiza a cobrança
      const { error: errorUpdate } = await supabase
        .from('cobrancas_franqueados')
        .update(dadosNovos)
        .eq('id', tituloId);

      if (errorUpdate) {
        throw new Error(`Erro ao atualizar cobrança: ${errorUpdate.message}`);
      }

      // Registra operação manual
      await this.registrarOperacaoManual({
        tipo_operacao: 'edicao_cobranca',
        usuario,
        cnpj_unidade: cobrancaAtual.cnpj,
        titulo_id: tituloId,
        dados_anteriores: cobrancaAtual,
        dados_novos: dadosNovos,
        justificativa
      });

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        tituloId,
        usuario,
        `Cobrança editada manualmente. Justificativa: ${justificativa}`,
        dadosNovos.status
      );
    } catch (error) {
      console.error('Erro ao editar cobrança:', error);
      throw error;
    }
  }

  /**
   * Registra tratativa manual
   */
  async registrarTrativativaManual(
    dados: TrativativaManual,
    usuario: string
  ): Promise<void> {
    try {
      // Registra na tabela de tratativas
      await this.tratativasService.registrarObservacao(
        dados.titulo_id,
        usuario,
        `Contato ${dados.tipo_contato} em ${new Date(dados.data_contato).toLocaleDateString('pt-BR')}. Resultado: ${dados.resultado_contato}. Detalhes: ${dados.observacoes_detalhadas}`,
        this.mapearResultadoParaStatus(dados.resultado_contato)
      );

      // Se houve negociação, registra os detalhes
      if (dados.valor_negociado && dados.prazo_acordado) {
        await this.tratativasService.registrarProposta(
          dados.titulo_id,
          usuario,
          dados.valor_negociado,
          `Prazo acordado: ${dados.prazo_acordado}`,
          dados.resultado_contato === 'renegociou'
        );
      }

      // Registra operação manual
      await this.registrarOperacaoManual({
        tipo_operacao: 'registro_tratativa',
        usuario,
        cnpj_unidade: '', // Será preenchido via trigger
        titulo_id: dados.titulo_id,
        dados_novos: dados,
        justificativa: `Tratativa manual registrada: ${dados.tipo_contato}`
      });
    } catch (error) {
      console.error('Erro ao registrar tratativa manual:', error);
      throw error;
    }
  }

  /**
   * Gera notificação manual
   */
  async gerarNotificacaoManual(
    dados: NotificacaoManual,
    usuario: string
  ): Promise<string> {
    try {
      // Mapeia tipo para tipo de documento
      const tipoDocumento = this.mapearTipoNotificacao(dados.tipo_notificacao);
      
      // Gera o documento
      const documento = await this.documentosService.gerarDocumento(
        dados.titulo_id,
        tipoDocumento,
        usuario
      );

      // Registra operação manual
      await this.registrarOperacaoManual({
        tipo_operacao: 'geracao_notificacao',
        usuario,
        cnpj_unidade: '', // Será preenchido via trigger
        titulo_id: dados.titulo_id,
        dados_novos: dados,
        justificativa: `Notificação ${dados.tipo_notificacao} gerada manualmente`
      });

      return documento.id!;
    } catch (error) {
      console.error('Erro ao gerar notificação manual:', error);
      throw error;
    }
  }

  /**
   * Cancela cobrança manualmente
   */
  async cancelarCobranca(
    dados: CancelamentoManual,
    usuario: string
  ): Promise<void> {
    try {
      // Busca dados atuais
      const { data: cobrancaAtual, error: errorBusca } = await supabase
        .from('cobrancas_franqueados')
        .select('*')
        .eq('id', dados.titulo_id)
        .single();

      if (errorBusca || !cobrancaAtual) {
        throw new Error('Cobrança não encontrada');
      }

      // Atualiza status para cancelado
      const { error: errorUpdate } = await supabase
        .from('cobrancas_franqueados')
        .update({ 
          status: 'cancelado',
          valor_recebido: cobrancaAtual.valor_original // Marca como "pago" para fins de cálculo
        })
        .eq('id', dados.titulo_id);

      if (errorUpdate) {
        throw new Error(`Erro ao cancelar cobrança: ${errorUpdate.message}`);
      }

      // Registra operação manual
      await this.registrarOperacaoManual({
        tipo_operacao: 'cancelamento',
        usuario,
        cnpj_unidade: cobrancaAtual.cnpj,
        titulo_id: dados.titulo_id,
        dados_anteriores: cobrancaAtual,
        dados_novos: dados,
        justificativa: dados.justificativa_detalhada
      });

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        dados.titulo_id,
        usuario,
        `Cobrança cancelada manualmente. Motivo: ${dados.motivo_cancelamento}. Justificativa: ${dados.justificativa_detalhada}`,
        'cancelado'
      );

      // Se requer aprovação, notifica superiores
      if (dados.aprovacao_necessaria) {
        await this.notificarAprovacao(dados, usuario);
      }
    } catch (error) {
      console.error('Erro ao cancelar cobrança:', error);
      throw error;
    }
  }

  /**
   * Quita cobrança manualmente
   */
  async quitarCobrancaManual(
    tituloId: string,
    valorPago: number,
    formaPagamento: string,
    dataRecebimento: string,
    usuario: string,
    observacoes?: string
  ): Promise<void> {
    try {
      // Atualiza a cobrança
      const { error } = await supabase
        .from('cobrancas_franqueados')
        .update({
          status: 'quitado',
          valor_recebido: valorPago,
          data_ultima_atualizacao: dataRecebimento
        })
        .eq('id', tituloId);

      if (error) {
        throw new Error(`Erro ao quitar cobrança: ${error.message}`);
      }

      // Registra tratativa
      await this.tratativasService.marcarComoQuitado(
        tituloId,
        usuario,
        valorPago,
        formaPagamento,
        observacoes
      );

      // Registra operação manual
      await this.registrarOperacaoManual({
        tipo_operacao: 'quitacao_manual',
        usuario,
        cnpj_unidade: '', // Será preenchido via trigger
        titulo_id: tituloId,
        dados_novos: { valorPago, formaPagamento, dataRecebimento },
        justificativa: `Quitação manual registrada. ${observacoes || ''}`
      });
    } catch (error) {
      console.error('Erro ao quitar cobrança manual:', error);
      throw error;
    }
  }

  /**
   * Busca operações manuais com filtros
   */
  async buscarOperacoesManuais(filtros: FiltrosOperacaoManual = {}) {
    try {
      let query = supabase
        .from('operacoes_manuais')
        .select(`
          *,
          cobrancas_franqueados (
            cliente,
            cnpj,
            valor_original,
            status
          )
        `)
        .order('data_operacao', { ascending: false });

      if (filtros.tipo_operacao) {
        query = query.eq('tipo_operacao', filtros.tipo_operacao);
      }

      if (filtros.usuario) {
        query = query.ilike('usuario', `%${filtros.usuario}%`);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_operacao', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_operacao', filtros.dataFim);
      }

      if (filtros.cnpj) {
        query = query.ilike('cnpj_unidade', `%${filtros.cnpj}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar operações: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar operações manuais:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas das operações manuais
   */
  async buscarEstatisticasOperacoes(filtros: FiltrosOperacaoManual = {}): Promise<EstatisticasOperacaoManual> {
    try {
      let query = supabase
        .from('operacoes_manuais')
        .select('tipo_operacao, usuario, dados_novos');

      // Aplica filtros
      if (filtros.dataInicio) {
        query = query.gte('data_operacao', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data_operacao', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
      }

      const stats: EstatisticasOperacaoManual = {
        total_operacoes: data?.length || 0,
        por_tipo: {},
        por_usuario: {},
        valor_total_impactado: 0,
        operacoes_pendentes_aprovacao: 0
      };

      data?.forEach(op => {
        // Por tipo
        stats.por_tipo[op.tipo_operacao] = (stats.por_tipo[op.tipo_operacao] || 0) + 1;
        
        // Por usuário
        stats.por_usuario[op.usuario] = (stats.por_usuario[op.usuario] || 0) + 1;
        
        // Valor impactado
        if (op.dados_novos?.valor_original) {
          stats.valor_total_impactado += op.dados_novos.valor_original;
        }
        if (op.dados_novos?.valorPago) {
          stats.valor_total_impactado += op.dados_novos.valorPago;
        }
      });

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Registra operação manual no log
   */
  private async registrarOperacaoManual(operacao: Omit<OperacaoManual, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('operacoes_manuais')
        .insert({
          ...operacao,
          ip_origem: 'unknown', // Em produção, capturar IP real
          data_operacao: new Date().toISOString()
        });

      if (error) {
        console.error('Erro ao registrar operação manual:', error);
      }
    } catch (error) {
      console.error('Erro ao registrar operação manual:', error);
    }
  }

  /**
   * Calcula dias em atraso
   */
  private calcularDiasAtraso(dataVencimento: string): number {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = hoje.getTime() - vencimento.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }

  /**
   * Calcula valor atualizado com juros e multa
   */
  private calcularValorAtualizado(valorOriginal: number, diasAtraso: number): number {
    if (diasAtraso <= 0) return valorOriginal;
    
    const percentualMulta = 2.0; // 2%
    const percentualJurosDia = 0.033; // 0.033% ao dia
    
    const multa = valorOriginal * (percentualMulta / 100);
    const juros = valorOriginal * (percentualJurosDia / 100) * diasAtraso;
    
    return valorOriginal + multa + juros;
  }

  /**
   * Gera hash para cobrança manual
   */
  private async gerarHashManual(dados: CobrancaManual): Promise<string> {
    const stringParaHash = `${dados.cnpj}|${dados.valor_original}|${dados.data_vencimento}|MANUAL_${Date.now()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(stringParaHash);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Mapeia resultado de contato para status
   */
  private mapearResultadoParaStatus(resultado: string): string | undefined {
    const mapeamento: Record<string, string> = {
      'quitou': 'quitado',
      'renegociou': 'negociando',
      'prometeu_pagamento': 'negociando',
      'contestou': 'em_aberto',
      'nao_respondeu': 'em_aberto'
    };
    return mapeamento[resultado];
  }

  /**
   * Mapeia tipo de notificação para tipo de documento
   */
  private mapearTipoNotificacao(tipo: string): any {
    const mapeamento: Record<string, string> = {
      'advertencia': 'notificacao_vencimento',
      'reforco': 'notificacao_inadimplencia',
      'ultimo_aviso': 'notificacao_ausencia_tratativas',
      'formal_juridica': 'notificacao_quebra_acordo',
      'encerramento': 'carta_encerramento'
    };
    return mapeamento[tipo] || 'notificacao_inadimplencia';
  }

  /**
   * Notifica superiores para aprovação
   */
  private async notificarAprovacao(dados: CancelamentoManual, usuario: string): Promise<void> {
    // Em produção, integrar com sistema de notificação real
    console.log(`Notificação de aprovação necessária:`, {
      operacao: 'cancelamento',
      usuario,
      valor: dados.valor_cancelado,
      motivo: dados.motivo_cancelamento
    });
  }

  /**
   * Exporta log de operações manuais
   */
  async exportarLogOperacoes(filtros: FiltrosOperacaoManual = {}): Promise<string> {
    try {
      const operacoes = await this.buscarOperacoesManuais(filtros);
      
      // Cabeçalho CSV
      const cabecalho = [
        'Data/Hora',
        'Tipo Operação',
        'Usuário',
        'CNPJ',
        'Título ID',
        'Justificativa',
        'Aprovado Por',
        'IP Origem'
      ].join(',');

      // Dados
      const linhas = operacoes.map(op => [
        new Date(op.data_operacao).toLocaleString('pt-BR'),
        op.tipo_operacao,
        op.usuario,
        op.cnpj_unidade,
        op.titulo_id || '',
        (op.justificativa || '').replace(/,/g, ';'),
        op.aprovado_por || '',
        op.ip_origem || ''
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar log:', error);
      throw error;
    }
  }
}