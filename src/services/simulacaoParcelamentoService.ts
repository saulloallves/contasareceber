/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./databaseService";
import { formatarCNPJCPF } from "../utils/formatters";
import {
  ISimulacaoParcelamento,
  ParcelaSimulacao,
  PropostaParcelamento,
  RegistroAceite,
  ConfiguracaoParcelamento,
  FiltrosSimulacao,
  EstatisticasParcelamento,
} from "../types/simulacaoParcelamento";
import { TrativativasService } from "./tratativasService";
import { n8nService } from "./n8nService";
import { emailService } from "./emailService";

export class SimulacaoParcelamentoService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Simula parcelamento com juros
   */
  async simularParcelamento(
    cobrancaIds: string[],
    quantidadeParcelas: number,
    dataPrimeiraParcela: string,
    valorEntrada?: number
  ): Promise<ISimulacaoParcelamento> {
    try {
      // Validação inicial
      if (!cobrancaIds || cobrancaIds.length === 0) {
        throw new Error("Pelo menos uma cobrança deve ser selecionada");
      }

      // Busca dados das cobranças selecionadas
      const { data: cobrancas, error } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          *,
          unidades_franqueadas!left (
            codigo_unidade,
            nome_unidade,
            email_unidade,
            telefone_unidade,
            franqueado_unidades!left (
              franqueados!left (
                nome_completo,
                email,
                telefone
              )
            )
          )
        `
        )
        .in("id", cobrancaIds);

      if (error || !cobrancas || cobrancas.length === 0) {
        throw new Error("Cobranças não encontradas");
      }

      // Validar que todas as cobranças pertencem ao mesmo CNPJ/CPF
            nome_unidade,
            email_unidade,
            telefone_unidade,
            franqueado_unidades!left (
              franqueados!left (
                nome_completo,
                email,
                telefone
              )
            )
      if (documentoUnico.length !== 1) {
        throw new Error("Todas as cobranças devem pertencer ao mesmo CNPJ/CPF");
      }
        .in("id", cobrancaIds);

      if (error || !cobrancas || cobrancas.length === 0) {
        throw new Error("Cobranças não encontradas");
      const valorAtualizadoTotal = cobrancas.reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original || 0), 0);

      // Validar que todas as cobranças pertencem ao mesmo CNPJ/CPF
      const documentos = cobrancas.map(c => c.cnpj || c.cpf).filter(Boolean);
      const documentoUnico = [...new Set(documentos)];
      
      if (documentoUnico.length !== 1) {
        throw new Error("Todas as cobranças devem pertencer ao mesmo CNPJ/CPF");
      }

      const cnpjUnidade = documentoUnico[0];

      // Calcular valores totais
      const valorOriginalTotal = cobrancas.reduce((sum, c) => sum + (c.valor_original || 0), 0);
      const valorAtualizadoTotal = cobrancas.reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original || 0), 0);

      // Busca configuração
      const config = await this.buscarConfiguracao();

      // Validação de valor mínimo
      if (valorAtualizadoTotal < 500) {
        throw new Error("Valor mínimo para parcelamento é R$ 500,00");
      }

      // Validação de valor mínimo
      if (valorAtualizadoTotal < 500) {
        throw new Error("Valor mínimo para parcelamento é R$ 500,00");
      }

      // Valida parâmetros
      if (
        quantidadeParcelas < 3 ||
        quantidadeParcelas > 42
      ) {
        throw new Error(
          `Quantidade de parcelas deve estar entre 3 e ${config.quantidade_maxima_parcelas}`
        );
      const valorParcelar = valorAtualizadoTotal - (valorEntrada || 0);

      if (valorParcelar <= 0) {
        throw new Error("Valor a parcelar deve ser maior que zero");
      }

      // Criar parcelamento master primeiro
      const { data: parcelamentoMaster, error: errorMaster } = await supabase
        .from("parcelamentos_master")
        .insert({
          cnpj_unidade: cnpjUnidade,
          valor_total_original_parcelado: valorOriginalTotal,
          valor_total_atualizado_parcelado: valorAtualizadoTotal,
          status: 'proposto'
        })
        .select()
        .single();

      if (errorMaster || !parcelamentoMaster) {
        throw new Error(`Erro ao criar parcelamento master: ${errorMaster?.message}`);
      }

      // Criar parcelamento master primeiro
      const { data: parcelamentoMaster, error: errorMaster } = await supabase
        .from("parcelamentos_master")
        .insert({
          cnpj_unidade: cnpjUnidade,
          valor_total_original_parcelado: valorOriginalTotal,
          valor_total_atualizado_parcelado: valorAtualizadoTotal,
          status: 'proposto'
        })
        .select()
        .single();

      if (errorMaster || !parcelamentoMaster) {
        throw new Error(`Erro ao criar parcelamento master: ${errorMaster?.message}`);
      }

      // Calcula parcelas com juros
      const parcelas: ParcelaSimulacao[] = [];
      let valorTotalParcelamento = valorEntrada || 0;

      for (let i = 1; i <= quantidadeParcelas; i++) {
        const valorBaseParcela = valorParcelar / quantidadeParcelas;

        // Calcula multa (10%) e juros de mora (1.5%)
        const multa = valorBaseParcela * 0.1; // 10% de multa
        const jurosMora = valorBaseParcela * 0.015; // 1.5% de juros de mora
        const jurosAplicado = multa + jurosMora;

        const valorParcela = valorBaseParcela + jurosAplicado;

        // Calcula data de vencimento
        const dataVencimento = new Date(dataPrimeiraParcela);
        dataVencimento.setDate(
          dataVencimento.getDate() + (i - 1) * config.dias_entre_parcelas
        );

        parcelas.push({
          numero: i,
          valor: valorParcela,
          data_vencimento: dataVencimento.toISOString().split("T")[0],
          juros_aplicado: jurosAplicado,
          multa: multa,
          juros_mora: jurosMora,
        });

        valorTotalParcelamento += valorParcela;
      }

      // Valida valor mínimo da parcela
      const menorParcela = Math.min(...parcelas.map((p) => p.valor));
      if (menorParcela <= config.valor_minimo_parcela) {
        throw new Error(
          `Valor mínimo da parcela: R$ ${config.valor_minimo_parcela.toFixed(
            2
          )}`
        );
      }

      const simulacao: ISimulacaoParcelamento = {
        parcelamento_master_id: parcelamentoMaster.id,
        cnpj_unidade: cnpjUnidade,
        valor_original: valorOriginalTotal,
        valor_atualizado: valorAtualizadoTotal,
        valor_atualizado: valorAtualizadoTotal,
        quantidade_parcelas: quantidadeParcelas,
        valor_entrada: valorEntrada,
        percentual_multa: 10.0,
        percentual_juros_mora: 1.5,
        data_primeira_parcela: dataPrimeiraParcela,
        parcelas,
        valor_total_parcelamento: valorTotalParcelamento,
        economia_total: valorEntrada ? valorEntrada * 0.05 : 0, // 5% de desconto na entrada
        cobrancas_origem_ids: cobrancaIds,
        metadados_consolidacao: {
          quantidade_cobrancas: cobrancas.length,
          titulos_ids: cobrancaIds,
          descricao_cobrancas: cobrancas.map(c => ({
            id: c.id,
            descricao: c.descricao || c.cliente,
            valor_original: c.valor_original,
            valor_atualizado: c.valor_atualizado || c.valor_original,
            data_vencimento: c.data_vencimento
          }))
        }
        cobrancas_origem_ids: cobrancaIds,
      };

      return simulacao;
    } catch (error) {
      console.error("Erro ao simular parcelamento:", error);
      throw error;
    }
  }

  /**
   * Salva simulação no banco
   */
  async salvarSimulacao(simulacao: ISimulacaoParcelamento): Promise<string> {
    try {
      const { data, error } = await supabase
        .from("simulacoes_parcelamento")
        .insert(simulacao)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao salvar simulação: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error("Erro ao salvar simulação:", error);
      throw error;
    }
  }

  /**
   * Gera proposta automática
   */
  async gerarProposta(
    simulacaoId: string,
    canaisEnvio: ("whatsapp" | "email")[],
    usuario: string
  ): Promise<PropostaParcelamento> {
    try {
      // Busca dados da simulação com parcelamento master
      const { data: simulacao } = await supabase
        .from("simulacoes_parcelamento")
        .select(
          `
          *,
          parcelamentos_master!left (
            cnpj_unidade,
            valor_total_original_parcelado,
            valor_total_atualizado_parcelado
          )
        `
        )
        .eq("id", simulacaoId)
        .single();

      if (!simulacao) {
        throw new Error("Simulação não encontrada");
      }

      // Buscar dados das cobranças originais para contexto
      const { data: cobrancasOriginais } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          *,
          unidades_franqueadas!left (
            nome_unidade,
            email_unidade,
            telefone_unidade,
            franqueado_unidades!left (
              franqueados!left (
                nome_completo,
                email,
                telefone
              )
              franqueado_unidades!left (
                franqueados!left (
                  nome_completo,
                  email,
                  telefone
                )
              )
            )
          )
        `
        )
        .in("id", simulacao.cobrancas_origem_ids);

      const cobranca = cobrancasOriginais?.[0]; // Usar primeira cobrança para dados de contexto
      const unidade = cobranca?.unidades_franqueadas || null;
      const franqueado = unidade?.franqueado_unidades?.[0]?.franqueados || null;

      const config = await this.buscarConfiguracao();
      const cobranca = (simulacao as any).cobrancas_franqueados;

      // Gera mensagem personalizada
      const mensagem = this.gerarMensagemProposta(
        simulacao,
        {
          ...cobranca,
          cliente: `${cobrancasOriginais?.length || 1} cobrança(s) consolidada(s)`
        },
        unidade,
        franqueado,
        franqueado,
        config
      );

      // Calcula data de expiração
      const dataExpiracao = new Date();
      dataExpiracao.setDate(
        dataExpiracao.getDate() + config.prazo_validade_proposta_dias
      );

      const proposta: Omit<
        PropostaParcelamento,
        "id" | "created_at" | "updated_at"
      > = {
        simulacao_id: simulacaoId,
        parcelamento_master_id: simulacao.parcelamento_master_id,
        cnpj_unidade: simulacao.cnpj_unidade,
        mensagem_proposta: mensagem,
        canais_envio: canaisEnvio,
        enviado_por: usuario,
        status_proposta: "enviada",
        data_expiracao: dataExpiracao.toISOString(),
      };

      const { data, error } = await supabase
        .from("propostas_parcelamento")
        .insert(proposta)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar proposta: ${error.message}`);
      }

      // Registra tratativa para todas as cobranças originais
      for (const cobrancaId of simulacao.cobrancas_origem_ids) {
        await this.tratativasService.registrarObservacao(
          cobrancaId,
          usuario,
          `Proposta de parcelamento gerada: ${
            simulacao.quantidade_parcelas
          }x com juros de ${
            simulacao.percentual_juros_mora
          }%. Válida até ${dataExpiracao.toLocaleDateString("pt-BR")}. Consolidando ${simulacao.cobrancas_origem_ids.length} cobrança(s).`
        );
      }

      return data;
    } catch (error) {
      console.error("Erro ao gerar proposta:", error);
      throw error;
    }
  }

  /**
   * Envia proposta via WhatsApp
   */
  async enviarPropostaWhatsApp(propostaId: string): Promise<boolean> {
    let logId: string | null = null;
    try {
      const { data: proposta } = await supabase
        .from("propostas_parcelamento")
        .select(
          `
          *,
          parcelamentos_master!left (
            cnpj_unidade
          )
        `
        )
        .eq("id", propostaId)
        .single();

      if (!proposta) {
        throw new Error("Proposta não encontrada");
      }

      // Buscar dados das cobranças originais para obter telefone
      const { data: simulacao } = await supabase
        .from("simulacoes_parcelamento")
        .select("cobrancas_origem_ids")
        .eq("parcelamento_master_id", proposta.parcelamento_master_id)
        .single();

      if (!simulacao) {
        throw new Error("Simulação não encontrada");
      }

      const { data: cobrancasOriginais } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          telefone,
          unidades_franqueadas!left (
            telefone_unidade,
            franqueado_unidades!left (
              franqueados!left (
                telefone
              )
            )
          )
        `
        )
        .in("id", simulacao.cobrancas_origem_ids)
        .limit(1);

      const cobranca = cobrancasOriginais?.[0];
      const unidade = cobranca?.unidades_franqueadas;
      const telefone =
        cobranca?.telefone ||
        unidade?.telefone_unidade ||
        unidade?.franqueado_unidades?.[0]?.franqueados?.telefone;

      if (!telefone) {
        throw new Error("Telefone não cadastrado para esta unidade.");
      }

      // Pré-registra a tentativa de envio no log
      const { data: logData, error: logError } = await supabase
        .from("logs_envio_whatsapp")
        .insert({
          destinatario: telefone,
          mensagem_enviada: proposta.mensagem_proposta,
          instancia_evolution: "automacoes_3", // Instância padrão n8n
          sucesso: false, // Começa como falha
        })
        .select("id")
        .single();

      if (logError) {
        console.error("Erro ao pré-registrar log do WhatsApp:", logError);
      } else {
        logId = logData.id;
      }

      // Envia mensagem via n8nService
      const resultado = await n8nService.enviarWhatsApp({
        number: telefone,
        text: proposta.mensagem_proposta,
        instanceName: "automacoes_3",
        metadata: {
          tipo: "proposta_parcelamento",
          parcelamentoMasterId: proposta.parcelamento_master_id,
          propostaId: propostaId,
          origem: "simulacao_parcelamento",
          cobrancasOriginais: simulacao.cobrancas_origem_ids.length,
        },
      });

      if (!resultado.success) {
        throw new Error("Falha no envio da mensagem via n8n");
      }

      // Atualiza o log com sucesso
      if (logId) {
        await supabase
          .from("logs_envio_whatsapp")
          .update({
            sucesso: true,
            evolution_message_id: resultado.messageId || "N/A",
          })
          .eq("id", logId);
      }

      await supabase
        .from("propostas_parcelamento")
        .update({
          data_envio: new Date().toISOString(),
          canais_envio: Array.from(
            new Set([...proposta.canais_envio, "whatsapp"])
          ),
        })
        .eq("id", propostaId);

      return true;
    } catch (error) {
      console.error(
        "Erro ao enviar proposta via WhatsApp (API Evolution):",
        error
      );
      // Atualiza o log com o erro
      if (logId) {
        let errorMessage = "Erro desconhecido";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else {
          errorMessage = String(error);
        }
        await supabase
          .from("logs_envio_whatsapp")
          .update({
            sucesso: false,
            erro_detalhes: errorMessage,
          })
          .eq("id", logId);
      }
      return false;
    }
  }

  /**
   * Envia proposta via Email
   */
  async enviarPropostaEmail(propostaId: string): Promise<boolean> {
    try {
      const { data: proposta, error: propostaError } = await supabase
        .from("propostas_parcelamento")
        .select(
          `
          *,
          simulacoes_parcelamento!left(*),
          parcelamentos_master!left (
            cnpj_unidade
          )
        `
        )
        .eq("id", propostaId)
        .single();

      if (propostaError || !proposta) {
        throw new Error(`Proposta não encontrada: ${propostaError?.message}`);
      }

      // Buscar dados das cobranças originais para obter email
      const { data: simulacao } = await supabase
        .from("simulacoes_parcelamento")
        .select("cobrancas_origem_ids")
        .eq("parcelamento_master_id", proposta.parcelamento_master_id)
        .single();

      if (!simulacao) {
        throw new Error("Simulação não encontrada");
      }

      const { data: cobrancasOriginais } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          email_cobranca,
          unidades_franqueadas!left (
            email_unidade,
            franqueado_unidades!left (
              franqueados!left (
                nome_completo,
                email
                )
              )
            )
          )
        `
        )
        .in("id", simulacao.cobrancas_origem_ids)
        .limit(1);

      const cobranca = cobrancasOriginais?.[0];
      const unidade = cobranca?.unidades_franqueadas;
      const email =
        cobranca?.email_cobranca ||
        unidade?.email_unidade ||
        unidade?.franqueado_unidades?.[0]?.franqueados?.email;

      if (!email) {
        throw new Error("Email não cadastrado para a unidade.");
      }

      // Usa o método do emailService para gerar o corpo do e-mail
      const template = emailService.gerarTemplatePropostaParcelamento(
        (proposta as any).simulacoes_parcelamento,
        unidade,
        {
          ...cobranca,
          cliente: `${simulacao.cobrancas_origem_ids.length} cobrança(s) consolidada(s)`
        }
      );

      const dadosEmail = {
        destinatario: email,
        nome_destinatario:
          unidade?.franqueado_unidades?.[0]?.franqueados?.nome_completo ||
          cobranca?.cliente ||
          unidade?.nome_unidade ||
          "Franqueado(a)",
        assunto: template.assunto,
        corpo_html: template.corpo_html,
        corpo_texto: template.corpo_texto,
        metadata: {
          origem: "frontend",
          via: "n8n",
          tipo: "proposta_parcelamento",
          parcelamentoMasterId: proposta.parcelamento_master_id,
          propostaId: propostaId,
          cobrancasOriginais: simulacao.cobrancas_origem_ids.length,
        },
      };

      // Envia o e-mail
      const resultadoEnvio = await emailService.enviarEmail(dadosEmail);

      if (!resultadoEnvio.sucesso) {
        throw new Error(
          resultadoEnvio.erro || "Erro desconhecido ao enviar e-mail."
        );
      }

      // Pré-registra a tentativa de envio no log
      const { data: logData, error: logError } = await supabase
        .from("logs_envio_whatsapp")
        .insert({
          destinatario: telefone,
          mensagem_enviada: proposta.mensagem_proposta,
          instancia_evolution: "automacoes_3", // Instância padrão n8n
          sucesso: false, // Começa como falha
        })
        .select("id")
        .single();

      if (logError) {
        console.error("Erro ao pré-registrar log do WhatsApp:", logError);
      } else {
        logId = logData.id;
      }

      // Envia mensagem via n8nService
      const resultado = await n8nService.enviarWhatsApp({
        number: telefone,
        text: proposta.mensagem_proposta,
        instanceName: "automacoes_3",
        metadata: {
          tipo: "proposta_parcelamento",
          cobrancaId: proposta.titulo_id, // ID da cobrança original (FK válida)
          propostaId: propostaId, // ID da proposta (para referência)
          origem: "simulacao_parcelamento",
        },
      });

      if (!resultado.success) {
        throw new Error("Falha no envio da mensagem via n8n");
      }

      // Atualiza o log com sucesso
      if (logId) {
        await supabase
          .from("logs_envio_whatsapp")
          .update({
            sucesso: true,
            evolution_message_id: resultado.messageId || "N/A",
          })
          .eq("id", logId);
      }

      await supabase
        .from("propostas_parcelamento")
        .update({
          data_envio: new Date().toISOString(),
          canais_envio: Array.from(
            new Set([...proposta.canais_envio, "whatsapp"])
          ),
        })
        .eq("id", propostaId);

      return true;
    } catch (error) {
      console.error(
        "Erro ao enviar proposta via WhatsApp (API Evolution):",
        error
      );
      // Atualiza o log com o erro
      if (logId) {
        let errorMessage = "Erro desconhecido";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else {
          errorMessage = String(error);
        }
        await supabase
          .from("logs_envio_whatsapp")
          .update({
            sucesso: false,
            erro_detalhes: errorMessage,
          })
          .eq("id", logId);
      }
      return false;
    }
  }

  /**
   * Envia proposta via Email
   */
  async enviarPropostaEmail(propostaId: string): Promise<boolean> {
    try {
      const { data: proposta, error: propostaError } = await supabase
        .from("propostas_parcelamento")
        .select(
          `
          *,
          simulacoes_parcelamento!left(*),
          cobrancas_franqueados!left (
            cliente,
            email_cobranca,
            unidades_franqueadas!left (
              email_unidade,
              codigo_unidade,
              nome_unidade,
              franqueado_unidades!left (
                franqueados!left (
                  nome_completo,
                  email
                )
              )
            )
          )
        `
        )
        .eq("id", propostaId)
        .single();

      if (propostaError || !proposta) {
        throw new Error(`Proposta não encontrada: ${propostaError?.message}`);
      }

      const cobranca = (proposta as any).cobrancas_franqueados;
      const unidade = cobranca?.unidades_franqueadas;
      const email =
        cobranca?.email_cobranca ||
        unidade?.email_unidade ||
        unidade?.franqueado_unidades?.[0]?.franqueados?.email;

      if (!email) {
        throw new Error("Email não cadastrado para a unidade.");
      }

      // Usa o método do emailService para gerar o corpo do e-mail
      const template = emailService.gerarTemplatePropostaParcelamento(
        (proposta as any).simulacoes_parcelamento,
        (proposta as any).cobrancas_franqueados.unidades_franqueadas,
        (proposta as any).cobrancas_franqueados
      );

      const dadosEmail = {
        destinatario: email,
        nome_destinatario:
          unidade?.franqueado_unidades?.[0]?.franqueados?.nome_completo ||
          cobranca?.cliente ||
          unidade?.nome_unidade,
        assunto: template.assunto,
        corpo_html: template.corpo_html,
        corpo_texto: template.corpo_texto,
        metadata: {
          origem: "frontend",
          via: "n8n",
          tipo: "proposta_parcelamento",
          cobrancaId: proposta.titulo_id, // ID da cobrança original (FK válida)
          propostaId: propostaId, // ID da proposta (para referência)
          cliente:
            unidade?.franqueado_unidades?.[0]?.franqueados?.nome_completo ||
            cobranca?.cliente ||
            "Franqueado(a)",
        },
      };

      // Envia o e-mail
      const resultadoEnvio = await emailService.enviarEmail(dadosEmail);

      if (!resultadoEnvio.sucesso) {
        throw new Error(
          resultadoEnvio.erro || "Erro desconhecido ao enviar e-mail."
        );
      }

      // Atualiza data de envio na sua base de dados
      await supabase
        .from("propostas_parcelamento")
        .update({
          data_envio: new Date().toISOString(),
          canais_envio: Array.from(
            new Set([...proposta.canais_envio, "email"])
          ),
        })
        .eq("id", propostaId);

      return true;
    } catch (error) {
      console.error("Erro ao enviar proposta por email:", error);
      return false;
    }
  }

  /**
   * Registra aceite da proposta
   */
  async registrarAceite(
    propostaId: string,
    metodoAceite: RegistroAceite["metodo_aceite"],
    ipAceite: string,
    userAgent?: string,
    observacoes?: string
  ): Promise<void> {
    try {
      const { data: proposta } = await supabase
        .from("propostas_parcelamento")
        .select("*")
        .eq("id", propostaId)
        .single();

      if (!proposta) {
        throw new Error("Proposta não encontrada");
      }

      // Buscar dados do parcelamento master e simulação
      const { data: parcelamentoMaster } = await supabase
        .from("parcelamentos_master")
        .select("*")
        .eq("id", proposta.parcelamento_master_id)
        .single();

      const { data: simulacao } = await supabase
        .from("simulacoes_parcelamento")
        .select("*")
        .eq("parcelamento_master_id", proposta.parcelamento_master_id)
        .single();

      if (!parcelamentoMaster || !simulacao) {
        throw new Error("Dados do parcelamento não encontrados");
      }

      // Atualizar status do parcelamento master
      await supabase
        .from("parcelamentos_master")
        .update({ status: 'aceito' })
        .eq("id", proposta.parcelamento_master_id);

      // Buscar dados do parcelamento master e simulação
      const { data: parcelamentoMaster } = await supabase
        .from("parcelamentos_master")
        .select("*")
        .eq("id", proposta.parcelamento_master_id)
        .single();

      const { data: simulacao } = await supabase
        .from("simulacoes_parcelamento")
        .select("*")
        .eq("parcelamento_master_id", proposta.parcelamento_master_id)
        .single();

      if (!parcelamentoMaster || !simulacao) {
        throw new Error("Dados do parcelamento não encontrados");
      }

      // Atualizar status do parcelamento master
      await supabase
        .from("parcelamentos_master")
        .update({ status: 'aceito' })
        .eq("id", proposta.parcelamento_master_id);

      await supabase
        .from("propostas_parcelamento")
        .update({
          status_proposta: "aceita",
          aceito_em: new Date().toISOString(),
          aceito_por: "franqueado",
          ip_aceite: ipAceite,
          observacoes_aceite: observacoes,
        })
        .eq("id", propostaId);

      const registroAceite: Omit<RegistroAceite, "id" | "created_at"> = {
        proposta_id: propostaId,
        parcelamento_master_id: proposta.parcelamento_master_id,
        cnpj_unidade: proposta.cnpj_unidade,
        data_aceite: new Date().toISOString(),
        ip_aceite: ipAceite,
        user_agent: userAgent,
        metodo_aceite: metodoAceite,
        dados_proposta: proposta,
        observacoes,
      };

      await supabase
        .from("registros_aceite_parcelamento")
        .insert(registroAceite);

      // Processar aceite: atualizar cobranças originais e criar parcelas
      await this.processarAceiteParcelamento(
        proposta.parcelamento_master_id,
        simulacao,
        metodoAceite,
        ipAceite,
        observacoes
      );

      console.log("Proposta aceita! Cobranças atualizadas e parcelas criadas.");
      // Processar aceite: atualizar cobranças originais e criar parcelas
      await this.processarAceiteParcelamento(
        proposta.parcelamento_master_id,
        simulacao,
        metodoAceite,
        ipAceite,
        observacoes
      );

      console.log("Proposta aceita! Cobranças atualizadas e parcelas criadas.");
    } catch (error) {
      console.error("Erro ao registrar aceite:", error);
      throw error;
    }
  }

  /**
   * Processa o aceite do parcelamento: atualiza cobranças originais e cria parcelas
   */
  private async processarAceiteParcelamento(
    parcelamentoMasterId: string,
    simulacao: any,
    metodoAceite: string,
    ipAceite: string,
    observacoes?: string
  ): Promise<void> {
    try {
      // 1. Atualizar status das cobranças originais para 'parcelado'
      const { error: updateError } = await supabase
        .from("cobrancas_franqueados")
        .update({
          status: 'parcelado',
          parcelamento_master_id: parcelamentoMasterId
        })
        .in("id", simulacao.cobrancas_origem_ids);

      if (updateError) {
        throw new Error(`Erro ao atualizar cobranças originais: ${updateError.message}`);
      }

      // 2. Criar acordo de parcelamento
      const { data: acordo, error: acordoError } = await supabase
        .from("acordos_parcelamento")
        .insert({
          parcelamento_master_id: parcelamentoMasterId,
          cnpj_unidade: simulacao.cnpj_unidade,
          valor_original: simulacao.valor_original,
          valor_atualizado: simulacao.valor_atualizado,
          valor_entrada: simulacao.valor_entrada || 0,
          quantidade_parcelas: simulacao.quantidade_parcelas,
          valor_parcela: simulacao.parcelas[0]?.valor || 0,
          valor_total_acordo: simulacao.valor_total_parcelamento,
          data_vencimento_entrada: simulacao.data_primeira_parcela,
          data_primeiro_vencimento: simulacao.data_primeira_parcela,
          status_acordo: 'aceito',
          aceito_em: new Date().toISOString(),
          aceito_por: 'franqueado',
          ip_aceite: ipAceite,
          observacoes: `Aceito via ${metodoAceite}. ${observacoes || ''}`
        })
        .select()
        .single();

      if (acordoError || !acordo) {
        throw new Error(`Erro ao criar acordo: ${acordoError?.message}`);
      }

      // 3. Criar entradas em parcelas_acordo e cobranças para cada parcela
      for (const parcela of simulacao.parcelas) {
        // Criar entrada em parcelas_acordo
        const { data: parcelaAcordo, error: parcelaError } = await supabase
          .from("parcelas_acordo")
          .insert({
            acordo_id: acordo.id,
            numero_parcela: parcela.numero,
            valor_parcela: parcela.valor,
            data_vencimento: parcela.data_vencimento,
            status_parcela: 'pendente'
          })
          .select()
          .single();

        if (parcelaError || !parcelaAcordo) {
          throw new Error(`Erro ao criar parcela ${parcela.numero}: ${parcelaError?.message}`);
        }

        // Criar cobrança para a parcela
        const { data: cobrancaParcela, error: cobrancaError } = await supabase
          .from("cobrancas_franqueados")
          .insert({
            cnpj: simulacao.cnpj_unidade,
            cliente: `Parcela ${parcela.numero}/${simulacao.quantidade_parcelas} - Parcelamento`,
            valor_original: parcela.valor,
            valor_atualizado: parcela.valor,
            data_vencimento: parcela.data_vencimento,
            status: 'parcelas',
            is_parcela: true,
            parcela_origem_id: parcelaAcordo.id,
            parcelamento_master_id: parcelamentoMasterId,
            referencia_importacao: `PARCELAMENTO_${parcelamentoMasterId}`,
            descricao: `Parcela ${parcela.numero} de ${simulacao.quantidade_parcelas} - Valor: R$ ${parcela.valor.toFixed(2)}`,
            tipo_cobranca: 'Parcelamento'
          })
          .select()
          .single();

        if (cobrancaError || !cobrancaParcela) {
          throw new Error(`Erro ao criar cobrança da parcela ${parcela.numero}: ${cobrancaError?.message}`);
        }

        // Vincular a parcela_acordo à cobrança criada
        await supabase
          .from("parcelas_acordo")
          .update({ cobranca_id: cobrancaParcela.id })
          .eq("id", parcelaAcordo.id);
      }

      // 4. Registrar tratativas para todas as cobranças originais
      for (const cobrancaId of simulacao.cobrancas_origem_ids) {
        await this.tratativasService.registrarObservacao(
          cobrancaId,
          "franqueado",
          `Parcelamento aceito via ${metodoAceite}. ${simulacao.quantidade_parcelas} parcelas de R$ ${simulacao.parcelas[0]?.valor.toFixed(2)}. IP: ${ipAceite}. ${observacoes || ""}`,
          "parcelado"
        );
      }

      console.log(`Parcelamento processado: ${simulacao.quantidade_parcelas} parcelas criadas para ${simulacao.cobrancas_origem_ids.length} cobranças originais`);
    } catch (error) {
      console.error("Erro ao processar aceite do parcelamento:", error);
      throw error;
    }
  }

  /**
   * Processa o aceite do parcelamento: atualiza cobranças originais e cria parcelas
   */
  private async processarAceiteParcelamento(
    parcelamentoMasterId: string,
    simulacao: any,
    metodoAceite: string,
    ipAceite: string,
    observacoes?: string
  ): Promise<void> {
    try {
      // 1. Atualizar status das cobranças originais para 'parcelado'
      const { error: updateError } = await supabase
        .from("cobrancas_franqueados")
        .update({
          status: 'parcelado',
          parcelamento_master_id: parcelamentoMasterId
        })
        .in("id", simulacao.cobrancas_origem_ids);

      if (updateError) {
        throw new Error(`Erro ao atualizar cobranças originais: ${updateError.message}`);
      }

      // 2. Criar acordo de parcelamento
      const { data: acordo, error: acordoError } = await supabase
        .from("acordos_parcelamento")
        .insert({
          parcelamento_master_id: parcelamentoMasterId,
          cnpj_unidade: simulacao.cnpj_unidade,
          valor_original: simulacao.valor_original,
          valor_atualizado: simulacao.valor_atualizado,
          valor_entrada: simulacao.valor_entrada || 0,
          quantidade_parcelas: simulacao.quantidade_parcelas,
          valor_parcela: simulacao.parcelas[0]?.valor || 0,
          valor_total_acordo: simulacao.valor_total_parcelamento,
          data_vencimento_entrada: simulacao.data_primeira_parcela,
          data_primeiro_vencimento: simulacao.data_primeira_parcela,
          status_acordo: 'aceito',
          aceito_em: new Date().toISOString(),
          aceito_por: 'franqueado',
          ip_aceite: ipAceite,
          observacoes: `Aceito via ${metodoAceite}. ${observacoes || ''}`
        })
        .select()
        .single();

      if (acordoError || !acordo) {
        throw new Error(`Erro ao criar acordo: ${acordoError?.message}`);
      }

      // 3. Criar entradas em parcelas_acordo e cobranças para cada parcela
      for (const parcela of simulacao.parcelas) {
        // Criar entrada em parcelas_acordo
        const { data: parcelaAcordo, error: parcelaError } = await supabase
          .from("parcelas_acordo")
          .insert({
            acordo_id: acordo.id,
            numero_parcela: parcela.numero,
            valor_parcela: parcela.valor,
            data_vencimento: parcela.data_vencimento,
            status_parcela: 'pendente'
          })
          .select()
          .single();

        if (parcelaError || !parcelaAcordo) {
          throw new Error(`Erro ao criar parcela ${parcela.numero}: ${parcelaError?.message}`);
        }

        // Criar cobrança para a parcela
        const { data: cobrancaParcela, error: cobrancaError } = await supabase
          .from("cobrancas_franqueados")
          .insert({
            cnpj: simulacao.cnpj_unidade,
            cliente: `Parcela ${parcela.numero}/${simulacao.quantidade_parcelas} - Parcelamento`,
            valor_original: parcela.valor,
            valor_atualizado: parcela.valor,
            data_vencimento: parcela.data_vencimento,
            status: 'parcelas',
            is_parcela: true,
            parcela_origem_id: parcelaAcordo.id,
            parcelamento_master_id: parcelamentoMasterId,
            referencia_importacao: `PARCELAMENTO_${parcelamentoMasterId}`,
            descricao: `Parcela ${parcela.numero} de ${simulacao.quantidade_parcelas} - Valor: R$ ${parcela.valor.toFixed(2)}`,
            tipo_cobranca: 'Parcelamento'
          })
          .select()
          .single();

        if (cobrancaError || !cobrancaParcela) {
          throw new Error(`Erro ao criar cobrança da parcela ${parcela.numero}: ${cobrancaError?.message}`);
        }

        // Vincular a parcela_acordo à cobrança criada
        await supabase
          .from("parcelas_acordo")
          .update({ cobranca_id: cobrancaParcela.id })
          .eq("id", parcelaAcordo.id);
      }

      // 4. Registrar tratativas para todas as cobranças originais
      for (const cobrancaId of simulacao.cobrancas_origem_ids) {
        await this.tratativasService.registrarObservacao(
          cobrancaId,
          "franqueado",
          `Parcelamento aceito via ${metodoAceite}. ${simulacao.quantidade_parcelas} parcelas de R$ ${simulacao.parcelas[0]?.valor.toFixed(2)}. IP: ${ipAceite}. ${observacoes || ""}`,
          "parcelado"
        );
      }

      console.log(`Parcelamento processado: ${simulacao.quantidade_parcelas} parcelas criadas para ${simulacao.cobrancas_origem_ids.length} cobranças originais`);
    } catch (error) {
      console.error("Erro ao processar aceite do parcelamento:", error);
      throw error;
    }
  }

  /**
   * Busca cobranças disponíveis para parcelamento por CNPJ/CPF
   */
  async buscarCobrancasParaParcelamento(cnpjCpf: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("cobrancas_franqueados")
        .select(`
          id,
          cnpj,
          cpf,
          cliente,
          valor_original,
          valor_atualizado,
          data_vencimento,
          status,
          tipo_cobranca,
          descricao,
          dias_em_atraso
        `)
        .or(`cnpj.eq.${cnpjCpf},cpf.eq.${cnpjCpf}`)
        .in("status", ["em_aberto", "em_atraso", "negociando"])
        .is("parcelamento_master_id", null) // Apenas cobranças que ainda não foram parceladas
        .eq("is_parcela", false) // Apenas cobranças originais, não parcelas
        .order("data_vencimento", { ascending: true });

      if (error) {
        throw new Error(`Erro ao buscar cobranças: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Erro ao buscar cobranças para parcelamento:", error);
      throw error;
    }
  }

  /**
   * Busca detalhes de um parcelamento master
   */
  async buscarDetalhesParcelamento(parcelamentoMasterId: string): Promise<{
    parcelamento: any;
    cobrancas_originais: any[];
    parcelas_cobrancas: any[];
    acordo: any;
  } | null> {
    try {
      // Buscar parcelamento master
      const { data: parcelamento } = await supabase
        .from("parcelamentos_master")
        .select("*")
        .eq("id", parcelamentoMasterId)
        .single();

      if (!parcelamento) return null;

      // Buscar cobranças originais
      const { data: cobrancasOriginais } = await supabase
        .from("cobrancas_franqueados")
        .select("*")
        .eq("parcelamento_master_id", parcelamentoMasterId)
        .eq("is_parcela", false);

      // Buscar parcelas (cobranças geradas)
      const { data: parcelasCobrancas } = await supabase
        .from("cobrancas_franqueados")
        .select(`
          *,
          parcelas_acordo!parcela_origem_id (
            numero_parcela,
            status_parcela,
            data_pagamento,
            valor_pago
          )
        `)
        .eq("parcelamento_master_id", parcelamentoMasterId)
        .eq("is_parcela", true)
        .order("data_vencimento", { ascending: true });

      // Buscar acordo
      const { data: acordo } = await supabase
        .from("acordos_parcelamento")
        .select("*")
        .eq("parcelamento_master_id", parcelamentoMasterId)
        .single();

      return {
        parcelamento,
        cobrancas_originais: cobrancasOriginais || [],
        parcelas_cobrancas: parcelasCobrancas || [],
        acordo
      };
    } catch (error) {
      console.error("Erro ao buscar detalhes do parcelamento:", error);
      return null;
    }
  }

  /**
   * Registra pagamento de uma parcela
   */
  async registrarPagamentoParcela(
    cobrancaParcelaId: string,
    valorPago: number,
    dataPagamento: string,
    usuario: string
  ): Promise<void> {
    try {
      // Buscar dados da cobrança da parcela
      const { data: cobrancaParcela } = await supabase
        .from("cobrancas_franqueados")
        .select("parcela_origem_id, parcelamento_master_id")
        .eq("id", cobrancaParcelaId)
        .eq("is_parcela", true)
        .single();

      if (!cobrancaParcela || !cobrancaParcela.parcela_origem_id) {
        throw new Error("Parcela não encontrada");
      }

      // Atualizar status da cobrança da parcela para quitado
      await supabase
        .from("cobrancas_franqueados")
        .update({
          status: 'quitado',
          valor_recebido: valorPago,
          data_ultima_atualizacao: dataPagamento
        })
        .eq("id", cobrancaParcelaId);

      // Atualizar parcelas_acordo
      await supabase
        .from("parcelas_acordo")
        .update({
          status_parcela: 'pago',
          valor_pago: valorPago,
          data_pagamento: dataPagamento
        })
        .eq("id", cobrancaParcela.parcela_origem_id);

      // Verificar se todas as parcelas foram pagas
      await this.verificarConclusaoParcelamento(cobrancaParcela.parcelamento_master_id);

      // Registrar tratativa
      await this.tratativasService.registrarObservacao(
        cobrancaParcelaId,
        usuario,
        `Parcela paga: R$ ${valorPago.toFixed(2)} em ${new Date(dataPagamento).toLocaleDateString("pt-BR")}`,
        "quitado"
      );
    } catch (error) {
      console.error("Erro ao registrar pagamento da parcela:", error);
      throw error;
    }
  }

  /**
   * Verifica se o parcelamento foi totalmente cumprido
   */
  private async verificarConclusaoParcelamento(parcelamentoMasterId: string): Promise<void> {
    try {
      // Buscar todas as parcelas do parcelamento
      const { data: parcelas } = await supabase
        .from("cobrancas_franqueados")
        .select("status")
        .eq("parcelamento_master_id", parcelamentoMasterId)
        .eq("is_parcela", true);

      if (!parcelas || parcelas.length === 0) return;

      // Verificar se todas estão quitadas
      const todasQuitadas = parcelas.every(p => p.status === 'quitado');

      if (todasQuitadas) {
        // Atualizar status do parcelamento master
        await supabase
          .from("parcelamentos_master")
          .update({ status: 'cumprido' })
          .eq("id", parcelamentoMasterId);

        // Atualizar acordo
        await supabase
          .from("acordos_parcelamento")
          .update({ status_acordo: 'cumprido' })
          .eq("parcelamento_master_id", parcelamentoMasterId);

        console.log(`Parcelamento ${parcelamentoMasterId} totalmente cumprido`);
      }
    } catch (error) {
      console.error("Erro ao verificar conclusão do parcelamento:", error);
    }
  }

  /**
   * Lista parcelamentos ativos
   */
  async listarParcelamentosAtivos(cnpjCpf?: string): Promise<any[]> {
    try {
      let query = supabase
        .from("parcelamentos_master")
        .select(`
          *,
          acordos_parcelamento (
            quantidade_parcelas,
            valor_parcela,
            status_acordo
          )
        `)
        .in("status", ["aceito", "proposto"])
        .order("created_at", { ascending: false });

      if (cnpjCpf) {
        query = query.eq("cnpj_unidade", cnpjCpf);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao listar parcelamentos: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Erro ao listar parcelamentos ativos:", error);
      return [];
    }
  }

  /**
   * Busca propostas com filtros
   */
  async buscarPropostas(filtros: FiltrosSimulacao = {}) {
    try {
      let query = supabase
        .from("propostas_parcelamento")
        .select(
          `
          *,
          simulacoes_parcelamento!left(*),
          parcelamentos_master!left (
            cnpj_unidade,
            valor_total_original_parcelado,
            valor_total_atualizado_parcelado
          )
        `
        )
        .order("created_at", { ascending: false });

      if (filtros.cnpj) {
        query = query.ilike("cnpj_unidade", `%${filtros.cnpj}%`);
      }

      if (filtros.status_proposta) {
        query = query.eq("status_proposta", filtros.status_proposta);
      }

      if (filtros.data_inicio) {
        query = query.gte("created_at", filtros.data_inicio);
      }

      if (filtros.data_fim) {
        query = query.lte("created_at", filtros.data_fim);
      }

      if (filtros.enviado_por) {
        query = query.ilike("enviado_por", `%${filtros.enviado_por}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar propostas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Erro ao buscar propostas:", error);
      throw error;
    }
  }

  /**
   * Gera mensagem personalizada da proposta
   */
  private gerarMensagemProposta(
    simulacao: any,
    cobrancaConsolidada: any,
    unidade: any,
    franqueado: any,
    config: ConfiguracaoParcelamento
  ): string {
    const template = config.template_whatsapp;

    // Nome do destinatário: prioriza franqueado válido; caso contrário, usa o cliente da cobrança
    const nomeCliente =
      franqueado?.nome_completo &&
      franqueado.nome_completo !== "Sem nome cadastrado"
        ? franqueado.nome_completo
        : cobrancaConsolidada?.cliente || "Franqueado(a)";

    // Documento exibível: CPF > CNPJ; fallback para código da unidade; por fim, rótulo genérico
    const documentoExibivel = simulacao.cnpj_unidade
      ? formatarCNPJCPF(String(simulacao.cnpj_unidade))
      : unidade?.codigo_unidade || "Documento";

    const variaveis = {
      "{{cliente}}": nomeCliente,
      "{{codigo_unidade}}": documentoExibivel,
      "{{valor_original}}": this.formatarMoeda(simulacao.valor_original),
      "{{valor_atualizado}}": this.formatarMoeda(simulacao.valor_atualizado),
      "{{valor_entrada}}": simulacao.valor_entrada
        ? this.formatarMoeda(simulacao.valor_entrada)
        : "",
      "{{quantidade_parcelas}}": simulacao.quantidade_parcelas.toString(),
      "{{valor_parcela}}": this.formatarMoeda(simulacao.parcelas[0].valor),
      "{{percentual_juros}}": simulacao.percentual_juros_mora.toString(),
      "{{valor_total}}": this.formatarMoeda(simulacao.valor_total_parcelamento),
      "{{data_primeira_parcela}}": new Date(
        simulacao.data_primeira_parcela
      ).toLocaleDateString("pt-BR"),
      "{{data_expiracao}}": new Date(
        Date.now() + config.prazo_validade_proposta_dias * 24 * 60 * 60 * 1000
      ).toLocaleDateString("pt-BR"),
      "{{quantidade_cobrancas}}": simulacao.cobrancas_origem_ids?.length?.toString() || "1",
    };

    let mensagem = template;
    Object.entries(variaveis).forEach(([chave, valor]) => {
      const regex = new RegExp(chave.replace(/[{}]/g, "\\$&"), "g");
      mensagem = mensagem.replace(regex, valor);
    });

    if (!simulacao.valor_entrada) {
      mensagem = mensagem.replace(/{{#entrada}}.*?{{\/entrada}}/g, "");
    } else {
      mensagem = mensagem.replace(/{{#entrada}}|{{\/entrada}}/g, "");
    }

    return mensagem;
  }

  /**
   * Busca configuração
   */
  private async buscarConfiguracao(): Promise<ConfiguracaoParcelamento> {
    const { data, error } = await supabase
      .from("configuracao_parcelamento")
      .select("*")
      .eq("id", "default")
      .single();

    if (error || !data) {
      // Retorna configuração padrão
      return {
        id: "default",
        percentual_juros_parcela: 3.0,
        valor_minimo_parcela: 200.0,
        quantidade_maxima_parcelas: 42, // Novo máximo de 42 parcelas
        percentual_entrada_minimo: 20.0,
        dias_entre_parcelas: 30,
        prazo_validade_proposta_dias: 7,
        template_whatsapp: `🏪 *PROPOSTA DE PARCELAMENTO*

Olá, {{cliente}}! 

Temos uma proposta especial para regularizar seu(s) débito(s):

💰 *Valor Original:* R$ {{valor_original}}
💰 *Valor Atualizado:* R$ {{valor_atualizado}}

📋 *NOSSA PROPOSTA:*
{{#entrada}}💵 Entrada: R$ {{valor_entrada}}{{/entrada}}
📅 {{quantidade_parcelas}}x de R$ {{valor_parcela}}
📊 Juros: {{percentual_juros}}% por parcela
💳 Total: R$ {{valor_total}}

📅 *Primeira parcela:* {{data_primeira_parcela}}

✅ *Aceita a proposta?*
Responda SIM para confirmar.

⏰ Proposta válida até {{data_expiracao}}

_Equipe Financeira - Cresci e Perdi_`,
        template_email_assunto: "Proposta de Parcelamento - {{cliente}}",
        template_email_corpo: `Prezado(a) {{cliente}},

Temos uma proposta especial para regularizar seu(s) débito(s).

DETALHES DA PROPOSTA:
- Valor Original: R$ {{valor_original}}
- Valor Atualizado: R$ {{valor_atualizado}}
{{#entrada}}- Entrada: R$ {{valor_entrada}}{{/entrada}}
- Parcelamento: {{quantidade_parcelas}}x de R$ {{valor_parcela}}
- Juros aplicado: {{percentual_juros}}% por parcela
- Valor Total: R$ {{valor_total}}
- Primeira parcela: {{data_primeira_parcela}}

Esta proposta é válida até {{data_expiracao}}.

Para aceitar, responda este email confirmando.

Atenciosamente,
Equipe Financeira`,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data;
  }

  /**
   * Métodos auxiliares
   */
  private formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  /**
   * Exporta dados
   */
  async exportarPropostas(filtros: FiltrosSimulacao = {}): Promise<string> {
    try {
      const propostas = await this.buscarPropostas(filtros);

      const cabecalho = [
        "Data Criação",
        "Cliente",
        "CNPJ",
        "Quantidade Parcelas",
        "Valor Total",
        "Status",
        "Enviado Por",
        "Data Aceite",
        "Método Aceite",
      ].join(",");

      const linhas = propostas.map((p) =>
        [
          new Date(p.created_at).toLocaleDateString("pt-BR"),
          `${(p as any).simulacoes_parcelamento?.cobrancas_origem_ids?.length || 1} cobrança(s)`,
          p.cnpj_unidade,
          (p as any).simulacoes_parcelamento?.quantidade_parcelas || "",
          this.formatarMoeda(
            (p as any).simulacoes_parcelamento?.valor_total_parcelamento || 0
          ),
          p.status_proposta,
          p.enviado_por,
          p.aceito_em ? new Date(p.aceito_em).toLocaleDateString("pt-BR") : "",
          "",
        ].join(",")
      );

      return [cabecalho, ...linhas].join("\n");
    } catch (error) {
      console.error("Erro ao exportar propostas:", error);
      throw error;
    }
  }
}
      // Buscar dados das cobranças originais para contexto
      const { data: cobrancasOriginais } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          *,
          unidades_franqueadas!left (
            nome_unidade,
            email_unidade,
            telefone_unidade,
            franqueado_unidades!left (
              franqueados!left (
                nome_completo,
                email,
                telefone
              )
            )
          )
        `
        )
        .in("id", simulacao.cobrancas_origem_ids);

      const cobranca = cobrancasOriginais?.[0]; // Usar primeira cobrança para dados de contexto
      const unidade = cobranca?.unidades_franqueadas || null;
      const franqueado = unidade?.franqueado_unidades?.[0]?.franqueados || null;

      const config = await this.buscarConfiguracao();

      // Gera mensagem personalizada
      const mensagem = this.gerarMensagemProposta(
        simulacao,
        {
          ...cobranca,
          cliente: \`${cobrancasOriginais?.length || 1} cobrança(s) consolidada(s)`
        },
        unidade,
        franqueado,
        config
      );

      // Calcula data de expiração
      const dataExpiracao = new Date();
      dataExpiracao.setDate(
        dataExpiracao.getDate() + config.prazo_validade_proposta_dias
      );

      const proposta: Omit<
        PropostaParcelamento,
        "id" | "created_at" | "updated_at"
      > = {
        simulacao_id: simulacaoId,
        parcelamento_master_id: simulacao.parcelamento_master_id,
        cnpj_unidade: simulacao.cnpj_unidade,
        mensagem_proposta: mensagem,
        canais_envio: canaisEnvio,
        enviado_por: usuario,
        status_proposta: "enviada",
        data_expiracao: dataExpiracao.toISOString(),
      };

      const { data, error } = await supabase
        .from("propostas_parcelamento")
        .insert(proposta)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar proposta: ${error.message}`);
      }

      // Registra tratativa para todas as cobranças originais
      for (const cobrancaId of simulacao.cobrancas_origem_ids) {
        await this.tratativasService.registrarObservacao(
          cobrancaId,
          usuario,
          `Proposta de parcelamento gerada: ${
            simulacao.quantidade_parcelas
          }x com juros de ${
            simulacao.percentual_juros_mora
          }%. Válida até ${dataExpiracao.toLocaleDateString("pt-BR")}. Consolidando ${simulacao.cobrancas_origem_ids.length} cobrança(s).`
        );
      }

      return data;
    } catch (error) {
      console.error("Erro ao gerar proposta:", error);
      throw error;
    }
  }

  /**
   * Busca cobranças disponíveis para parcelamento por CNPJ/CPF
   */
  async buscarCobrancasParaParcelamento(cnpjCpf: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("cobrancas_franqueados")
        .select(`
          id,
          cnpj,
          cpf,
          cliente,
          valor_original,
          valor_atualizado,
          data_vencimento,
          status,
          tipo_cobranca,
          descricao,
          dias_em_atraso
        `)
        .or(`cnpj.eq.${cnpjCpf},cpf.eq.${cnpjCpf}`)
        .in("status", ["em_aberto", "em_atraso", "negociando"])
        .is("parcelamento_master_id", null) // Apenas cobranças que ainda não foram parceladas
        .eq("is_parcela", false) // Apenas cobranças originais, não parcelas
        .order("data_vencimento", { ascending: true });

      if (error) {
        throw new Error(`Erro ao buscar cobranças: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Erro ao buscar cobranças para parcelamento:", error);
      throw error;
    }
  }

  /**
   * Busca detalhes de um parcelamento master
   */
  async buscarDetalhesParcelamento(parcelamentoMasterId: string): Promise<{
    parcelamento: any;
    cobrancas_originais: any[];
    parcelas_cobrancas: any[];
    acordo: any;
  } | null> {
    try {
      // Buscar parcelamento master
      const { data: parcelamento } = await supabase
        .from("parcelamentos_master")
        .select("*")
        .eq("id", parcelamentoMasterId)
        .single();

      if (!parcelamento) return null;

      // Buscar cobranças originais
      const { data: cobrancasOriginais } = await supabase
        .from("cobrancas_franqueados")
        .select("*")
        .eq("parcelamento_master_id", parcelamentoMasterId)
        .eq("is_parcela", false);

      // Buscar parcelas (cobranças geradas)
      const { data: parcelasCobrancas } = await supabase
        .from("cobrancas_franqueados")
        .select(`
          *,
          parcelas_acordo!parcela_origem_id (
            numero_parcela,
            status_parcela,
            data_pagamento,
            valor_pago
          )
        `)
        .eq("parcelamento_master_id", parcelamentoMasterId)
        .eq("is_parcela", true)
        .order("data_vencimento", { ascending: true });

      // Buscar acordo
      const { data: acordo } = await supabase
        .from("acordos_parcelamento")
        .select("*")
        .eq("parcelamento_master_id", parcelamentoMasterId)
        .single();

      return {
        parcelamento,
        cobrancas_originais: cobrancasOriginais || [],
        parcelas_cobrancas: parcelasCobrancas || [],
        acordo
      };
    } catch (error) {
      console.error("Erro ao buscar detalhes do parcelamento:", error);
      return null;
    }
  }

  /**
   * Registra pagamento de uma parcela
   */
  async registrarPagamentoParcela(
    cobrancaParcelaId: string,
    valorPago: number,
    dataPagamento: string,
    usuario: string
  ): Promise<void> {
    try {
      // Buscar dados da cobrança da parcela
      const { data: cobrancaParcela } = await supabase
        .from("cobrancas_franqueados")
        .select("parcela_origem_id, parcelamento_master_id")
        .eq("id", cobrancaParcelaId)
        .eq("is_parcela", true)
        .single();

      if (!cobrancaParcela || !cobrancaParcela.parcela_origem_id) {
        throw new Error("Parcela não encontrada");
      }

      // Atualizar status da cobrança da parcela para quitado
      await supabase
        .from("cobrancas_franqueados")
        .update({
          status: 'quitado',
          valor_recebido: valorPago,
          data_ultima_atualizacao: dataPagamento
        })
        .eq("id", cobrancaParcelaId);

      // Atualizar parcelas_acordo
      await supabase
        .from("parcelas_acordo")
        .update({
          status_parcela: 'pago',
          valor_pago: valorPago,
          data_pagamento: dataPagamento
        })
        .eq("id", cobrancaParcela.parcela_origem_id);

      // Verificar se todas as parcelas foram pagas
      await this.verificarConclusaoParcelamento(cobrancaParcela.parcelamento_master_id);

      // Registrar tratativa
      await this.tratativasService.registrarObservacao(
        cobrancaParcelaId,
        usuario,
        `Parcela paga: R$ ${valorPago.toFixed(2)} em ${new Date(dataPagamento).toLocaleDateString("pt-BR")}`,
        "quitado"
      );
    } catch (error) {
      console.error("Erro ao registrar pagamento da parcela:", error);
      throw error;
    }
  }

  /**
   * Verifica se o parcelamento foi totalmente cumprido
   */
  private async verificarConclusaoParcelamento(parcelamentoMasterId: string): Promise<void> {
    try {
      // Buscar todas as parcelas do parcelamento
      const { data: parcelas } = await supabase
        .from("cobrancas_franqueados")
        .select("status")
        .eq("parcelamento_master_id", parcelamentoMasterId)
        .eq("is_parcela", true);

      if (!parcelas || parcelas.length === 0) return;

      // Verificar se todas estão quitadas
      const todasQuitadas = parcelas.every(p => p.status === 'quitado');

      if (todasQuitadas) {
        // Atualizar status do parcelamento master
        await supabase
          .from("parcelamentos_master")
          .update({ status: 'cumprido' })
          .eq("id", parcelamentoMasterId);

        // Atualizar acordo
        await supabase
          .from("acordos_parcelamento")
          .update({ status_acordo: 'cumprido' })
          .eq("parcelamento_master_id", parcelamentoMasterId);

        console.log(`Parcelamento ${parcelamentoMasterId} totalmente cumprido`);
      }
    } catch (error) {
      console.error("Erro ao verificar conclusão do parcelamento:", error);
    }
  }

  /**
   * Lista parcelamentos ativos
   */
  async listarParcelamentosAtivos(cnpjCpf?: string): Promise<any[]> {
    try {
      let query = supabase
        .from("parcelamentos_master")
        .select(`
          *,
          acordos_parcelamento (
            quantidade_parcelas,
            valor_parcela,
            status_acordo
          )
        `)
        .in("status", ["aceito", "proposto"])
        .order("created_at", { ascending: false });

      if (cnpjCpf) {
        query = query.eq("cnpj_unidade", cnpjCpf);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao listar parcelamentos: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Erro ao listar parcelamentos ativos:", error);
      return [];
    }
  }

  /**
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (filtros.cnpj) {
        query = query.ilike("cnpj_unidade", `%${filtros.cnpj}%`);
      }

      if (filtros.status_proposta) {
        query = query.eq("status_proposta", filtros.status_proposta);
      }

      if (filtros.data_inicio) {
        query = query.gte("created_at", filtros.data_inicio);
      }

      if (filtros.data_fim) {
        query = query.lte("created_at", filtros.data_fim);
      }

      if (filtros.enviado_por) {
        query = query.ilike("enviado_por", `%${filtros.enviado_por}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar propostas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Erro ao buscar propostas:", error);
      throw error;
    }
  }

  /**
   * Busca estatísticas
   */
  async buscarEstatisticas(): Promise<EstatisticasParcelamento> {
    try {
      const { data: propostas } = await supabase
        .from("propostas_parcelamento")
        .select("status_proposta, created_at, aceito_em");

      const { data: simulacoes } = await supabase
        .from("simulacoes_parcelamento")
        .select("valor_total_parcelamento");

      // Usa a tabela de registros de aceite como fonte oficial de propostas aceitas
      const { data: aceites } = await supabase
        .from("registros_aceite_parcelamento")
        .select("id");

      const stats: EstatisticasParcelamento = {
        total_simulacoes: simulacoes?.length || 0,
        propostas_enviadas: propostas?.length || 0,
        propostas_aceitas: aceites?.length || 0,
        propostas_recusadas:
          propostas?.filter((p) => p.status_proposta === "recusada").length ||
          0,
        taxa_conversao: 0,
        valor_total_parcelado:
          simulacoes?.reduce((sum, s) => sum + s.valor_total_parcelamento, 0) ||
          0,
        tempo_medio_resposta: 0,
      };

      if (stats.propostas_enviadas > 0) {
        stats.taxa_conversao =
          (stats.propostas_aceitas / stats.propostas_enviadas) * 100;
      }

      return stats;
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      throw error;
    }
  }

  /**
   * Lista registros de aceite
   */
  async buscarAceites(): Promise<RegistroAceite[]> {
    try {
      const { data, error } = await supabase
        .from("registros_aceite_parcelamento")
        .select("*")
        .order("data_aceite", { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar aceites: ${error.message}`);
      }

      return (data as unknown as RegistroAceite[]) || [];
    } catch (error) {
      console.error("Erro ao buscar aceites:", error);
      throw error;
    }
  }

  /**
   * Busca configuração
   */
  private async buscarConfiguracao(): Promise<ConfiguracaoParcelamento> {
    const { data, error } = await supabase
      .from("configuracao_parcelamento")
      .select("*")
      .eq("id", "default")
      .single();

    if (error || !data) {
      // Retorna configuração padrão
      return {
        id: "default",
        percentual_juros_parcela: 10.0,
        valor_minimo_parcela: 100.0, // CORRIGIDO
        quantidade_maxima_parcelas: 6,
        percentual_entrada_minimo: 20.0,
        dias_entre_parcelas: 30,
        prazo_validade_proposta_dias: 7,
        template_whatsapp: `🏪 *PROPOSTA DE PARCELAMENTO*

Olá, {{cliente}}! 

Temos uma proposta especial para regularizar seu débito:

💰 *Valor Original:* R$ {{valor_original}}
💰 *Valor Atualizado:* R$ {{valor_atualizado}}

📋 *NOSSA PROPOSTA:*
{{#entrada}}💵 Entrada: R$ {{valor_entrada}}{{/entrada}}
📅 {{quantidade_parcelas}}x de R$ {{valor_parcela}}
📊 Juros: {{percentual_juros}}% por parcela
💳 Total: R$ {{valor_total}}

📅 *Primeira parcela:* {{data_primeira_parcela}}

✅ *Aceita a proposta?*
Responda SIM para confirmar.

⏰ Proposta válida até {{data_expiracao}}

_Equipe Financeira - Cresci e Perdi_`,
        template_email_assunto: "Proposta de Parcelamento - {{cliente}}",
        template_email_corpo: `Prezado(a) {{cliente}},

Temos uma proposta especial para regularizar seu débito da unidade {{codigo_unidade}}.

DETALHES DA PROPOSTA:
- Valor Original: R$ {{valor_original}}
- Valor Atualizado: R$ {{valor_atualizado}}
{{#entrada}}- Entrada: R$ {{valor_entrada}}{{/entrada}}
- Parcelamento: {{quantidade_parcelas}}x de R$ {{valor_parcela}}
- Juros aplicado: {{percentual_juros}}% por parcela
- Valor Total: R$ {{valor_total}}
- Primeira parcela: {{data_primeira_parcela}}

Esta proposta é válida até {{data_expiracao}}.

Para aceitar, responda este email confirmando.

Atenciosamente,
Equipe Financeira`,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data;
  }

  /**
   * Gera mensagem personalizada da proposta
   */
  private gerarMensagemProposta(
    simulacao: any,
    cobrancaConsolidada: any,
    unidade: any,
    franqueado: any,
    config: ConfiguracaoParcelamento
  ): string {
    const template = config.template_whatsapp;

    // Nome do destinatário: prioriza franqueado válido; caso contrário, usa o cliente da cobrança
    const nomeCliente =
      franqueado?.nome_completo &&
      franqueado.nome_completo !== "Sem nome cadastrado"
        ? franqueado.nome_completo
        : cobrancaConsolidada?.cliente || "Franqueado(a)";

    // Documento exibível: CPF > CNPJ; fallback para código da unidade; por fim, rótulo genérico
    const documentoExibivel = simulacao.cnpj_unidade
      ? formatarCNPJCPF(String(simulacao.cnpj_unidade))
      : unidade?.codigo_unidade || "Documento";

    const variaveis = {
      "{{cliente}}": nomeCliente,
      "{{codigo_unidade}}": documentoExibivel,
      "{{valor_original}}": this.formatarMoeda(simulacao.valor_original),
      "{{valor_atualizado}}": this.formatarMoeda(simulacao.valor_atualizado),
      "{{valor_entrada}}": simulacao.valor_entrada
        ? this.formatarMoeda(simulacao.valor_entrada)
        : "",
      "{{quantidade_parcelas}}": simulacao.quantidade_parcelas.toString(),
      "{{valor_parcela}}": this.formatarMoeda(simulacao.parcelas[0].valor),
      "{{percentual_juros}}": simulacao.percentual_juros_mora.toString(),
      "{{valor_total}}": this.formatarMoeda(simulacao.valor_total_parcelamento),
      "{{data_primeira_parcela}}": new Date(
        simulacao.data_primeira_parcela
      ).toLocaleDateString("pt-BR"),
      "{{data_expiracao}}": new Date(
        Date.now() + config.prazo_validade_proposta_dias * 24 * 60 * 60 * 1000
      ).toLocaleDateString("pt-BR"),
      "{{quantidade_cobrancas}}": simulacao.cobrancas_origem_ids?.length?.toString() || "1",
    };

    let mensagem = template;
    Object.entries(variaveis).forEach(([chave, valor]) => {
      const regex = new RegExp(chave.replace(/[{}]/g, "\\$&"), "g");
      mensagem = mensagem.replace(regex, valor);
    });

    if (!simulacao.valor_entrada) {
      mensagem = mensagem.replace(/{{#entrada}}.*?{{\/entrada}}/g, "");
    } else {
      mensagem = mensagem.replace(/{{#entrada}}|{{\/entrada}}/g, "");
    }

    return mensagem;
  }

  /**
   * Métodos auxiliares
   */
  private formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  /**
   * Exporta dados
   */
  async exportarPropostas(filtros: FiltrosSimulacao = {}): Promise<string> {
    try {
      const propostas = await this.buscarPropostas(filtros);

      const cabecalho = [
        "Data Criação",
        "Cliente",
        "CNPJ",
        "Quantidade Parcelas",
        "Valor Total",
        "Status",
        "Enviado Por",
        "Data Aceite",
        "Método Aceite",
      ].join(",");

      const linhas = propostas.map((p) =>
        [
          new Date(p.created_at).toLocaleDateString("pt-BR"),
          `${(p as any).simulacoes_parcelamento?.cobrancas_origem_ids?.length || 1} cobrança(s)`,
          p.cnpj_unidade,
          (p as any).simulacoes_parcelamento?.quantidade_parcelas || "",
          this.formatarMoeda(
            (p as any).simulacoes_parcelamento?.valor_total_parcelamento || 0
          ),
          p.status_proposta,
          p.enviado_por,
          p.aceito_em ? new Date(p.aceito_em).toLocaleDateString("pt-BR") : "",
          "",
        ].join(",")
      );

      return [cabecalho, ...linhas].join("\n");
    } catch (error) {
      console.error("Erro ao exportar propostas:", error);
      throw error;
    }
  }
}
