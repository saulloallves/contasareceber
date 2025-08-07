import { supabase } from "../lib/supabaseClient";
import {
  CobrancaFranqueado,
  ResultadoImportacao,
  QuitacaoCobranca,
  ResultadoQuitacao,
  TrativativaCobranca,
  EnvioMensagem,
  ResultadoEnvioCobranca,
} from "../types/cobranca";
import {
  gerarReferenciaLinha,
  normalizarData,
} from "../utils/planilhaProcessor";

export class CobrancaService {
  private async buscarOuCriarUnidadePorCNPJ(cnpj: string): Promise<string> {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    const { data, error } = await supabase
      .from("unidades_franqueadas")
      .select("id")
      .eq("codigo_interno", cnpjLimpo)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar unidade: ${error.message}`);
    }

    if (data) {
      return data.id;
    }

    const { data: novaUnidade, error: createError } = await supabase
      .from("unidades_franqueadas")
      .insert({
        codigo_interno: cnpjLimpo,
        status_unidade: "ativa",
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Erro ao criar nova unidade: ${createError.message}`);
    }

    return novaUnidade.id;
  }

  async processarImportacaoPlanilha(
    dadosDaPlanilha: CobrancaFranqueado[],
    nomeArquivo: string,
    usuario: string
  ): Promise<ResultadoImportacao> {
    const erros: string[] = [];
    const referenciasNovaPlanilha = new Set<string>();
    const cobrancasParaInserir: CobrancaFranqueado[] = [];
    const cobrancasParaAtualizar: CobrancaFranqueado[] = [];
    const cobrancasQuitadas: string[] = [];

    for (const [index, dados] of dadosDaPlanilha.entries()) {
      try {
        if (!dados.cnpj || !dados.valor_original || !dados.data_vencimento) {
          throw new Error(
            "Dados essenciais (CNPJ, Valor, Vencimento) faltando na linha."
          );
        }

        const referenciaLinha = gerarReferenciaLinha(dados);
        referenciasNovaPlanilha.add(referenciaLinha);

        const unidadeId = await this.buscarOuCriarUnidadePorCNPJ(dados.cnpj);

        const cobrancaExistente = await this.buscarCobrancaExistente(
          referenciaLinha
        );

        if (cobrancaExistente) {
          if (cobrancaExistente.status === "quitado") {
            cobrancasQuitadas.push(cobrancaExistente.id!);
          } else {
            cobrancasParaAtualizar.push({ ...cobrancaExistente, ...dados });
          }
        } else {
          cobrancasParaInserir.push({
            ...dados,
            unidade_id: unidadeId,
            referencia_importacao: referenciaLinha,
          });
        }
      } catch (error: any) {
        console.error(`Erro na linha ${index + 2}:`, error);
        erros.push(`Linha ${index + 2}: ${error.message}`);
      }
    }

    if (erros.length > 0) {
      return {
        sucesso: false,
        importacao_id: "",
        estatisticas: {
          total_registros: dadosDaPlanilha.length,
          novos_registros: 0,
          registros_atualizados: 0,
          registros_quitados: cobrancasQuitadas.length,
        },
        erros: erros,
      };
    }

    const { data: importacao, error: importacaoError } = await supabase
      .from("importacoes")
      .insert({
        nome_arquivo: nomeArquivo,
        usuario: usuario,
        data_importacao: new Date().toISOString(),
      })
      .select()
      .single();

    if (importacaoError || !importacao) {
      throw new Error(
        `Erro ao registrar importação: ${importacaoError?.message}`
      );
    }

    await this.inserirNovasCobrancas(cobrancasParaInserir, importacao.id);
    await this.atualizarCobrancasExistentes(cobrancasParaAtualizar);
    await this.marcarCobrancasComoQuitadas(cobrancasQuitadas);

    const cobrancasAntigas = await this.buscarCobrancasAntigas(
      referenciasNovaPlanilha
    );
    await this.marcarCobrancasComoInativas(cobrancasAntigas);

    return {
      sucesso: true,
      importacao_id: importacao.id,
      estatisticas: {
        total_registros: dadosDaPlanilha.length,
        novos_registros: cobrancasParaInserir.length,
        registros_atualizados: cobrancasParaAtualizar.length,
        registros_quitados: cobrancasQuitadas.length,
      },
      erros: [],
    };
  }

  private async buscarCobrancaExistente(
    referencia: string
  ): Promise<CobrancaFranqueado | null> {
    const { data, error } = await supabase
      .from("cobrancas_franqueados")
      .select("*")
      .eq("referencia_importacao", referencia)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar cobrança existente: ${error.message}`);
    }

    return data;
  }

  private async inserirNovasCobrancas(
    cobrancas: CobrancaFranqueado[],
    importacaoId: string
  ) {
    const { error } = await supabase.from("cobrancas_franqueados").insert(
      cobrancas.map((cobranca) => ({
        ...cobranca,
        importacao_id: importacaoId,
        status: "pendente",
      }))
    );

    if (error) {
      throw new Error(`Erro ao inserir novas cobranças: ${error.message}`);
    }
  }

  private async atualizarCobrancasExistentes(cobrancas: CobrancaFranqueado[]) {
    for (const cobranca of cobrancas) {
      const { error } = await supabase
        .from("cobrancas_franqueados")
        .update(cobranca)
        .eq("id", cobranca.id);

      if (error) {
        throw new Error(
          `Erro ao atualizar cobrança ${cobranca.id}: ${error.message}`
        );
      }
    }
  }

  private async marcarCobrancasComoQuitadas(ids: string[]) {
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("cobrancas_franqueados")
      .update({ status: "quitado" })
      .in("id", ids);

    if (error) {
      throw new Error(
        `Erro ao marcar cobranças como quitadas: ${error.message}`
      );
    }
  }

  private async buscarCobrancasAntigas(
    referenciasNovas: Set<string>
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from("cobrancas_franqueados")
      .select("id, referencia_importacao")
      .not("referencia_importacao", "in", Array.from(referenciasNovas))
      .in("status", ["pendente", "em_negociacao"]);

    if (error) {
      throw new Error(`Erro ao buscar cobranças antigas: ${error.message}`);
    }

    return data?.map((cobranca) => cobranca.id) || [];
  }

  private async marcarCobrancasComoInativas(ids: string[]) {
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("cobrancas_franqueados")
      .update({ status: "inativo" })
      .in("id", ids);

    if (error) {
      throw new Error(
        `Erro ao marcar cobranças como inativas: ${error.message}`
      );
    }
  }

  async buscarCobrancas(filtros: any = {}): Promise<CobrancaFranqueado[]> {
    let query = supabase.from("cobrancas_franqueados").select("*");

    if (filtros.status) {
      query = query.eq("status", filtros.status);
    }

    if (filtros.dataInicio) {
      query = query.gte("data_vencimento", filtros.dataInicio);
    }

    if (filtros.dataFim) {
      query = query.lte("data_vencimento", filtros.dataFim);
    }

    if (filtros.cnpj) {
      query = query.eq("cnpj", filtros.cnpj);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar cobranças: ${error.message}`);
    }

    return data || [];
  }

  async quitarCobranca(dados: QuitacaoCobranca): Promise<ResultadoQuitacao> {
    const {
      cobrancaId,
      valorPago,
      formaPagamento,
      dataRecebimento,
      observacoes,
      usuario,
    } = dados;

    const { data: cobranca, error: cobrancaError } = await supabase
      .from("cobrancas_franqueados")
      .select("*")
      .eq("id", cobrancaId)
      .single();

    if (cobrancaError || !cobranca) {
      throw new Error(`Erro ao buscar cobrança: ${cobrancaError?.message}`);
    }

    const valorRestante = cobranca.valor_original - valorPago;
    const novoStatus = valorRestante <= 0 ? "quitado" : "parcialmente_pago";

    const { error: updateError } = await supabase
      .from("cobrancas_franqueados")
      .update({
        valor_recebido: (cobranca.valor_recebido || 0) + valorPago,
        status: novoStatus,
        data_ultima_atualizacao: new Date().toISOString(),
      })
      .eq("id", cobrancaId);

    if (updateError) {
      throw new Error(`Erro ao atualizar cobrança: ${updateError.message}`);
    }

    const { error: pagamentoError } = await supabase.from("pagamentos").insert({
      cobranca_id: cobrancaId,
      valor_pago: valorPago,
      forma_pagamento: formaPagamento,
      data_recebimento: dataRecebimento,
      observacoes: observacoes,
      usuario: usuario,
    });

    if (pagamentoError) {
      throw new Error(`Erro ao registrar pagamento: ${pagamentoError.message}`);
    }

    return {
      sucesso: true,
      mensagem: "Quitação processada com sucesso",
      isQuitacaoTotal: novoStatus === "quitado",
      valorRestante: valorRestante > 0 ? valorRestante : 0,
    };
  }

  async registrarTratativa(tratativa: TrativativaCobranca): Promise<void> {
    const { error } = await supabase.from("tratativas").insert(tratativa);

    if (error) {
      throw new Error(`Erro ao registrar tratativa: ${error.message}`);
    }

    if (tratativa.status_cobranca_resultante) {
      const { error: updateError } = await supabase
        .from("cobrancas_franqueados")
        .update({ status: tratativa.status_cobranca_resultante })
        .eq("id", tratativa.titulo_id);

      if (updateError) {
        throw new Error(
          `Erro ao atualizar status da cobrança: ${updateError.message}`
        );
      }
    }
  }

  async enviarMensagemCobranca(mensagem: EnvioMensagem): Promise<void> {
    const { error } = await supabase
      .from("mensagens_enviadas")
      .insert(mensagem);

    if (error) {
      throw new Error(`Erro ao registrar mensagem enviada: ${error.message}`);
    }
  }

  async enviarCobrancasEmLote(
    cobrancas: string[]
  ): Promise<ResultadoEnvioCobranca> {
    const resultado: ResultadoEnvioCobranca = {
      sucesso: true,
      total_envios: cobrancas.length,
      envios_sucesso: 0,
      envios_falha: 0,
      detalhes: [],
    };

    for (const cobrancaId of cobrancas) {
      try {
        const { data: cobranca, error } = await supabase
          .from("cobrancas_franqueados")
          .select("*")
          .eq("id", cobrancaId)
          .single();

        if (error || !cobranca) {
          throw new Error(`Erro ao buscar cobrança: ${error?.message}`);
        }

        await this.enviarMensagemCobranca({
          titulo_id: cobrancaId,
          cliente: cobranca.cliente,
          cnpj: cobranca.cnpj,
          telefone: cobranca.telefone || "",
          mensagem_enviada: "Mensagem padrão de cobrança",
          status_envio: "enviado",
        });

        resultado.envios_sucesso++;
        resultado.detalhes.push({
          titulo_id: cobrancaId,
          cliente: cobranca.cliente,
          status: "sucesso",
        });
      } catch (error: any) {
        resultado.envios_falha++;
        resultado.detalhes.push({
          titulo_id: cobrancaId,
          cliente: "Desconhecido",
          status: "falha",
          erro: error.message,
        });
      }
    }

    resultado.sucesso = resultado.envios_falha === 0;
    return resultado;
  }
}

export const cobrancaService = new CobrancaService();
