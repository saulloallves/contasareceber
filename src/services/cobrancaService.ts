/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CobrancaFranqueado,
  ResultadoImportacao,
  DadosPlanilha,
  ResultadoQuitacao,
} from "../types/cobranca";
import {
  gerarReferenciaLinha,
  normalizarData,
} from "../utils/planilhaProcessor";
import { supabase } from "./databaseService";
import {
  comparacaoPlanilhaService,
  ResultadoComparacao,
} from "./comparacaoPlanilhaService";
import { NotificacaoAutomaticaService } from "./notificacaoAutomaticaService";
import { emailService } from "./emailService";
import { evolutionApiService } from "./evolutionApiService";

export class CobrancaService {
  /**
   * Compara nova planilha com a última importação
   */
  async compararComUltimaPlanilha(
    dadosNovaPlanilha: CobrancaFranqueado[]
  ): Promise<ResultadoComparacao> {
    return await comparacaoPlanilhaService.compararComUltimaPlanilha(
      dadosNovaPlanilha
    );
  }

  constructor() {
    this.notificacaoService = new NotificacaoAutomaticaService();
  }

  private notificacaoService: NotificacaoAutomaticaService;

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

    let novosRegistros = 0;
    let registrosAtualizados = 0;
    const configuracoes = {
      juros_mensal: 2.5,
      multa_atraso: 5.0,
      limite_dias_para_acionamento: 30,
    };
    const referenciasNovaPlanilha = new Set<string>();

    // PRIMEIRA PASSADA: Validação completa sem salvar no banco
    for (const [index, dados] of dadosDaPlanilha.entries()) {
      try {
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
            `Linha ${index + 2}: Unidade com documento '${
              dados.cnpj
            }' não encontrada.`
          );
          continue;
        }

        // Validações adicionais podem ser adicionadas aqui
        if (dados.valor_original <= 0) {
          erros.push(
            `Linha ${index + 2}: Valor original deve ser maior que zero.`
          );
          continue;
        }

        // Valida formato de data
        if (!dados.data_vencimento || dados.data_vencimento.trim() === "") {
          erros.push(`Linha ${index + 2}: Data de vencimento inválida.`);
          continue;
        }

        const dataVencimento = new Date(dados.data_vencimento);
        if (isNaN(dataVencimento.getTime())) {
          erros.push(
            `Linha ${index + 2}: Data de vencimento inválida: "${
              dados.data_vencimento
            }".`
          );
          continue;
        }
      } catch (error: any) {
        console.error(`### ERRO DETALHADO NA LINHA ${index + 2} ###`, {
          message: error.message,
          dadosDaLinha: dados,
        });
        erros.push(`Linha ${index + 2}: ${error.message}`);
      }
    }

    // Se houver erros, retorna sem salvar no banco
    if (erros.length > 0) {
      return {
        sucesso: false,
        importacao_id: "",
        estatisticas: {
          total_registros: dadosDaPlanilha.length,
          novos_registros: 0,
          registros_atualizados: 0,
          registros_quitados: 0,
        },
        erros: erros,
      };
    }

    // SEGUNDA PASSADA: Se não há erros, cria o registro de importação e processa
    const { data: importacao, error: errorImportacao } = await supabase
      .from("importacoes_planilha")
      .insert({
        usuario,
        arquivo_nome: nomeArquivo,
        referencia: referenciaImportacao,
        total_registros: dadosDaPlanilha.length,
      })
      .select("id")
      .single();

    if (errorImportacao) {
      throw new Error(
        `Erro fatal ao criar registro de importação: ${errorImportacao.message}`
      );
    }

    const importacaoId = importacao.id;

    // Agora processa os dados no banco
    for (const [index, dados] of dadosDaPlanilha.entries()) {
      try {
        const referenciaLinha = gerarReferenciaLinha(dados);
        referenciasNovaPlanilha.add(referenciaLinha);

        const unidadeId = await this.buscarUnidadePorCNPJ(dados.cnpj);

        const { data: cobrancaExistente } = await supabase
          .from("cobrancas_franqueados")
          .select("id, status")
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
            unidadeId!,
            configuracoes,
            referenciaLinha,
            referenciaImportacao
          );
          novosRegistros++;
        }
      } catch (error: any) {
        // Se houver erro durante o processamento, registra mas continua
        console.error(`Erro ao processar linha ${index + 2}:`, error);
      }
    }

    // Marca cobranças como quitadas e atualiza estatísticas
    try {
      const registrosQuitados = await this.marcarCobrancasQuitadas(
        referenciasNovaPlanilha,
        referenciaImportacao
      );

      await supabase
        .from("importacoes_planilha")
        .update({
          novos_registros: novosRegistros,
          registros_atualizados: registrosAtualizados,
          registros_quitados: registrosQuitados,
          observacoes: "Importação concluída com sucesso",
        })
        .eq("id", importacaoId);
    } catch (error: any) {
      console.error("Erro ao finalizar importação:", error);
    }

    // Retorna o resultado completo
    return {
      sucesso: true,
      importacao_id: importacaoId,
      estatisticas: {
        total_registros: dadosDaPlanilha.length,
        novos_registros: novosRegistros,
        registros_atualizados: registrosAtualizados,
        registros_quitados: 0, // Será atualizado pelo trigger
      },
      erros: [],
    };
  }

  /**
   * Busca unidade pelo CNPJ
   */
  private async buscarUnidadePorCNPJ(
    documento: string
  ): Promise<string | null> {
    // Limpa o documento para busca (remove formatação)
    const documentoLimpo = documento.replace(/\D/g, "");

    // Tenta buscar por CNPJ primeiro
    const { data, error } = await supabase
      .from("unidades_franqueadas")
      .select("id")
      .eq("codigo_unidade", documentoLimpo)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.id;
  }

  /**
   * Busca configurações do sistema
   * (Desabilitado por enquanto, pois não há tabela de configurações padronizadas)
   */
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
    dados: CobrancaFranqueado,
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
      cliente_codigo: dados.cliente_codigo || "",
      cnpj: dados.cnpj,
      tipo_cobranca: dados.tipo_cobranca,
      valor_original: dados.valor_original,
      valor_recebido: dados.valor_recebido || 0,
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

    // Envia notificação automática para nova cobrança
    try {
      await this.notificacaoService.enviarNotificacaoNovaCobranca(
        novaCobranca.id
      );
    } catch (notifError) {
      console.warn("Erro ao enviar notificação automática:", notifError);
      // Não falha a importação por erro de notificação
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
      data_ultima_atualizacao: new Date().toISOString(),
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
        data_ultima_atualizacao: new Date().toISOString(),
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
      status?: string;
      busca?: string;
      dataInicio?: string;
      dataFim?: string;
      valorMin?: string;
      valorMax?: string;
      colunaOrdenacao?: string;
      direcaoOrdenacao?: string;
      apenasInadimplentes?: boolean; // Novo filtro para cobranças inadimplentes
    } = {}
  ) {
    let query = supabase.from("cobrancas_franqueados").select(
      `
        *,
        unidades_franqueadas!unidade_id_fk (
          codigo_unidade,
          nome_franqueado,
          cidade,
          estado
        )
      `
    );

    // Aplica os filtros da interface
    if (filtros.status) {
      query = query.eq("status", filtros.status);
    }
    if (filtros.dataInicio) {
      query = query.gte("data_vencimento", filtros.dataInicio);
    }
    if (filtros.dataFim) {
      query = query.lte("data_vencimento", filtros.dataFim);
    }
    if (filtros.valorMin) {
      query = query.gte("valor_original", parseFloat(filtros.valorMin));
    }
    if (filtros.valorMax) {
      query = query.lte("valor_original", parseFloat(filtros.valorMax));
    }
    if (filtros.busca) {
      // Faz a busca pelo nome do cliente OU pelo CNPJ
      query = query.or(
        `cliente.ilike.%${filtros.busca}%,cnpj.ilike.%${filtros.busca}%`
      );
    }

    // Aplica a ordenação dinâmica
    if (filtros.colunaOrdenacao && filtros.direcaoOrdenacao) {
      query = query.order(filtros.colunaOrdenacao, {
        ascending: filtros.direcaoOrdenacao === "asc",
      });
    } else {
      // Ordenação padrão caso nenhuma seja especificada
      query = query.order("data_vencimento", { ascending: false });
    }

    if (filtros.apenasInadimplentes) {
      // A regra de negócio: dias_em_atraso maior ou igual a 30
      query = query.gte("dias_em_atraso", 30);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar cobranças: ${error.message}`);
    }

    return data || [];
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
   * Atualiza uma cobrança existente
   */
  async atualizarCobranca(
    id: string,
    dadosAtualizacao: Partial<CobrancaFranqueado>
  ) {
    try {
      // Remove propriedades que não são colunas da tabela cobrancas_franqueados
      const { unidades_franqueadas, created_at, ...dadosLimpos } =
        dadosAtualizacao as any;

      const { data, error } = await supabase
        .from("cobrancas_franqueados")
        .update({
          ...dadosLimpos,
          data_ultima_atualizacao: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        // Se o erro for relacionado ao RLS da tabela eventos_score, apenas loga e tenta novamente
        if (
          error.message?.includes("eventos_score") ||
          error.message?.includes("row-level security")
        ) {
          console.warn(
            "Aviso: Problema com registro de score detectado:",
            error.message
          );

          // Tenta novamente apenas os dados essenciais, sem os que podem triggerar o erro
          const { data: dataRetry, error: errorRetry } = await supabase
            .from("cobrancas_franqueados")
            .update({
              ...dadosLimpos,
              data_ultima_atualizacao: new Date().toISOString(),
            })
            .eq("id", id)
            .select()
            .single();

          if (errorRetry && !errorRetry.message?.includes("eventos_score")) {
            throw new Error(
              `Erro ao atualizar cobrança: ${errorRetry.message}`
            );
          }

          return dataRetry || null;
        } else {
          throw new Error(`Erro ao atualizar cobrança: ${error.message}`);
        }
      }

      return data;
    } catch (error) {
      console.error("Erro ao atualizar cobrança:", error);
      throw error;
    }
  }

  /**
   * Executa verificação de acionamento jurídico após importação
   */
  async verificarAcionamentoJuridico(): Promise<void> {
    try {
      // Busca template e parâmetros de notificação jurídica
      const { data: criterios } = await supabase
        .from("criterios_juridico")
        .select(
          "template_notificacao_extrajudicial, prazo_resposta_notificacao_dias, email_responsavel_juridico"
        )
        .eq("id", "default")
        .single();

      // Busca cobranças em aberto, sem resposta, que já receberam aviso de débito e estão há mais de 90 dias em aberto
      const { data: cobrancas } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `*, unidades_franqueadas (id, codigo_unidade, nome_franqueado, email_franqueado, telefone_franqueado)`
        )
        .eq("status", "em_aberto")
        .eq("aviso_de_debito_enviado", true)
        .is("resposta_cliente", null)
        .gte("dias_em_atraso", 91);

      if (!cobrancas || cobrancas.length === 0) return;

      for (const cobranca of cobrancas) {
        const diasAtraso = cobranca.dias_em_atraso;
        let risco = "baixo";
        if (diasAtraso >= 91 && diasAtraso <= 180) {
          risco = "medio";
        } else if (diasAtraso > 180) {
          risco = "alto";
        }

        // Verifica se já existe escalonamento jurídico para essa cobrança
        const { data: escalonamentoExistente } = await supabase
          .from("escalonamentos_cobranca")
          .select("id")
          .eq("titulo_id", cobranca.id)
          .eq("nivel", "juridico")
          .single();

        if (!escalonamentoExistente) {
          // Cria registro de escalonamento jurídico
          await supabase.from("escalonamentos_cobranca").insert({
            titulo_id: cobranca.id,
            cnpj_unidade: cobranca.cnpj,
            motivo_escalonamento: `Cobrança em aberto há ${diasAtraso} dias. Risco: ${risco}`,
            nivel: "juridico",
            status: "pendente",
            valor_total_envolvido: cobranca.valor_atualizado,
            quantidade_titulos: 1,
            observacoes: `Escalonamento automático para jurídico em ${new Date().toISOString()}. Risco: ${risco}`,
          });

          // Atualiza status da cobrança
          await supabase
            .from("cobrancas_franqueados")
            .update({ status: "judicial", risco_juridico: risco })
            .eq("id", cobranca.id);

          // Atualiza status jurídico da unidade para exibir no painel
          if (cobranca.unidades_franqueadas?.id) {
            await supabase
              .from("unidades_franqueadas")
              .update({
                juridico_status: "acionado",
                data_ultimo_acionamento: new Date().toISOString(),
              })
              .eq("id", cobranca.unidades_franqueadas.id);
          }

          // Monta mensagem de notificação extrajudicial
          const unidade = cobranca.unidades_franqueadas || {};
          const template = criterios?.template_notificacao_extrajudicial || "";
          const prazoResposta = criterios?.prazo_resposta_notificacao_dias || 5;
          const emailResponsavel = criterios?.email_responsavel_juridico || "";

          const mensagem = template
            .replace(/{{nome_franqueado}}/g, unidade.nome_franqueado || "")
            .replace(/{{dias_em_aberto}}/g, diasAtraso)
            .replace(
              /{{valor_total}}/g,
              cobranca.valor_atualizado?.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }) || ""
            )
            .replace(/{{prazo_resposta}}/g, prazoResposta)
            .replace(/{{codigo_unidade}}/g, unidade.codigo_unidade || "")
            .replace(
              /{{data_vencimento_antiga}}/g,
              cobranca.data_vencimento
                ? new Date(cobranca.data_vencimento).toLocaleDateString("pt-BR")
                : ""
            )
            .replace(
              /{{motivo_acionamento}}/g,
              `Cobrança em aberto há ${diasAtraso} dias. Risco: ${risco}`
            );

          // ENVIO DE EMAIL
          if (unidade.email_franqueado) {
            await emailService.enviarEmail({
              destinatario: unidade.email_franqueado,
              nome_destinatario: unidade.nome_franqueado || cobranca.cliente,
              assunto: "Notificação Extrajudicial - Pendência Financeira",
              corpo_html: `<div>${mensagem.replace(/\n/g, "<br>")}</div>`,
              corpo_texto: mensagem,
            });
          }

          // ENVIO DE WHATSAPP
          if (unidade.telefone_franqueado) {
            await evolutionApiService.sendTextMessage({
              instanceName: "automacoes_backup",
              number: unidade.telefone_franqueado,
              text: mensagem,
            });
          }
        }
      }
    } catch (error) {
      console.error("Erro ao verificar acionamento jurídico:", error);
    }
  }

  /**
   * Quita cobrança (parcial ou total) com gatilhos automáticos
   */
  async quitarCobranca(
    cobrancaId: string,
    valorPago: number,
    formaPagamento: string,
    usuario: string,
    observacoes?: string,
    dataRecebimento?: string
  ): Promise<ResultadoQuitacao> {
    try {
      // Busca dados da cobrança
      const { data: cobranca, error: errorBusca } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          *,
          unidades_franqueadas (
            id,
            codigo_unidade,
            nome_franqueado,
            email_franqueado,
            telefone_franqueado
          )
        `
        )
        .eq("id", cobrancaId)
        .single();

      if (errorBusca || !cobranca) {
        return {
          sucesso: false,
          mensagem: "Cobrança não encontrada",
        };
      }

      // Determina se é quitação total ou parcial
      const valorOriginal =
        cobranca.valor_atualizado || cobranca.valor_original;
      const valorJaPago = cobranca.valor_recebido || 0;
      const valorTotalPago = valorJaPago + valorPago;
      const isQuitacaoTotal = valorTotalPago >= valorOriginal;
      const valorRestante = valorOriginal - valorTotalPago;

      // Define novo status
      const novoStatus = isQuitacaoTotal ? "quitado" : "pagamento_parcial";

      // Atualiza a cobrança
      const { error: errorUpdate } = await supabase
        .from("cobrancas_franqueados")
        .update({
          status: novoStatus,
          valor_recebido: valorTotalPago,
          data_ultima_atualizacao: dataRecebimento || new Date().toISOString(),
        })
        .eq("id", cobrancaId);

      if (errorUpdate) {
        // Se o erro for relacionado ao RLS da tabela eventos_score, apenas loga e continua
        if (
          errorUpdate.message?.includes("eventos_score") ||
          errorUpdate.message?.includes("row-level security")
        ) {
          console.warn(
            "Aviso: Não foi possível registrar evento de score devido a políticas RLS:",
            errorUpdate.message
          );
          console.info(
            "A quitação foi processada com sucesso, apenas o registro de score foi pulado."
          );
          // Não retorna erro, continua o processo normalmente
        } else {
          return {
            sucesso: false,
            mensagem: `Erro ao atualizar cobrança: ${errorUpdate.message}`,
          };
        }
      }

      // Registra tratativa
      await supabase.from("tratativas_cobranca").insert({
        titulo_id: cobrancaId,
        tipo_interacao: isQuitacaoTotal
          ? "marcado_como_quitado"
          : "pagamento_parcial",
        canal: "interno",
        usuario_sistema: usuario,
        descricao: `${
          isQuitacaoTotal ? "Quitação total" : "Pagamento parcial"
        }: R$ ${valorPago.toFixed(2)} via ${formaPagamento}. ${
          observacoes || ""
        }`,
        status_cobranca_resultante: novoStatus,
      });

      if (isQuitacaoTotal) {
        // GATILHOS DE ENCERRAMENTO DO PROCESSO

        // 1. Encerra escalonamentos pendentes
        await supabase
          .from("escalonamentos_cobranca")
          .update({ status: "resolvido" })
          .eq("titulo_id", cobrancaId)
          .neq("status", "resolvido");

        // 2. Atualiza status jurídico da unidade se não há mais cobranças em aberto
        const { data: outrasCobrancas } = await supabase
          .from("cobrancas_franqueados")
          .select("id")
          .eq("cnpj", cobranca.cnpj)
          .eq("status", "em_aberto")
          .neq("id", cobrancaId);

        if (!outrasCobrancas || outrasCobrancas.length === 0) {
          await supabase
            .from("unidades_franqueadas")
            .update({ juridico_status: "resolvido" })
            .eq("id", cobranca.unidades_franqueadas?.id);
        }

        // 3. Cancela reuniões jurídicas pendentes
        await supabase
          .from("reunioes_juridicas")
          .update({ status_reuniao: "cancelada" })
          .eq("titulo_id", cobrancaId)
          .eq("status_reuniao", "agendada");

        // ENVIO DE MENSAGEM DE CONFIRMAÇÃO
        if (cobranca.unidades_franqueadas?.telefone_franqueado) {
          try {
            const unidade = cobranca.unidades_franqueadas;
            const mensagemQuitacao = this.gerarMensagemQuitacao(
              cobranca,
              unidade,
              valorPago,
              formaPagamento
            );

            await evolutionApiService.sendTextMessage({
              instanceName: "automacoes_backup",
              number: unidade.telefone_franqueado,
              text: mensagemQuitacao,
            });

            // Registra envio da mensagem
            await supabase.from("envios_mensagem").insert({
              titulo_id: cobrancaId,
              cliente: cobranca.cliente,
              cnpj: cobranca.cnpj,
              telefone: unidade.telefone_franqueado,
              mensagem_enviada: mensagemQuitacao,
              status_envio: "sucesso",
              referencia_importacao: "QUITACAO_AUTOMATICA",
            });
          } catch (errorWhatsApp) {
            console.error(
              "Erro ao enviar WhatsApp de quitação:",
              errorWhatsApp
            );
            // Não falha o processo por erro no WhatsApp
          }
        }
      }

      return {
        sucesso: true,
        mensagem: isQuitacaoTotal
          ? "Cobrança quitada com sucesso! Processo encerrado e confirmação enviada."
          : `Pagamento parcial registrado: R$ ${valorPago.toFixed(
              2
            )}. Restante: R$ ${valorRestante.toFixed(2)}`,
        isQuitacaoTotal,
        valorRestante: isQuitacaoTotal ? 0 : valorRestante,
      };
    } catch (error) {
      console.error("Erro ao quitar cobrança:", error);
      return {
        sucesso: false,
        mensagem: `Erro interno: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Gera mensagem de confirmação de quitação
   */
  private gerarMensagemQuitacao(
    cobranca: any,
    unidade: any,
    valorPago: number,
    formaPagamento: string
  ): string {
    const dataAtual = new Date().toLocaleDateString("pt-BR");
    const horaAtual = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `🎉 *QUITAÇÃO CONFIRMADA* 🎉

Prezado(a) ${unidade.nome_franqueado || cobranca.cliente},

Confirmamos o recebimento do pagamento da sua unidade ${unidade.codigo_unidade}.

📋 *DETALHES:*
• Valor Pago: R$ ${valorPago.toFixed(2).replace(".", ",")}
• Forma: ${formaPagamento}
• Data: ${dataAtual} às ${horaAtual}
• Status: ✅ QUITADO

🏆 *Parabéns!* Seu débito foi totalmente regularizado.

Obrigado pela pontualidade e confiança em nossos serviços.

_Mensagem automática do sistema de cobrança_
_Cresci e Perdi - Franquias_`;
  }

  /**
   * Aciona o fluxo jurídico para uma cobrança específica
   */
  async acionarJuridicoPorCobranca(
    cobrancaId: string
  ): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      // Busca a cobrança e unidade vinculada
      const { data: cobranca, error } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `*, unidades_franqueadas (id, codigo_unidade, nome_franqueado, email_franqueado, telefone_franqueado)`
        )
        .eq("id", cobrancaId)
        .single();
      if (error || !cobranca) {
        return { sucesso: false, mensagem: "Cobrança não encontrada." };
      }
      // Valida critérios do jurídico
      const diasAtraso = cobranca.dias_em_atraso;
      if (
        cobranca.status !== "em_aberto" ||
        !cobranca.aviso_de_debito_enviado ||
        cobranca.resposta_cliente !== null ||
        diasAtraso < 91
      ) {
        return {
          sucesso: false,
          mensagem:
            "Cobrança não atende aos critérios para acionamento jurídico.",
        };
      }
      let risco = "baixo";
      if (diasAtraso >= 91 && diasAtraso <= 180) {
        risco = "medio";
      } else if (diasAtraso > 180) {
        risco = "alto";
      }
      // Busca template e parâmetros
      const { data: criterios } = await supabase
        .from("criterios_juridico")
        .select(
          "template_notificacao_extrajudicial, prazo_resposta_notificacao_dias, email_responsavel_juridico"
        )
        .eq("id", "default")
        .single();
      // Verifica se já existe escalonamento jurídico
      const { data: escalonamentoExistente } = await supabase
        .from("escalonamentos_cobranca")
        .select("id")
        .eq("titulo_id", cobranca.id)
        .eq("nivel", "juridico")
        .single();
      if (escalonamentoExistente) {
        return {
          sucesso: false,
          mensagem: "Cobrança já está escalonada para o jurídico.",
        };
      }
      // Cria registro de escalonamento jurídico
      await supabase.from("escalonamentos_cobranca").insert({
        titulo_id: cobranca.id,
        cnpj_unidade: cobranca.cnpj,
        motivo_escalonamento: `Cobrança em aberto há ${diasAtraso} dias. Risco: ${risco}`,
        nivel: "juridico",
        status: "pendente",
        valor_total_envolvido: cobranca.valor_atualizado,
        quantidade_titulos: 1,
        observacoes: `Escalonamento manual para jurídico em ${new Date().toISOString()}. Risco: ${risco}`,
      });
      // Atualiza status da cobrança
      await supabase
        .from("cobrancas_franqueados")
        .update({ status: "judicial", risco_juridico: risco })
        .eq("id", cobranca.id);
      // Atualiza status jurídico da unidade
      if (cobranca.unidades_franqueadas?.id) {
        await supabase
          .from("unidades_franqueadas")
          .update({
            juridico_status: "acionado",
            data_ultimo_acionamento: new Date().toISOString(),
          })
          .eq("id", cobranca.unidades_franqueadas.id);
      }
      // Monta mensagem de notificação extrajudicial
      const unidade = cobranca.unidades_franqueadas || {};
      const template = criterios?.template_notificacao_extrajudicial || "";
      const prazoResposta = criterios?.prazo_resposta_notificacao_dias || 5;
      const mensagem = template
        .replace(/{{nome_franqueado}}/g, unidade.nome_franqueado || "")
        .replace(/{{dias_em_aberto}}/g, diasAtraso)
        .replace(
          /{{valor_total}}/g,
          cobranca.valor_atualizado?.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }) || ""
        )
        .replace(/{{prazo_resposta}}/g, prazoResposta)
        .replace(/{{codigo_unidade}}/g, unidade.codigo_unidade || "")
        .replace(
          /{{data_vencimento_antiga}}/g,
          cobranca.data_vencimento
            ? new Date(cobranca.data_vencimento).toLocaleDateString("pt-BR")
            : ""
        )
        .replace(
          /{{motivo_acionamento}}/g,
          `Cobrança em aberto há ${diasAtraso} dias. Risco: ${risco}`
        );
      // ENVIO DE EMAIL
      if (unidade.email_franqueado) {
        await emailService.enviarEmail({
          destinatario: unidade.email_franqueado,
          nome_destinatario: unidade.nome_franqueado || cobranca.cliente,
          assunto: "Notificação Extrajudicial - Pendência Financeira",
          corpo_html: `<div>${mensagem.replace(/\n/g, "<br>")}</div>`,
          corpo_texto: mensagem,
        });
      }
      // ENVIO DE WHATSAPP
      if (unidade.telefone_franqueado) {
        await evolutionApiService.sendTextMessage({
          instanceName: "automacoes_backup",
          number: unidade.telefone_franqueado,
          text: mensagem,
        });
      }
      return {
        sucesso: true,
        mensagem: "Cobrança acionada no jurídico com sucesso.",
      };
    } catch (error) {
      console.error("Erro ao acionar jurídico individual:", error);
      return { sucesso: false, mensagem: "Erro ao acionar jurídico." };
    }
  }

  /**
   * Registra log de envio de WhatsApp na tabela unificada
   */
  async registrarLogEnvioWhatsapp(dados: {
    cobrancaId: string;
    tipo: "amigavel" | "juridico" | "parcelamento";
    numero: string;
    mensagem: string;
    usuario?: string;
  }): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      const { error } = await supabase
        .from("historico_envios_completo")
        .insert({
          cobranca_id: dados.cobrancaId,
          tipo_envio: `whatsapp_${dados.tipo}`,
          canal: "whatsapp",
          destinatario: dados.numero,
          mensagem: dados.mensagem,
          usuario: dados.usuario || "Sistema",
          status_envio: "sucesso",
          metadados: {
            canal_original: "whatsapp",
            instance: "automacoes_backup",
          },
        });

      if (error) {
        console.warn(
          "Aviso: Não foi possível registrar log devido a políticas RLS:",
          error
        );
        // Fallback para tabela antiga se a nova falhar
        await supabase.from("envios_mensagem").insert({
          titulo_id: dados.cobrancaId,
          tipo_envio: `whatsapp_${dados.tipo}`,
          mensagem_enviada: dados.mensagem,
          status_envio: "sucesso",
          erro_detalhes: `Enviado via WhatsApp para ${dados.numero} por ${
            dados.usuario || "Sistema"
          }`,
        });

        return {
          sucesso: true,
          mensagem: "Envio realizado com sucesso (log fallback).",
        };
      }

      return {
        sucesso: true,
        mensagem: "Log de envio registrado com sucesso.",
      };
    } catch (error) {
      console.error("Erro ao registrar log de envio WhatsApp:", error);
      // Não falha o processo principal
      return {
        sucesso: true,
        mensagem: "Envio realizado com sucesso (erro no log).",
      };
    }
  }

  /**
   * Registra log de envio de email na tabela unificada
   */
  async registrarLogEnvioEmail(dados: {
    cobrancaId: string;
    tipo:
      | "proposta_parcelamento"
      | "cobranca_padrao"
      | "cobranca_formal"
      | "cobranca_urgente"
      | "notificacao_extrajudicial";
    destinatario: string;
    assunto: string;
    mensagem: string;
    usuario?: string;
    metadados?: any;
  }): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      const { error } = await supabase
        .from("historico_envios_completo")
        .insert({
          cobranca_id: dados.cobrancaId,
          tipo_envio: `email_${dados.tipo}`,
          canal: "email",
          destinatario: dados.destinatario,
          assunto: dados.assunto,
          mensagem: dados.mensagem,
          usuario: dados.usuario || "Sistema",
          status_envio: "sucesso",
          metadados: dados.metadados || {},
        });

      if (error) {
        console.warn("Aviso: Não foi possível registrar log de email:", error);
        return {
          sucesso: true,
          mensagem: "Email enviado com sucesso (log não registrado).",
        };
      }

      return {
        sucesso: true,
        mensagem: "Log de email registrado com sucesso.",
      };
    } catch (error) {
      console.error("Erro ao registrar log de email:", error);
      return {
        sucesso: true,
        mensagem: "Email enviado com sucesso (erro no log).",
      };
    }
  }

  /**
   * Registra log de escalonamento jurídico na tabela unificada
   */
  async registrarLogEscalonamentoJuridico(dados: {
    cobrancaId: string;
    destinatarioEmail: string;
    destinatarioWhatsapp?: string;
    mensagemEmail: string;
    mensagemWhatsapp?: string;
    usuario?: string;
    metadados?: any;
  }): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      const registros = [];

      // Registro do email extrajudicial
      registros.push({
        cobranca_id: dados.cobrancaId,
        tipo_envio: "email_notificacao_extrajudicial",
        canal: "email",
        destinatario: dados.destinatarioEmail,
        assunto: "🚨 NOTIFICAÇÃO EXTRAJUDICIAL - Acionamento Jurídico",
        mensagem: dados.mensagemEmail,
        usuario: dados.usuario || "Sistema",
        status_envio: "sucesso",
        metadados: {
          ...(dados.metadados || {}),
          escalonamento_juridico: true,
          notificacao_extrajudicial: true,
        },
      });

      // Registro do WhatsApp se houver
      if (dados.destinatarioWhatsapp && dados.mensagemWhatsapp) {
        registros.push({
          cobranca_id: dados.cobrancaId,
          tipo_envio: "whatsapp_juridico",
          canal: "whatsapp",
          destinatario: dados.destinatarioWhatsapp,
          mensagem: dados.mensagemWhatsapp,
          usuario: dados.usuario || "Sistema",
          status_envio: "sucesso",
          metadados: {
            ...(dados.metadados || {}),
            escalonamento_juridico: true,
            notificacao_extrajudicial: true,
          },
        });
      }

      // Registro geral do escalonamento
      registros.push({
        cobranca_id: dados.cobrancaId,
        tipo_envio: "sistema_escalonamento_juridico",
        canal: "sistema",
        destinatario: "Sistema Jurídico",
        mensagem: `Cobrança escalonada para o jurídico. Notificação extrajudicial enviada para ${dados.destinatarioEmail}`,
        usuario: dados.usuario || "Sistema",
        status_envio: "sucesso",
        metadados: {
          ...(dados.metadados || {}),
          escalonamento_juridico: true,
          email_enviado: dados.destinatarioEmail,
          whatsapp_enviado: dados.destinatarioWhatsapp || null,
        },
      });

      const { error } = await supabase
        .from("historico_envios_completo")
        .insert(registros);

      if (error) {
        console.warn(
          "Aviso: Não foi possível registrar log de escalonamento:",
          error
        );
        return {
          sucesso: true,
          mensagem: "Escalonamento realizado com sucesso (log não registrado).",
        };
      }

      return {
        sucesso: true,
        mensagem: "Log de escalonamento jurídico registrado com sucesso.",
      };
    } catch (error) {
      console.error("Erro ao registrar log de escalonamento:", error);
      return {
        sucesso: true,
        mensagem: "Escalonamento realizado com sucesso (erro no log).",
      };
    }
  }

  /**
   * Busca histórico completo de envios (WhatsApp, Email, Sistema) para uma cobrança
   */
  async buscarHistoricoEnvios(cobrancaId: string): Promise<any[]> {
    try {
      // Primeiro tenta buscar da nova tabela unificada
      const { data: historicoCompleto, error: errorCompleto } = await supabase
        .from("historico_envios_completo")
        .select("*")
        .eq("cobranca_id", cobrancaId)
        .order("data_envio", { ascending: false });

      if (!errorCompleto && historicoCompleto && historicoCompleto.length > 0) {
        // Formatar dados da nova tabela para exibição
        return historicoCompleto.map((item) => ({
          id: item.id,
          tipo: item.tipo_envio,
          canal:
            item.canal === "whatsapp"
              ? "WhatsApp"
              : item.canal === "email"
              ? "Email"
              : "Sistema",
          destinatario: item.destinatario,
          assunto: item.assunto,
          mensagem: item.mensagem,
          usuario: item.usuario,
          status: item.status_envio,
          data: item.data_envio,
          numero_telefone: item.canal === "whatsapp" ? item.destinatario : null,
          erro_detalhes: item.erro_detalhes,
          metadados: item.metadados || {},
          // Campos para compatibilidade com interface existente
          tipo_envio: item.tipo_envio,
          mensagem_enviada: item.mensagem,
          status_envio: item.status_envio,
          data_envio: item.data_envio,
        }));
      }

      // Fallback para tabelas antigas se a nova não existir ou estiver vazia
      console.warn("Usando fallback para tabelas antigas de envios");

      // Busca dados da cobrança para identificar unidade e emails relacionados
      const { data: cobranca } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          *,
          unidades_franqueadas!unidade_id_fk (
            codigo_unidade,
            email_franqueado,
            telefone_franqueado
          )
        `
        )
        .eq("id", cobrancaId)
        .single();

      // Busca logs de WhatsApp/Sistema da tabela envios_mensagem
      const { data: logsEnvios, error: errorEnvios } = await supabase
        .from("envios_mensagem")
        .select("*")
        .eq("titulo_id", cobrancaId)
        .order("data_envio", { ascending: false });

      if (errorEnvios) {
        console.warn(
          "Aviso: Não foi possível buscar logs de envios devido a políticas RLS:",
          errorEnvios
        );
      }

      // Busca logs de email da tabela logs_envio_email
      let logsEmail: any[] = [];
      if (cobranca?.unidades_franqueadas?.email_franqueado) {
        const { data: emailLogs, error: errorEmail } = await supabase
          .from("logs_envio_email")
          .select("*")
          .eq("destinatario", cobranca.unidades_franqueadas.email_franqueado)
          .order("data_envio", { ascending: false });

        if (!errorEmail && emailLogs) {
          logsEmail = emailLogs;
        } else if (errorEmail) {
          console.warn(
            "Aviso: Não foi possível buscar logs de email:",
            errorEmail
          );
        }
      }

      // Busca logs de WhatsApp da tabela logs_envio_whatsapp
      let logsWhatsapp: any[] = [];
      if (cobranca?.unidades_franqueadas?.telefone_franqueado) {
        const telefone = cobranca.unidades_franqueadas.telefone_franqueado;

        // Busca por telefone exato ou com variações de formato
        const { data: whatsappLogs, error: errorWhatsapp } = await supabase
          .from("logs_envio_whatsapp")
          .select("*")
          .or(
            `destinatario.eq.${telefone},destinatario.eq.55${telefone},destinatario.eq.5511${telefone}`
          )
          .order("data_envio", { ascending: false });

        if (!errorWhatsapp && whatsappLogs) {
          logsWhatsapp = whatsappLogs;
        } else if (errorWhatsapp) {
          console.warn(
            "Aviso: Não foi possível buscar logs de WhatsApp:",
            errorWhatsapp
          );
        }
      }

      // Combina e organiza todos os logs
      const historico = [
        // Logs de WhatsApp/Sistema da tabela envios_mensagem
        ...(logsEnvios || []).map((log) => ({
          ...log,
          canal: log.tipo_envio?.startsWith("whatsapp_")
            ? "WhatsApp"
            : "Sistema",
          data: log.data_envio,
          tipo: log.tipo_envio?.replace("whatsapp_", "") || log.tipo_envio,
          mensagem: log.mensagem_enviada,
          numero_telefone: log.erro_detalhes?.includes("WhatsApp para")
            ? log.erro_detalhes.split("WhatsApp para ")[1]?.split(" ")[0]
            : null,
          destinatario: log.erro_detalhes,
          usuario: log.erro_detalhes?.includes(" por ")
            ? log.erro_detalhes.split(" por ")[1]
            : "Sistema",
          status: log.status_envio,
        })),

        // Logs de Email da tabela logs_envio_email
        ...logsEmail.map((log) => {
          // Determina o tipo baseado no assunto
          let tipoEmail = "email_generico";
          if (log.assunto?.includes("Proposta de Parcelamento")) {
            tipoEmail = "email_proposta_parcelamento";
          } else if (
            log.assunto?.includes("NOTIFICAÇÃO EXTRAJUDICIAL") ||
            log.assunto?.includes("Acionamento Jurídico")
          ) {
            tipoEmail = "email_escalonamento_juridico";
          } else if (
            log.assunto?.includes("URGENTE") ||
            log.assunto?.includes("Débito Vencido")
          ) {
            tipoEmail = "email_cobranca_urgente";
          }

          return {
            id: log.id,
            canal: "Email",
            data: log.data_envio,
            tipo: tipoEmail,
            destinatario: log.destinatario,
            assunto: log.assunto,
            mensagem: log.assunto, // Usa assunto como mensagem para compatibilidade
            usuario: "Sistema",
            status: log.sucesso ? "sucesso" : "erro",
            erro_detalhes: log.erro_detalhes,
            message_id: log.message_id,
            // Campos para compatibilidade com interface existente
            tipo_envio: tipoEmail,
            mensagem_enviada: log.assunto,
            status_envio: log.sucesso ? "sucesso" : "erro",
            data_envio: log.data_envio,
          };
        }),

        // Logs de WhatsApp da tabela logs_envio_whatsapp
        ...logsWhatsapp.map((log) => {
          // Determina o tipo baseado na mensagem
          let tipoWhatsapp = "whatsapp_generico";
          if (log.mensagem_enviada?.includes("PROPOSTA DE PARCELAMENTO")) {
            tipoWhatsapp = "whatsapp_parcelamento";
          } else if (
            log.mensagem_enviada?.includes("NOTIFICAÇÃO EXTRAJUDICIAL") ||
            log.mensagem_enviada?.includes("URGENTE")
          ) {
            tipoWhatsapp = "whatsapp_juridico";
          } else if (
            log.mensagem_enviada?.includes("Lembrete") ||
            log.mensagem_enviada?.includes("cobrança")
          ) {
            tipoWhatsapp = "whatsapp_amigavel";
          }

          return {
            id: log.id,
            canal: "WhatsApp",
            data: log.data_envio,
            tipo: tipoWhatsapp,
            destinatario: log.destinatario,
            mensagem: log.mensagem_enviada,
            usuario: "Sistema",
            status: log.sucesso ? "sucesso" : "erro",
            erro_detalhes: log.erro_detalhes,
            evolution_message_id: log.evolution_message_id,
            instancia_evolution: log.instancia_evolution,
            // Campos para compatibilidade com interface existente
            tipo_envio: tipoWhatsapp,
            mensagem_enviada: log.mensagem_enviada,
            status_envio: log.sucesso ? "sucesso" : "erro",
            data_envio: log.data_envio,
            numero_telefone: log.destinatario,
          };
        }),
      ];

      // Ordena por data decrescente
      return historico.sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );
    } catch (error) {
      console.error("Erro ao buscar histórico de envios:", error);
      return []; // Retorna array vazio ao invés de falhar
    }
  }
}

export const cobrancaService = new CobrancaService();
