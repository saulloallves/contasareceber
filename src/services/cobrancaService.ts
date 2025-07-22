import { createClient } from '@supabase/supabase-js';
import { CobrancaFranqueado, ImportacaoPlanilha, DadosPlanilha, ResultadoImportacao } from '../types/cobranca';
import { gerarReferenciaLinha, normalizarData } from '../utils/planilhaProcessor';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class CobrancaService {
  /**
   * Processa importação de planilha e atualiza banco de dados
   */
  async processarImportacaoPlanilha(
    dadosPlanilha: DadosPlanilha[],
    nomeArquivo: string,
    usuario: string
  ): Promise<ResultadoImportacao> {
    const referenciaImportacao = `IMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const erros: string[] = [];
    
    try {
      // 1. Busca configurações do sistema
      const configuracoes = await this.buscarConfiguracoes();
      
      // 2. Cria registro de importação
      const { data: importacao, error: errorImportacao } = await supabase
        .from('importacoes_planilha')
        .insert({
          usuario,
          arquivo_nome: nomeArquivo,
          referencia: referenciaImportacao,
          total_registros: dadosPlanilha.length
        })
        .select()
        .single();

      if (errorImportacao) {
        throw new Error(`Erro ao criar registro de importação: ${errorImportacao.message}`);
      }

      // 3. Processa cada registro da planilha
      const referenciasNovaPlanilha = new Set<string>();
      let novosRegistros = 0;
      let registrosAtualizados = 0;

      for (const [index, dados] of dadosPlanilha.entries()) {
        try {
          // Gera referência única para a linha
          const referenciaLinha = gerarReferenciaLinha(dados);
          referenciasNovaPlanilha.add(referenciaLinha);

          // Busca unidade pelo CNPJ
          const unidadeId = await this.buscarUnidadePorCNPJ(dados.cnpj);
          if (!unidadeId) {
            erros.push(`Linha ${index + 1}: CNPJ não encontrado - ${dados.cnpj}`);
            continue;
          }

          // Verifica se cobrança já existe
          const { data: cobrancaExistente } = await supabase
            .from('cobrancas')
            .select('*')
            .eq('linha_referencia_importada', referenciaLinha)
            .single();

          if (cobrancaExistente) {
            // Atualiza cobrança existente
            await this.atualizarCobrancaExistente(cobrancaExistente, dados, configuracoes, referenciaImportacao);
            registrosAtualizados++;
          } else {
            // Insere nova cobrança
            await this.inserirNovaCobranca(dados, unidadeId, configuracoes, referenciaLinha, referenciaImportacao);
            novosRegistros++;
          }
        } catch (error) {
          erros.push(`Linha ${index + 1}: ${error}`);
        }
      }

      // 4. Marca cobranças como quitadas (que não estão na nova planilha)
      const registrosQuitados = await this.marcarCobrancasQuitadas(referenciasNovaPlanilha, referenciaImportacao);

      // 5. Atualiza estatísticas da importação
      await supabase
        .from('importacoes_planilha')
        .update({
          novos_registros: novosRegistros,
          registros_atualizados: registrosAtualizados,
          registros_quitados: registrosQuitados,
          observacoes: erros.length > 0 ? `${erros.length} erros encontrados` : null
        })
        .eq('id', importacao.id);

      return {
        sucesso: true,
        importacao_id: importacao.id,
        estatisticas: {
          total_registros: dadosPlanilha.length,
          novos_registros: novosRegistros,
          registros_atualizados: registrosAtualizados,
          registros_quitados: registrosQuitados
        },
        erros: erros.length > 0 ? erros : undefined
      };

    } catch (error) {
      return {
        sucesso: false,
        importacao_id: '',
        estatisticas: {
          total_registros: 0,
          novos_registros: 0,
          registros_atualizados: 0,
          registros_quitados: 0
        },
        erros: [String(error)]
      };
    }
  }

  /**
   * Busca unidade pelo CNPJ
   */
  private async buscarUnidadePorCNPJ(cnpj: string): Promise<string | null> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    const { data, error } = await supabase
      .from('unidades')
      .select('id')
      .eq('cnpj', cnpjLimpo)
      .single();

    if (error || !data) return null;
    return data.id;
  }

  /**
   * Busca configurações do sistema
   */
  private async buscarConfiguracoes() {
    const { data, error } = await supabase
      .from('configuracoes_gerais')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      // Retorna configurações padrão
      return {
        juros_mensal: 2.5,
        multa_atraso: 5.0,
        limite_dias_para_acionamento: 30
      };
    }

    return data;
  }

  /**
   * Calcula valor atualizado com juros e multa
   */
  private calcularValorAtualizado(
    valorOriginal: number,
    dataVencimento: string,
    configuracoes: any
  ): number {
    const hoje = new Date();
    const vencimento = new Date(normalizarData(dataVencimento));
    
    if (vencimento >= hoje) {
      return valorOriginal; // Não vencido ainda
    }

    const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calcula juros proporcionais
    const jurosMensal = configuracoes.juros_mensal / 100;
    const jurosDiario = jurosMensal / 30;
    const juros = valorOriginal * jurosDiario * diasAtraso;
    
    // Calcula multa
    const multa = valorOriginal * (configuracoes.multa_atraso / 100);
    
    return valorOriginal + juros + multa;
  }

  /**
   * Insere nova cobrança no banco
   */
  private async inserirNovaCobranca(
    dados: DadosPlanilha,
    unidadeId: string,
    configuracoes: any,
    referenciaLinha: string,
    referenciaImportacao: string
  ) {
    const valorAtualizado = this.calcularValorAtualizado(
      dados.valor_original,
      dados.data_vencimento,
      configuracoes
    );

    const novaCobranca = {
      unidade_id: unidadeId,
      tipo_cobranca: dados.tipo_cobranca,
      valor_original: dados.valor_original,
      data_vencimento: normalizarData(dados.data_vencimento),
      data_vencimento_original: normalizarData(dados.data_vencimento_original),
      status: valorAtualizado > dados.valor_original ? 'em_aberto' : 'em_aberto',
      valor_atualizado: valorAtualizado,
      descricao: dados.descricao,
      linha_referencia_importada: referenciaLinha,
      referencia_importacao: referenciaImportacao
    };

    const { error } = await supabase
      .from('cobrancas')
      .insert(novaCobranca);

    if (error) {
      throw new Error(`Erro ao inserir cobrança: ${error.message}`);
    }
  }

  /**
   * Atualiza cobrança existente
   */
  private async atualizarCobrancaExistente(
    cobrancaExistente: any,
    dadosNovos: DadosPlanilha,
    configuracoes: any,
    referenciaImportacao: string
  ) {
    // Não atualiza cobranças que estão em processo jurídico
    if (cobrancaExistente.status === 'judicial') {
      return;
    }

    const valorAtualizado = this.calcularValorAtualizado(
      dadosNovos.valor_original,
      dadosNovos.data_vencimento,
      configuracoes
    );

    const atualizacoes = {
      valor_original: dadosNovos.valor_original,
      data_vencimento: normalizarData(dadosNovos.data_vencimento),
      valor_atualizado: valorAtualizado,
      data_atualizacao: new Date().toISOString(),
      referencia_importacao: referenciaImportacao,
      status: cobrancaExistente.status === 'quitado' ? 'quitado' : 'em_aberto'
    };

    const { error } = await supabase
      .from('cobrancas')
      .update(atualizacoes)
      .eq('id', cobrancaExistente.id);

    if (error) {
      throw new Error(`Erro ao atualizar cobrança: ${error.message}`);
    }
  }

  /**
   * Marca cobranças como quitadas se não estão na nova planilha
   */
  private async marcarCobrancasQuitadas(
    referenciasNovaPlanilha: Set<string>,
    referenciaImportacao: string
  ): Promise<number> {
    // Busca cobranças que não estão em processo jurídico e não estão na nova planilha
    const { data: cobrancasParaQuitar } = await supabase
      .from('cobrancas')
      .select('id, linha_referencia_importada')
      .neq('status', 'judicial')
      .neq('status', 'quitado');

    if (!cobrancasParaQuitar) return 0;

    const idsParaQuitar = cobrancasParaQuitar
      .filter(cobranca => !referenciasNovaPlanilha.has(cobranca.linha_referencia_importada))
      .map(cobranca => cobranca.id);

    if (idsParaQuitar.length === 0) return 0;

    const { error } = await supabase
      .from('cobrancas')
      .update({
        status: 'quitado',
        data_atualizacao: new Date().toISOString(),
        referencia_importacao: referenciaImportacao
      })
      .in('id', idsParaQuitar);

    if (error) {
      throw new Error(`Erro ao marcar cobranças como quitadas: ${error.message}`);
    }

    return idsParaQuitar.length;
  }

  /**
   * Busca cobranças por filtros
   */
  async buscarCobrancas(filtros: {
    unidadeId?: string;
    status?: string;
    tipo?: string;
    dataInicio?: string;
    dataFim?: string;
  } = {}) {
    let query = supabase
      .from('cobrancas')
      .select(`
        *,
        unidades (
          codigo_unidade,
          nome_franqueado,
          cidade,
          estado
        )
      `)
      .order('data_vencimento', { ascending: false });

    if (filtros.unidadeId) {
      query = query.eq('unidade_id', filtros.unidadeId);
    }

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }

    if (filtros.tipo) {
      query = query.eq('tipo_cobranca', filtros.tipo);
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

    return data;
  }

  /**
   * Busca histórico de importações
   */
  async buscarHistoricoImportacoes() {
    const { data, error } = await supabase
      .from('importacoes_planilha')
      .select('*')
      .order('data_importacao', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }

    return data;
  }

  /**
   * Executa verificação de acionamento jurídico após importação
   */
  async verificarAcionamentoJuridico(referenciaImportacao: string): Promise<void> {
    try {
      // Busca cobranças que podem precisar de acionamento jurídico
      const { data: cobrancasRisco } = await supabase
        .from('cobrancas')
        .select(`
          *,
          unidades (
            id,
            codigo_unidade,
            nome_franqueado
          )
        `)
        .eq('referencia_importacao', referenciaImportacao)
        .eq('status', 'em_aberto');

      if (!cobrancasRisco) return;

      const configuracoes = await this.buscarConfiguracoes();

      for (const cobranca of cobrancasRisco) {
        const hoje = new Date();
        const vencimento = new Date(cobranca.data_vencimento);
        const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

        // Verifica critérios de acionamento jurídico
        if (diasAtraso >= configuracoes.limite_dias_para_acionamento && 
            cobranca.valor_atualizado >= 5000) {
          
          // Cria registro jurídico se não existir
          const { data: juridicoExistente } = await supabase
            .from('juridico')
            .select('id')
            .eq('unidade_id', cobranca.unidade_id)
            .eq('cobranca_id', cobranca.id)
            .single();

          if (!juridicoExistente) {
            await supabase
              .from('juridico')
              .insert({
                unidade_id: cobranca.unidade_id,
                cobranca_id: cobranca.id,
                status_juridico: 'pre_acao',
                motivo_acionamento: `Valor alto em atraso: R$ ${cobranca.valor_atualizado.toFixed(2)} há ${diasAtraso} dias`,
                valor_total_envolvido: cobranca.valor_atualizado
              });

            // Atualiza status da cobrança
            await supabase
              .from('cobrancas')
              .update({ status: 'judicial' })
              .eq('id', cobranca.id);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar acionamento jurídico:', error);
    }
  }
}