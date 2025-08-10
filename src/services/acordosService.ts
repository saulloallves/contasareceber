import { supabase } from './databaseService';
import { AcordoParcelamento, ParcelaAcordo, SimulacaoParcelamento, ConfiguracaoAcordos, HistoricoAceite, FiltrosAcordos, EstatisticasAcordos, ValidacaoAcordo } from '../types/acordos';
import { TrativativasService } from './tratativasService';

export class AcordosService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Simula parcelamento para um débito
   */
  async simularParcelamento(
    tituloId: string,
    quantidadeParcelas: number,
    valorEntrada?: number
  ): Promise<SimulacaoParcelamento> {
    try {
      // Busca dados da cobrança
      const { data: cobranca, error } = await supabase
        .from('cobrancas_franqueados')
        .select('*')
        .eq('id', tituloId)
        .maybeSingle();

      if (error || !cobranca) {
        throw new Error('Cobrança não encontrada');
      }

      // Busca configurações
      const config = await this.buscarConfiguracaoAcordos();

      // Calcula valor atualizado
      const valorAtualizado = this.calcularValorAtualizado(
        cobranca.valor_original,
        cobranca.dias_em_atraso || 0,
        config
      );

      // Valida parâmetros
      if (quantidadeParcelas > config.quantidade_maxima_parcelas) {
        throw new Error(`Máximo de ${config.quantidade_maxima_parcelas} parcelas permitidas`);
      }

      // Calcula entrada
      const entradaMinima = valorAtualizado * (config.percentual_entrada_minimo / 100);
      const entradaCalculada = valorEntrada || entradaMinima;

      if (entradaCalculada < entradaMinima) {
        throw new Error(`Entrada mínima de ${config.percentual_entrada_minimo}%`);
      }

      // Calcula parcelas
      const valorParcelar = valorAtualizado - entradaCalculada;
      const valorParcela = valorParcelar / quantidadeParcelas;

      if (valorParcela < config.valor_parcela_minimo) {
        throw new Error(`Valor mínimo da parcela: R$ ${config.valor_parcela_minimo}`);
      }

      // Gera cronograma
      const dataEntrada = new Date();
      dataEntrada.setDate(dataEntrada.getDate() + config.dias_vencimento_entrada);

      const dataPrimeiraParcela = new Date(dataEntrada);
      dataPrimeiraParcela.setDate(dataPrimeiraParcela.getDate() + config.dias_entre_parcelas);

      const parcelas = [];
      for (let i = 1; i <= quantidadeParcelas; i++) {
        const dataVencimento = new Date(dataPrimeiraParcela);
        dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));

        parcelas.push({
          numero: i,
          valor: valorParcela,
          vencimento: dataVencimento.toISOString().split('T')[0]
        });
      }

      // Calcula economia com desconto na entrada
      const economiaDesconto = entradaCalculada > entradaMinima 
        ? (entradaCalculada - entradaMinima) * (config.percentual_desconto_entrada / 100)
        : 0;

      const valorTotalAcordo = entradaCalculada + (valorParcela * quantidadeParcelas) - economiaDesconto;

      return {
        valor_original: cobranca.valor_original,
        valor_atualizado: valorAtualizado,
        valor_entrada: entradaCalculada,
        quantidade_parcelas: quantidadeParcelas,
        valor_parcela: valorParcela,
        valor_total_acordo: valorTotalAcordo,
        data_entrada: dataEntrada.toISOString().split('T')[0],
        data_primeira_parcela: dataPrimeiraParcela.toISOString().split('T')[0],
        parcelas,
        economia_desconto: economiaDesconto,
        juros_parcelamento: valorTotalAcordo - valorAtualizado
      };
    } catch (error) {
      console.error('Erro ao simular parcelamento:', error);
      throw error;
    }
  }

  /**
   * Cria acordo de parcelamento
   */
  async criarAcordo(
    tituloId: string,
    simulacao: SimulacaoParcelamento,
    observacoes?: string
  ): Promise<AcordoParcelamento> {
    try {
      // Busca dados da cobrança
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('cnpj')
        .eq('id', tituloId)
        .single();

      if (!cobranca) {
        throw new Error('Cobrança não encontrada');
      }

      // Valida se pode fazer acordo
      const validacao = await this.validarAcordo(cobranca.cnpj);
      if (!validacao.pode_fazer_acordo) {
        throw new Error(validacao.motivo_bloqueio || 'Não é possível fazer acordo');
      }

      // Cria o acordo
      const acordo: Omit<AcordoParcelamento, 'id' | 'created_at' | 'updated_at'> = {
        titulo_id: tituloId,
        cnpj_unidade: cobranca.cnpj,
        valor_original: simulacao.valor_original,
        valor_atualizado: simulacao.valor_atualizado,
        valor_entrada: simulacao.valor_entrada,
        quantidade_parcelas: simulacao.quantidade_parcelas,
        valor_parcela: simulacao.valor_parcela,
        valor_total_acordo: simulacao.valor_total_acordo,
        data_vencimento_entrada: simulacao.data_entrada,
        data_primeiro_vencimento: simulacao.data_primeira_parcela,
        status_acordo: 'proposto',
        observacoes
      };

      const { data: acordoCriado, error } = await supabase
        .from('acordos_parcelamento')
        .insert(acordo)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar acordo: ${error.message}`);
      }

      // Cria as parcelas
      await this.criarParcelas(acordoCriado.id!, simulacao);

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        tituloId,
        'sistema_acordos',
        `Acordo de parcelamento criado: ${simulacao.quantidade_parcelas}x de R$ ${simulacao.valor_parcela.toFixed(2)} + entrada de R$ ${simulacao.valor_entrada.toFixed(2)}`,
        'negociando'
      );

      return acordoCriado;
    } catch (error) {
      console.error('Erro ao criar acordo:', error);
      throw error;
    }
  }

  /**
   * Renegociar acordo existente
   */
  async renegociarAcordo(
    acordoId: string,
    novaQuantidadeParcelas: number,
    novoValorEntrada: number,
    justificativa: string,
    aprovadoPor: string
  ): Promise<AcordoParcelamento> {
    try {
      // Busca acordo atual
      const { data: acordoAtual, error: errorBusca } = await supabase
        .from('acordos_parcelamento')
        .select(`
          *,
          cobrancas_franqueados (
            id,
            valor_original,
            valor_atualizado,
            cnpj
          )
        `)
        .eq('id', acordoId)
        .single();

      if (errorBusca || !acordoAtual) {
        throw new Error('Acordo não encontrado');
      }

      // Valida se pode renegociar
      if (!['aceito', 'cumprindo'].includes(acordoAtual.status_acordo)) {
        throw new Error('Apenas acordos aceitos ou em cumprimento podem ser renegociados');
      }

      // Simula novo parcelamento
      const novaSimulacao = await this.simularParcelamento(
        acordoAtual.titulo_id,
        novaQuantidadeParcelas,
        novoValorEntrada
      );

      // Arquiva acordo anterior
      const { error: errorArquivar } = await supabase
        .from('acordos_parcelamento')
        .update({
          status_acordo: 'renegociado',
          observacoes: `Renegociado em ${new Date().toLocaleDateString('pt-BR')}. Justificativa: ${justificativa}. Aprovado por: ${aprovadoPor}`
        })
        .eq('id', acordoId);

      if (errorArquivar) {
        throw new Error(`Erro ao arquivar acordo anterior: ${errorArquivar.message}`);
      }

      // Cria novo acordo
      const novoAcordo: Omit<AcordoParcelamento, 'id' | 'created_at' | 'updated_at'> = {
        titulo_id: acordoAtual.titulo_id,
        cnpj_unidade: acordoAtual.cnpj_unidade,
        valor_original: novaSimulacao.valor_original,
        valor_atualizado: novaSimulacao.valor_atualizado,
        valor_entrada: novaSimulacao.valor_entrada,
        quantidade_parcelas: novaSimulacao.quantidade_parcelas,
        valor_parcela: novaSimulacao.valor_parcela,
        valor_total_acordo: novaSimulacao.valor_total_acordo,
        data_vencimento_entrada: novaSimulacao.data_entrada,
        data_primeiro_vencimento: novaSimulacao.data_primeira_parcela,
        status_acordo: 'proposto',
        observacoes: `Renegociação do acordo ${acordoId}. ${justificativa}`,
        acordo_anterior_id: acordoId
      };

      const { data: acordoCriado, error: errorCriar } = await supabase
        .from('acordos_parcelamento')
        .insert(novoAcordo)
        .select()
        .single();

      if (errorCriar) {
        throw new Error(`Erro ao criar novo acordo: ${errorCriar.message}`);
      }

      // Cria as parcelas do novo acordo
      await this.criarParcelas(acordoCriado.id!, novaSimulacao);

      // Registra histórico de renegociação
      await supabase
        .from('historico_renegociacoes')
        .insert({
          acordo_anterior_id: acordoId,
          acordo_novo_id: acordoCriado.id,
          justificativa,
          aprovado_por: aprovadoPor,
          data_renegociacao: new Date().toISOString(),
          valor_anterior: acordoAtual.valor_total_acordo,
          valor_novo: novaSimulacao.valor_total_acordo
        });

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        acordoAtual.titulo_id,
        'sistema_acordos',
        `Acordo renegociado: ${novaSimulacao.quantidade_parcelas}x de R$ ${novaSimulacao.valor_parcela.toFixed(2)} + entrada de R$ ${novaSimulacao.valor_entrada.toFixed(2)}. Justificativa: ${justificativa}. Aprovado por: ${aprovadoPor}`,
        'negociando'
      );

      return acordoCriado;
    } catch (error) {
      console.error('Erro ao renegociar acordo:', error);
      throw error;
    }
  }

  /**
   * Registra aceite do acordo
   */
  async registrarAceite(
    acordoId: string,
    metodoAceite: HistoricoAceite['metodo_aceite'],
    ipAceite: string,
    userAgent?: string,
    aceitoPor?: string
  ): Promise<void> {
    try {
      // Atualiza status do acordo
      const { error: errorAcordo } = await supabase
        .from('acordos_parcelamento')
        .update({
          status_acordo: 'aceito',
          aceito_em: new Date().toISOString(),
          aceito_por: aceitoPor,
          ip_aceite: ipAceite
        })
        .eq('id', acordoId);

      if (errorAcordo) {
        throw new Error(`Erro ao atualizar acordo: ${errorAcordo.message}`);
      }

      // Registra histórico de aceite
      const { data: acordo } = await supabase
        .from('acordos_parcelamento')
        .select('cnpj_unidade, titulo_id')
        .eq('id', acordoId)
        .single();

      if (acordo) {
        const historicoAceite: Omit<HistoricoAceite, 'id' | 'created_at'> = {
          acordo_id: acordoId,
          cnpj_unidade: acordo.cnpj_unidade,
          data_aceite: new Date().toISOString(),
          ip_aceite: ipAceite,
          user_agent: userAgent,
          metodo_aceite: metodoAceite
        };

        await supabase
          .from('historico_aceites')
          .insert(historicoAceite);

        // Registra tratativa
        await this.tratativasService.registrarObservacao(
          acordo.titulo_id,
          aceitoPor || 'franqueado',
          `Acordo aceito via ${metodoAceite}. IP: ${ipAceite}`,
          'negociando'
        );

        // Gera boletos automaticamente
        await this.gerarBoletos(acordoId);
      }
    } catch (error) {
      console.error('Erro ao registrar aceite:', error);
      throw error;
    }
  }

  /**
   * Gera boletos para as parcelas
   */
  private async gerarBoletos(acordoId: string): Promise<void> {
    try {
      // Busca parcelas do acordo
      const { data: parcelas } = await supabase
        .from('parcelas_acordo')
        .select('*')
        .eq('acordo_id', acordoId)
        .order('numero_parcela');

      if (!parcelas) return;

      // Busca dados do acordo
      const { data: acordo } = await supabase
        .from('acordos_parcelamento')
        .select(`
          *,
          cobrancas_franqueados (
            cliente,
            cnpj
          )
        `)
        .eq('id', acordoId)
        .single();

      if (!acordo) return;

      // Gera boleto para entrada
      if (acordo.valor_entrada > 0) {
        const boletoEntrada = await this.gerarBoletoIndividual({
          valor: acordo.valor_entrada,
          vencimento: acordo.data_vencimento_entrada,
          descricao: 'Entrada do acordo de parcelamento',
          cliente: (acordo as any).cobrancas_franqueados.cliente,
          cnpj: (acordo as any).cobrancas_franqueados.cnpj
        });

        // Atualiza acordo com boleto da entrada
        await supabase
          .from('acordos_parcelamento')
          .update({ boleto_entrada_url: boletoEntrada.url })
          .eq('id', acordoId);
      }

      // Gera boletos para parcelas
      for (const parcela of parcelas) {
        const boleto = await this.gerarBoletoIndividual({
          valor: parcela.valor_parcela,
          vencimento: parcela.data_vencimento,
          descricao: `Parcela ${parcela.numero_parcela}/${acordo.quantidade_parcelas} - Acordo de Parcelamento`,
          cliente: (acordo as any).cobrancas_franqueados.cliente,
          cnpj: (acordo as any).cobrancas_franqueados.cnpj
        });

        // Atualiza parcela com dados do boleto
        await supabase
          .from('parcelas_acordo')
          .update({
            boleto_url: boleto.url,
            boleto_codigo: boleto.codigo
          })
          .eq('id', parcela.id);
      }
    } catch (error) {
      console.error('Erro ao gerar boletos:', error);
    }
  }

  /**
   * Gera boleto individual (simulado)
   */
  private async gerarBoletoIndividual(dados: {
    valor: number;
    vencimento: string;
    descricao: string;
    cliente: string;
    cnpj: string;
  }): Promise<{ url: string; codigo: string }> {
    // Em produção, integrar com API real de boletos (Asaas, Iugu, PJBank)
    const codigo = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const url = `https://boletos.exemplo.com/${codigo}`;
    
    console.log('Boleto gerado:', { ...dados, codigo, url });
    
    return { url, codigo };
  }

  /**
   * Registra pagamento de parcela
   */
  async registrarPagamentoParcela(
    parcelaId: string,
    valorPago: number,
    dataPagamento: string
  ): Promise<void> {
    try {
      // Atualiza parcela
      const { error } = await supabase
        .from('parcelas_acordo')
        .update({
          status_parcela: 'pago',
          valor_pago: valorPago,
          data_pagamento: dataPagamento
        })
        .eq('id', parcelaId);

      if (error) {
        throw new Error(`Erro ao registrar pagamento: ${error.message}`);
      }

      // Verifica se acordo foi cumprido totalmente
      await this.verificarCumprimentoAcordo(parcelaId);
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      throw error;
    }
  }

  /**
   * Verifica cumprimento total do acordo
   */
  private async verificarCumprimentoAcordo(parcelaId: string): Promise<void> {
    try {
      // Busca acordo da parcela
      const { data: parcela } = await supabase
        .from('parcelas_acordo')
        .select('acordo_id')
        .eq('id', parcelaId)
        .single();

      if (!parcela) return;

      // Verifica se todas as parcelas foram pagas
      const { data: parcelas } = await supabase
        .from('parcelas_acordo')
        .select('status_parcela')
        .eq('acordo_id', parcela.acordo_id);

      const todasPagas = parcelas?.every(p => p.status_parcela === 'pago');

      if (todasPagas) {
        // Marca acordo como cumprido
        await supabase
          .from('acordos_parcelamento')
          .update({ status_acordo: 'cumprido' })
          .eq('id', parcela.acordo_id);

        // Busca título para registrar tratativa
        const { data: acordo } = await supabase
          .from('acordos_parcelamento')
          .select('titulo_id')
          .eq('id', parcela.acordo_id)
          .single();

        if (acordo) {
          await this.tratativasService.registrarObservacao(
            acordo.titulo_id,
            'sistema_acordos',
            'Acordo de parcelamento cumprido integralmente',
            'quitado'
          );
        }
      }
    } catch (error) {
      console.error('Erro ao verificar cumprimento:', error);
    }
  }

  /**
   * Verifica parcelas em atraso
   */
  async verificarParcelasAtrasadas(): Promise<void> {
    try {
      const hoje = new Date().toISOString().split('T')[0];

      // Busca parcelas vencidas não pagas
      const { data: parcelasAtrasadas } = await supabase
        .from('parcelas_acordo')
        .select(`
          *,
          acordos_parcelamento (
            cnpj_unidade,
            titulo_id
          )
        `)
        .eq('status_parcela', 'pendente')
        .lt('data_vencimento', hoje);

      if (!parcelasAtrasadas) return;

      for (const parcela of parcelasAtrasadas) {
        // Calcula dias de atraso
        const vencimento = new Date(parcela.data_vencimento);
        const agora = new Date();
        const diasAtraso = Math.floor((agora.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

        // Atualiza status da parcela
        await supabase
          .from('parcelas_acordo')
          .update({
            status_parcela: 'atrasado',
            dias_atraso: diasAtraso
          })
          .eq('id', parcela.id);

        // Se atraso > 15 dias, quebra o acordo
        if (diasAtraso > 15) {
          await this.quebrarAcordo(parcela.acordo_id, `Parcela ${parcela.numero_parcela} em atraso há ${diasAtraso} dias`);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar parcelas atrasadas:', error);
    }
  }

  /**
   * Quebra acordo por descumprimento
   */
  private async quebrarAcordo(acordoId: string, motivo: string): Promise<void> {
    try {
      // Atualiza status do acordo
      await supabase
        .from('acordos_parcelamento')
        .update({
          status_acordo: 'quebrado',
          observacoes: motivo
        })
        .eq('id', acordoId);

      // Busca dados do acordo
      const { data: acordo } = await supabase
        .from('acordos_parcelamento')
        .select('titulo_id, cnpj_unidade')
        .eq('id', acordoId)
        .single();

      if (acordo) {
        // Registra tratativa
        await this.tratativasService.registrarObservacao(
          acordo.titulo_id,
          'sistema_acordos',
          `Acordo quebrado: ${motivo}`,
          'em_aberto'
        );

        // Adiciona pontos de risco
        await this.adicionarPontosRisco(acordo.cnpj_unidade, 'parcelamento_quebrado');
      }
    } catch (error) {
      console.error('Erro ao quebrar acordo:', error);
    }
  }

  /**
   * Busca acordos com filtros
   */
  async buscarAcordos(filtros: FiltrosAcordos = {}) {
    try {
      let query = supabase
        .from('acordos_parcelamento')
        .select(`
          *,
          cobrancas_franqueados (
            cliente,
            cnpj,
            valor_original
          ),
          parcelas_acordo (
            numero_parcela,
            valor_parcela,
            data_vencimento,
            status_parcela
          )
        `)
        .order('created_at', { ascending: false });

      if (filtros.status_acordo) {
        query = query.eq('status_acordo', filtros.status_acordo);
      }

      if (filtros.cnpj) {
        query = query.ilike('cnpj_unidade', `%${filtros.cnpj}%`);
      }

      if (filtros.dataInicio) {
        query = query.gte('created_at', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('created_at', filtros.dataFim);
      }

      if (filtros.valor_min) {
        query = query.gte('valor_total_acordo', filtros.valor_min);
      }

      if (filtros.valor_max) {
        query = query.lte('valor_total_acordo', filtros.valor_max);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar acordos: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar acordos:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas dos acordos
   */
  async buscarEstatisticasAcordos(): Promise<EstatisticasAcordos> {
    try {
      const { data: acordos } = await supabase
        .from('acordos_parcelamento')
        .select('status_acordo, valor_total_acordo, created_at, aceito_em');

      const { data: parcelas } = await supabase
        .from('parcelas_acordo')
        .select('valor_pago, status_parcela');

      const stats: EstatisticasAcordos = {
        total_acordos: acordos?.length || 0,
        acordos_ativos: acordos?.filter(a => a.status_acordo === 'cumprindo').length || 0,
        acordos_cumpridos: acordos?.filter(a => a.status_acordo === 'cumprido').length || 0,
        acordos_quebrados: acordos?.filter(a => a.status_acordo === 'quebrado').length || 0,
        valor_total_acordado: acordos?.reduce((sum, a) => sum + a.valor_total_acordo, 0) || 0,
        valor_total_recebido: parcelas?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0,
        taxa_cumprimento: 0,
        tempo_medio_cumprimento: 0
      };

      // Calcula taxa de cumprimento
      const acordosFinalizados = stats.acordos_cumpridos + stats.acordos_quebrados;
      if (acordosFinalizados > 0) {
        stats.taxa_cumprimento = (stats.acordos_cumpridos / acordosFinalizados) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Valida se unidade pode fazer acordo
   */
  private async validarAcordo(cnpjUnidade: string): Promise<ValidacaoAcordo> {
    try {
      const { data: acordos } = await supabase
        .from('acordos_parcelamento')
        .select('*')
        .eq('cnpj_unidade', cnpjUnidade)
        .order('created_at', { ascending: false });

      const acordosQuebrados = acordos?.filter(a => a.status_acordo === 'quebrado').length || 0;
      const acordoAtivo = acordos?.find(a => ['aceito', 'cumprindo'].includes(a.status_acordo));

      // Regras de validação
      if (acordoAtivo) {
        return {
          pode_fazer_acordo: false,
          motivo_bloqueio: 'Já possui acordo ativo em andamento',
          acordos_anteriores: acordos?.length || 0,
          acordos_quebrados: acordosQuebrados,
          ultimo_acordo: acordoAtivo
        };
      }

      if (acordosQuebrados >= 2) {
        return {
          pode_fazer_acordo: false,
          motivo_bloqueio: 'Unidade em blacklist por 2 acordos quebrados',
          acordos_anteriores: acordos?.length || 0,
          acordos_quebrados: acordosQuebrados
        };
      }

      return {
        pode_fazer_acordo: true,
        acordos_anteriores: acordos?.length || 0,
        acordos_quebrados: acordosQuebrados
      };
    } catch (error) {
      console.error('Erro ao validar acordo:', error);
      return {
        pode_fazer_acordo: false,
        motivo_bloqueio: 'Erro interno do sistema',
        acordos_anteriores: 0,
        acordos_quebrados: 0
      };
    }
  }

  /**
   * Cria parcelas do acordo
   */
  private async criarParcelas(acordoId: string, simulacao: SimulacaoParcelamento): Promise<void> {
    const parcelas = simulacao.parcelas.map(p => ({
      acordo_id: acordoId,
      numero_parcela: p.numero,
      valor_parcela: p.valor,
      data_vencimento: p.vencimento,
      status_parcela: 'pendente' as const
    }));

    const { error } = await supabase
      .from('parcelas_acordo')
      .insert(parcelas);

    if (error) {
      throw new Error(`Erro ao criar parcelas: ${error.message}`);
    }
  }

  /**
   * Busca configuração de acordos
   */
  private async buscarConfiguracaoAcordos(): Promise<ConfiguracaoAcordos> {
    const { data, error } = await supabase
      .from('configuracao_acordos')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      // Retorna configuração padrão
      return {
        id: 'default',
        percentual_entrada_minimo: 20,
        valor_parcela_minimo: 300,
        quantidade_maxima_parcelas: 6,
        percentual_multa: 10,
        percentual_juros_mes: 1,
        percentual_desconto_entrada: 5,
        dias_vencimento_entrada: 7,
        dias_entre_parcelas: 30,
        permite_renegociacao: true,
        max_acordos_quebrados: 2
      };
    }

    return data;
  }

  /**
   * Calcula valor atualizado com juros e multa
   */
  private calcularValorAtualizado(
    valorOriginal: number,
    diasAtraso: number,
    config: ConfiguracaoAcordos
  ): number {
    if (diasAtraso <= 0) return valorOriginal;

    const multa = valorOriginal * (config.percentual_multa / 100);
    const jurosMensal = valorOriginal * (config.percentual_juros_mes / 100);
    const jurosProporcional = (jurosMensal / 30) * diasAtraso;

    return valorOriginal + multa + jurosProporcional;
  }

  /**
   * Adiciona pontos de risco (integração com sistema de escalonamento)
   */
  private async adicionarPontosRisco(cnpjUnidade: string, tipoEvento: string): Promise<void> {
    try {
      // Em produção, integrar com EscalonamentoService
      console.log(`Adicionando pontos de risco para ${cnpjUnidade}: ${tipoEvento}`);
    } catch (error) {
      console.error('Erro ao adicionar pontos de risco:', error);
    }
  }

  /**
   * Exporta dados dos acordos
   */
  async exportarAcordos(filtros: FiltrosAcordos = {}): Promise<string> {
    try {
      const acordos = await this.buscarAcordos(filtros);
      
      // Cabeçalho CSV
      const cabecalho = [
        'Data Criação',
        'Cliente',
        'CNPJ',
        'Valor Original',
        'Valor Atualizado',
        'Valor Entrada',
        'Quantidade Parcelas',
        'Valor Parcela',
        'Valor Total',
        'Status',
        'Data Aceite'
      ].join(',');

      // Dados
      const linhas = acordos.map(acordo => [
        new Date(acordo.created_at!).toLocaleDateString('pt-BR'),
        (acordo as any).cobrancas_franqueados?.cliente || '',
        acordo.cnpj_unidade,
        acordo.valor_original.toFixed(2),
        acordo.valor_atualizado.toFixed(2),
        acordo.valor_entrada.toFixed(2),
        acordo.quantidade_parcelas,
        acordo.valor_parcela.toFixed(2),
        acordo.valor_total_acordo.toFixed(2),
        acordo.status_acordo,
        acordo.aceito_em ? new Date(acordo.aceito_em).toLocaleDateString('pt-BR') : ''
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar acordos:', error);
      throw error;
    }
  }
}