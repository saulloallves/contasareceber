/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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
import { gerarReferenciaLinha } from "../utils/planilhaProcessor";

// Tipo auxiliar para histórico de envios (whatsapp/email)
type HistoricoEnvio = {
  id: string;
  canal: "whatsapp" | "email";
  tipo: string;
  cliente?: string;
  cnpj?: string;
  numero_telefone?: string;
  mensagem_enviada?: string;
  mensagem?: string;
  status_envio?: string;
  erro_detalhes?: string;
  data_envio: string;
  destinatario?: string;
  assunto?: string;
  usuario?: string;
  metadados?: Record<string, unknown>;
};

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
  const cobrancasParaInserir: Array<Partial<CobrancaFranqueado> & { unidade_id: string; referencia_importacao: string }> = [];
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
      } catch (error: unknown) {
        console.error(`Erro na linha ${index + 2}:`, error);
        const msg = error instanceof Error ? error.message : String(error);
        erros.push(`Linha ${index + 2}: ${msg}`);
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
    cobrancas: Array<Partial<CobrancaFranqueado> & { unidade_id?: string; referencia_importacao?: string }>,
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

  async buscarCobrancas(
    filtros: Record<string, unknown> = {}
  ): Promise<CobrancaFranqueado[]> {
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
    } catch (error: unknown) {
        resultado.envios_falha++;
        resultado.detalhes.push({
          titulo_id: cobrancaId,
          cliente: "Desconhecido",
      status: "falha",
      erro: (error as Error).message,
        });
      }
    }

    resultado.sucesso = resultado.envios_falha === 0;
    return resultado;
  }

  /**
   * Atualiza uma cobrança específica
   */
  async atualizarCobranca(
    id: string,
    dados: Partial<CobrancaFranqueado>
  ): Promise<void> {
    const { error } = await supabase
      .from("cobrancas_franqueados")
      .update({ ...dados, data_ultima_atualizacao: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao atualizar cobrança: ${error.message}`);
    }
  }

  /**
   * Busca histórico de envios (WhatsApp/Email) vinculados a uma cobrança
   * Consolida dados de diferentes fontes quando disponíveis
   */
  async buscarHistoricoEnvios(cobrancaId: string): Promise<HistoricoEnvio[]> {
    const historico: HistoricoEnvio[] = [];

    // 1) Mensagens via WhatsApp registradas em 'mensagens_enviadas'
    try {
      const { data, error } = await supabase
        .from("mensagens_enviadas")
        .select("id, titulo_id, cliente, cnpj, telefone, data_envio, mensagem_enviada, status_envio, erro_detalhes, created_at")
        .eq("titulo_id", cobrancaId)
        .order("data_envio", { ascending: false });

      if (!error && data) {
        historico.push(
          ...data.map((row: any): HistoricoEnvio => ({
            id: row.id,
            canal: "whatsapp",
            tipo: "amigavel",
            cliente: row.cliente,
            cnpj: row.cnpj,
            numero_telefone: row.telefone,
            mensagem_enviada: row.mensagem_enviada,
            status_envio: row.status_envio,
            erro_detalhes: row.erro_detalhes,
            data_envio: row.data_envio || row.created_at,
          }))
        );
      }
  } catch (e) {
      console.warn("Falha ao buscar mensagens_enviadas:", e);
    }

    // 2) Logs de e-mail (se existirem) em 'logs_envio_email'
    try {
      const { data, error } = await supabase
        .from("logs_envio_email")
        .select("id, cobranca_id, destinatario, assunto, mensagem, usuario, sucesso, erro_detalhes, created_at, tipo, metadados")
        .eq("cobranca_id", cobrancaId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        historico.push(
          ...data.map((row: any): HistoricoEnvio => ({
            id: row.id,
            canal: "email",
            tipo: row.tipo || "email_cobranca_padrao",
            destinatario: row.destinatario,
            assunto: row.assunto,
            mensagem: row.mensagem,
            usuario: row.usuario || "Sistema",
            status_envio: row.sucesso ? "sucesso" : "falha",
            erro_detalhes: row.erro_detalhes,
            data_envio: row.created_at,
            metadados: row.metadados || {},
          }))
        );
      }
  } catch (e) {
      // Tabela pode não existir em alguns ambientes; apenas loga o aviso
      console.warn("Tabela logs_envio_email indisponível:", e);
    }

    // Ordena por data desc como fallback
    historico.sort((a, b) => new Date(b.data_envio || 0).getTime() - new Date(a.data_envio || 0).getTime());
    return historico;
  }

  /**
   * Registra log de envio via WhatsApp na tabela 'mensagens_enviadas'
   */
  async registrarLogEnvioWhatsapp(params: {
    cobrancaId: string;
    tipo: string;
    numero: string;
    mensagem: string;
    usuario: string;
    sucesso?: boolean;
    erro_detalhes?: string;
  }): Promise<void> {
    const { cobrancaId, numero, mensagem, sucesso = true, erro_detalhes } = params;

    // Busca dados da cobrança para complementar o registro
    const { data: cobranca, error: fetchError } = await supabase
      .from("cobrancas_franqueados")
      .select("id, cliente, cnpj")
      .eq("id", cobrancaId)
      .single();

    if (fetchError || !cobranca) {
      throw new Error(`Erro ao buscar cobrança para log: ${fetchError?.message}`);
    }

    const { error } = await supabase.from("mensagens_enviadas").insert({
      titulo_id: cobrancaId,
      cliente: cobranca.cliente,
      cnpj: cobranca.cnpj,
      telefone: numero,
      mensagem_enviada: mensagem,
      status_envio: sucesso ? "sucesso" : "falha",
      erro_detalhes: erro_detalhes,
      data_envio: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Erro ao registrar log de WhatsApp: ${error.message}`);
    }
  }

  /**
   * Registra log de envio por e-mail em 'logs_envio_email' (se existir)
   * Usado pelo EmailService após envio bem-sucedido
   */
  async registrarLogEnvioEmail(params: {
    cobrancaId: string;
    tipo: string;
    destinatario: string;
    assunto: string;
    mensagem: string;
    usuario: string;
  metadados?: Record<string, unknown>;
  }): Promise<void> {
  const payload = {
      cobranca_id: params.cobrancaId,
      tipo: params.tipo,
      destinatario: params.destinatario,
      assunto: params.assunto,
      mensagem: params.mensagem,
      usuario: params.usuario,
      metadados: params.metadados || {},
      created_at: new Date().toISOString(),
      sucesso: true,
  };

    try {
      const { error } = await supabase.from("logs_envio_email").insert(payload);
      if (error) {
        throw error;
      }
    } catch (e) {
      console.warn("Falha ao registrar log de e-mail (logs_envio_email)", e);
    }
  }

  /**
   * Verificação pós-importação para possíveis escalonamentos/acionamentos
   * (stub para compatibilidade)
   */
  async verificarAcionamentoJuridico(_importacaoId?: string): Promise<void> {
    // Implementação futura: analisar cobranças importadas e acionar processos
    return;
  }
}

export const cobrancaService = new CobrancaService();
