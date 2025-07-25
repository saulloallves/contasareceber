/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CobrancaFranqueado,
  ResultadoImportacao,
  DadosPlanilha,
} from "../types/cobranca";
import {
  gerarReferenciaLinha,
  normalizarData,
} from "../utils/planilhaProcessor";
import { supabase } from "./databaseService"

export class CobrancaService {
  /**
   * Processa importação de planilha e atualiza banco de dados
   */
  async processarImportacaoPlanilha(
    dadosDaPlanilha: CobrancaFranqueado[],
    nomeArquivo: string,
    usuario: string
  ): Promise<ResultadoImportacao> {
    const referenciaImportacao = `IMP_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const erros: string[] = [];

    // 1. Cria o registro da importação ANTES de processar as linhas
    const { data: importacao, error: errorImportacao } = await supabase
      .from("importacoes_planilha")
      .insert({
        usuario,
        arquivo_nome: nomeArquivo,
        referencia: referenciaImportacao,
        total_registros: dadosDaPlanilha.length,
      })
      .select()
      .single();

    if (errorImportacao) {
      throw new Error(
        `Erro fatal ao criar registro de importação: ${errorImportacao.message}`
      );
    }

    // 2. Inicializa estatísticas e configurações
    let novosRegistros = 0;
    let registrosAtualizados = 0;
    const configuracoes = {
      // Usando configurações padrão por enquanto
      juros_mensal: 2.5,
      multa_atraso: 5.0,
      limite_dias_para_acionamento: 30,
    };
    const referenciasNovaPlanilha = new Set<string>();

    // 3. Processa cada linha da planilha DENTRO de um loop seguro
    for (const [index, dados] of dadosDaPlanilha.entries()) {
      try {
        // Validação Mínima: Garante que os dados essenciais existem antes de prosseguir
        if (!dados.cnpj || !dados.valor_original || !dados.data_vencimento) {
          throw new Error(
            "Dados essenciais (CNPJ, Valor, Vencimento) faltando na linha."
          );
        }

        const referenciaLinha = gerarReferenciaLinha(dados);
        referenciasNovaPlanilha.add(referenciaLinha);

        const unidadeId = await this.buscarUnidadePorCNPJ(dados.cnpj);
        if (!unidadeId) {
          erros.push(
            `Linha ${index + 2}: Unidade com CNPJ/CPF '${
              dados.cnpj
            }' não foi encontrada no banco.`
          );
          continue; // Pula para a próxima linha
        }

        const { data: cobrancaExistente } = await supabase
          .from("cobrancas_franqueados")
          .select("id, status") // Seleciona apenas o necessário
          .eq("linha_referencia_importada", referenciaLinha)
          .maybeSingle();

        if (cobrancaExistente) {
          await this.atualizarCobrancaExistente(
            cobrancaExistente,
            dados,
            configuracoes,
            referenciaImportacao
          );
          registrosAtualizados++;
        } else {
          await this.inserirNovaCobranca(
            dados,
            unidadeId,
            configuracoes,
            referenciaLinha,
            referenciaImportacao
          );
          novosRegistros++;
        }
      } catch (error: any) {
        console.error(`### ERRO DETALHADO NA LINHA ${index + 2} ###`, {
          message: error.message,
          details: error.details,
          code: error.code,
          hint: error.hint,
          dadosDaLinha: dados,
        });
        erros.push(`Linha ${index + 2}: ${error.message}`);
      }
    }

    // 4. Marca cobranças antigas como quitadas
    const registrosQuitados = await this.marcarCobrancasQuitadas(
      referenciasNovaPlanilha,
      referenciaImportacao
    );

    // 5. Atualiza o registro de importação com o resultado final
    await supabase
      .from("importacoes_planilha")
      .update({
        novos_registros: novosRegistros,
        registros_atualizados: registrosAtualizados,
        registros_quitados: registrosQuitados,
        observacoes:
          erros.length > 0
            ? `${erros.length} erros encontrados`
            : "Importação concluída com sucesso",
      })
      .eq("id", importacao.id);

    // 6. Retorna o resultado completo
    return {
      sucesso: erros.length === 0,
      importacao_id: importacao.id,
      estatisticas: {
        total_registros: dadosDaPlanilha.length,
        novos_registros: novosRegistros,
        registros_atualizados: registrosAtualizados,
        registros_quitados: registrosQuitados,
      },
      erros: erros,
    };
  }

  /**
   * Busca unidade pelo CNPJ
   */
  private async buscarUnidadePorCNPJ(cnpj: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("unidades_franqueadas")
      .select("id")
      .eq("cnpj", cnpj)
      .maybeSingle();

    if (error || !data) return null;
    return data.id;
  }

  /**
   * Busca configurações do sistema
   */
  // Desabilitado por enquanto, pois não há tabela de configurações padronizadas
  // private async buscarConfiguracoes() {
  //   const { data, error } = await supabase
  //     .from("configuracoes_cobranca")
  //     .select("*")
  //     .eq("id", "default")
  //     .single();

  //   if (error || !data) {
  //     // Retorna configurações padrão
  //     return {
  //       juros_mensal: 2.5,
  //       multa_atraso: 5.0,
  //       limite_dias_para_acionamento: 30,
  //     };
  //   }

  //   return data;
  // }

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

    const diasAtraso = Math.floor(
      (hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24)
    );

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
      unidade_id_fk: unidadeId,
      cliente: dados.cliente,
      cnpj: dados.cnpj,
      tipo_cobranca: dados.tipo_cobranca,
      valor_original: dados.valor_original,
      valor_recebido: 0,
      data_vencimento: normalizarData(dados.data_vencimento),
      data_vencimento_original: normalizarData(
        dados.data_vencimento_original || ""
      ),
      status: valorAtualizado > dados.valor_original ? "em_aberto" : "a_vencer",
      valor_atualizado: valorAtualizado,
      descricao: dados.descricao,
      linha_referencia_importada: referenciaLinha,
      referencia_importacao: referenciaImportacao,
      email_cobranca: dados.email_cobranca || null,
    };

    const { error } = await supabase
      .from("cobrancas_franqueados")
      .insert(novaCobranca);

    if (error) {
      console.error("ERRO DETALHADO NO INSERT:", {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        dadosEnviados: novaCobranca,
      });
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
    if (cobrancaExistente.status === "judicial") {
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
      status: cobrancaExistente.status === "quitado" ? "quitado" : "em_aberto",
    };

    const { error } = await supabase
      .from("cobrancas_franqueados")
      .update(atualizacoes)
      .eq("id", cobrancaExistente.id);

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
    const { data: cobrancasParaQuitar, error: errorBusca } = await supabase
      .from("cobrancas_franqueados")
      .select("id, linha_referencia_importada")
      .neq("status", "judicial")
      .neq("status", "quitado");

    if (errorBusca) {
      // Adiciona tratamento de erro
      console.error("Erro ao buscar cobranças para quitar:", errorBusca);
      return 0;
    }

    if (!cobrancasParaQuitar) return 0;

    const idsParaQuitar = cobrancasParaQuitar
      .filter(
        (cobranca) =>
          !referenciasNovaPlanilha.has(cobranca.linha_referencia_importada)
      )
      .map((cobranca) => cobranca.id);

    if (idsParaQuitar.length === 0) return 0;

    const { error } = await supabase
      .from("cobrancas_franqueados")
      .update({
        status: "quitado",
        data_atualizacao: new Date().toISOString(),
        referencia_importacao: referenciaImportacao,
      })
      .in("id", idsParaQuitar);

    if (error) {
      throw new Error(
        `Erro ao marcar cobranças como quitadas: ${error.message}`
      );
    }

    return idsParaQuitar.length;
  }

  /**
   * Busca cobranças por filtros
   */
  async buscarCobrancas(
    filtros: {
      unidadeId?: string;
      status?: string;
      tipo?: string;
      dataInicio?: string;
      dataFim?: string;
    } = {}
  ) {
    let query = supabase
      .from("cobrancas_franqueados")
      .select(
        `
        *,
        unidades_franqueadas:unidade_id_fk (
          codigo_unidade,
          nome_franqueado,
          cidade,
          estado
        )
      `
      )
      .order("data_vencimento", { ascending: false });

    if (filtros.unidadeId) {
      query = query.eq("codigo_unidade", filtros.unidadeId);
    }

    if (filtros.status) {
      query = query.eq("status", filtros.status);
    }

    if (filtros.tipo) {
      query = query.eq("tipo_cobranca", filtros.tipo);
    }

    if (filtros.dataInicio) {
      query = query.gte("data_vencimento", filtros.dataInicio);
    }

    if (filtros.dataFim) {
      query = query.lte("data_vencimento", filtros.dataFim);
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
      .from("importacoes_planilha")
      .select("*")
      .order("data_importacao", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }

    return data;
  }

  /**
   * Executa verificação de acionamento jurídico após importação
   */
  async verificarAcionamentoJuridico(
    referenciaImportacao: string
  ): Promise<void> {
    try {
      // Busca cobranças que podem precisar de acionamento jurídico
      const { data: cobrancasRisco } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          *,
          unidades_franqueadas (
            id,
            codigo_unidade,
            nome_franqueado
          )
        `
        )
        .eq("referencia_importacao", referenciaImportacao)
        .eq("status", "em_aberto");

      if (!cobrancasRisco) return;

      //const configuracoes = await this.buscarConfiguracoes();

      const configuracoes = {
        limite_dias_para_acionamento: 30,
      };

      for (const cobranca of cobrancasRisco) {
        const hoje = new Date();
        const vencimento = new Date(cobranca.data_vencimento);
        const diasAtraso = Math.floor(
          (hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Verifica critérios de acionamento jurídico
        if (
          diasAtraso >= configuracoes.limite_dias_para_acionamento &&
          cobranca.valor_atualizado >= 5000
        ) {
          // Cria registro jurídico se não existir
          const { data: juridicoExistente } = await supabase
            .from("juridico")
            .select("id")
            .eq("unidade_id", cobranca.unidade_id)
            .eq("cobranca_id", cobranca.id)
            .single();

          if (!juridicoExistente) {
            await supabase.from("juridico").insert({
              unidade_id: cobranca.unidade_id,
              cobranca_id: cobranca.id,
              status_juridico: "pre_acao",
              motivo_acionamento: `Valor alto em atraso: R$ ${cobranca.valor_atualizado.toFixed(
                2
              )} há ${diasAtraso} dias`,
              valor_total_envolvido: cobranca.valor_atualizado,
            });

            // Atualiza status da cobrança
            await supabase
              .from("cobrancas_franqueados")
              .update({ status: "judicial" })
              .eq("id", cobranca.id);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao verificar acionamento jurídico:", error);
    }
  }
}

export const cobrancaService = new CobrancaService();
