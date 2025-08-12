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
    let query = supabase.from("cobrancas_franqueados").select(`
      *,
      unidades_franqueadas!unidade_id_fk (
        id,
        codigo_unidade,
        nome_unidade,
        cidade,
        estado
      )
    `);

    // Filtros básicos
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

    // Filtros de valor
    if (filtros.valorMin) {
      const valorMin = typeof filtros.valorMin === 'string' 
        ? parseFloat(filtros.valorMin) 
        : filtros.valorMin;
      if (!isNaN(valorMin as number)) {
        query = query.gte("valor_atualizado", valorMin);
      }
    }

    if (filtros.valorMax) {
      const valorMax = typeof filtros.valorMax === 'string' 
        ? parseFloat(filtros.valorMax) 
        : filtros.valorMax;
      if (!isNaN(valorMax as number)) {
        query = query.lte("valor_atualizado", valorMax);
      }
    }

    // Filtro por tipo de cobrança
    if (filtros.tipoCobranca || filtros.tipo_debito) {
      const tipo = filtros.tipoCobranca || filtros.tipo_debito;
      query = query.eq("tipo_cobranca", tipo);
    }

    // Filtro apenas inadimplentes
    if (filtros.apenasInadimplentes) {
      query = query.neq("status", "quitado");
    }

    // Ordenação
    const colunaOrdenacao = filtros.colunaOrdenacao as string || "data_vencimento";
    const direcaoOrdenacao = filtros.direcaoOrdenacao as string || "desc";
    
    query = query.order(colunaOrdenacao, { ascending: direcaoOrdenacao === "asc" });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar cobranças: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Aplica filtros locais que não podem ser feitos no banco
    let resultados = data;

    // Filtro por busca (nome da unidade, código, CNPJ)
    if (filtros.busca) {
      const termoBusca = (filtros.busca as string).toLowerCase();
      resultados = resultados.filter((cobranca) => {
        const nomeUnidade = cobranca.unidades_franqueadas?.nome_unidade?.toLowerCase() || 
                            cobranca.cliente?.toLowerCase() || '';
        const codigoUnidade = cobranca.unidades_franqueadas?.codigo_unidade?.toLowerCase() || '';
        const cnpj = cobranca.cnpj?.replace(/\D/g, '') || '';
        
        return nomeUnidade.includes(termoBusca) ||
               codigoUnidade.includes(termoBusca) ||
               cnpj.includes(termoBusca.replace(/\D/g, ''));
      });
    }

    return resultados;
  }

  async quitarCobranca(dados: QuitacaoCobranca): Promise<ResultadoQuitacao> {
    const {
      cobrancaId,
      valorPago,
      formaPagamento,
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

    // Monta as observações consolidadas
    let observacoesConsolidadas = cobranca.observacoes || "";
    const novaObservacao = `\n[${new Date().toLocaleString("pt-BR")}] Pagamento registrado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorPago)} via ${formaPagamento}${observacoes ? ` - ${observacoes}` : ""}. Usuário: ${usuario}`;
    observacoesConsolidadas += novaObservacao;

    const { error: updateError } = await supabase
      .from("cobrancas_franqueados")
      .update({
        valor_recebido: (cobranca.valor_recebido || 0) + valorPago,
        status: novoStatus,
        data_ultima_atualizacao: new Date().toISOString(),
        observacoes: observacoesConsolidadas,
      })
      .eq("id", cobrancaId);

    if (updateError) {
      throw new Error(`Erro ao atualizar cobrança: ${updateError.message}`);
    }

    // Log da operação para auditoria
    console.log(`Quitação processada - Cobrança ID: ${cobrancaId}, Valor: ${valorPago}, Status: ${novoStatus}, Usuário: ${usuario}`);

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
   * Utiliza o campo cobranca_id nas tabelas de logs para vincular mensagens
   */
  async buscarHistoricoEnvios(cobrancaId: string): Promise<HistoricoEnvio[]> {
    const historico: HistoricoEnvio[] = [];

    // 1) Logs de WhatsApp via n8n em 'logs_envio_whatsapp'
    try {
      const { data, error } = await supabase
        .from("logs_envio_whatsapp")
        .select("id, destinatario, mensagem_enviada, instancia_evolution, sucesso, evolution_message_id, erro_detalhes, data_envio, created_at, cobranca_id")
        .eq("cobranca_id", cobrancaId)
        .order("data_envio", { ascending: false });

      if (!error && data) {
        historico.push(
          ...data.map((row: any): HistoricoEnvio => ({
            id: row.id,
            canal: "whatsapp",
            tipo: "whatsapp_n8n",
            numero_telefone: row.destinatario,
            mensagem_enviada: row.mensagem_enviada || "Mensagem não capturada",
            status_envio: row.sucesso ? "sucesso" : "falha",
            erro_detalhes: row.erro_detalhes,
            data_envio: row.data_envio || row.created_at,
            metadados: {
              evolution_message_id: row.evolution_message_id,
              instancia_evolution: row.instancia_evolution,
            },
          }))
        );
      }
    } catch (e) {
      console.warn("Falha ao buscar logs_envio_whatsapp:", e);
    }

    // 2) Logs de e-mail via n8n em 'logs_envio_email'
    try {
      const { data, error } = await supabase
        .from("logs_envio_email")
        .select("id, destinatario, mensagem, sucesso, message_id, erro_detalhes, data_envio, created_at, cobranca_id")
        .eq("cobranca_id", cobrancaId)
        .order("data_envio", { ascending: false });

      if (!error && data) {
        historico.push(
          ...data.map((row: any): HistoricoEnvio => ({
            id: row.id,
            canal: "email",
            tipo: "email_n8n",
            destinatario: row.destinatario,
            mensagem: row.mensagem || "Conteúdo do email não capturado",
            status_envio: row.sucesso ? "sucesso" : "falha",
            erro_detalhes: row.erro_detalhes,
            data_envio: row.data_envio || row.created_at,
            metadados: {
              message_id: row.message_id,
            },
          }))
        );
      }
    } catch (e) {
      console.warn("Falha ao buscar logs_envio_email:", e);
    }

    // 3) [OPCIONAL] Mantém compatibilidade com mensagens antigas se existirem
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
            tipo: "whatsapp_legado",
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
      console.warn("Falha ao buscar mensagens_enviadas (legado):", e);
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
